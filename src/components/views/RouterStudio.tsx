import { useMemo, useState } from 'react';
import {
  Route,
  Bot,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Pin,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import {
  useModuleConfig,
  ROUTABLE_ACTIONS,
  type RoutableAction,
} from '../../stores/moduleConfig';
import { explainRoute, type RouteReason } from '../../lib/agentRouter';
import { buildAction } from '../../lib/library';
import { cn } from '../../lib/cn';
import type { SpecKind } from '../../../electron/shared/types';
import { ModuleHeader, ModuleSection, Explainer, Callout, ScopeChip } from '../ModuleShell';

const EXPLAINER = [
  {
    heading: 'Routing just works',
    body: 'For every step Octo picks the best-fitting installed agent and injects the right skills automatically: per-task @agent → chat override → your pin → strongest keyword specialist (project-local wins ties) → bundled default → generic.',
  },
  {
    heading: 'See why, before you run',
    body: 'This page runs the real selection logic on any task text, so you can see exactly which agent + skills would fire and the score behind every candidate. The same explanation appears on task rows while waves run.',
  },
  {
    heading: 'Override only when needed',
    body: 'The tuning weights are sensible constants now. If routing picks wrong for a step, pin an agent under Advanced — pins beat everything except an explicit @agent.',
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

/**
 * Routing — a read-only "why was this agent chosen" explainer, plus a
 * collapsed Advanced section for per-step agent pins and skill injection.
 * The old tuning knobs (workspace bonus, thresholds, local-first) are
 * invisible defaults now; concurrency lives on the tasks board and Activity.
 */
export function RouterStudio() {
  return (
    <div className="h-full flex flex-col bg-ink-950">
      <ModuleHeader
        icon={<Route size={18} />}
        title="Routing"
        subtitle="Why each step gets the agent and skills it does"
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <RoutingPlayground />
      </div>
    </div>
  );
}

function RoutingPlayground() {
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const [actionKey, setActionKey] = useState<RoutableAction>('task-execute');
  const [taskText, setTaskText] = useState(
    'Build the settings page: React form, Tailwind styling, dark mode toggle'
  );
  const [specKind, setSpecKind] = useState<SpecKind>('feature');

  const isTask = actionKey === 'task-execute' || actionKey === 'task-refine';

  const result = useMemo(() => {
    const action = buildAction(actionKey, isTask ? taskText : '');
    return explainRoute(action, agents, skills, specKind, null);
  }, [actionKey, taskText, isTask, agents, skills, specKind]);

  const winner = result.agent;

  return (
    <div className="k-wide py-6">
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

              <div>
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
                {result.domainSkill && <SkillChip name={result.domainSkill.name} kind="domain" />}
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

      <AdvancedSection />
    </div>
  );
}

/** Pins + skill injection, collapsed by default — overrides, not homework. */
function AdvancedSection() {
  const [open, setOpen] = useState(false);
  const config = useModuleConfig((s) => s.config);
  const set = useModuleConfig((s) => s.set);
  const pinAgent = useModuleConfig((s) => s.pinAgent);
  const reset = useModuleConfig((s) => s.reset);
  const agents = useWorkspace((s) => s.agents);

  const pinCount = Object.keys(config.pinnedAgents).length;
  const injectionOn = config.skillInjection && config.domainSkillInjection;

  const setInjection = (v: boolean) => {
    set('skillInjection', v);
    set('domainSkillInjection', v);
  };

  return (
    <div className="mt-6 rounded-xl ring-1 ring-ink-800/50 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-elev/40 transition"
      >
        {open ? (
          <ChevronDown size={14} className="text-faint" />
        ) : (
          <ChevronRight size={14} className="text-faint" />
        )}
        <span className="text-[13px] font-semibold text-ink-100">Advanced</span>
        <span className="text-[11px] text-faint">
          agent pins{pinCount > 0 ? ` (${pinCount} set)` : ''} · skill injection
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[12px] font-semibold text-ink-100">Agent pins</div>
                <div className="text-[11px] text-faint">
                  Force a specific agent for a step — beats automatic routing.
                </div>
              </div>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-[11px] text-dim hover:text-ink-50 px-2 h-7 rounded-lg bg-elev"
              >
                <RotateCcw size={11} /> Reset
              </button>
            </div>
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
          </div>

          <button
            onClick={() => setInjection(!injectionOn)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-elev/40 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] text-ink-100">Auto-inject matching skills</div>
              <div className="text-[11px] text-faint">
                The governing SDD skill on every run, plus a domain skill when it confidently
                matches the task. Disable individual skills from the Skills section.
              </div>
            </div>
            <span
              className={cn(
                'w-9 h-5 rounded-full p-0.5 transition shrink-0',
                injectionOn ? 'bg-accent' : 'bg-ink-700'
              )}
            >
              <span
                className={cn(
                  'block w-4 h-4 rounded-full bg-white transition-transform',
                  injectionOn && 'translate-x-4'
                )}
              />
            </span>
          </button>

          {config.disabledSkills.length > 0 && (
            <div>
              <div className="text-[11px] text-faint mb-1.5">Disabled skills:</div>
              <div className="flex flex-wrap gap-1.5">
                {config.disabledSkills.map((name) => (
                  <span
                    key={name}
                    className="text-[11px] px-2 py-1 rounded-lg bg-ink-800 text-ink-300 line-through"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
