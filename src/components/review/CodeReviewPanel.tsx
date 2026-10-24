import { useEffect, useState } from 'react';
import { FileSearch, Loader2, AlertCircle } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import {
  localReviewPrompt,
  parseReview,
  reviewCounts,
  reviewHeadFromMarkdown,
  reviewToMarkdown,
  runReview,
} from '../../lib/codeReview';
import { FindingsList, countsLabel } from './FindingsList';
import { cn } from '../../lib/cn';
import type { CodeReview, SpecMeta } from '../../../electron/shared/types';

/**
 * Review changes — the step between Commit and Create PR. Reviews the branch's
 * committed diff against its base (the same range the PR will show), writes the
 * result to the spec's `review.md` and stamps `SpecMeta.review` with HEAD so a
 * later commit marks it stale. Advisory: it never blocks the PR.
 */
export function CodeReviewPanel({ meta, specRel }: { meta: SpecMeta; specRel: string }) {
  const root = useWorkspace((s) => s.root)!;
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const [review, setReview] = useState<CodeReview | null>(null);
  const [reviewedHead, setReviewedHead] = useState<string | null>(meta.review?.sha ?? null);
  const [head, setHead] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    window.octo.specs.readReview(root, meta.id).then((md) => {
      if (!alive || !md) return;
      setReview(parseReview(md, `branch:${meta.branch ?? ''}`));
      setReviewedHead(reviewHeadFromMarkdown(md));
    });
    window.octo.git.branchDiff({ cwd: root }).then((d) => alive && setHead(d.head));
    return () => {
      alive = false;
    };
  }, [root, meta.id, meta.branch]);

  const start = async () => {
    setError(null);
    const diff = await window.octo.git.branchDiff({ cwd: root });
    if (!diff.ok) return setError(diff.error ?? 'Could not read the branch diff.');
    if (!diff.patch.trim()) return setError(`Nothing committed on this branch yet against ${diff.base}.`);
    setHead(diff.head);
    setLive('');
    const run = runReview({
      target: `branch:${meta.branch ?? diff.head ?? ''}`,
      title: `Code review · ${meta.name}`,
      prompt: localReviewPrompt(meta, diff, specRel),
      specId: meta.id,
      onDelta: setLive,
    });
    setRunning(run.requestId);
    const result = await run.done;
    setRunning(null);
    if (!result) return setError('The review did not finish — see Activity › History.');
    setReview(result);
    setReviewedHead(diff.head);
    await window.octo.specs.saveReview({
      root,
      id: meta.id,
      markdown: reviewToMarkdown(result, diff.head),
      stamp: { at: result.createdAt, sha: diff.head ?? '', counts: reviewCounts(result.findings) },
    });
    refreshAll();
  };

  const stale = !!review && !!head && !!reviewedHead && head !== reviewedHead;
  const counts = review ? reviewCounts(review.findings) : null;

  return (
    <div className="rounded-xl bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileSearch size={13} className="text-dim" />
        <h3 className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Code review</h3>
        {counts && (
          <span className={cn('text-[11px]', counts.blocker ? 'text-bad' : 'text-dim')}>{countsLabel(counts)}</span>
        )}
        {stale && (
          <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold text-warn">
            stale — new commits since
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {running ? (
            <button
              type="button"
              onClick={() => void window.octo.claude.cancel(running)}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-dim hover:text-ink-50"
            >
              <Loader2 size={12} className="animate-spin" /> Reviewing… stop
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-fg hover:opacity-90"
            >
              <FileSearch size={12} /> {review ? 'Re-review' : 'Review changes'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-[12px] text-bad">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      {running && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-raised p-2 font-mono text-[11px] text-dim">
          {live || 'Reading the diff…'}
        </pre>
      )}

      {!running && review && (
        <>
          {review.summary && <p className="whitespace-pre-wrap text-[12.5px] text-ink-200">{review.summary}</p>}
          <FindingsList findings={review.findings} />
        </>
      )}

      {!running && !review && !error && (
        <p className="text-[12px] text-dim">
          Reviews the committed diff of this branch against its base — the same range the PR will show — and
          checks it against the spec's criteria. Read-only; fixes are one click per finding.
        </p>
      )}
    </div>
  );
}
