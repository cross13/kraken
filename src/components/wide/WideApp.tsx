import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  Terminal,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  Waves,
  Pause,
} from 'lucide-react';
import type { ActiveRun, RunKind, RunRow, StreamChannel } from '../../../electron/shared/types';
import { useTheme, THEME_LABEL } from '../../stores/theme';
import { OctoMark } from '../OctoMark';
import { OctoMascot, type MascotState } from './OctoMascot';
import { cn } from '../../lib/cn';

// ---------------------------------------------------------------------------
// Kinds, status, and the small formatters. A compact copy of the orchestrator's
// styling — the travel window is a standalone renderer and pulls in no sidebar.
// ---------------------------------------------------------------------------

const KIND_META: Record<RunKind, { label: string; icon: React.ReactNode }> = {
  task: { label: 'Task', icon: <ListChecks size={11} /> },
  refine: { label: 'Refine', icon: <Wand2 size={11} /> },
  polish: { label: 'Polish', icon: <Sparkles size={11} /> },
  chat: { label: 'Chat', icon: <MessageSquare size={11} /> },
  spec: { label: 'Spec', icon: <FileText size={11} /> },
  audit: { label: 'Audit', icon: <Stethoscope size={11} /> },
  hook: { label: 'Hook', icon: <Bot size={11} /> },
};
function kindMeta(kind?: RunKind) {
  return kind ? KIND_META[kind] : { label: 'Run', icon: <Bot size={11} /> };
}
/** Kinds that read as "deciding" rather than "executing" — violet, per the brand. */
const THINKING_KINDS: RunKind[] = ['spec', 'audit'];

type FinalStatus = 'done' | 'error' | 'cancelled';
type RunStatus = 'running' | 'queued' | FinalStatus;

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

interface LogSeg {
  channel: StreamChannel;
  text: string;
}
const MAX_SEGS = 600; // cap the per-run log buffer
const MAX_REEF = 8; // finished runs still worth a spot on the reef

// ---------------------------------------------------------------------------
// What is this agent doing *right now*? — the speech bubble.
// ---------------------------------------------------------------------------

/**
 * Tool deltas arrive as the markdown `summarizeToolUse` builds in the main
 * process (a bolded tool name plus a backticked path, or a fenced block for
 * Bash). A bubble has room for a phrase, not markdown — so unwrap it back to
 * "Edit src/lib/session.ts" / "Bash npm run typecheck".
 */
function toolHeadline(raw: string): string {
  const s = raw.replace(/\p{Extended_Pictographic}/gu, ' ').trim();
  const fenced = s.match(/```[a-z]*\n([\s\S]*?)```/);
  if (fenced) {
    const name = s.match(/\*\*([^*]+)\*\*/)?.[1]?.trim() ?? 'Bash';
    const cmd = fenced[1].trim().split('\n')[0];
    return `${name} ${cmd}`.trim();
  }
  return s.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

function firstLine(raw: string): string {
  return raw.replace(/```[a-z]*/g, '').replace(/\s+/g, ' ').trim();
}
function clip(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Headline + subline for a live run: the tool it called, then its newest output. */
function speech(segs: LogSeg[]): { title: string; sub: string | null } | null {
  if (segs.length === 0) return null;
  let title: string | null = null;
  for (let i = segs.length - 1; i >= 0; i--) {
    if (segs[i].channel === 'tool') {
      title = toolHeadline(segs[i].text);
      break;
    }
  }
  const lines = segs[segs.length - 1].text.split('\n').filter((l) => l.trim());
  const newest = lines.length ? firstLine(lines[lines.length - 1]) : '';
  if (!title) return newest ? { title: clip(newest, 38), sub: null } : null;
  const sub = newest && toolHeadline(newest) !== title ? clip(newest, 44) : null;
  return { title: clip(title, 38), sub };
}

// ---------------------------------------------------------------------------
// Placement — where a creature lives, and why.
// ---------------------------------------------------------------------------

interface Critter {
  run: ActiveRun;
  status: RunStatus;
  state: MascotState;
  /** task ids this one is waiting on */
  blockedBy: string[];
}
interface Placed extends Critter {
  /** percent of the zone box — the zone is the spec, so position means something */
  x: number;
  y: number;
  /** negative animation delay, so no two neighbours move in lockstep */
  delay: number;
}

/** Stable per-run pseudo-random, so a creature never jumps between renders. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function mascotState(c: { status: RunStatus; run: ActiveRun }): MascotState {
  if (c.status === 'error') return 'fail';
  if (c.status === 'done') return 'done';
  if (c.status === 'queued' || c.status === 'cancelled') return 'sleep';
  return THINKING_KINDS.includes(c.run.kind ?? 'chat') ? 'think' : 'work';
}
const isLively = (s: MascotState) => s === 'work' || s === 'think';

/**
 * Live work roams the upper band of its zone, blocked work sleeps in the lower
 * right — so a glance reads "who is moving" before reading a single word.
 */
function place(critters: Critter[]): Placed[] {
  const spread = (list: Critter[], x0: number, span: number, y0: number) =>
    list.map((c, i) => {
      const h = hash(c.run.requestId);
      const x = list.length === 1 ? x0 + span / 2 : x0 + (i * span) / (list.length - 1);
      return {
        ...c,
        x: Math.min(78, Math.max(6, x)),
        y: y0 + (h % 10),
        delay: -((h % 90) / 10),
      };
    });
  const live = critters.filter((c) => isLively(c.state));
  const idle = critters.filter((c) => !isLively(c.state));
  return [...spread(live, 10, 56, 28), ...spread(idle, 44, 36, 55)];
}

// ---------------------------------------------------------------------------
// Zones — one per spec, plus one for everything that has no spec.
// ---------------------------------------------------------------------------

const SYSTEM_ZONE = ' system';
const zoneKey = (r: ActiveRun) => r.specId ?? SYSTEM_ZONE;

type Seg = 'done' | 'run' | 'wait' | 'bad' | 'none';
interface Zone {
  key: string;
  label: string;
  sub: string;
  segs: Seg[];
  critters: Placed[];
}

const ZOOM_KEY = 'octo.wideZoom';
const QUIET_KEY = 'octo.wideQuiet';
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.2;
const ZOOM_STEP = 0.1;

// A dense panel rendered ~1:1 (2560x720, devicePixelRatio around 1) needs a bump
// to stay legible; a HiDPI-scaled panel is already comfortable at 1.0.
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
function loadQuiet(): boolean {
  try {
    const v = localStorage.getItem(QUIET_KEY);
    if (v != null) return v === '1';
  } catch {
    // ignore
  }
  return typeof window !== 'undefined'
    ? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    : false;
}
const clampZoom = (z: number) => Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) * 100) / 100;

/**
 * The Travel Display — the fleet as a **colony**. Every run in flight is an
 * octopus, and everything the creature does carries meaning: which zone it
 * lives in is the spec it belongs to, the dashed violet leash is what it is
 * waiting on, its face is its status (scanning eyes while working, shut with
 * "zzz" while queued, crossed out when it failed), and its speech bubble is the
 * tool it is running right now. Click one and it opens: its full run detail on
 * the left, the colony compressed but still visible on the right.
 *
 * The registry is mirrored from the main window (`fleet.onSync`, pulled once on
 * mount); cancellation goes through the existing `claude:cancel` IPC.
 */
export function WideApp() {
  const theme = useTheme((s) => s.theme);
  const cycleTheme = useTheme((s) => s.cycleTheme);

  const [runs, setRuns] = useState<ActiveRun[]>([]);
  const [maxConcurrency, setMaxConcurrency] = useState(2);
  // Retain run metadata past the snapshot so a finished creature keeps its face.
  const [runsById, setRunsById] = useState<Record<string, ActiveRun>>({});
  const [finished, setFinished] = useState<Record<string, { status: FinalStatus; at: number }>>({});
  const [logs, setLogs] = useState<Record<string, LogSeg[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [zoom, setZoom] = useState<number>(loadZoom);
  const [quiet, setQuiet] = useState<boolean>(loadQuiet);

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

  useEffect(() => {
    try {
      localStorage.setItem(QUIET_KEY, quiet ? '1' : '0');
    } catch {
      // ignore
    }
  }, [quiet]);

  // Dismiss the boot splash (index.html) — it overlays every window, but only
  // App.tsx removes it, so the travel window must clear its own.
  useEffect(() => {
    const splash = document.getElementById('boot-splash');
    if (!splash) return;
    splash.classList.add('done');
    const t = setTimeout(() => splash.remove(), 400);
    return () => clearTimeout(t);
  }, []);

  // Mirror the main window's registry. It only pushes on *change*, so we also
  // pull the cached snapshot once subscribed — otherwise a display opened
  // mid-run stays empty until something starts or finishes.
  useEffect(() => {
    const off = window.octo.fleet.onSync((snapshot) => {
      setRuns(snapshot.runs);
      setMaxConcurrency(snapshot.maxConcurrency);
      setRunsById((prev) => {
        const next = { ...prev };
        for (const r of snapshot.runs) next[r.requestId] = r;
        return next;
      });
    });
    window.octo.fleet.request();
    return off;
  }, []);

  // Mirror the live token stream — this is what fills the speech bubbles.
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
        setFinished((prev) => ({
          ...prev,
          [ev.requestId]: { status: ev.type === 'done' ? 'done' : 'error', at: Date.now() },
        }));
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
  const isOrchestrated = (r: ActiveRun) =>
    r.kind === 'task' || r.kind === 'refine' || r.kind === 'polish';
  const taskRunning = running.filter(isOrchestrated).length;
  const taskQueued = queued.filter(isOrchestrated).length;

  const statusOf = useCallback(
    (run: ActiveRun): RunStatus =>
      activeIds.has(run.requestId)
        ? (run.status as 'running' | 'queued')
        : (finished[run.requestId]?.status ?? 'done'),
    [activeIds, finished]
  );

  // ---- the colony, grouped by spec -----------------------------------------
  const zones = useMemo<Zone[]>(() => {
    const order: string[] = [];
    const byZone = new Map<string, Critter[]>();
    for (const run of active) {
      const key = zoneKey(run);
      if (!byZone.has(key)) {
        byZone.set(key, []);
        order.push(key);
      }
      const status = run.status as 'running' | 'queued';
      byZone.get(key)!.push({
        run,
        status,
        state: mascotState({ status, run }),
        blockedBy: run.dependsOn ?? [],
      });
    }
    // Runs with no spec (chat, hooks, stray audits) always sit last.
    order.sort((a, b) => (a === SYSTEM_ZONE ? 1 : b === SYSTEM_ZONE ? -1 : 0));

    return order.map((key) => {
      const members = byZone.get(key)!;
      // Everything this window has ever seen for the zone drives the progress row.
      const segs: Seg[] = Object.values(runsById)
        .filter((r) => zoneKey(r) === key)
        .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
        .slice(-10)
        .map((r) => {
          const st = statusOf(r);
          if (st === 'running') return 'run';
          if (st === 'queued') return 'wait';
          if (st === 'error') return 'bad';
          if (st === 'done') return 'done';
          return 'none';
        });
      const wave = members.find((c) => c.run.wave)?.run.wave;
      const nRun = members.filter((c) => c.status === 'running').length;
      const nWait = members.length - nRun;
      return {
        key,
        label: key === SYSTEM_ZONE ? 'Assistant & system' : key,
        sub: [wave, `${nRun} running`, nWait ? `${nWait} waiting` : null]
          .filter(Boolean)
          .join(' · '),
        segs,
        critters: place(members),
      };
    });
  }, [active, runsById, statusOf]);

  // ---- the reef: finished, but still worth a look --------------------------
  const reef = useMemo(
    () =>
      Object.values(runsById)
        .filter((r) => !activeIds.has(r.requestId) && (finished[r.requestId] || logs[r.requestId]))
        .sort((a, b) => (finished[b.requestId]?.at ?? 0) - (finished[a.requestId]?.at ?? 0))
        .slice(0, MAX_REEF),
    [runsById, activeIds, finished, logs]
  );

  // Tick once a second so elapsed times advance while runs are live.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (running.length === 0) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running.length]);

  const cancelOne = useCallback((run: ActiveRun) => {
    window.octo.claude.cancel(run.requestId);
    setFinished((prev) => ({ ...prev, [run.requestId]: { status: 'cancelled', at: Date.now() } }));
    // Optimistic — the main window will also finish it and push a fresh snapshot.
    setRuns((rs) => rs.filter((r) => r.requestId !== run.requestId));
  }, []);
  const stopAll = () => active.forEach(cancelOne);

  // Esc surfaces from an opened run back to the colony.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  const opened = openId ? runsById[openId] : null;
  const compact = !!opened;
  /** Click opens a creature; clicking the open one again puts it back. */
  const toggleOpen = useCallback(
    (id: string) => setOpenId((prev) => (prev === id ? null : id)),
    []
  );

  const colony = (
    <>
      <div
        className="flex-1 min-h-0 grid gap-3"
        style={{
          gridTemplateColumns: compact
            ? 'repeat(2, minmax(0, 1fr))'
            : zones.length === 0
              ? '1fr'
              : zones.map((z) => `${Math.max(1, z.critters.length)}fr`).join(' '),
          gridAutoRows: compact ? 'minmax(0, 1fr)' : undefined,
        }}
      >
        {zones.length === 0 && (
          <div className="grid place-items-center border border-dashed border-ink-800 bg-ink-950 text-[12px] text-ink-500">
            Nothing in flight — the colony just finished.
          </div>
        )}
        {zones.map((z) => (
          <ZoneBox
            key={z.key}
            zone={z}
            compact={compact}
            openId={openId}
            logs={logs}
            onOpen={toggleOpen}
            onCancel={cancelOne}
          />
        ))}
      </div>
      {!compact && reef.length > 0 && (
        <Reef runs={reef} statusOf={statusOf} finished={finished} onOpen={toggleOpen} />
      )}
    </>
  );

  return (
    <div
      className={cn(
        'h-full w-full flex flex-col bg-rail text-ink-100 font-sans overflow-hidden',
        quiet && 'k-quiet'
      )}
    >
      {/* Draggable top strip — the frame's status row */}
      <header className="titlebar-drag shrink-0 flex items-center gap-3 h-12 px-4 border-b border-ink-800/60">
        {opened ? (
          <button
            onClick={() => setOpenId(null)}
            className="titlebar-nodrag flex items-center gap-1.5 text-[12px] px-2.5 h-[26px] border border-accent/40 bg-accent/[0.12] text-accent-text hover:bg-accent/20 transition shrink-0"
          >
            <ArrowLeft size={12} /> Back to the colony
          </button>
        ) : (
          <div className="w-[30px] h-[30px] grid place-items-center octo-tile shrink-0">
            <OctoMark animated={running.length > 0 && !quiet} className="w-[20px]" />
          </div>
        )}

        <div className="min-w-0">
          <div className="text-[15px] font-display font-semibold text-ink-50 leading-tight truncate">
            {running.length === 0
              ? 'Idle'
              : `${running.length} agent${running.length === 1 ? '' : 's'} running`}
            {queued.length > 0 && (
              <span className="text-agent-text font-medium"> · {queued.length} queued</span>
            )}
          </div>
          <div className="text-[11px] text-ink-500 font-mono truncate">
            {project ?? 'No project'}
            {model ? ` · ${model}` : ''}
          </div>
        </div>

        <Divider />
        <SlotMeter running={taskRunning} queued={taskQueued} max={maxConcurrency} />
        <Divider />
        <div className="flex items-center gap-2 text-[11px] text-ink-500 shrink-0">
          <span className="block w-[22px] border-t-[1.5px] border-dashed border-agent/70" />
          waiting on
        </div>

        <div className="flex-1" />

        <div className="titlebar-nodrag flex items-center gap-1.5">
          {active.length > 0 && (
            <button
              onClick={stopAll}
              className="flex items-center gap-1.5 text-[12px] px-2.5 h-[26px] border border-danger/50 bg-danger/[0.12] text-danger-text hover:bg-danger/20 transition"
            >
              <Square size={11} fill="currentColor" /> Stop all
            </button>
          )}
          <IconBtn
            onClick={() => setQuiet((q) => !q)}
            title={
              quiet ? 'Quiet mode — the colony is holding still' : 'Quiet mode: stop the drifting'
            }
            active={quiet}
          >
            {quiet ? <Pause size={15} /> : <Waves size={15} />}
          </IconBtn>
          <div className="flex items-center border border-ink-700 h-[26px] text-faint">
            <IconBtn onClick={() => bumpZoom(-ZOOM_STEP)} title="Smaller" flush>
              <ZoomOut size={14} />
            </IconBtn>
            <button
              onClick={() => setZoom(defaultZoom())}
              title="Reset zoom"
              className="text-[11px] font-mono text-faint hover:text-ink-100 w-11 h-full border-x border-ink-700 tabular-nums"
            >
              {Math.round(zoom * 100)}%
            </button>
            <IconBtn onClick={() => bumpZoom(ZOOM_STEP)} title="Larger" flush>
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

      {/* The tank */}
      <div className="flex-1 min-h-0 flex flex-col gap-3 px-3.5 py-3">
        {zones.length === 0 && reef.length === 0 ? (
          <EmptyState />
        ) : opened ? (
          <div
            className="flex-1 min-h-0 grid gap-3"
            style={{ gridTemplateColumns: 'minmax(380px, 46%) minmax(0, 1fr)' }}
          >
            <FocusPanel
              run={opened}
              status={statusOf(opened)}
              segs={logs[opened.requestId] ?? []}
              onCancel={activeIds.has(opened.requestId) ? () => cancelOne(opened) : undefined}
            />
            <div className="flex flex-col min-h-0">{colony}</div>
          </div>
        ) : (
          colony
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-[26px] bg-ink-800 shrink-0" />;
}

/**
 * The task-slot meter: how much of the orchestrator's wave concurrency is in
 * use. Filled = running, violet = queued and waiting for a slot.
 */
function SlotMeter({ running, queued, max }: { running: number; queued: number; max: number }) {
  const slots = Array.from({ length: Math.max(max, running) }, (_, i) =>
    i < running ? 'on' : i < running + queued ? 'wait' : 'off'
  );
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <div className="flex gap-[3px]">
        {slots.map((s, i) => (
          <span
            key={i}
            className={cn(
              'block w-[7px] h-4',
              s === 'on' ? 'bg-accent' : s === 'wait' ? 'bg-agent/55' : 'bg-ink-800'
            )}
          />
        ))}
      </div>
      <span className="text-[11px] text-ink-500 font-mono">
        {running}
        <span className="text-ink-700">/</span>
        {max} task slots
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A zone — one spec's stretch of seabed.
// ---------------------------------------------------------------------------

function ZoneBox({
  zone,
  compact,
  openId,
  logs,
  onOpen,
  onCancel,
}: {
  zone: Zone;
  compact: boolean;
  openId: string | null;
  logs: Record<string, LogSeg[]>;
  onOpen: (id: string) => void;
  onCancel: (run: ActiveRun) => void;
}) {
  // A leash runs from a sleeping creature to whatever it is waiting on. Both
  // ends are zone percentages, nudged towards the body's centre.
  const leashes = useMemo(() => {
    const byTask = new Map<string, Placed>();
    for (const c of zone.critters) if (c.run.taskId) byTask.set(c.run.taskId, c);
    const out: { id: string; d: string }[] = [];
    for (const c of zone.critters) {
      if (isLively(c.state)) continue;
      for (const dep of c.blockedBy) {
        const target = byTask.get(dep);
        if (!target) continue;
        const sx = c.x + 2.5;
        const sy = c.y + 7;
        const tx = target.x + 2.5;
        const ty = target.y + 7;
        const mx = (sx + tx) / 2;
        out.push({
          id: `${c.run.requestId}-${dep}`,
          d: `M ${sx},${sy} C ${mx},${sy} ${mx},${ty} ${tx},${ty}`,
        });
      }
    }
    return out;
  }, [zone.critters]);

  const live = zone.critters.some((c) => isLively(c.state));

  return (
    <div
      className={cn(
        'relative min-w-0 min-h-0 overflow-hidden border border-dashed bg-ink-950',
        live ? 'border-accent/25' : 'border-ink-800'
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-[4] flex items-center gap-2 min-w-0',
          compact ? 'px-2.5 pt-1.5' : 'px-3 pt-2'
        )}
      >
        <span
          className={cn(
            'font-display font-semibold text-ink-200 truncate',
            compact ? 'text-[12.5px]' : 'text-[14px]'
          )}
        >
          {zone.label}
        </span>
        <span className={cn('text-ink-500 truncate', compact ? 'text-[10px]' : 'text-[11px]')}>
          {zone.sub}
        </span>
        <span className="flex-1" />
        <span className={cn('flex gap-[2px] shrink-0', compact ? 'w-[62px]' : 'w-24')}>
          {zone.segs.map((s, i) => (
            <span
              key={i}
              className={cn(
                'flex-1 h-[3px]',
                s === 'done'
                  ? 'bg-accent'
                  : s === 'run'
                    ? 'bg-accent-num'
                    : s === 'wait'
                      ? 'bg-agent/55'
                      : s === 'bad'
                        ? 'bg-danger'
                        : 'bg-ink-800'
              )}
            />
          ))}
        </span>
      </div>

      {leashes.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full z-[1] pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {leashes.map((l) => (
            <path key={l.id} d={l.d} className="k-leash" />
          ))}
        </svg>
      )}

      {zone.critters.map((c) => (
        <CritterView
          key={c.run.requestId}
          critter={c}
          compact={compact}
          open={openId === c.run.requestId}
          segs={logs[c.run.requestId] ?? []}
          onOpen={() => onOpen(c.run.requestId)}
          onCancel={() => onCancel(c.run)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One creature.
// ---------------------------------------------------------------------------

function CritterView({
  critter,
  compact,
  open,
  segs,
  onOpen,
  onCancel,
}: {
  critter: Placed;
  compact: boolean;
  open: boolean;
  segs: LogSeg[];
  onOpen: () => void;
  onCancel: () => void;
}) {
  const { run, state, status } = critter;
  const meta = kindMeta(run.kind);
  const lively = isLively(state);
  const said = lively ? speech(segs) : null;
  const elapsed = run.startedAt ? fmtClock(Date.now() - run.startedAt) : null;
  // Anchor the bubble inward when the creature sits near a zone edge.
  const side = critter.x > 58 ? 'r' : critter.x < 16 ? 'l' : 'mid';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      title={run.title ?? run.source}
      className={cn('group absolute cursor-pointer k-mascot', `k-mascot-${state}`, open ? 'z-[6]' : 'z-[2]')}
      style={
        {
          left: `${critter.x}%`,
          top: `${critter.y}%`,
          width: compact ? 'clamp(22px, 6vh, 38px)' : 'clamp(30px, 9vh, 54px)',
          '--md': `${critter.delay}s`,
        } as React.CSSProperties
      }
    >
      {!compact && state === 'sleep' && (
        <Bubble side={side} tone="sleep">
          <span className="block text-ink-400 truncate">
            zzz
            {critter.blockedBy.length ? ` — waiting on ${critter.blockedBy.join(', ')}` : ' — queued'}
          </span>
        </Bubble>
      )}
      {!compact && state === 'fail' && (
        <Bubble side={side} tone="fail">
          <span className="block text-danger-text truncate">Failed — click to see why</span>
        </Bubble>
      )}
      {!compact && lively && (
        <Bubble side={side} tone={state === 'think' ? 'think' : 'work'}>
          <span className="flex items-center min-w-0">
            <span className="text-ink-200 font-medium truncate">{said ? said.title : 'Starting'}</span>
            <Dots />
          </span>
          {said?.sub && (
            <em className="block not-italic text-[10.5px] text-ink-500 mt-0.5 truncate">
              {said.sub}
            </em>
          )}
        </Bubble>
      )}

      {state === 'sleep' && !compact && (
        <span className="absolute -top-1 left-[60%] z-[5] pointer-events-none">
          {[0, 1.1, 2.2].map((d, i) => (
            <span
              key={i}
              className="absolute text-[12px] font-semibold text-agent/70 k-zzz"
              style={{ animationDelay: `${d}s`, left: i * 7, top: i * -6 }}
            >
              z
            </span>
          ))}
        </span>
      )}

      <div className={cn('k-mascot-bob', open && 'ring-2 ring-accent/55 p-0.5')}>
        <OctoMascot
          state={state}
          seed={Math.abs(critter.delay)}
          detail={compact ? 'simple' : 'full'}
        />
      </div>

      {/* The name tag is wider than the creature, so it is capped and truncates
          rather than spilling out of a narrow spec's zone (which clips). */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 text-center z-[3] max-w-[150px]">
        <span
          className={cn(
            'block font-mono leading-tight tabular-nums truncate',
            compact ? 'text-[10.5px]' : 'text-[12px]',
            lively ? 'text-accent-num' : state === 'fail' ? 'text-danger-text' : 'text-agent/80'
          )}
        >
          {run.taskId
            ? `${run.taskId}${status === 'running' && elapsed ? ` · ${elapsed}` : ''}`
            : status === 'running' && elapsed
              ? elapsed
              : meta.label}
        </span>
        <span
          className={cn(
            'block text-ink-500 leading-tight mt-px truncate',
            compact ? 'text-[9.5px]' : 'text-[10.5px]'
          )}
        >
          {run.agent ?? meta.label.toLowerCase()}
        </span>
      </div>

      {!compact && status === 'running' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          title="Cancel this run"
          className="absolute -right-1 -top-1 z-[7] w-4 h-4 grid place-items-center bg-ink-950 border border-ink-700 text-ink-600 opacity-0 group-hover:opacity-100 hover:text-danger-text transition"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex gap-[3px] ml-1.5 shrink-0 align-[1px]">
      {[0, 0.2, 0.4].map((d) => (
        <span
          key={d}
          className="block w-[3px] h-[3px] bg-accent-text k-dots"
          style={{ animationDelay: `${d}s` }}
        />
      ))}
    </span>
  );
}

function Bubble({
  side,
  tone,
  children,
}: {
  side: 'l' | 'r' | 'mid';
  tone: 'work' | 'think' | 'sleep' | 'fail';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'absolute bottom-full mb-3 px-2.5 py-1.5 text-[11.5px] z-[5] border k-bubble',
        // A zone clips its own contents, so a bubble is capped and truncates
        // rather than running off the edge of a narrow spec.
        'max-w-[15vw] min-w-[120px]',
        side === 'l'
          ? '-left-1 k-bubble-l'
          : side === 'r'
            ? '-right-1 k-bubble-r'
            : 'left-1/2 -translate-x-1/2',
        tone === 'sleep'
          ? 'bg-ink-950 border-ink-800'
          : tone === 'fail'
            ? 'bg-panel border-danger/55'
            : tone === 'think'
              ? 'bg-panel border-agent/45'
              : 'bg-panel border-ink-700'
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The reef — what already finished.
// ---------------------------------------------------------------------------

function Reef({
  runs,
  statusOf,
  finished,
  onOpen,
}: {
  runs: ActiveRun[];
  statusOf: (r: ActiveRun) => RunStatus;
  finished: Record<string, { status: FinalStatus; at: number }>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="shrink-0 h-[112px] border border-dashed border-ink-800 bg-ink-950/60 flex items-center gap-3 px-4 overflow-hidden">
      <span className="text-[10px] uppercase tracking-[0.08em] text-ink-500 font-semibold [writing-mode:vertical-rl] rotate-180 shrink-0">
        Recent
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-6 overflow-hidden">
        {runs.map((r) => {
          const st = statusOf(r);
          const end = finished[r.requestId]?.at;
          const dur = end && r.startedAt ? fmtDuration(end - r.startedAt) : null;
          return (
            <button
              key={r.requestId}
              onClick={() => onOpen(r.requestId)}
              className="flex items-center gap-2.5 shrink-0 text-left opacity-80 hover:opacity-100 transition"
            >
              <span className={cn('block w-[34px] shrink-0', `k-mascot-${mascotState({ status: st, run: r })}`)}>
                <span className="block k-mascot-bob">
                  <OctoMascot
                    state={mascotState({ status: st, run: r })}
                    seed={hash(r.requestId) % 7}
                    detail="simple"
                  />
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] text-ink-400 truncate max-w-[240px]">
                  {r.taskId ? `${r.taskId} — ` : ''}
                  {r.title ?? r.source}
                </span>
                <span className="block text-[11px] text-ink-500 font-mono mt-0.5">
                  {st === 'error' ? 'failed' : st}
                  {dur ? ` in ${dur}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <span className="text-[11px] text-ink-500 shrink-0">Activity › History has them all</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One creature, opened.
// ---------------------------------------------------------------------------

function joinJsonList(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.join(', ') : String(raw);
  } catch {
    return raw;
  }
}

function FocusPanel({
  run,
  status,
  segs,
  onCancel,
}: {
  run: ActiveRun;
  status: RunStatus;
  segs: LogSeg[];
  onCancel?: () => void;
}) {
  const meta = kindMeta(run.kind);

  // The DB mirrors every run's streamed output (keyed by requestId) plus richer
  // parameters. Poll it as a fallback so the log shows even for runs that
  // started before this window opened — or that already finished.
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
    if (status !== 'running')
      return () => {
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
  const state = mascotState({ status, run });

  return (
    <div
      className={cn(
        'flex flex-col min-h-0 min-w-0 overflow-hidden border',
        status === 'error' ? 'border-danger/45 bg-danger/[0.05]' : 'border-accent/45 bg-accent/[0.06]'
      )}
    >
      <div className="shrink-0 px-5 pt-4 pb-3.5 border-b border-ink-800 flex gap-5 items-start">
        <div className="shrink-0" style={{ width: 'clamp(56px, 15vh, 104px)' }}>
          <div className={`k-mascot-${state}`}>
            <div className="k-mascot-bob">
              <OctoMascot state={state} seed={2} />
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 h-[17px] px-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] bg-accent/15 text-accent-text">
                  {meta.icon}
                  {meta.label}
                </span>
                {run.taskId && <span className="text-[13px] font-mono text-dim">{run.taskId}</span>}
                <span className="text-[11px] text-ink-500 truncate">
                  {[run.wave, run.specId].filter(Boolean).join(' · ')}
                </span>
              </div>
              <div className="text-[21px] font-display font-semibold text-ink-50 leading-[1.22]">
                {run.title ?? run.source}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[30px] font-mono font-medium leading-none text-accent-num tabular-nums">
                {status === 'running' && run.startedAt ? fmtClock(Date.now() - run.startedAt) : status}
              </div>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] px-2 h-[22px] border border-danger/50 text-danger-text hover:bg-danger/20 transition"
                >
                  <X size={11} /> Cancel
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-1">
            {params
              .filter(([, v]) => v != null && v !== '')
              .map(([k, v]) => (
                <div key={k} className="min-w-0 flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-[0.06em] text-ink-500 font-semibold shrink-0">
                    {k}
                  </span>
                  <span className="text-[12px] text-ink-200 font-mono truncate" title={String(v)}>
                    {v}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

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
  tool: 'text-agent-text',
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
      className="flex-1 min-h-0 overflow-y-auto px-5 py-3 font-mono text-[13px] leading-relaxed bg-rail"
    >
      {error && <pre className="whitespace-pre-wrap break-words text-danger-text mb-2">{error}</pre>}
      {!hasLive && !hasFallback && !error ? (
        <div className="h-full grid place-items-center text-ink-600">
          <div className="flex items-center gap-2 text-[12px]">
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
        <div className="mx-auto mb-4 w-16 k-mascot-sleep">
          <div className="k-mascot-bob">
            <OctoMascot state="sleep" />
          </div>
        </div>
        <p className="text-sm text-ink-300 font-medium font-display">The colony is asleep</p>
        <p className="text-[12px] text-ink-500 mt-1.5">
          Run a task wave, draft a spec, or chat on your main screen — live runs surface here.
        </p>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  active,
  flush,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  flush?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'grid place-items-center transition',
        flush ? 'w-8 h-full' : 'w-[26px] h-[26px] border border-ink-700',
        active
          ? 'text-accent-text bg-accent/[0.12] border-accent/40'
          : 'text-faint hover:text-ink-100 hover:bg-ink-50/[0.06]'
      )}
    >
      {children}
    </button>
  );
}
