// OAuth 2.1 for remote MCP servers, in the shape the MCP spec settled on:
// discovery → dynamic client registration → authorization code with PKCE →
// refresh. Dependency-free, like the client it serves.
//
// Two choices worth stating, because both are security decisions rather than
// preferences:
//
// **Loopback, not a custom scheme.** RFC 8252 §7.3 requires an authorization
// server to accept any port on a loopback redirect, precisely so a native app
// can take an ephemeral one from the OS. A fixed port is a local
// code-injection surface — any process on the machine can race the listener —
// and a custom `octo://` scheme would need a single-instance lock the app does
// not have. The listener is created per attempt and closed in `finally`.
//
// **Both hostnames are registered.** RFC 8252 prefers the `127.0.0.1` literal
// over `localhost`, which can resolve to a non-loopback interface. But there
// are reports of Atlassian rejecting the literal against its redirect
// allowlist, so registration sends both forms and the flow falls back.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** What the authorization server says about itself (RFC 8414). */
export interface AuthServerMeta {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
}

/** Everything needed to keep talking to a server, once signed in. */
export interface OAuthRecord {
  issuer: string;
  clientId: string;
  accessToken: string;
  refreshToken?: string;
  /** ms since epoch; absent when the server did not say. */
  expiresAt?: number;
  account?: string;
}

const AUTH_TIMEOUT_MS = 120_000;
const CLIENT_NAME = 'Octo';

function originOf(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

/** RFC 8414 discovery, from the MCP server's own origin. */
export async function discoverAuthServer(serverUrl: string): Promise<AuthServerMeta> {
  const url = `${originOf(serverUrl)}/.well-known/oauth-authorization-server`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(
      `This server does not publish OAuth metadata at ${url} (HTTP ${res.status}), so Octo cannot sign in to it. Use a token instead.`
    );
  }
  const meta = (await res.json()) as AuthServerMeta;
  if (!meta.authorization_endpoint || !meta.token_endpoint) {
    throw new Error('The server’s OAuth metadata is missing an authorization or token endpoint.');
  }
  return meta;
}

/**
 * Register Octo as a public client. Public because a desktop app cannot keep a
 * secret — `token_endpoint_auth_method: 'none'` is the honest declaration, and
 * PKCE is what actually protects the exchange.
 */
async function registerClient(meta: AuthServerMeta, redirectUris: string[]): Promise<string> {
  if (!meta.registration_endpoint) {
    throw new Error(
      'This server does not offer dynamic client registration, so Octo cannot register itself. Use a token instead.'
    );
  }
  const res = await fetch(meta.registration_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: CLIENT_NAME,
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof body.client_id !== 'string') {
    const detail =
      typeof body.error_description === 'string'
        ? body.error_description
        : typeof body.error === 'string'
          ? body.error
          : `HTTP ${res.status}`;
    throw new Error(`The server refused to register Octo as a client: ${detail}`);
  }
  return body.client_id;
}

function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Constant-time compare that cannot throw on a length mismatch. */
function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const DONE_PAGE = (ok: boolean) =>
  `<!doctype html><meta charset="utf-8"><title>Octo</title>` +
  `<body style="font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#1e1e1e;color:#ececec">` +
  `<p>${ok ? 'Signed in. You can close this tab and go back to Octo.' : 'Sign-in failed. You can close this tab.'}</p>`;

/**
 * Listen on an ephemeral loopback port for the authorization redirect.
 *
 * Resolves with the code once the browser lands on `/callback` carrying a
 * matching `state`. Anything else — another path, a mismatched state, the
 * server's own `error` — rejects, and the server is closed either way.
 */
function awaitRedirect(
  state: string
): Promise<{ port: number; code: Promise<string> }> {
  return new Promise((resolvePort, rejectPort) => {
    let settle: (v: string) => void;
    let fail: (e: Error) => void;
    const code = new Promise<string>((res, rej) => {
      settle = res;
      fail = rej;
    });

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const err = url.searchParams.get('error');
      const got = url.searchParams.get('state') ?? '';
      const authCode = url.searchParams.get('code');

      const ok = !err && Boolean(authCode) && sameState(state, got);
      res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' });
      res.end(DONE_PAGE(ok));

      if (err) fail(new Error(`The authorization server returned "${err}".`));
      else if (!sameState(state, got)) fail(new Error('The redirect carried the wrong state.'));
      else if (!authCode) fail(new Error('The redirect carried no authorization code.'));
      else settle(authCode);
      server.close();
    });

    const timer = setTimeout(() => {
      fail(new Error('Timed out waiting for the browser to finish signing in.'));
      server.close();
    }, AUTH_TIMEOUT_MS);
    timer.unref();
    code.finally(() => clearTimeout(timer)).catch(() => undefined);

    server.on('error', (e) => rejectPort(e));
    server.listen(0, '127.0.0.1', () => {
      resolvePort({ port: (server.address() as AddressInfo).port, code });
    });
  });
}

async function exchange(
  meta: AuthServerMeta,
  body: Record<string, string>
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const res = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof json.access_token !== 'string') {
    const detail =
      typeof json.error_description === 'string'
        ? json.error_description
        : typeof json.error === 'string'
          ? json.error
          : `HTTP ${res.status}`;
    throw new Error(`The token request failed: ${detail}`);
  }
  return json as { access_token: string; refresh_token?: string; expires_in?: number };
}

function toRecord(
  meta: AuthServerMeta,
  clientId: string,
  tok: { access_token: string; refresh_token?: string; expires_in?: number },
  previous?: OAuthRecord
): OAuthRecord {
  return {
    issuer: meta.issuer,
    clientId,
    accessToken: tok.access_token,
    // A refresh response may legitimately omit the refresh token, meaning
    // "keep the one you have".
    refreshToken: tok.refresh_token ?? previous?.refreshToken,
    expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
    account: previous?.account,
  };
}

/**
 * The whole interactive flow. `openUrl` is injected so the caller decides how a
 * browser is opened — and so the flow is testable without one.
 */
export async function signIn(
  serverUrl: string,
  openUrl: (url: string) => void,
  opts?: { clientId?: string; scope?: string }
): Promise<OAuthRecord> {
  const meta = await discoverAuthServer(serverUrl);
  const { verifier, challenge } = pkce();
  const state = randomBytes(16).toString('base64url');
  const { port, code } = await awaitRedirect(state);

  // Both hostnames, so an allowlist that accepts only one still works.
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const redirectUris = [redirectUri, `http://localhost:${port}/callback`];
  const clientId = opts?.clientId ?? (await registerClient(meta, redirectUris));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  // Deliberately omitted unless asked for: this server publishes no
  // `scopes_supported`, and a wrong scope fails inside the browser where Octo
  // cannot see the error.
  if (opts?.scope) params.set('scope', opts.scope);

  openUrl(`${meta.authorization_endpoint}?${params.toString()}`);

  const authCode = await code;
  const tok = await exchange(meta, {
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  });
  return toRecord(meta, clientId, tok);
}

/** Trade a refresh token for a new access token, keeping the rest of the record. */
export async function refresh(serverUrl: string, record: OAuthRecord): Promise<OAuthRecord> {
  if (!record.refreshToken) throw new Error('No refresh token — sign in again.');
  const meta = await discoverAuthServer(serverUrl);
  const tok = await exchange(meta, {
    grant_type: 'refresh_token',
    refresh_token: record.refreshToken,
    client_id: record.clientId,
  });
  return toRecord(meta, record.clientId, tok, record);
}

/** True when the token is gone or close enough to expiry to be worth renewing. */
export function needsRefresh(record: OAuthRecord, skewMs = 60_000): boolean {
  return typeof record.expiresAt === 'number' && record.expiresAt - Date.now() < skewMs;
}
