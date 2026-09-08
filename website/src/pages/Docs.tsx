import { Section, Reveal, Eyebrow, Panel } from '../components/ui';
import { Button } from '../components/Button';
import { GITHUB_URL } from '../components/site';
import { ArrowUpRight } from 'lucide-react';

const DOCS = [
  { file: 'README.md', what: 'What it is, what it needs, and how to run it.', href: `${GITHUB_URL}#readme` },
  { file: 'docs/architecture.md', what: 'The three Electron layers and how data crosses between them.', href: `${GITHUB_URL}/blob/main/docs/architecture.md` },
  { file: 'docs/ipc-contract.md', what: 'Every IPC handler, by namespace — the contract the renderer types against.', href: `${GITHUB_URL}/blob/main/docs/ipc-contract.md` },
  { file: 'docs/data-model.md', what: 'The persisted shapes: specs on disk, settings, and the history database.', href: `${GITHUB_URL}/blob/main/docs/data-model.md` },
  { file: 'docs/backends.md', what: 'How Claude is invoked, and how models are discovered.', href: `${GITHUB_URL}/blob/main/docs/backends.md` },
  { file: 'docs/renderer.md', what: 'Stores, components, routing, layout, theming and skills.', href: `${GITHUB_URL}/blob/main/docs/renderer.md` },
  { file: 'docs/subsystems.md', what: 'Hooks, steering, orchestration, git, tickets, agents and skills.', href: `${GITHUB_URL}/blob/main/docs/subsystems.md` },
  { file: 'docs/adding-a-feature.md', what: 'The path a change takes through the codebase, and which doc it updates.', href: `${GITHUB_URL}/blob/main/docs/adding-a-feature.md` },
  { file: 'docs/security-review.md', what: 'The last full audit: what was found, what was fixed, what is still open.', href: `${GITHUB_URL}/blob/main/docs/security-review.md` },
];

const FIRST_RUN = [
  {
    title: 'Open a workspace',
    body: 'Point the app at a repo you already know. It reads your .claude/agents and .claude/skills — workspace and global — plus your root CLAUDE.md or AGENTS.md as always-on steering.',
  },
  {
    title: 'Seed the defaults (optional)',
    body: 'One click installs a starter library: 12 agents, 6 skills, 3 steering scaffolds and 3 hooks. Seeding is an upgrade, not just an install — a default you never edited gets rewritten, and anything you did edit is left alone.',
  },
  {
    title: 'Write one requirement',
    body: 'Type what you want into the composer on Home. Plan creates the spec and opens it without starting a run; Quick Plan drafts both documents with no stops. Ending the line with ? sends it to the assistant instead.',
  },
  {
    title: 'Walk the loop',
    body: 'Approve requirements → answer the clarifying questions → approve the plan → run the task waves. The Ship panel opens on its own when the last task lands.',
  },
];

export function Docs() {
  return (
    <>
      <Section className="pt-20 pb-12 sm:pt-24">
        <Reveal>
          <div className="flex max-w-3xl flex-col gap-5">
            <Eyebrow>Documentation</Eyebrow>
            <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-tight text-ink-50 sm:text-5xl">
              Getting started, then the reference.
            </h1>
            <p className="text-[17px] leading-relaxed text-ink-300">
              The developer documentation lives next to the code and is kept in step with it — an
              out-of-date doc is treated as a bug. This page is the short version and the index.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button to="/download">Install first</Button>
              <Button href={GITHUB_URL} variant="ghost">
                Browse the repo
              </Button>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section className="py-10">
        <Reveal>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-50">First run</h2>
        </Reveal>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {FIRST_RUN.map((s, i) => (
            <Reveal key={s.title} delay={0.05 * i} className="h-full">
              <div className="card flex h-full gap-4 p-5">
                <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink-100">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-400">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="py-10">
        <Reveal>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-50">Reference</h2>
        </Reveal>
        <Reveal delay={0.05} className="mt-8">
          <Panel label="in the repo">
            <div className="divide-y divide-line">
              {DOCS.map((d) => (
                <a
                  key={d.file}
                  href={d.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-card sm:flex-row sm:items-center sm:gap-6"
                >
                  <span className="w-64 shrink-0 font-mono text-[13px] text-ink-100">{d.file}</span>
                  <span className="text-sm text-ink-500">{d.what}</span>
                  <ArrowUpRight
                    size={15}
                    className="ml-auto hidden shrink-0 text-ink-600 transition-colors group-hover:text-accent-text sm:block"
                  />
                </a>
              ))}
            </div>
          </Panel>
        </Reveal>
      </Section>

      <Section className="py-10">
        <Reveal>
          <Panel label="commands">
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.9] text-ink-300">
              <code>
                npm run dev          <span className="text-ink-600"># electron-vite dev + Electron with HMR</span>{'\n'}
                npm run build        <span className="text-ink-600"># production build into out/</span>{'\n'}
                npm run typecheck    <span className="text-ink-600"># both TS projects — the automated gate</span>{'\n'}
                npm run routes       <span className="text-ink-600"># agent routing table; --check fails on a wrong pick</span>{'\n'}
                npm run hashes       <span className="text-ink-600"># default-library hashes; --check in CI</span>{'\n'}
                npm run package:mac  <span className="text-ink-600"># build + electron-builder</span>
              </code>
            </pre>
          </Panel>
        </Reveal>
        <Reveal delay={0.05} className="mt-4">
          <p className="max-w-3xl text-sm leading-relaxed text-ink-500">
            There is no test runner and no linter configured; <code className="font-mono text-[13px] text-ink-200">typecheck</code>{' '}
            is the only automated gate on the code. Two invariants it cannot see have their own
            scripts, and both should pass before a change is done.
          </p>
        </Reveal>
      </Section>
    </>
  );
}
