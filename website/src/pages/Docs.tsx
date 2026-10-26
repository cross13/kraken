import { Section, Reveal, Eyebrow, Panel } from '../components/ui';
import { Button } from '../components/Button';
import { GITHUB_URL } from '../components/site';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

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
              <Button to="/guides">Read the guides</Button>
              <Button to="/download" variant="ghost">
                Install
              </Button>
              <Button href={GITHUB_URL} variant="ghost">
                Browse the repo
              </Button>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section className="py-10">
        <Reveal>
          {/* How to *use* it lives in the guides, shared with the app; this page
              is the developer reference. */}
          <Link to="/guides" className="card group flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:gap-6">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-ink-50">
                New to it? Start with the guides.
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-400">
                Five short guides from install to a merged pull request, then a how-to for every
                screen — in English and Spanish, the same ones the app opens from its ? button.
              </p>
            </div>
            <ArrowRight
              size={18}
              className="shrink-0 text-ink-600 transition-colors group-hover:text-accent-text sm:ml-auto"
            />
          </Link>
        </Reveal>
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
