import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import { Wordmark } from './KrakenLogo';
import { NAV, GITHUB_URL } from './site';

export function Footer() {
  return (
    <footer className="relative mt-32 border-t border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row">
          <div className="max-w-sm">
            <Wordmark />
            <p className="mt-4 text-sm leading-relaxed text-ink-400">
              A desktop workbench for Spec-Driven Development, powered by Claude. Keep the spec a
              first-class artifact — and let Claude draft, refine, and execute it.
            </p>
          </div>

          <div className="flex gap-14">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                Product
              </div>
              <ul className="mt-4 space-y-2.5">
                {NAV.map((n) => (
                  <li key={n.to}>
                    <Link to={n.to} className="text-sm text-ink-300 transition hover:text-ink-50">
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                Project
              </div>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-ink-300 transition hover:text-ink-50"
                  >
                    <Github size={14} /> GitHub
                  </a>
                </li>
                <li>
                  <a
                    href={`${GITHUB_URL}/tree/main/docs`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-ink-300 transition hover:text-ink-50"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <Link to="/download" className="text-sm text-ink-300 transition hover:text-ink-50">
                    Get started
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-ink-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Kraken · MIT licensed</span>
          <span className="font-mono">requirements → design → tasks → execution</span>
        </div>
      </div>
    </footer>
  );
}
