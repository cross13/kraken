import { motion } from 'framer-motion';
import { ArrowRight, Github, Terminal, Cpu, Network, Workflow as WorkflowIcon } from 'lucide-react';
import { Section, Reveal, Eyebrow, SectionHeading } from '../components/ui';
import { Button } from '../components/Button';
import { KrakenLogo } from '../components/KrakenLogo';
import { SddFlow } from '../components/flow/SddFlow';
import { AppShot } from '../components/AppShot';
import { FeatureCard } from '../components/FeatureCard';
import { FEATURES } from '../content/features';
import { GITHUB_URL } from '../components/site';

const fade = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export function Home() {
  return (
    <>
      {/* HERO */}
      <Section className="relative pt-20 sm:pt-28">
        {/* Big ghost mark behind the headline */}
        <div className="pointer-events-none absolute left-1/2 top-4 -z-10 -translate-x-1/2">
          <div className="relative h-72 w-72 text-accent/[0.13]">
            <div className="absolute inset-10 rounded-full bg-accent/10 blur-3xl" />
            <KrakenLogo className="h-full w-full animate-floaty" />
          </div>
        </div>

        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <motion.div custom={0} variants={fade} initial="hidden" animate="show">
            <Eyebrow>The SDD workbench for Claude</Eyebrow>
          </motion.div>

          <motion.h1
            custom={1}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink-50 sm:text-7xl"
          >
            Drive the full <span className="text-gradient text-glow">SDD loop</span> with Claude.
          </motion.h1>

          <motion.p
            custom={2}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-300 sm:text-xl"
          >
            Kraken keeps your spec a first-class artifact — requirements, design, tasks,
            execution — and uses your local Claude CLI or the Anthropic API as the engine that
            drafts, refines, and ships it.
          </motion.p>

          <motion.div
            custom={3}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Button to="/download">
              Get started <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
            </Button>
            <Button to="/workflow" variant="ghost">
              <WorkflowIcon size={16} /> See the workflow
            </Button>
            <Button href={GITHUB_URL} variant="glass">
              <Github size={16} /> Star on GitHub
            </Button>
          </motion.div>

          <motion.div
            custom={4}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-8 inline-flex items-center gap-3 rounded-xl border border-white/[0.08] bg-ink-950/70 px-4 py-2.5 font-mono text-[13px] text-ink-300 shadow-deep"
          >
            <Terminal size={14} className="text-glowcyan" />
            <span className="text-ink-500">$</span>
            <span>git clone kraken &amp;&amp; npm run dev</span>
          </motion.div>
        </div>

        {/* SDD loop diagram */}
        <Reveal delay={0.15} className="mt-16">
          <div className="relative rounded-3xl border border-white/[0.07] bg-ink-950/40 p-2 shadow-deep">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-accent/10 blur-3xl" />
            <SddFlow />
          </div>
        </Reveal>
      </Section>

      {/* HERO SHOT */}
      <Section className="mt-24">
        <Reveal>
          <AppShot
            src="/screens/hero.png"
            alt="Kraken — spec editor"
            caption="The Kraken workbench: spec on the left, Claude streaming on the right."
          />
        </Reveal>
      </Section>

      {/* TWO BACKENDS */}
      <Section className="mt-32">
        <div className="flex flex-col items-center gap-12">
          <SectionHeading
            eyebrow="One app, two engines"
            title={<>Bring your own Claude.</>}
            blurb="Run on your local Claude CLI — free if you already pay for Pro or Max — or the Anthropic API with your own key. Switch at runtime; everything user-visible flows through one stream."
          />
          <div className="grid w-full gap-5 md:grid-cols-2">
            <Reveal>
              <div className="card h-full p-7">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">
                    <Terminal size={20} />
                  </div>
                  <div>
                    <div className="chip">Default</div>
                    <h3 className="mt-1.5 font-display text-xl font-semibold text-ink-50">
                      Local Claude CLI
                    </h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-ink-300">
                  Spawns <code className="font-mono text-glowcyan">claude -p</code> in your workspace,
                  so Claude sees your code, your <code className="font-mono">CLAUDE.md</code>, and your
                  installed agents and skills. No extra cost.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="card h-full p-7">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-glowcyan/12 text-glowcyan">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <div className="chip">Optional</div>
                    <h3 className="mt-1.5 font-display text-xl font-semibold text-ink-50">
                      Anthropic API
                    </h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-ink-300">
                  Falls back to the SDK with your <code className="font-mono">sk-ant-…</code> key —
                  encrypted in the OS keychain via Electron safeStorage, never stored in plaintext.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* FEATURE GRID */}
      <Section className="mt-32">
        <div className="flex flex-col items-center gap-12">
          <SectionHeading
            eyebrow="Everything in the loop"
            title={<>A workbench, not a chat box.</>}
            blurb="Specs on disk, your agents and skills, parallel orchestration, hooks, steering, source control — composed into one focused desktop tool."
          />
          <div className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.07}>
                <FeatureCard feature={f} />
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* ORCHESTRATION HIGHLIGHT */}
      <Section className="mt-32">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="flex flex-col items-start gap-5">
              <Eyebrow>Parallel by design</Eyebrow>
              <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink-50">
                A wave of agents, working at once.
              </h2>
              <p className="text-lg leading-relaxed text-ink-300">
                Tasks in a wave run as parallel Claude subprocesses, capped by your concurrency
                setting. The orchestrator is the live registry of every in-flight run — chat, spec
                drafting, audits, and task waves alike. Autopilot runs every wave to done.
              </p>
              <ul className="grid gap-2 text-sm text-ink-300">
                {[
                  ['Failure-isolated wave scheduling', Network],
                  ['Per-task @agent specialization', Cpu],
                  ['Live elapsed time + stop-all', Terminal],
                ].map(([label, Icon]) => {
                  const I = Icon as typeof Network;
                  return (
                    <li key={label as string} className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/12 text-accent">
                        <I size={14} />
                      </span>
                      {label as string}
                    </li>
                  );
                })}
              </ul>
              <Button to="/features" variant="ghost" className="mt-2">
                All features <ArrowRight size={16} />
              </Button>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <AppShot src="/screens/tasks.png" alt="Task waves — parallel execution" />
          </Reveal>
        </div>
      </Section>

      {/* CTA */}
      <Section className="mt-32">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-accent/15 via-ink-950 to-ink-950 px-8 py-16 text-center shadow-deep">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-glowcyan/15 blur-3xl" />
            <div className="relative mx-auto grid h-14 w-14 place-items-center text-accent">
              <div className="absolute inset-0 rounded-full bg-accent/25 blur-lg" />
              <KrakenLogo className="relative h-12 w-12" />
            </div>
            <h2 className="relative mt-5 font-display text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
              Release the Kraken.
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg text-ink-300">
              Free with your Claude subscription. Your agents, your skills, your specs — on disk.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Button to="/download">
                Get started <ArrowRight size={16} />
              </Button>
              <Button href={GITHUB_URL} variant="glass">
                <Github size={16} /> View source
              </Button>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
