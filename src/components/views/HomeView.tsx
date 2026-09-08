import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  GraduationCap,
  ArrowUpRight,
  Zap,
  Bug,
  FileCode2,
  FolderOpen,
  CheckCircle2,
  Check,
  BarChart3,
  ListChecks,
  Loader2,
  Link2,
  MoreHorizontal,
  Trash2,
  AlertTriangle,
  ChevronRight,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi, stageForPhase } from '../../stores/ui';
import { useChat } from '../../stores/chat';
import { useOrchestrator } from '../../stores/orchestrator';
import {
  planSpec,
  planSpecFromTicket,
  quickPlanSpec,
  quickPlanSpecFromTicket,
  specKindFromText,
} from '../../lib/specActions';
import { TicketInbox, useTicketGroups } from './TicketInbox';
import { OctoMark } from '../OctoMark';
import { TrackerMark } from '../../lib/trackerBrand';
import { cn } from '../../lib/cn';
import { seedSummary } from '../../lib/library';
import type {
  SpecMeta,
  SpecKind,
  SpecPhase,
  TicketProviderConfig,
  TicketSummary,
} from '../../../electron/shared/types';

function ago(iso?: string) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * The board's columns are the three phases work actually moves through. `done`
 * is deliberately not one: finished specs are reference, and they live on the
 * shelf under the board instead of taking a quarter of its width.
 */
const COLUMNS: { phase: Exclude<SpecPhase, 'done'>; label: string; empty: string }[] = [
  { phase: 'requirements', label: 'REQUIREMENTS', empty: 'Nada por definir' },
  { phase: 'plan', label: 'PLAN', empty: 'Nada por planificar' },
  { phase: 'build', label: 'BUILD', empty: 'Nada por construir' },
];

/**
 * Where a ticket may enter the board — and only there. A spec cannot start in
 * the middle, so `plan` is not a drop target: the board refuses it by not
 * lighting up, rather than by explaining it afterwards.
 */
const ENTRY_POINTS: Record<string, { label: string; sub: string }> = {
  requirements: { label: 'Plan', sub: 'crea el spec y para en cada aprobación' },
  build: { label: 'Plan rápido', sub: 'redacta los dos documentos sin paradas' },
};

/** What a card needs from you — the one thing its footer says. */
type Tone = 'run' | 'ready' | 'wait';

function toneOf(spec: SpecMeta, running: number): { tone: Tone; label: string; cta: string } {
  if (running > 0)
    return {
      tone: 'run',
      label: `${running} agente${running === 1 ? '' : 's'} trabajando`,
      cta: 'Ver',
    };
  if (spec.phase === 'build')
    return { tone: 'ready', label: 'listo para correr', cta: 'Correr' };
  return { tone: 'wait', label: 'esperando tu aprobación', cta: 'Revisar' };
}

const FIRST_RUN_KEY = 'octo.firstRunDismissed';

/**
 * Home — the board.
 *
 * Everything that starts work is on one screen, in the order it happens: the
 * composer writes a brief, **Entrada** holds the tickets somebody already
 * wrote (one lane per tracker, plus the ones a spec already covers), and the
 * three phase columns hold what is in flight. Shipped work sits on a shelf
 * below, and *Gestionar* turns the board itself into the selection surface —
 * deleting a spec never means going to another screen.
 */
export function HomeView() {
  const root = useWorkspace((s) => s.root);
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const deleteSpec = useWorkspace((s) => s.deleteSpec);
  const specs = useWorkspace((s) => s.specs);
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const libraryUpgrade = useWorkspace((s) => s.libraryUpgrade);
  const dismissLibraryUpgrade = useWorkspace((s) => s.dismissLibraryUpgrade);
  const openSpec = useUi((s) => s.openSpec);
  const openLibrary = useUi((s) => s.openLibrary);
  const openActivity = useUi((s) => s.openActivity);
  const activeSpecId = useUi((s) => s.activeSpecId);
  const closeSpec = useUi((s) => s.closeSpec);
  const setQuickStart = useUi((s) => s.setQuickStart);
  const composerNonce = useUi((s) => s.composerNonce);
  const setAssistantOpen = useUi((s) => s.setAssistantOpen);
  const setPendingPrompt = useChat((s) => s.setPendingPrompt);
  const selectedAgent = useChat((s) => s.selectedAgent);
  const setSelectedAgent = useChat((s) => s.setSelectedAgent);
  const runs = useOrchestrator((s) => s.runs);
  const runningCount = useOrchestrator((s) => s.runningCount());

  const [command, setCommand] = useState('');
  const [menu, setMenu] = useState<'slash' | 'at' | null>(null);
  const [creating, setCreating] = useState<null | 'plan' | 'quick' | 'ticket'>(null);
  const [armed, setArmed] = useState<TicketSummary | null>(null);
  const [manage, setManage] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  const [cardMenu, setCardMenu] = useState<string | null>(null);
  const [shelf, setShelf] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [firstRunDismissed, setFirstRunDismissed] = useState(
    () => localStorage.getItem(FIRST_RUN_KEY) === '1'
  );
  const [seeding, setSeeding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tickets = useTicketGroups(root);
  const hasInbox = tickets.hasProviders || tickets.stale;
  // Which tracker each linked ticket came from, so a board card can wear its
  // mark. `groups` carries the provider even when its fetch failed, so the mark
  // survives a tracker being unreachable — the link is still true.
  const trackerById = useMemo(
    () => new Map(tickets.groups.map((g) => [g.provider.id, g.provider])),
    [tickets.groups]
  );

  // ⌘K "New spec…" lands here and focuses the composer.
  useEffect(() => {
    if (composerNonce > 0) inputRef.current?.focus();
  }, [composerNonce]);

  // Esc backs out of whatever the board is holding, innermost first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (cardMenu) setCardMenu(null);
      else if (confirming) setConfirming(false);
      else if (armed) setArmed(null);
      else if (manage) setManage(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardMenu, confirming, armed, manage]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
  }, []);

  const runningBySpec = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of Object.values(runs)) {
      if (!r.specId || !(r.status === 'running' || r.status === 'queued')) continue;
      map.set(r.specId, (map.get(r.specId) ?? 0) + 1);
    }
    return map;
  }, [runs]);

  const inFlight = useMemo(
    () =>
      specs
        .filter((s) => s.phase !== 'done')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [specs]
  );
  const shipped = useMemo(
    () =>
      specs
        .filter((s) => s.phase === 'done')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [specs]
  );

  const selIds = useMemo(() => Object.keys(sel).filter((k) => sel[k]), [sel]);
  const selNames = useMemo(
    () =>
      selIds
        .map((id) => specs.find((s) => s.id === id)?.name ?? id)
        .join(', '),
    [selIds, specs]
  );

  // The header counts say what is true, not just how many rows there are.
  const boardSummary = useMemo(() => {
    const waiting = inFlight.filter(
      (s) => (runningBySpec.get(s.id) ?? 0) === 0 && s.phase !== 'build'
    ).length;
    const running = inFlight.filter((s) => (runningBySpec.get(s.id) ?? 0) > 0).length;
    const parts = [`${inFlight.length} spec${inFlight.length === 1 ? '' : 's'}`];
    if (waiting) parts.push(`${waiting} espera${waiting === 1 ? '' : 'n'} tu ok`);
    if (running) parts.push(`${running} corriendo`);
    return parts.join(' · ');
  }, [inFlight, runningBySpec]);

  const kindGuess: SpecKind = specKindFromText(command);

  const start = async (mode: 'plan' | 'quick') => {
    const text = command.trim();
    if (!text || creating) return;
    // Questions still route to the Assistant — one keystroke away from planning.
    if (text.endsWith('?')) {
      setAssistantOpen(true);
      setPendingPrompt(text);
      setCommand('');
      return;
    }
    setCreating(mode);
    try {
      if (mode === 'plan') await planSpec(text);
      else void quickPlanSpec(text);
      setCommand('');
    } finally {
      setCreating(null);
    }
  };

  /** A ticket dropped on a column: the entry point decides which action runs. */
  const dropArmed = async (phase: Exclude<SpecPhase, 'done'>) => {
    if (!armed || creating) return;
    const ticket = armed;
    setCreating('ticket');
    setArmed(null);
    try {
      if (phase === 'requirements') await planSpecFromTicket(ticket);
      else void quickPlanSpecFromTicket(ticket);
      void tickets.reload();
    } finally {
      setCreating(null);
    }
  };

  const toggleSel = (id: string) => {
    setConfirming(false);
    setSel((s) => ({ ...s, [id]: !s[id] }));
  };

  const removeSelected = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      for (const id of selIds) await deleteSpec(id);
      // The Spec surface mounts on `activeSpecId`; deleting the spec it is
      // holding would leave it reading a folder that no longer exists.
      if (activeSpecId && selIds.includes(activeSpecId)) closeSpec();
      setSel({});
      setConfirming(false);
      setManage(false);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  };

  const dismissFirstRun = () => {
    localStorage.setItem(FIRST_RUN_KEY, '1');
    setFirstRunDismissed(true);
  };

  const seed = async () => {
    setSeeding(true);
    try {
      await seedDefaults();
      dismissFirstRun();
    } finally {
      setSeeding(false);
    }
  };

  const onCmdChange = (v: string) => {
    setCommand(v);
    if (v.endsWith('@') && (v.length === 1 || v[v.length - 2] === ' ')) setMenu('at');
    else if (v === '/' || v.endsWith(' /')) setMenu('slash');
    else setMenu(null);
  };

  // ---- No workspace: focused open-folder hero ----
  if (!root) {
    return (
      <div className="h-full overflow-y-auto bg-ink-950 grid place-items-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto grid place-items-center rounded-2xl octo-tile">
            <OctoMark animated glow detail="simple" className="w-11" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-50">
            Welcome to Octo
          </h1>
          <p className="mt-2 text-sm text-dim leading-relaxed">
            Open any folder to begin. Specs live in{' '}
            <code className="font-mono text-[12px] text-accent-2 bg-accent/15 px-1.5 py-0.5 rounded">
              .octo/specs/
            </code>
            ; your existing{' '}
            <code className="font-mono text-[12px] text-accent-2 bg-accent/15 px-1.5 py-0.5 rounded">
              .claude/
            </code>{' '}
            agents &amp; skills load automatically.
          </p>
          <button
            onClick={pickWorkspace}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white text-sm font-semibold shadow-glow hover:opacity-95 transition"
          >
            <FolderOpen size={16} /> Open folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-ink-950 overflow-hidden">
      <div className="k-wide flex-1 min-h-0 flex flex-col pt-7 pb-5">
        {/* greeting */}
        <div className="flex items-end justify-between gap-5 mb-3.5 shrink-0">
          <div>
            <div className="text-[12px] text-faint font-medium tracking-[0.02em] mb-1">
              {greeting} · {inFlight.length} spec{inFlight.length === 1 ? '' : 's'} en vuelo
            </div>
            <h1 className="m-0 font-display text-[26px] font-semibold tracking-[-0.02em] text-ink-50">
              ¿Qué construimos?
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 px-3 py-[7px] bg-card border border-ink-800">
            <span className="relative w-2 h-2">
              <span className="absolute inset-0 bg-good" />
              {runningCount > 0 && <span className="absolute inset-0 bg-good animate-ping2" />}
            </span>
            <span className="text-xs text-dim">
              <b className="text-ink-50 font-semibold">{runningCount}</b> agentes trabajando
            </span>
          </div>
        </div>

        {/* composer — creates specs */}
        <div className="relative mb-4 shrink-0">
          <div className="flex items-center gap-3 pl-4 pr-2.5 py-2.5 rounded-[15px] bg-card border border-ink-800 focus-within:border-accent/50 focus-within:shadow-glow transition">
            <Sparkles size={18} className="text-accent-2 shrink-0" />
            <input
              ref={inputRef}
              value={command}
              onChange={(e) => onCmdChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) start(e.metaKey || e.ctrlKey ? 'quick' : 'plan');
                if (e.key === 'Escape') setMenu(null);
              }}
              placeholder="Describí una feature o pegá un bug… terminá con ? para solo preguntar"
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-ink-50 text-[14.5px] placeholder:text-faint"
            />
            {selectedAgent && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-accent-2 bg-accent/15 pl-2 pr-1 py-1 shrink-0">
                @{selectedAgent}
                <button onClick={() => setSelectedAgent(null)} className="hover:text-ink-50">
                  <X size={11} />
                </button>
              </span>
            )}
            {command.trim() && (
              <span
                className={cn(
                  'flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 shrink-0',
                  kindGuess === 'feature' ? 'text-accent-2 bg-accent/15' : 'text-warn bg-warn/15'
                )}
                title="Tipo de spec detectado"
              >
                {kindGuess === 'feature' ? <FileCode2 size={11} /> : <Bug size={11} />}
                {kindGuess}
              </span>
            )}
            <button
              onClick={() => start('quick')}
              disabled={!command.trim() || !!creating}
              title="Plan rápido — redacta requirements y el plan sin paradas de aprobación"
              className="flex items-center gap-1.5 h-[34px] px-3 bg-elev text-dim text-[12.5px] font-semibold hover:text-ink-50 transition disabled:opacity-40 shrink-0"
            >
              {creating === 'quick' ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Plan rápido
            </button>
            <button
              onClick={() => start('plan')}
              disabled={!command.trim() || !!creating}
              title="Plan — crea el spec y abre Requirements. No corre nada hasta que pidas Draft"
              className="flex items-center gap-1.5 h-[34px] px-3.5 bg-gradient-to-br from-accent to-accent-2 text-accent-fg text-[12.5px] font-bold shadow-glow hover:opacity-95 transition disabled:opacity-40 shrink-0"
            >
              {creating === 'plan' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowUpRight size={14} />
              )}
              Plan
            </button>
          </div>

          {/* / and @ popovers */}
          {menu === 'slash' && skills.length > 0 && (
            <Popover label="Skills">
              {skills.slice(0, 6).map((k) => (
                <button
                  key={k.path}
                  onMouseDown={() => {
                    setCommand(`/${k.name} `);
                    setMenu(null);
                    inputRef.current?.focus();
                  }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 hover:bg-accent/15 text-left"
                >
                  <Sparkles size={15} className="text-accent-2 w-4 text-center shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ink-50 font-medium truncate">{k.name}</div>
                    <div className="text-[11px] text-faint truncate">{k.description}</div>
                  </div>
                </button>
              ))}
            </Popover>
          )}
          {menu === 'at' && agents.length > 0 && (
            <Popover label="Agents">
              {agents.slice(0, 6).map((a) => (
                <button
                  key={a.path}
                  onMouseDown={() => {
                    setSelectedAgent(a.name);
                    setCommand(command.replace(/@$/, ''));
                    setMenu(null);
                    inputRef.current?.focus();
                  }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 hover:bg-accent/15 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ink-50 font-medium truncate">{a.name}</div>
                    <div className="text-[11px] text-faint truncate">{a.description}</div>
                  </div>
                </button>
              ))}
            </Popover>
          )}
        </div>

        {/* Notices are one line each: they announce, they don't occupy. */}
        {libraryUpgrade && (
          <NoticeStrip
            tone="agent"
            icon={<Sparkles size={13} />}
            text={`Se actualizó la librería incluida en este workspace. ${seedSummary(libraryUpgrade)} — lo que habías editado quedó intacto.`}
            action={{ label: 'Revisar', onClick: () => openLibrary('agents') }}
            onDismiss={dismissLibraryUpgrade}
          />
        )}
        {agents.length === 0 && !firstRunDismissed && (
          <NoticeStrip
            tone="accent"
            icon={<Sparkles size={13} />}
            text="Instalá los agentes, skills, steering y hooks que Octo trae — editables después en la Library."
            action={{
              label: seeding ? 'Instalando…' : 'Instalar defaults',
              onClick: seed,
              primary: true,
            }}
            secondary={{ label: 'Quick start', icon: <GraduationCap size={13} />, onClick: () => setQuickStart(true) }}
            onDismiss={dismissFirstRun}
          />
        )}

        {/* ============================ the board ============================ */}
        <div className="flex-1 min-h-0 flex">
          {hasInbox && (
            <div className="w-[366px] max-[1180px]:w-[292px] shrink-0 pr-[22px] border-r border-ink-850">
              <TicketInbox
                groups={tickets.groups}
                loading={tickets.loading}
                stale={tickets.stale}
                reload={() => void tickets.reload()}
                armedKey={armed?.key ?? null}
                onArm={setArmed}
                busy={creating === 'ticket'}
              />
            </div>
          )}

          <div className={cn('flex-1 min-w-0 flex flex-col min-h-0', hasInbox && 'pl-[22px]')}>
            {/* board header — or, while a ticket is armed, what it is waiting for */}
            <div className="flex items-center gap-2.5 h-[26px] mb-3 shrink-0">
              {armed ? (
                <div className="flex items-center gap-2.5 w-full h-full px-2.5 bg-accent/10 ring-1 ring-inset ring-accent/45">
                  <span className="font-mono text-[11px] text-accent-text shrink-0">
                    {armed.key}
                  </span>
                  {/* the title, not just the key: this bar is the last thing
                      you read before a spec gets created from the ticket */}
                  <span className="text-[12px] text-ink-200 truncate">
                    {armed.title || '¿cómo entra al board?'}
                  </span>
                  {armed.title && (
                    <span className="text-[12px] text-faint shrink-0">¿cómo entra?</span>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => setArmed(null)}
                    className="text-[11.5px] text-faint hover:text-ink-100 transition"
                  >
                    Cancelar (Esc)
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="m-0 font-display text-[13px] font-semibold text-ink-50 tracking-[0.01em]">
                    En vuelo
                  </h2>
                  <span className="text-[11.5px] text-ink-600 truncate">{boardSummary}</span>
                  <div className="flex-1" />
                  <button
                    onClick={() => openActivity('specs')}
                    title="Historial de runs y tiempo por spec — Activity › Specs"
                    className="flex items-center gap-1.5 h-[26px] px-2.5 text-[12px] text-dim hover:text-ink-50 transition"
                  >
                    <BarChart3 size={13} /> Analíticas
                  </button>
                  <button
                    onClick={() => {
                      setManage((m) => !m);
                      setSel({});
                      setConfirming(false);
                      setArmed(null);
                    }}
                    className={cn(
                      'flex items-center gap-1.5 h-[26px] px-2.5 border text-[12px] font-semibold transition',
                      manage
                        ? 'bg-accent/[0.12] border-accent/45 text-accent-text'
                        : 'bg-transparent border-ink-800 text-dim hover:border-accent/50 hover:text-accent-text'
                    )}
                  >
                    <ListChecks size={13} /> Gestionar
                  </button>
                </>
              )}
            </div>

            {/* columns */}
            <div className="flex-1 min-h-0 grid grid-cols-3 gap-3">
              {COLUMNS.map((col) => {
                const cards = inFlight.filter((s) => s.phase === col.phase);
                const entry = armed ? ENTRY_POINTS[col.phase] : undefined;
                return (
                  <BoardColumn
                    key={col.phase}
                    label={col.label}
                    emptyText={col.empty}
                    cards={cards}
                    runningBySpec={runningBySpec}
                    entry={entry}
                    onDrop={() => void dropArmed(col.phase)}
                    dropping={creating === 'ticket'}
                    manage={manage}
                    sel={sel}
                    onToggleSel={toggleSel}
                    cardMenu={cardMenu}
                    onCardMenu={setCardMenu}
                    onOpen={(s) => openSpec(s.id, stageForPhase(s.phase))}
                    onRuns={() => openActivity('runs')}
                    trackerById={trackerById}
                    onDeleteOne={(id) => {
                      setCardMenu(null);
                      setManage(true);
                      setSel({ [id]: true });
                      setConfirming(true);
                    }}
                  />
                );
              })}
            </div>

            {/* shelf — shipped work is reference, not workspace */}
            <div className="shrink-0 mt-3">
              <button
                onClick={() => setShelf((v) => !v)}
                className="w-full flex items-center gap-2.5 h-9 px-3 bg-raised border-t border-ink-800 text-dim hover:text-ink-50 transition text-left"
              >
                <ChevronRight
                  size={12}
                  strokeWidth={2.2}
                  className={cn('shrink-0 transition-transform', shelf && 'rotate-90')}
                />
                <span className="font-display text-[11px] font-semibold tracking-[0.06em]">
                  ENTREGADO
                </span>
                <span className="font-mono text-[11px] text-ink-600">{shipped.length}</span>
                <div className="flex-1" />
                {!shelf && (
                  <span className="text-[11px] text-ink-600 truncate max-[1180px]:hidden">
                    el trabajo entregado vive acá, fuera del board
                  </span>
                )}
              </button>
              {shelf && (
                <div className="flex flex-wrap gap-1.5 pt-2.5 max-h-[124px] overflow-y-auto">
                  {shipped.length === 0 && (
                    <span className="text-[11.5px] text-ink-600 px-1 py-1.5">
                      Todavía no entregaste nada.
                    </span>
                  )}
                  {shipped.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => openSpec(s.id, 'build')}
                      className="flex items-center gap-2 h-7 px-2.5 bg-raised border border-ink-800 hover:border-accent/45 transition"
                    >
                      <CheckCircle2 size={12} className="text-good shrink-0" />
                      <span className="text-[12px] text-dim">{s.name}</span>
                      <span className="font-mono text-[10px] text-ink-600">{ago(s.updatedAt)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* the delete lives where the selection is */}
            {selIds.length > 0 && (
              <div
                className={cn(
                  'shrink-0 mt-2.5 flex items-center gap-3 h-12 px-3.5 bg-card ring-1 ring-inset',
                  confirming ? 'ring-bad/45' : 'ring-ink-50/10'
                )}
              >
                {confirming ? (
                  <>
                    <AlertTriangle size={16} className="text-danger-text shrink-0" />
                    <span className="text-[12px] text-ink-200 flex-1 min-w-0">
                      Se borran <b className="text-ink-50">{selNames}</b> de{' '}
                      <code className="font-mono text-[11px] text-danger-text">.octo/specs/</code> y
                      todo su historial de runs. No se puede deshacer.
                    </span>
                    <button
                      onClick={() => setConfirming(false)}
                      disabled={deleting}
                      className="h-7 px-3 border border-ink-800 text-dim text-[12px] hover:text-ink-50 transition disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => void removeSelected()}
                      disabled={deleting}
                      className="flex items-center gap-1.5 h-7 px-3.5 bg-bad text-white text-[12px] font-bold hover:opacity-90 transition disabled:opacity-50"
                    >
                      {deleting && <Loader2 size={12} className="animate-spin" />}
                      Sí, borrar {selIds.length}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[12.5px] text-ink-50 font-semibold shrink-0">
                      {selIds.length} seleccionado{selIds.length === 1 ? '' : 's'}
                    </span>
                    <span className="text-[11.5px] text-faint flex-1 min-w-0 truncate">
                      {selNames}
                    </span>
                    <button
                      onClick={() => setSel({})}
                      className="h-7 px-3 border border-ink-800 text-dim text-[12px] hover:text-ink-50 transition"
                    >
                      Deseleccionar
                    </button>
                    <button
                      onClick={() => setConfirming(true)}
                      className="flex items-center gap-1.5 h-7 px-3 bg-bad/[0.12] border border-bad/45 text-danger-text text-[12px] font-semibold hover:bg-bad/20 transition"
                    >
                      <Trash2 size={13} /> Borrar
                    </button>
                  </>
                )}
              </div>
            )}
            {deleteError && (
              <p className="shrink-0 mt-2 text-[12px] text-danger-text">{deleteError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * One phase column. Its rule takes its colour from what is *in* it — violet
 * when something there is waiting on you, green when something is running —
 * so the board says where you are needed before you read a single card.
 */
function BoardColumn({
  label,
  emptyText,
  cards,
  runningBySpec,
  entry,
  onDrop,
  dropping,
  manage,
  sel,
  onToggleSel,
  cardMenu,
  onCardMenu,
  onOpen,
  onRuns,
  onDeleteOne,
  trackerById,
}: {
  label: string;
  emptyText: string;
  cards: SpecMeta[];
  runningBySpec: Map<string, number>;
  /** provider id → its config, so a card can wear its tracker's mark */
  trackerById: Map<string, TicketProviderConfig>;
  entry?: { label: string; sub: string };
  onDrop: () => void;
  dropping: boolean;
  manage: boolean;
  sel: Record<string, boolean>;
  onToggleSel: (id: string) => void;
  cardMenu: string | null;
  onCardMenu: (id: string | null) => void;
  onOpen: (spec: SpecMeta) => void;
  onRuns: () => void;
  onDeleteOne: (id: string) => void;
}) {
  const tones = cards.map((s) => toneOf(s, runningBySpec.get(s.id) ?? 0).tone);
  const running = tones.filter((t) => t === 'run').length;
  const waiting = tones.filter((t) => t === 'wait').length;
  const ready = tones.filter((t) => t === 'ready').length;

  const head = running
    ? { rule: 'bg-accent', name: 'text-accent-text', note: `${running} corriendo`, noteCls: 'text-accent-num' }
    : waiting
      ? { rule: 'bg-agent', name: 'text-agent-text', note: `${waiting} te espera`, noteCls: 'text-agent-text' }
      : ready
        ? { rule: 'bg-accent/40', name: 'text-dim', note: `${ready} listo`, noteCls: 'text-faint' }
        : { rule: 'bg-ink-800', name: 'text-ink-600', note: '', noteCls: 'text-ink-600' };

  return (
    <div className="flex flex-col min-w-0 min-h-0">
      <div className="shrink-0 flex items-center gap-2 pb-2">
        <span className={cn('font-display text-[11px] font-semibold tracking-[0.06em]', head.name)}>
          {label}
        </span>
        <div className="flex-1" />
        {head.note && <span className={cn('text-[10.5px]', head.noteCls)}>{head.note}</span>}
        <span className="font-mono text-[11px] text-ink-600 min-w-[14px] text-right">
          {cards.length}
        </span>
      </div>
      <div className={cn('h-0.5 shrink-0', head.rule)} />

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pt-2 -mr-2 pr-2">
        {entry && (
          <button
            onClick={onDrop}
            disabled={dropping}
            className="shrink-0 flex flex-col items-start gap-1 px-3 py-3.5 bg-accent/[0.06] border border-dashed border-accent/55 hover:bg-accent/[0.12] hover:border-accent transition text-left disabled:opacity-50"
          >
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-text">
              {dropping && <Loader2 size={12} className="animate-spin" />}
              {entry.label}
            </span>
            <span className="text-[11px] text-faint">{entry.sub}</span>
          </button>
        )}

        {cards.map((spec) => (
          <SpecCard
            key={spec.id}
            spec={spec}
            running={runningBySpec.get(spec.id) ?? 0}
            manage={manage}
            checked={!!sel[spec.id]}
            onToggle={() => onToggleSel(spec.id)}
            menuOpen={cardMenu === spec.id}
            onMenu={() => onCardMenu(cardMenu === spec.id ? null : spec.id)}
            onOpen={() => onOpen(spec)}
            onRuns={onRuns}
            onDelete={() => onDeleteOne(spec.id)}
            tracker={spec.ticket ? trackerById.get(spec.ticket.provider) : undefined}
          />
        ))}

        {cards.length === 0 && !entry && (
          <div className="shrink-0 px-3 py-4 border border-dashed border-ink-800 text-[11.5px] text-ink-600 text-center">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One spec on the board. Four lines, always the same four, always in the same
 * order — state + kind + ticket + age, the name, what it is, and what it needs
 * from you. There is nothing to re-learn between one card and the next.
 */
function SpecCard({
  spec,
  running,
  manage,
  checked,
  onToggle,
  menuOpen,
  onMenu,
  onOpen,
  onRuns,
  onDelete,
  tracker,
}: {
  spec: SpecMeta;
  running: number;
  /** the tracker the linked ticket lives in, when it is still configured */
  tracker?: TicketProviderConfig;
  manage: boolean;
  checked: boolean;
  onToggle: () => void;
  menuOpen: boolean;
  onMenu: () => void;
  onOpen: () => void;
  onRuns: () => void;
  onDelete: () => void;
}) {
  const { tone, label, cta } = toneOf(spec, running);
  const isRunning = tone === 'run';

  return (
    <div
      onClick={manage ? onToggle : onOpen}
      className={cn(
        'group relative shrink-0 flex flex-col px-3 pt-2.5 pb-2.5 cursor-pointer ring-1 ring-inset transition',
        checked
          ? 'bg-accent/[0.10] ring-accent/65'
          : isRunning
            ? 'bg-raised ring-accent/45 hover:bg-elev'
            : 'bg-card ring-ink-800 hover:bg-elev'
      )}
    >
      {/* 1 — state, kind, ticket, age */}
      <div className="flex items-center gap-2 mb-1.5">
        {manage ? (
          <span
            className={cn(
              'w-4 h-4 shrink-0 border grid place-items-center',
              checked ? 'bg-accent border-accent' : 'border-ink-600'
            )}
          >
            {checked && <Check size={11} className="text-accent-fg" strokeWidth={3.5} />}
          </span>
        ) : (
          <span
            className={cn(
              'w-2 h-2 shrink-0',
              isRunning
                ? 'bg-accent animate-pulse-slow'
                : tone === 'ready'
                  ? 'bg-accent'
                  : 'bg-agent'
            )}
          />
        )}
        <span className="text-[9.5px] text-ink-600 tracking-[0.08em] font-semibold shrink-0">
          {spec.kind === 'bugfix' ? 'BUGFIX' : 'FEATURE'}
        </span>
        <div className="flex-1" />
        {spec.ticket?.key && (
          <span
            className="flex items-center gap-1 font-mono text-[10px] text-ink-600 shrink-0"
            title={`Ticket ${spec.ticket.key}`}
          >
            {/* the tracker's own mark replaces the generic link glyph — same
                width, and it says *where* the ticket lives, not just that
                there is one */}
            {tracker ? <TrackerMark provider={tracker} size={10} /> : <Link2 size={10} />}
            {spec.ticket.key}
          </span>
        )}
        <span className="font-mono text-[10px] text-ink-600 shrink-0">{ago(spec.updatedAt)}</span>
      </div>

      {/* 2 — the name */}
      <div className="text-[14px] font-semibold text-ink-50 tracking-[-0.005em] truncate mb-1">
        {spec.name}
      </div>

      {/* 3 — what it is */}
      <div className="text-[11.5px] text-faint leading-[1.45] h-[33px] line-clamp-2 mb-2">
        {spec.brief || spec.ticket?.title || '—'}
      </div>

      {/* 4 — what it needs from you */}
      <div
        className={cn(
          'flex items-center gap-2 pt-2 border-t',
          isRunning ? 'border-accent/25' : 'border-ink-800'
        )}
      >
        {isRunning ? (
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <span className="text-[11px] text-accent-num truncate">{label}</span>
            <span className="h-[3px] bg-elev block overflow-hidden">
              <span className="block h-[3px] w-1/3 bg-accent animate-bar origin-left" />
            </span>
          </div>
        ) : (
          <span
            className={cn(
              'flex-1 min-w-0 text-[11px] truncate',
              tone === 'wait' ? 'text-agent-text' : 'text-faint'
            )}
          >
            {label}
          </span>
        )}
        {!manage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="shrink-0 h-6 px-2.5 border border-ink-800 text-dim text-[11px] font-semibold hover:border-accent/45 hover:text-accent-text transition"
          >
            {cta}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMenu();
          }}
          title="Más acciones"
          className={cn(
            'shrink-0 w-[22px] h-[22px] grid place-items-center text-ink-600 hover:text-ink-100 transition',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 bottom-9 w-[196px] bg-elev ring-1 ring-line p-1 z-30 animate-rise"
        >
          <MenuItem label="Abrir el spec" onClick={onOpen} />
          <MenuItem label="Ver runs en Activity" onClick={onRuns} />
          <MenuItem label="Borrar spec e historial" danger onClick={onDelete} />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-2.5 py-[7px] text-[12px] hover:bg-line transition',
        danger ? 'text-danger-text' : 'text-ink-100'
      )}
    >
      {label}
    </button>
  );
}

/** A notice that announces without occupying: one line, one action, dismissible. */
function NoticeStrip({
  tone,
  icon,
  text,
  action,
  secondary,
  onDismiss,
}: {
  tone: 'accent' | 'agent';
  icon: React.ReactNode;
  text: string;
  action: { label: string; onClick: () => void; primary?: boolean };
  secondary?: { label: string; icon: React.ReactNode; onClick: () => void };
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        'shrink-0 flex items-center gap-2.5 h-[34px] px-3 mb-3.5 border-l-2',
        tone === 'accent' ? 'bg-accent/[0.08] border-l-accent' : 'bg-agent/[0.08] border-l-agent'
      )}
    >
      <span className={cn('shrink-0', tone === 'accent' ? 'text-accent' : 'text-agent-text')}>
        {icon}
      </span>
      <span className="flex-1 min-w-0 text-[12px] text-ink-200 truncate">{text}</span>
      {secondary && (
        <button
          onClick={secondary.onClick}
          className="shrink-0 flex items-center gap-1.5 text-[11.5px] text-dim hover:text-ink-50 transition"
        >
          {secondary.icon}
          {secondary.label}
        </button>
      )}
      <button
        onClick={action.onClick}
        className={cn(
          'shrink-0 h-[24px] px-2.5 text-[11.5px] font-semibold transition',
          action.primary
            ? 'bg-accent text-accent-fg hover:opacity-90'
            : tone === 'accent'
              ? 'text-accent-text hover:text-ink-50'
              : 'text-agent-text hover:text-ink-50'
        )}
      >
        {action.label}
      </button>
      <button
        onClick={onDismiss}
        title="Descartar"
        className="shrink-0 w-6 h-6 grid place-items-center text-ink-600 hover:text-ink-50 transition"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function Popover({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="absolute top-[58px] left-3.5 w-[330px] bg-elev border border-ink-700 shadow-card p-1.5 z-30 animate-rise">
      <div className="text-[10px] font-semibold tracking-[0.12em] text-faint px-2.5 pt-1.5 pb-1.5">
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}
