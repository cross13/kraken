import { useState } from 'react';
import { ChevronDown, Info, Lightbulb } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Shared building blocks for the full-page "studio" modules (Agents, Skills,
 * Orchestration). Every studio uses the same header / section / explainer chrome
 * so the modules feel like one system.
 */

export function ModuleHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-7 h-[58px] shrink-0 border-b border-ink-800/40">
      <div className="w-9 h-9 grid place-items-center rounded-xl bg-accent/12 text-accent shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[16px] font-bold text-ink-50 leading-tight truncate">
          {title}
        </div>
        {subtitle && <div className="text-[12px] text-faint truncate">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** Tabbed sub-navigation inside a studio (e.g. Library · Routing · Config). */
export function ModuleTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-6 h-11 shrink-0 border-b border-ink-800/30 bg-ink-950/40">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12.5px] font-medium transition',
            value === t.key
              ? 'bg-accent/12 text-accent'
              : 'text-dim hover:text-ink-50 hover:bg-elev'
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function ModuleSection({
  title,
  desc,
  actions,
  children,
}: {
  title: string;
  desc?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h3 className="font-mono text-[10px] tracking-[0.16em] text-faint uppercase">{title}</h3>
          {desc && <p className="text-[12px] text-dim mt-1 max-w-2xl leading-relaxed">{desc}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Collapsible "how this works" panel — the teaching surface of each module. */
export function Explainer({
  title = 'How this works',
  points,
  defaultOpen = false,
}: {
  title?: string;
  points: { heading: string; body: React.ReactNode }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl bg-elev/50 ring-1 ring-ink-800/40 mb-6 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-elev/40 transition"
      >
        <Lightbulb size={15} className="text-accent shrink-0" />
        <span className="text-[13px] font-semibold text-ink-100 flex-1">{title}</span>
        <ChevronDown
          size={15}
          className={cn('text-faint transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 grid gap-3 sm:grid-cols-2">
          {points.map((p, i) => (
            <div key={i} className="rounded-lg bg-ink-950/40 p-3">
              <div className="text-[12px] font-semibold text-accent mb-1">{p.heading}</div>
              <div className="text-[12px] text-dim leading-relaxed">{p.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Callout({
  children,
  tone = 'info',
}: {
  children: React.ReactNode;
  tone?: 'info' | 'warn';
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-[12px] leading-relaxed',
        tone === 'info' ? 'bg-accent/[0.07] text-dim' : 'bg-amber-500/[0.08] text-amber-200/90'
      )}
    >
      <Info size={14} className={cn('mt-0.5 shrink-0', tone === 'info' ? 'text-accent' : 'text-amber-400')} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Scope chip — workspace (project-local) vs global (~/.claude). */
export function ScopeChip({ scope }: { scope: 'workspace' | 'global' }) {
  return (
    <span
      className={cn(
        'text-[9.5px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wide',
        scope === 'workspace'
          ? 'bg-accent/12 text-accent'
          : 'bg-ink-700/60 text-ink-300'
      )}
    >
      {scope === 'workspace' ? 'project' : 'global'}
    </span>
  );
}
