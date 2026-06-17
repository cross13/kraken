import { ArrowUpRight, BookOpen, Github } from 'lucide-react';
import { Section, Reveal, SectionHeading, Eyebrow } from '../components/ui';
import { Button } from '../components/Button';
import { DOC_LINKS } from '../content/features';
import { GITHUB_URL } from '../components/site';

const DOCS_BASE = `${GITHUB_URL}/tree/main/docs`;

// Verified against the codebase — kept honest, not rounded up.
const STATS: { value: string; label: string }[] = [
  { value: '3', label: 'Electron layers' },
  { value: '14', label: 'IPC namespaces' },
  { value: '2', label: 'interchangeable backends' },
  { value: '4', label: 'Zustand stores' },
  { value: '6', label: 'SQLite tables' },
  { value: '4', label: 'stream channels' },
];

export function Docs() {
  return (
    <>
      <Section className="pt-16 text-center sm:pt-24">
        <div className="flex flex-col items-center">
          <SectionHeading
            eyebrow="Documentation"
            title={<>Read the source of truth.</>}
            blurb="Kraken ships a developer-docs set that stays in lock-step with the code. Start here, then dive into the area you're touching."
          />
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button href={DOCS_BASE}>
              <BookOpen size={16} /> Browse docs
            </Button>
            <Button href={GITHUB_URL} variant="glass">
              <Github size={16} /> Repository
            </Button>
          </div>
        </div>
      </Section>

      <Section className="mt-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DOC_LINKS.map((d, i) => {
            const Icon = d.icon;
            return (
              <Reveal key={d.file} delay={(i % 3) * 0.06}>
                <a
                  href={`${DOCS_BASE}/${d.file}`}
                  target="_blank"
                  rel="noreferrer"
                  className="card group flex h-full flex-col p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">
                      <Icon size={20} />
                    </div>
                    <ArrowUpRight
                      size={18}
                      className="text-ink-600 transition group-hover:text-ink-200"
                    />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold text-ink-50">{d.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-300">{d.blurb}</p>
                  <div className="mt-4 font-mono text-[11px] text-ink-600">docs/{d.file}</div>
                </a>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* Under the hood — verified facts */}
      <Section className="mt-28">
        <div className="flex flex-col items-center">
          <Eyebrow>Under the hood</Eyebrow>
          <h2 className="mt-4 text-center font-display text-3xl font-semibold tracking-tight text-ink-50">
            Small surface, sharp contract.
          </h2>
          <p className="mt-3 max-w-xl text-center text-ink-300">
            Three Electron layers; data crosses between them only through one typed IPC bridge.
            Specs live on disk as the source of truth — SQLite is just a queryable mirror.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={(i % 6) * 0.05}>
              <div className="card flex h-full flex-col items-center justify-center p-5 text-center">
                <div className="font-display text-4xl font-semibold text-gradient">{s.value}</div>
                <div className="mt-1.5 text-xs leading-snug text-ink-400">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Getting started snippet */}
      <Section className="mt-24">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-950/70 shadow-deep">
            <div className="flex items-center gap-2 border-b border-white/[0.06] bg-ink-900/60 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-bad/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-ok/70" />
              <span className="ml-3 font-mono text-[11px] text-ink-500">quickstart</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-ink-200">
              <span className="text-ink-500"># clone &amp; install</span>
              {'\n'}git clone {GITHUB_URL.replace('https://github.com/', 'git@github.com:')}.git
              {'\n'}cd kraken &amp;&amp; npm install
              {'\n\n'}
              <span className="text-ink-500"># run in dev (Electron + HMR)</span>
              {'\n'}npm run dev
              {'\n\n'}
              <span className="text-ink-500"># typecheck — the only automated gate</span>
              {'\n'}npm run typecheck
            </pre>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
