// A minimal MCP client, dependency-free on purpose — the same call `github.ts`
// makes: a protocol this small is cheaper to own than to depend on, and the SDK
// would have to be bundled into the main process for one JSON-RPC handshake.
//
// Two transports:
//   stdio — spawn the command, newline-delimited JSON-RPC over stdin/stdout.
//   http  — Streamable HTTP: POST the request, read back either a JSON body or
//           an SSE stream, and echo the `Mcp-Session-Id` the server hands out.
//
// Connections are short-lived and made per call. An MCP server is not a session
// the app needs to hold open: Octo talks to a tracker a handful of times per
// spec, and a pool of long-lived child processes would be a lifecycle problem
// (and a leak) for no gain.

import { spawn } from 'node:child_process';
import type { McpToolMeta, McpCallResult, McpServerMeta } from './shared/types.js';

const PROTOCOL_VERSION = '2025-06-18';
const CLIENT_INFO = { name: 'octo', version: '0.1.0' };
// Long because remote trackers can be: Atlassian's `getJiraIssue` and
// `searchJiraIssuesUsingJql` are reported to take up to a minute on issues with
// heavy comment streams, and timing those out would fail on exactly the rich
// tickets a spec most wants to start from.
const DEFAULT_TIMEOUT = 60000;

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * The server refused the credentials. Typed rather than a message, because the
 * UI's answer differs per provider — paste a token, or start a sign-in — and a
 * string forces every caller to guess which.
 */
export class McpAuthRequired extends Error {
  readonly status: number;
  constructor(status: number, server: string) {
    super(`The MCP server "${server}" rejected the credentials (HTTP ${status}).`);
    this.name = 'McpAuthRequired';
    this.status = status;
  }
}

/**
 * The server no longer knows the session we were using.
 *
 * Streamable HTTP answers 404 for this, and the spec is explicit about the
 * remedy: a client that gets 404 for a request carrying an `Mcp-Session-Id`
 * must start a new session with a fresh `initialize`. It happens routinely —
 * sessions expire, and a remote server behind several nodes can route a
 * follow-up request to one that never saw the handshake.
 */
/**
 * An error that remembers the exchange that produced it.
 *
 * A bare message is not enough to diagnose a remote MCP server: the same
 * sentence means different things depending on which endpoint answered, whether
 * a session had been established, and what the server said in the body. This
 * carries all of it so the UI can hand the user something worth pasting.
 */
export class McpError extends Error {
  readonly detail: Record<string, unknown>;
  constructor(message: string, detail: Record<string, unknown>) {
    super(message);
    this.name = 'McpError';
    this.detail = detail;
  }
}

class SessionGone extends Error {
  constructor() {
    super('The MCP session is no longer valid.');
    this.name = 'SessionGone';
  }
}

export interface McpConnection {
  server: McpServerMeta;
  /**
   * The `Authorization` header value for a remote server. A bare token is sent
   * as `Bearer <token>`; a value that already names its scheme is sent as-is,
   * which is what lets Atlassian's `Basic base64(email:api_token)` work through
   * the same field.
   */
  token?: string | null;
  timeoutMs?: number;
}

/** The JSON-RPC method a request body carries, for error reporting. */
function methodOf(request: string): string | undefined {
  try {
    return (JSON.parse(request) as { method?: string }).method;
  } catch {
    return undefined;
  }
}

function rpc(id: number, method: string, params?: unknown) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} });
}
function notify(method: string, params?: unknown) {
  return JSON.stringify({ jsonrpc: '2.0', method, params: params ?? {} });
}

/**
 * Pull JSON-RPC responses out of a body that may be either a plain JSON
 * document or an SSE stream. Servers pick per request, and the spec allows
 * both, so the client cannot assume from the URL.
 */
function parseBody(contentType: string, text: string): JsonRpcResponse[] {
  if (contentType.includes('text/event-stream')) {
    const out: JsonRpcResponse[] = [];
    for (const frame of text.split(/\n\n/)) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          out.push(JSON.parse(payload));
        } catch {
          // a keep-alive or a partial frame; ignore
        }
      }
    }
    return out;
  }
  if (!text.trim()) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

// ---------- HTTP (Streamable) ----------

class HttpSession {
  private sessionId: string | null = null;
  /**
   * The version the server agreed to, which is what later requests must
   * advertise — not the one we asked for. Sending a version the server did not
   * negotiate is how a perfectly good session starts getting rejected.
   */
  private protocolVersion = PROTOCOL_VERSION;
  private url: string;
  private token: string | null | undefined;
  private timeoutMs: number;
  private serverName: string;

  // Written out rather than declared as constructor parameter properties: those
  // are the one TS feature that cannot be type-stripped, and this file is read
  // by tooling that runs it without a compiler.
  constructor(url: string, token: string | null | undefined, timeoutMs: number, serverName: string) {
    this.url = url;
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.serverName = serverName;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': this.protocolVersion,
    };
    if (this.token) {
      h.authorization = /^(bearer|basic)\s/i.test(this.token) ? this.token : `Bearer ${this.token}`;
    }
    if (this.sessionId) h['mcp-session-id'] = this.sessionId;
    return h;
  }

  /**
   * Handshake: `initialize`, remember what the server called the session and
   * which protocol version it agreed to, then say we are ready.
   */
  async open(): Promise<void> {
    this.sessionId = null;
    this.protocolVersion = PROTOCOL_VERSION;
    const res = await this.send(
      rpc(1, 'initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO,
      }),
      1
    );
    const result = unwrap(res, 'initialize') as { protocolVersion?: unknown };
    if (typeof result?.protocolVersion === 'string') this.protocolVersion = result.protocolVersion;
    // A server that rejects this notification has already forgotten the session
    // it just handed us; the retry on the first real request will re-open.
    await this.send(notify('notifications/initialized'), null).catch(() => undefined);
  }

  /** One request, re-opening the session **once** if the server says it is gone. */
  async request(body: string, id: number): Promise<JsonRpcResponse | null> {
    try {
      return await this.send(body, id);
    } catch (err) {
      if (!(err instanceof SessionGone)) throw err;
      await this.open();
      return this.send(body, id);
    }
  }

  private async send(request: string, expectId: number | null): Promise<JsonRpcResponse | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        headers: this.headers(),
        body: request,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const sid = res.headers.get('mcp-session-id');
    if (sid) this.sessionId = sid;

    if (res.status === 401 || res.status === 403) {
      // Atlassian answers `WWW-Authenticate: Bearer realm="OAuth", error=…` with
      // no `resource_metadata` and no `scope`, and its
      // `/.well-known/oauth-protected-resource` 404s, so there is nothing in the
      // challenge worth parsing. The status is the whole signal.
      throw new McpAuthRequired(res.status, this.serverName);
    }
    // 404 while carrying a session id is the protocol's "your session is gone",
    // not a missing endpoint — `request` re-opens and retries once.
    if (res.status === 404 && this.sessionId) throw new SessionGone();
    if (!res.ok) {
      const answer = (await res.text().catch(() => '')).slice(0, 500);
      throw new McpError(
        `HTTP ${res.status} from the MCP server${answer ? `: ${answer}` : ''}` +
          (res.status === 404
            ? ' — check the server URL; remote MCP servers usually end in /mcp.'
            : ''),
        {
          url: this.url,
          status: res.status,
          method: methodOf(request),
          sessionEstablished: Boolean(this.sessionId),
          protocolVersion: this.protocolVersion,
          contentType: res.headers.get('content-type'),
          wwwAuthenticate: res.headers.get('www-authenticate'),
          answer,
        }
      );
    }
    // A notification gets 202 with no body, which is not an error.
    if (expectId === null) return null;

    const text = await res.text();
    const msgs = parseBody(res.headers.get('content-type') ?? '', text);
    return msgs.find((m) => m.id === expectId) ?? msgs[0] ?? null;
  }
}

// ---------- stdio ----------

/**
 * Run one request/response exchange against a stdio server.
 *
 * The whole handshake goes down a single spawn: MCP requires `initialize`
 * before anything else, and a fresh process would have to redo it anyway.
 */
async function stdioExchange(
  command: string,
  requests: string[],
  expectIds: (number | null)[],
  timeoutMs: number
): Promise<JsonRpcResponse[]> {
  const [bin, ...args] = command.split(/\s+/).filter(Boolean);
  if (!bin) throw new Error('This server has no command to run.');

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const wanted = expectIds.filter((i): i is number => i !== null);
    const got = new Map<number, JsonRpcResponse>();
    let buf = '';
    let stderr = '';
    let settled = false;

    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (err) reject(err);
      else resolve(wanted.map((id) => got.get(id)!).filter(Boolean));
    };

    const timer = setTimeout(
      () =>
        done(
          new Error(
            `The server did not answer within ${Math.round(timeoutMs / 1000)}s${
              stderr ? `: ${stderr.slice(0, 200)}` : ''
            }`
          )
        ),
      timeoutMs
    );

    child.on('error', (e) => done(new Error(`Could not start "${bin}": ${e.message}`)));
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.stdout.on('data', (d) => {
      buf += String(d);
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as JsonRpcResponse;
          if (typeof msg.id === 'number') got.set(msg.id, msg);
        } catch {
          // servers sometimes log to stdout; skip anything that isn't JSON-RPC
        }
      }
      if (wanted.every((id) => got.has(id))) done();
    });
    child.on('close', () => done());

    for (const r of requests) child.stdin.write(r + '\n');
  });
}

// ---------- the two operations Octo needs ----------

function unwrap(res: JsonRpcResponse | null | undefined, what: string): unknown {
  if (!res) throw new Error(`The server returned nothing for ${what}.`);
  if (res.error) throw new Error(res.error.message || `The server rejected ${what}.`);
  return res.result;
}

function isHttp(server: McpServerMeta): boolean {
  return server.type === 'http' || Boolean(server.url);
}

/** `initialize` → `notifications/initialized` → `tools/list`. */
export async function mcpListTools(conn: McpConnection): Promise<McpToolMeta[]> {
  const timeoutMs = conn.timeoutMs ?? DEFAULT_TIMEOUT;
  const init = rpc(1, 'initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: CLIENT_INFO,
  });
  const ready = notify('notifications/initialized');
  const list = rpc(2, 'tools/list');

  let result: unknown;
  if (isHttp(conn.server)) {
    if (!conn.server.url) throw new Error('This server has no URL.');
    const session = new HttpSession(conn.server.url, conn.token, timeoutMs, conn.server.name);
    await session.open();
    result = unwrap(await session.request(list, 2), 'tools/list');
  } else {
    const out = await stdioExchange(conn.server.command ?? '', [init, ready, list], [1, null, 2], timeoutMs);
    result = unwrap(out.find((m) => m.id === 2), 'tools/list');
  }

  const tools = (result as { tools?: unknown[] })?.tools ?? [];
  return tools
    .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object')
    .map((t) => ({
      name: String(t.name ?? ''),
      description: typeof t.description === 'string' ? t.description : '',
      inputSchema: (t.inputSchema ?? null) as McpToolMeta['inputSchema'],
    }))
    .filter((t) => t.name);
}

/** `tools/call`, with the content flattened to text the renderer can show. */
export async function mcpCallTool(
  conn: McpConnection,
  name: string,
  args: Record<string, unknown>
): Promise<McpCallResult> {
  const timeoutMs = conn.timeoutMs ?? DEFAULT_TIMEOUT;
  const init = rpc(1, 'initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: CLIENT_INFO,
  });
  const ready = notify('notifications/initialized');
  const call = rpc(3, 'tools/call', { name, arguments: args });

  let result: unknown;
  if (isHttp(conn.server)) {
    if (!conn.server.url) throw new Error('This server has no URL.');
    const session = new HttpSession(conn.server.url, conn.token, timeoutMs, conn.server.name);
    await session.open();
    result = unwrap(await session.request(call, 3), `tools/call ${name}`);
  } else {
    const out = await stdioExchange(conn.server.command ?? '', [init, ready, call], [1, null, 3], timeoutMs);
    result = unwrap(out.find((m) => m.id === 3), `tools/call ${name}`);
  }

  const r = (result ?? {}) as { content?: unknown[]; isError?: boolean; structuredContent?: unknown };
  const text = (r.content ?? [])
    .map((c) => {
      const block = c as { type?: string; text?: string };
      return block?.type === 'text' ? (block.text ?? '') : `[${block?.type ?? 'unknown'}]`;
    })
    .join('\n')
    .trim();

  // `structuredContent` is optional, and plenty of servers answer with the JSON
  // sitting inside the text block instead — Atlassian's does. Every consumer
  // here prefers structured data and falls back to scraping prose, so without
  // this the JSON would be scraped as if it were English and yield nothing.
  return { ok: !r.isError, text, structured: r.structuredContent ?? jsonIn(text) };
}

/**
 * The JSON a text block is carrying, if that is what it is.
 *
 * Only objects and arrays count: a bare `"Created OCTO-42"` is valid JSON for a
 * string, and treating it as structured data would hide the prose path that
 * actually knows how to read it.
 */
function jsonIn(text: string): unknown {
  const t = text.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(t);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
