import type { LucideIcon } from 'lucide-react';

export function FeatureCard({
  icon: Icon,
  title,
  body,
  tone = 'accent',
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  tone?: 'accent' | 'agent';
}) {
  const ink = tone === 'accent' ? 'text-accent-text' : 'text-agent-text';
  return (
    <div className="card flex h-full flex-col gap-3 p-5">
      <div className={`flex items-center gap-2.5 ${ink}`}>
        <Icon size={17} strokeWidth={1.75} />
        <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink-100">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-ink-400">{body}</p>
    </div>
  );
}
