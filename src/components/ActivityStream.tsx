import { useEffect, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  X,
  ListChecks,
  Wand2,
  Sparkles,
  MessageSquare,
  FileText,
  Stethoscope,
  Zap,
  Bot,
} from 'lucide-react';
import { useOrchestrator } from '../stores/orchestrator';
import { cn } from '../lib/cn';
import { ChatPanel } from './ChatPanel';
import type { ActiveRun, FinishedRun, RunKind } from '../../electron/shared/types';

const KIND_META: Record<RunKind, { label: string; icon: React.ReactNode }> = {
  task: { label: 'Task', icon: <ListChecks size={12} /> },
  refine: { label: 'Refine', icon: <Wand2 size={12} /> },
  polish: { label: 'Polish', icon: <Sparkles size={12} /> },
  chat: { label: 'Chat', icon: <MessageSquare size={12} /> },
  spec: { label: 'Spec', icon: <FileText size={12} /> },
  audit: { label: 'Audit', icon: <Stethoscope size={12} /> },
  hook: { label: 'Hook', icon: <Zap size={12} /> },
};

function metaFor(kind?: RunKind) {
  return (kind && KIND_META[kind]) || { label: 'Run', icon: <Bot size={12} /> };
}

function elapsed(from?: number, to?: number) {
  if (!from) return '';
  const ms = Math.max(0, (to ?? Date.now()) - from);
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function agoMs(t?: number) {
  if (!t) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * The right-hand "activity stream" — live parallel-agent runs woven together
 * with the chat conversation. The top section is the orchestrator's live + recent
 * activity; the chat thread + input lives below.
 */
export function ActivityStream() {
  return (
    <div className="h-full flex flex-col bg-panel">
      <ActivityFeed />
      <div className="flex-1 min-h-0 border-t border-line/40">
        <ChatPanel />
      </div>
    </div>
  );
}

function ActivityFeed() {
  const runs = useOrchestrator((s) => s.runs);
  const log = useOrchestrator((s) => s.log);
  const [open, setOpen] = useState(true);
  const [, tick] = useState(0);

  const active = Object.values(runs).filter(
    (r) => r.status === 'running' || r.status === 'queued'
  );

  // Re-render once a second so elapsed timers advance while runs are live.
  useEffect(() => {
    if (active.length === 0) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active.length]);

  return (
    <div className="shrink-0 max-h-[44%] flex flex-col">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3.5 h-9 text-left w-full shrink-0"
      >
        {open ? (
          <ChevronDown size={13} className="text-faint" />
        ) : (
          <ChevronRight size={13} className="text-faint" />
        )}
        <Activity size={13} className={active.length > 0 ? 'text-accent' : 'text-faint'} />
        <span className="font-mono text-[11px] tracking-[0.12em] text-faint">ACTIVITY</span>
        {active.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-accent">
            <span className="w-[6px] h-[6px] rounded-full bg-accent animate-pulse-dot" />
            {active.length} live
          </span>
        )}
      </button>

      {open && (
        <div className="overflow-y-auto px-3 py-2.5 space-y-2">
          {active.length === 0 && log.length === 0 ? (
            <p className="px-1 py-3 text-[12px] text-faint">No agent activity yet.</p>
          ) : (
            <>
              {active.map((r) => (
                <RunningCard key={r.requestId} run={r} />
              ))}
              {log.slice(0, 12).map((r) => (
                <LogRow key={r.requestId + String(r.endedAt)} run={r} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RunningCard({ run }: { run: ActiveRun }) {
  const finishRun = useOrchestrator((s) => s.finishRun);
  const m = metaFor(run.kind);
  return (
    <div className="rounded-lg bg-accent/[0.08] p-2.5 shadow-[0_0_22px_-12px_rgb(var(--accent))]">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-accent">{m.icon}</span>
        {run.taskId && <span className="font-mono text-[10px] text-accent">{run.taskId}</span>}
        <span className="font-mono text-[10px] text-faint">{run.agent ?? m.label.toLowerCase()}</span>
        <span className="ml-auto font-mono text-[10px] text-faint">{elapsed(run.startedAt)}</span>
        <button
          onClick={() => {
            void window.kraken.claude.cancel(run.requestId);
            finishRun(run.requestId, 'cancelled');
          }}
          title="Stop this run"
          className="text-faint hover:text-danger"
        >
          <X size={12} />
        </button>
      </div>
      <div className="text-[12px] text-ink-200 leading-snug line-clamp-2 mb-2">
        {run.title ?? run.source}
      </div>
      <div className="h-[3px] rounded-full bg-elev overflow-hidden">
        <div
          className="h-full w-1/2 animate-flow"
          style={{
            background:
              'linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent2)) 50%, rgb(var(--accent)))',
            backgroundSize: '200% 100%',
          }}
        />
      </div>
    </div>
  );
}

function LogRow({ run }: { run: FinishedRun }) {
  const m = metaFor(run.kind);
  const dot =
    run.status === 'done' ? 'bg-good' : run.status === 'error' ? 'bg-danger' : 'bg-ink-600';
  return (
    <div className="flex items-start gap-2.5 px-1 py-1">
      <span className={cn('mt-1.5 w-[6px] h-[6px] rounded-full shrink-0', dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-faint">
          {agoMs(run.endedAt)} · {run.agent ?? m.label.toLowerCase()}
        </div>
        <div className="text-[12px] text-dim leading-snug line-clamp-1">
          {run.title ?? run.source}
        </div>
      </div>
    </div>
  );
}
