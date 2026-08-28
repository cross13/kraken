import { useEffect, useState } from 'react';
import {
  Network,
  Loader2,
  Square,
  Minus,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Ban,
  Bot,
  ListChecks,
  MessageSquare,
  FileText,
  Stethoscope,
  Sparkles,
  Wand2,
  Trash2,
} from 'lucide-react';
import { OctoLogo } from '../OctoLogo';
import { cn } from '../../lib/cn';
import { useOrchestrator } from '../../stores/orchestrator';
import type { ActiveRun, FinishedRun, RunKind } from '../../../electron/shared/types';

const KIND_META: Record<RunKind, { label: string; icon: React.ReactNode; cls: string }> = {
  task: { label: 'Task', icon: <ListChecks size={11} />, cls: 'bg-accent/15 text-accent' },
  refine: { label: 'Refine', icon: <Wand2 size={11} />, cls: 'bg-accent/15 text-accent' },
  polish: { label: 'Polish', icon: <Sparkles size={11} />, cls: 'bg-purple-500/15 text-purple-300' },
  chat: { label: 'Chat', icon: <MessageSquare size={11} />, cls: 'bg-ink-700 text-ink-200' },
  spec: { label: 'Spec', icon: <FileText size={11} />, cls: 'bg-sky-500/15 text-sky-300' },
  audit: { label: 'Audit', icon: <Stethoscope size={11} />, cls: 'bg-amber-500/15 text-amber-300' },
  hook: { label: 'Hook', icon: <Bot size={11} />, cls: 'bg-emerald-500/15 text-emerald-300' },
};

function kindMeta(kind?: RunKind) {
  return kind ? KIND_META[kind] : { label: 'Run', icon: <Bot size={11} />, cls: 'bg-ink-700 text-ink-200' };
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/**
 * Activity › Runs — the live fleet. This is a full surface, not a sidebar
 * panel: the running agents fill the width as an auto-fitting card grid and
 * the recent-activity log sits in a side rail once the window is wide enough
 * (it collapses under the grid on narrow windows).
 */
export function OrchestratorView() {
  const runs = useOrchestrator((s) => s.runs);
  const log = useOrchestrator((s) => s.log);
  const maxConcurrency = useOrchestrator((s) => s.maxConcurrency);
  const setMaxConcurrency = useOrchestrator((s) => s.setMaxConcurrency);
  const finishRun = useOrchestrator((s) => s.finishRun);
  const clearLog = useOrchestrator((s) => s.clearLog);

  const active = Object.values(runs)
    .filter((r) => r.status === 'running' || r.status === 'queued')
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  // Tick once a second so elapsed times advance while runs are live.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (active.length === 0) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active.length]);

  useEffect(() => {
    window.octo.settings.getMaxConcurrency().then(setMaxConcurrency);
  }, [setMaxConcurrency]);

  const changeConcurrency = async (n: number) => {
    const clamped = Math.max(1, Math.min(8, n));
    setMaxConcurrency(clamped);
    await window.octo.settings.setMaxConcurrency(clamped);
  };

  const cancelOne = (run: ActiveRun) => {
    window.octo.claude.cancel(run.requestId);
    finishRun(run.requestId, 'cancelled');
  };

  const stopAll = () => {
    active.forEach(cancelOne);
  };

  return (
    <div className="k-scroll">
      <div className="k-wide pb-10 pt-1">
        {/* Status strip — spans the surface instead of stacking in a column */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-elev/40 ring-1 ring-ink-800/50 px-4 py-3 mb-6">
          <div
            className={cn(
              'w-9 h-9 grid place-items-center rounded-xl shrink-0',
              active.length > 0 ? 'bg-accent/15 text-accent' : 'bg-ink-800 text-ink-400'
            )}
          >
            {active.length > 0 ? (
              <OctoLogo animated className="w-4 h-5" />
            ) : (
              <Network size={16} />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-ink-50 leading-tight">
              {active.length === 0
                ? 'Idle'
                : `${active.length} agent${active.length === 1 ? '' : 's'} running`}
            </div>
            <div className="text-[11px] text-faint">
              {active.length} / {maxConcurrency} slots in use
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-right">
              <div className="text-[11.5px] font-medium text-ink-200">Max parallel agents</div>
              <div className="text-[10px] text-faint">Wave concurrency limit</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => changeConcurrency(maxConcurrency - 1)}
                disabled={maxConcurrency <= 1}
                className="w-7 h-7 grid place-items-center rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
              >
                <Minus size={13} />
              </button>
              <span className="text-sm font-mono text-ink-50 w-5 text-center">
                {maxConcurrency}
              </span>
              <button
                onClick={() => changeConcurrency(maxConcurrency + 1)}
                disabled={maxConcurrency >= 8}
                className="w-7 h-7 grid place-items-center rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {active.length > 0 && (
            <button
              onClick={stopAll}
              className="shrink-0 text-[12px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bad/20 text-bad hover:bg-bad/30 transition"
            >
              <Square size={11} /> Stop all
            </button>
          )}
        </div>

        <div className="k-split">
          <section className="min-w-0">
            <SectionLabel>Running</SectionLabel>
            {active.length === 0 ? (
              <p className="text-[12.5px] text-faint leading-relaxed max-w-prose">
                No agents in flight. Run a task wave, draft a spec, or chat — live agents appear
                here with the option to cancel.
              </p>
            ) : (
              <div className="k-cards" style={{ ['--k-card' as string]: '300px' }}>
                {active.map((r) => (
                  <RunCard key={r.requestId} run={r} onCancel={() => cancelOne(r)} />
                ))}
              </div>
            )}
          </section>

          <aside className="min-w-0">
            <SectionLabel
              action={
                log.length > 0 ? (
                  <button
                    onClick={clearLog}
                    title="Clear log"
                    className="p-1 rounded-md text-faint hover:text-ink-100 hover:bg-elev transition"
                  >
                    <Trash2 size={12} />
                  </button>
                ) : undefined
              }
            >
              Recent activity
            </SectionLabel>
            {log.length === 0 ? (
              <p className="text-[12px] text-faint leading-relaxed">
                Finished agent runs are recorded here for the session.
              </p>
            ) : (
              <div className="space-y-0.5 rounded-xl bg-elev/30 ring-1 ring-ink-800/40 p-1.5">
                {log.map((entry) => (
                  <LogRow key={entry.requestId} entry={entry} />
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{children}</h3>
      {action}
    </div>
  );
}

function RunCard({ run, onCancel }: { run: ActiveRun; onCancel: () => void }) {
  const meta = kindMeta(run.kind);
  const elapsed = run.startedAt ? fmtDuration(Date.now() - run.startedAt) : null;

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/[0.06] p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1', meta.cls)}>
          {meta.icon}
          {meta.label}
        </span>
        {run.taskId && (
          <span className="text-[10px] font-mono text-faint">{run.taskId}</span>
        )}
        <span className="text-[10px] text-accent ml-auto flex items-center gap-1">
          <Loader2 size={10} className="animate-spin" />
          {elapsed}
        </span>
        <button
          onClick={onCancel}
          title="Cancel this run"
          className="text-faint hover:text-bad"
        >
          <X size={12} />
        </button>
      </div>
      <div className="text-[12.5px] text-ink-100 leading-snug line-clamp-2">
        {run.title ?? run.source}
      </div>
      <div className="text-[10px] text-faint mt-1 truncate">
        {run.agent ?? 'claude'}
        {run.specId ? ` · ${run.specId}` : ''}
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: FinishedRun }) {
  const meta = kindMeta(entry.kind);
  const duration =
    entry.startedAt != null ? fmtDuration(entry.endedAt - entry.startedAt) : null;
  const statusIcon =
    entry.status === 'done' ? (
      <CheckCircle2 size={12} className="text-ok" />
    ) : entry.status === 'error' ? (
      <AlertCircle size={12} className="text-bad" />
    ) : (
      <Ban size={12} className="text-faint" />
    );

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
      <span className="mt-0.5 shrink-0">{statusIcon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[9px] px-1 py-0.5 rounded flex items-center gap-1', meta.cls)}>
            {meta.label}
          </span>
          {entry.taskId && (
            <span className="text-[10px] font-mono text-faint">{entry.taskId}</span>
          )}
          {duration && <span className="text-[10px] text-ink-600 ml-auto">{duration}</span>}
        </div>
        <div className="text-[11px] text-dim leading-snug truncate">
          {entry.title ?? entry.source}
        </div>
      </div>
    </div>
  );
}
