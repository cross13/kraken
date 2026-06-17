import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import Store from 'electron-store';
import matter from 'gray-matter';
import {
  gitStatus,
  gitCreateBranch,
  gitCommitPush,
  gitPushCurrent,
  gitListBranches,
  gitCheckoutBranch,
  gitPull,
  gitFetch,
  gitListChanges,
  gitStage,
  gitUnstage,
  gitStageAll,
  gitUnstageAll,
} from './git.js';
import {
  resolveRepo,
  ghValidateToken,
  ghDefaultBranch,
  ghListPullRequests,
  ghCreatePullRequest,
  ghMergePullRequest,
  ghListBranches,
} from './github.js';
import {
  initDb,
  upsertSpec,
  deleteSpec,
  recordSpecEvent,
  listSpecEvents,
  beginRun,
  updateRunCommand,
  updateRunResolvedModel,
  recordRunFile,
  listRunFiles,
  runFileCounts,
  listSpecFiles,
  appendRunResponse,
  finishRun,
  listRuns,
  getRun,
  recordError,
  listErrors,
  getStats,
  recordHookRun,
  listHookRuns,
} from './db.js';
import type {
  AgentMeta,
  DirEntry,
  SkillMeta,
  SpecMeta,
  SpecKind,
  SpecPhase,
  SteeringFile,
  SteeringInclusion,
  HookConfig,
  HookTrigger,
  HookFireContext,
  HookFireEvent,
  McpServerMeta,
  StreamChannel,
} from './shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Name the app early so userData (DB, settings) lives in a Kraken-named folder
// rather than the default "Electron" directory.
app.setName('Kraken');
app.setPath('userData', path.join(app.getPath('appData'), 'Kraken'));

type Backend = 'cli' | 'api';
type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions';

const DEFAULT_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];
const BASH_TOOL = 'Bash';

interface StoreSchema {
  apiKeyEncrypted?: string;
  githubTokenEncrypted?: string;
  lastWorkspace?: string;
  model?: string;
  recentWorkspaces?: string[];
  backend?: Backend;
  allowedTools?: string[];
  permissionMode?: PermissionMode;
  allowBash?: boolean;
  maxConcurrency?: number;
}

const store = new Store<StoreSchema>({
  defaults: {
    model: 'claude-opus-4-7',
    recentWorkspaces: [],
    backend: 'cli',
    allowedTools: DEFAULT_TOOLS,
    permissionMode: 'acceptEdits',
    allowBash: false,
    maxConcurrency: 2,
  },
});

function getEffectiveTools(): string[] {
  const tools = store.get('allowedTools') ?? DEFAULT_TOOLS;
  const allowBash = store.get('allowBash') ?? false;
  if (allowBash && !tools.includes(BASH_TOOL)) return [...tools, BASH_TOOL];
  if (!allowBash) return tools.filter((t) => t !== BASH_TOOL);
  return tools;
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0c0e16',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  initDb();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC ----------

function registerIpc() {
  ipcMain.handle('workspace:pick', pickWorkspace);
  ipcMain.handle('workspace:get-last', () => store.get('lastWorkspace') ?? null);
  ipcMain.handle('workspace:get-recents', () => store.get('recentWorkspaces') ?? []);
  ipcMain.handle('workspace:open', (_e, rootPath: string) => openWorkspace(rootPath));
  ipcMain.handle('workspace:list-tree', (_e, root: string) => listTree(root));

  ipcMain.handle('specs:list', (_e, root: string) => listSpecs(root));
  ipcMain.handle('specs:create', (_e, root: string, name: string, kind: SpecKind) =>
    createSpec(root, name, kind)
  );
  ipcMain.handle('specs:read', (_e, root: string, id: string) => readSpec(root, id));
  ipcMain.handle(
    'specs:write-file',
    (_e, root: string, id: string, file: string, content: string) =>
      writeSpecFile(root, id, file, content)
  );
  ipcMain.handle('specs:advance', (_e, root: string, id: string) => advanceSpec(root, id));
  ipcMain.handle('specs:set-phase', (_e, root: string, id: string, phase: SpecPhase) =>
    setSpecPhase(root, id, phase)
  );

  ipcMain.handle('skills:list', (_e, root: string) => listSkills(root));
  ipcMain.handle('skills:read', (_e, p: string) => fs.readFile(p, 'utf8'));
  ipcMain.handle('skills:create-default', (_e, root: string) => seedDefaultSkills(root));

  ipcMain.handle('agents:list', (_e, root: string) => listAgents(root));
  ipcMain.handle('agents:read', (_e, p: string) => fs.readFile(p, 'utf8'));
  ipcMain.handle('agents:create-default', (_e, root: string) => seedDefaultAgents(root));

  ipcMain.handle('steering:list', (_e, root: string) => listSteering(root));
  ipcMain.handle('steering:create-default', (_e, root: string) => seedDefaultSteering(root));

  ipcMain.handle('hooks:list', (_e, root: string) => listHooks(root));
  ipcMain.handle('hooks:read', (_e, p: string) => fs.readFile(p, 'utf8'));
  ipcMain.handle('hooks:write', (_e, root: string, hook: HookConfig) => writeHook(root, hook));
  ipcMain.handle('hooks:delete', (_e, root: string, id: string) => deleteHook(root, id));
  ipcMain.handle('hooks:toggle', (_e, root: string, id: string, enabled: boolean) =>
    toggleHook(root, id, enabled)
  );
  ipcMain.handle('hooks:fire', (_e, trigger: HookTrigger, ctx: HookFireContext) =>
    maybeFireHooks(trigger, ctx)
  );
  ipcMain.handle('hooks:fire-one', async (_e, root: string, id: string, ctx: HookFireContext) => {
    const hooks = await listHooks(root);
    const hook = hooks.find((h) => h.id === id);
    if (hook) await fireHook(hook, hook.trigger, { ...ctx, root });
  });
  ipcMain.handle('hooks:create-default', (_e, root: string) => seedDefaultHooks(root));
  ipcMain.handle('hooks:generate-from-nl', (_e, root: string, description: string) =>
    generateHookFromNl(root, description)
  );
  ipcMain.handle('hooks:list-runs', (_e, opts) => listHookRuns(opts ?? {}));

  ipcMain.handle('mcp:list', (_e, root?: string | null) => listMcpServers(root));

  ipcMain.handle('fs:read', (_e, p: string) => fs.readFile(p, 'utf8'));
  ipcMain.handle('fs:write', (_e, p: string, content: string) => writeFile(p, content));

  ipcMain.handle('settings:get-model', () => store.get('model'));
  ipcMain.handle('settings:set-model', (_e, model: string) => store.set('model', model));

  ipcMain.handle('settings:has-api-key', () => !!store.get('apiKeyEncrypted'));
  ipcMain.handle('settings:set-api-key', (_e, key: string) => setApiKey(key));
  ipcMain.handle('settings:clear-api-key', () => store.delete('apiKeyEncrypted'));

  ipcMain.handle('settings:get-backend', () => store.get('backend') ?? 'cli');
  ipcMain.handle('settings:set-backend', (_e, b: Backend) => store.set('backend', b));

  ipcMain.handle('settings:get-max-concurrency', () => store.get('maxConcurrency') ?? 2);
  ipcMain.handle('settings:set-max-concurrency', (_e, n: number) =>
    store.set('maxConcurrency', Math.max(1, Math.min(8, Math.floor(n))))
  );

  ipcMain.handle('settings:get-permissions', () => ({
    allowedTools: store.get('allowedTools') ?? DEFAULT_TOOLS,
    permissionMode: store.get('permissionMode') ?? 'acceptEdits',
    allowBash: store.get('allowBash') ?? false,
  }));
  ipcMain.handle(
    'settings:set-permissions',
    (
      _e,
      perms: { allowedTools?: string[]; permissionMode?: PermissionMode; allowBash?: boolean }
    ) => {
      if (perms.allowedTools) store.set('allowedTools', perms.allowedTools);
      if (perms.permissionMode) store.set('permissionMode', perms.permissionMode);
      if (perms.allowBash !== undefined) store.set('allowBash', perms.allowBash);
    }
  );

  ipcMain.handle('cli:detect', detectCli);

  ipcMain.handle('git:status', (_e, cwd: string) => gitStatus(cwd));
  ipcMain.handle('git:fetch', (_e, cwd: string) => gitFetch(cwd));
  ipcMain.handle('git:pull', (_e, cwd: string) => gitPull(cwd));
  ipcMain.handle('git:push', (_e, cwd: string) => gitPushCurrent(cwd));
  ipcMain.handle('git:list-changes', (_e, cwd: string) => gitListChanges(cwd));
  ipcMain.handle('git:stage', (_e, args: { workspacePath: string; paths: string[] }) =>
    gitStage(args.workspacePath, args.paths)
  );
  ipcMain.handle('git:unstage', (_e, args: { workspacePath: string; paths: string[] }) =>
    gitUnstage(args.workspacePath, args.paths)
  );
  ipcMain.handle('git:stage-all', (_e, cwd: string) => gitStageAll(cwd));
  ipcMain.handle('git:unstage-all', (_e, cwd: string) => gitUnstageAll(cwd));
  ipcMain.handle('git:list-branches', (_e, cwd: string) => gitListBranches(cwd));
  ipcMain.handle(
    'git:checkout',
    async (_e, args: { workspacePath: string; specId?: string; branch: string }) => {
      const res = gitCheckoutBranch(args.workspacePath, args.branch);
      if (res.ok && args.specId) {
        try {
          patchSpecMeta(args.workspacePath, args.specId, { branch: res.branch });
        } catch {
          // non-fatal
        }
      }
      return res;
    }
  );
  ipcMain.handle(
    'git:create-branch',
    async (_e, args: { workspacePath: string; specId?: string; branch: string }) => {
      const res = gitCreateBranch(args.workspacePath, args.branch);
      if (res.ok && args.specId) {
        try {
          patchSpecMeta(args.workspacePath, args.specId, { branch: res.branch });
        } catch {
          // non-fatal
        }
      }
      return res;
    }
  );
  ipcMain.handle(
    'git:commit-push',
    async (
      _e,
      args: {
        workspacePath: string;
        specId?: string;
        message: string;
        push?: boolean;
        stageAll?: boolean;
      }
    ) => {
      const res = gitCommitPush(args.workspacePath, args.message, {
        push: args.push,
        stageAll: args.stageAll,
      });
      if (res.ok && args.specId) {
        try {
          patchSpecMeta(args.workspacePath, args.specId, {
            committedAt: new Date().toISOString(),
            lastCommitHash: res.commitHash,
            lastCommitPushed: res.pushed,
          });
        } catch {
          // non-fatal
        }
      }
      return res;
    }
  );

  // ---------- GitHub ----------
  ipcMain.handle('github:has-token', () => !!store.get('githubTokenEncrypted'));
  ipcMain.handle('github:set-token', (_e, token: string) => setGithubToken(token));
  ipcMain.handle('github:clear-token', () => store.delete('githubTokenEncrypted'));
  ipcMain.handle('github:token-status', async () => {
    const token = getGithubToken();
    if (!token) return { hasToken: false };
    return ghValidateToken(token);
  });
  ipcMain.handle('github:repo-info', async (_e, cwd: string) => {
    const base = resolveRepo(cwd);
    if (!base.ok) return base;
    const token = getGithubToken();
    let defaultBranch: string | undefined;
    if (token && base.owner && base.repo) {
      defaultBranch = (await ghDefaultBranch(token, base.owner, base.repo)) ?? undefined;
    }
    return { ...base, defaultBranch };
  });
  ipcMain.handle('github:list-branches', async (_e, cwd: string) => {
    const token = getGithubToken();
    if (!token) return { ok: false, error: 'No GitHub token configured.' };
    const repo = resolveRepo(cwd);
    if (!repo.ok || !repo.owner || !repo.repo) {
      return { ok: false, error: repo.error ?? 'Could not resolve repository.' };
    }
    return ghListBranches(token, repo.owner, repo.repo);
  });
  ipcMain.handle(
    'github:list-prs',
    async (
      _e,
      args: { cwd: string; state?: 'open' | 'closed' | 'all'; head?: string }
    ) => {
      const token = getGithubToken();
      if (!token) return { ok: false, error: 'No GitHub token configured.' };
      const repo = resolveRepo(args.cwd);
      if (!repo.ok || !repo.owner || !repo.repo) {
        return { ok: false, error: repo.error ?? 'Could not resolve repository.' };
      }
      return ghListPullRequests(token, repo.owner, repo.repo, {
        state: args.state,
        head: args.head,
      });
    }
  );
  ipcMain.handle(
    'github:create-pr',
    async (
      _e,
      args: {
        cwd: string;
        specId?: string;
        title: string;
        body?: string;
        base?: string;
        head?: string;
        draft?: boolean;
        push?: boolean;
      }
    ) => {
      const token = getGithubToken();
      if (!token) return { ok: false, error: 'No GitHub token configured.' };
      const repo = resolveRepo(args.cwd);
      if (!repo.ok || !repo.owner || !repo.repo) {
        return { ok: false, error: repo.error ?? 'Could not resolve repository.' };
      }
      const head = args.head ?? repo.branch;
      if (!head) {
        return { ok: false, error: 'Not on a branch to open a PR from.' };
      }
      // Make sure the head branch exists on the remote first.
      if (args.push !== false) {
        const push = gitPushCurrent(args.cwd);
        if (!push.ok) {
          return { ok: false, error: `Push failed: ${push.error}` };
        }
      }
      let base = args.base;
      if (!base) {
        base = (await ghDefaultBranch(token, repo.owner, repo.repo)) ?? 'main';
      }
      const res = await ghCreatePullRequest(token, repo.owner, repo.repo, {
        title: args.title,
        head,
        base,
        body: args.body,
        draft: args.draft,
      });
      if (res.ok && res.data && args.specId) {
        try {
          patchSpecMeta(args.cwd, args.specId, {
            prNumber: res.data.number,
            prUrl: res.data.url,
            prState: res.data.merged ? 'merged' : res.data.state,
          });
        } catch {
          // non-fatal
        }
      }
      return res;
    }
  );
  ipcMain.handle(
    'github:merge-pr',
    async (
      _e,
      args: {
        cwd: string;
        specId?: string;
        number: number;
        method?: 'merge' | 'squash' | 'rebase';
      }
    ) => {
      const token = getGithubToken();
      if (!token) return { ok: false, error: 'No GitHub token configured.' };
      const repo = resolveRepo(args.cwd);
      if (!repo.ok || !repo.owner || !repo.repo) {
        return { ok: false, error: repo.error ?? 'Could not resolve repository.' };
      }
      const res = await ghMergePullRequest(
        token,
        repo.owner,
        repo.repo,
        args.number,
        args.method
      );
      if (res.ok && args.specId) {
        try {
          patchSpecMeta(args.cwd, args.specId, { prState: 'merged' });
        } catch {
          // non-fatal
        }
      }
      return res;
    }
  );

  ipcMain.on('claude:stream', (e, payload) => streamClaude(e.sender, payload));
  ipcMain.handle('claude:cancel', (_e, requestId: string) => cancelClaude(requestId));

  ipcMain.handle('history:list-runs', (_e, opts) => listRuns(opts ?? {}));
  ipcMain.handle('history:get-run', (_e, id: string) => getRun(id));
  ipcMain.handle('history:list-run-files', (_e, runId: string) => listRunFiles(runId));
  ipcMain.handle('history:run-file-counts', (_e, opts) => runFileCounts(opts ?? {}));
  ipcMain.handle('history:list-spec-files', (_e, opts) => listSpecFiles(opts));
  ipcMain.handle('history:list-errors', (_e, opts) => listErrors(opts ?? {}));
  ipcMain.handle('history:stats', (_e, workspacePath) => getStats(workspacePath));
  ipcMain.handle('history:list-spec-events', (_e, workspacePath, specId) =>
    listSpecEvents(workspacePath, specId)
  );
}

// ---------- Workspace ----------

async function pickWorkspace() {
  const res = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose a workspace',
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
}

async function openWorkspace(rootPath: string) {
  // Kraken-specific
  await ensureDir(path.join(rootPath, '.kraken', 'specs'));
  // Claude Code standard locations — also created so they show up in pickers
  await ensureDir(path.join(rootPath, '.claude', 'agents'));
  await ensureDir(path.join(rootPath, '.claude', 'skills'));

  store.set('lastWorkspace', rootPath);
  const recents = store.get('recentWorkspaces') ?? [];
  const next = [rootPath, ...recents.filter((p) => p !== rootPath)].slice(0, 8);
  store.set('recentWorkspaces', next);

  return rootPath;
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function writeFile(p: string, content: string) {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, content, 'utf8');
}

async function listTree(root: string): Promise<DirEntry[]> {
  if (!existsSync(root)) return [];
  return readDir(root, 0);
}

async function readDir(dir: string, depth: number): Promise<DirEntry[]> {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const out: DirEntry[] = [];
  for (const item of items) {
    if (item.name.startsWith('.') && item.name !== '.kraken' && item.name !== '.claude') continue;
    if (item.name === 'node_modules' || item.name === 'out') continue;
    const p = path.join(dir, item.name);
    if (item.isDirectory()) {
      out.push({
        name: item.name,
        path: p,
        type: 'dir',
        children: depth < 3 ? await readDir(p, depth + 1) : [],
      });
    } else {
      out.push({ name: item.name, path: p, type: 'file' });
    }
  }
  return out.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ---------- Specs ----------

async function listSpecs(root: string): Promise<SpecMeta[]> {
  const specsDir = path.join(root, '.kraken', 'specs');
  await ensureDir(specsDir);
  const items = await fs.readdir(specsDir, { withFileTypes: true });
  const out: SpecMeta[] = [];
  for (const item of items) {
    if (!item.isDirectory()) continue;
    const specPath = path.join(specsDir, item.name);
    const metaPath = path.join(specPath, 'spec.json');
    if (!existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8')) as SpecMeta;
      const enriched = { ...meta, path: specPath };
      out.push(enriched);
      // Keep DB in sync with disk on every list — cheap given the table is small.
      try {
        upsertSpec(root, enriched);
      } catch {
        // non-fatal
      }
    } catch {
      // skip corrupt
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

async function createSpec(root: string, name: string, kind: SpecKind): Promise<SpecMeta> {
  const slug = slugify(name) || `spec-${Date.now()}`;
  const specsDir = path.join(root, '.kraken', 'specs');
  await ensureDir(specsDir);

  let folder = slug;
  let n = 1;
  while (existsSync(path.join(specsDir, folder))) {
    folder = `${slug}-${++n}`;
  }
  const specPath = path.join(specsDir, folder);
  await ensureDir(specPath);

  const now = new Date().toISOString();
  const meta: SpecMeta = {
    id: folder,
    name,
    kind,
    phase: 'requirements',
    path: specPath,
    createdAt: now,
    updatedAt: now,
  };

  const initialFile = kind === 'feature' ? 'requirements.md' : 'bugfix.md';
  const template =
    kind === 'feature' ? featureRequirementsTemplate(name) : bugfixTemplate(name);

  await fs.writeFile(path.join(specPath, initialFile), template, 'utf8');
  await fs.writeFile(path.join(specPath, 'spec.json'), JSON.stringify(meta, null, 2), 'utf8');

  try {
    upsertSpec(root, meta);
    recordSpecEvent(root, meta.id, { type: 'created', to_phase: meta.phase });
  } catch (e) {
    recordError({
      workspacePath: root,
      category: 'other',
      message: 'db: failed to record spec creation',
      details: { error: String(e) },
    });
  }

  return meta;
}

function patchSpecMeta(root: string, id: string, patch: Partial<SpecMeta>): SpecMeta | null {
  const specPath = path.join(root, '.kraken', 'specs', id);
  const metaPath = path.join(specPath, 'spec.json');
  if (!existsSync(metaPath)) return null;
  const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as SpecMeta;
  const next: SpecMeta = {
    ...meta,
    ...patch,
    path: specPath,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(metaPath, JSON.stringify(next, null, 2), 'utf8');
  try {
    upsertSpec(root, next);
  } catch {
    // non-fatal
  }
  return next;
}

async function readSpec(root: string, id: string) {
  const specPath = path.join(root, '.kraken', 'specs', id);
  const meta = JSON.parse(await fs.readFile(path.join(specPath, 'spec.json'), 'utf8')) as SpecMeta;
  const files: Record<string, string> = {};
  for (const f of ['requirements.md', 'bugfix.md', 'design.md', 'tasks.md']) {
    const fp = path.join(specPath, f);
    if (existsSync(fp)) files[f.replace('.md', '')] = await fs.readFile(fp, 'utf8');
  }
  return { meta, files };
}

async function writeSpecFile(root: string, id: string, file: string, content: string) {
  const specPath = path.join(root, '.kraken', 'specs', id);
  const filePath = path.join(specPath, `${file}.md`);
  await fs.writeFile(filePath, content, 'utf8');
  const metaPath = path.join(specPath, 'spec.json');
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8')) as SpecMeta;
  meta.updatedAt = new Date().toISOString();
  meta.path = specPath;
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  try {
    upsertSpec(root, meta);
    recordSpecEvent(root, id, { type: 'edited', file });
  } catch {
    // non-fatal
  }
  void maybeFireHooks('file-save-in-app', {
    root,
    specId: id,
    specKind: meta.kind,
    fileHints: [filePath],
  });
  return meta;
}

async function advanceSpec(root: string, id: string) {
  const specPath = path.join(root, '.kraken', 'specs', id);
  const metaPath = path.join(specPath, 'spec.json');
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8')) as SpecMeta;
  const order: SpecPhase[] = ['requirements', 'design', 'tasks', 'done'];
  const idx = order.indexOf(meta.phase);
  const from = meta.phase;
  const next = order[Math.min(idx + 1, order.length - 1)];
  meta.phase = next;
  meta.updatedAt = new Date().toISOString();
  meta.path = specPath;

  if (next === 'design' && !existsSync(path.join(specPath, 'design.md'))) {
    await fs.writeFile(
      path.join(specPath, 'design.md'),
      designTemplate(meta.name, meta.kind),
      'utf8'
    );
  }
  if (next === 'tasks' && !existsSync(path.join(specPath, 'tasks.md'))) {
    await fs.writeFile(path.join(specPath, 'tasks.md'), tasksTemplate(meta.name), 'utf8');
  }
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  try {
    upsertSpec(root, meta);
    recordSpecEvent(root, id, { type: 'advanced', from_phase: from, to_phase: next });
  } catch {
    // non-fatal
  }
  // Fire hooks: spec-advance always, plus spec-done when the spec is complete.
  void maybeFireHooks('spec-advance', { root, specId: id, specKind: meta.kind });
  if (next === 'done') {
    void maybeFireHooks('spec-done', { root, specId: id, specKind: meta.kind });
  }
  return meta;
}

/** Set a spec to an explicit phase (used by Re-sync to reopen a completed phase). */
async function setSpecPhase(root: string, id: string, phase: SpecPhase) {
  const specPath = path.join(root, '.kraken', 'specs', id);
  const metaPath = path.join(specPath, 'spec.json');
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8')) as SpecMeta;
  const order: SpecPhase[] = ['requirements', 'design', 'tasks', 'done'];
  const from = meta.phase;
  meta.phase = phase;
  meta.updatedAt = new Date().toISOString();
  meta.path = specPath;
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  try {
    upsertSpec(root, meta);
    const reverted = order.indexOf(phase) < order.indexOf(from);
    recordSpecEvent(root, id, {
      type: reverted ? 'reverted' : 'advanced',
      from_phase: from,
      to_phase: phase,
    });
  } catch {
    // non-fatal
  }
  return meta;
}

function featureRequirementsTemplate(name: string) {
  return `# Requirements — ${name}

## Introduction
Briefly describe the user-facing capability and why it matters.

## User Stories
- As a <role>, I want <capability>, so that <outcome>.

## Acceptance Criteria (EARS notation)
- WHEN <event/trigger> THEN the system SHALL <observable behavior>.
- WHILE <state> THE system SHALL <continuous behavior>.
- IF <precondition> THEN the system SHALL <conditional behavior>.

## Out of Scope
- List explicitly excluded behaviors.

## Non-Functional Requirements
- Performance, security, accessibility, observability.

## Open Questions
- [ ] <unresolved decision or ambiguity to settle before design>
`;
}

function bugfixTemplate(name: string) {
  return `# Bugfix Analysis — ${name}

## Reproduction
1. <step>
2. <step>

## Current Behavior (defect)
- WHEN <condition> THEN the system <incorrect behavior>.

## Expected Behavior
- WHEN <condition> THEN the system SHALL <correct behavior>.

## Unchanged Behavior (regression guards)
- WHEN <condition> THEN the system SHALL CONTINUE TO <existing behavior>.

## Environment
- Versions, OS, configuration that matter.

## Open Questions
- [ ] <unresolved decision or ambiguity to settle before design>
`;
}

function designTemplate(name: string, kind: SpecKind) {
  if (kind === 'bugfix') {
    return `# Design — ${name}

## Root Cause Analysis
Trace the defect to the smallest unit of code or state that produced it.

## Fix Approach
Describe the minimum change that satisfies the bugfix while preserving Unchanged Behavior.

## Validation Properties
- Bug-reproducing test: SHALL fail on the current code, SHALL pass after the fix.
- No-regression tests: SHALL pass before and after.

## Risks & Rollback
`;
  }
  return `# Design — ${name}

## Overview
High-level architecture and motivation for the chosen approach.

## Components
- Component A — responsibility, inputs, outputs.

## Data & State
- Schemas, persistence, in-flight state.

## Sequence
\`\`\`
user → UI → service → store
\`\`\`

## Error Handling
- Failure modes and user-visible recovery.

## Testing Strategy
- Unit, integration, and acceptance test coverage.

## Open Questions
- [ ] <unresolved design decision to settle before tasks>
`;
}

function tasksTemplate(name: string) {
  return `# Tasks — ${name}

Tasks with no dependencies run in **Wave 1**. Dependents follow in later waves.

## Wave 1
- [ ] T1: <smallest verifiable change> — _outcome: ..._
- [ ] T2: <independent change> — _outcome: ..._

## Wave 2 (depends on T1)
- [ ] T3: <change> — _outcome: ..._

## Verification
- [ ] All acceptance criteria mapped to at least one task.
- [ ] Tests added or updated.
`;
}

// ---------- Skills (Claude Code compatible) ----------

async function listSkills(root: string): Promise<SkillMeta[]> {
  const dirs = [
    { dir: path.join(root, '.claude', 'skills'), scope: 'workspace' as const },
    { dir: path.join(app.getPath('home'), '.claude', 'skills'), scope: 'global' as const },
  ];
  const out: SkillMeta[] = [];
  const seen = new Set<string>();
  for (const { dir, scope } of dirs) {
    if (!existsSync(dir)) continue;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillFile = path.join(dir, e.name, 'SKILL.md');
      if (!existsSync(skillFile)) continue;
      try {
        const raw = await fs.readFile(skillFile, 'utf8');
        const fm = matter(raw);
        const name = (fm.data.name as string) ?? e.name;
        if (seen.has(name)) continue; // workspace takes priority
        seen.add(name);
        out.push({
          name,
          description: (fm.data.description as string) ?? '',
          scope,
          path: skillFile,
          body: fm.content,
        });
      } catch {
        // skip
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Agents (Claude Code compatible) ----------

async function listAgents(root: string): Promise<AgentMeta[]> {
  const dirs = [
    { dir: path.join(root, '.claude', 'agents'), scope: 'workspace' as const },
    { dir: path.join(app.getPath('home'), '.claude', 'agents'), scope: 'global' as const },
  ];
  const out: AgentMeta[] = [];
  const seen = new Set<string>();
  for (const { dir, scope } of dirs) {
    if (!existsSync(dir)) continue;
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      try {
        const raw = await fs.readFile(path.join(dir, f), 'utf8');
        const fm = matter(raw);
        const name = (fm.data.name as string) ?? f.replace('.md', '');
        if (seen.has(name)) continue; // workspace takes priority
        seen.add(name);
        out.push({
          name,
          description: (fm.data.description as string) ?? '',
          model: fm.data.model as string | undefined,
          tools: Array.isArray(fm.data.tools)
            ? (fm.data.tools as string[])
            : typeof fm.data.tools === 'string'
              ? (fm.data.tools as string).split(',').map((s) => s.trim())
              : undefined,
          scope,
          path: path.join(dir, f),
          body: fm.content,
        });
      } catch {
        // skip
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Steering files ----------

/** Convert a simple glob (supports ** and *) to a RegExp. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\0') // placeholder for **
    .replace(/\*/g, '[^/]*')
    .replace(/\0/g, '.*');
  return new RegExp(`(^|/)${escaped}$`);
}

function matchesGlob(filePath: string, glob: string): boolean {
  try {
    return globToRegExp(glob).test(filePath.replace(/\\/g, '/'));
  } catch {
    return false;
  }
}

async function listSteering(root: string): Promise<SteeringFile[]> {
  const dirs = [
    { dir: path.join(root, '.kraken', 'steering'), scope: 'workspace' as const },
    { dir: path.join(app.getPath('home'), '.kraken', 'steering'), scope: 'global' as const },
  ];
  const out: SteeringFile[] = [];
  const seen = new Set<string>();

  // Implicit AGENTS.md / CLAUDE.md at the workspace root behave as `always` steering.
  for (const implicit of ['AGENTS.md', 'CLAUDE.md']) {
    const fp = path.join(root, implicit);
    if (existsSync(fp)) {
      try {
        const body = await fs.readFile(fp, 'utf8');
        out.push({
          name: implicit,
          description: `Root ${implicit} (always included)`,
          inclusion: 'always',
          scope: 'workspace',
          path: fp,
          body,
        });
        seen.add(implicit);
      } catch {
        // skip
      }
    }
  }

  for (const { dir, scope } of dirs) {
    if (!existsSync(dir)) continue;
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      try {
        const raw = await fs.readFile(path.join(dir, f), 'utf8');
        const fm = matter(raw);
        const name = (fm.data.name as string) ?? f.replace('.md', '');
        if (seen.has(name)) continue; // workspace + earlier scope wins
        seen.add(name);
        const inclusion = (fm.data.inclusion as SteeringInclusion) ?? 'always';
        out.push({
          name,
          description: (fm.data.description as string) ?? '',
          inclusion,
          fileMatch: (fm.data.fileMatch as string) ?? undefined,
          scope,
          path: path.join(dir, f),
          body: fm.content,
        });
      } catch {
        // skip
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Assemble the steering block injected into a run's system prompt.
 * - always: always included
 * - fileMatch: included when any fileHint matches the glob
 * - manual: included when its `#name` appears in manualRefs
 * - auto: surfaced as a name+description menu line (model self-selects)
 */
async function composeSteeringSystem(
  root: string | null | undefined,
  opts: { files?: string[]; manualRefs?: string[] } = {}
): Promise<string> {
  if (!root) return '';
  let steering: SteeringFile[];
  try {
    steering = await listSteering(root);
  } catch {
    return '';
  }
  if (steering.length === 0) return '';

  const files = opts.files ?? [];
  const manualRefs = (opts.manualRefs ?? []).map((r) => r.replace(/^#/, ''));
  const included: string[] = [];
  const autoMenu: string[] = [];

  for (const s of steering) {
    if (s.inclusion === 'always') {
      included.push(`# Steering: ${s.name}\n\n${s.body.trim()}`);
    } else if (s.inclusion === 'fileMatch' && s.fileMatch) {
      if (files.some((f) => matchesGlob(f, s.fileMatch!))) {
        included.push(`# Steering: ${s.name}\n\n${s.body.trim()}`);
      }
    } else if (s.inclusion === 'manual') {
      if (manualRefs.includes(s.name)) {
        included.push(`# Steering: ${s.name}\n\n${s.body.trim()}`);
      }
    } else if (s.inclusion === 'auto') {
      autoMenu.push(`- #${s.name}: ${s.description ?? ''}`);
    }
  }

  if (autoMenu.length) {
    included.push(
      `# Available steering (reference with #name if relevant)\n\n${autoMenu.join('\n')}`
    );
  }
  if (included.length === 0) return '';
  return `<project-steering>\n${included.join('\n\n---\n\n')}\n</project-steering>`;
}

async function seedDefaultSteering(root: string) {
  const dir = path.join(root, '.kraken', 'steering');
  await ensureDir(dir);
  const files: Record<string, string> = {
    'product.md': `---
inclusion: always
description: Product purpose, target users, and goals.
---

# Product

_Describe what this product does, who it is for, and the core problems it solves._

- **Purpose**:
- **Target users**:
- **Key goals / non-goals**:
`,
    'tech.md': `---
inclusion: always
description: Tech stack, frameworks, and engineering conventions.
---

# Tech

_Document the stack so generated code matches it._

- **Languages / frameworks**:
- **Build / test / lint commands**:
- **Conventions** (naming, error handling, state, styling):
`,
    'structure.md': `---
inclusion: always
description: File organization and architectural patterns.
---

# Structure

_Outline how the codebase is organized._

- **Key directories**:
- **Module boundaries**:
- **Where new code should go**:
`,
  };
  for (const [name, body] of Object.entries(files)) {
    const fp = path.join(dir, name);
    if (!existsSync(fp)) await fs.writeFile(fp, body, 'utf8');
  }
}

// ---------- Hooks (Kraken-native agent hooks) ----------

const HOOK_COOLDOWN_MS = 4000;
const hookCooldown = new Map<string, number>(); // hookId -> last fire ms
// requestId -> info, so emit() can finalize hook runs + notify the renderer.
const hookRequestIds = new Map<
  string,
  { hookId: string; trigger: HookTrigger; specId: string | null; root: string }
>();

function getMainSender(): Electron.WebContents | null {
  return mainWindow?.webContents ?? null;
}

function emitHookEvent(ev: HookFireEvent) {
  getMainSender()?.send('hook:event', ev);
}

/** Called from emit() when a Claude run finishes; records + notifies if it was a hook run. */
function finalizeHookRun(requestId: string, type: 'done' | 'error', error?: string) {
  const info = hookRequestIds.get(requestId);
  if (!info) return;
  hookRequestIds.delete(requestId);
  try {
    recordHookRun({
      workspacePath: info.root,
      hookId: info.hookId,
      trigger: info.trigger,
      runId: requestId,
      specId: info.specId,
      status: type,
    });
  } catch {
    // non-fatal
  }
  emitHookEvent({
    hookId: info.hookId,
    requestId,
    trigger: info.trigger,
    type,
    specId: info.specId,
    error,
  });
}

async function listHooks(root: string): Promise<HookConfig[]> {
  const dirs = [
    { dir: path.join(root, '.kraken', 'hooks'), scope: 'workspace' as const },
    { dir: path.join(app.getPath('home'), '.kraken', 'hooks'), scope: 'global' as const },
  ];
  const out: HookConfig[] = [];
  const seen = new Set<string>();
  for (const { dir, scope } of dirs) {
    if (!existsSync(dir)) continue;
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(dir, f), 'utf8');
        const parsed = JSON.parse(raw) as HookConfig;
        const id = parsed.id ?? f.replace('.json', '');
        if (seen.has(id)) continue; // workspace wins
        seen.add(id);
        out.push({ ...parsed, id, scope, path: path.join(dir, f) });
      } catch {
        // skip malformed
      }
    }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

async function writeHook(root: string, hook: HookConfig): Promise<HookConfig> {
  const dir = path.join(root, '.kraken', 'hooks');
  await ensureDir(dir);
  const id = hook.id || `hook-${Date.now()}`;
  const file = path.join(dir, `${id}.json`);
  // Persist only the portable fields (drop runtime scope/path).
  const { scope: _s, path: _p, ...rest } = hook;
  const toWrite = { ...rest, id };
  await fs.writeFile(file, JSON.stringify(toWrite, null, 2), 'utf8');
  return { ...toWrite, scope: 'workspace', path: file } as HookConfig;
}

async function deleteHook(root: string, id: string): Promise<void> {
  const file = path.join(root, '.kraken', 'hooks', `${id}.json`);
  if (existsSync(file)) await fs.rm(file);
}

async function toggleHook(root: string, id: string, enabled: boolean): Promise<void> {
  const hooks = await listHooks(root);
  const hook = hooks.find((h) => h.id === id);
  if (!hook) return;
  await writeHook(root, { ...hook, enabled });
}

function composeHookSystem(hook: HookConfig, ctx: HookFireContext, agentBody: string): string {
  const parts: string[] = [];
  if (agentBody) parts.push(agentBody);
  parts.push(`# Hook: ${hook.title}`);
  if (hook.description) parts.push(hook.description);
  if (ctx.specId) {
    const specRel = path.join('.kraken', 'specs', ctx.specId);
    parts.push(
      `This hook fired for spec \`${ctx.specId}\`. Relevant files live under \`${specRel}/\` ` +
        `(requirements.md / bugfix.md, design.md, tasks.md).`
    );
  }
  if (ctx.fileHints && ctx.fileHints.length) {
    parts.push(`Changed/relevant files:\n${ctx.fileHints.map((f) => `- ${f}`).join('\n')}`);
  }
  if (hook.instructions) parts.push(`## Instructions\n\n${hook.instructions}`);
  return parts.join('\n\n---\n\n');
}

async function fireHook(hook: HookConfig, trigger: HookTrigger, ctx: HookFireContext) {
  const root = ctx.root;
  if (hook.actionType === 'run-command') {
    if (!hook.command) return;
    const isWin = process.platform === 'win32';
    const shellBin = isWin ? 'cmd' : process.env.SHELL || '/bin/sh';
    const shellArgs = isWin ? ['/c', hook.command] : ['-c', hook.command];
    // One stable requestId for the whole command lifecycle, so started/done
    // pair up for any waiter tracking this hook.
    const cmdReqId = `cmd-${hook.id}-${Date.now()}`;
    try {
      const child = spawn(shellBin, shellArgs, {
        cwd: existsSync(root) ? root : app.getPath('home'),
        env: { ...process.env, PATH: expandedPath() },
      });
      emitHookEvent({
        hookId: hook.id,
        requestId: cmdReqId,
        trigger,
        type: 'started',
        specId: ctx.specId ?? null,
      });
      child.on('close', (code) => {
        recordHookRun({
          workspacePath: root,
          hookId: hook.id,
          trigger,
          specId: ctx.specId ?? null,
          status: code === 0 ? 'done' : 'error',
        });
        emitHookEvent({
          hookId: hook.id,
          requestId: cmdReqId,
          trigger,
          type: code === 0 ? 'done' : 'error',
          specId: ctx.specId ?? null,
          error: code === 0 ? undefined : `command exited with code ${code}`,
        });
      });
    } catch (err) {
      recordHookRun({
        workspacePath: root,
        hookId: hook.id,
        trigger,
        specId: ctx.specId ?? null,
        status: 'error',
      });
      emitHookEvent({
        hookId: hook.id,
        requestId: cmdReqId,
        trigger,
        type: 'error',
        specId: ctx.specId ?? null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  // ask-claude
  const sender = getMainSender();
  if (!sender) return;
  let agentBody = '';
  if (hook.agent) {
    try {
      const agents = await listAgents(root);
      agentBody = agents.find((a) => a.name === hook.agent)?.body ?? '';
    } catch {
      // best-effort
    }
  }
  const requestId = `hook-${hook.id}-${Date.now()}`;
  hookRequestIds.set(requestId, {
    hookId: hook.id,
    trigger,
    specId: ctx.specId ?? null,
    root,
  });
  emitHookEvent({
    hookId: hook.id,
    requestId,
    trigger,
    type: 'started',
    specId: ctx.specId ?? null,
  });
  const userText = hook.instructions ?? hook.title;
  void streamClaude(sender, {
    requestId,
    source: `hook:${hook.id}:${trigger}`,
    specId: ctx.specId ?? null,
    agent: hook.agent ?? null,
    cwd: root,
    fileHints: ctx.fileHints,
    system: composeHookSystem(hook, ctx, agentBody),
    messages: [{ role: 'user', content: userText }],
  });
}

/**
 * Loop-guard: hook runs write files through the Claude CLI directly (not via the
 * fs:write IPC), so file-save-in-app cannot be retriggered by a hook's own edits.
 * On top of that we enforce a per-hook cooldown.
 */
async function maybeFireHooks(trigger: HookTrigger, ctx: HookFireContext) {
  let hooks: HookConfig[];
  try {
    hooks = await listHooks(ctx.root);
  } catch {
    return;
  }
  for (const hook of hooks) {
    if (!hook.enabled || hook.trigger !== trigger) continue;
    if (hook.specKind && ctx.specKind && hook.specKind !== ctx.specKind) continue;
    if (hook.fileGlob && ctx.fileHints && ctx.fileHints.length) {
      if (!ctx.fileHints.some((f) => matchesGlob(f, hook.fileGlob!))) continue;
    }
    const last = hookCooldown.get(hook.id) ?? 0;
    if (Date.now() - last < HOOK_COOLDOWN_MS) continue;
    hookCooldown.set(hook.id, Date.now());
    await fireHook(hook, trigger, ctx);
  }
}

/** One-shot Claude call that converts a natural-language description into a HookConfig JSON. */
async function generateHookFromNl(root: string, description: string): Promise<void> {
  const sender = getMainSender();
  if (!sender) return;
  const requestId = `hookgen-${Date.now()}`;
  const system = `You generate a Kraken hook config from a description. Reply with ONLY a JSON object (no prose, no code fences) matching:
{"id": "kebab-id", "title": "...", "description": "...", "trigger": "spec-advance|spec-done|task-complete|wave-complete|file-save-in-app|manual", "enabled": true, "actionType": "ask-claude|run-command", "agent": "agent-name-or-null", "instructions": "prompt for ask-claude", "command": "shell for run-command", "blocking": false}
Write the JSON file to .kraken/hooks/<id>.json using the Write tool, then stop.`;
  void streamClaude(sender, {
    requestId,
    source: 'hook:generate',
    cwd: root,
    system,
    messages: [{ role: 'user', content: description }],
  });
}

async function seedDefaultHooks(root: string) {
  const dir = path.join(root, '.kraken', 'hooks');
  await ensureDir(dir);
  const hooks = defaultHooksLibrary();
  for (const hook of hooks) {
    const file = path.join(dir, `${hook.id}.json`);
    if (!existsSync(file)) await fs.writeFile(file, JSON.stringify(hook, null, 2), 'utf8');
  }
}

function defaultHooksLibrary(): Array<Omit<HookConfig, 'scope' | 'path'>> {
  return [
    {
      id: 'code-validate-improve',
      title: 'Validate & improve code',
      description: 'After a wave completes, typecheck, review the diff, and apply safe fixes.',
      trigger: 'wave-complete',
      enabled: true,
      blocking: true,
      actionType: 'ask-claude',
      agent: 'code-reviewer',
      instructions: `A wave of tasks just completed.

1. Run \`npm run typecheck\` via Bash and read the output. (Requires Bash enabled in Settings → Permissions.)
2. Review the git diff for this wave for correctness, regressions vs the spec's acceptance criteria, and reuse opportunities.
3. Apply ONLY safe, mechanical fixes directly with the Edit tool: type errors, obvious bugs, dead code, unused imports.
4. For anything risky or ambiguous, DO NOT edit — list it in your reply for the developer to decide.

Keep your reply concise: typecheck result, fixes applied, and open concerns.`,
    },
    {
      id: 'docs-changelog',
      title: 'Update CHANGELOG & docs',
      description: 'When a spec reaches done, update the CHANGELOG and docs.',
      trigger: 'spec-done',
      enabled: true,
      blocking: false,
      actionType: 'ask-claude',
      agent: 'spec-task-executor',
      instructions: `This spec just reached the 'done' phase.

1. Read the spec's requirements.md / bugfix.md and design.md.
2. Prepend a dated entry to CHANGELOG.md at the repo root (create it with a "Keep a Changelog" header if missing), summarizing the user-facing change under Added / Changed / Fixed.
3. Add or update a short section under docs/ (create docs/<spec-id>.md if there is no docs structure yet; otherwise extend the most relevant existing doc).

Match the existing tone and formatting. Keep your chat reply to the list of files you wrote.`,
    },
  ];
}

// ---------- MCP servers ----------

function parseMcpServers(
  obj: unknown,
  scope: 'workspace' | 'global'
): McpServerMeta[] {
  if (!obj || typeof obj !== 'object') return [];
  const servers = (obj as Record<string, unknown>).mcpServers;
  if (!servers || typeof servers !== 'object') return [];
  const out: McpServerMeta[] = [];
  for (const [name, raw] of Object.entries(servers as Record<string, unknown>)) {
    const cfg = (raw ?? {}) as Record<string, unknown>;
    const url = cfg.url as string | undefined;
    const command = cfg.command as string | undefined;
    const type: 'stdio' | 'http' =
      cfg.type === 'http' || cfg.type === 'sse' || (!command && url) ? 'http' : 'stdio';
    out.push({ name, type, command, url, scope });
  }
  return out;
}

async function listMcpServers(root?: string | null): Promise<McpServerMeta[]> {
  const out: McpServerMeta[] = [];
  const seen = new Set<string>();
  const sources: Array<{ file: string; scope: 'workspace' | 'global' }> = [];
  if (root) sources.push({ file: path.join(root, '.mcp.json'), scope: 'workspace' });
  sources.push({ file: path.join(app.getPath('home'), '.claude.json'), scope: 'global' });
  sources.push({ file: path.join(app.getPath('home'), '.mcp.json'), scope: 'global' });
  for (const { file, scope } of sources) {
    if (!existsSync(file)) continue;
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
      for (const s of parseMcpServers(parsed, scope)) {
        if (seen.has(s.name)) continue;
        seen.add(s.name);
        out.push(s);
      }
    } catch {
      // skip malformed
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Settings / API key ----------

function setApiKey(key: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    store.set('apiKeyEncrypted', Buffer.from(key).toString('base64'));
    return;
  }
  const enc = safeStorage.encryptString(key);
  store.set('apiKeyEncrypted', enc.toString('base64'));
}

function getApiKey(): string | null {
  return decryptSecret(store.get('apiKeyEncrypted'));
}

// Generic secret encryption used for both the Anthropic key and GitHub token.
function encryptSecret(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(value).toString('base64');
  }
  return safeStorage.encryptString(value).toString('base64');
}

function decryptSecret(stored: string | undefined): string | null {
  if (!stored) return null;
  const buf = Buffer.from(stored, 'base64');
  if (!safeStorage.isEncryptionAvailable()) {
    return buf.toString('utf8');
  }
  try {
    return safeStorage.decryptString(buf);
  } catch {
    return buf.toString('utf8');
  }
}

function setGithubToken(token: string) {
  store.set('githubTokenEncrypted', encryptSecret(token));
}

function getGithubToken(): string | null {
  return decryptSecret(store.get('githubTokenEncrypted'));
}

// ---------- CLI detection ----------

function expandedPath(): string {
  const home = app.getPath('home');
  const extras = [
    path.join(home, '.claude', 'local'),
    path.join(home, '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
  ];
  const current = process.env.PATH ?? '';
  return [current, ...extras].filter(Boolean).join(path.delimiter);
}

function detectCli(): { found: boolean; binary?: string; version?: string; error?: string } {
  const env = { ...process.env, PATH: expandedPath() };
  // Try direct invocation in expanded PATH first.
  const candidates = ['claude', path.join(app.getPath('home'), '.claude', 'local', 'claude')];
  for (const bin of candidates) {
    try {
      const res = spawnSync(bin, ['--version'], { env, encoding: 'utf8', timeout: 5000 });
      if (res.status === 0 && res.stdout) {
        return { found: true, binary: bin, version: res.stdout.trim() };
      }
    } catch {
      // continue
    }
  }
  return { found: false, error: 'Could not find `claude` on PATH.' };
}

// ---------- Claude streaming ----------

interface ActiveStream {
  abort?: AbortController;
  kill?: () => void;
}

const activeStreams = new Map<string, ActiveStream>();

interface ClaudePayload {
  requestId: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  system?: string;
  model?: string;
  maxTokens?: number;
  cwd?: string | null;
  source?: string;
  specId?: string | null;
  agent?: string | null;
  /** file paths relevant to this run, used for steering fileMatch inclusion */
  fileHints?: string[];
  /** #names of manual-inclusion steering files to force-include */
  manualRefs?: string[];
  // ----- routing/audit metadata captured for the agent graph -----
  skill?: string | null;
  skillScope?: string | null;
  routeReason?: string | null;
  agentScope?: string | null;
  kind?: string | null;
  taskId?: string | null;
  wave?: string | null;
  dependsOn?: string[];
}

async function streamClaude(sender: Electron.WebContents, payload: ClaudePayload) {
  const backend = store.get('backend') ?? 'cli';
  const lastUser = [...payload.messages].reverse().find((m) => m.role === 'user');

  // Inject project steering into every run's system prompt (chat, task, hook).
  try {
    const steering = await composeSteeringSystem(payload.cwd, {
      files: payload.fileHints,
      manualRefs: payload.manualRefs,
    });
    if (steering) {
      payload = {
        ...payload,
        system: [steering, payload.system].filter(Boolean).join('\n\n---\n\n'),
      };
    }
  } catch {
    // steering is best-effort; never block a run on it
  }

  // Resolve which model this run will request, and where that came from, so the
  // audit panel can always answer "which model did we use?".
  const settingsModel = store.get('model');
  const resolvedRequestModel = payload.model ?? settingsModel;
  const modelSource: string = payload.model
    ? 'explicit'
    : settingsModel
      ? 'settings-default'
      : backend === 'api'
        ? 'api-default'
        : 'cli-default';

  try {
    beginRun({
      id: payload.requestId,
      workspacePath: payload.cwd ?? null,
      specId: payload.specId ?? null,
      backend,
      model: resolvedRequestModel,
      agent: payload.agent ?? null,
      source: payload.source ?? 'chat',
      prompt: lastUser?.content ?? null,
      system: payload.system ?? null,
      skill: payload.skill ?? null,
      skillScope: payload.skillScope ?? null,
      routeReason: payload.routeReason ?? null,
      agentScope: payload.agentScope ?? null,
      kind: payload.kind ?? null,
      taskId: payload.taskId ?? null,
      wave: payload.wave ?? null,
      dependsOn: payload.dependsOn ?? null,
      modelSource,
    });
  } catch (err) {
    recordError({
      workspacePath: payload.cwd ?? null,
      category: 'other',
      message: 'db: failed to begin run',
      details: { error: String(err) },
    });
  }

  if (backend === 'cli') {
    return streamViaCli(sender, payload);
  }
  return streamViaApi(sender, payload);
}

function emit(
  sender: Electron.WebContents,
  requestId: string,
  type: 'delta' | 'done' | 'error',
  text?: string,
  error?: string,
  workspacePath?: string | null,
  channel: StreamChannel = 'text'
) {
  sender.send('claude:event', { requestId, type, text, error, channel });
  if (type === 'delta' && text) {
    try {
      // Keep the persisted run log readable: set thinking/tool/result blocks off
      // from surrounding prose (the live renderer separates them by channel instead).
      appendRunResponse(requestId, channel === 'text' ? text : `\n\n${text}\n`);
    } catch {
      // non-fatal
    }
    return;
  }
  if (type === 'done' || type === 'error') {
    finalizeHookRun(requestId, type, error);
  }
  if (type === 'done') {
    try {
      finishRun(requestId, 'done');
    } catch {
      // non-fatal
    }
    return;
  }
  if (type === 'error') {
    try {
      finishRun(requestId, 'error', error ?? 'unknown');
      recordError({
        runId: requestId,
        workspacePath: workspacePath ?? null,
        category: 'other',
        message: error ?? 'unknown error',
      });
    } catch {
      // non-fatal
    }
  }
}

function streamViaCli(sender: Electron.WebContents, payload: ClaudePayload) {
  const detect = detectCli();
  if (!detect.found || !detect.binary) {
    const msg =
      'Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code, then run `claude` once to authenticate. Or switch to the Anthropic API backend in Settings.';
    recordError({
      runId: payload.requestId,
      workspacePath: payload.cwd ?? null,
      category: 'cli_spawn',
      message: msg,
    });
    emit(sender, payload.requestId, 'error', undefined, msg, payload.cwd ?? null);
    return;
  }

  // Compose a single prompt: system + conversation history.
  const history = payload.messages
    .map((m) => `<${m.role}>\n${m.content}\n</${m.role}>`)
    .join('\n\n');
  const prompt = payload.system
    ? `${payload.system}\n\n---\n\n${history}`
    : history;

  const allowedTools = getEffectiveTools();
  const permissionMode = store.get('permissionMode') ?? 'acceptEdits';
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    permissionMode,
    '--allowedTools',
    allowedTools.join(','),
  ];
  if (payload.model) {
    args.push('--model', payload.model);
  }

  const env = { ...process.env, PATH: expandedPath() };
  const cwd = payload.cwd && existsSync(payload.cwd) ? payload.cwd : app.getPath('home');

  let child;
  try {
    child = spawn(detect.binary, args, { env, cwd });
  } catch (err) {
    const msg = `Failed to spawn claude: ${err instanceof Error ? err.message : String(err)}`;
    recordError({
      runId: payload.requestId,
      workspacePath: payload.cwd ?? null,
      category: 'cli_spawn',
      message: msg,
    });
    emit(sender, payload.requestId, 'error', undefined, msg, payload.cwd ?? null);
    return;
  }

  activeStreams.set(payload.requestId, { kill: () => child.kill('SIGTERM') });

  // Record the exact invocation for audit. The prompt is already stored in its
  // own column, so redact the `-p <prompt>` value to avoid duplicating it here.
  try {
    const redactedArgs = args.map((a, i) => (args[i - 1] === '-p' ? '<prompt>' : a));
    updateRunCommand(payload.requestId, {
      command: JSON.stringify([detect.binary, ...redactedArgs]),
      tools: allowedTools,
      permissionMode,
    });
  } catch {
    // audit metadata is best-effort
  }

  let buffer = '';
  let stderrBuf = '';

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const evt = JSON.parse(line) as ClaudeCliEvent;
        forwardCliEvent(sender, payload.requestId, evt, payload.cwd ?? null);
      } catch {
        // ignore non-JSON lines
      }
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderrBuf += chunk;
  });

  child.on('error', (err) => {
    const msg = `claude error: ${err.message}`;
    recordError({
      runId: payload.requestId,
      workspacePath: payload.cwd ?? null,
      category: 'cli_exit',
      message: msg,
    });
    emit(sender, payload.requestId, 'error', undefined, msg, payload.cwd ?? null);
    activeStreams.delete(payload.requestId);
  });

  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      const msg = stderrBuf.trim().slice(0, 600) || `claude exited with code ${code}`;
      recordError({
        runId: payload.requestId,
        workspacePath: payload.cwd ?? null,
        category: 'cli_exit',
        message: msg,
        details: { exitCode: code },
      });
      emit(sender, payload.requestId, 'error', undefined, msg, payload.cwd ?? null);
    } else {
      emit(sender, payload.requestId, 'done', undefined, undefined, payload.cwd ?? null);
    }
    activeStreams.delete(payload.requestId);
  });
}

interface ClaudeCliEvent {
  type?: string;
  subtype?: string;
  /** present on the `system`/`init` event — the model Claude Code actually uses */
  model?: string;
  tools?: string[];
  message?: {
    model?: string;
    content?: Array<{
      type: string;
      text?: string;
      /** extended-thinking block content */
      thinking?: string;
      name?: string;
      input?: Record<string, unknown>;
      /** tool_result block content (string, or an array of text parts) */
      content?: string | Array<{ type?: string; text?: string }>;
      is_error?: boolean;
    }>;
  };
  delta?: { type?: string; text?: string; thinking?: string };
  error?: string | { message?: string };
}

function summarizeToolUse(
  name: string | undefined,
  input: Record<string, unknown> | undefined
): string {
  if (!name) return '🔧 (tool)';
  const file = (input?.file_path ?? input?.path ?? input?.notebook_path) as
    | string
    | undefined;
  const cmd = input?.command as string | undefined;
  const pattern = input?.pattern as string | undefined;

  // Bash commands deserve a real fenced code block so syntax highlighting
  // works in the chat renderer.
  if (name === 'Bash' && cmd) {
    return `🔧 **Bash**\n\n\`\`\`bash\n${cmd}\n\`\`\``;
  }

  // Edit/Write show a unified diff-style header so the path is unambiguous.
  if ((name === 'Edit' || name === 'Write') && file) {
    return `🔧 **${name}** \`${file}\``;
  }

  const detail = file
    ? `\`${file.split('/').slice(-2).join('/')}\``
    : pattern
      ? `\`${pattern}\``
      : cmd
        ? `\`${cmd.slice(0, 80)}${cmd.length > 80 ? '…' : ''}\``
        : '';
  return `🔧 **${name}**${detail ? ` ${detail}` : ''}`;
}

// Tools that create or modify files on disk — the signal for "what did this run
// output?". Map each to a coarse op so the UI can distinguish creates from edits.
const FILE_WRITE_TOOLS: Record<string, 'write' | 'edit'> = {
  Write: 'write',
  Create: 'write',
  Edit: 'edit',
  MultiEdit: 'edit',
  Update: 'edit',
  NotebookEdit: 'edit',
};

/** Extract the file path a write/edit tool acted on, if any. */
function fileFromToolUse(
  name: string | undefined,
  input: Record<string, unknown> | undefined
): { path: string; tool: string; op: 'write' | 'edit' } | null {
  if (!name) return null;
  const op = FILE_WRITE_TOOLS[name];
  if (!op) return null;
  const path = (input?.file_path ?? input?.path ?? input?.notebook_path) as string | undefined;
  if (!path || typeof path !== 'string') return null;
  return { path, tool: name, op };
}

function forwardCliEvent(
  sender: Electron.WebContents,
  requestId: string,
  evt: ClaudeCliEvent,
  workspacePath: string | null
) {
  // Claude Code stream-json emits several event shapes. Surface text content
  // and tool use from `assistant` messages, and forward errors verbatim.
  // The init `system` event reports the model Claude Code actually resolved.
  if (evt.type === 'system' && evt.subtype === 'init') {
    const model = evt.model ?? evt.message?.model;
    if (model) {
      try {
        updateRunResolvedModel(requestId, model);
      } catch {
        // best-effort
      }
    }
    return;
  }
  if (evt.type === 'assistant' && evt.message?.content) {
    for (const block of evt.message.content) {
      if (block.type === 'text' && block.text) {
        emit(sender, requestId, 'delta', block.text, undefined, workspacePath, 'text');
      } else if (block.type === 'thinking' && block.thinking) {
        emit(sender, requestId, 'delta', block.thinking, undefined, workspacePath, 'thinking');
      } else if (block.type === 'tool_use') {
        emit(
          sender,
          requestId,
          'delta',
          summarizeToolUse(block.name, block.input),
          undefined,
          workspacePath,
          'tool'
        );
        // Record file output so the run can be matched to what it produced.
        const touched = fileFromToolUse(block.name, block.input);
        if (touched) {
          try {
            recordRunFile({
              runId: requestId,
              workspacePath,
              path: touched.path,
              tool: touched.tool,
              op: touched.op,
            });
          } catch {
            // audit metadata is best-effort
          }
        }
      }
    }
    return;
  }
  // Tool results arrive on `user` events — surface a truncated preview.
  if (evt.type === 'user' && evt.message?.content) {
    for (const block of evt.message.content) {
      if (block.type !== 'tool_result') continue;
      const raw =
        typeof block.content === 'string'
          ? block.content
          : (block.content ?? [])
              .map((p) => p.text ?? '')
              .join('')
              .trim();
      if (!raw) continue;
      const preview = raw.length > 600 ? raw.slice(0, 600) + '\n… (truncated)' : raw;
      emit(sender, requestId, 'delta', preview, undefined, workspacePath, 'tool_result');
    }
    return;
  }
  if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
    emit(sender, requestId, 'delta', evt.delta.text, undefined, workspacePath, 'text');
    return;
  }
  if (evt.type === 'content_block_delta' && evt.delta?.type === 'thinking_delta' && evt.delta.thinking) {
    emit(sender, requestId, 'delta', evt.delta.thinking, undefined, workspacePath, 'thinking');
    return;
  }
  if (evt.type === 'result' && evt.subtype && evt.subtype !== 'success') {
    const msg =
      typeof evt.error === 'string'
        ? evt.error
        : evt.error?.message ?? `claude returned ${evt.subtype}`;
    recordError({
      runId: requestId,
      workspacePath,
      category: 'cli_exit',
      message: msg,
      details: { subtype: evt.subtype },
    });
    emit(sender, requestId, 'error', undefined, msg, workspacePath);
  }
}

async function streamViaApi(sender: Electron.WebContents, payload: ClaudePayload) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const msg =
      'No API key set. Open Settings to add one, or switch the backend to the local Claude CLI.';
    recordError({
      runId: payload.requestId,
      workspacePath: payload.cwd ?? null,
      category: 'api',
      message: msg,
    });
    emit(sender, payload.requestId, 'error', undefined, msg, payload.cwd ?? null);
    return;
  }

  const controller = new AbortController();
  activeStreams.set(payload.requestId, { abort: controller });

  const client = new Anthropic({ apiKey });
  const model = payload.model ?? store.get('model') ?? 'claude-opus-4-7';

  // Record the exact invocation for audit (no prompt duplication — it's stored
  // in its own column). The requested model is also the resolved one for the API
  // backend, but we refine it from message_start below.
  try {
    updateRunCommand(payload.requestId, {
      command: 'api:messages.stream',
      permissionMode: 'api',
      modelSource: payload.model ? 'explicit' : store.get('model') ? 'settings-default' : 'api-default',
    });
    updateRunResolvedModel(payload.requestId, model);
  } catch {
    // best-effort
  }

  try {
    const stream = await client.messages.stream(
      {
        model,
        max_tokens: payload.maxTokens ?? 4096,
        system: payload.system,
        messages: payload.messages,
      },
      { signal: controller.signal }
    );

    for await (const event of stream) {
      if (event.type === 'message_start' && event.message?.model) {
        try {
          updateRunResolvedModel(payload.requestId, event.message.model);
        } catch {
          // best-effort
        }
      }
      if (event.type === 'content_block_delta') {
        // The SDK delta union varies by version; read channel-relevant fields loosely
        // so extended-thinking deltas surface too without a type-version dependency.
        const delta = event.delta as { type?: string; text?: string; thinking?: string };
        if (delta.type === 'text_delta' && delta.text) {
          emit(sender, payload.requestId, 'delta', delta.text, undefined, payload.cwd ?? null, 'text');
        } else if (delta.type === 'thinking_delta' && delta.thinking) {
          emit(
            sender,
            payload.requestId,
            'delta',
            delta.thinking,
            undefined,
            payload.cwd ?? null,
            'thinking'
          );
        }
      }
    }
    emit(sender, payload.requestId, 'done', undefined, undefined, payload.cwd ?? null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordError({
      runId: payload.requestId,
      workspacePath: payload.cwd ?? null,
      category: 'api',
      message: msg,
    });
    emit(sender, payload.requestId, 'error', undefined, msg, payload.cwd ?? null);
  } finally {
    activeStreams.delete(payload.requestId);
  }
}

function cancelClaude(requestId: string) {
  const s = activeStreams.get(requestId);
  if (s) {
    s.abort?.abort();
    s.kill?.();
  }
  activeStreams.delete(requestId);
  try {
    finishRun(requestId, 'cancelled', 'cancelled by user');
  } catch {
    // non-fatal
  }
  // If this was a hook run, emit its terminal event NOW so anything waiting on
  // the hook (e.g. autopilot blocking on wave-complete) is released immediately,
  // rather than depending on the killed child's async close. finalizeHookRun is
  // idempotent (it removes the entry), so the later natural close is a no-op.
  finalizeHookRun(requestId, 'error', 'cancelled by user');
}

// ---------- Default content seeding (Claude Code compatible) ----------

async function seedDefaultSkills(root: string) {
  const skillsDir = path.join(root, '.claude', 'skills');
  await ensureDir(skillsDir);

  const skills: Record<string, string> = {
    'sdd-feature': `---
name: sdd-feature
description: Walk through requirements → design → tasks for a new feature. Activate when the user wants to scope, design, or break down a feature.
---

# SDD Feature Skill

When activated, drive a three-phase Spec-Driven Development conversation:

1. **Requirements** — capture user stories and acceptance criteria using EARS notation.
2. **Design** — propose architecture, components, sequences, and testing strategy.
3. **Tasks** — break the design into independent waves with clear outcomes.

Always ask for confirmation before advancing phases.
`,
    'sdd-bugfix': `---
name: sdd-bugfix
description: Reproduce → root cause → minimal fix workflow for bug specs. Activate when the user reports a bug or wants to scope a fix.
---

# SDD Bugfix Skill

Capture three sections:

- **Current Behavior** — WHEN/THEN of the defect.
- **Expected Behavior** — WHEN/THEN/SHALL of the correct behavior.
- **Unchanged Behavior** — WHEN/THEN/SHALL CONTINUE TO statements that guard regressions.

Prefer the smallest possible change that satisfies the bugfix and preserves Unchanged Behavior.
`,
  };

  for (const [name, body] of Object.entries(skills)) {
    const dir = path.join(skillsDir, name);
    await ensureDir(dir);
    const file = path.join(dir, 'SKILL.md');
    if (!existsSync(file)) await fs.writeFile(file, body, 'utf8');
  }
}

async function seedDefaultAgents(root: string) {
  const agentsDir = path.join(root, '.claude', 'agents');
  await ensureDir(agentsDir);

  const agents = defaultAgentsLibrary();
  for (const [name, body] of Object.entries(agents)) {
    const file = path.join(agentsDir, `${name}.md`);
    if (!existsSync(file)) await fs.writeFile(file, body, 'utf8');
  }
}

function defaultAgentsLibrary(): Record<string, string> {
  return {
    'spec-requirements-writer': `---
name: spec-requirements-writer
description: Turn raw product intent into a requirements.md using EARS notation. Use this in the Requirements phase of a feature spec.
tools: Read, Write, Grep, Glob
---

You author **requirements.md** for feature specs.

Output sections:
- **Introduction** — one paragraph on the user-facing capability and why it matters.
- **User Stories** — "As a <role>, I want <capability>, so that <outcome>."
- **Acceptance Criteria** — strictly EARS:
  - WHEN <event> THEN the system SHALL <behavior>.
  - WHILE <state> THE system SHALL <behavior>.
  - IF <precondition> THEN the system SHALL <behavior>.
- **Out of Scope** — list excluded behaviors.
- **Non-Functional Requirements** — performance, security, accessibility, observability.

Never invent behaviors that aren't stated or strongly implied. Ask the user once for missing context, then commit to a draft.
`,

    'spec-design-architect': `---
name: spec-design-architect
description: Convert requirements.md into a design.md with components, sequences, data model, error handling, and test strategy. Use in the Design phase.
tools: Read, Write, Grep, Glob
---

You author **design.md** by reading requirements.md (or bugfix.md) and producing:

- **Overview** — chosen approach and why over alternatives.
- **Components** — each with responsibility, inputs, outputs.
- **Data & State** — schemas and persistence.
- **Sequence** — ascii or mermaid for the primary flow.
- **Error Handling** — failure modes and user-visible recovery.
- **Testing Strategy** — unit, integration, acceptance mapping back to ACs.
- **Open Questions** — explicit, numbered.

Bias to the simplest design that satisfies every acceptance criterion. Call out tradeoffs.
`,

    'spec-task-planner': `---
name: spec-task-planner
description: Break design.md into trackable tasks organized in dependency waves. Use in the Tasks phase.
tools: Read, Write, Grep, Glob
---

You author **tasks.md**. Each task must have:
- A unique ID (T1, T2, …).
- A single observable outcome.
- A small enough scope to verify in one PR.

Write each task line exactly as \`- [ ] T1: <description>\` — a plain checkbox, the bare id, then a colon. Never wrap the id or checkbox in markdown bold/emphasis (no \`**T1**\`, no \`__T1__\`); the runner parses these lines literally. To assign a specialized agent, use \`- [ ] T1 @agent-name: <description>\`.

Group tasks into **waves**. Wave 1 contains all tasks with no dependencies and may run in parallel. Subsequent waves list their prerequisites explicitly ("(depends on T1, T3)").

Close with a **Verification** checklist that maps every acceptance criterion to at least one task.
`,

    'spec-task-executor': `---
name: spec-task-executor
description: Execute a single task from tasks.md — read the spec, make the change, update the task list. Use during implementation.
tools: Read, Edit, Write, Bash, Grep, Glob
---

You execute exactly one task at a time. Before editing:
1. Re-read requirements.md / bugfix.md and design.md.
2. Locate the target files; confirm the change matches the design.

After editing:
- Run or describe the test(s) that validate the task.
- Tick the task box in tasks.md.
- Stop. Do not start the next task unless explicitly told to.
`,

    'bug-analyzer': `---
name: bug-analyzer
description: Drive the bugfix Analysis phase — capture reproduction, current behavior, expected behavior, and unchanged behavior. Use when starting a bugfix spec.
tools: Read, Write, Grep, Glob
---

You author **bugfix.md**. Required sections:

- **Reproduction** — minimal numbered steps.
- **Current Behavior** — WHEN/THEN of the defect.
- **Expected Behavior** — WHEN/THEN/SHALL of correct behavior.
- **Unchanged Behavior** — WHEN/THEN/SHALL CONTINUE TO statements protecting against regressions.
- **Environment** — versions, OS, config that matter.

If reproduction steps are missing, ask once. Otherwise commit to a draft.
`,

    'codebase-explorer': `---
name: codebase-explorer
description: Read-only exploration of the workspace to answer "where is X" or "how does Y work". Use before planning to gather grounding.
tools: Read, Grep, Glob
---

You are read-only. Locate symbols, trace call paths, summarize how a feature works today, and surface invariants the design must respect. Always report file paths with line numbers.
`,

    'code-reviewer': `---
name: code-reviewer
description: Review a proposed change for correctness, regressions, and reuse opportunities before commit. Use after each task is executed.
tools: Read, Grep, Glob, Bash
---

You review staged or proposed changes. Output:
- **Correctness** — bugs, races, off-by-ones, missing edge cases.
- **Regressions** — interactions with Unchanged Behavior.
- **Reuse** — existing helpers that should be used instead of new code.
- **Simplification** — code that can be deleted without losing behavior.

Be specific: cite file:line. No nits unless asked.
`,

    'test-generator': `---
name: test-generator
description: Generate tests that map each acceptance criterion (EARS statement) to at least one executable test. Use after Design, before/during implementation.
tools: Read, Write, Grep, Glob, Bash
---

You generate tests grounded in the spec's acceptance criteria. For each EARS statement, emit at least one test with:
- A name that quotes the WHEN/THEN.
- Arrange/Act/Assert structure.
- For bugfix specs, also generate at least one **regression** test per Unchanged Behavior statement.

Match the project's existing test framework and style.
`,

    'spec-doctor': `---
name: spec-doctor
description: Audit a spec for inconsistencies between requirements, design, and tasks. Use before moving to implementation, or when a spec feels off.
tools: Read, Grep, Glob
---

You audit the spec end-to-end. Surface:
- Acceptance criteria with no corresponding task.
- Tasks with no acceptance criterion (scope creep).
- Components in design that no task touches.
- Unchanged Behavior statements with no regression test.

Report blockers vs. nits separately.
`,
  };
}
