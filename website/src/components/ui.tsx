import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { STILL } from './site';

export function Section({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`mx-auto max-w-7xl px-5 sm:px-8 ${className}`}>
      {children}
    </section>
  );
}

/** Square status dot — even the dots are squares in this system. */
export function Dot({ tone = 'accent' }: { tone?: 'accent' | 'agent' }) {
  return <span className={`h-1.5 w-1.5 ${tone === 'accent' ? 'bg-accent' : 'bg-agent'}`} />;
}

export function Eyebrow({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'agent' }) {
  return (
    <span className="chip">
      <Dot tone={tone} />
      {children}
    </span>
  );
}

export function Reveal({
  children,
  delay = 0,
  y = 14,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  if (STILL) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  blurb,
  align = 'left',
  tone = 'accent',
}: {
  eyebrow: string;
  title: ReactNode;
  blurb?: ReactNode;
  align?: 'center' | 'left';
  tone?: 'accent' | 'agent';
}) {
  const a = align === 'center' ? 'mx-auto text-center items-center' : 'text-left items-start';
  return (
    <div className={`flex max-w-2xl flex-col gap-4 ${a}`}>
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      <h2 className="font-display text-3xl font-bold leading-[1.06] tracking-tight text-ink-50 sm:text-4xl">
        {title}
      </h2>
      {blurb && <p className="text-[17px] leading-relaxed text-ink-300">{blurb}</p>}
    </div>
  );
}

/** A labelled hairline panel — the site's one container shape. */
export function Panel({
  label,
  children,
  className = '',
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel ${className}`}>
      {label && (
        <div className="border-b border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-600">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}
