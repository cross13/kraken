import { useMemo, useState } from 'react';
import {
  Network,
  Bot,
  Sparkles,
  FlaskConical,
  SlidersHorizontal,
  Activity,
  ArrowRight,
  RotateCcw,
  Pin,
  Minus,
  Plus,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useOrchestrator } from '../../stores/orchestrator';
import {
  useModuleConfig,
  ROUTABLE_ACTIONS,
  type RoutableAction,
} from '../../stores/moduleConfig';
import { explainRoute, type RouteReason } from '../../lib/agentRouter';
import { buildAction } from '../../lib/library';
import { cn } from '../../lib/cn';
import type { SpecKind } from '../../../electron/shared/types';
import {
  ModuleHeader,
  ModuleTabs,
  ModuleSection,
  Explainer,
  Callout,
  ScopeChip,
} from '../ModuleShell';
import { OrchestratorView } from '../sidebar/OrchestratorView';

type Sub = 'routing' | 'config' | 'live';

const EXPLAINER = [
  {
    heading: 'What orchestration does',
    body: 'For every step it picks the best-fitting agent and injects the right skills, then runs task waves as parallel Claude subprocesses capped by your concurrency limit.',
  },
  {
    heading: 'The selection logic',
    body: 'Per-task @agent → chat override → your pin → strongest keyword specialist (project-local gets a bonus) → bundled default → generic. Skills: the governing SDD skill always, plus a confident domain match.',
  },
  {
    heading: 'Preview before you run',
    body: 'The routing playground runs the real selection logic on any task text, so you see exactly which agent + skills would fire and the score behind every candidate.',
  },
  {
    heading: 'Tune it to your project',
    body: 'Pin agents to steps, raise/lower the specialist threshold and workspace bonus, toggle skill injection, and set wave concurrency — all applied to future runs immediately.',
  },
];

const REASON_LABEL: Record<RouteReason, string> = {
  'per-task': 'Per-task @agent',
  'chat-override': 'Chat override',
  pinned: 'Pinned',
  default: 'Bundled default',
  specialist: 'Best specialist',
  generic: 'Generic Claude',
};

export function RouterStudio() {
  const [sub, setSub] = useState<Sub>('routing');

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <ModuleHeader
        icon={<Network size={18} />}
        title="Orchestration"
        subtitle="Fits the best agent + skills to each task, and runs the waves"
      />
      <ModuleTabs<Sub>
        value={sub}
        onChange={setSub}
        tabs={[
          { key: 'routing', label: 'Routing playground', icon: <FlaskConical size={13} /> },
          { key: 'config', label: 'Configuration', icon: <SlidersHorizontal size={13} /> },
          { key: 'live', label: 'Live agents', icon: <Activity size={13} /> },
        ]}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {sub === 'routing' && <RoutingPlayground />}
        {sub === 'config' && <ConfigPanel />}
        {sub === 'live' && (
          <div className="max-w-2xl mx-auto py-4">
            <div className="rounded-xl ring-1 ring-ink-800/40 overflow-hidden flex flex-col h-[70vh]">
              <OrchestratorView />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoutingPlayground() {
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const [actionKey, setActionKey] = useState<RoutableAction>('task-execute');
  const [taskText, setTaskText] = useState('Build the settings page: React form, Tailwind styling, dark mode toggle');
  const [specKind, setSpecKind] = useState<SpecKind>('feature');
  const [override, setOverride] = useState('');

  const isTask = actionKey === 'task-execute' || actionKey === 'task-refine';

  const result = useMemo(() => {
    const action = buildAction(actionKey, isTask ? taskText : '');
    return explainRoute(action, agents, skills, specKind, override.trim() || null);
  }, [actionKey, taskText, isTask, agents, skills, specKind, override]);

  const winner = result.agent;

  return (
    <div className="max-w-4xl mx-auto px-7 py-6">
      <Explainer points={EXPLAINER} defaultOpen={agents.length === 0} />

      <div className="grid lg:grid-cols-2 gap-5">
        {/* inputs */}
        <div>
          <ModuleSection title="Simulate a step" desc="Runs the real router — no side effects.">
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-faint mb-1.5">
                  Step
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ROUTABLE_ACTIONS.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => setActionKey(a.key)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-lg text-[12px] text-left transition',
                        actionKey === a.key
                          ? 'bg-accent/12 text-accent ring-1 ring-accent/30'
                          : 'bg-elev/60 text-dim hover:bg-elev'
                      )}
                      title={a.hint}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {isTask && (
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-faint mb-1.5">
                    Task description
                  </label>
                  <textarea
                    value={taskText}
                    onChange={(e) => setTaskText(e.target.value)}
                    className="lib-input min-h-[90px] resize-none font-mono text-[12px]"
                    placeholder="Describe the work — the router scores agents against this text."
                  />
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] uppercase tracking-wide text-faint mb-1.5">
                    Spec kind
                  </label>
                  <div className="flex gap-1.5">
                    {(['feature', 'bugfix'] as SpecKind[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => setSpecKind(k)}
                        className={cn(
                          'flex-1 px-2.5 py-1.5 rounded-lg text-[12px] capitalize transition',
                          specKind === k
                            ? 'bg-accent/12 text-accent ring-1 ring-accent/30'
                            : 'bg-elev/60 text-dim hover:bg-elev'
                        )}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] uppercase tracking-wide text-faint mb-1.5">
                    Chat @override
                  </label>
                  <input
                    value={override}
                    onChange={(e) => setOverride(e.target.value)}
                    placeholder="(none)"
                    className="lib-input"
                  />
                </div>
              </div>
            </div>
          </ModuleSection>
        </div>

        {/* outcome */}
        <div>
          <ModuleSection title="Resolved routing" desc="What would actually run.">
            <div className="rounded-xl bg-gradient-to-b from-elev to-card p-4 mb-3">
              <div className="flex items-center gap-2 text-[11px] text-faint mb-2">
                <span className="font-mono uppercase tracking-wider">agent</span>
                <ArrowRight size={11} />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 grid place-items-center rounded-lg bg-accent/12 text-accent shrink-0">
                  <Bot size={17} />
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-ink-50 truncate">
                    {winner.name ?? 'Generic Claude'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ReasonBadge reason={winner.reason} />
                  </div>
                </div>
              </div>

              <div className="h-px bg-ink-800/40 my-3" />

              <div className="flex items-center gap-2 text-[11px] text-faint mb-2">
                <span className="font-mono uppercase tracking-wider">skills injected</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.governingSkill && (
                  <SkillChip name={result.governingSkill.name} kind="governing" />
                )}
                {result.domainSkill && (
                  <SkillChip name={result.domainSkill.name} kind="domain" />
                )}
                {!result.governingSkill && !result.domainSkill && (
                  <span className="text-[12px] text-faint">None</span>
                )}
              </div>
            </div>
          </ModuleSection>
        </div>
      </div>

      {/* candidate breakdown */}
      <ModuleSection
        title="Candidate scoring"
        desc="Every installed agent scored against this step's capability keywords. Highest wins (unless overridden by a pin or the bundled default)."
      >
        {result.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {result.keywords.slice(0, 16).map((k) => (
              <span key={k} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-ink-800 text-dim">
                {k}
              </span>
            ))}
          </div>
        )}
        {result.candidates.length === 0 ? (
          <Callout>
            No installed agent matched this step's keywords.{' '}
            {winner.name
              ? `Routing fell back to ${winner.name} (${REASON_LABEL[winner.reason].toLowerCase()}).`
              : 'A generic Claude run would handle it.'}
          </Callout>
        ) : (
          <div className="space-y-1.5">
            {result.candidates.slice(0, 8).map((c) => {
              const isWinner = c.agent.name === winner.name;
              return (
                <div
                  key={c.agent.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg',
                    isWinner ? 'bg-accent/10 ring-1 ring-accent/30' : 'bg-elev/40'
                  )}
                >
                  <Bot size={14} className={isWinner ? 'text-accent' : 'text-dim'} />
                  <span className="text-[12.5px] text-ink-100 font-medium truncate min-w-0 flex-1">
                    {c.agent.name}
                  </span>
                  <ScopeChip scope={c.agent.scope} />
                  <div className="flex flex-wrap gap-1 justify-end max-w-[40%]">
                    {c.hits.slice(0, 4).map((h) => (
                      <span key={h} className="font-mono text-[9.5px] px-1 py-0.5 rounded bg-ink-800 text-faint">
                        {h}
                      </span>
                    ))}
                  </div>
                  <span
                    className={cn(
                      'font-mono text-[12px] tabular-nums w-10 text-right',
                      isWinner ? 'text-accent font-bold' : 'text-dim'
                    )}
                  >
                    {c.score.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ModuleSection>
    </div>
  );
}

function ReasonBadge({ reason }: { reason: RouteReason }) {
  const tone =
    reason === 'generic'
      ? 'bg-ink-700/60 text-ink-300'
      : reason === 'pinned'
        ? 'bg-accent/15 text-accent'
        : reason === 'specialist'
          ? 'bg-good/12 text-good'
          : 'bg-sky-500/15 text-sky-300';
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1', tone)}>
      {reason === 'pinned' && <Pin size={9} />}
      {REASON_LABEL[reason]}
    </span>
  );
}

function SkillChip({ name, kind }: { name: string; kind: 'governing' | 'domain' }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[11.5px] px-2 py-1 rounded-lg font-medium',
        kind === 'governing' ? 'bg-sky-500/12 text-sky-300' : 'bg-good/12 text-good'
      )}
    >
      <Sparkles size={11} /> {name}
    </span>
  );
}

function ConfigPanel() {
  const config = useModuleConfig((s) => s.config);
  const set = useModuleConfig((s) => s.set);
  const pinAgent = useModuleConfig((s) => s.pinAgent);
  const reset = useModuleConfig((s) => s.reset);
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const maxConcurrency = useOrchestrator((s) => s.maxConcurrency);
  const setMaxConcurrency = useOrchestrator((s) => s.setMaxConcurrency);

  const changeConcurrency = async (n: number) => {
    const clamped = Math.max(1, Math.min(8, n));
    setMaxConcurrency(clamped);
    await window.kraken.settings.setMaxConcurrency(clamped);
  };

  return (
    <div className="max-w-3xl mx-auto px-7 py-6">
      <div className="flex justify-end mb-4">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-[12px] text-dim hover:text-ink-50 px-2.5 h-8 rounded-lg bg-elev"
        >
          <RotateCcw size={12} /> Reset to defaults
        </button>
      </div>

      <ModuleSection title="Agent pins" desc="Force a specific agent for a step, overriding automatic routing.">
        <div className="space-y-1.5">
          {ROUTABLE_ACTIONS.map((a) => (
            <div key={a.key} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-elev/40">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-ink-100">{a.label}</div>
                <div className="text-[11px] text-faint truncate">{a.hint}</div>
              </div>
              <select
                value={config.pinnedAgents[a.key] ?? ''}
                onChange={(e) => pinAgent(a.key as RoutableAction, e.target.value || null)}
                className="lib-input w-[190px] h-8 py-0"
              >
                <option value="">Auto-route</option>
                {agents.map((ag) => (
                  <option key={ag.path} value={ag.name}>
                    {ag.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </ModuleSection>

      <ModuleSection title="Routing weights" desc="How the automatic scorer breaks ties and picks specialists.">
        <div className="space-y-2">
          <Stepper
            label="Workspace bonus"
            hint="Score added to project-local agents so they beat global ones."
            value={config.workspaceBonus}
            step={0.5}
            min={0}
            max={3}
            fmt={(v) => `+${v.toFixed(1)}`}
            onChange={(v) => set('workspaceBonus', v)}
          />
          <Stepper
            label="Specialist threshold"
            hint="Minimum score for a matched specialist to beat the bundled default."
            value={config.specialistThreshold}
            step={1}
            min={1}
            max={6}
            fmt={(v) => String(v)}
            onChange={(v) => set('specialistThreshold', v)}
          />
          <Toggle
            label="Local-first fallback"
            hint="When nothing matches a task, use the first project-local agent instead of generic Claude."
            value={config.localFirst}
            onChange={(v) => set('localFirst', v)}
          />
        </div>
      </ModuleSection>

      <ModuleSection title="Skill injection" desc="Which skills get prepended to the system prompt on a run.">
        <div className="space-y-2">
          <Toggle
            label="Inject governing SDD skill"
            hint="sdd-feature / sdd-bugfix injected into every spec + task run."
            value={config.skillInjection}
            onChange={(v) => set('skillInjection', v)}
          />
          <Toggle
            label="Inject matching domain skill"
            hint="Add a domain skill (e.g. frontend) when it confidently matches the task."
            value={config.domainSkillInjection}
            onChange={(v) => set('domainSkillInjection', v)}
          />
          <Stepper
            label="Domain-skill confidence"
            hint="Minimum keyword score before a domain skill is injected."
            value={config.domainSkillThreshold}
            step={1}
            min={1}
            max={6}
            fmt={(v) => String(v)}
            onChange={(v) => set('domainSkillThreshold', v)}
          />
        </div>
        {config.disabledSkills.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] text-faint mb-1.5">Disabled skills (excluded from injection):</div>
            <div className="flex flex-wrap gap-1.5">
              {config.disabledSkills.map((name) => (
                <span key={name} className="text-[11px] px-2 py-1 rounded-lg bg-ink-800 text-ink-300 line-through">
                  {name}
                </span>
              ))}
            </div>
            <p className="text-[10.5px] text-faint mt-1.5">
              Toggle these back on from the Skills module. {skills.length} skills installed.
            </p>
          </div>
        )}
      </ModuleSection>

      <ModuleSection title="Wave concurrency" desc="How many task agents run in parallel per wave.">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-elev/40">
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] text-ink-100">Max parallel agents</div>
            <div className="text-[11px] text-faint">Shared with Settings → Orchestration and the live panel.</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => changeConcurrency(maxConcurrency - 1)}
              disabled={maxConcurrency <= 1}
              className="w-7 h-7 grid place-items-center rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
            >
              <Minus size={13} />
            </button>
            <span className="text-[14px] font-mono text-ink-50 w-5 text-center">{maxConcurrency}</span>
            <button
              onClick={() => changeConcurrency(maxConcurrency + 1)}
              disabled={maxConcurrency >= 8}
              className="w-7 h-7 grid place-items-center rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      </ModuleSection>
    </div>
  );
}

function Stepper({
  label,
  hint,
  value,
  step,
  min,
  max,
  fmt,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  step: number;
  min: number;
  max: number;
  fmt: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v * 10) / 10));
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-elev/40">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-ink-100">{label}</div>
        <div className="text-[11px] text-faint">{hint}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          className="w-7 h-7 grid place-items-center rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
        >
          <Minus size={13} />
        </button>
        <span className="text-[13px] font-mono text-ink-50 w-10 text-center">{fmt(value)}</span>
        <button
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          className="w-7 h-7 grid place-items-center rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-elev/40 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-ink-100">{label}</div>
        <div className="text-[11px] text-faint">{hint}</div>
      </div>
      <span
        className={cn(
          'w-9 h-5 rounded-full p-0.5 transition shrink-0',
          value ? 'bg-accent' : 'bg-ink-700'
        )}
      >
        <span
          className={cn(
            'block w-4 h-4 rounded-full bg-white transition-transform',
            value && 'translate-x-4'
          )}
        />
      </span>
    </button>
  );
}
