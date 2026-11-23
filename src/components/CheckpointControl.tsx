import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { useWorkspace } from '../stores/workspace';
import { useGit } from '../stores/git';
import { cn } from '../lib/cn';
import type { CheckpointInfo, CheckpointRestore } from '../../electron/shared/types';

/**
 * A run's **checkpoint** — the working tree as it was the moment before the run
 * started — with the way back to it. Restoring is the one action here that
 * throws work away, so it is confirmed in place and says exactly what it will
 * do: only the files that runs wrote since are touched (this run's and any
 * later one's), and what you edited elsewhere by hand stays.
 *
 * `live` re-reads while the run is still streaming, so the file count grows as
 * the agent writes.
 */
export function CheckpointControl({
  runId,
  live,
  className,
}: {
  runId: string;
  live?: boolean;
  className?: string;
}) {
  const root = useWorkspace((s) => s.root);
  const refreshGit = useGit((s) => s.refresh);
  const [info, setInfo] = useState<CheckpointInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckpointRestore | null>(null);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    const read = () =>
      window.octo.git
        .checkpointInfo({ cwd: root, runId })
        .then((i) => {
          if (!cancelled) setInfo(i);
        })
        .catch(() => {
          if (!cancelled) setInfo(null);
        });
    void read();
    const t = live ? setInterval(read, 3000) : null;
    return () => {
      cancelled = true;
      if (t) clearInterval(t);
    };
  }, [root, runId, live, result]);

  // No checkpoint (read-only run, API backend, not a repository) → nothing to offer.
  if (!root || !info?.exists) return null;

  const n = info.files.length;

  const restore = async () => {
    setBusy(true);
    const res = await window.octo.git.checkpointRestore({ cwd: root, runId });
    setBusy(false);
    setConfirming(false);
    setResult(res);
    await refreshGit();
  };

  return (
    <div className={cn('text-[12px] text-faint', className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex-1 h-px bg-ink-50/[0.08] min-w-[12px]" />
        <History size={12} className="shrink-0" />
        <span>
          Checkpoint before this run
          {n > 0 ? ` · ${n} ${n === 1 ? 'file' : 'files'} written since` : ' · nothing written since'}
        </span>
        {n > 0 && !confirming && !live && (
          <button
            onClick={() => {
              setResult(null);
              setConfirming(true);
            }}
            className="h-6 px-2 rounded-md bg-elev text-ink-50 hover:opacity-80"
          >
            Restore
          </button>
        )}
        <span className="flex-1 h-px bg-ink-50/[0.08] min-w-[12px]" />
      </div>

      {confirming && (
        <div className="mt-2 rounded-lg bg-agent-tint/60 ring-1 ring-agent/25 p-3 text-ink-100">
          <p className="font-semibold text-ink-50">
            Put {n === 1 ? 'this file' : `these ${n} files`} back to how {n === 1 ? 'it was' : 'they were'} before
            this run?
          </p>
          <p className="mt-1 text-dim">
            This undoes what this run and every run after it wrote to {n === 1 ? 'it' : 'them'}, including
            any edits you made to {n === 1 ? 'it' : 'them'} since. Files a run created are deleted. It cannot
            be undone.
          </p>
          <ul className="mt-2 max-h-28 overflow-y-auto font-mono text-[11.5px] text-ink-200">
            {info.files.map((f) => (
              <li key={f} className="truncate">
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => void restore()}
              disabled={busy}
              className="h-7 px-3 rounded-md bg-agent text-agent-fg font-semibold disabled:opacity-50"
            >
              {busy ? 'Restoring…' : 'Restore'}
            </button>
            <button onClick={() => setConfirming(false)} className="h-7 px-3 rounded-md bg-elev text-ink-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <p className={cn('mt-1.5 text-center', result.ok ? 'text-faint' : 'text-danger-text')}>
          {result.ok
            ? [
                result.restored.length && `${result.restored.length} restored`,
                result.removed.length && `${result.removed.length} removed`,
                result.skipped.length &&
                  `${result.skipped.length} left alone (${result.skipped.map((s) => `${s.path}: ${s.reason}`).join('; ')})`,
              ]
                .filter(Boolean)
                .join(' · ') || 'Nothing needed restoring.'
            : (result.error ?? 'Could not restore.')}
        </p>
      )}
    </div>
  );
}
