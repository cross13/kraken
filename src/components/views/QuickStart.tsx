import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Check,
  ArrowRight,
  Loader2,
  Sparkles,
  Lightbulb,
  FolderOpen,
  Plug,
  Compass,
  Wand2,
  CircleDashed,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { useOrchestrator } from '../../stores/orchestrator';
import { cn } from '../../lib/cn';
import { OctoMascot } from '../wide/OctoMascot';
import { Markdown } from '../Markdown';
import {
  buildSteps,
  TIPS,
  SKILL_REVIEW_SYSTEM,
  skillReviewPrompt,
  type Step,
  type StepId,
} from '../../lib/quickStart';
import type { SkillMeta } from '../../../electron/shared/types';

/**
 * Quick Start — the guided first hour.
 *
 * A full-window mode rather than a surface, for the same reason Zen is one:
 * the four surfaces are singletons and this is a thing you finish and leave.
 *
 * Every step is **verified against real state**, never asserted. A checklist
 * that tells someone to open a workspace they already have open is a checklist
 * they stop reading, and the whole value here is that the green checks mean
 * something.
 */
export function QuickStart({ onClose }: { onClose: () => void }) {
  const root = useWorkspace((s) => s.root);
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const steering = useWorkspace((s) => s.steering);
  const specs = useWorkspace((s) => s.specs);
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const openLibrary = useUi((s) => s.openLibrary);
  const setSurface = useUi((s) => s.setSurface);

  const [backend, setBackend] = useState<'cli' | 'api'>('cli');
  const [cli, setCli] = useState<{ found: boolean; version?: string }>({ found: false });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [trackers, setTrackers] = useState(0);
  const [busy, setBusy] = useState<StepId | null>(null);

  const refresh = useCallback(async () => {
    const [b, c, k] = await Promise.all([
      window.octo.settings.getBackend().catch(() => 'cli' as const),
      window.octo.cli.detect().catch(() => ({ found: false })),
      window.octo.settings.hasApiKey().catch(() => false),
    ]);
    setBackend(b);
    setCli(c);
    setHasApiKey(k);
    if (root) {
      const p = await window.octo.tickets.listProviders(root).catch(() => []);
      setTrackers(p.filter((x) => x.enabled).length);
    }
  }, [root]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Captured, so leaving this mode never also closes whatever is behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const steps = useMemo(
    () =>
      buildSteps({
        root,
        backend,
        cliFound: cli.found,
        cliVersion: cli.version,
        hasApiKey,
        agents,
        skills,
        steering,
        specs,
        trackers,
      }),
    [root, backend, cli, hasApiKey, agents, skills, steering, specs, trackers]
  );

  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;

  const act = async (id: StepId) => {
    setBusy(id);
    try {
      if (id === 'workspace') await pickWorkspace();
      else if (id === 'backend') openLibrary('settings');
      else if (id === 'library') await seedDefaults();
      else if (id === 'steering') openLibrary('steering');
      else if (id === 'spec') setSurface('home');
      else if (id === 'tracker') openLibrary('tickets');
      if (id !== 'workspace' && id !== 'library') onClose();
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink-950">
      {/* This mode covers the whole window, title bar included, so this strip
          *is* the title bar: draggable, with room left for the traffic lights.
          A button floated over this area instead would look clickable and do
          nothing — macOS swallows the click as a window drag. */}
      <header className="titlebar-drag flex items-center gap-2 h-[52px] px-4 shrink-0 border-b border-ink-800/60">
        <div className="w-16 shrink-0" />
        <span className="text-[12px] text-faint">Quick start</span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="titlebar-nodrag flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg text-dim hover:text-ink-50 hover:bg-elev transition"
        >
          I know Octo — skip this
        </button>
        <button
          onClick={onClose}
          title="Close  (Esc)"
          className="titlebar-nodrag w-8 h-8 grid place-items-center rounded-lg text-faint hover:text-ink-50 hover:bg-elev transition"
        >
          <X size={15} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="k-wide py-10 space-y-10">
        {/* header */}
        <header className="flex items-start gap-5">
          <div className="w-[76px] shrink-0 k-mascot-work">
            <div className="k-mascot-bob">
              <OctoMascot state="work" seed={1} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink-50">
              Getting good code out of Octo
            </h1>
            <p className="mt-1.5 text-[13px] text-dim leading-relaxed max-w-[62ch]">
              Octo runs the spec-driven loop — requirements, then a plan, then tasks that execute in
              parallel — with your own Claude setup. The steps below are checked against what is
              actually configured right now, so anything already done stays done.
            </p>
            <div className="mt-3 flex items-center gap-2.5">
              <div className="h-1.5 w-[180px] rounded-full bg-elev overflow-hidden">
                <div
                  className="h-full bg-accent transition-[width] duration-bar"
                  style={{ width: `${(doneCount / required.length) * 100}%` }}
                />
              </div>
              <span className="text-[11.5px] text-faint tabular-nums">
                {doneCount} of {required.length}
              </span>
            </div>
          </div>
        </header>

        {/* the checklist */}
        <section>
          <SectionTitle icon={<Check size={13} />}>Set up</SectionTitle>
          <ol className="space-y-2">
            {steps.map((s) => (
              <StepRow key={s.id} step={s} busy={busy === s.id} onAct={() => void act(s.id)} />
            ))}
          </ol>
        </section>

        {/* how the loop works */}
        <section>
          <SectionTitle icon={<ArrowRight size={13} />}>How the loop works</SectionTitle>
          <div className="k-cards">
            <Card
              n="1"
              title="Requirements"
              body="You describe the work; Claude writes user stories and acceptance criteria in EARS form. The gate at the bottom is the only way forward — approving it is you saying the criteria are right."
            />
            <Card
              n="2"
              title="Plan"
              body="Clarify settles the decisions that would change the plan, then Claude writes the approach, the affected files with real paths, the literal contracts, and the task waves. Approving derives tasks.md from it."
            />
            <Card
              n="3"
              title="Build"
              body="Each task runs as its own agent, in parallel within a wave, each picking the specialist that fits its text. When the last one finishes the spec ships itself: summary, branch, commit, PR."
            />
          </div>
        </section>

        {/* tips */}
        <section>
          <SectionTitle icon={<Lightbulb size={13} />}>
            Tips that actually change the output
          </SectionTitle>
          <div className="k-cards">
            {TIPS.map((t) => (
              <div key={t.title} className="rounded-[13px] bg-card border border-ink-800 p-4">
                <h3 className="text-[13px] font-medium text-ink-50 mb-1.5">{t.title}</h3>
                {/* Through Markdown, not a bare <p>: these name files and task
                    lines, and backticks rendered literally read as typos. */}
                <Markdown source={t.body} className="text-[12px] text-dim leading-relaxed" />
              </div>
            ))}
          </div>
        </section>

        <SkillWorkshop skills={skills} root={root} />

        {/* An exit at the end too — reaching the bottom of a guide and having to
            hunt back up for the way out is its own small insult. */}
        <div className="flex items-center gap-3 pt-2 border-t border-ink-800/60">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-[13px] px-4 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-glow transition"
          >
            Start building <ArrowRight size={13} />
          </button>
          <span className="text-[11.5px] text-faint">
            Reopen any time with ⌘K → <b className="text-dim font-medium">Quick start guide</b>.
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}

/**
 * Point Claude at the user's own skills.
 *
 * A skill is prose that gets injected into every run it matches, which makes a
 * vague one actively expensive. Octo already knows where they live and already
 * runs Claude against the repository — so the one thing it can offer that a
 * text editor cannot is a review that has read the code the skill claims to be
 * about.
 */
function SkillWorkshop({ skills, root }: { skills: SkillMeta[]; root: string | null }) {
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);
  const setAssistantOpen = useUi((s) => s.setAssistantOpen);
  const openOverlay = useUi((s) => s.openOverlay);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const [running, setRunning] = useState<string | null>(null);

  // The bundled ones are Octo's to maintain — reviewing them would just fight
  // the next upgrade, which rewrites any default the user never edited.
  const own = skills.filter((s) => !/^(sdd-|spec-)/.test(s.name));

  const improve = (skill: SkillMeta) => {
    if (!root || running) return;
    const relPath = skill.path.startsWith(root) ? skill.path.slice(root.length + 1) : skill.path;
    const requestId = crypto.randomUUID();
    setRunning(skill.name);
    setAssistantOpen(true);

    startRun({
      requestId,
      agent: null,
      source: 'skill:improve',
      kind: 'spec',
      title: `Improve skill · ${skill.name}`,
      startedAt: Date.now(),
      status: 'running',
    });

    const off = window.octo.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'done' || ev.type === 'error') {
        off();
        finishRun(requestId, ev.type === 'done' ? 'done' : 'error');
        setRunning(null);
        void refreshAll();
      }
    });

    window.octo.claude.stream({
      requestId,
      system: SKILL_REVIEW_SYSTEM,
      messages: [{ role: 'user', content: skillReviewPrompt(skill, relPath) }],
      cwd: root,
      source: 'skill:improve',
      kind: 'spec',
    });
  };

  return (
    <section>
      <SectionTitle icon={<Wand2 size={13} />}>Sharpen your own skills</SectionTitle>
      <p className="text-[12.5px] text-dim leading-relaxed max-w-[68ch] mb-4">
        A skill is prose that gets injected into every run it matches, so a vague one costs you on
        every single call. Claude can review yours against{' '}
        <em className="text-ink-200 not-italic">this repository</em> — checking that the advice is
        true here, that the description will trigger when it should, and that the body earns its
        length — and rewrite it in place. It reports what it changed, and says so if it thinks a
        skill should be deleted rather than improved.
      </p>

      {!root && <p className="text-[12px] text-faint">Open a workspace to see your skills.</p>}

      {root && own.length === 0 && (
        <p className="text-[12px] text-faint">
          Only Octo&rsquo;s bundled skills are installed. Add your own under{' '}
          <code className="font-mono text-[11.5px]">.claude/skills/</code> and they will show up
          here — the bundled ones are left alone, since the next library upgrade rewrites them.
        </p>
      )}

      <div className="k-cards">
        {own.map((s) => (
          <div key={s.name} className="rounded-[13px] bg-card border border-ink-800 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={12} className="text-accent shrink-0" />
              <button
                onClick={() => openOverlay({ kind: 'skill', path: s.path })}
                className="font-mono text-[12px] text-ink-50 truncate hover:text-accent transition"
              >
                {s.name}
              </button>
              {s.scope === 'global' && (
                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-ink-800 text-ink-400">
                  global
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-dim leading-snug line-clamp-3 mb-3">{s.description}</p>
            <button
              onClick={() => improve(s)}
              disabled={Boolean(running)}
              className="flex items-center gap-1.5 text-[11.5px] px-2.5 py-1.5 rounded-lg bg-accent/12 text-accent hover:bg-accent/20 transition disabled:opacity-50"
            >
              {running === s.name ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Wand2 size={11} />
              )}
              Review &amp; improve
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEP_ICON: Record<StepId, React.ReactNode> = {
  workspace: <FolderOpen size={13} />,
  backend: <Plug size={13} />,
  library: <Sparkles size={13} />,
  steering: <Compass size={13} />,
  spec: <ArrowRight size={13} />,
  tracker: <Check size={13} />,
};

const STEP_CTA: Record<StepId, string> = {
  workspace: 'Open a folder',
  backend: 'Open Settings',
  library: 'Install defaults',
  steering: 'Write them',
  spec: 'Start one',
  tracker: 'Connect',
};

function StepRow({ step, busy, onAct }: { step: Step; busy: boolean; onAct: () => void }) {
  return (
    <li
      className={cn(
        'flex items-start gap-3.5 rounded-[13px] border p-4 transition',
        step.done ? 'border-ink-800 bg-card/50' : 'border-ink-700 bg-card'
      )}
    >
      <span
        className={cn(
          'shrink-0 w-6 h-6 grid place-items-center rounded-full mt-px',
          step.done ? 'bg-good/15 text-ok' : 'bg-elev text-faint'
        )}
      >
        {step.done ? <Check size={13} /> : STEP_ICON[step.id]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className={cn('text-[13px] font-medium', step.done ? 'text-dim' : 'text-ink-50')}>
            {step.title}
          </h3>
          {step.optional && (
            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-ink-800 text-ink-400">
              optional
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-dim leading-relaxed max-w-[70ch]">
          {step.done && step.detail ? (
            <span className="text-ok">{step.detail}</span>
          ) : (
            step.why
          )}
        </p>
      </div>
      {!step.done && (
        <button
          onClick={onAct}
          disabled={busy}
          className="shrink-0 flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-elev text-ink-100 hover:bg-line transition disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <CircleDashed size={12} />}
          {STEP_CTA[step.id]}
        </button>
      )}
    </li>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.07em] text-ink-500 font-semibold mb-3">
      <span className="text-accent">{icon}</span>
      {children}
    </h2>
  );
}

function Card({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-[13px] bg-card border border-ink-800 p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-5 h-5 grid place-items-center rounded-full bg-accent/15 text-accent text-[11px] font-mono">
          {n}
        </span>
        <h3 className="text-[13px] font-medium text-ink-50">{title}</h3>
      </div>
      <p className="text-[12px] text-dim leading-relaxed">{body}</p>
    </div>
  );
}
