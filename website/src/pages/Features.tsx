import { Section, SectionHeading, Reveal, Eyebrow } from '../components/ui';
import { FeatureCard } from '../components/FeatureCard';
import { Button } from '../components/Button';
import { GROUPS } from '../content/features';
import { ArrowRight } from 'lucide-react';

export function Features() {
  return (
    <>
      <Section className="pt-20 pb-12 sm:pt-24">
        <Reveal>
          <div className="flex max-w-3xl flex-col gap-5">
            <Eyebrow>Capabilities</Eyebrow>
            <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-tight text-ink-50 sm:text-5xl">
              Everything the workbench does.
            </h1>
            <p className="text-[17px] leading-relaxed text-ink-300">
              Grouped the way the app is: the loop itself, the engine underneath it, the Claude Code
              setup it reads, and what happens once more than one thing is running at a time.
            </p>
          </div>
        </Reveal>
      </Section>

      {GROUPS.map((group, gi) => (
        <Section key={group.id} id={group.id} className="py-14">
          <div className="rule mb-10" />
          <Reveal>
            <SectionHeading
              eyebrow={group.eyebrow}
              title={group.title}
              blurb={group.blurb}
              tone={gi % 2 === 1 ? 'agent' : 'accent'}
            />
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((f, i) => (
              <Reveal key={f.title} delay={0.04 * i} className="h-full">
                <FeatureCard {...f} />
              </Reveal>
            ))}
          </div>
        </Section>
      ))}

      <Section className="py-16">
        <Reveal>
          <div className="border border-line bg-panel p-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <h2 className="font-display text-2xl font-bold tracking-tight text-ink-50">
                  The full picture is in the repo.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">
                  Architecture, the IPC contract, the data model, the backends and every subsystem
                  are documented alongside the code.
                </p>
              </div>
              <Button to="/docs">
                Docs <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
