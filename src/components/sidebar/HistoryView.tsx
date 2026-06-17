import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, CircleSlash, Loader2, RefreshCw, Filter } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';
import { cn } from '../../lib/cn';
import type { RunRow } from '../../../electron/shared/types';

type FilterStatus = 'all' | 'error' | 'done' | 'cancelled';

export function HistoryView() {
  const root = useWorkspace((s) => s.root);
  const openTab = useUi((s) => s.openTab);
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
    <>
      <SidebarHeader
        title="History"
        actions={
          <SidebarButton onClick={refresh} title="Refresh">
            <RefreshCw size={13} />
          </SidebarButton>
        }
      />

      {stats && (
        <div className="px-3 py-2 border-b border-ink-800/80 grid grid-cols-3 gap-1.5 text-center">
          <Stat label="runs" value={stats.total} />
          <Stat label="errors" value={stats.errors} tone={stats.errors > 0 ? 'bad' : undefined} />
          <Stat
            label="avg"
            value={stats.avgDurationMs ? `${(stats.avgDurationMs / 1000).toFixed(1)}s` : '—'}
          />
        </div>
      )}

      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-ink-800/80 text-[10px]">
        <Filter size={10} className="text-ink-500" />
        {(['all', 'done', 'error', 'cancelled'] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'px-1.5 py-0.5 rounded',
              status === s
                ? 'bg-accent/20 text-accent'
                : 'text-ink-400 hover:bg-ink-800/60 hover:text-ink-100'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <SidebarEmpty
            title="No runs yet"
            description="Every chat and Ask Claude request is recorded here."
          />
        ) : (
          <div className="px-1.5 space-y-0.5">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() =>
                  openTab({
                    id: `run:${r.id}`,
                    title: `Run · ${r.id.slice(0, 8)}`,
                    kind: 'run',
                    runId: r.id,
                  })
                }
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-ink-800/60"
              >
                <div className="flex items-center gap-2">
                  <StatusIcon status={r.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-ink-100 truncate">
                      {r.prompt?.slice(0, 90) ?? '(empty prompt)'}
                    </div>
                    <div className="text-[10px] text-ink-500 flex items-center gap-1.5">
                      <span>{r.backend}</span>
                      {r.agent && (
                        <>
                          <span>·</span>
                          <span className="text-accent">@{r.agent}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{formatDuration(r.duration_ms)}</span>
                      <span>·</span>
                      <span>{formatRelative(r.started_at)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function StatusIcon({ status }: { status: RunRow['status'] }) {
  if (status === 'done') return <CheckCircle2 size={13} className="text-ok shrink-0" />;
  if (status === 'error') return <AlertCircle size={13} className="text-bad shrink-0" />;
  if (status === 'cancelled') return <CircleSlash size={13} className="text-ink-500 shrink-0" />;
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
    <div className="rounded-md border border-ink-800 bg-ink-900/60 py-1">
      <div className={cn('text-sm font-semibold', tone === 'bad' ? 'text-bad' : 'text-ink-100')}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-ink-500">{label}</div>
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
