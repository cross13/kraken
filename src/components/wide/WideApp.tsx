import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  X,
  Square,
  Contrast,
  Minimize2,
  ListChecks,
  Wand2,
  Sparkles,
  MessageSquare,
  FileText,
  Stethoscope,
  Bot,
  CheckCircle2,
  AlertCircle,
  Ban,
  Terminal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { ActiveRun, RunKind, RunRow, StreamChannel } from '../../../electron/shared/types';
import { useTheme, THEME_LABEL } from '../../stores/theme';
import { OctoLogo } from '../OctoLogo';
import { cn } from '../../lib/cn';

// A compact copy of the orchestrator's kind styling — the travel window is a
// standalone renderer, so it doesn't pull in the sidebar's OrchestratorView deps.
const KIND_META: Record<RunKind, { label: string; icon: React.ReactNode; cls: string }> = {
  task: { label: 'Task', icon: <ListChecks size={12} />, cls: 'bg-accent/15 text-accent' },
  refine: { label: 'Refine', icon: <Wand2 size={12} />, cls: 'bg-accent/15 text-accent' },
  polish: { label: 'Polish', icon: <Sparkles size={12} />, cls: 'bg-purple-500/15 text-purple-300' },
  chat: { label: 'Chat', icon: <MessageSquare size={12} />, cls: 'bg-ink-700 text-ink-200' },
  spec: { label: 'Spec', icon: <FileText size={12} />, cls: 'bg-sky-500/15 text-sky-300' },
  audit: { label: 'Audit', icon: <Stethoscope size={12} />, cls: 'bg-amber-500/15 text-amber-300' },
  hook: { label: 'Hook', icon: <Bot size={12} />, cls: 'bg-emerald-500/15 text-emerald-300' },
};

function kindMeta(kind?: RunKind) {
  return kind ? KIND_META[kind] : { label: 'Run', icon: <Bot size={12} />, cls: 'bg-ink-700 text-ink-200' };
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

type FinalStatus = 'done' | 'error' | 'cancelled';
interface LogSeg {
  channel: StreamChannel;
  text: string;
}
const MAX_SEGS = 600; // cap the per-run log buffer

const ZOOM_KEY = 'octo.wideZoom';
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.2;
const ZOOM_STEP = 0.1;

// Default the travel window's zoom to the panel: a dense display rendered ~1:1
// (devicePixelRatio ≈ 1, e.g. native 2560×720) needs a bump to stay legible;
// a HiDPI-scaled panel (dpr ≥ 1.5) is already comfortable at 1.0.
function defaultZoom(): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return dpr >= 1.5 ? 1.0 : 1.4;
}
function loadZoom(): number {
  try {
    const v = Number(localStorage.getItem(ZOOM_KEY));
    if (v >= ZOOM_MIN && v <= ZOOM_MAX) return v;
  } catch {
    // ignore
  }
  return defaultZoom();
}
function clampZoom(z: number): number {
  return Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) * 100) / 100;
}

/**
 * The Travel Display — a wide fleet monitor rendered in the second window (opened
 * by the main process onto an ultrawide secondary display). Left: the live run
 * list mirrored from the main window's orchestrator registry (`fleet.onSync`).
 * Right: the selected run's agent parameters + its live streamed log (mirrored
 * `claude:event`). Cancellation goes through the existing `claude:cancel` IPC.
 */
export function WideApp() {
  const theme = useTheme((s) => s.theme);
  const cycleTheme = useTheme((s) => s.cycleTheme);

  const [runs, setRuns] = useState<ActiveRun[]>([]);
  // Retain run metadata past the snapshot so a finished run's detail stays viewable.
  const [runsById, setRunsById] = useState<Record<string, ActiveRun>>({});
  const [finished, setFinished] = useState<Record<string, FinalStatus>>({});
  const [logs, setLogs] = useState<Record<string, LogSeg[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [zoom, setZoom] = useState<number>(loadZoom);

  // Apply (and persist) the crisp page zoom whenever it changes.
  useEffect(() => {
    window.octo.win.setZoom(zoom);
    try {
      localStorage.setItem(ZOOM_KEY, String(zoom));
    } catch {
      // ignore
    }
  }, [zoom]);
  const bumpZoom = (d: number) => setZoom((z) => clampZoom(z + d));

  // Dismiss the boot splash (index.html) — it overlays every window, but only
  // App.tsx removes it, so the travel window must clear its own.
  useEffect(() => {
    const splash = document.getElementById('boot-splash');
    if (!splash) return;
    splash.classList.add('done');
    const t = setTimeout(() => splash.remove(), 400);
    return () => clearTimeout(t);
  }, []);

  // Mirror the main window's registry, retaining metadata for finished runs.
  useEffect(
    () =>
      window.octo.fleet.onSync((snapshot) => {
        setRuns(snapshot);
        setRunsById((prev) => {
          const next = { ...prev };
          for (const r of snapshot) next[r.requestId] = r;
          return next;
        });
      }),
    []
  );

  // Mirror the live token stream so the detail column shows what each agent does.
  useEffect(() => {
    const off = window.octo.claude.onEvent((ev) => {
      if (ev.type === 'delta' && ev.text) {
        const channel = (ev.channel ?? 'text') as StreamChannel;
        const text = ev.text;
        setLogs((prev) => {
          const arr = prev[ev.requestId] ? [...prev[ev.requestId]] : [];
          const last = arr[arr.length - 1];
          if (last && last.channel === channel) {
            arr[arr.length - 1] = { channel, text: last.text + text };
          } else {
            arr.push({ channel, text });
          }
          return { ...prev, [ev.requestId]: arr.slice(-MAX_SEGS) };
        });
      } else if (ev.type === 'done' || ev.type === 'error') {
        setFinished((prev) => ({ ...prev, [ev.requestId]: ev.type === 'done' ? 'done' : 'error' }));
      }
    });
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    window.octo.settings.getModel().then(setModel).catch(() => {});
    window.octo.workspace
      .getLast()
      .then((p) => setProject(p ? p.split('/').filter(Boolean).pop() ?? null : null))
      .catch(() => {});
  }, []);

  const active = useMemo(
    () =>
      runs
        .filter((r) => r.status === 'running' || r.status === 'queued')
        .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0)),
    [runs]
  );
  const running = active.filter((r) => r.status === 'running');
  const queued = active.filter((r) => r.status === 'queued');
  const activeIds = useMemo(() => new Set(active.map((r) => r.requestId)), [active]);

  // Finished-but-still-interesting runs: metadata retained and a log to read.
  const recent = useMemo(
    () =>
      Object.values(runsById)
        .filter((r) => !activeIds.has(r.requestId) && (finished[r.requestId] || logs[r.requestId]))
        .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
        .slice(0, 8),
    [runsById, activeIds, finished, logs]
  );

  // Keep a valid selection: default to the first running run.
  useEffect(() => {
    if (selectedId && (activeIds.has(selectedId) || runsById[selectedId])) return;
    setSelectedId(active[0]?.requestId ?? recent[0]?.requestId ?? null);
  }, [selectedId, activeIds, runsById, active, recent]);

  // Tick once a second so elapsed times advance while runs are live.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (running.length === 0) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running.length]);

  const cancelOne = (run: ActiveRun) => {
    window.octo.claude.cancel(run.requestId);
    setFinished((prev) => ({ ...prev, [run.requestId]: 'cancelled' }));
    // Optimistic — the main window will also finish it and push a fresh snapshot.
    setRuns((rs) => rs.filter((r) => r.requestId !== run.requestId));
  };
  const stopAll = () => active.forEach(cancelOne);

  const selected = selectedId ? runsById[selectedId] : null;
  const selectedStatus: FinalStatus | 'running' | 'queued' | null = selected
    ? activeIds.has(selected.requestId)
      ? (selected.status as 'running' | 'queued')
      : (finished[selected.requestId] ?? 'done')
    : null;

  return (
    <div className="h-full w-full flex flex-col bg-rail text-ink-100 font-sans overflow-hidden">
      {/* Draggable top strip — the frame's status row */}
      <header className="titlebar-drag shrink-0 flex items-center gap-3 h-11 px-3.5 border-b border-ink-800/60">
        <div className="w-8 h-8 grid place-items-center rounded-[10px] octo-tile shrink-0">
          <OctoLogo animated={running.length > 0} className="w-4 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink-50 leading-tight truncate">
            {running.length === 0
              ? 'Idle'
              : `${running.length} agent${running.length === 1 ? '' : 's'} running`}
            {queued.length > 0 && (
              <span className="text-faint font-normal"> · {queued.length} queued</span>
            )}
          </div>
          <div className="text-[10px] text-ink-500 truncate">
            {project ?? 'No project'}
            {model ? ` · ${model}` : ''}
          </div>
        </div>

        <div className="flex-1" />

        <div className="titlebar-nodrag flex items-center gap-1.5">
          {active.length > 0 && (
            <button
              onClick={stopAll}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-bad/20 text-bad hover:bg-bad/30 transition"
            >
              <Square size={11} /> Stop all
            </button>
          )}
          {/* Crisp zoom — dial the UI to the physical panel */}
          <div className="flex items-center rounded-lg bg-ink-50/[0.05] mr-0.5">
            <IconBtn onClick={() => bumpZoom(-ZOOM_STEP)} title="Smaller">
              <ZoomOut size={14} />
            </IconBtn>
            <button
              onClick={() => setZoom(defaultZoom())}
              title="Reset zoom"
              className="text-[10.5px] font-mono text-faint hover:text-ink-100 w-9 text-center tabular-nums"
            >
              {Math.round(zoom * 100)}%
            </button>
            <IconBtn onClick={() => bumpZoom(ZOOM_STEP)} title="Larger">
              <ZoomIn size={14} />
            </IconBtn>
          </div>
          <IconBtn onClick={cycleTheme} title={`Theme: ${THEME_LABEL[theme]}`}>
            <Contrast size={15} />
          </IconBtn>
          <IconBtn onClick={() => window.octo.win.toggleWide()} title="Close Travel Display">
            <Minimize2 size={15} />
          </IconBtn>
        </div>
      </header>

      {/* Master-detail: run list (left) + selected run's params & live log (right) */}
      <div className="flex-1 min-h-0 flex gap-3 px-3.5 py-3">
        {/* Left: the run list */}
        <div className="w-[320px] shrink-0 flex flex-col gap-3 overflow-y-auto pr-0.5">
          {active.length === 0 && recent.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {active.length > 0 && (
                <Section label={`In flight · ${active.length}`}>
                  {active.map((r) => (
                    <RunRow
                      key={r.requestId}
                      run={r}
                      status={r.status as 'running' | 'queued'}
                      selected={selectedId === r.requestId}
                      onSelect={() => setSelectedId(r.requestId)}
                      onCancel={() => cancelOne(r)}
                    />
                  ))}
                </Section>
              )}
              {recent.length > 0 && (
                <Section label="Recent">
                  {recent.map((r) => (
                    <RunRow
                      key={r.requestId}
                      run={r}
                      status={finished[r.requestId] ?? 'done'}
                      selected={selectedId === r.requestId}
                      onSelect={() => setSelectedId(r.requestId)}
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        {/* Right: detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <RunDetail
              run={selected}
              status={selectedStatus ?? 'done'}
              segs={logs[selected.requestId] ?? []}
            />
          ) : (
            <div className="h-full grid place-items-center rounded-xl border border-ink-800 bg-ink-900/40">
              <p className="text-[12px] text-ink-500">Select a run to see its log and parameters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1.5 px-0.5">
        {label}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function RunRow({
  run,
  status,
  selected,
  onSelect,
  onCancel,
}: {
  run: ActiveRun;
  status: 'running' | 'queued' | FinalStatus;
  selected: boolean;
  onSelect: () => void;
  onCancel?: () => void;
}) {
  const meta = kindMeta(run.kind);
  const isRunning = status === 'running';
  const elapsed = run.startedAt ? fmtDuration(Date.now() - run.startedAt) : null;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-lg border p-2.5 transition',
        selected
          ? 'border-accent/50 bg-accent/[0.10]'
          : isRunning
            ? 'border-accent/25 bg-accent/[0.05] hover:bg-accent/[0.08]'
            : 'border-ink-800 bg-ink-900/50 hover:bg-ink-800/50'
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1', meta.cls)}>
          {meta.icon}
          {meta.label}
        </span>
        {run.taskId && <span className="text-[10px] font-mono text-ink-500">{run.taskId}</span>}
        <span className="ml-auto flex items-center gap-1 text-[10px]">
          <StatusMark status={status} />
          <span className={isRunning ? 'text-accent' : 'text-ink-500'}>
            {isRunning ? elapsed : status === 'queued' ? 'queued' : status}
          </span>
        </span>
        {onCancel && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            title="Cancel this run"
            className="text-ink-600 hover:text-bad"
          >
            <X size={12} />
          </span>
        )}
      </div>
      <div className="text-[12px] text-ink-100 leading-snug line-clamp-2">
        {run.title ?? run.source}
      </div>
      <div className="text-[10px] text-ink-500 mt-0.5 truncate">
        {run.agent ?? 'claude'}
        {run.specId ? ` · ${run.specId}` : ''}
      </div>
    </button>
  );
}

function StatusMark({ status }: { status: 'running' | 'queued' | FinalStatus }) {
  if (status === 'running') return <Loader2 size={11} className="animate-spin text-accent" />;
  if (status === 'queued') return <Square size={9} className="text-ink-500" />;
  if (status === 'done') return <CheckCircle2 size={11} className="text-ok" />;
  if (status === 'error') return <AlertCircle size={11} className="text-bad" />;
  return <Ban size={11} className="text-ink-500" />;
}

function joinJsonList(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.join(', ') : String(raw);
  } catch {
    return raw;
  }
}

function RunDetail({
  run,
  status,
  segs,
}: {
  run: ActiveRun;
  status: 'running' | 'queued' | FinalStatus;
  segs: LogSeg[];
}) {
  const meta = kindMeta(run.kind);

  // The DB mirrors every run's streamed output (keyed by requestId) plus richer
  // parameters. We poll it as a fallback so the log shows even for runs that
  // started before this window opened — or that already finished — and to surface
  // the exact tools / permission mode the agent ran with.
  const [row, setRow] = useState<RunRow | null>(null);
  useEffect(() => {
    setRow(null);
    let alive = true;
    const fetchRow = () =>
      window.octo.history
        .getRun(run.requestId)
        .then((r) => {
          if (alive) setRow(r);
        })
        .catch(() => {});
    fetchRow();
    if (status !== 'running') return () => {
      alive = false;
    };
    const t = setInterval(fetchRow, 1200);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [run.requestId, status]);

  const params: [string, string | null | undefined][] = [
    ['Agent', run.agent ?? 'claude'],
    ['Model', run.model ?? row?.resolved_model ?? row?.model],
    ['Backend', row?.backend],
    ['Kind', run.kind],
    ['Skill', run.skill],
    ['Source', run.source],
    ['Spec', run.specId],
    ['Task', run.taskId],
    ['Wave', run.wave],
    ['Route', run.routeReason ?? row?.route_reason],
    ['Agent scope', run.agentScope ?? row?.agent_scope],
    ['Skill scope', run.skillScope ?? row?.skill_scope],
    ['Permission', row?.permission_mode],
    ['Tools', joinJsonList(row?.tools)],
    ['Depends on', run.dependsOn?.length ? run.dependsOn.join(', ') : joinJsonList(row?.depends_on)],
    ['Request', run.requestId],
  ];

  return (
    <div className="h-full flex flex-col rounded-xl border border-ink-800 bg-ink-900/40 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-2.5 border-b border-ink-800/70">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1', meta.cls)}>
            {meta.icon}
            {meta.label}
          </span>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-400">
            <StatusMark status={status} />
            {status}
          </span>
        </div>
        <div className="text-[13px] font-semibold text-ink-50 leading-snug">
          {run.title ?? run.source}
        </div>

        {/* Parameters */}
        <div className="mt-2.5 grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-1">
          {params
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => (
              <div key={k} className="min-w-0 flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-ink-500 shrink-0">{k}</span>
                <span className="text-[11px] text-ink-200 font-mono truncate" title={String(v)}>
                  {v}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Live log — live deltas when present, else the DB-recorded output */}
      <LogView
        segs={segs}
        fallback={row?.response ?? null}
        error={row?.error ?? null}
        live={status === 'running'}
      />
    </div>
  );
}

const CHANNEL_CLS: Record<StreamChannel, string> = {
  text: 'text-ink-200',
  thinking: 'text-ink-500 italic',
  tool: 'text-accent',
  tool_result: 'text-ink-400',
};

function LogView({
  segs,
  fallback,
  error,
  live,
}: {
  segs: LogSeg[];
  fallback: string | null;
  error: string | null;
  live: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const hasLive = segs.length > 0;
  const hasFallback = !hasLive && !!(fallback && fallback.trim());

  // Auto-scroll to the newest output unless the user has scrolled up to read.
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [segs, fallback]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="flex-1 min-h-0 overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed"
    >
      {error && (
        <pre className="whitespace-pre-wrap break-words text-bad mb-2">{error}</pre>
      )}
      {!hasLive && !hasFallback && !error ? (
        <div className="h-full grid place-items-center text-ink-600">
          <div className="flex items-center gap-2 text-[11px]">
            <Terminal size={13} />
            {live ? 'Waiting for output…' : 'No output captured for this run.'}
          </div>
        </div>
      ) : hasFallback ? (
        <pre className="whitespace-pre-wrap break-words text-ink-200">{fallback}</pre>
      ) : (
        <pre className="whitespace-pre-wrap break-words">
          {segs.map((s, i) => (
            <span key={i} className={CHANNEL_CLS[s.channel]}>
              {s.text}
            </span>
          ))}
        </pre>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 grid place-items-center">
      <div className="text-center px-2">
        <div className="mx-auto mb-3 w-11 h-11 grid place-items-center rounded-xl bg-ink-800 text-ink-500">
          <Bot size={20} />
        </div>
        <p className="text-sm text-ink-300 font-medium">No agents in flight</p>
        <p className="text-[11px] text-ink-500 mt-1">
          Run a task wave, draft a spec, or chat on your main screen — live runs land here.
        </p>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 grid place-items-center rounded-lg text-faint hover:text-ink-100 hover:bg-ink-50/[0.06] transition"
    >
      {children}
    </button>
  );
}
