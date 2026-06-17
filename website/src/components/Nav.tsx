import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Github, Menu, X } from 'lucide-react';
import { Wordmark } from './KrakenLogo';
import { NAV, GITHUB_URL } from './site';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-white/[0.06] bg-ink-975/70 backdrop-blur-xl' : ''
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="shrink-0" onClick={() => setOpen(false)}>
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'text-ink-50' : 'text-ink-300 hover:text-ink-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-300 ring-1 ring-inset ring-white/10 transition hover:text-ink-50 hover:ring-white/25"
            aria-label="GitHub"
          >
            <Github size={16} />
          </a>
          <Link
            to="/download"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
          >
            Get started
          </Link>
        </div>

        <button
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-200 ring-1 ring-inset ring-white/10 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/[0.06] bg-ink-975/95 px-5 py-3 backdrop-blur-xl md:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive ? 'text-ink-50' : 'text-ink-300'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/download"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white"
          >
            Get started
          </Link>
        </div>
      )}
    </header>
  );
}
