import { Section, SectionHeading, Reveal, Eyebrow, Panel } from '../components/ui';
import { Button } from '../components/Button';
import { WorkflowFlow } from '../components/flow/WorkflowFlow';
import { ArrowRight } from 'lucide-react';

const STAGES = [
  {
    n: '01',
    name: 'Requirements',
    file: 'requirements.md',
    body: 'User stories with acceptance criteria in EARS form. The Review stage groups each criterion under the story it answers, checks the wording for things no one could test, and lists the stories nothing covers yet. A bugfix spec swaps this for a single bugfix.md.',
    gate: 'Approve, revise with feedback, or run a critical self-review that refines the document in place.',
  },
  {
    n: '02',
    name: 'Plan',
    file: 'plan.md',
    body: 'Approving Requirements does not open a blank plan — it opens Clarify. Every unsettled decision is a card with pre-loaded options; applying them writes ## Resolved Decisions and drafts the plan. The plan itself is a diagram, the affected files, the changes by area with literal contracts, and the waves.',
    gate: 'Approving derives tasks.md from the plan’s ## Tasks section — and refuses when there is not one.',
  },
  {
    n: '03',
    name: 'Build',
    file: 'tasks.md',
    body: 'Tasks render as inline blocks with Start-task actions; Run all is the primary action and executes the waves autonomously. A task that deviates from the plan appends a Critical Decision back into it. When the last task completes the spec advances on its own, a summary is generated, and the Ship panel opens inside Build.',
    gate: 'No gate — the payoff is automatic. Branch, commit all and create PR are right there.',
  },
];

export function Workflow() {
  return (
    <>
      <Section className="pt-20 pb-12 sm:pt-24">
        <Reveal>
          <div className="flex max-w-3xl flex-col gap-5">
            <Eyebrow>Methodology</Eyebrow>
            <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-tight text-ink-50 sm:text-5xl">
              The loop, and why it is shaped like this.
            </h1>
            <p className="text-[17px] leading-relaxed text-ink-300">
              Most tools collapse the spec into the chat. Here the spec is the artifact and the chat
              is the engine — three stages, each producing a document the next one reads, and a
              human required in exactly two places.
            </p>
          </div>
        </Reveal>
      </Section>

      <Section className="py-8">
        <Reveal>
          <WorkflowFlow />
        </Reveal>
        <Reveal delay={0.1} className="mt-4">
          <p className="font-mono text-xs text-ink-600">
            Drag a node. Dashed grey edges are what feeds a run: your tickets, steering, skills,
            agents and hooks.
          </p>
        </Reveal>
      </Section>

      <Section className="py-14">
        <div className="flex flex-col gap-5">
          {STAGES.map((s, i) => (
            <Reveal key={s.n} delay={0.05 * i}>
              <Panel>
                <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr_1fr] lg:gap-10">
                  <div className="flex items-baseline gap-4 lg:flex-col lg:gap-2">
                    <span className="font-display text-4xl font-bold leading-none text-accent-text">
                      {s.n}
                    </span>
                    <div>
                      <div className="font-display text-lg font-semibold tracking-tight text-ink-50">
                        {s.name}
                      </div>
                      <div className="font-mono text-[11px] text-ink-600">{s.file}</div>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-400">{s.body}</p>
                  <div className="border-l-0 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-agent-text">
                      What ends the stage
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-400">{s.gate}</p>
                  </div>
                </div>
              </Panel>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="py-14">
        <div className="rule mb-10" />
        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal>
            <SectionHeading
              eyebrow="Reading mode"
              title={<>Zen, for the documents you actually have to read.</>}
              blurb="One column at a reading measure, an ambient contents spine that follows the scroll, and every id — AC-3, T1, the story a criterion answers — in an 84px left gutter instead of as a chip inside the sentence. The gate’s Approve sits at the end of the document, not in permanent chrome."
            />
          </Reveal>
          <Reveal delay={0.1}>
            <SectionHeading
              eyebrow="Traceability"
              title={<>Which criterion does this task satisfy?</>}
              blurb="The Review stage puts the acceptance criteria beside the plan. Selecting one lights the sections, tasks and files that satisfy it — read from explicit AC-n citations, falling back to block-level vocabulary matching where there are none. The criteria nothing covers are the point."
              tone="agent"
            />
          </Reveal>
        </div>
      </Section>

      <Section className="py-16">
        <Reveal>
          <div className="border border-line bg-panel p-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="max-w-xl font-display text-2xl font-bold tracking-tight text-ink-50">
                Run it against a repo you already know.
              </h2>
              <Button to="/download">
                Install <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
