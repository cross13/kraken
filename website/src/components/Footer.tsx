import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import { OctoMark } from './Octo';
import { NAV, GITHUB_URL } from './site';

const LINKS = [
  { label: 'Architecture', href: `${GITHUB_URL}/blob/main/docs/architecture.md` },
  { label: 'IPC contract', href: `${GITHUB_URL}/blob/main/docs/ipc-contract.md` },
  { label: 'Subsystems', href: `${GITHUB_URL}/blob/main/docs/subsystems.md` },
  { label: 'Security policy', href: `${GITHUB_URL}/blob/main/.github/SECURITY.md` },
];

export function Footer() {
  return (
    <footer className="mt-28 border-t border-line bg-rail">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <OctoMark className="h-6 w-6" />
            <span className="font-display text-lg font-bold tracking-tight text-ink-100">
              ct<span className="text-accent-text">0</span>
            </span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-ink-500">
            A Spec-Driven Development workbench for Claude. Specs are markdown on disk; the app is
            the loop around them.
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 border border-line px-3 py-2 text-xs font-medium text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
          >
            <Github size={14} /> Source
          </a>
        </div>

        <nav className="flex flex-col gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-600">Site</div>
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="text-sm text-ink-400 transition-colors hover:text-ink-100">
              {n.label}
            </Link>
          ))}
        </nav>

        <nav className="flex flex-col gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-600">Repo</div>
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-ink-400 transition-colors hover:text-ink-100"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 font-mono text-[11px] text-ink-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>0ct0 — MIT licensed. Pre-1.0; expect sharp edges.</span>
          <span>Not affiliated with Anthropic. Claude is a trademark of Anthropic PBC.</span>
        </div>
      </div>
    </footer>
  );
}
