// Keeping a spec and its tracker ticket in step.
//
// Octo does not model tickets — the tracker does. What lives here is the
// translation: for a given moment in a spec's life ("plan approved", "PR
// opened"), which tool on which MCP server gets called, with what arguments.
//
// Two rules shape the design:
//
// 1. **Every write is a `TicketAction` first.** Nothing calls a tool directly;
//    an adapter builds `{tool, args, summary}`, the renderer shows exactly that
//    for confirmation, and only then is it sent. A sync that writes into a
//    board shared with your team has to be inspectable before it happens, not
//    explicable afterwards.
// 2. **Adapters are per-tracker, mappings are discovered.** The `tracker`
//    adapter is written against that server's real tool schema. Anything else
//    goes through `generic`, which matches capabilities to tool names by
//    heuristic and lets the user correct it — Octo cannot invent an API it has
//    never seen.

import { JIRA_TOOLS } from './shared/jira.js';
import type {
  McpToolMeta,
  TicketSummary,
  SpecMeta,
  TicketAction,
  TicketCapability,
  TicketProviderConfig,
} from './shared/types.js';

// ---------- discovering which tool serves which capability ----------

/**
 * Name fragments that suggest a tool implements a capability. Ordered: an
 * earlier pattern wins, so `create_task` beats `add_task_to_mission` for
 * `create`.
 */
const CAPABILITY_HINTS: Record<TicketCapability, string[][]> = {
  create: [['create', 'task'], ['create', 'issue'], ['create', 'ticket'], ['create']],
  search: [['list', 'task'], ['search', 'issue'], ['list', 'issue'], ['search']],
  scopes: [['list', 'client'], ['list', 'project'], ['list', 'team'], ['list', 'workspace']],
  get: [['get', 'task'], ['get', 'issue'], ['get', 'ticket']],
  comment: [['comment']],
  transition: [['move', 'task'], ['transition'], ['update', 'status'], ['set', 'status']],
  'set-plan': [['set', 'plan'], ['update', 'plan']],
  'approve-plan': [['approve', 'plan']],
  'check-criteria': [['check', 'criteria'], ['criteria']],
  'link-branch': [['link', 'branch']],
  'link-pr': [['link', 'pull'], ['link', 'pr']],
};

/** Best-effort capability → tool mapping from what a server advertises. */
export function discoverToolMap(tools: McpToolMeta[]): Partial<Record<TicketCapability, string>> {
  const names = tools.map((t) => t.name);
  const out: Partial<Record<TicketCapability, string>> = {};
  for (const [cap, patterns] of Object.entries(CAPABILITY_HINTS) as [
    TicketCapability,
    string[][],
  ][]) {
    for (const parts of patterns) {
      const hit = names.find((n) => {
        const low = n.toLowerCase();
        return parts.every((p) => low.includes(p));
      });
      if (hit) {
        out[cap] = hit;
        break;
      }
    }
  }
  return out;
}

// ---------- the events a spec can raise ----------

export type TicketEvent =
  | { kind: 'spec-created' }
  | { kind: 'plan-approved'; plan: string; criteria: string[] }
  | { kind: 'phase-advanced'; phase: string }
  | { kind: 'branch-created'; branch: string }
  | { kind: 'pr-opened'; url: string; number?: number }
  | { kind: 'spec-done'; summary?: string };

/** A stable id per event, so the same advance never fires twice. */
export function eventId(ev: TicketEvent): string {
  switch (ev.kind) {
    case 'phase-advanced':
      return `phase-advanced:${ev.phase}`;
    case 'branch-created':
      return `branch-created:${ev.branch}`;
    case 'pr-opened':
      return `pr-opened:${ev.url}`;
    default:
      return ev.kind;
  }
}

// ---------- adapters ----------

/**
 * Which tool serves a capability. A mapping the user set always wins; Jira falls
 * back to its pinned names so a provider works before anyone presses *Connect*,
 * which is the difference between "not configured yet" and "silently does
 * nothing".
 */
function tool(cfg: TicketProviderConfig, cap: TicketCapability): string | null {
  return cfg.tools?.[cap] ?? (cfg.preset === 'jira' ? (JIRA_TOOLS[cap] ?? null) : null);
}

/**
 * The tracker's own model, which lines up with SDD almost exactly: a task
 * carries a markdown plan plus numbered validation criteria, approving that
 * plan is what unblocks implementation, and branches and PRs link to the task.
 */
function trackerActions(
  cfg: TicketProviderConfig,
  meta: SpecMeta,
  ev: TicketEvent
): TicketAction[] {
  const key = meta.ticket?.key;
  const client = cfg.defaults?.client;

  switch (ev.kind) {
    case 'spec-created': {
      const t = tool(cfg, 'create');
      if (!t || !client) return [];
      return [
        {
          capability: 'create',
          tool: t,
          args: {
            client,
            title: meta.name,
            ...(meta.brief ? { description: meta.brief } : {}),
          },
          summary: `Create a task "${meta.name}" for ${client}`,
        },
      ];
    }
    case 'plan-approved': {
      if (!key) return [];
      const out: TicketAction[] = [];
      const setPlan = tool(cfg, 'set-plan');
      if (setPlan)
        out.push({
          capability: 'set-plan',
          tool: setPlan,
          args: { task: key, plan: ev.plan, ...(ev.criteria.length ? { criteria: ev.criteria } : {}) },
          summary: `Write the plan and ${ev.criteria.length} criteria onto ${key}`,
        });
      const approve = tool(cfg, 'approve-plan');
      if (approve)
        out.push({
          capability: 'approve-plan',
          tool: approve,
          args: { task: key, note: 'Approved in Octo.' },
          summary: `Approve the plan on ${key}`,
        });
      return out;
    }
    case 'branch-created': {
      const t = tool(cfg, 'link-branch');
      if (!t || !key) return [];
      return [
        {
          capability: 'link-branch',
          tool: t,
          args: { task: key, branch: ev.branch },
          summary: `Link branch ${ev.branch} to ${key}`,
        },
      ];
    }
    case 'pr-opened': {
      const t = tool(cfg, 'link-pr');
      if (!t || !key) return [];
      return [
        {
          capability: 'link-pr',
          tool: t,
          args: { task: key, pull_request: ev.url },
          summary: `Link the pull request to ${key} and move it to review`,
        },
      ];
    }
    case 'phase-advanced': {
      // The tracker derives review state from the linked PR, so an intermediate
      // phase is a note, not a status change — moving it here would fight it.
      const t = tool(cfg, 'comment') ?? tool(cfg, 'transition');
      if (!t || !key || !tool(cfg, 'comment')) return [];
      return [
        {
          capability: 'comment',
          tool: t,
          args: { task: key, body: `Octo: ${ev.phase} approved.` },
          summary: `Note on ${key}: ${ev.phase} approved`,
        },
      ];
    }
    case 'spec-done': {
      const t = tool(cfg, 'transition');
      if (!t || !key) return [];
      return [
        {
          capability: 'transition',
          tool: t,
          args: { task: key, status: 'in_review', note: ev.summary ?? 'All tasks complete (Octo).' },
          summary: `Move ${key} to in_review`,
        },
      ];
    }
  }
}

/**
 * Anything Octo has not been taught. It uses the discovered tool names and the
 * argument names most trackers agree on; the confirmation step is what makes
 * this safe, because the user sees the exact call before it goes out.
 */
function genericActions(
  cfg: TicketProviderConfig,
  meta: SpecMeta,
  ev: TicketEvent
): TicketAction[] {
  const key = meta.ticket?.key;
  switch (ev.kind) {
    case 'spec-created': {
      const t = tool(cfg, 'create');
      if (!t) return [];
      return [
        {
          capability: 'create',
          tool: t,
          args: { ...(cfg.defaults ?? {}), title: meta.name, summary: meta.name, description: meta.brief ?? '' },
          summary: `Create an issue "${meta.name}"`,
        },
      ];
    }
    case 'plan-approved':
    case 'phase-advanced':
    case 'spec-done': {
      const t = tool(cfg, 'comment');
      if (!t || !key) return [];
      const body =
        ev.kind === 'plan-approved'
          ? `Octo: plan approved.\n\n${ev.plan}`
          : ev.kind === 'spec-done'
            ? `Octo: all tasks complete.${ev.summary ? `\n\n${ev.summary}` : ''}`
            : `Octo: ${ev.phase} approved.`;
      return [
        {
          capability: 'comment',
          tool: t,
          args: { ...(cfg.defaults ?? {}), issue: key, key, body },
          summary: `Comment on ${key}`,
        },
      ];
    }
    case 'branch-created':
    case 'pr-opened': {
      const t = tool(cfg, ev.kind === 'pr-opened' ? 'link-pr' : 'link-branch') ?? tool(cfg, 'comment');
      if (!t || !key) return [];
      const what = ev.kind === 'pr-opened' ? `pull request ${ev.url}` : `branch ${ev.branch}`;
      return [
        {
          capability: ev.kind === 'pr-opened' ? 'link-pr' : 'link-branch',
          tool: t,
          args: { ...(cfg.defaults ?? {}), issue: key, key, body: `Octo linked ${what}.` },
          summary: `Record ${what} on ${key}`,
        },
      ];
    }
  }
}

/**
 * Jira, through the Atlassian Rovo MCP server.
 *
 * Two things shape this adapter. **Everything is Markdown** — the server
 * converts to and from Atlassian Document Format at its own boundary, so
 * comment bodies are plain strings with `contentFormat: 'markdown'`. And
 * **nothing writes the description**: `editJiraIssue` silently drops the media
 * nodes Markdown cannot represent, which would destroy attachments on an issue
 * someone else filed. The approved plan goes in as a comment instead.
 */
function jiraActions(
  cfg: TicketProviderConfig,
  meta: SpecMeta,
  ev: TicketEvent,
  hints?: TicketHints
): TicketAction[] {
  const key = meta.ticket?.key;
  const cloudId = cfg.defaults?.cloudId;
  if (!cloudId) return [];

  const comment = (body: string, summary: string): TicketAction[] => {
    const t = tool(cfg, 'comment');
    if (!t || !key) return [];
    return [
      {
        capability: 'comment',
        tool: t,
        args: { cloudId, issueIdOrKey: key, commentBody: body, contentFormat: 'markdown' },
        summary,
      },
    ];
  };

  switch (ev.kind) {
    case 'spec-created': {
      const t = tool(cfg, 'create');
      const projectKey = cfg.defaults?.projectKey;
      if (!t || !projectKey) return [];
      return [
        {
          capability: 'create',
          tool: t,
          args: {
            cloudId,
            projectKey,
            issueTypeName: cfg.defaults?.issueType ?? (meta.kind === 'bugfix' ? 'Bug' : 'Task'),
            summary: meta.name,
            ...(meta.brief ? { description: meta.brief } : {}),
          },
          summary: `Create a ${meta.kind === 'bugfix' ? 'Bug' : 'Task'} "${meta.name}" in ${projectKey}`,
        },
      ];
    }
    case 'plan-approved':
      return comment(
        `**Plan approved in Octo.**\n\n${ev.plan}` +
          (ev.criteria.length
            ? `\n\n**Acceptance criteria**\n${ev.criteria.map((c) => `- ${c}`).join('\n')}`
            : ''),
        `Post the plan and ${ev.criteria.length} criteria to ${key} as a comment`
      );
    case 'phase-advanced':
      return comment(`Octo: **${ev.phase}** approved.`, `Note on ${key}: ${ev.phase} approved`);
    case 'branch-created':
      return comment(`Octo linked branch \`${ev.branch}\`.`, `Record branch ${ev.branch} on ${key}`);
    case 'pr-opened':
      return comment(`Octo opened a pull request: ${ev.url}`, `Record the pull request on ${key}`);
    case 'spec-done': {
      const t = tool(cfg, 'transition');
      if (!t || !key) return [];
      // Jira transitions are addressed by id, and the ids differ per project
      // workflow. `planTicketSync` resolves them before this runs, so the
      // confirmation panel shows the id that will actually be sent.
      const wanted = cfg.defaults?.doneStatus ?? 'In Review';
      const match = (hints?.transitions ?? []).find(
        (tr) => tr.name.toLowerCase() === wanted.toLowerCase()
      );
      if (!match) return [];
      return [
        {
          capability: 'transition',
          tool: t,
          args: { cloudId, issueIdOrKey: key, transition: { id: match.id } },
          summary: `Move ${key} to "${match.name}"`,
        },
      ];
    }
  }
}

/**
 * What this provider would do about this event — possibly nothing, when the
 * server has no tool for it or the spec has no ticket yet.
 */
/**
 * Data an adapter needs but cannot fetch: resolved by the orchestrator, which
 * already owns the connection, so the adapters stay pure and stub-testable and
 * the confirmation panel keeps showing exactly what will be sent.
 */
export interface TicketHints {
  transitions?: { id: string; name: string }[];
}

export function planTicketActions(
  cfg: TicketProviderConfig,
  meta: SpecMeta,
  ev: TicketEvent,
  hints?: TicketHints
): TicketAction[] {
  if (!cfg.enabled) return [];
  // A spec that already carries a ticket must never propose creating another —
  // re-running creation is the one mistake here that leaves litter in a board
  // shared with the team, and it cannot be undone from Octo.
  if (ev.kind === 'spec-created' && meta.ticket?.key) return [];
  // Everything else needs a ticket to act on; only creation makes one.
  if (ev.kind !== 'spec-created' && !meta.ticket?.key) return [];
  // An exhaustive switch, not a ternary: widening the preset union without
  // handling the new case has to be a type error. A silent fall-through to
  // `genericActions` would post `{issue, key, body}` at `createJiraIssue` and
  // come back as a schema rejection with no clue why.
  switch (cfg.preset) {
    case 'tracker':
      return trackerActions(cfg, meta, ev);
    case 'jira':
      return jiraActions(cfg, meta, ev, hints);
    case 'generic':
      return genericActions(cfg, meta, ev);
  }
}

/**
 * Whether this event has already been applied to this spec's ticket. The sync
 * engine records `eventId` after a successful call, so re-approving a phase or
 * reopening a spec does not comment twice.
 */
export function alreadyApplied(meta: SpecMeta, ev: TicketEvent): boolean {
  return (meta.ticket?.applied ?? []).includes(eventId(ev));
}

/**
 * Pull a ticket key and URL out of whatever a create call answered with.
 * Structured content is checked first because it is the contract; the text is a
 * fallback for servers that only answer in prose.
 */
export function parseTicketRef(
  structured: unknown,
  text: string
): { key: string | null; url: string | null } {
  const s = (structured ?? {}) as Record<string, unknown>;
  const nested = (s.task ?? s.issue ?? s.data ?? {}) as Record<string, unknown>;
  const pick = (...names: string[]) => {
    for (const n of names) {
      for (const src of [s, nested]) {
        const v = src[n];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    }
    return null;
  };
  const key = pick('key', 'identifier', 'id', 'task', 'issueKey');
  const url = pick('url', 'link', 'html_url', 'permalink');
  if (key) return { key, url };

  // e.g. "Created OCTO-42: …" — an uppercase project prefix and a number.
  const m = text.match(/\b([A-Z][A-Z0-9]{1,9}-\d{1,6})\b/);
  return { key: m ? m[1] : null, url: url ?? (text.match(/https?:\/\/\S+/)?.[0] ?? null) };
}

// ---------- listing what is open ----------

/** Statuses that mean "no longer worth starting a spec from". */
const DONE_STATUS = /^(done|closed|complete|completed|resolved|shipped|cancell?ed|archived|wont.?fix|duplicate)$/i;

export function isDoneStatus(status: string | undefined): boolean {
  return Boolean(status && DONE_STATUS.test(status.trim().replace(/[\s_-]+/g, '')));
}

function firstArray(value: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object' || depth > 2) return null;
  for (const key of ['tasks', 'issues', 'items', 'results', 'data', 'records', 'values']) {
    const v = (value as Record<string, unknown>)[key];
    const found = firstArray(v, depth + 1);
    if (found) return found;
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    const found = firstArray(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function str(row: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const n of names) {
    const v = row[n];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
    // `status: { name: 'In progress' }` is common enough to be worth unwrapping.
    if (v && typeof v === 'object') {
      const inner = (v as Record<string, unknown>).name ?? (v as Record<string, unknown>).value;
      if (typeof inner === 'string' && inner.trim()) return inner.trim();
    }
  }
  return undefined;
}

/**
 * Read a ticket list out of whatever a search tool answered with.
 *
 * Deliberately forgiving: Octo cannot know the response shape of a tracker it
 * has never seen, so it looks for the first array anywhere in the structured
 * content and then for the field names trackers agree on. When there is no
 * structured content at all it falls back to scanning the prose for
 * `KEY-123 — title` lines, which is what a text-only server tends to produce.
 */
export function normalizeTicketList(
  structured: unknown,
  text: string,
  provider: { id: string; label: string }
): TicketSummary[] {
  const rows = firstArray(structured);
  if (rows?.length) {
    return rows
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map((r): TicketSummary | null => {
        const key = str(r, 'key', 'identifier', 'id', 'task', 'issueKey', 'number');
        const title = str(r, 'title', 'summary', 'name', 'subject') ?? '';
        return key
          ? {
              key,
              title,
              status: str(r, 'status', 'state', 'workflowState'),
              url: str(r, 'url', 'link', 'html_url', 'permalink'),
              description: str(r, 'description', 'body', 'details'),
              provider: provider.id,
              providerLabel: provider.label,
            }
          : null;
      })
      .filter((t): t is TicketSummary => Boolean(t));
  }

  const out: TicketSummary[] = [];
  const seen = new Set<string>();
  for (const line of text.split('\n')) {
    const m = line.match(/\b([A-Z][A-Z0-9]{1,9}-\d{1,6})\b\s*[—:|-]?\s*(.*)$/);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({
      key: m[1],
      title: m[2].trim().slice(0, 160),
      provider: provider.id,
      providerLabel: provider.label,
    });
  }
  return out;
}

/**
 * The clients / projects a ticket can belong to. Discovering these is what
 * keeps the user from having to go and look up an identifier in another app and
 * type it in exactly — the failure that produced an unexplained empty list.
 */
export function normalizeScopes(structured: unknown, text: string): { key: string; label: string }[] {
  const rows = firstArray(structured);
  if (rows?.length) {
    return rows
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map((r) => {
        const key = str(r, 'key', 'slug', 'identifier', 'id', 'code');
        const label = str(r, 'name', 'label', 'title', 'display_name') ?? key ?? '';
        return key ? { key, label } : null;
      })
      .filter((x): x is { key: string; label: string } => Boolean(x));
  }
  // `- aps — Aparte SRL`, or `- https://acme.atlassian.net: Acme`.
  //
  // The separator has to be surrounded by space, or followed by it. An earlier
  // version accepted a bare colon and so split `https://…` at its scheme,
  // yielding the key `https` and a label starting `//`.
  const out: { key: string; label: string }[] = [];
  for (const line of text.split('\n')) {
    const m =
      line.match(/^\s*[-*]?\s*(\S+)\s+[—–|-]\s+(.+)$/) ??
      line.match(/^\s*[-*]?\s*(\S+?):\s+(.+)$/);
    if (m) out.push({ key: m[1], label: m[2].trim().slice(0, 80) });
  }
  return out;
}

/**
 * The transitions a Jira issue can take right now, as `{id, name}`.
 *
 * Tolerant in the same way `normalizeTicketList` is, and for the same reason —
 * the response shape of a server nobody here has authenticated against is a
 * guess until it is observed.
 */
export function normalizeTransitions(
  structured: unknown,
  text: string
): { id: string; name: string }[] {
  const rows = firstArray(structured);
  if (rows?.length) {
    return rows
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map((r) => {
        const id = str(r, 'id', 'transitionId');
        const name = str(r, 'name', 'label') ?? str(r, 'to') ?? id ?? '';
        return id ? { id, name } : null;
      })
      .filter((x): x is { id: string; name: string } => Boolean(x));
  }
  // `21 — In Review` / `21: In Review`
  const out: { id: string; name: string }[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*[-*]?\s*(\d{1,6})\s*[—:|-]\s*(.+)$/);
    if (m) out.push({ id: m[1], name: m[2].trim() });
  }
  return out;
}

/** The arguments a search call gets, which is the one place presets differ much. */
export function searchArgs(cfg: TicketProviderConfig, limit: number): Record<string, unknown> {
  if (cfg.preset === 'jira') {
    // `statusCategory != Done` is the only status filter that holds across
    // projects — every workflow names its statuses differently, but they all
    // roll up to the same three categories.
    const project = cfg.defaults?.projectKey;
    const jql = [
      project ? `project = "${project}"` : '',
      'statusCategory != Done',
      'ORDER BY updated DESC',
    ]
      .filter(Boolean)
      .join(' AND ')
      .replace(' AND ORDER BY', ' ORDER BY');
    return { cloudId: cfg.defaults?.cloudId, jql, maxResults: limit };
  }
  if (cfg.preset === 'tracker') {
    // Only the client and a cap. An earlier version also sent `mission: "active"`,
    // which is incoherent without a client — the server cannot resolve *whose*
    // active mission — and narrowed the list to one mission even when it could.
    // Everything not-done is what this list is for; `isDoneStatus` filters it.
    return { ...(cfg.defaults?.client ? { client: cfg.defaults.client } : {}), limit };
  }
  return { ...(cfg.defaults ?? {}), limit };
}

/**
 * How this tracker addresses one ticket. The tracker calls the argument `task`;
 * most others call it `issue` or `key`, and sending all three is harmless —
 * servers ignore what they do not declare.
 */
export function ticketRefArgs(cfg: TicketProviderConfig, key: string): Record<string, unknown> {
  if (cfg.preset === 'jira') return { cloudId: cfg.defaults?.cloudId, issueIdOrKey: key };
  return cfg.preset === 'tracker' ? { task: key } : { issue: key, key, id: key };
}

/**
 * Fold a ticket's detail into the text a spec starts from.
 *
 * Preference order matters: a tracker that answers with structured fields gives
 * a cleaner brief than its own prose rendering, but prose is better than
 * nothing, and some servers only speak prose.
 */
/** Drop a leading line that just repeats the key and title we already printed. */
function stripRepeatedHead(text: string, key: string): string {
  const [first, ...rest] = text.split('\n');
  return first.includes(key) && rest.length ? rest.join('\n').trim() : text;
}

export function ticketBrief(
  ticket: { key: string; title: string; description?: string },
  detail?: { text?: string; structured?: unknown } | null
): string {
  const head = `${ticket.key}: ${ticket.title}`.trim();
  const s = (detail?.structured ?? {}) as Record<string, unknown>;
  const nested = (s.task ?? s.issue ?? s.data ?? {}) as Record<string, unknown>;
  const pick = (...names: string[]) => {
    for (const n of names) {
      for (const src of [nested, s]) {
        const v = src[n];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    }
    return null;
  };

  const parts = [head];
  const body = pick('description', 'body', 'details', 'summary_text', 'content');
  const plan = pick('plan');
  const criteria = (() => {
    for (const src of [nested, s]) {
      const v = src.criteria;
      if (Array.isArray(v) && v.length) {
        return v
          .map((c) =>
            typeof c === 'string'
              ? c
              : ((c as Record<string, unknown>)?.text ?? (c as Record<string, unknown>)?.title ?? '')
          )
          .filter((t) => typeof t === 'string' && t.trim())
          .map((t) => `- ${t}`)
          .join('\n');
      }
    }
    return null;
  })();

  // Richest first. The row's `description` is the *listing's* summary — it is
  // the last resort, not a peer of what the ticket itself says, and an earlier
  // version let it win over the server's own prose rendering.
  const prose = detail?.text?.trim();
  if (body) parts.push(body);
  else if (prose) parts.push(stripRepeatedHead(prose, ticket.key));
  else if (ticket.description?.trim()) parts.push(ticket.description.trim());

  if (plan) parts.push(`## From the ticket's plan\n\n${plan}`);
  if (criteria) parts.push(`## Validation criteria on the ticket\n\n${criteria}`);

  return parts.join('\n\n');
}

/** What a ticket contributes to a spec's documents. */
export interface TicketSeed {
  /** The full text, kept on `SpecMeta.brief` so drafting stays grounded in it. */
  brief: string;
  /** requirements.md or bugfix.md, pre-filled from the ticket. */
  requirements: string;
  /** plan.md, only when the ticket already carries a plan. */
  plan: string | null;
}

/**
 * Turn a ticket into the documents a spec starts from.
 *
 * The ticket's text is **copied in**, not summarised: whoever wrote it wrote
 * the requirement, and retyping it through a model would only lose detail.
 * What Octo adds is the shape its own parsers read — the headings, and `AC-n`
 * ids on the criteria the ticket already lists.
 *
 * Those criteria are almost never in EARS form, and they are deliberately left
 * as they were rather than reworded here. The format check flags them, and
 * *Fix with Claude* rewrites them — which is honest about where the sentence
 * came from, and keeps a machine from quietly changing what someone asked for.
 */
export function ticketSeed(
  ticket: { key: string; title: string; description?: string; url?: string },
  detail: { text?: string; structured?: unknown } | null,
  kind: 'feature' | 'bugfix'
): TicketSeed {
  const brief = ticketBrief(ticket, detail);
  const s = (detail?.structured ?? {}) as Record<string, unknown>;
  const nested = (s.task ?? s.issue ?? s.data ?? {}) as Record<string, unknown>;
  const pick = (...names: string[]) => {
    for (const n of names) {
      for (const src of [nested, s]) {
        const v = src[n];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    }
    return null;
  };
  const criteria = criteriaOf(nested, s);
  const body =
    pick('description', 'body', 'details', 'content') ??
    ticket.description?.trim() ??
    detail?.text?.trim() ??
    '';

  const origin = `> From [${ticket.key}](${ticket.url ?? '#'}) — copied from the ticket. Draft or edit to make it Octo's shape.`;

  const doc: string[] = [`# ${kind === 'feature' ? 'Requirements' : 'Bugfix Analysis'} — ${ticket.title || ticket.key}`, '', origin, ''];

  if (kind === 'feature') {
    doc.push('## Introduction', '', body || '_The ticket carried no description._', '');
    if (criteria.length) {
      doc.push('## Acceptance Criteria (EARS notation)', '');
      criteria.forEach((c, i) => doc.push(`- AC-${i + 1}: ${c}`));
      doc.push('');
    }
  } else {
    doc.push('## Reproduction', '', body || '_The ticket carried no description._', '');
    if (criteria.length) {
      doc.push('## Expected Behavior', '');
      criteria.forEach((c, i) => doc.push(`- AC-${i + 1}: ${c}`));
      doc.push('');
    }
  }

  const planBody = pick('plan');
  const plan = planBody
    ? [`# Plan — ${ticket.title || ticket.key}`, '', origin, '', planBody, ''].join('\n')
    : null;

  return { brief, requirements: doc.join('\n'), plan };
}

/** The ticket's own validation criteria, as plain strings. */
function criteriaOf(...sources: Record<string, unknown>[]): string[] {
  for (const src of sources) {
    const v = src.criteria ?? src.acceptanceCriteria ?? src.acceptance_criteria;
    if (Array.isArray(v) && v.length) {
      return v
        .map((c) =>
          typeof c === 'string'
            ? c
            : String(
                (c as Record<string, unknown>)?.text ??
                  (c as Record<string, unknown>)?.title ??
                  (c as Record<string, unknown>)?.description ??
                  ''
              )
        )
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return [];
}

/**
 * Whether the provider is missing something it cannot work without, as a
 * sentence. Checked before a call so the user gets "set the client" instead of
 * the tracker's own complaint about an argument they never saw.
 */
export function missingConfig(cfg: TicketProviderConfig): string | null {
  if (!cfg.tools?.search && cfg.preset !== 'jira')
    return 'No search tool is mapped — press “Connect & read tools”.';
  if (cfg.preset === 'tracker' && !cfg.defaults?.client) {
    return 'No client is selected. The tracker scopes tasks per client, so it cannot list anything without one.';
  }
  if (cfg.preset === 'jira' && !cfg.defaults?.cloudId) {
    return 'No Atlassian site is selected. `cloudId` is a required argument on almost every Jira tool.';
  }
  return null;
}
