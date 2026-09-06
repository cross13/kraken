import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  GraduationCap,
  ArrowUpRight,
  Zap,
  Bug,
  FileCode2,
  Play,
  FolderOpen,
  CheckCircle2,
  LayoutDashboard,
  Loader2,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi, stageForPhase } from '../../stores/ui';
import { useChat } from '../../stores/chat';
import { useOrchestrator } from '../../stores/orchestrator';
import { planSpec, quickPlanSpec, specKindFromText } from '../../lib/specActions';
import { SpecsStudio } from './SpecsStudio';
import { TicketInbox } from './TicketInbox';
import { OctoMark } from '../OctoMark';
import { cn } from '../../lib/cn';
import { seedSummary } from '../../lib/library';
import type { SpecMeta, SpecKind } from '../../../electron/shared/types';

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

const PHASE_INDEX: Record<SpecMeta['phase'], number> = {
  requirements: 0,
  plan: 1,
  build: 2,
  done: 3,
};

const FIRST_RUN_KEY = 'octo.firstRunDismissed';

/**
 * Home — the launchpad. The composer creates specs (Plan = gated flow, no run
 * until you ask for one; Quick Plan = draft both docs with no stops); below it,
 * in-flight specs with live status, shipped recents, and the Manage mode.
 */
export function HomeView() {
  const root = useWorkspace((s) => s.root);
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const specs = useWorkspace((s) => s.specs);
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const libraryUpgrade = useWorkspace((s) => s.libraryUpgrade);
  const dismissLibraryUpgrade = useWorkspace((s) => s.dismissLibraryUpgrade);
  const openSpec = useUi((s) => s.openSpec);
  const openLibrary = useUi((s) => s.openLibrary);
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
  const [creating, setCreating] = useState<null | 'plan' | 'quick'>(null);
  const [manage, setManage] = useState(false);
  const [firstRunDismissed, setFirstRunDismissed] = useState(
    () => localStorage.getItem(FIRST_RUN_KEY) === '1'
  );
  const [seeding, setSeeding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K "New spec…" lands here and focuses the composer.
  useEffect(() => {
    if (composerNonce > 0) inputRef.current?.focus();
  }, [composerNonce]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
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
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6),
    [specs]
  );

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

  if (manage) {
    return (
      <div className="h-full flex flex-col bg-ink-950">
        <div className="flex items-center gap-2 px-6 h-[44px] shrink-0">
          <LayoutDashboard size={14} className="text-accent" />
          <span className="text-[13px] font-semibold text-ink-50">Manage specs</span>
          <button
            onClick={() => setManage(false)}
            className="ml-auto text-[12px] flex items-center gap-1 px-2.5 py-1 rounded-md text-dim hover:text-ink-50 hover:bg-elev transition"
          >
            <X size={12} /> Back to Home
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <SpecsStudio />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-ink-950">
      <div className="k-wide pt-9 pb-16">
        {/* greeting */}
        <div className="flex items-end justify-between gap-5 mb-[18px]">
          <div>
            <div className="text-[12.5px] text-faint font-medium tracking-[0.02em] mb-1.5">
              {greeting} · {inFlight.length} spec{inFlight.length === 1 ? '' : 's'} in flight
            </div>
            <h1 className="m-0 text-[29px] font-semibold tracking-[-0.02em] text-ink-50">
              What should we build?
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 px-3 py-[7px] rounded-full bg-card border border-ink-800">
            <span className="relative w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-good" />
              {runningCount > 0 && (
                <span className="absolute inset-0 rounded-full bg-good animate-ping2" />
              )}
            </span>
            <span className="text-xs text-dim">
              <b className="text-ink-50 font-semibold">{runningCount}</b> agents running
            </span>
          </div>
        </div>

        {/* composer — creates specs */}
        <div className="relative mb-3.5">
          <div className="flex items-center gap-3 pl-4 pr-3 py-3 rounded-[15px] bg-card border border-ink-800 focus-within:border-accent/50 focus-within:shadow-glow transition">
            <Sparkles size={19} className="text-accent-2 shrink-0" />
            <input
              ref={inputRef}
              value={command}
              onChange={(e) => onCmdChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) start(e.metaKey || e.ctrlKey ? 'quick' : 'plan');
                if (e.key === 'Escape') setMenu(null);
              }}
              placeholder="Describe a feature or paste a bug… end with ? to just ask"
              className="flex-1 bg-transparent border-none outline-none text-ink-50 text-[15px] placeholder:text-faint"
            />
            {selectedAgent && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-accent-2 bg-accent/15 pl-2 pr-1 py-1 rounded-md">
                @{selectedAgent}
                <button onClick={() => setSelectedAgent(null)} className="hover:text-ink-50">
                  <X size={11} />
                </button>
              </span>
            )}
            {command.trim() && (
              <span
                className={cn(
                  'flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded-md',
                  kindGuess === 'feature' ? 'text-accent-2 bg-accent/15' : 'text-warn bg-warn/15'
                )}
                title="Detected spec kind"
              >
                {kindGuess === 'feature' ? <FileCode2 size={11} /> : <Bug size={11} />}
                {kindGuess}
              </span>
            )}
            <button
              onClick={() => start('quick')}
              disabled={!command.trim() || !!creating}
              title="Quick Plan — draft requirements and the plan with no approval stops"
              className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 bg-elev text-dim text-[13px] font-semibold hover:text-ink-50 transition disabled:opacity-40"
            >
              {creating === 'quick' ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Quick Plan
            </button>
            <button
              onClick={() => start('plan')}
              disabled={!command.trim() || !!creating}
              title="Plan — create the spec and open Requirements. Nothing runs until you press Draft"
              className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 bg-gradient-to-br from-accent to-accent-2 text-white text-[13px] font-semibold shadow-glow hover:opacity-95 transition disabled:opacity-40"
            >
              {creating === 'plan' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowUpRight size={14} />
              )}
              Plan
            </button>
          </div>
          <div className="flex items-center gap-2.5 mt-2.5 px-1">
            <span className="text-[11.5px] text-faint">
              <b className="text-dim font-medium">Plan</b> walks Requirements → Plan → Build with
              approval gates, drafting only when you ask ·{' '}
              <b className="text-dim font-medium">Quick Plan</b> drafts both docs with no stops and
              lands on Build ready to run
            </span>
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
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[9px] hover:bg-accent/15 text-left"
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
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[9px] hover:bg-accent/15 text-left"
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

        {/* Work that already exists somewhere else. Above the upgrade notice and
            the first-run card because it is the answer to the question the page
            just asked, not a piece of housekeeping. */}
        <TicketInbox />

        {/* Library upgraded on open — said once, then dismissed. Only appears
            when a default the user never edited was actually rewritten. */}
        {libraryUpgrade && (
          <div className="flex items-center gap-4 border border-ink-700 rounded-[14px] bg-card px-5 py-3.5 mb-8">
            <Sparkles size={15} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-ink-100">
                Octo's bundled library was updated in this workspace
              </div>
              <div className="text-[11.5px] text-faint truncate">
                {seedSummary(libraryUpgrade)} — anything you had edited was left alone.
              </div>
            </div>
            <button
              onClick={() => openLibrary('agents')}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-elev text-ink-100 hover:bg-line transition"
            >
              Review
            </button>
            <button
              onClick={dismissLibraryUpgrade}
              title="Dismiss"
              className="shrink-0 w-7 h-7 grid place-items-center rounded-md text-faint hover:text-ink-50 hover:bg-elev"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* first-run setup */}
        {agents.length === 0 && !firstRunDismissed && (
          <div className="flex items-center gap-4 border border-accent/30 rounded-[14px] bg-accent/[0.06] px-5 py-4 mb-8">
            <span className="text-xl">🐙</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-ink-50">Set up Octo defaults</div>
              <div className="text-[11.5px] text-faint">
                Installs the bundled SDD agents, skills, steering docs, and hooks into this
                workspace's <code className="font-mono">.claude/</code> and{' '}
                <code className="font-mono">.octo/</code> — one click, fully editable later in
                the Library.
              </div>
            </div>
            <button
              onClick={() => setQuickStart(true)}
              className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-elev text-ink-100 hover:bg-line transition"
            >
              <GraduationCap size={13} /> Quick start
            </button>
            <button
              onClick={seed}
              disabled={seeding}
              className="shrink-0 flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-glow transition disabled:opacity-50"
            >
              {seeding ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Set up defaults
            </button>
            <button
              onClick={dismissFirstRun}
              title="Dismiss"
              className="shrink-0 w-7 h-7 grid place-items-center rounded-md text-faint hover:text-ink-50 hover:bg-elev"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* In flight */}
        {inFlight.length > 0 && (
          <>
            <SectionHeader
              title="In flight"
              badge={`${inFlight.length} active`}
              action={
                <button
                  onClick={() => setManage(true)}
                  className="flex items-center gap-1.5 text-[12.5px] text-dim hover:text-ink-50 transition"
                >
                  <LayoutDashboard size={13} /> Manage
                </button>
              }
            />
            {/* auto-fitting: 1 column on a narrow window, 4+ on an ultrawide,
                instead of two cards stretched across the whole display */}
            <div className="k-cards mb-[38px]" style={{ ['--k-card' as string]: '340px' }}>
              {inFlight.slice(0, 8).map((s) => (
                <SpecCard
                  key={s.id}
                  spec={s}
                  runningCount={runningBySpec.get(s.id) ?? 0}
                  onOpen={() => openSpec(s.id, stageForPhase(s.phase))}
                />
              ))}
            </div>
          </>
        )}

        {/* Shipped */}
        {shipped.length > 0 && (
          <>
            <SectionHeader title="Shipped" badge={`${shipped.length}`} />
            <div
              className="k-cards mb-[38px]"
              style={{ ['--k-card' as string]: '300px', gap: '6px' }}
            >
              {shipped.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSpec(s.id, 'build')}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[11px] bg-card border border-ink-800 hover:border-accent/40 transition text-left"
                >
                  <CheckCircle2 size={15} className="text-good shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-[13.5px] text-ink-100">
                    {s.name}
                  </span>
                  <span className="font-mono text-[10.5px] text-faint shrink-0">
                    {s.kind} · {ago(s.updatedAt)} ago
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {specs.length === 0 && (
          <div className="border border-ink-800 rounded-[14px] bg-card px-6 py-8 text-center">
            <div className="text-[14px] font-semibold text-ink-50 mb-1">No specs yet</div>
            <p className="text-[12px] text-faint">
              Describe what you want to build in the box above — <b>Plan</b> creates the spec and
              opens Requirements, seeded with your description and ready to draft.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  badge,
  action,
}: {
  title: string;
  badge?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-ink-50">{title}</h2>
      {badge && (
        <span className="text-[11px] text-faint bg-ink-50/[0.045] px-2 py-0.5 rounded-full font-mono">
          {badge}
        </span>
      )}
      <div className="flex-1" />
      {action}
    </div>
  );
}

const STAGE_LABELS = {
  feature: ['Requirements', 'Design', 'Tasks'],
  bugfix: ['Bug analysis', 'Design', 'Tasks'],
};

function SpecCard({
  spec,
  runningCount,
  onOpen,
}: {
  spec: SpecMeta;
  runningCount: number;
  onOpen: () => void;
}) {
  const isFeature = spec.kind === 'feature';
  const stepNames = STAGE_LABELS[spec.kind];
  const phaseIdx = PHASE_INDEX[spec.phase];
  const running = runningCount > 0;
  const status = running
    ? { label: `${runningCount} running`, cls: 'text-good', dot: 'bg-good', pulse: true }
    : spec.phase === 'build'
      ? // green is "press me / in progress"…
        { label: 'Ready to run', cls: 'text-accent-text', dot: 'bg-accent', pulse: false }
      : // …violet is "this one is waiting on you".
        { label: 'Awaiting approval', cls: 'text-agent-text', dot: 'bg-agent', pulse: false };

  return (
    <div
      onClick={onOpen}
      className="relative border border-ink-800 rounded-[14px] bg-card px-[18px] py-[17px] cursor-pointer overflow-hidden transition hover:-translate-y-[3px] hover:border-accent/45 hover:shadow-card"
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: isFeature ? 'rgb(var(--accent))' : 'rgb(var(--warn))' }}
      />
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.03em] px-2 py-[3px] rounded-md',
            isFeature ? 'text-accent-2 bg-accent/15' : 'text-warn bg-warn/15'
          )}
        >
          {isFeature ? <FileCode2 size={12} /> : <Bug size={12} />}
          {isFeature ? 'FEATURE' : 'BUGFIX'}
        </span>
        <span className={cn('flex items-center gap-1.5 text-[11px] font-medium', status.cls)}>
          <span
            className={cn('w-1.5 h-1.5 rounded-full', status.dot, status.pulse && 'animate-pulse-slow')}
          />
          {status.label}
        </span>
        <div className="flex-1" />
        <span className="text-[10.5px] text-faint font-mono">{ago(spec.updatedAt)} ago</span>
      </div>

      <div className="text-[16.5px] font-semibold tracking-[-0.01em] text-ink-50 mb-4 truncate">
        {spec.name}
      </div>

      <div className="flex gap-2.5 mb-[15px]">
        {stepNames.map((name, i) => {
          const state =
            phaseIdx > i || spec.phase === 'done' ? 'done' : phaseIdx === i ? 'active' : 'todo';
          return (
            <div key={name} className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className={cn(
                    'w-[5px] h-[5px] rounded-full',
                    state === 'done' ? 'bg-good' : state === 'active' ? 'bg-accent' : 'bg-ink-700'
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    state === 'done' ? 'text-dim' : state === 'active' ? 'text-accent-2' : 'text-faint'
                  )}
                >
                  {name}
                </span>
              </div>
              <div className="h-[3px] rounded-full bg-ink-800 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full origin-left',
                    state === 'done' ? 'bg-good' : state === 'active' ? 'bg-accent' : 'bg-ink-700'
                  )}
                  style={{ width: state === 'done' ? '100%' : state === 'active' ? '55%' : '10%' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5">
        <span className={cn('text-[11px]', running ? 'text-good' : 'text-faint')}>
          {running ? `${runningCount} agent${runningCount === 1 ? '' : 's'} working` : 'idle'}
        </span>
        <div className="flex-1" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="flex items-center gap-1.5 border border-ink-700 bg-ink-50/[0.045] text-dim px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium hover:border-accent/45 hover:text-accent-2 transition"
        >
          <Play size={13} /> Resume
        </button>
      </div>
    </div>
  );
}

function Popover({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="absolute top-[60px] left-3.5 w-[330px] bg-elev border border-ink-700 rounded-[13px] shadow-[0_18px_50px_rgba(0,0,0,0.5)] p-1.5 z-30 animate-rise">
      <div className="text-[10px] font-semibold tracking-[0.12em] text-faint px-2.5 pt-1.5 pb-1.5">
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}
