import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  FileSearch,
  GitPullRequest,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { prReviewDraft, prReviewPrompt, reviewCounts, runReview, type PrReviewDraft } from '../../lib/codeReview';
import { FindingsList, countsLabel } from './FindingsList';
import { cn } from '../../lib/cn';
import type { CodeReview, GitHubAuthStatus, PrFile, PullRequestMeta } from '../../../electron/shared/types';

interface PrState {
  pr: PullRequestMeta & { headSha: string };
  files: PrFile[];
  review: CodeReview | null;
  draft: PrReviewDraft | null;
  live: string;
  running: string | null;
  posted: string | null;
  error: string | null;
}

/**
 * Activity › Reviews — review any open pull request of the workspace's repo.
 * Reads the PR's files through `gh api` (so the PR need not be checked out), runs the same review as Ship, and can post it back. Posting is a write
 * to someone else's PR, so it follows the ticket rule: the exact body and inline
 * comments are shown first, and the review is always a COMMENT.
 */
export function PrReviewStudio() {
  const root = useWorkspace((s) => s.root);
  const [prs, setPrs] = useState<PullRequestMeta[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [gh, setGh] = useState<GitHubAuthStatus | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [active, setActive] = useState<PrState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = async () => {
    if (!root) return;
    setListError(null);
    const auth = await window.octo.github.status();
    setGh(auth);
    if (!auth.loggedIn) return;
    const [res, status] = await Promise.all([
      window.octo.github.listPrs({ cwd: root, state: 'open' }),
      window.octo.git.status(root),
    ]);
    setBranch(status.branch);
    if (!res.ok) {
      setListError(res.error ?? 'Could not list pull requests.');
      setPrs(null);
      return;
    }
    setPrs(res.data ?? []);
  };

  useEffect(() => {
    void load();
  }, [root]);

  const patch = (p: Partial<PrState>) => setActive((s) => (s ? { ...s, ...p } : s));

  const open = async (n: number) => {
    if (!root) return;
    setConfirming(false);
    const [pr, files] = await Promise.all([
      window.octo.github.getPr({ cwd: root, number: n }),
      window.octo.github.prFiles({ cwd: root, number: n }),
    ]);
    if (!pr.ok || !pr.data || !files.ok) {
      setListError(pr.error ?? files.error ?? 'Could not read the pull request.');
      return;
    }
    setActive({
      pr: pr.data,
      files: files.data ?? [],
      review: null,
      draft: null,
      live: '',
      running: null,
      posted: null,
      error: null,
    });
  };

  const review = async () => {
    if (!active) return;
    const { pr, files } = active;
    const run = runReview({
      target: `pr:${pr.number}`,
      title: `Review PR #${pr.number} · ${pr.title}`,
      prompt: prReviewPrompt(pr, files),
      onDelta: (live) => patch({ live }),
    });
    patch({ running: run.requestId, live: '', error: null, review: null, draft: null, posted: null });
    const result = await run.done;
    setActive((s) =>
      s && s.pr.number === pr.number
        ? {
            ...s,
            running: null,
            review: result,
            draft: result ? prReviewDraft(result, files) : null,
            error: result ? null : 'The review did not finish — see Activity › History.',
          }
        : s
    );
  };

  const post = async () => {
    if (!root || !active?.draft) return;
    setPosting(true);
    const res = await window.octo.github.prReview({
      cwd: root,
      number: active.pr.number,
      body: active.draft.body,
      commitId: active.pr.headSha,
      comments: active.draft.comments,
    });
    setPosting(false);
    setConfirming(false);
    if (res.ok) patch({ posted: res.data?.url || active.pr.url });
    else patch({ error: res.error ?? 'GitHub rejected the review.' });
  };

  if (gh && !gh.loggedIn) {
    return (
      <div className="k-wide py-10 text-[13px] text-dim space-y-2">
        <p>
          Reviewing pull requests goes through your local <code className="text-ink-200">gh</code> CLI,{' '}
          {gh.installed ? 'which is not signed in.' : 'which is not installed.'}{' '}
          {gh.installed ? 'Run ' : 'Install it from cli.github.com, then run '}
          <code className="text-ink-200">gh auth login</code> in a terminal.
        </p>
        <button className="text-accent-text underline" onClick={() => void load()}>
          Check again
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="k-wide py-4">
        <div className="k-split">
          {/* the selected PR */}
          <div className="min-w-0 space-y-3">
            {!active && (
              <p className="py-6 text-[12.5px] text-dim">
                Pick a pull request to review its diff. Nothing is posted to GitHub unless you choose to.
              </p>
            )}
            {active && (
              <div className="rounded-xl bg-card p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-ink-50">
                      #{active.pr.number} {active.pr.title}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-dim">
                      {active.files.length} files · +{active.files.reduce((n, f) => n + f.added, 0)} −
                      {active.files.reduce((n, f) => n + f.deleted, 0)}
                      {active.review && ` · ${countsLabel(reviewCounts(active.review.findings))}`}
                    </div>
                  </div>
                  <div className="ml-auto flex shrink-0 gap-2">
                    <button
                      onClick={() => void window.octo.shell.openUrl(active.pr.url)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-dim hover:text-ink-50"
                    >
                      <ExternalLink size={12} /> GitHub
                    </button>
                    {active.running ? (
                      <button
                        onClick={() => void window.octo.claude.cancel(active.running!)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-dim hover:text-ink-50"
                      >
                        <Loader2 size={12} className="animate-spin" /> Reviewing… stop
                      </button>
                    ) : (
                      <button
                        onClick={() => void review()}
                        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-fg hover:opacity-90"
                      >
                        <FileSearch size={12} /> {active.review ? 'Re-review' : 'Review'}
                      </button>
                    )}
                  </div>
                </div>

                {active.error && (
                  <p className="flex items-center gap-1.5 text-[12px] text-bad">
                    <AlertCircle size={12} /> {active.error}
                  </p>
                )}
                {active.running && (
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-raised p-2 font-mono text-[11px] text-dim">
                    {active.live || 'Reading the diff…'}
                  </pre>
                )}

                {!active.running && active.review && (
                  <>
                    {active.review.summary && (
                      <p className="whitespace-pre-wrap text-[12.5px] text-ink-200">{active.review.summary}</p>
                    )}
                    <FindingsList findings={active.review.findings} canFix={branch === active.pr.head} />

                    {active.posted ? (
                      <p className="text-[12px] text-good">
                        Posted to GitHub.{' '}
                        <button className="underline" onClick={() => void window.octo.shell.openUrl(active.posted!)}>
                          Open the review
                        </button>
                      </p>
                    ) : confirming && active.draft ? (
                      <div className="space-y-2 rounded-lg bg-raised p-3">
                        <div className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">
                          This will be posted as a comment review
                        </div>
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-ink-200">
                          {active.draft.body}
                        </pre>
                        {active.draft.comments.length > 0 && (
                          <ul className="space-y-1 text-[11.5px] text-dim">
                            {active.draft.comments.map((c, i) => (
                              <li key={i} className="truncate">
                                <span className="font-mono">
                                  {c.path}:{c.line}
                                </span>{' '}
                                — {c.body.split('\n')[0].replace(/\*\*/g, '')}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setConfirming(false)} className="rounded-md px-2.5 py-1 text-[12px] text-dim hover:text-ink-50">
                            Cancel
                          </button>
                          <button
                            onClick={() => void post()}
                            disabled={posting}
                            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-fg disabled:opacity-40"
                          >
                            {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Post review
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirming(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-elev px-2.5 py-1 text-[12px] text-ink-50 hover:bg-raised"
                      >
                        <Send size={12} /> Post to GitHub…
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          {/* the open PRs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Open pull requests</h3>
              <button onClick={() => void load()} title="Refresh" className="ml-auto rounded p-1 text-dim hover:text-ink-50">
                <RefreshCw size={12} />
              </button>
            </div>
            {listError && (
              <p className="flex items-center gap-1.5 text-[12px] text-bad">
                <AlertCircle size={12} /> {listError}
              </p>
            )}
            {prs === null && !listError && <Loader2 size={14} className="animate-spin text-dim" />}
            {prs?.length === 0 && <p className="text-[12px] text-dim">No open pull requests.</p>}
            {prs?.map((p) => (
              <button
                key={p.number}
                onClick={() => void open(p.number)}
                className={cn(
                  'w-full rounded-lg p-2.5 text-left transition',
                  active?.pr.number === p.number ? 'bg-accent/12' : 'bg-card hover:bg-elev'
                )}
              >
                <div className="flex items-center gap-1.5 text-[12.5px] text-ink-50">
                  <GitPullRequest size={12} className="shrink-0 text-dim" />
                  <span className="text-dim">#{p.number}</span>
                  <span className="truncate">{p.title}</span>
                </div>
                <div className="mt-0.5 truncate font-mono text-[10.5px] text-faint">
                  {p.author} · {p.head} → {p.base}
                  {p.draft ? ' · draft' : ''}
                </div>
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
