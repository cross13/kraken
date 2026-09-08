import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'ghost';

const base =
  'group inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const variants: Record<Variant, string> = {
  // Green is fill-only, and #0F1400 is the only ink allowed on it.
  primary: 'bg-accent text-accent-fg hover:bg-accent-hi',
  ghost: 'border border-line text-ink-100 hover:border-ink-600 hover:bg-card',
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
