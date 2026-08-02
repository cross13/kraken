import { useEffect, useState } from 'react';
import {
  PartyPopper,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Loader2,
  Sparkles,
  ExternalLink,
  RotateCcw,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { CompletionSummary } from './CompletionSummary';
import { polishSpec } from '../../lib/specActions';
import { cn } from '../../lib/cn';
import type { SpecMeta } from '../../../electron/shared/types';

interface GitState {
  isRepo: boolean;
  branch: string | null;
  hasChanges: boolean;
  hasOrigin: boolean;
}

/**
 * Ship — the automatic completion payoff. Summary auto-generates on arrival
 * (it becomes the PR body), changed files open as diffs via the repo panel,
 * and branch → commit → PR live right here. "Last task green" to "PR open"
 * without leaving the spec.
 */
export function ShipView({ meta, onReopen }: { meta: SpecMeta; onReopen: () => void }) {
  const root = useWorkspace((s) => s.root)!;
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const openOverlay = useUi((s) => s.openOverlay);
  const setAssistantOpen = useUi((s) => s.setAssistantOpen);

  const specRel = meta.path.replace(root + '/', '');
  const [git, setGit] = useState<GitState | null>(null);
  const [summaryText, setSummaryText] = useState('');
  const [busy, setBusy] = useState<null | 'branch' | 'commit' | 'pr' | 'polish'>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(meta.prUrl ?? null);
  const [hasGithub, setHasGithub] = useState(false);

  const readGit = () =>
    window.kraken.git
      .status(root)
      .then((s) =>
        setGit({ isRepo: s.isRepo, branch: s.branch, hasChanges: s.hasChanges, hasOrigin: s.hasOrigin })
      )
      .catch(() => setGit(null));

  useEffect(() => {
    readGit();
    window.kraken.github.hasToken().then(setHasGithub).catch(() => setHasGithub(false));
    const t = setInterval(readGit, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);

  const suggestedBranch = `feat/${meta.id}`;
  const onProtectedBranch = git?.branch === 'main' || git?.branch === 'master';

  const createBranch = async () => {
    setBusy('branch');
    setNotice(null);
    try {
      const res = await window.kraken.git.createBranch({
        workspacePath: root,
        specId: meta.id,
        branch: meta.branch ?? suggestedBranch,
      });
      setNotice(
        res.ok
          ? { tone: 'ok', text: `On branch ${res.branch ?? suggestedBranch}` }
          : { tone: 'bad', text: res.error ?? 'Could not create the branch' }
      );
      await readGit();
      await refreshAll();
    } finally {
      setBusy(null);
    }
  };

  const commitMessage = () => {
    const firstLine = summaryText
      .split('\n')
      .map((l) => l.replace(/^[#*\-\s]+/, '').trim())
      .find((l) => l.length > 8);
    const prefix = meta.kind === 'feature' ? 'feat' : 'fix';
    return `${prefix}: ${meta.name}${firstLine ? `\n\n${firstLine}` : ''}`;
  };

  const commitAll = async () => {
    setBusy('commit');
    setNotice(null);
    try {
      const res = await window.kraken.git.commitPush({
        workspacePath: root,
        specId: meta.id,
        message: commitMessage(),
        stageAll: true,
        push: git?.hasOrigin ?? false,
      });
      setNotice(
        res.ok
          ? res.nothingToCommit
            ? { tone: 'ok', text: 'Nothing to commit — the tree is clean' }
            : {
                tone: 'ok',
                text: `Committed${res.pushed ? ' and pushed' : ''}${
                  res.commitHash ? ` (${res.commitHash.slice(0, 7)})` : ''
                }`,
              }
          : { tone: 'bad', text: res.error ?? 'Commit failed' }
      );
      await readGit();
      await refreshAll();
    } finally {
      setBusy(null);
    }
  };

  const createPr = async () => {
    setBusy('pr');
    setNotice(null);
    try {
      const res = await window.kraken.github.createPr({
        cwd: root,
        specId: meta.id,
        title: `${meta.kind === 'feature' ? 'feat' : 'fix'}: ${meta.name}`,
        body: summaryText || `Completes the ${meta.kind} spec "${meta.name}".`,
        push: true,
      });
      if (res.ok && res.data) {
        setPrUrl(res.data.url);
        setNotice({ tone: 'ok', text: `PR #${res.data.number} opened` });
      } else {
        setNotice({ tone: 'bad', text: res.error ?? 'Could not create the pull request' });
      }
      await refreshAll();
    } finally {
      setBusy(null);
    }
  };

  const polish = async () => {
    setBusy('polish');
    setAssistantOpen(true);
    try {
      await polishSpec(meta);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="k-wide py-6 space-y-5">
        {/* celebration header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 grid place-items-center rounded-xl bg-good/15 text-ok shrink-0">
            <PartyPopper size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-[18px] font-semibold text-ink-50 leading-tight">
              All tasks complete
            </h2>
            <p className="text-[12px] text-faint">
              Review the summary and the changed files, then ship it — the summary becomes the PR
              body.
            </p>
          </div>
          <button
            onClick={polish}
            disabled={busy === 'polish'}
            title="One last critical review pass — genuine problems get fixed directly"
            className="shrink-0 flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-elev text-ink-100 hover:bg-line transition disabled:opacity-50"
          >
            {busy === 'polish' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            Polish
          </button>
          <button
            onClick={onReopen}
            title="Reopen the Tasks phase to re-sync the spec with the code"
            className="shrink-0 flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg text-dim hover:text-ink-50 hover:bg-elev transition"
          >
            <RotateCcw size={12} /> Reopen tasks
          </button>
        </div>

        {/* summary + changed files (auto-generates on arrival) */}
        <CompletionSummary meta={meta} specRel={specRel} auto onSummary={setSummaryText} />

        {/* ship actions */}
        <div className="rounded-xl bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">
              Ship
            </h3>
            {git && !git.isRepo && (
              <span className="text-[11px] text-faint">— not a git repository</span>
            )}
          </div>

          {git?.isRepo && (
            <>
              <div className="flex items-center gap-2 font-mono text-[12px] text-dim">
                <GitBranch size={13} className="shrink-0" />
                <span className="text-ink-100">{git.branch ?? 'detached'}</span>
                {git.hasChanges ? (
                  <span className="text-warn">· uncommitted changes</span>
                ) : (
                  <span className="text-ok">· clean</span>
                )}
                {meta.lastCommitHash && (
                  <span className="text-faint">
                    · last commit {meta.lastCommitHash.slice(0, 7)}
                    {meta.lastCommitPushed ? ' (pushed)' : ''}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onProtectedBranch && (
                  <button
                    onClick={createBranch}
                    disabled={!!busy}
                    title={`Create and switch to ${meta.branch ?? suggestedBranch}`}
                    className="flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-lg bg-elev text-ink-100 hover:bg-line transition disabled:opacity-50"
                  >
                    {busy === 'branch' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <GitBranch size={12} />
                    )}
                    Create branch {meta.branch ?? suggestedBranch}
                  </button>
                )}
                <button
                  onClick={commitAll}
                  disabled={!!busy || !git.hasChanges}
                  title={`Stage everything and commit${git.hasOrigin ? ' + push' : ''} — message prefilled from the summary`}
                  className="flex items-center gap-1.5 text-[12px] px-3.5 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-glow transition disabled:opacity-40"
                >
                  {busy === 'commit' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <GitCommitHorizontal size={12} />
                  )}
                  Commit all{git.hasOrigin ? ' & push' : ''}
                </button>
                {prUrl ? (
                  <button
                    onClick={() => void window.kraken.shell.openUrl(prUrl)}
                    className="flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-lg bg-good/15 text-ok font-semibold hover:bg-good/25 transition"
                  >
                    <GitPullRequest size={12} /> View PR <ExternalLink size={11} />
                  </button>
                ) : git.hasOrigin && hasGithub ? (
                  <button
                    onClick={createPr}
                    disabled={!!busy}
                    title="Open a pull request — title and body prefilled from the spec + summary"
                    className="flex items-center gap-1.5 text-[12px] px-3.5 py-2 rounded-lg bg-elev text-ink-100 hover:bg-line transition disabled:opacity-50"
                  >
                    {busy === 'pr' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <GitPullRequest size={12} />
                    )}
                    Create PR
                  </button>
                ) : (
                  <span className="text-[11px] text-faint">
                    {git.hasOrigin
                      ? 'Add a GitHub token in Library › Settings to open PRs from here.'
                      : 'No origin remote — commit locally, or manage remotes in the repo panel.'}
                  </span>
                )}
                <button
                  onClick={() => openOverlay({ kind: 'repo' })}
                  className="ml-auto text-[11.5px] text-dim hover:text-ink-50 transition"
                >
                  Open repo panel →
                </button>
              </div>
            </>
          )}

          {notice && (
            <div
              className={cn(
                'flex items-center gap-2 text-[12px] rounded-lg px-3 py-2',
                notice.tone === 'ok' ? 'bg-good/10 text-ok' : 'bg-bad/10 text-bad'
              )}
            >
              {notice.tone === 'ok' ? <Check size={13} /> : <AlertCircle size={13} />}
              {notice.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
