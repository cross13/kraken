// Types shared between main and renderer.

export type SpecKind = 'feature' | 'bugfix';
export type SpecPhase = 'requirements' | 'design' | 'tasks' | 'done';

export interface SpecMeta {
  id: string;
  name: string;
  kind: SpecKind;
  phase: SpecPhase;
  path: string;
  createdAt: string;
  updatedAt: string;
  // Optional git workflow state — set when the user creates a branch or commits.
  branch?: string;
  committedAt?: string;
  lastCommitHash?: string;
  lastCommitPushed?: boolean;
  // GitHub pull-request state — set when a PR is opened for this spec's branch.
  prNumber?: number;
  prUrl?: string;
  prState?: 'open' | 'closed' | 'merged';
}

export interface SpecFiles {
  requirements?: string;
  bugfix?: string;
  design?: string;
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

export interface McpServerMeta {
  name: string;
  type: 'stdio' | 'http';
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
