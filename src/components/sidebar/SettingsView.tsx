import { useEffect, useState } from 'react';
import {
  Key,
  Cpu,
  Trash2,
  Check,
  Terminal,
  Cloud,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Shield,
  FileEdit,
  TerminalSquare,
  Layers,
  Minus,
  Plus,
  Server,
  Github,
  FolderGit2,
  FolderOpen,
  GitBranch,
} from 'lucide-react';
import { Settings as SettingsIcon } from 'lucide-react';
import { SidebarHeader } from '../SidebarShell';
import { cn } from '../../lib/cn';
import { useOrchestrator } from '../../stores/orchestrator';
import { useWorkspace } from '../../stores/workspace';
import { useModels, MODEL_OPTIONS, STEPS } from '../../stores/models';
import type {
  McpServerMeta,
  GitHubTokenStatus,
} from '../../../electron/shared/types';

const MODELS = MODEL_OPTIONS.map((m) => ({ id: m.id, label: `${m.label} · ${m.price}` }));

type Backend = 'cli' | 'api';
type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions';

interface CliStatus {
  found: boolean;
  binary?: string;
  version?: string;
  error?: string;
}

interface Permissions {
  allowedTools: string[];
  permissionMode: PermissionMode;
  allowBash: boolean;
}

export function SettingsView({ variant = 'panel' }: { variant?: 'panel' | 'page' } = {}) {
  const stepModels = useModels((s) => s.stepModels);
  const setStepModel = useModels((s) => s.setStep);
  const [backend, setBackend] = useState<Backend>('cli');
  const [cli, setCli] = useState<CliStatus | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [model, setModel] = useState('claude-opus-4-7');
  const [saved, setSaved] = useState(false);
  const [showApiKeyHelp, setShowApiKeyHelp] = useState(false);
  const [perms, setPerms] = useState<Permissions | null>(null);
  const [mcp, setMcp] = useState<McpServerMeta[]>([]);
  const [github, setGithub] = useState<GitHubTokenStatus | null>(null);
  const [ghTokenInput, setGhTokenInput] = useState('');
  const [ghEditing, setGhEditing] = useState(false);
  const maxConcurrency = useOrchestrator((s) => s.maxConcurrency);
  const setMaxConcurrency = useOrchestrator((s) => s.setMaxConcurrency);
  const root = useWorkspace((s) => s.root);
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);
  const openWorkspace = useWorkspace((s) => s.openWorkspace);
  const [recents, setRecents] = useState<string[]>([]);
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    window.kraken.settings.hasApiKey().then(setHasKey);
    window.kraken.settings.getModel().then(setModel);
    window.kraken.settings.getBackend().then(setBackend);
    window.kraken.settings.getPermissions().then(setPerms);
    window.kraken.settings.getMaxConcurrency().then(setMaxConcurrency);
    window.kraken.mcp.list().then(setMcp).catch(() => setMcp([]));
    window.kraken.github.tokenStatus().then(setGithub).catch(() => setGithub(null));
    redetectCli();
  }, [setMaxConcurrency]);

  useEffect(() => {
    window.kraken.workspace.getRecents().then(setRecents).catch(() => setRecents([]));
    if (root) {
      window.kraken.git
        .status(root)
        .then((s) => setBranch(s.isRepo ? s.branch : null))
        .catch(() => setBranch(null));
    } else {
      setBranch(null);
    }
  }, [root]);

  const saveGhToken = async () => {
    if (!ghTokenInput.trim()) return;
    await window.kraken.github.setToken(ghTokenInput.trim());
    setGhTokenInput('');
    setGhEditing(false);
    setGithub(await window.kraken.github.tokenStatus());
  };

  const clearGhToken = async () => {
    await window.kraken.github.clearToken();
    setGithub(await window.kraken.github.tokenStatus());
  };

  const changeConcurrency = async (n: number) => {
    const clamped = Math.max(1, Math.min(8, n));
    setMaxConcurrency(clamped);
    await window.kraken.settings.setMaxConcurrency(clamped);
  };

  const savePerms = async (next: Partial<Permissions>) => {
    if (!perms) return;
    const merged = { ...perms, ...next };
    setPerms(merged);
    await window.kraken.settings.setPermissions(next);
  };

  const redetectCli = async () => {
    setCli(null);
    const status = await window.kraken.cli.detect();
    setCli(status);
  };

  const changeBackend = async (b: Backend) => {
    setBackend(b);
    await window.kraken.settings.setBackend(b);
  };

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    await window.kraken.settings.setApiKey(keyInput.trim());
    setKeyInput('');
    setEditing(false);
    setHasKey(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const clearKey = async () => {
    await window.kraken.settings.clearApiKey();
    setHasKey(false);
  };

  const changeModel = async (m: string) => {
    setModel(m);
    await window.kraken.settings.setModel(m);
  };

  const inner = (
    <div className="space-y-5">
        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-2">
            <FolderGit2 size={12} /> Project directory
          </h3>
          <div className="rounded-md border border-ink-800 bg-ink-900/60 p-3 space-y-2">
            {root ? (
              <>
                <div className="flex items-start gap-2">
                  <FolderGit2 size={13} className="text-accent mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-ink-50 truncate">
                      {root.split('/').filter(Boolean).pop()}
                    </div>
                    <div className="text-[10px] text-ink-500 font-mono break-all leading-snug">
                      {root}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <GitBranch size={11} className="shrink-0" />
                  {branch ? (
                    <span className="font-mono text-ink-200">{branch}</span>
                  ) : (
                    <span className="text-ink-500">not a git branch</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-ink-400">No project open.</p>
            )}
            <button
              onClick={pickWorkspace}
              className="w-full text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90"
            >
              <FolderOpen size={12} /> Change directory…
            </button>
          </div>

          {recents.filter((p) => p !== root).length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-1">
                Recent
              </div>
              <div className="rounded-md border border-ink-800 bg-ink-900/40 p-1 space-y-0.5">
                {recents
                  .filter((p) => p !== root)
                  .slice(0, 6)
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => openWorkspace(p)}
                      title={p}
                      className="w-full flex items-center gap-2 text-left text-xs px-2 py-1 rounded text-ink-300 hover:bg-ink-800/60"
                    >
                      <FolderGit2 size={11} className="text-ink-500 shrink-0" />
                      <span className="truncate">
                        {p.split('/').filter(Boolean).pop()}
                      </span>
                      <span className="text-[9px] text-ink-600 font-mono truncate ml-auto">
                        {p.split('/').filter(Boolean).slice(-2, -1)[0] ?? ''}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <h3 className="text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-2">
            Backend
          </h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <BackendCard
              selected={backend === 'cli'}
              onClick={() => changeBackend('cli')}
              icon={<Terminal size={15} />}
              title="Local Claude"
              description="Use the installed `claude` CLI. Free if you have a Claude Pro/Max subscription."
              recommended
            />
            <BackendCard
              selected={backend === 'api'}
              onClick={() => changeBackend('api')}
              icon={<Cloud size={15} />}
              title="Anthropic API"
              description="Pay-per-use via api.anthropic.com. Needs an API key."
            />
          </div>

          {backend === 'cli' && (
            <CliStatusPanel status={cli} onRedetect={redetectCli} />
          )}
        </section>

        {backend === 'api' && (
          <section>
            <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-2">
              <Key size={12} /> Anthropic API key
            </h3>
            {hasKey && !editing ? (
              <div className="rounded-md border border-ink-800 bg-ink-900/60 p-3">
                <div className="flex items-center gap-2 text-xs text-ok mb-2">
                  <Check size={13} /> Key stored securely
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs px-2 py-1 rounded-md bg-ink-800 hover:bg-ink-700 text-ink-100"
                  >
                    Replace
                  </button>
                  <button
                    onClick={clearKey}
                    className="text-xs px-2 py-1 rounded-md text-bad hover:bg-bad/10 flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Clear
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-ink-800 bg-ink-900/60 p-3 space-y-2">
                <input
                  type="password"
                  placeholder="sk-ant-..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded-md bg-ink-950 border border-ink-800 focus:border-accent outline-none font-mono"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveKey}
                    className="text-xs px-3 py-1 rounded-md bg-accent text-accent-fg hover:opacity-90"
                  >
                    Save
                  </button>
                  {editing && (
                    <button
                      onClick={() => setEditing(false)}
                      className="text-xs px-3 py-1 rounded-md text-ink-300 hover:bg-ink-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-ink-500 leading-snug">
                  Stored via Electron safeStorage (your OS keychain). Only sent to api.anthropic.com.
                </p>
                {saved && <p className="text-[10px] text-ok">Saved.</p>}
                <button
                  onClick={() => setShowApiKeyHelp((s) => !s)}
                  className="text-[10px] text-accent hover:underline mt-1"
                >
                  {showApiKeyHelp ? 'Hide' : 'How do I get an API key?'}
                </button>
                {showApiKeyHelp && <ApiKeyHelp />}
              </div>
            )}
          </section>
        )}

        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-2">
            <Cpu size={12} /> Model
          </h3>
          <div className="rounded-md border border-ink-800 bg-ink-900/60 p-1">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => changeModel(m.id)}
                className={cn(
                  'w-full flex items-center justify-between text-xs px-2 py-1.5 rounded',
                  model === m.id
                    ? 'bg-accent/20 text-ink-50'
                    : 'text-ink-300 hover:bg-ink-800/60'
                )}
              >
                <span>{m.label}</span>
                {model === m.id && <Check size={12} className="text-accent" />}
              </button>
            ))}
          </div>
          {backend === 'cli' && (
            <p className="text-[10px] text-ink-500 mt-1">
              Passed as <code className="text-ink-300">--model</code> to the CLI.
            </p>
          )}
        </section>

        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-2">
            <Cpu size={12} /> Model per step
          </h3>
          <p className="text-[10px] text-ink-500 leading-snug mb-2">
            Optimize spending — pick a cheaper model for simple steps and a stronger one where it
            counts. <b className="text-ink-300">Default</b> uses the model chosen above.
          </p>
          <div className="rounded-md border border-ink-800 bg-ink-900/60 divide-y divide-ink-800/60">
            {STEPS.map((s) => (
              <div key={s.key} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-ink-100">{s.label}</div>
                  <div className="text-[10px] text-ink-500 leading-snug">{s.hint}</div>
                </div>
                <select
                  value={stepModels[s.key] ?? ''}
                  onChange={(e) => setStepModel(s.key, e.target.value)}
                  className="shrink-0 text-[11px] bg-ink-950 border border-ink-800 rounded-md px-2 py-1.5 text-ink-100 focus:border-accent outline-none max-w-[190px]"
                >
                  <option value="">Default</option>
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} · {m.price}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        {backend === 'cli' && perms && (
          <section>
            <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-2">
              <Shield size={12} /> Permissions
            </h3>
            <div className="rounded-md border border-ink-800 bg-ink-900/60 p-3 space-y-3">
              <ToggleRow
                icon={<FileEdit size={13} />}
                title="Edit & write files"
                description="Required for Claude to draft and update spec markdown directly."
                enabled={perms.permissionMode !== 'default'}
                onToggle={(v) =>
                  savePerms({ permissionMode: v ? 'acceptEdits' : 'default' })
                }
              />
              <ToggleRow
                icon={<TerminalSquare size={13} />}
                title="Run shell commands"
                description="Lets Claude use the Bash tool. Off by default — only enable if you trust the prompts."
                enabled={perms.allowBash}
                onToggle={(v) => savePerms({ allowBash: v })}
                tone="warn"
              />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-1">
                  Allowed tools
                </div>
                <div className="flex flex-wrap gap-1">
                  {perms.allowedTools.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink-800 text-ink-200"
                    >
                      {t}
                    </span>
                  ))}
                  {perms.allowBash && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-warn/20 text-warn">
                      Bash
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-ink-500 leading-snug">
                Passed to the CLI as <code className="text-ink-300">--allowedTools</code> +{' '}
                <code className="text-ink-300">--permission-mode</code>. Edits are scoped to your
                current workspace (the CLI's working directory).
              </p>
            </div>
          </section>
        )}

        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-2">
            <Layers size={12} /> Orchestration
          </h3>
          <div className="rounded-md border border-ink-800 bg-ink-900/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-xs font-medium text-ink-50">Max parallel agents</div>
                <div className="text-[10px] text-ink-400 leading-snug">
                  How many tasks run concurrently in a wave.
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => changeConcurrency(maxConcurrency - 1)}
                  className="w-6 h-6 grid place-items-center rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
                  disabled={maxConcurrency <= 1}
                >
                  <Minus size={12} />
                </button>
                <span className="text-sm font-mono text-ink-50 w-4 text-center">
                  {maxConcurrency}
                </span>
                <button
                  onClick={() => changeConcurrency(maxConcurrency + 1)}
                  className="w-6 h-6 grid place-items-center rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
                  disabled={maxConcurrency >= 8}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-ink-500 leading-snug">
              Tasks in a wave should touch disjoint files — parallel edits to the same file can
              conflict. Tag a task with <code className="text-ink-300">@agent-name</code> to pick a
              specialized agent.
            </p>
          </div>
        </section>

        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-2">
            <Github size={12} /> GitHub
          </h3>
          <div className="rounded-md border border-ink-800 bg-ink-900/60 p-3 space-y-2">
            {github?.hasToken && !ghEditing ? (
              <>
                {github.valid ? (
                  <div className="flex items-center gap-2 text-xs text-ok">
                    <Check size={13} /> Connected
                    {github.login && (
                      <span className="text-ink-300">as @{github.login}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-bad">
                    <AlertCircle size={13} /> Token invalid
                  </div>
                )}
                {github.scopes && github.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {github.scopes.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink-800 text-ink-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setGhEditing(true)}
                    className="text-xs px-2 py-1 rounded-md bg-ink-800 hover:bg-ink-700 text-ink-100"
                  >
                    Replace
                  </button>
                  <button
                    onClick={clearGhToken}
                    className="text-xs px-2 py-1 rounded-md text-bad hover:bg-bad/10 flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Disconnect
                  </button>
                </div>
              </>
            ) : (
              <>
                <input
                  type="password"
                  placeholder="ghp_… or github_pat_…"
                  value={ghTokenInput}
                  onChange={(e) => setGhTokenInput(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded-md bg-ink-950 border border-ink-800 focus:border-accent outline-none font-mono"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveGhToken}
                    className="text-xs px-3 py-1 rounded-md bg-accent text-accent-fg hover:opacity-90"
                  >
                    Save
                  </button>
                  {ghEditing && (
                    <button
                      onClick={() => setGhEditing(false)}
                      className="text-xs px-3 py-1 rounded-md text-ink-300 hover:bg-ink-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-ink-500 leading-snug">
                  Personal Access Token with <code className="text-ink-300">repo</code> (or
                  fine-grained PR read/write) scope. Stored via your OS keychain. Used to
                  open and merge pull requests from the{' '}
                  <span className="text-ink-300">Pull Requests</span> panel.
                </p>
              </>
            )}
          </div>
        </section>

        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-2">
            <Server size={12} /> MCP servers
          </h3>
          <div className="rounded-md border border-ink-800 bg-ink-900/60 p-3">
            {mcp.length === 0 ? (
              <p className="text-[10px] text-ink-400 leading-snug">
                No MCP servers detected in <code className="text-ink-300">~/.claude.json</code> or{' '}
                <code className="text-ink-300">.mcp.json</code>. The CLI backend inherits whatever
                MCP servers your Claude CLI is configured with.
              </p>
            ) : (
              <div className="space-y-1">
                {mcp.map((s) => (
                  <div key={`${s.scope}:${s.name}`} className="flex items-center gap-2 text-xs">
                    <Server size={11} className="text-accent shrink-0" />
                    <span className="text-ink-100 truncate">{s.name}</span>
                    <span className="text-[9px] uppercase tracking-wide text-ink-500 border border-ink-700 rounded px-1">
                      {s.type}
                    </span>
                    <span className="text-[9px] text-ink-500 ml-auto">{s.scope}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="text-[10px] text-ink-500 leading-relaxed border-t border-ink-800 pt-3">
          <p className="mb-1">
            Specs live in <code className="text-ink-300">.kraken/specs/</code>.
          </p>
          <p>
            Agents and skills are read from <code className="text-ink-300">.claude/agents/</code> and{' '}
            <code className="text-ink-300">.claude/skills/</code> — the standard Claude Code locations, so existing definitions work as-is.
          </p>
        </section>
    </div>
  );

  if (variant === 'page') {
    return (
      <div className="h-full overflow-y-auto bg-ink-950">
        <div className="max-w-[900px] mx-auto px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 grid place-items-center rounded-xl bg-accent/12 text-accent shrink-0">
              <SettingsIcon size={19} />
            </div>
            <div>
              <h1 className="font-display text-[24px] font-bold text-ink-50 leading-tight">
                Settings
              </h1>
              <p className="font-mono text-[11px] text-faint">
                backend · models · permissions · integrations
              </p>
            </div>
          </div>
          {inner}
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarHeader title="Settings" />
      <div className="flex-1 overflow-y-auto p-3">{inner}</div>
    </>
  );
}

function BackendCard({
  selected,
  onClick,
  icon,
  title,
  description,
  recommended,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  recommended?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left p-2.5 rounded-lg border transition',
        selected
          ? 'border-accent bg-accent/10'
          : 'border-ink-800 bg-ink-900/40 hover:border-ink-700'
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={selected ? 'text-accent' : 'text-ink-300'}>{icon}</span>
        <span className="text-xs font-medium text-ink-50">{title}</span>
        {recommended && (
          <span className="text-[9px] uppercase tracking-wider text-accent bg-accent/15 px-1 py-0.5 rounded ml-auto">
            Best
          </span>
        )}
      </div>
      <div className="text-[10px] text-ink-400 leading-snug">{description}</div>
    </button>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  enabled,
  onToggle,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  tone?: 'warn';
}) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn('mt-0.5', tone === 'warn' ? 'text-warn' : 'text-accent')}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-ink-50">{title}</div>
        <div className="text-[10px] text-ink-400 leading-snug">{description}</div>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        role="switch"
        aria-checked={enabled}
        className={cn(
          'shrink-0 w-8 h-4 rounded-full transition relative',
          enabled
            ? tone === 'warn'
              ? 'bg-warn'
              : 'bg-accent'
            : 'bg-ink-700'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
            enabled ? 'left-4' : 'left-0.5'
          )}
        />
      </button>
    </div>
  );
}

function CliStatusPanel({
  status,
  onRedetect,
}: {
  status: CliStatus | null;
  onRedetect: () => void;
}) {
  if (status === null) {
    return (
      <div className="rounded-md border border-ink-800 bg-ink-900/60 p-3 text-xs text-ink-400">
        Checking for claude…
      </div>
    );
  }

  if (status.found) {
    return (
      <div className="rounded-md border border-ink-800 bg-ink-900/60 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-ok">
          <Check size={13} /> Claude CLI detected
        </div>
        <div className="text-[10px] text-ink-400 font-mono break-all">
          {status.binary}
          {status.version && (
            <>
              <br />
              <span className="text-ink-500">{status.version}</span>
            </>
          )}
        </div>
        <button
          onClick={onRedetect}
          className="text-[10px] text-accent hover:underline flex items-center gap-1"
        >
          <RefreshCw size={10} /> Re-detect
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-warn/30 bg-warn/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-warn">
        <AlertCircle size={13} /> Claude CLI not found
      </div>
      <p className="text-[10px] text-ink-300 leading-relaxed">
        Install it with npm, then run <code className="text-ink-100 bg-ink-800 px-1 rounded">claude</code> once to authenticate:
      </p>
      <pre className="text-[10px] font-mono bg-ink-950 border border-ink-800 rounded p-2 leading-relaxed overflow-x-auto">
{`npm install -g @anthropic-ai/claude-code
claude  # log in interactively`}
      </pre>
      <p className="text-[10px] text-ink-500 leading-relaxed">
        Or switch to the Anthropic API backend above. Re-detect after installing.
      </p>
      <button
        onClick={onRedetect}
        className="text-[10px] text-accent hover:underline flex items-center gap-1"
      >
        <RefreshCw size={10} /> Re-detect
      </button>
    </div>
  );
}

function ApiKeyHelp() {
  return (
    <div className="text-[10px] text-ink-300 leading-relaxed bg-ink-950/60 border border-ink-800 rounded-md p-2.5 space-y-2 mt-2">
      <ol className="list-decimal ml-4 space-y-1">
        <li>
          Open{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline inline-flex items-center gap-0.5"
          >
            console.anthropic.com/settings/keys <ExternalLink size={9} />
          </a>
          .
        </li>
        <li>Sign in or create an account.</li>
        <li>Click <b>Create Key</b>, give it a name, and copy the <code className="text-ink-100 bg-ink-800 px-1 rounded">sk-ant-…</code> value.</li>
        <li>Paste it above. It's encrypted with your OS keychain and never leaves your machine except to call Claude.</li>
      </ol>
      <p className="text-ink-500">
        Anthropic charges per token. For most users the local Claude CLI is cheaper.
      </p>
    </div>
  );
}
