import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'glass';

const base =
  'group inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-glow hover:shadow-[0_0_0_1px_rgba(124,92,255,0.6),0_0_70px_-8px_rgba(124,92,255,0.8)] hover:-translate-y-0.5',
  ghost:
    'text-ink-100 ring-1 ring-inset ring-white/12 hover:ring-white/25 hover:bg-white/[0.04]',
  glass:
    'glass text-ink-100 hover:border-white/20 hover:bg-ink-900/70',
};

interface Props {
  children: ReactNode;
  variant?: Variant;
  to?: string;
  href?: string;
  className?: string;
}

export function Button({ children, variant = 'primary', to, href, className = '' }: Props) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  );
}
