import { ArrowRight, Terminal, Cpu, Folder, FileCode2, Github } from 'lucide-react';
import { Button } from '../components/Button';
import { Section, SectionHeading, Reveal, Eyebrow, Panel, Dot } from '../components/ui';
import { FeatureCard } from '../components/FeatureCard';
import { Wordmark } from '../components/Octo';
import { SddFlow } from '../components/flow/SddFlow';
import { HIGHLIGHTS } from '../content/features';
import { GITHUB_URL } from '../components/site';

/** The on-disk shape of a spec — the whole data model, in nine lines. */
const TREE = [
  { depth: 0, icon: Folder, name: '.octo/specs/passwordless-auth/', note: 'one directory per spec' },
  { depth: 1, icon: FileCode2, name: 'spec.json', note: 'phase + metadata' },
  { depth: 1, icon: FileCode2, name: 'requirements.md', note: 'stories + EARS criteria' },
  { depth: 1, icon: FileCode2, name: 'plan.md', note: 'contracts, waves, decisions' },
  { depth: 1, icon: FileCode2, name: 'tasks.md', note: 'derived from ## Tasks' },
  { depth: 1, icon: FileCode2, name: 'summary.md', note: 'written when the last task lands' },
];

const RUNS = [
  { label: 'T3 · migrate session store', state: 'running' as const },
  { label: 'T4 · rewrite the callback route', state: 'running' as const },
  { label: 'T5 · e2e for the magic link', state: 'queued' as const },
  { label: 'T2 · token table + index', state: 'done' as const },
];

export function Home() {
  return (
    <>
      {/* ── hero ─────────────────────────────────────────────────── */}
      <Section className="pt-20 pb-20 sm:pt-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-8">
          <Reveal>
            <Wordmark size="hero" />
          </Reveal>

          <Reveal delay={0.05} className="max-w-3xl">
            <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-ink-50 sm:text-[2.6rem]">
              Spec-driven development that <span className="green">ends in a pull request</span>.
            </h1>
          </Reveal>

          <Reveal delay={0.1} className="max-w-2xl">
            <p className="text-[17px] leading-relaxed text-ink-300">
              A desktop workbench that runs the loop end-to-end: write the requirements, settle the
              open decisions, let Claude draft the plan, then run the tasks in parallel waves until
              the branch is ready to merge. It drives the Claude CLI you already have — with your
              agents, your skills and your <code className="font-mono text-[15px] text-ink-100">CLAUDE.md</code>.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="flex flex-wrap items-center gap-3">
              <Button to="/download">
                Get started <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button to="/workflow" variant="ghost">
                See the loop
              </Button>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-2 py-3 text-sm font-medium text-ink-400 transition-colors hover:text-ink-100"
              >
                <Github size={15} /> Source
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="font-mono text-xs text-ink-600">
              macOS · Windows · Linux — needs the Claude CLI or an Anthropic API key. Pre-1.0.
            </p>
          </Reveal>
        </div>

          <Reveal delay={0.12} className="hidden lg:block">
            <Panel label="workspace">
              <div className="divide-y divide-line">
                {TREE.map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{ paddingLeft: 16 + row.depth * 20 }}
                  >
                    <row.icon size={14} className={row.depth === 0 ? 'text-accent-text' : 'text-ink-600'} />
                    <span className="font-mono text-[13px] text-ink-200">{row.name}</span>
                    <span className="ml-auto hidden text-xs text-ink-600 xl:block">{row.note}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-500">
                A spec is a folder, not a database row. Everything the loop produces is markdown next
                to your code — diffable, reviewable, readable without the app open.
              </div>
            </Panel>
          </Reveal>
        </div>
      </Section>

      {/* ── the loop ─────────────────────────────────────────────── */}
      <Section className="py-16">
        <Reveal>
          <SectionHeading
            eyebrow="The loop"
            title={<>Two documents, two gates, one build stage.</>}
            blurb="The phase order is fixed, and that is the point: each stage produces a document the next one reads, and you are only required in two places."
          />
        </Reveal>
        <Reveal delay={0.1} className="mt-10">
          <Panel label="requirements → plan → build → done">
            <SddFlow />
          </Panel>
        </Reveal>
        <Reveal delay={0.15} className="mt-4">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2 text-sm text-ink-500">
            <span className="inline-flex items-center gap-2">
              <Dot /> Green: something is running.
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot tone="agent" /> Violet: it waits for you.
            </span>
            <span className="text-ink-600">
              The palette gives each accent exactly one meaning, here and in the app.
            </span>
          </div>
        </Reveal>
      </Section>

      {/* ── backends ─────────────────────────────────────────────── */}
      <Section className="py-16">
        <Reveal>
          <SectionHeading
            eyebrow="The engine"
            title={<>Bring your own Claude.</>}
            blurb="Two backends, switchable at runtime, behaviourally interchangeable. Everything you see flows through the same event stream either way."
          />
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Reveal delay={0.05} className="h-full min-w-0">
            <div className="card h-full p-6">
              <div className="flex items-center gap-2.5 text-accent-text">
                <Terminal size={18} strokeWidth={1.75} />
                <h3 className="font-display text-base font-semibold text-ink-100">
                  Local Claude CLI
                </h3>
                <span className="chip ml-auto">default</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-400">
                Spawns the CLI in your workspace so Claude reads your code and your project
                instructions. Free if you already pay for Claude Pro or Max.
              </p>
              <pre className="mt-4 overflow-x-auto border border-line bg-rail p-4 font-mono text-[12.5px] leading-relaxed text-ink-300">
                <code>
                  <span className="text-ink-600">$</span> npm install -g @anthropic-ai/claude-code{'\n'}
                  <span className="text-ink-600">$</span> claude{'  '}
                  <span className="text-ink-600"># log in once</span>
                </code>
              </pre>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="h-full min-w-0">
            <div className="card h-full p-6">
              <div className="flex items-center gap-2.5 text-accent-text">
                <Cpu size={18} strokeWidth={1.75} />
                <h3 className="font-display text-base font-semibold text-ink-100">Anthropic API</h3>
                <span className="chip ml-auto">per token</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-400">
                Paste a key into Settings › Connection. It is encrypted with Electron{' '}
                <code className="font-mono text-[13px] text-ink-200">safeStorage</code> into your OS
                keychain and only ever sent to{' '}
                <code className="font-mono text-[13px] text-ink-200">api.anthropic.com</code>.
              </p>
              <p className="mt-4 border border-line bg-rail p-4 text-[13px] leading-relaxed text-ink-500">
                A key also unlocks verified model discovery: the list is merged from the Models API
                and your local CLI config, and each entry shows which.
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ── highlights ───────────────────────────────────────────── */}
      <Section className="py-16">
        <Reveal>
          <SectionHeading
            eyebrow="Why this one"
            title={<>Six things that are actually different.</>}
          />
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((f, i) => (
            <Reveal key={f.title} delay={0.04 * i} className="h-full">
              <FeatureCard {...f} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── orchestration ────────────────────────────────────────── */}
      <Section className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <Reveal>
            <Panel label="activity · runs">
              <div className="divide-y divide-line">
                {RUNS.map((r) => (
                  <div key={r.label} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 ${
                        r.state === 'running'
                          ? 'animate-blink bg-accent'
                          : r.state === 'queued'
                            ? 'bg-agent'
                            : 'bg-ink-600'
                      }`}
                    />
                    <span className="font-mono text-[13px] text-ink-200">{r.label}</span>
                    <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em] text-ink-600">
                      {r.state}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-line px-4 py-3">
                <div className="flex items-center justify-between font-mono text-[11px] text-ink-600">
                  <span>2 / 2 task slots</span>
                  <span>wave 2 of 3</span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden bg-card">
                  <div className="h-full w-1/2 bg-accent transition-all duration-bar" />
                </div>
              </div>
            </Panel>
          </Reveal>
          <Reveal delay={0.1}>
            <SectionHeading
              eyebrow="At scale"
              title={<>A wave at a time, not a task at a time.</>}
              blurb="Tasks in a wave run as concurrent Claude subprocesses under one cap you control, with failure isolation. Autopilot runs every wave to the end, waiting for blocking hooks in between — and a task that deviates from the plan writes the decision back into it, so the plan never drifts from the code."
            />
            <div className="mt-6">
              <Button to="/features" variant="ghost">
                All capabilities <ArrowRight size={15} />
              </Button>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ── cta ──────────────────────────────────────────────────── */}
      <Section className="py-16">
        <Reveal>
          <div className="border border-line bg-panel p-10 sm:p-14">
            <div className="flex max-w-2xl flex-col gap-5">
              <Eyebrow>Pre-1.0</Eyebrow>
              <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink-50 sm:text-4xl">
                Point it at a repo and write one requirement.
              </h2>
              <p className="text-[17px] leading-relaxed text-ink-300">
                No account, no service, no upload. It runs on your machine against the Claude you
                already pay for.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Button to="/download">
                  Install <ArrowRight size={16} />
                </Button>
                <Button to="/docs" variant="ghost">
                  Read the docs
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
