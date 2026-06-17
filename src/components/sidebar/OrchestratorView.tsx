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
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';
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
    window.kraken.settings.getMaxConcurrency().then(setMaxConcurrency);
  }, [setMaxConcurrency]);

  const changeConcurrency = async (n: number) => {
    const clamped = Math.max(1, Math.min(8, n));
    setMaxConcurrency(clamped);
    await window.kraken.settings.setMaxConcurrency(clamped);
  };

  const cancelOne = (run: ActiveRun) => {
    window.kraken.claude.cancel(run.requestId);
    finishRun(run.requestId, 'cancelled');
  };

  const stopAll = () => {
    active.forEach(cancelOne);
  };

  return (
    <>
      <SidebarHeader
        title="Orchestrator"
        actions={
          active.length > 0 ? (
            <button
              onClick={stopAll}
              className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-bad/20 text-bad hover:bg-bad/30"
            >
              <Square size={10} /> Stop all
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* Control strip */}
        <div className="px-3 py-2.5 border-b border-ink-800/60 space-y-2.5">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-7 h-7 grid place-items-center rounded-lg shrink-0',
                active.length > 0 ? 'bg-accent/15 text-accent' : 'bg-ink-800 text-ink-400'
              )}
            >
              {active.length > 0 ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Network size={14} />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink-50 leading-tight">
                {active.length === 0
                  ? 'Idle'
                  : `${active.length} agent${active.length === 1 ? '' : 's'} running`}
              </div>
              <div className="text-[10px] text-ink-500">
                {active.length} / {maxConcurrency} slots in use
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-ink-200">Max parallel agents</div>
              <div className="text-[10px] text-ink-500">Wave concurrency limit.</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => changeConcurrency(maxConcurrency - 1)}
                disabled={maxConcurrency <= 1}
                className="w-6 h-6 grid place-items-center rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
              >
                <Minus size={12} />
              </button>
              <span className="text-sm font-mono text-ink-50 w-4 text-center">
                {maxConcurrency}
              </span>
              <button
                onClick={() => changeConcurrency(maxConcurrency + 1)}
                disabled={maxConcurrency >= 8}
                className="w-6 h-6 grid place-items-center rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Running */}
        <section className="px-3 py-3 border-b border-ink-800/60">
          <h3 className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-2">
            Running
          </h3>
          {active.length === 0 ? (
            <p className="text-[11px] text-ink-500 leading-snug">
              No agents in flight. Run a task wave, draft a spec, or chat — live agents
              appear here with the option to cancel.
            </p>
          ) : (
            <div className="space-y-1.5">
              {active.map((r) => (
                <RunCard key={r.requestId} run={r} onCancel={() => cancelOne(r)} />
              ))}
            </div>
          )}
        </section>

        {/* Activity log */}
        <section className="px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
              Recent activity
            </h3>
            {log.length > 0 && (
              <SidebarButton title="Clear log" onClick={clearLog}>
                <Trash2 size={12} />
              </SidebarButton>
            )}
          </div>
          {log.length === 0 ? (
            <SidebarEmpty
              title="Nothing yet"
              description="Finished agent runs are recorded here for the session."
            />
          ) : (
            <div className="space-y-1">
              {log.map((entry) => (
                <LogRow key={entry.requestId} entry={entry} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function RunCard({ run, onCancel }: { run: ActiveRun; onCancel: () => void }) {
  const meta = kindMeta(run.kind);
  const elapsed = run.startedAt ? fmtDuration(Date.now() - run.startedAt) : null;

  return (
    <div className="rounded-md border border-accent/30 bg-accent/[0.06] p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1', meta.cls)}>
          {meta.icon}
          {meta.label}
        </span>
        {run.taskId && (
          <span className="text-[10px] font-mono text-ink-500">{run.taskId}</span>
        )}
        <span className="text-[10px] text-accent ml-auto flex items-center gap-1">
          <Loader2 size={10} className="animate-spin" />
          {elapsed}
        </span>
        <button
          onClick={onCancel}
          title="Cancel this run"
          className="text-ink-500 hover:text-bad"
        >
          <X size={12} />
        </button>
      </div>
      <div className="text-xs text-ink-100 leading-snug line-clamp-2">
        {run.title ?? run.source}
      </div>
      <div className="text-[10px] text-ink-500 mt-0.5">
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
      <Ban size={12} className="text-ink-500" />
    );

  return (
    <div className="flex items-start gap-2 px-1.5 py-1 rounded-md hover:bg-ink-800/40">
      <span className="mt-0.5 shrink-0">{statusIcon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[9px] px-1 py-0.5 rounded flex items-center gap-1', meta.cls)}>
            {meta.label}
          </span>
          {entry.taskId && (
            <span className="text-[10px] font-mono text-ink-500">{entry.taskId}</span>
          )}
          {duration && <span className="text-[10px] text-ink-600 ml-auto">{duration}</span>}
        </div>
        <div className="text-[11px] text-ink-300 leading-snug truncate">
          {entry.title ?? entry.source}
        </div>
      </div>
    </div>
  );
}
