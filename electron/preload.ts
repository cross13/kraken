import { contextBridge, ipcRenderer } from 'electron';
import type {
  AgentMeta,
  DirEntry,
  ErrorRow,
  RunRow,
  RunFileRow,
  RunFileCount,
  SpecFileChange,
  SkillMeta,
  SpecEventRow,
  SpecKind,
  SpecMeta,
  SpecPhase,
  SteeringFile,
  HookConfig,
  HookRunRow,
  HookFireEvent,
  McpServerMeta,
  GitHubRepoInfo,
  GitHubTokenStatus,
  PullRequestMeta,
  GitHubOpResult,
} from './shared/types';

type StreamHandler = (event: {
  requestId: string;
  type: 'delta' | 'done' | 'error';
  text?: string;
  error?: string;
  channel?: 'text' | 'thinking' | 'tool' | 'tool_result';
}) => void;

const api = {
  workspace: {
    pick: () => ipcRenderer.invoke('workspace:pick') as Promise<string | null>,
    getLast: () => ipcRenderer.invoke('workspace:get-last') as Promise<string | null>,
    getRecents: () => ipcRenderer.invoke('workspace:get-recents') as Promise<string[]>,
    open: (p: string) => ipcRenderer.invoke('workspace:open', p) as Promise<string>,
    listTree: (p: string) => ipcRenderer.invoke('workspace:list-tree', p) as Promise<DirEntry[]>,
  },
  specs: {
    list: (root: string) => ipcRenderer.invoke('specs:list', root) as Promise<SpecMeta[]>,
    create: (root: string, name: string, kind: SpecKind) =>
      ipcRenderer.invoke('specs:create', root, name, kind) as Promise<SpecMeta>,
    read: (root: string, id: string) =>
      ipcRenderer.invoke('specs:read', root, id) as Promise<{
        meta: SpecMeta;
        files: Record<string, string>;
      }>,
    writeFile: (root: string, id: string, file: string, content: string) =>
      ipcRenderer.invoke('specs:write-file', root, id, file, content) as Promise<SpecMeta>,
    advance: (root: string, id: string) =>
      ipcRenderer.invoke('specs:advance', root, id) as Promise<SpecMeta>,
    setPhase: (root: string, id: string, phase: SpecPhase) =>
      ipcRenderer.invoke('specs:set-phase', root, id, phase) as Promise<SpecMeta>,
  },
  skills: {
    list: (root: string) => ipcRenderer.invoke('skills:list', root) as Promise<SkillMeta[]>,
    read: (p: string) => ipcRenderer.invoke('skills:read', p) as Promise<string>,
    seedDefaults: (root: string) =>
      ipcRenderer.invoke('skills:create-default', root) as Promise<void>,
  },
  agents: {
    list: (root: string) => ipcRenderer.invoke('agents:list', root) as Promise<AgentMeta[]>,
    read: (p: string) => ipcRenderer.invoke('agents:read', p) as Promise<string>,
    seedDefaults: (root: string) =>
      ipcRenderer.invoke('agents:create-default', root) as Promise<void>,
  },
  steering: {
    list: (root: string) =>
      ipcRenderer.invoke('steering:list', root) as Promise<SteeringFile[]>,
    seedDefaults: (root: string) =>
      ipcRenderer.invoke('steering:create-default', root) as Promise<void>,
  },
  hooks: {
    list: (root: string) => ipcRenderer.invoke('hooks:list', root) as Promise<HookConfig[]>,
    read: (p: string) => ipcRenderer.invoke('hooks:read', p) as Promise<string>,
    write: (root: string, hook: HookConfig) =>
      ipcRenderer.invoke('hooks:write', root, hook) as Promise<HookConfig>,
    delete: (root: string, id: string) =>
      ipcRenderer.invoke('hooks:delete', root, id) as Promise<void>,
    toggle: (root: string, id: string, enabled: boolean) =>
      ipcRenderer.invoke('hooks:toggle', root, id, enabled) as Promise<void>,
    fire: (
      trigger: HookConfig['trigger'],
      ctx: {
        root: string;
        specId?: string | null;
        specKind?: SpecKind;
        fileHints?: string[];
        taskId?: string | null;
        label?: string;
      }
    ) => ipcRenderer.invoke('hooks:fire', trigger, ctx) as Promise<void>,
    fireOne: (
      root: string,
      id: string,
      ctx: { root?: string; specId?: string | null; fileHints?: string[] }
    ) => ipcRenderer.invoke('hooks:fire-one', root, id, ctx) as Promise<void>,
    seedDefaults: (root: string) =>
      ipcRenderer.invoke('hooks:create-default', root) as Promise<void>,
    generateFromNl: (root: string, description: string) =>
      ipcRenderer.invoke('hooks:generate-from-nl', root, description) as Promise<void>,
    listRuns: (opts: { workspacePath?: string | null; limit?: number }) =>
      ipcRenderer.invoke('hooks:list-runs', opts) as Promise<HookRunRow[]>,
    onEvent: (handler: (ev: HookFireEvent) => void) => {
      const listener = (_: unknown, ev: HookFireEvent) => handler(ev);
      ipcRenderer.on('hook:event', listener);
      return () => ipcRenderer.removeListener('hook:event', listener);
    },
  },
  fs: {
    read: (p: string) => ipcRenderer.invoke('fs:read', p) as Promise<string>,
    write: (p: string, content: string) =>
      ipcRenderer.invoke('fs:write', p, content) as Promise<void>,
  },
  mcp: {
    list: (root?: string | null) =>
      ipcRenderer.invoke('mcp:list', root) as Promise<McpServerMeta[]>,
  },
  settings: {
    getModel: () => ipcRenderer.invoke('settings:get-model') as Promise<string>,
    setModel: (m: string) => ipcRenderer.invoke('settings:set-model', m) as Promise<void>,
    hasApiKey: () => ipcRenderer.invoke('settings:has-api-key') as Promise<boolean>,
    setApiKey: (k: string) => ipcRenderer.invoke('settings:set-api-key', k) as Promise<void>,
    clearApiKey: () => ipcRenderer.invoke('settings:clear-api-key') as Promise<void>,
    getBackend: () =>
      ipcRenderer.invoke('settings:get-backend') as Promise<'cli' | 'api'>,
    setBackend: (b: 'cli' | 'api') =>
      ipcRenderer.invoke('settings:set-backend', b) as Promise<void>,
    getMaxConcurrency: () =>
      ipcRenderer.invoke('settings:get-max-concurrency') as Promise<number>,
    setMaxConcurrency: (n: number) =>
      ipcRenderer.invoke('settings:set-max-concurrency', n) as Promise<void>,
    getPermissions: () =>
      ipcRenderer.invoke('settings:get-permissions') as Promise<{
        allowedTools: string[];
        permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions';
        allowBash: boolean;
      }>,
    setPermissions: (perms: {
      allowedTools?: string[];
      permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
      allowBash?: boolean;
    }) => ipcRenderer.invoke('settings:set-permissions', perms) as Promise<void>,
  },
  cli: {
    detect: () =>
      ipcRenderer.invoke('cli:detect') as Promise<{
        found: boolean;
        binary?: string;
        version?: string;
        error?: string;
      }>,
  },
  git: {
    status: (cwd: string) =>
      ipcRenderer.invoke('git:status', cwd) as Promise<{
        isRepo: boolean;
        branch: string | null;
        hasChanges: boolean;
        staged: number;
        unstaged: number;
        untracked: number;
        ahead: number;
        behind: number;
        upstream: string | null;
        hasOrigin: boolean;
      }>,
    listChanges: (cwd: string) =>
      ipcRenderer.invoke('git:list-changes', cwd) as Promise<{
        ok: boolean;
        files: {
          path: string;
          status: string;
          staged: boolean;
          unstaged: boolean;
          untracked: boolean;
        }[];
        error?: string;
      }>,
    stage: (args: { workspacePath: string; paths: string[] }) =>
      ipcRenderer.invoke('git:stage', args) as Promise<{ ok: boolean; error?: string; output: string }>,
    unstage: (args: { workspacePath: string; paths: string[] }) =>
      ipcRenderer.invoke('git:unstage', args) as Promise<{ ok: boolean; error?: string; output: string }>,
    stageAll: (cwd: string) =>
      ipcRenderer.invoke('git:stage-all', cwd) as Promise<{ ok: boolean; error?: string; output: string }>,
    unstageAll: (cwd: string) =>
      ipcRenderer.invoke('git:unstage-all', cwd) as Promise<{ ok: boolean; error?: string; output: string }>,
    fetch: (cwd: string) =>
      ipcRenderer.invoke('git:fetch', cwd) as Promise<{
        ok: boolean;
        error?: string;
        output: string;
      }>,
    pull: (cwd: string) =>
      ipcRenderer.invoke('git:pull', cwd) as Promise<{
        ok: boolean;
        error?: string;
        output: string;
        branch?: string;
      }>,
    push: (cwd: string) =>
      ipcRenderer.invoke('git:push', cwd) as Promise<{
        ok: boolean;
        error?: string;
        output: string;
        pushed?: boolean;
        branch?: string;
      }>,
    listBranches: (cwd: string) =>
      ipcRenderer.invoke('git:list-branches', cwd) as Promise<{
        ok: boolean;
        branches: { name: string; current: boolean; upstream?: string }[];
        current: string | null;
        error?: string;
      }>,
    checkout: (args: { workspacePath: string; specId?: string; branch: string }) =>
      ipcRenderer.invoke('git:checkout', args) as Promise<{
        ok: boolean;
        error?: string;
        output: string;
        branch?: string;
      }>,
    createBranch: (args: { workspacePath: string; specId?: string; branch: string }) =>
      ipcRenderer.invoke('git:create-branch', args) as Promise<{
        ok: boolean;
        error?: string;
        output: string;
        branch?: string;
        existed?: boolean;
      }>,
    commitPush: (args: {
      workspacePath: string;
      specId?: string;
      message: string;
      push?: boolean;
      stageAll?: boolean;
    }) =>
      ipcRenderer.invoke('git:commit-push', args) as Promise<{
        ok: boolean;
        error?: string;
        output: string;
        commitHash?: string;
        pushed?: boolean;
        nothingToCommit?: boolean;
      }>,
  },
  github: {
    hasToken: () => ipcRenderer.invoke('github:has-token') as Promise<boolean>,
    setToken: (token: string) =>
      ipcRenderer.invoke('github:set-token', token) as Promise<void>,
    clearToken: () => ipcRenderer.invoke('github:clear-token') as Promise<void>,
    tokenStatus: () =>
      ipcRenderer.invoke('github:token-status') as Promise<GitHubTokenStatus>,
    repoInfo: (cwd: string) =>
      ipcRenderer.invoke('github:repo-info', cwd) as Promise<GitHubRepoInfo>,
    listBranches: (cwd: string) =>
      ipcRenderer.invoke('github:list-branches', cwd) as Promise<
        GitHubOpResult<string[]>
      >,
    listPrs: (args: { cwd: string; state?: 'open' | 'closed' | 'all'; head?: string }) =>
      ipcRenderer.invoke('github:list-prs', args) as Promise<
        GitHubOpResult<PullRequestMeta[]>
      >,
    createPr: (args: {
      cwd: string;
      specId?: string;
      title: string;
      body?: string;
      base?: string;
      head?: string;
      draft?: boolean;
      push?: boolean;
    }) =>
      ipcRenderer.invoke('github:create-pr', args) as Promise<
        GitHubOpResult<PullRequestMeta>
      >,
    mergePr: (args: {
      cwd: string;
      specId?: string;
      number: number;
      method?: 'merge' | 'squash' | 'rebase';
    }) =>
      ipcRenderer.invoke('github:merge-pr', args) as Promise<
        GitHubOpResult<{ merged: boolean; message: string }>
      >,
  },
  history: {
    listRuns: (opts: { workspacePath?: string | null; specId?: string | null; limit?: number }) =>
      ipcRenderer.invoke('history:list-runs', opts) as Promise<RunRow[]>,
    getRun: (id: string) =>
      ipcRenderer.invoke('history:get-run', id) as Promise<RunRow | null>,
    listRunFiles: (runId: string) =>
      ipcRenderer.invoke('history:list-run-files', runId) as Promise<RunFileRow[]>,
    runFileCounts: (opts: { workspacePath?: string | null; specId?: string | null }) =>
      ipcRenderer.invoke('history:run-file-counts', opts) as Promise<RunFileCount[]>,
    listSpecFiles: (opts: { workspacePath?: string | null; specId: string }) =>
      ipcRenderer.invoke('history:list-spec-files', opts) as Promise<SpecFileChange[]>,
    listErrors: (opts: { workspacePath?: string | null; limit?: number }) =>
      ipcRenderer.invoke('history:list-errors', opts) as Promise<ErrorRow[]>,
    stats: (workspacePath?: string | null) =>
      ipcRenderer.invoke('history:stats', workspacePath) as Promise<{
        total: number;
        errors: number;
        cancelled: number;
        avgDurationMs: number | null;
      }>,
    listSpecEvents: (workspacePath: string, specId: string) =>
      ipcRenderer.invoke(
        'history:list-spec-events',
        workspacePath,
        specId
      ) as Promise<SpecEventRow[]>,
  },
  claude: {
    stream: (payload: {
      requestId: string;
      messages: { role: 'user' | 'assistant'; content: string }[];
      system?: string;
      model?: string;
      maxTokens?: number;
      cwd?: string | null;
      source?: string;
      specId?: string | null;
      agent?: string | null;
      fileHints?: string[];
      manualRefs?: string[];
      // routing/audit metadata for the agent graph
      skill?: string | null;
      skillScope?: string | null;
      routeReason?: string | null;
      agentScope?: string | null;
      kind?: string | null;
      taskId?: string | null;
      wave?: string | null;
      dependsOn?: string[];
    }) => ipcRenderer.send('claude:stream', payload),
    cancel: (requestId: string) =>
      ipcRenderer.invoke('claude:cancel', requestId) as Promise<void>,
    onEvent: (handler: StreamHandler) => {
      const listener = (_: unknown, ev: Parameters<StreamHandler>[0]) => handler(ev);
      ipcRenderer.on('claude:event', listener);
      return () => ipcRenderer.removeListener('claude:event', listener);
    },
  },
};

contextBridge.exposeInMainWorld('kraken', api);

export type KrakenApi = typeof api;
