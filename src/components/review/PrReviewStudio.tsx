import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  FileSearch,
  GitPullRequest,
  HardDrive,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { prReviewDraft, prReviewPrompt, reviewCounts, runReview, type PrReviewDraft } from '../../lib/codeReview';
import { FindingsList, countsLabel } from './FindingsList';
import { DiffFiles } from './DiffFiles';
import { cn } from '../../lib/cn';
import type { CodeReview, GitHubAuthStatus, PrFile, PullRequestMeta } from '../../../electron/shared/types';

interface PrState {
  pr: PullRequestMeta & { headSha: string };
  files: PrFile[];
  /** the PR's local worktree, or null when the checkout failed and `files` came from GitHub */
  checkout: { dir: string; head: string } | null;
  checkoutError: string | null;
  review: CodeReview | null;
  draft: PrReviewDraft | null;
  live: string;
  activity: string[];
  running: string | null;
  startedAt: number | null;
  posted: string | null;
  error: string | null;
}

type Tab = 'files' | 'review';

/**
 * Activity › Reviews — review any open pull request of the workspace's repo.
 *
 * Opening a PR checks it out locally (`git:pr-checkout`: private refs + a
 * detached worktree under userData), so its files read like GitHub's "Files
 * changed" without touching the workspace's own branch, and the reviewer runs
 * *inside* that worktree, read-only, with nothing to fetch. If the checkout
 * fails it falls back to GitHub's patches through `gh api`.
 *
 * Each PR keeps its own state, so switching PRs never drops a review in flight.
 * Posting is a write to someone else's PR, so it follows the ticket rule: the
 * exact body and inline comments are shown first, and the review is always a
 * COMMENT.
 */
export function PrReviewStudio() {
  const root = useWorkspace((s) => s.root);
  const [prs, setPrs] = useState<PullRequestMeta[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [gh, setGh] = useState<GitHubAuthStatus | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [states, setStates] = useState<Record<number, PrState>>({});
  const [activeN, setActiveN] = useState<number | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('files');
  const [focus, setFocus] = useState<{ path: string; line?: number; nonce: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [posting, setPosting] = useState(false);
  const now = useTicker(Object.values(states).some((s) => s.running));

  const active = activeN != null ? states[activeN] ?? null : null;

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
    const open = res.data ?? [];
    setPrs(open);
    // Worktrees of PRs that closed since are dead weight on disk.
    void window.octo.git.prCheckoutPrune({ cwd: root, keep: open.map((p) => p.number) });
  };

  useEffect(() => {
    setStates({});
    setActiveN(null);
    void load();
  }, [root]);

  const patch = (n: number, p: Partial<PrState>) =>
    setStates((all) => (all[n] ? { ...all, [n]: { ...all[n], ...p } } : all));

  const open = async (n: number, again = false) => {
    if (!root) return;
    setConfirming(false);
    setActiveN(n);
    // Already open, or reviewing: keep what is there rather than re-checking it out mid-run.
    if (states[n] && !again) return;
    setOpening(n);
    const pr = await window.octo.github.getPr({ cwd: root, number: n });
    if (!pr.ok || !pr.data) {
      setOpening(null);
      setListError(pr.error ?? 'Could not read the pull request.');
      return;
    }
    const local = await window.octo.git.prCheckout({ cwd: root, number: n, base: pr.data.base });
    let files: PrFile[] = local.files;
    let checkoutError: string | null = null;
    if (!local.ok || !local.dir || !local.head) {
      checkoutError = local.error ?? 'Could not check the pull request out locally.';
      const remote = await window.octo.github.prFiles({ cwd: root, number: n });
      if (!remote.ok) {
        setOpening(null);
        setListError(remote.error ?? checkoutError);
        return;
      }
      files = remote.data ?? [];
    }
    setOpening(null);
    setStates((all) => ({
      ...all,
      [n]: {
        pr: pr.data!,
        files,
        checkout: local.ok && local.dir && local.head ? { dir: local.dir, head: local.head } : null,
        checkoutError,
        review: null,
        draft: null,
        live: '',
        activity: [],
        running: null,
        startedAt: null,
        posted: null,
        error: null,
      },
    }));
  };

  const review = async () => {
    if (!active) return;
    const { pr, files, checkout } = active;
    const n = pr.number;
    const run = runReview({
      target: `pr:${n}`,
      title: `Review PR #${n} · ${pr.title}`,
      prompt: prReviewPrompt(pr, files, !!checkout),
      cwd: checkout?.dir,
      onDelta: (live) => patch(n, { live }),
      onActivity: (activity) => patch(n, { activity }),
    });
    setTab('review');
    patch(n, {
      running: run.requestId,
      startedAt: Date.now(),
      live: '',
      activity: [],
      error: null,
      review: null,
      draft: null,
      posted: null,
    });
    const result = await run.done;
    patch(n, {
      running: null,
      review: result,
      draft: result ? prReviewDraft(result, files) : null,
      error: result ? null : 'The review did not finish — see Activity › History.',
    });
  };

  const post = async () => {
    if (!root || !active?.draft) return;
    const n = active.pr.number;
    setPosting(true);
    const res = await window.octo.github.prReview({
      cwd: root,
      number: n,
      body: active.draft.body,
      // inline comments were placed on the diff we read — anchor them to that commit
      commitId: active.checkout?.head ?? active.pr.headSha,
      comments: active.draft.comments,
    });
    setPosting(false);
    setConfirming(false);
    if (res.ok) patch(n, { posted: res.data?.url || active.pr.url });
    else patch(n, { error: res.error ?? 'GitHub rejected the review.' });
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

  const added = active?.files.reduce((n, f) => n + f.added, 0) ?? 0;
  const deleted = active?.files.reduce((n, f) => n + f.deleted, 0) ?? 0;
  const stale = active?.checkout && active.checkout.head !== active.pr.headSha;

  return (
    <div className="flex h-full min-h-0">
      {/* the open PRs */}
      <div className="k-listpane flex flex-col border-r border-ink-50/[0.06]">
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <h3 className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Open pull requests</h3>
          <button onClick={() => void load()} title="Refresh" className="ml-auto rounded p-1 text-dim hover:text-ink-50">
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3 space-y-1.5">
          {listError && (
            <p className="flex items-start gap-1.5 px-1 text-[12px] text-bad">
              <AlertCircle size={12} className="mt-0.5 shrink-0" /> <span className="break-words">{listError}</span>
            </p>
          )}
          {prs === null && !listError && <Loader2 size={14} className="mx-1 animate-spin text-dim" />}
          {prs?.length === 0 && <p className="px-1 text-[12px] text-dim">No open pull requests.</p>}
          {prs?.map((p) => {
            const st = states[p.number];
            return (
              <button
                key={p.number}
                onClick={() => void open(p.number)}
                className={cn(
                  'w-full rounded-lg p-2.5 text-left transition',
                  activeN === p.number ? 'bg-accent/12' : 'bg-card hover:bg-elev'
                )}
              >
                <div className="flex items-center gap-1.5 text-[12.5px] text-ink-50">
                  <GitPullRequest size={12} className="shrink-0 text-dim" />
                  <span className="text-dim">#{p.number}</span>
                  <span className="truncate">{p.title}</span>
                  {(opening === p.number || st?.running) && (
                    <Loader2 size={11} className="ml-auto shrink-0 animate-spin text-dim" />
                  )}
                </div>
                <div className="mt-0.5 truncate font-mono text-[10.5px] text-faint">
                  {p.author} · {p.head} → {p.base}
                  {p.draft ? ' · draft' : ''}
                  {st?.review ? ` · ${countsLabel(reviewCounts(st.review.findings))}` : ''}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* the selected PR */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!active && (
          <div className="k-wide py-8 text-[12.5px] text-dim">
            {opening != null ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={13} className="animate-spin" /> Checking out #{opening} locally…
              </span>
            ) : (
              'Pick a pull request. It is checked out into a private worktree so you can read every changed file here — your own branch is never touched, and nothing is posted to GitHub unless you choose to.'
            )}
          </div>
        )}

        {active && (
          <>
            <div className="border-b border-ink-50/[0.06] px-4 pt-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-ink-50">
                    #{active.pr.number} {active.pr.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-dim">
                    <span className="font-mono">
                      {active.pr.head} → {active.pr.base}
                    </span>
                    <span>
                      {active.files.length} files · <span className="text-good">+{added}</span>{' '}
                      <span className="text-bad">−{deleted}</span>
                    </span>
                    {active.checkout ? (
                      <span
                        className="inline-flex items-center gap-1 text-faint"
                        title={`Checked out at ${active.checkout.dir}`}
                      >
                        <HardDrive size={11} /> local · {active.checkout.head.slice(0, 7)}
                      </span>
                    ) : (
                      <span className="text-warn" title={active.checkoutError ?? undefined}>
                        GitHub patches (local checkout failed)
                      </span>
                    )}
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
                      <Loader2 size={12} className="animate-spin" /> Reviewing{' '}
                      {active.startedAt ? clock(now - active.startedAt) : ''} · stop
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
              {active.checkoutError && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-warn">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  <span className="break-words">{active.checkoutError}</span>
                </p>
              )}
              {stale && (
                <p className="mt-1.5 text-[11.5px] text-warn">
                  GitHub's head is {active.pr.headSha.slice(0, 7)} — new commits were pushed after this checkout.{' '}
                  <button
                    className="underline"
                    disabled={!!active.running}
                    onClick={() => void open(active.pr.number, true)}
                  >
                    Check out again
                  </button>
                </p>
              )}
              <div className="mt-2 flex gap-4 text-[12px]">
                {(
                  [
                    ['files', `Files changed ${active.files.length}`],
                    [
                      'review',
                      active.review
                        ? `Review · ${countsLabel(reviewCounts(active.review.findings))}`
                        : active.running
                          ? 'Review · running'
                          : 'Review',
                    ],
                  ] as [Tab, string][]
                ).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      '-mb-px border-b-2 pb-1.5',
                      tab === t ? 'border-accent text-ink-50' : 'border-transparent text-dim hover:text-ink-50'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1">
              {tab === 'files' ? (
                <DiffFiles
                  files={active.files}
                  findings={active.review?.findings}
                  root={active.checkout?.dir ?? null}
                  focus={focus}
                />
              ) : (
                <div className="h-full overflow-auto">
                  <div className="k-wide py-4 space-y-3">
                    {active.error && (
                      <p className="flex items-center gap-1.5 text-[12px] text-bad">
                        <AlertCircle size={12} /> {active.error}
                      </p>
                    )}
                    {!active.running && !active.review && !active.error && (
                      <p className="text-[12.5px] text-dim">
                        Run <span className="text-ink-50">Review</span> to have the code reviewer read this pull request
                        {active.checkout ? ' in its local checkout' : ''}. It only reads — it never edits, runs commands or
                        posts.
                      </p>
                    )}
                    {active.running && (
                      <div className="space-y-2">
                        <ul className="max-h-56 overflow-auto rounded-lg bg-raised p-2 font-mono text-[11px] text-dim space-y-0.5">
                          {active.activity.length === 0 && <li>Starting the reviewer…</li>}
                          {active.activity.map((a, i) => (
                            <li key={i} className={cn('truncate', i === active.activity.length - 1 && 'text-ink-200')}>
                              {a}
                            </li>
                          ))}
                        </ul>
                        {active.live && (
                          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-raised p-2 font-mono text-[11px] text-dim">
                            {active.live}
                          </pre>
                        )}
                      </div>
                    )}

                    {!active.running && active.review && (
                      <>
                        {active.review.summary && (
                          <p className="whitespace-pre-wrap text-[12.5px] text-ink-200">{active.review.summary}</p>
                        )}
                        <FindingsList
                          findings={active.review.findings}
                          canFix={branch === active.pr.head}
                          fileRoot={active.checkout?.dir}
                          onLocate={(f) => {
                            setTab('files');
                            setFocus({ path: f.file, line: f.line, nonce: Date.now() });
                          }}
                        />

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
                              <button
                                onClick={() => setConfirming(false)}
                                className="rounded-md px-2.5 py-1 text-[12px] text-dim hover:text-ink-50"
                              >
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
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Re-render once a second while `on`, so an elapsed clock moves. */
function useTicker(on: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
