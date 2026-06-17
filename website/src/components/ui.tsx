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

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="chip">
      <span className="h-1.5 w-1.5 rounded-full bg-glowcyan shadow-[0_0_8px_rgba(57,224,230,0.9)]" />
      {children}
    </span>
  );
}

export function Reveal({
  children,
  delay = 0,
  y = 18,
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
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  blurb,
  align = 'center',
}: {
  eyebrow: string;
  title: ReactNode;
  blurb?: ReactNode;
  align?: 'center' | 'left';
}) {
  const a = align === 'center' ? 'mx-auto text-center items-center' : 'text-left items-start';
  return (
    <div className={`flex max-w-2xl flex-col gap-4 ${a}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink-50 sm:text-5xl">
        {title}
      </h2>
      {blurb && <p className="text-lg leading-relaxed text-ink-300">{blurb}</p>}
    </div>
  );
}
