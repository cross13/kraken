// Types shared between main and renderer.

export type SpecKind = 'feature' | 'bugfix';
/**
 * Phases of the Definir · Plan · Construir loop. `plan` and `build` were called
 * `design` and `tasks` before the methodology refactor; specs written by older
 * versions are normalized on read (`normalizePhase` / `migrateSpecDir` in
 * main.ts) and in the DB mirror (`migrateSpecPhases` in db.ts).
 */
export type SpecPhase = 'requirements' | 'plan' | 'build' | 'done';

export interface SpecMeta {
  id: string;
  name: string;
  kind: SpecKind;
  phase: SpecPhase;
  path: string;
  createdAt: string;
  updatedAt: string;
  /**
   * The user's original one-liner from the Home composer. Kept because creating
   * a spec no longer drafts anything: the brief has to survive until the user
   * presses "Draft … with Claude" at the gate bar.
   */
  brief?: string;
  // Optional git workflow state — set when the user creates a branch or commits.
  branch?: string;
  committedAt?: string;
  lastCommitHash?: string;
  lastCommitPushed?: boolean;
  // GitHub pull-request state — set when a PR is opened for this spec's branch.
  prNumber?: number;
  prUrl?: string;
  prState?: 'open' | 'closed' | 'merged';
  /** The tracker ticket this spec is linked to, if any. */
  ticket?: SpecTicketLink;
}

/** What a spec knows about its ticket. The tracker stays the source of truth. */
export interface SpecTicketLink {
  /** `TicketProviderConfig.id` — which tracker this key belongs to. */
  provider: string;
  /** The tracker's own identifier, e.g. `APS-14`. */
  key: string;
  url?: string;
  title?: string;
  /** Last status Octo saw. Refreshed on read, never authoritative. */
  status?: string;
  linkedAt?: string;
  /** Sync events already applied, so an advance never fires twice. */
  applied?: string[];
}

// ---------- Ticket providers (electron/tickets.ts) ----------

/** The operations Octo needs from a tracker, whatever it calls them. */
export type TicketCapability =
  | 'create'
  | 'search'
  /** List the client / project / team a ticket has to belong to. */
  | 'scopes'
  | 'get'
  | 'comment'
  | 'transition'
  | 'set-plan'
  | 'approve-plan'
  | 'check-criteria'
  | 'link-branch'
  | 'link-pr';

/**
 * A tracker Octo can write to: an MCP server plus the mapping from Octo's
 * capabilities onto that server's tool names. `preset` picks the adapter that
 * knows how to shape each tool's arguments.
 */
export interface TicketProviderConfig {
  id: string;
  label: string;
  /** `McpServerMeta.name` — which discovered server to talk to. */
  server: string;
  /**
   * Overrides the discovered server's URL for this provider only.
   *
   * Exists because the URL in a user's MCP config is frequently the vendor's
   * older published one — Atlassian still documents `/v1/sse`, the legacy
   * transport, whose POST endpoint is a different path carrying a session id in
   * the query string. Octo speaks Streamable HTTP, so pointing at `/sse` fails
   * with a complaint about a missing session that says nothing about the cause.
   * Fixing that in Octo's own config beats asking someone to edit a file that
   * another tool owns.
   */
  url?: string;
  preset: 'tracker' | 'generic' | 'jira';
  enabled: boolean;
  /** Provider-wide defaults, e.g. the tracker's `client` key. */
  defaults?: Record<string, string>;
  /** capability → tool name. Discovered on connect, overridable. */
  tools?: Partial<Record<TicketCapability, string>>;
}

/**
 * A ticket as Octo lists it.
 *
 * `key` and `title` are the contract; everything after them is what a given
 * tracker happened to volunteer. They are all optional because no two trackers
 * return the same set, and a card that renders only what it actually got is the
 * only honest way to show a list drawn from several at once.
 */
export interface TicketSummary {
  key: string;
  title: string;
  /**
   * The status as the tracker's API names it (`in_progress`, `In Review`).
   * This — not `statusLabel` — is what `isDoneStatus` reads, so a tracker that
   * localises its labels still gets filtered correctly.
   */
  status?: string;
  /** The status as the tracker's *own UI* writes it, when that differs. */
  statusLabel?: string;
  /** `Urgente` / `High` / `P1` — verbatim; the card colours it by rank. */
  priority?: string;
  /** Bug · Task · Story — the ticket's own type name. */
  type?: string;
  /** Whoever it is on, as a display name. */
  assignee?: string;
  /** The mission / sprint / epic it hangs off, as the tracker names it. */
  group?: string;
  /** Labels, plus anything else worth a chip (the tracker's plan state). */
  labels?: string[];
  /** ISO 8601 last-touched, when the tracker reports one — the card's age. */
  updated?: string;
  url?: string;
  /** Longer text, used to seed a spec's brief. */
  description?: string;
  /** Which provider it came from. */
  provider: string;
  providerLabel: string;
}

/** One acceptance / validation criterion the ticket already carries. */
export interface TicketCriterion {
  text: string;
  /** The tracker's own word for its state (`pending`, `verified`). */
  state?: string;
  /** What that state is called in its UI (`Sin verificar`). */
  stateLabel?: string;
}

/**
 * A ticket read in full, for **reading it before deciding to work on it**.
 *
 * The listing row answers "which ticket is this"; this answers "is this the
 * work I think it is, and is it ready to start". Everything past `ticket` is
 * absent when the tracker has no such thing — a Jira issue has comments and no
 * plan, a tracker task has a plan, its criteria and its history and no comments.
 */
export interface TicketDetail {
  /** The row, re-read from the detail response wherever it says more. */
  ticket: TicketSummary;
  /** The ticket's description, as markdown. */
  body: string;
  /** A plan the ticket already carries — the document, never a state word. */
  plan?: string;
  /** Whether that plan has been signed off, when the tracker models it. */
  planApproved?: boolean;
  planApprovedBy?: string;
  criteria: TicketCriterion[];
  comments: { author?: string; when?: string; body: string }[];
  /** What has happened on the ticket, newest first. */
  history: { when?: string; actor?: string; what: string }[];
  /** Who filed it, when `assignee` is not the whole story. */
  reporter?: string;
  created?: string;
  /** Minutes, when the tracker bills time. */
  estimateMinutes?: number;
  loggedMinutes?: number;
  /**
   * The server's own prose answer, kept whatever else was parsed. It is the
   * fallback view for a tracker whose shape nothing here recognised — an empty
   * panel would otherwise be indistinguishable from an empty ticket.
   */
  raw: string;
}

/** One tool call Octo intends to make, shown for confirmation before it is sent. */
export interface TicketAction {
  capability: TicketCapability;
  tool: string;
  args: Record<string, unknown>;
  /** One line describing the effect, for the confirmation prompt. */
  summary: string;
}

export interface SpecFiles {
  requirements?: string;
  bugfix?: string;
  plan?: string;
  tasks?: string;
}

export interface SkillMeta {
  name: string;
  description: string;
  scope: 'workspace' | 'global';
  path: string;
  /** the skill's markdown instructions (SKILL.md body), for prompt injection */
  body?: string;
}

export interface AgentMeta {
  name: string;
  description: string;
  model?: string;
  tools?: string[];
  scope: 'workspace' | 'global';
  path: string;
  body: string;
}

export interface WorkspaceState {
  rootPath: string | null;
  specs: SpecMeta[];
  skills: SkillMeta[];
  agents: AgentMeta[];
}

/**
 * Which kind of content a stream delta carries, so the UI can render it
 * distinctly (prose vs. extended thinking vs. a tool/command call vs. its result).
 */
export type StreamChannel = 'text' | 'thinking' | 'tool' | 'tool_result';

/** A contiguous run of same-channel content within an assistant message. */
export interface MessageSegment {
  kind: StreamChannel;
  text: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  /** full concatenated text (history, persistence, fallback rendering) */
  content: string;
  /** structured, channel-tagged segments for rich rendering of assistant output */
  segments?: MessageSegment[];
  createdAt: number;
  streaming?: boolean;
  agent?: string;
}

export interface ClaudeRequest {
  messages: { role: 'user' | 'assistant'; content: string }[];
  system?: string;
  model?: string;
  maxTokens?: number;
  requestId: string;
}

export interface ClaudeStreamEvent {
  requestId: string;
  type: 'delta' | 'done' | 'error';
  text?: string;
  error?: string;
  /** for delta events: which content channel this text belongs to (default 'text') */
  channel?: StreamChannel;
}

export interface DirEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: DirEntry[];
}

// DB rows surfaced to the renderer

/** How the run's model was determined — surfaced in the audit/verification panel. */
export type ModelSource =
  | 'explicit'
  | 'settings-default'
  | 'cli-default'
  | 'api-default';

export interface RunRow {
  id: string;
  workspace_path: string | null;
  spec_id: string | null;
  backend: 'cli' | 'api';
  model: string | null;
  agent: string | null;
  source: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  prompt: string | null;
  system: string | null;
  response: string | null;
  error: string | null;
  duration_ms: number | null;
  started_at: string;
  ended_at: string | null;
  // ----- routing + audit (all nullable; back-compatible) -----
  /** governing skill name(s) injected into the run (comma-separated) */
  skill: string | null;
  /** where the chosen skill is installed: 'workspace' | 'global' */
  skill_scope: string | null;
  /** why the agent was chosen (RouteReason) */
  route_reason: string | null;
  /** where the chosen agent is installed: 'workspace' | 'global' */
  agent_scope: string | null;
  /** orchestration classification (RunKind) */
  kind: string | null;
  /** task id this run executes, e.g. T1 */
  task_id: string | null;
  /** wave label, e.g. "Wave 1" */
  wave: string | null;
  /** JSON array of task ids this run's task depends on */
  depends_on: string | null;
  /** exact invocation: JSON argv (CLI, prompt redacted) or "api:messages.stream" */
  command: string | null;
  /** JSON array of allowed tool names */
  tools: string | null;
  /** CLI permission mode used */
  permission_mode: string | null;
  /** how `model` was resolved */
  model_source: string | null;
  /** model the backend actually reported using */
  resolved_model: string | null;
}

export interface ErrorRow {
  id: number;
  run_id: string | null;
  workspace_path: string | null;
  category: string;
  message: string;
  details: string | null;
  created_at: string;
}

/** A file a run created or edited (captured from Write/Edit/MultiEdit tool calls). */
export interface RunFileRow {
  id: number;
  run_id: string;
  workspace_path: string | null;
  path: string;
  /** the tool that touched it, e.g. Write, Edit, MultiEdit, NotebookEdit */
  tool: string | null;
  /** 'write' (create/overwrite) | 'edit' (modify) */
  op: string | null;
  /** how many times the run touched this file with this tool */
  count: number;
  first_at: string;
  last_at: string;
}

/** Aggregate file-touch count per run, for graph node badges. */
export interface RunFileCount {
  run_id: string;
  files: number;
}

/** One file changed across a spec's runs, aggregated for the completion summary. */
export interface SpecFileChange {
  path: string;
  /** comma-joined ops, e.g. "write,edit" */
  ops: string | null;
  /** comma-joined tools, e.g. "Write,Edit" */
  tools: string | null;
  /** total touches across all runs */
  count: number;
  /** comma-joined task ids that touched this file (nulls excluded) */
  task_ids: string | null;
  /** most recent touch timestamp */
  last_at: string;
}

export interface SpecEventRow {
  id: number;
  workspace_path: string;
  spec_id: string;
  event_type: string;
  from_phase: string | null;
  to_phase: string | null;
  file: string | null;
  metadata: string | null;
  created_at: string;
}

/** Per-spec run aggregate for the Spec Manager analytics (one row per spec_id). */
export interface SpecRunStat {
  spec_id: string;
  runs: number;
  errors: number;
  cancelled: number;
  total_duration_ms: number;
  last_run_at: string | null;
}

// ---------- Hooks (event-driven agent hooks) ----------

export type HookTrigger =
  | 'spec-advance'
  | 'spec-done'
  | 'task-complete'
  | 'wave-complete'
  | 'file-save-in-app'
  | 'manual';

export type HookActionType = 'ask-claude' | 'run-command';

export interface HookConfig {
  id: string;
  title: string;
  description?: string;
  trigger: HookTrigger;
  enabled: boolean;
  /** glob applied to touched file paths (file-save-in-app) or spec files */
  fileGlob?: string;
  /** restrict to feature/bugfix specs */
  specKind?: SpecKind;
  actionType: HookActionType;
  /** ask-claude: which agent to route (by name); null = generic */
  agent?: string | null;
  /** ask-claude: the prompt body */
  instructions?: string;
  /** run-command: the shell command */
  command?: string;
  /** autopilot waits for this hook's run to finish before continuing */
  blocking?: boolean;
  scope: 'workspace' | 'global';
  /** absolute path to the hook's JSON file */
  path: string;
}

/** Context passed when a trigger fires; used to build the hook run. */
export interface HookFireContext {
  root: string;
  specId?: string | null;
  specKind?: SpecKind;
  /** file paths that changed / are relevant (for fileGlob + steering fileMatch) */
  fileHints?: string[];
  /** task ID for task-complete / wave-complete */
  taskId?: string | null;
  /** human label, e.g. "Wave 1" */
  label?: string;
}

/** main → renderer notification that a hook started / finished a run. */
export interface HookFireEvent {
  hookId: string;
  requestId: string;
  trigger: HookTrigger;
  type: 'started' | 'done' | 'error';
  specId?: string | null;
  error?: string;
}

export interface HookRunRow {
  id: number;
  workspace_path: string | null;
  hook_id: string;
  trigger: string;
  run_id: string | null;
  spec_id: string | null;
  status: string;
  created_at: string;
}

// ---------- Data reset (Settings › Danger zone) ----------

/** Row counts in the history DB, per table. */
export interface HistoryCounts {
  specs: number;
  specEvents: number;
  runs: number;
  runFiles: number;
  errors: number;
  hookRuns: number;
}

/** What a reset would remove, so the UI can say it before asking. */
export interface DataUsage {
  /** spec folders under `.octo/specs` */
  specsOnDisk: number;
  /** spec folders left behind in a pre-rename `.kraken/specs` */
  legacySpecsOnDisk: number;
  /** history rows belonging to this workspace */
  workspace: HistoryCounts;
  /** history rows across every workspace */
  all: HistoryCounts;
}

export interface DataResetOptions {
  /** delete every spec folder on disk (this workspace, incl. legacy `.kraken`) */
  specs: boolean;
  /** delete history rows */
  history: boolean;
  /** `workspace` = this project's rows; `all` = the whole DB */
  historyScope: 'workspace' | 'all';
}

export interface DataResetReport {
  specsDeleted: number;
  legacySpecsDeleted: number;
  /** null when history was left alone */
  history: HistoryCounts | null;
}

// ---------- Seeding the bundled library ----------

/**
 * What one `*:create-default` run did, per file (keys are relative, e.g.
 * `agents/spec-planner.md`). Seeding rewrites a default the user never edited
 * so a shipped improvement reaches existing workspaces; a file that carries
 * edits is reported as `kept` and left exactly as it is.
 */
// ---------- What a branch contains (electron/git.ts → `git:branch-summary`) ----------

export interface BranchCommit {
  hash: string;
  /** first line of the message */
  subject: string;
  author: string;
  /** ISO-8601, author date */
  date: string;
}

export interface BranchFile {
  path: string;
  /** `A` added, `M` modified, `D` deleted, `R` renamed… — first char of git's status */
  status: string;
  added: number;
  deleted: number;
  /** true for a binary file, where git reports `-` instead of counts */
  binary: boolean;
}

export interface BranchSummary {
  ok: boolean;
  /** the branch being described (HEAD) */
  branch: string | null;
  /** what it is being compared against */
  base: string | null;
  /** true when base was guessed rather than read from the remote's HEAD */
  baseGuessed: boolean;
  commits: BranchCommit[];
  files: BranchFile[];
  added: number;
  deleted: number;
  /** committed changes exist, but the working tree also has uncommitted ones */
  dirty: boolean;
  error?: string;
}

export interface SeedReport {
  created: string[];
  upgraded: string[];
  kept: string[];
}

// ---------- Steering files ----------

export type SteeringInclusion = 'always' | 'fileMatch' | 'manual' | 'auto';

export interface SteeringFile {
  name: string;
  description?: string;
  inclusion: SteeringInclusion;
  /** glob for fileMatch inclusion mode */
  fileMatch?: string;
  scope: 'workspace' | 'global';
  path: string;
  body: string;
  /**
   * Whether this doc can be edited/deleted from the Steering Studio. Implicit
   * root files (CLAUDE.md / AGENTS.md) are surfaced read-only (`false`);
   * `.octo/steering/*.md` docs are editable (`true`).
   */
  editable?: boolean;
}

/** Payload for creating/updating a steering doc from the Steering Studio. */
export interface SteeringWriteInput {
  name: string;
  description?: string;
  inclusion: SteeringInclusion;
  /** glob for fileMatch inclusion mode */
  fileMatch?: string;
  body: string;
  scope: 'workspace' | 'global';
  /** Prior on-disk path when editing; deleted if the resolved path changes. */
  prevPath?: string;
}

// ---------- Multi-agent orchestration ----------

export type RunPhaseStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

/** What kind of work a run represents — drives grouping/labelling in the UI. */
export type RunKind = 'task' | 'refine' | 'polish' | 'chat' | 'spec' | 'audit' | 'hook';

export interface ActiveRun {
  requestId: string;
  taskId?: string;
  agent: string | null;
  /** skill governing this run (e.g. sdd-feature), if any */
  skill?: string | null;
  source: string;
  specId?: string | null;
  status: RunPhaseStatus;
  /** classification for the orchestrator dashboard */
  kind?: RunKind;
  /** human-readable one-liner of what this run is doing */
  title?: string;
  /** wave label for task runs, e.g. "Wave 1" */
  wave?: string;
  /** epoch ms when the run was registered (renderer clock) */
  startedAt?: number;
  // ----- routing/audit, for the live agent graph + verification -----
  /** model requested for this run */
  model?: string | null;
  /** why the agent was chosen (RouteReason) */
  routeReason?: string | null;
  /** where the chosen agent is installed */
  agentScope?: 'workspace' | 'global' | null;
  /** where the chosen skill is installed */
  skillScope?: 'workspace' | 'global' | null;
  /** task ids this run's task depends on (for graph edges) */
  dependsOn?: string[];
}

/** A finished run kept in the orchestrator's recent-activity log. */
export interface FinishedRun {
  requestId: string;
  kind?: RunKind;
  agent: string | null;
  skill?: string | null;
  source: string;
  title?: string;
  specId?: string | null;
  taskId?: string;
  wave?: string;
  status: 'done' | 'error' | 'cancelled';
  startedAt?: number;
  endedAt: number;
  // ----- routing/audit, carried through from ActiveRun -----
  model?: string | null;
  routeReason?: string | null;
  agentScope?: 'workspace' | 'global' | null;
  skillScope?: 'workspace' | 'global' | null;
  dependsOn?: string[];
}

// ---------- MCP ----------

/** One tool a server advertises through `tools/list`. */
export interface McpToolMeta {
  name: string;
  description: string;
  /** JSON Schema for the arguments; shown in the mapping UI, not validated here. */
  inputSchema: { type?: string; properties?: Record<string, unknown>; required?: string[] } | null;
}

/** What a `tools/call` came back with, flattened to text. */
export interface McpCallResult {
  ok: boolean;
  text: string;
  structured: unknown;
}

export interface McpServerMeta {
  name: string;
  /**
   * `sse` is the legacy HTTP+SSE transport. Octo speaks Streamable HTTP to it
   * anyway — most servers that declare `sse` also answer on the modern
   * transport, and several have simply not updated their published config — but
   * the declaration is kept rather than collapsed into `http` so the UI can say
   * "this endpoint is the deprecated one" instead of surfacing a bare 404.
   */
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  url?: string;
  scope: 'workspace' | 'global';
}

// ---------- GitHub integration ----------

/** owner/repo resolved from the workspace's `origin` remote. */
export interface GitHubRepoInfo {
  /** true when origin points at a github.com repo we could parse */
  ok: boolean;
  owner?: string;
  repo?: string;
  /** the raw remote URL, for display */
  remoteUrl?: string;
  /** current local branch */
  branch?: string | null;
  defaultBranch?: string;
  error?: string;
}

/** Result of validating the stored GitHub token against the API. */
export interface GitHubTokenStatus {
  hasToken: boolean;
  valid?: boolean;
  login?: string;
  /** scopes reported by the token, if available */
  scopes?: string[];
  error?: string;
}

/** A pull request as surfaced to the renderer (subset of the GitHub payload). */
export interface PullRequestMeta {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
  url: string;
  head: string;
  base: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubOpResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

// ---------- Terminal (PTY) ----------

// Which program the PTY launches. `shell` is the user's login shell; `claude`
// runs the interactive Claude CLI directly so AskUserQuestion, slash commands,
// and permission prompts all work natively.
export type TerminalProfile = 'shell' | 'claude';

export interface TerminalCreateOpts {
  termId: string;
  cwd?: string | null;
  cols: number;
  rows: number;
  profile?: TerminalProfile;
}

export interface TerminalCreateResult {
  ok: boolean;
  pid?: number;
  file?: string;
  error?: string;
}

export interface TerminalDataEvent {
  termId: string;
  data: string;
}

export interface TerminalExitEvent {
  termId: string;
  exitCode: number;
  signal?: number;
}

// ---------- Travel Display (the wide second window) ----------

/**
 * The serialized run snapshot the main window pushes to the travel window. The
 * travel monitor is a read-only mirror of the main window's orchestrator
 * registry, so `runs` is `ActiveRun[]` verbatim; `maxConcurrency` rides along
 * because the wide window shows a task-slot meter and cannot otherwise know the
 * ceiling (the control lives in the main window's store).
 */
export interface FleetSnapshot {
  runs: ActiveRun[];
  /** the orchestrator's wave concurrency cap, for the slot meter */
  maxConcurrency: number;
}

/** Open/closed state of the travel window, broadcast to the main window. */
export interface WideState {
  open: boolean;
}

// ---------- Model discovery ----------

/**
 * Where a model entry came from. Octo never invents availability — each entry
 * says how it was learned:
 *  - `api`      the Anthropic Models API answered for the stored key. Authoritative.
 *  - `cli-config` the id is named in a local Claude Code settings file / env var,
 *                 so the installed CLI is configured to use it.
 *  - `catalog`  Octo's bundled list. A known-good id, availability unverified.
 */
export type ModelOrigin = 'api' | 'cli-config' | 'catalog';

export interface ModelInfo {
  /** exact id passed to `--model` / the API `model` field */
  id: string;
  /** human label — `display_name` from the API when available */
  label: string;
  source: ModelOrigin;
  /** context window in tokens (`max_input_tokens`), when known */
  contextWindow?: number;
  /** max output tokens, when known */
  maxOutput?: number;
  /** input / output USD per 1M tokens, for catalog entries */
  price?: string;
  /** short tier hint for catalog entries ("Balanced", "Fastest", …) */
  tier?: string;
  /** for `cli-config`: which file or env var named this model */
  configuredIn?: string;
}

export interface ModelDiscovery {
  models: ModelInfo[];
  /** how the authoritative list was obtained, for the UI to explain itself */
  apiChecked: boolean;
  apiError?: string;
  /** detected local Claude Code CLI, if any */
  cli: { found: boolean; binary?: string; version?: string };
  /** ISO timestamp of this discovery run */
  checkedAt: string;
}
