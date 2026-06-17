import { ArrowRight } from 'lucide-react';
import { Section, Reveal, SectionHeading } from '../components/ui';
import { FeatureCard } from '../components/FeatureCard';
import { AppShot } from '../components/AppShot';
import { Button } from '../components/Button';
import { FEATURES } from '../content/features';

export function Features() {
  return (
    <>
      <Section className="pt-16 text-center sm:pt-24">
        <div className="flex flex-col items-center">
          <SectionHeading
            eyebrow="Features"
            title={<>Built for the way specs really get done.</>}
            blurb="Kraken composes the whole Spec-Driven Development loop into one desktop app — and meets your existing Claude Code setup where it already lives."
          />
        </div>
      </Section>

      <Section className="mt-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.06}>
              <FeatureCard feature={f} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Screenshot strip */}
      <Section className="mt-28">
        <div className="flex flex-col items-center">
          <SectionHeading
            eyebrow="In the app"
            title={<>See it in motion.</>}
            blurb="Real captures from the desktop app — the spec editor, the open-questions module, and source control."
          />
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <Reveal>
            <AppShot src="/screens/spec-editor.png" alt="Spec editor — requirements" />
          </Reveal>
          <Reveal delay={0.08}>
            <AppShot src="/screens/questions.png" alt="Open Questions module" />
          </Reveal>
          <Reveal delay={0.04}>
            <AppShot src="/screens/source-control.png" alt="Source Control — pull request" />
          </Reveal>
          <Reveal delay={0.12}>
            <AppShot src="/screens/tasks.png" alt="Wave-based task runner" />
          </Reveal>
        </div>
      </Section>

      <Section className="mt-24 text-center">
        <Reveal>
          <Button to="/workflow">
            Explore the SDD workflow <ArrowRight size={16} />
          </Button>
        </Reveal>
      </Section>
    </>
  );
}
