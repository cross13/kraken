import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, CircleSlash, Loader2, RefreshCw, Filter } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { cn } from '../../lib/cn';
import type { RunRow } from '../../../electron/shared/types';

type FilterStatus = 'all' | 'error' | 'done' | 'cancelled';

/**
 * Activity › History — every recorded Claude invocation. Rendered as a table
 * so the columns the run actually has (backend, agent, model, duration, when)
 * are readable instead of crushed into a two-line truncated list.
 */
export function HistoryView() {
  const root = useWorkspace((s) => s.root);
  const openOverlay = useUi((s) => s.openOverlay);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    errors: number;
    cancelled: number;
    avgDurationMs: number | null;
  } | null>(null);
  const [status, setStatus] = useState<FilterStatus>('all');

  const refresh = async () => {
    const [r, s] = await Promise.all([
      window.kraken.history.listRuns({ workspacePath: root ?? null, limit: 200 }),
      window.kraken.history.stats(root ?? null),
    ]);
    setRuns(r);
    setStats(s);
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [root]);

  const filtered = status === 'all' ? runs : runs.filter((r) => r.status === status);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="k-wide shrink-0 pt-1 pb-3">
        {stats && (
          <div className="k-cards mb-4" style={{ ['--k-card' as string]: '150px' }}>
            <Stat label="runs" value={stats.total} />
            <Stat label="errors" value={stats.errors} tone={stats.errors > 0 ? 'bad' : undefined} />
            <Stat label="cancelled" value={stats.cancelled} />
            <Stat
              label="avg duration"
              value={stats.avgDurationMs ? `${(stats.avgDurationMs / 1000).toFixed(1)}s` : '—'}
            />
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px]">
          <Filter size={11} className="text-faint" />
          {(['all', 'done', 'error', 'cancelled'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'px-2 py-1 rounded-md transition',
                status === s
                  ? 'bg-accent/15 text-accent font-semibold'
                  : 'text-dim hover:bg-elev hover:text-ink-50'
              )}
            >
              {s}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-[11px] text-faint">
            {filtered.length} run{filtered.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={refresh}
            title="Refresh"
            className="p-1.5 rounded-md text-faint hover:text-ink-100 hover:bg-elev transition"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 k-scroll">
        <div className="k-wide pb-8">
          {filtered.length === 0 ? (
            <p className="text-[12.5px] text-faint leading-relaxed py-6">
              No runs recorded yet. Every chat, spec draft, task, and hook run lands here.
            </p>
          ) : (
            /* Table scrolls inside its own container so the surface never
               scrolls horizontally on a narrow window. */
            <div className="overflow-x-auto rounded-xl ring-1 ring-ink-800/50">
              <table className="w-full min-w-[720px] text-left border-collapse">
                <thead>
                  <tr className="bg-elev/40 text-[10px] uppercase tracking-[0.14em] text-faint font-mono">
                    <Th className="w-10" />
                    <Th>Prompt</Th>
                    <Th className="w-[130px]">Agent</Th>
                    <Th className="w-[110px]">Backend</Th>
                    <Th className="w-[90px] text-right">Duration</Th>
                    <Th className="w-[110px] text-right">When</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => openOverlay({ kind: 'run', runId: r.id })}
                      className="border-t border-ink-800/40 hover:bg-elev/40 cursor-pointer"
                    >
                      <Td className="w-10">
                        <StatusIcon status={r.status} />
                      </Td>
                      <Td>
                        <span className="block truncate text-[12.5px] text-ink-100">
                          {r.prompt?.slice(0, 200) ?? '(empty prompt)'}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[11.5px] text-accent truncate block">
                          {r.agent ? `@${r.agent}` : '—'}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[11.5px] text-dim">{r.backend}</span>
                      </Td>
                      <Td className="text-right">
                        <span className="font-mono text-[11.5px] text-dim">
                          {formatDuration(r.duration_ms)}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <span className="text-[11.5px] text-faint whitespace-nowrap">
                          {formatRelative(r.started_at)}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn('px-3 py-2 font-normal', className)}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2 max-w-0', className)}>{children}</td>;
}

function StatusIcon({ status }: { status: RunRow['status'] }) {
  if (status === 'done') return <CheckCircle2 size={13} className="text-ok shrink-0" />;
  if (status === 'error') return <AlertCircle size={13} className="text-bad shrink-0" />;
  if (status === 'cancelled') return <CircleSlash size={13} className="text-faint shrink-0" />;
  return <Loader2 size={13} className="text-accent animate-spin shrink-0" />;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'bad';
}) {
  return (
    <div className="rounded-lg ring-1 ring-ink-800/60 bg-elev/30 px-3 py-2.5">
      <div className={cn('text-[19px] font-semibold leading-none', tone === 'bad' ? 'text-bad' : 'text-ink-50')}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-faint mt-1.5">{label}</div>
    </div>
  );
}

function formatDuration(ms: number | null) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatRelative(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
