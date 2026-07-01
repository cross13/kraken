import { useEffect, useState, useCallback, useRef } from 'react';
import {
  GitPullRequest,
  GitMerge,
  GitBranch,
  GitCommit,
  ExternalLink,
  Plus,
  RefreshCw,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Search,
  Sparkles,
  X,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Minus,
  FileText,
} from 'lucide-react';
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';
import { cn } from '../../lib/cn';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { useOrchestrator } from '../../stores/orchestrator';
import type {
  GitHubRepoInfo,
  GitHubTokenStatus,
  PullRequestMeta,
  SpecMeta,
} from '../../../electron/shared/types';

interface GitStatus {
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
}

type Filter = 'open' | 'all';

/** The spec backing the active editor tab, falling back to the last spec viewed
 *  (so the full-page Source Control tab still knows which spec you're on). */
function useActiveSpec(): SpecMeta | null {
  const activeTabId = useUi((s) => s.activeTabId);
  const tabs = useUi((s) => s.tabs);
  const lastSpecId = useUi((s) => s.lastSpecId);
  const specs = useWorkspace((s) => s.specs);
  const tab = tabs.find((t) => t.id === activeTabId);
  const id = tab?.kind === 'spec' ? tab.specId : lastSpecId;
  if (!id) return null;
  return specs.find((s) => s.id === id) ?? null;
}

export function SourceControlView({
  variant = 'panel',
}: { variant?: 'panel' | 'page' } = {}) {
  const root = useWorkspace((s) => s.root);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const spec = useActiveSpec();

  const [status, setStatus] = useState<GitStatus | null>(null);
  const [tokenStatus, setTokenStatus] = useState<GitHubTokenStatus | null>(null);
  const [repo, setRepo] = useState<GitHubRepoInfo | null>(null);
  const [prs, setPrs] = useState<PullRequestMeta[]>([]);
  const [filter, setFilter] = useState<Filter>('open');
  const [loadingPrs, setLoadingPrs] = useState(false);
  const [creating, setCreating] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!root) {
      setStatus(null);
      return;
    }
    const s = await window.kraken.git.status(root);
    setStatus(s);
  }, [root]);

  const refreshToken = useCallback(async () => {
    const s = await window.kraken.github.tokenStatus();
    setTokenStatus(s);
    return s;
  }, []);

  const loadPrs = useCallback(
    async (f: Filter) => {
      if (!root) return;
      setLoadingPrs(true);
      const info = await window.kraken.github.repoInfo(root);
      setRepo(info);
      if (!info.ok) {
        setPrs([]);
        setLoadingPrs(false);
        return;
      }
      const res = await window.kraken.github.listPrs({ cwd: root, state: f });
      setPrs(res.ok ? res.data ?? [] : []);
      setLoadingPrs(false);
    },
    [root]
  );

  useEffect(() => {
    refreshStatus();
    const t = setInterval(refreshStatus, 5000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  useEffect(() => {
    refreshToken().then((s) => {
      if (s.hasToken && s.valid) loadPrs(filter);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken, loadPrs]);

  if (!root) {
    if (variant === 'page') {
      return (
        <div className="h-full grid place-items-center bg-ink-950 px-6">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 mx-auto grid place-items-center rounded-2xl bg-accent/12 text-accent mb-4">
              <GitBranch size={22} />
            </div>
            <h3 className="font-display text-base font-semibold text-ink-50 mb-1.5">
              No project open
            </h3>
            <p className="text-[13px] text-dim leading-relaxed">
              Open a project directory to manage branches, commits, and pull requests.
            </p>
          </div>
        </div>
      );
    }
    return (
      <>
        <SidebarHeader title="Source Control" />
        <SidebarEmpty
          title="No project open"
          description="Open a project directory to manage branches, commits, and pull requests."
        />
      </>
    );
  }

  const doRefresh = () => {
    refreshStatus();
    refreshToken();
    loadPrs(filter);
  };
  const onChanged = () => {
    refreshStatus();
    refreshAll();
  };

  const statusEl = <StatusStrip status={status} spec={spec} />;
  const syncEl = <SyncSection root={root} status={status} onChanged={onChanged} />;
  const branchEl = <BranchSection root={root} spec={spec} status={status} onChanged={onChanged} />;
  const changesEl = <ChangesSection root={root} status={status} onChanged={onChanged} />;
  const commitEl = <CommitSection root={root} spec={spec} status={status} onChanged={onChanged} />;
  const prsEl = (
    <PullRequestSection
      root={root}
      spec={spec}
      repo={repo}
      tokenStatus={tokenStatus}
      prs={prs}
      filter={filter}
      loading={loadingPrs}
      onFilter={(f) => {
        setFilter(f);
        loadPrs(f);
      }}
      onTokenSaved={() => refreshToken().then(() => loadPrs(filter))}
      onCreate={() => setCreating(true)}
      onChanged={() => loadPrs(filter)}
    />
  );
  const dialogEl =
    creating && repo?.ok ? (
      <CreatePrDialog
        repo={repo}
        cwd={root}
        spec={spec}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          loadPrs(filter);
          refreshAll();
        }}
      />
    ) : null;

  if (variant === 'page') {
    const repoLabel = repo?.ok ? `${repo.owner}/${repo.repo}` : root.split('/').filter(Boolean).pop();
    return (
      <div className="h-full overflow-y-auto bg-ink-950">
        <div className="max-w-[1120px] mx-auto px-8 py-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 grid place-items-center rounded-xl bg-accent/12 text-accent shrink-0">
              <GitBranch size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[24px] font-bold text-ink-50 leading-tight">
                Source Control
              </h1>
              <p className="font-mono text-[11px] text-faint truncate">
                {repoLabel}
                {status?.branch ? ` · ${status.branch}` : ''}
                {spec ? ` · ${spec.name}` : ''}
              </p>
            </div>
            <button
              onClick={doRefresh}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-elev text-ink-100 hover:bg-line transition shrink-0"
            >
              <RefreshCw size={13} className={loadingPrs ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <div className="rounded-2xl bg-card overflow-hidden mb-5">{statusEl}</div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <div className="rounded-2xl bg-card overflow-hidden">
              {syncEl}
              {changesEl}
              {commitEl}
            </div>
            <div className="rounded-2xl bg-card overflow-hidden">
              {branchEl}
              {prsEl}
            </div>
          </div>
        </div>
        {dialogEl}
      </div>
    );
  }

  return (
    <>
      <SidebarHeader
        title="Source Control"
        actions={
          <SidebarButton title="Refresh" onClick={doRefresh}>
            <RefreshCw size={13} className={loadingPrs ? 'animate-spin' : ''} />
          </SidebarButton>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {statusEl}
        {syncEl}
        {branchEl}
        {changesEl}
        {commitEl}
        {prsEl}
      </div>
      {dialogEl}
    </>
  );
}

function StatusStrip({
  status,
  spec,
}: {
  status: GitStatus | null;
  spec: SpecMeta | null;
}) {
  return (
    <div className="px-3 py-2 border-b border-ink-800/60 space-y-1.5">
      {spec && (
        <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
          <span className="text-[9px] uppercase tracking-wider text-ink-500">Spec</span>
          <span className="text-ink-200 truncate">{spec.name}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {!status || !status.isRepo ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-warn/15 text-warn">
            not a git repo (initialised on first branch)
          </span>
        ) : (
          <>
            {status.branch && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink-800 text-ink-200 flex items-center gap-1">
                <GitBranch size={9} />
                {status.branch}
              </span>
            )}
            {status.hasChanges && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-warn/15 text-warn">
                {status.staged + status.unstaged + status.untracked} changed
              </span>
            )}
            {status.ahead > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                ↑{status.ahead}
              </span>
            )}
            {status.behind > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-bad/15 text-bad">
                ↓{status.behind}
              </span>
            )}
            {!status.hasOrigin && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-800 text-ink-400">
                no origin
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-3 py-3 border-b border-ink-800/60">
      <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-2">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function SyncSection({
  root,
  status,
  onChanged,
}: {
  root: string;
  status: GitStatus | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<'pull' | 'push' | 'fetch' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!status?.isRepo) return null;

  const hasOrigin = status.hasOrigin;
  const { ahead, behind, upstream } = status;

  const run = async (
    kind: 'pull' | 'push' | 'fetch',
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okNote: string
  ) => {
    setBusy(kind);
    setErr(null);
    setNote(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) {
      setErr(res.error ?? `${kind} failed.`);
      return;
    }
    setNote(okNote);
    onChanged();
  };

  return (
    <Section icon={<RefreshCw size={12} />} title="Sync">
      {!hasOrigin ? (
        <p className="text-[11px] text-ink-500 leading-snug">
          No <code className="text-ink-400">origin</code> remote. Add one (or open a PR,
          which pushes the branch) to pull and push changes.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 text-[11px] mb-2">
            {upstream ? (
              <span className="text-ink-400 font-mono truncate">{upstream}</span>
            ) : (
              <span className="text-ink-500">no upstream yet</span>
            )}
            <span className="ml-auto flex items-center gap-1.5">
              {behind > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-bad/15 text-bad">↓{behind}</span>
              )}
              {ahead > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent">↑{ahead}</span>
              )}
              {upstream && ahead === 0 && behind === 0 && (
                <span className="flex items-center gap-1 text-ok">
                  <Check size={11} /> up to date
                </span>
              )}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <SyncButton
              onClick={() => run('pull', () => window.kraken.git.pull(root), 'Pulled.')}
              busy={busy === 'pull'}
              disabled={!!busy}
              primary={behind > 0}
              icon={<ArrowDownToLine size={12} />}
              label="Pull"
              count={behind}
            />
            <SyncButton
              onClick={() => run('push', () => window.kraken.git.push(root), 'Pushed.')}
              busy={busy === 'push'}
              disabled={!!busy}
              primary={ahead > 0}
              icon={<ArrowUpFromLine size={12} />}
              label="Push"
              count={ahead}
            />
            <SyncButton
              onClick={() =>
                run('fetch', () => window.kraken.git.fetch(root), 'Fetched.')
              }
              busy={busy === 'fetch'}
              disabled={!!busy}
              icon={<RefreshCw size={12} />}
              label="Fetch"
            />
          </div>
        </>
      )}

      {note && !err && (
        <div className="mt-1.5 text-[10px] text-ok flex items-center gap-1">
          <Check size={10} /> {note}
        </div>
      )}
      {err && (
        <div className="mt-1.5 text-[10px] text-bad flex items-start gap-1">
          <AlertCircle size={11} className="mt-0.5 shrink-0" />
          <span className="leading-snug">{err}</span>
        </div>
      )}
    </Section>
  );
}

function SyncButton({
  onClick,
  busy,
  disabled,
  primary,
  icon,
  label,
  count,
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  primary?: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition disabled:opacity-40',
        primary
          ? 'bg-accent text-accent-fg hover:opacity-90'
          : 'bg-ink-800 text-ink-100 hover:bg-ink-700'
      )}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : icon}
      {label}
      {!!count && count > 0 && (
        <span className={cn('font-mono', primary ? 'opacity-90' : 'text-ink-400')}>
          {count}
        </span>
      )}
    </button>
  );
}

interface BranchInfo {
  name: string;
  current: boolean;
  upstream?: string;
}

function BranchSection({
  root,
  spec,
  status,
  onChanged,
}: {
  root: string;
  spec: SpecMeta | null;
  status: GitStatus | null;
  onChanged: () => void;
}) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // branch name being switched, or '__new__'
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const onBranch = status?.branch ?? null;

  const loadBranches = useCallback(async () => {
    const res = await window.kraken.git.listBranches(root);
    setBranches(res.ok ? res.branches : []);
  }, [root]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches, onBranch]);

  const suggestedNew = spec ? `kraken/${spec.id}` : '';

  const switchTo = async (name: string) => {
    if (name === onBranch) return;
    setBusy(name);
    setErr(null);
    const res = await window.kraken.git.checkout({
      workspacePath: root,
      specId: spec?.id,
      branch: name,
    });
    setBusy(null);
    if (!res.ok) {
      setErr(res.error ?? 'Failed to switch branch.');
      return;
    }
    await loadBranches();
    onChanged();
  };

  const createBranch = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy('__new__');
    setErr(null);
    const res = await window.kraken.git.createBranch({
      workspacePath: root,
      specId: spec?.id,
      branch: name,
    });
    setBusy(null);
    if (!res.ok) {
      setErr(res.error ?? 'Failed to create branch.');
      return;
    }
    setCreating(false);
    setNewName('');
    await loadBranches();
    onChanged();
  };

  const filtered = branches.filter((b) =>
    b.name.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <Section icon={<GitBranch size={12} />} title="Branches">
      {onBranch ? (
        <div className="flex items-center gap-1.5 text-[11px] text-ink-300 mb-2">
          <CheckCircle2 size={12} className="text-ok shrink-0" />
          <span className="text-ink-400">On</span>
          <code className="font-mono text-ink-100 truncate">{onBranch}</code>
        </div>
      ) : (
        <div className="text-[11px] text-ink-500 mb-2">
          {status?.isRepo === false
            ? 'Not a git repo yet — create a branch to initialise one.'
            : 'Detached HEAD.'}
        </div>
      )}

      {branches.length > 5 && (
        <div className="relative mb-1.5">
          <Search
            size={11}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter branches…"
            className="w-full text-[11px] pl-6 pr-2 py-1 rounded-md bg-ink-950 border border-ink-800 focus:border-accent outline-none"
          />
        </div>
      )}

      {branches.length > 0 && (
        <div className="rounded-md border border-ink-800 bg-ink-950/60 max-h-48 overflow-y-auto divide-y divide-ink-800/60">
          {filtered.length === 0 ? (
            <div className="text-[11px] text-ink-500 px-2 py-2">No matches.</div>
          ) : (
            filtered.map((b) => (
              <button
                key={b.name}
                onClick={() => switchTo(b.name)}
                disabled={!!busy || b.current}
                title={b.current ? 'Current branch' : `Switch to ${b.name}`}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 text-left text-[12px] transition group',
                  b.current
                    ? 'bg-accent/10 text-ink-50 cursor-default'
                    : 'text-ink-200 hover:bg-ink-800/60 disabled:opacity-50'
                )}
              >
                <GitBranch
                  size={11}
                  className={cn('shrink-0', b.current ? 'text-accent' : 'text-ink-500')}
                />
                <span className="font-mono truncate flex-1 min-w-0">{b.name}</span>
                {b.upstream && (
                  <span className="text-[9px] text-ink-600 truncate shrink-0">
                    {b.upstream}
                  </span>
                )}
                {busy === b.name ? (
                  <Loader2 size={11} className="animate-spin text-accent shrink-0" />
                ) : b.current ? (
                  <Check size={12} className="text-accent shrink-0" />
                ) : (
                  <ChevronRight
                    size={12}
                    className="text-ink-600 opacity-0 group-hover:opacity-100 shrink-0"
                  />
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* Create new branch */}
      {creating ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createBranch();
              if (e.key === 'Escape') {
                setCreating(false);
                setNewName('');
              }
            }}
            placeholder={suggestedNew || 'feature/branch-name'}
            className="flex-1 min-w-0 text-[12px] font-mono px-2 py-1 rounded-md bg-ink-950 border border-ink-800 focus:border-accent outline-none"
          />
          <button
            onClick={createBranch}
            disabled={!newName.trim() || busy === '__new__'}
            className="shrink-0 text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40"
          >
            {busy === '__new__' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Plus size={11} />
            )}
            Create
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName('');
            }}
            className="shrink-0 text-ink-500 hover:text-ink-100 p-1"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setCreating(true);
            setNewName(suggestedNew);
          }}
          className="mt-2 w-full text-[11px] flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md border border-dashed border-ink-700 text-ink-300 hover:text-ink-50 hover:border-ink-600 hover:bg-ink-800/40 transition"
        >
          <Plus size={11} /> New branch
        </button>
      )}

      {err && (
        <div className="mt-1.5 text-[10px] text-bad flex items-start gap-1">
          <AlertCircle size={11} className="mt-0.5 shrink-0" />
          {err}
        </div>
      )}
    </Section>
  );
}

interface ChangedFile {
  path: string;
  status: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

/** Letter + colour for a porcelain status character. */
function codeMeta(c: string): { letter: string; color: string } {
  switch (c) {
    case 'M':
      return { letter: 'M', color: 'text-warn' };
    case 'A':
      return { letter: 'A', color: 'text-ok' };
    case 'D':
      return { letter: 'D', color: 'text-bad' };
    case 'R':
      return { letter: 'R', color: 'text-accent' };
    case 'C':
      return { letter: 'C', color: 'text-accent' };
    case 'U':
      return { letter: 'U', color: 'text-bad' };
    case '?':
      return { letter: 'U', color: 'text-ok' };
    default:
      return { letter: c.trim() || '•', color: 'text-ink-400' };
  }
}

function ChangesSection({
  root,
  status,
  onChanged,
}: {
  root: string;
  status: GitStatus | null;
  onChanged: () => void;
}) {
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await window.kraken.git.listChanges(root);
    setFiles(res.ok ? res.files : []);
  }, [root]);

  useEffect(() => {
    load();
  }, [load, status?.staged, status?.unstaged, status?.untracked]);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setErr(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Operation failed.');
      return;
    }
    await load();
    onChanged();
  };

  const stage = (paths: string[]) =>
    act(() => window.kraken.git.stage({ workspacePath: root, paths }));
  const unstage = (paths: string[]) =>
    act(() => window.kraken.git.unstage({ workspacePath: root, paths }));

  if (status?.isRepo === false) return null;

  const staged = files.filter((f) => f.staged);
  const unstaged = files.filter((f) => f.unstaged);

  if (files.length === 0) {
    return (
      <Section icon={<FileText size={12} />} title="Changes">
        <p className="text-[11px] text-ink-500">Working tree clean — nothing to commit.</p>
      </Section>
    );
  }

  return (
    <Section icon={<FileText size={12} />} title="Changes">
      {staged.length > 0 && (
        <FileGroup
          label="Staged"
          count={staged.length}
          actionLabel="Unstage all"
          onAction={() => unstage(staged.map((f) => f.path))}
          actionDisabled={busy}
        >
          {staged.map((f) => {
            const m = codeMeta(f.status[0]);
            return (
              <FileRow
                key={`s:${f.path}`}
                path={f.path}
                letter={m.letter}
                color={m.color}
                onClick={() => unstage([f.path])}
                actionIcon={<Minus size={12} />}
                actionTitle="Unstage"
                disabled={busy}
              />
            );
          })}
        </FileGroup>
      )}

      {unstaged.length > 0 && (
        <div className={staged.length > 0 ? 'mt-2' : ''}>
          <FileGroup
            label="Unstaged"
            count={unstaged.length}
            actionLabel="Stage all"
            onAction={() => stage(unstaged.map((f) => f.path))}
            actionDisabled={busy}
          >
            {unstaged.map((f) => {
              const m = codeMeta(f.untracked ? '?' : f.status[1]);
              return (
                <FileRow
                  key={`u:${f.path}`}
                  path={f.path}
                  letter={m.letter}
                  color={m.color}
                  onClick={() => stage([f.path])}
                  actionIcon={<Plus size={12} />}
                  actionTitle="Stage"
                  disabled={busy}
                />
              );
            })}
          </FileGroup>
        </div>
      )}

      {err && (
        <div className="mt-1.5 text-[10px] text-bad flex items-start gap-1">
          <AlertCircle size={11} className="mt-0.5 shrink-0" />
          {err}
        </div>
      )}
    </Section>
  );
}

function FileGroup({
  label,
  count,
  actionLabel,
  onAction,
  actionDisabled,
  children,
}: {
  label: string;
  count: number;
  actionLabel: string;
  onAction: () => void;
  actionDisabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[9px] uppercase tracking-wider text-ink-500 font-semibold">
          {label}
        </span>
        <span className="text-[9px] text-ink-600">{count}</span>
        <button
          onClick={onAction}
          disabled={actionDisabled}
          className="ml-auto text-[10px] text-accent hover:underline disabled:opacity-40"
        >
          {actionLabel}
        </button>
      </div>
      <div className="rounded-md border border-ink-800 bg-ink-950/60 max-h-40 overflow-y-auto divide-y divide-ink-800/40">
        {children}
      </div>
    </div>
  );
}

function FileRow({
  path,
  letter,
  color,
  onClick,
  actionIcon,
  actionTitle,
  disabled,
}: {
  path: string;
  letter: string;
  color: string;
  onClick: () => void;
  actionIcon: React.ReactNode;
  actionTitle: string;
  disabled: boolean;
}) {
  const name = path.split('/').pop() ?? path;
  const dir = path.slice(0, path.length - name.length).replace(/\/$/, '');
  return (
    <div className="flex items-center gap-1.5 px-1.5 py-1 group hover:bg-ink-800/40">
      <span className={cn('w-3 text-center font-mono text-[11px] shrink-0', color)}>{letter}</span>
      <span className="truncate flex-1 min-w-0 text-[11px]" title={path}>
        <span className="text-ink-100">{name}</span>
        {dir && <span className="text-ink-600 ml-1">{dir}</span>}
      </span>
      <button
        onClick={onClick}
        disabled={disabled}
        title={actionTitle}
        className="shrink-0 text-ink-500 hover:text-accent opacity-0 group-hover:opacity-100 disabled:opacity-30 p-0.5"
      >
        {actionIcon}
      </button>
    </div>
  );
}

function CommitSection({
  root,
  spec,
  status,
  onChanged,
}: {
  root: string;
  spec: SpecMeta | null;
  status: GitStatus | null;
  onChanged: () => void;
}) {
  const suggested = spec
    ? `${spec.kind === 'bugfix' ? 'fix' : 'feat'}: ${spec.name}`
    : '';
  const [msg, setMsg] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setMsg(
      spec ? `${spec.kind === 'bugfix' ? 'fix' : 'feat'}: ${spec.name}` : ''
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec?.id]);

  const hasChanges = status?.hasChanges ?? false;
  const stagedCount = status?.staged ?? 0;
  const willPush = status?.hasOrigin !== false;
  // Commit staged files when any are staged; otherwise fall back to committing
  // everything (stage-all) so the button still works without manual staging.
  const commitAll = stagedCount === 0;

  const run = async () => {
    setBusy(true);
    setErr(null);
    setDone(null);
    const res = await window.kraken.git.commitPush({
      workspacePath: root,
      specId: spec?.id,
      message: msg.trim() || 'chore: update',
      push: willPush,
      stageAll: commitAll,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Failed to commit.');
      return;
    }
    setDone(res.commitHash ? res.commitHash.slice(0, 7) : 'committed');
    onChanged();
  };

  const verb = willPush ? 'Commit & push' : 'Commit';
  const label = commitAll ? `${verb} all` : `${verb} ${stagedCount} staged`;

  return (
    <Section icon={<GitCommit size={12} />} title="Commit">
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        disabled={busy}
        rows={2}
        placeholder="Commit message"
        className="w-full text-[12px] font-mono px-2 py-1.5 rounded-md bg-ink-950 border border-ink-800 focus:border-accent outline-none resize-none"
      />
      <div className="flex items-center gap-2 mt-1.5">
        <button
          onClick={run}
          disabled={!msg.trim() || busy || !hasChanges}
          className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <GitCommit size={11} />
          )}
          {label}
        </button>
        {!hasChanges && (
          <span className="text-[10px] text-ink-500">No changes to commit.</span>
        )}
        {hasChanges && commitAll && (
          <span className="text-[10px] text-ink-500">nothing staged — commits all</span>
        )}
        {done && (
          <span className="text-[10px] text-ok flex items-center gap-1">
            <Check size={10} /> {done}
          </span>
        )}
      </div>
      {err && (
        <div className="mt-1.5 text-[10px] text-bad flex items-start gap-1">
          <AlertCircle size={11} className="mt-0.5 shrink-0" />
          {err}
        </div>
      )}
    </Section>
  );
}

function PullRequestSection({
  root,
  spec,
  repo,
  tokenStatus,
  prs,
  filter,
  loading,
  onFilter,
  onTokenSaved,
  onCreate,
  onChanged,
}: {
  root: string;
  spec: SpecMeta | null;
  repo: GitHubRepoInfo | null;
  tokenStatus: GitHubTokenStatus | null;
  prs: PullRequestMeta[];
  filter: Filter;
  loading: boolean;
  onFilter: (f: Filter) => void;
  onTokenSaved: () => void;
  onCreate: () => void;
  onChanged: () => void;
}) {
  // Highlight the PR matching the active spec / current branch.
  const activeBranch = spec?.branch ?? repo?.branch ?? null;

  return (
    <Section icon={<GitPullRequest size={12} />} title="Pull Requests">
      {!tokenStatus ? (
        <div className="text-[11px] text-ink-500 flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin" /> Checking GitHub…
        </div>
      ) : !tokenStatus.hasToken ? (
        <TokenSetup onSaved={onTokenSaved} />
      ) : tokenStatus.valid === false ? (
        <>
          <div className="rounded-md border border-bad/30 bg-bad/5 p-2 text-[11px] text-bad flex items-start gap-1.5 mb-2">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>GitHub token rejected: {tokenStatus.error}</span>
          </div>
          <TokenSetup replace onSaved={onTokenSaved} />
        </>
      ) : repo && !repo.ok ? (
        <p className="text-[11px] text-ink-400 leading-snug">
          {repo.error} Add a github.com <code className="text-ink-300">origin</code>{' '}
          remote to open pull requests.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              {(['open', 'all'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => onFilter(f)}
                  className={cn(
                    'text-[11px] px-2 py-0.5 rounded-md capitalize',
                    filter === f
                      ? 'bg-accent/20 text-ink-50'
                      : 'text-ink-400 hover:bg-ink-800/60'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={onCreate}
              className="text-[11px] flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-800 text-ink-100 hover:bg-ink-700"
            >
              <Plus size={11} /> New PR
            </button>
          </div>

          {tokenStatus.login && (
            <div className="text-[10px] text-ink-500 mb-2">
              {repo?.ok && (
                <span className="font-mono text-ink-400">
                  {repo.owner}/{repo.repo}
                </span>
              )}{' '}
              · @{tokenStatus.login}
            </div>
          )}

          {loading && prs.length === 0 ? (
            <div className="text-[11px] text-ink-400 flex items-center gap-1.5 py-2">
              <Loader2 size={11} className="animate-spin" /> Loading…
            </div>
          ) : prs.length === 0 ? (
            <p className="text-[11px] text-ink-500 py-1">
              {filter === 'open' ? 'No open pull requests.' : 'No pull requests.'}
            </p>
          ) : (
            <div className="space-y-1">
              {prs.map((pr) => (
                <PrCard
                  key={pr.number}
                  pr={pr}
                  cwd={root}
                  specId={spec?.id}
                  highlight={!!activeBranch && pr.head === activeBranch}
                  onChanged={onChanged}
                />
              ))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function PrCard({
  pr,
  cwd,
  specId,
  highlight,
  onChanged,
}: {
  pr: PullRequestMeta;
  cwd: string;
  specId?: string;
  highlight?: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const state = pr.merged ? 'merged' : pr.state;
  const stateStyle =
    state === 'merged'
      ? 'bg-purple-500/15 text-purple-300'
      : state === 'open'
        ? 'bg-ok/15 text-ok'
        : 'bg-ink-700 text-ink-300';

  const merge = async () => {
    setBusy(true);
    setErr(null);
    const res = await window.kraken.github.mergePr({
      cwd,
      specId,
      number: pr.number,
      method: 'squash',
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Merge failed.');
      return;
    }
    onChanged();
  };

  return (
    <div
      className={cn(
        'rounded-md border bg-ink-900/40 p-2.5 transition',
        highlight ? 'border-accent/50' : 'border-ink-800 hover:border-ink-700'
      )}
    >
      <div className="flex items-start gap-2">
        <GitPullRequest
          size={13}
          className={cn('mt-0.5 shrink-0', state === 'open' ? 'text-ok' : 'text-ink-400')}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-ink-500 font-mono">#{pr.number}</span>
            <span className={cn('text-[9px] px-1 py-0.5 rounded capitalize', stateStyle)}>
              {state}
            </span>
            {pr.draft && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-ink-700 text-ink-300">
                draft
              </span>
            )}
          </div>
          <div className="text-xs text-ink-100 font-medium leading-snug mt-0.5 truncate">
            {pr.title}
          </div>
          <div className="text-[10px] text-ink-500 font-mono mt-1 truncate">
            {pr.head} → {pr.base}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 pl-5">
        <a
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-accent hover:underline inline-flex items-center gap-0.5"
        >
          Open <ExternalLink size={9} />
        </a>
        {state === 'open' && !pr.draft && (
          <button
            onClick={merge}
            disabled={busy}
            className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <GitMerge size={10} />
            )}
            Squash & merge
          </button>
        )}
      </div>
      {err && (
        <div className="mt-1.5 pl-5 text-[10px] text-bad flex items-start gap-1">
          <AlertCircle size={10} className="mt-0.5 shrink-0" />
          {err}
        </div>
      )}
    </div>
  );
}

/**
 * Typeahead for the PR base branch. Filters the repo's remote branches as the
 * user types, supports arrow-key/Enter selection, and still allows free text for
 * a branch not in the fetched list. The default branch is tagged and pre-selected.
 */
function BranchCombobox({
  value,
  onChange,
  branches,
  defaultBranch,
  exclude,
}: {
  value: string;
  onChange: (v: string) => void;
  branches: string[];
  defaultBranch: string;
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurRef = useRef<number | null>(null);

  const candidates = branches.filter((b) => b !== exclude);
  const q = value.trim().toLowerCase();
  const matches = q ? candidates.filter((b) => b.toLowerCase().includes(q)) : candidates;

  const pick = (b: string) => {
    onChange(b);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurRef.current = window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        placeholder="base branch…"
        className="px-1.5 py-0.5 rounded bg-ink-900 border border-ink-800 focus:border-accent outline-none w-40"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-10 left-0 mt-1 w-48 max-h-48 overflow-y-auto rounded-md border border-ink-800 bg-ink-950 shadow-xl py-1">
          {matches.map((b, i) => (
            <li key={b}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(b);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] font-mono',
                  i === active ? 'bg-ink-800 text-ink-50' : 'text-ink-300'
                )}
              >
                <GitBranch size={10} className="shrink-0 text-ink-500" />
                <span className="truncate flex-1">{b}</span>
                {b === value && <Check size={11} className="text-accent shrink-0" />}
                {b === defaultBranch && (
                  <span className="text-[9px] uppercase tracking-wider text-ink-400 px-1 rounded border border-ink-700">
                    default
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreatePrDialog({
  repo,
  cwd,
  spec,
  onClose,
  onCreated,
}: {
  repo: GitHubRepoInfo;
  cwd: string;
  spec: SpecMeta | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const head = spec?.branch ?? repo.branch ?? '';
  const defaultBranch = repo.defaultBranch ?? 'main';
  const [title, setTitle] = useState(
    spec ? `${spec.kind === 'bugfix' ? 'fix' : 'feat'}: ${spec.name}` : head
  );
  const [body, setBody] = useState(spec ? `Pull request for spec \`${spec.id}\`.` : '');
  // Base = the branch we merge into. Default to the repo's actual default branch.
  const [base, setBase] = useState(defaultBranch);
  const [branches, setBranches] = useState<string[]>([]);
  const [draft, setDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);
  // Live stream cleanup for the description generator — cancel if the dialog closes mid-run.
  const genReqRef = useRef<string | null>(null);
  const genOffRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      genOffRef.current?.();
      if (genReqRef.current) void window.kraken.claude.cancel(genReqRef.current);
    },
    []
  );

  // Load the remote branches (valid PR targets) for the base typeahead.
  useEffect(() => {
    let alive = true;
    window.kraken.github.listBranches(cwd).then((res) => {
      if (!alive || !res.ok || !res.data) return;
      setBranches(res.data);
      // Keep the actual default branch selected when it exists on the remote;
      // otherwise fall back to the first available branch.
      if (!res.data.includes(base)) {
        setBase(res.data.includes(defaultBranch) ? defaultBranch : res.data[0] ?? base);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const res = await window.kraken.github.createPr({
      cwd,
      specId: spec?.id,
      title: title.trim(),
      body,
      base: base.trim(),
      head,
      draft,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Failed to create pull request.');
      return;
    }
    onCreated();
  };

  // Ask Claude to draft the PR description from the spec's content, streaming
  // straight into the Description field.
  const generateBody = async () => {
    if (!spec || generating) return;
    setGenerating(true);
    setErr(null);

    let files: Record<string, string> = {};
    try {
      files = (await window.kraken.specs.read(cwd, spec.id)).files;
    } catch {
      // Non-fatal — the CLI backend can still read the files from disk itself.
    }
    const reqKey = spec.kind === 'bugfix' ? 'bugfix' : 'requirements';
    const specBody = [
      files[reqKey] && `## ${reqKey}.md\n\n${files[reqKey]}`,
      files.design && `## design.md\n\n${files.design}`,
      files.tasks && `## tasks.md\n\n${files.tasks}`,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');

    const requestId = crypto.randomUUID();
    genReqRef.current = requestId;
    setBody('');
    startRun({
      requestId,
      agent: null,
      source: 'pr-description',
      kind: 'spec',
      title: `PR description · ${spec.name}`,
      specId: spec.id,
      startedAt: Date.now(),
      status: 'running',
    });

    const off = window.kraken.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) setBody((b) => b + ev.text);
      if (ev.type === 'done') {
        off();
        genOffRef.current = null;
        genReqRef.current = null;
        setGenerating(false);
        finishRun(requestId, 'done');
      }
      if (ev.type === 'error') {
        off();
        genOffRef.current = null;
        genReqRef.current = null;
        setGenerating(false);
        setErr(ev.error ?? 'Failed to generate description.');
        finishRun(requestId, 'error');
      }
    });
    genOffRef.current = off;

    const system =
      'You write concise, well-structured GitHub pull request descriptions in GitHub-flavored Markdown. ' +
      'Summarize what the change does and why, grounded in the spec provided. Use short sections ' +
      '(e.g. **Summary**, **Changes**, **Testing**) with bullet points. Output only the PR body — no ' +
      'H1/title, and do not wrap the whole response in a code fence.';
    const userText =
      `Write a pull request description for the ${spec.kind} spec "${spec.name}" ` +
      `(merging \`${head}\` → \`${base}\`).\n\n` +
      (specBody
        ? `Base it on this spec:\n\n${specBody}`
        : `The spec files could not be read here — read \`${spec.path}\` in the workspace and summarize the change.`);

    window.kraken.claude.stream({
      requestId,
      system,
      messages: [{ role: 'user', content: userText }],
      cwd,
      source: 'pr-description',
      specId: spec.id,
      kind: 'spec',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-ink-950 border border-ink-800 shadow-xl p-4 space-y-2.5 max-h-[85%] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <GitPullRequest size={14} className="text-ok" />
          <h3 className="text-xs font-semibold text-ink-50">New pull request</h3>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-ink-400 font-mono">
          <span className="px-1.5 py-0.5 rounded bg-ink-800 text-ink-200">
            {head || '(no branch)'}
          </span>
          →
          <BranchCombobox
            value={base}
            onChange={setBase}
            branches={branches}
            defaultBranch={defaultBranch}
            exclude={head}
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-ink-400">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short summary"
            className="w-full mt-1 text-xs px-2 py-1.5 rounded-md bg-ink-900 border border-ink-800 focus:border-accent outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-ink-400">
              Description
            </label>
            {spec && (
              <button
                type="button"
                onClick={generateBody}
                disabled={generating}
                title="Generate a PR description from the spec with Claude"
                className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded text-accent hover:bg-accent/10 disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Sparkles size={11} />
                )}
                {generating ? 'Generating…' : 'Generate with Claude'}
              </button>
            )}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="What does this change and why?"
            className="w-full mt-1 text-xs px-2 py-1.5 rounded-md bg-ink-900 border border-ink-800 focus:border-accent outline-none resize-none font-mono"
          />
        </div>

        <label className="flex items-center gap-2 text-[11px] text-ink-300">
          <input
            type="checkbox"
            checked={draft}
            onChange={(e) => setDraft(e.target.checked)}
            className="accent-accent"
          />
          Create as draft
        </label>

        {err && (
          <div className="rounded-md border border-bad/30 bg-bad/5 p-2 text-[11px] text-bad flex items-start gap-1.5">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {err}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={submit}
            disabled={!title.trim() || !base.trim() || !head || busy}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Creating…
              </>
            ) : (
              <>
                <Plus size={12} /> Create pull request
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md text-ink-300 hover:bg-ink-800"
          >
            Cancel
          </button>
        </div>
        <p className="text-[10px] text-ink-500 leading-snug">
          Kraken pushes <code className="text-ink-300">{head || 'the branch'}</code> to
          origin before opening the PR.
        </p>
      </div>
    </div>
  );
}

function TokenSetup({
  onSaved,
  replace,
}: {
  onSaved: () => void;
  replace?: boolean;
}) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!token.trim()) return;
    setBusy(true);
    await window.kraken.github.setToken(token.trim());
    setToken('');
    setBusy(false);
    onSaved();
  };

  return (
    <div className="space-y-2">
      {!replace && (
        <div className="flex items-start gap-2 text-[11px] text-ink-400 leading-snug">
          <KeyRound size={13} className="text-accent mt-0.5 shrink-0" />
          <span>Connect a GitHub token to create and manage pull requests.</span>
        </div>
      )}
      <input
        type="password"
        placeholder="ghp_… or github_pat_…"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        className="w-full text-xs px-2 py-1.5 rounded-md bg-ink-950 border border-ink-800 focus:border-accent outline-none font-mono"
      />
      <button
        onClick={save}
        disabled={!token.trim() || busy}
        className="w-full text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        {replace ? 'Replace token' : 'Save token'}
      </button>
      <details className="text-[10px] text-ink-400">
        <summary className="cursor-pointer hover:text-ink-200">
          How do I create a token?
        </summary>
        <ol className="list-decimal ml-4 mt-2 space-y-1 leading-relaxed">
          <li>
            Open{' '}
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline inline-flex items-center gap-0.5"
            >
              github.com/settings/tokens <ExternalLink size={9} />
            </a>
            .
          </li>
          <li>
            Grant the <code className="text-ink-200">repo</code> scope (classic) or{' '}
            <b>Pull requests: read &amp; write</b> + <b>Contents: read</b> (fine-grained).
          </li>
          <li>Paste it above — it's encrypted with your OS keychain.</li>
        </ol>
      </details>
    </div>
  );
}
