import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Github, Menu, X } from 'lucide-react';
import { Wordmark } from './Octo';
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
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors ${
        scrolled ? 'border-line bg-rail/95 backdrop-blur' : 'border-transparent'
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
              className={({ isActive }: { isActive: boolean }) =>
                `border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-accent text-ink-100'
                    : 'border-transparent text-ink-400 hover:text-ink-100'
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
            className="grid h-9 w-9 place-items-center border border-line text-ink-400 transition-colors hover:border-ink-600 hover:text-ink-100"
            aria-label="GitHub"
          >
            <Github size={16} />
          </a>
          <Link
            to="/download"
            className="bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hi"
          >
            Get started
          </Link>
        </div>

        <button
          className="grid h-9 w-9 place-items-center border border-line text-ink-200 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-line bg-rail px-5 py-3 md:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }: { isActive: boolean }) =>
                `block px-3 py-2.5 text-sm font-medium ${isActive ? 'text-accent-text' : 'text-ink-300'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/download"
            onClick={() => setOpen(false)}
            className="mt-2 block bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-fg"
          >
            Get started
          </Link>
        </div>
      )}
    </header>
  );
}
