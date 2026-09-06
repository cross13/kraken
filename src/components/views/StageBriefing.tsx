import { useMemo } from 'react';
import { ArrowUpRight, Bot, Globe, Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useWorkspace } from '../../stores/workspace';
import { useChat } from '../../stores/chat';
import { useUi } from '../../stores/ui';
import { explainRoute, type SpecDocFile } from '../../lib/agentRouter';
import { REASON_LABEL } from '../../lib/library';
import { resolveAgent, resolveSkill } from '../../lib/verifyLibrary';
import { parseOpenQuestions } from '../../lib/openQuestions';
import { OctoMascot, type MascotState } from '../wide/OctoMascot';
import { TicketPanel } from './TicketPanel';
import type { SpecMeta } from '../../../electron/shared/types';

/**
 * Who is about to write this document, and how they go about it.
 *
 * Routing is decided long before the run starts, but until now the only place
 * that showed it was Library › Routing — a different surface entirely. This is
 * the same `explainRoute` call the playground makes, rendered where the decision
 * actually lands, and it passes the chat's `@agent` override because
 * `draftSpecDoc` does: a briefing that ignored it would be wrong exactly when it
 * matters most.
 *
 * The creature and its states are the Travel Display's, deliberately — one
 * vocabulary for "what is this agent doing" across both windows.
 */

interface StepCopy {
  /** One line: what this step produces. */
  summary: string;
  /** How the run actually proceeds — every line is a real mechanic. */
  steps: string[];
}

const HOW: Record<SpecDocFile, StepCopy> = {
  requirements: {
    summary: 'Turns your brief into user stories and criteria something can be checked against.',
    steps: [
      'Reads your brief plus the project steering docs that apply.',
      'Writes requirements.md — stories numbered US-n, acceptance criteria numbered AC-n in EARS form, each naming the story it answers.',
      'Stops at the gate. Approving opens Clarify, where the decisions the plan needs get settled first.',
    ],
  },
  bugfix: {
    summary: 'Turns the report into a reproduction, a defect, and the guards that keep it fixed.',
    steps: [
      'Reads your report and greps the code around it.',
      'Writes bugfix.md — reproduction steps, the current behavior, the corrected behavior as AC-n, and Unchanged Behavior guards.',
      'Stops at the gate. Approving opens Clarify.',
    ],
  },
  plan: {
    summary: 'Turns approved criteria into an approach, literal contracts, and the task waves.',
    steps: [
      'Reads the approved criteria and any Resolved Decisions, then greps for the real file paths.',
      'If a decision would change the plan and nothing settled it, writes questions into Open Questions and stops — once. Revise, Improve and Quick Plan never stop.',
      'Otherwise writes plan.md: approach diagram, affected files, contracts as code, risks, verification and the waves, citing each AC-n.',
      'Approving derives tasks.md from the plan’s ## Tasks section, and refuses if there isn’t one.',
    ],
  },
  tasks: {
    summary: 'The list Build executes — one run per task, parallel within a wave.',
    steps: [
      'Each task is routed on its own text, so a frontend task and a migration get different specialists.',
      'Pin one yourself by writing @agent-name right after the id on a task line.',
      'A run that has to deviate records it under the plan’s ## Critical Decisions, so the plan never drifts from the code.',
    ],
  },
};

export function StageBriefing({
  meta,
  files,
  file,
  content,
  drafting,
}: {
  meta: SpecMeta;
  /** every document of the spec — the ticket panel derives what is pending from them */
  files: Record<string, string>;
  file: SpecDocFile;
  content: string;
  drafting: boolean;
}) {
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const selectedAgent = useChat((s) => s.selectedAgent);
  const openOverlay = useUi((s) => s.openOverlay);
  const openLibrary = useUi((s) => s.openLibrary);

  const route = useMemo(
    () =>
      explainRoute(
        { kind: 'spec-file', file, specKind: meta.kind },
        agents,
        skills,
        meta.kind,
        selectedAgent
      ),
    [file, meta.kind, agents, skills, selectedAgent]
  );

  const openQuestions = useMemo(
    () => parseOpenQuestions(content).questions.filter((q) => !q.resolved).length,
    [content]
  );

  // The same three states the colony uses: cutting, deciding, resting.
  const state: MascotState = drafting ? 'work' : openQuestions > 0 ? 'think' : 'sleep';
  const how = HOW[file];
  const agentMeta = route.agent.name
    ? agents.find((a) => a.name === route.agent.name) ?? null
    : null;

  const injected = [
    route.governingSkill && { skill: route.governingSkill, role: 'Stages and gates' },
    route.formatSkill && { skill: route.formatSkill, role: 'Document shape' },
    route.domainSkill && { skill: route.domainSkill, role: 'Domain match' },
  ].filter(Boolean) as { skill: { name: string }; role: string }[];

  return (
    <aside className="k-listpane h-full min-h-0 overflow-y-auto border-l border-ink-700/60 bg-ink-900/30">
      <div className="px-4 py-4 space-y-5">
        {/* The creature, in the state this step is actually in */}
        <div className="flex flex-col items-center">
          <div className={cn('w-[88px]', `k-mascot-${state}`, !drafting && 'k-still')}>
            <div className={drafting ? 'k-mascot-bob' : undefined}>
              <OctoMascot state={state} seed={3} />
            </div>
          </div>
          <div className="mt-2 text-[11px] text-faint text-center leading-snug">
            {drafting
              ? `Writing ${file}.md now`
              : openQuestions > 0
                ? `${openQuestions} open question${openQuestions === 1 ? '' : 's'} to settle first`
                : 'Waiting on you'}
          </div>
        </div>

        {/* The tracker ticket, and anything it is still owed. Renders nothing —
            heading included — when no tracker is configured and the spec isn't
            linked. */}
        <TicketPanel
          meta={meta}
          files={{ plan: files.plan, requirements: files.requirements, bugfix: files.bugfix }}
          compact
        />

        {/* Who runs it */}
        <Section title="Who writes this">
          {agentMeta ? (
            <button
              onClick={() =>
                resolveAgent(agentMeta.name, agents).path &&
                openOverlay({ kind: 'agent', path: resolveAgent(agentMeta.name, agents).path! })
              }
              className="w-full text-left rounded-lg bg-card ring-1 ring-ink-700/70 hover:ring-accent/40 transition p-3 group"
            >
              <div className="flex items-center gap-2 mb-1">
                <Bot size={13} className="text-accent shrink-0" />
                <span className="text-[12.5px] font-medium text-ink-50 truncate">
                  {agentMeta.name}
                </span>
                <ArrowUpRight
                  size={12}
                  className="ml-auto text-faint opacity-0 group-hover:opacity-100 transition"
                />
              </div>
              <div className="text-[11px] text-dim leading-snug line-clamp-4">
                {agentMeta.description}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Tag>{REASON_LABEL[route.agent.reason]}</Tag>
                {agentMeta.scope === 'global' && (
                  <Tag>
                    <Globe size={9} className="inline -mt-px mr-0.5" />
                    global
                  </Tag>
                )}
              </div>
            </button>
          ) : (
            <p className="text-[11.5px] text-dim leading-snug">
              No specialized agent is installed for this step, so Claude runs with the generic
              prompt. Seeding Octo&rsquo;s defaults from Library&nbsp;› Agents installs one.
            </p>
          )}
        </Section>

        {/* What gets injected on top */}
        {injected.length > 0 && (
          <Section title="Instructions it carries">
            <ul className="space-y-1.5">
              {injected.map(({ skill, role }) => (
                <li key={skill.name}>
                  <button
                    onClick={() =>
                      resolveSkill(skill.name, skills).path &&
                      openOverlay({ kind: 'skill', path: resolveSkill(skill.name, skills).path! })
                    }
                    className="w-full flex items-baseline gap-2 text-left rounded-md px-2 py-1.5 -mx-2 hover:bg-elev transition"
                  >
                    <Sparkles size={11} className="text-accent shrink-0 translate-y-px" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] font-mono text-ink-200 truncate">
                        {skill.name}
                      </span>
                      <span className="block text-[10.5px] text-faint">{role}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* How the step actually runs */}
        <Section title="How it works">
          <p className="text-[11.5px] text-dim leading-relaxed mb-2.5">{how.summary}</p>
          <ol className="space-y-2">
            {how.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="shrink-0 w-[17px] h-[17px] grid place-items-center rounded-full bg-elev text-[10px] font-mono text-faint tabular-nums">
                  {i + 1}
                </span>
                <span className="text-[11.5px] text-dim leading-snug">{s}</span>
              </li>
            ))}
          </ol>
        </Section>

        <button
          onClick={() => openLibrary('routing')}
          className="w-full text-[11px] text-faint hover:text-ink-200 transition text-left"
        >
          Change who runs each step in Library&nbsp;› Routing →
        </button>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-[0.07em] text-ink-500 font-semibold mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-ink-800 text-ink-400">{children}</span>
  );
}
