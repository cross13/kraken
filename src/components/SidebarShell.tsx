import { cn } from '../lib/cn';

export function SidebarHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 h-9 border-b border-ink-800/80 shrink-0">
      <h2 className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">
        {title}
      </h2>
      <div className="flex items-center gap-1">{actions}</div>
    </div>
  );
}

export function SidebarButton({
  onClick,
  title,
  children,
  className,
}: {
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1 rounded-md text-ink-400 hover:text-ink-100 hover:bg-ink-800/60 transition',
        className
      )}
    >
      {children}
    </button>
  );
}

export function SidebarEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-4 text-center">
      <p className="text-sm text-ink-200 font-medium mb-1">{title}</p>
      <p className="text-xs text-ink-400 mb-3">{description}</p>
      {action}
    </div>
  );
}
