import { FileText, PenLine, ListChecks, Rocket, ArrowRight } from 'lucide-react';
import { Section, Reveal, SectionHeading, Eyebrow } from '../components/ui';
import { WorkflowFlow } from '../components/flow/WorkflowFlow';
import { Button } from '../components/Button';

const PHASES = [
  {
    icon: FileText,
    name: 'Requirements',
    desc: 'Capture the capability in EARS-formatted acceptance criteria. Surface open questions out of the prose, answer them with AI suggestions, and fold the decisions back in.',
    artifact: 'requirements.md',
  },
  {
    icon: PenLine,
    name: 'Design',
    desc: 'Turn settled requirements into architecture: components, data & state, sequences, error handling, and a testing strategy mapped back to every criterion.',
    artifact: 'design.md',
  },
  {
    icon: ListChecks,
    name: 'Tasks',
    desc: 'Break the design into dependency-ordered waves. Wave 1 is parallel-safe; later waves declare their prerequisites. Each task has one observable outcome.',
    artifact: 'tasks.md',
  },
  {
    icon: Rocket,
    name: 'Execution',
    desc: 'Run waves as parallel Claude agents with failure isolation. Autopilot drives every wave to done, waiting on blocking hooks between them, then advances to shipped.',
    artifact: 'parallel agents',
  },
];

export function Workflow() {
  return (
    <>
      <Section className="pt-16 text-center sm:pt-24">
        <div className="flex flex-col items-center">
          <SectionHeading
            eyebrow="The methodology"
            title={
              <>
                Requirements → design → tasks → <span className="text-gradient">execution</span>.
              </>
            }
            blurb="Spec-Driven Development makes the spec the source of truth and the unit of progress. Kraken walks the fixed loop, lazily scaffolding each phase, with Claude as the engine."
          />
        </div>
      </Section>

      {/* Interactive diagram */}
      <Section className="mt-14">
        <Reveal>
          <div className="mb-4 flex items-center gap-2 text-xs text-ink-500">
            <span className="chip">Interactive</span>
            <span>drag to pan · scroll to zoom — agents, skills, hooks &amp; steering feed every phase</span>
          </div>
          <WorkflowFlow />
        </Reveal>
      </Section>

      {/* Phase breakdown */}
      <Section className="mt-28">
        <div className="grid gap-6 md:grid-cols-2">
          {PHASES.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.name} delay={(i % 2) * 0.08}>
                <div className="card flex h-full gap-5 p-7">
                  <div className="flex flex-col items-center">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent">
                      <Icon size={22} />
                    </div>
                    <div className="mt-2 font-mono text-[10px] text-ink-600">{`0${i + 1}`}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-xl font-semibold text-ink-50">{p.name}</h3>
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-glowcyan">
                        {p.artifact}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-300">{p.desc}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* Loop note */}
      <Section className="mt-24">
        <Reveal>
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/[0.07] bg-ink-950/50 px-8 py-12 text-center">
            <Eyebrow>Always re-openable</Eyebrow>
            <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink-50">
              Drift happens. Re-sync without losing the thread.
            </h2>
            <p className="max-w-xl text-ink-300">
              Reopen any phase, run a <span className="font-mono text-glowcyan">spec-doctor</span> audit
              to catch drift between requirements, design, tasks, and code — then keep going.
            </p>
            <Button to="/download" className="mt-2">
              Start your first spec <ArrowRight size={16} />
            </Button>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
