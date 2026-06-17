import { Check } from 'lucide-react';
import type { Feature } from '../content/features';

export function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  const cyan = feature.accent === 'cyan';
  return (
    <div className="card flex h-full flex-col p-6">
      <div
        className={`grid h-12 w-12 place-items-center rounded-xl ${
          cyan ? 'bg-glowcyan/12 text-glowcyan' : 'bg-accent/15 text-accent'
        }`}
      >
        <Icon size={22} />
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-ink-50">{feature.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-300">{feature.blurb}</p>
      <ul className="mt-5 space-y-2 border-t border-white/[0.06] pt-4">
        {feature.points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-[13px] text-ink-300">
            <Check
              size={14}
              className={`mt-0.5 shrink-0 ${cyan ? 'text-glowcyan' : 'text-accent'}`}
            />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
