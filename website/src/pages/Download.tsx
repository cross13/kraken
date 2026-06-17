import { Apple, MonitorDown, Terminal, KeyRound, Cpu, Check, Github } from 'lucide-react';
import { Section, Reveal, SectionHeading, Eyebrow } from '../components/ui';
import { Button } from '../components/Button';
import { GITHUB_URL } from '../components/site';

const STEPS = [
  {
    n: '01',
    title: 'Clone & install',
    code: `git clone ${GITHUB_URL.replace('https://github.com/', 'git@github.com:')}.git\ncd kraken && npm install`,
  },
  { n: '02', title: 'Run in development', code: 'npm run dev   # Electron + Vite HMR' },
  {
    n: '03',
    title: 'Package a desktop build',
    code: 'npm run package:mac   # or :win / :linux',
  },
];

const PREREQS = [
  {
    icon: Terminal,
    title: 'Local Claude CLI',
    desc: 'The default backend. If you already use Claude Code, you’re set — Kraken spawns it for you.',
  },
  {
    icon: KeyRound,
    title: 'or an Anthropic API key',
    desc: 'Prefer the API? Add an sk-ant-… key in Settings; it’s encrypted in your OS keychain.',
  },
  {
    icon: Cpu,
    title: 'Node 18+ & npm',
    desc: 'Standard toolchain. The app builds with electron-vite; the only gate is npm run typecheck.',
  },
];

export function Download() {
  return (
    <>
      <Section className="pt-16 text-center sm:pt-24">
        <div className="flex flex-col items-center">
          <SectionHeading
            eyebrow="Get started"
            title={<>Run Kraken in a minute.</>}
            blurb="Kraken is open source and runs from the repo. Build a packaged desktop app for your platform whenever you’re ready."
          />
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button href={GITHUB_URL}>
              <Github size={16} /> Clone the repo
            </Button>
            <Button href={`${GITHUB_URL}/tree/main/docs`} variant="glass">
              Read the docs
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-4 text-ink-500">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Apple size={15} /> macOS
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm">
              <MonitorDown size={15} /> Windows
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm">
              <MonitorDown size={15} /> Linux
            </span>
          </div>
        </div>
      </Section>

      {/* Steps */}
      <Section className="mt-16">
        <div className="grid gap-5 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.07}>
              <div className="card flex h-full flex-col p-6">
                <div className="font-mono text-sm text-accent">{s.n}</div>
                <h3 className="mt-2 font-display text-lg font-semibold text-ink-50">{s.title}</h3>
                <pre className="mt-4 overflow-x-auto rounded-lg border border-white/[0.06] bg-ink-950/80 p-3.5 font-mono text-[12.5px] leading-relaxed text-ink-200">
                  {s.code}
                </pre>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Prereqs */}
      <Section className="mt-24">
        <div className="flex flex-col items-center">
          <Eyebrow>What you need</Eyebrow>
          <h2 className="mt-4 text-center font-display text-3xl font-semibold tracking-tight text-ink-50">
            Bring your own Claude.
          </h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PREREQS.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.title} delay={i * 0.07}>
                <div className="card flex h-full flex-col p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-glowcyan/12 text-glowcyan">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-ink-50">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-300">{p.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* Reassurance */}
      <Section className="mt-20">
        <Reveal>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-white/[0.06] bg-ink-950/40 px-6 py-6 text-sm text-ink-300">
            {['MIT licensed', 'No telemetry to us', 'Your specs stay on disk', 'API key in OS keychain'].map(
              (t) => (
                <span key={t} className="inline-flex items-center gap-2">
                  <Check size={15} className="text-ok" /> {t}
                </span>
              )
            )}
          </div>
        </Reveal>
      </Section>
    </>
  );
}
