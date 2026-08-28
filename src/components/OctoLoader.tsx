import { OctoLogo } from './OctoLogo';
import { cn } from '../lib/cn';

// "Reading code" shimmer lines from the brand kit: [width %, indent px, color].
const CODE_LINES: [number, number, string][] = [
  [62, 0, 'rgba(0,187,221,0.55)'],
  [40, 16, 'rgba(148,163,184,0.35)'],
  [78, 16, 'rgba(0,119,255,0.55)'],
  [30, 32, 'rgba(148,163,184,0.35)'],
  [55, 16, 'rgba(0,187,221,0.45)'],
  [44, 0, 'rgba(0,119,255,0.45)'],
  [70, 16, 'rgba(148,163,184,0.35)'],
  [36, 32, 'rgba(0,187,221,0.55)'],
];

const MARK_SIZE = {
  sm: 'w-10 h-[50px]',
  md: 'w-16 h-20',
  lg: 'w-24 h-[120px]',
} as const;

/**
 * Branded loader (Octopus Brand Kit "Loader — reading code"): the animated
 * mark over a scrolling code shimmer and three pulsing dots. Use it for
 * blocking/large loading states; small inline spinners stay `Loader2`.
 */
export function OctoLoader({
  label,
  size = 'md',
  showCode = true,
  className,
}: {
  label?: string;
  size?: keyof typeof MARK_SIZE;
  showCode?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <OctoLogo animated glow variant="dark" className={MARK_SIZE[size]} />

      {showCode && (
        <div className="w-[220px] h-[96px] rounded-lg overflow-hidden relative bg-rail ring-1 ring-accent/[0.18]">
          <div
            className="flex flex-col gap-[9px] px-3.5 py-3"
            style={{ animation: 'octo-code-scroll 6s linear infinite' }}
          >
            {/* two copies for a seamless -50% loop */}
            {[...CODE_LINES, ...CODE_LINES].map(([w, ml, color], i) => (
              <div
                key={i}
                className="h-[6px] rounded-full shrink-0"
                style={{ width: `${w}%`, marginLeft: ml, background: color }}
              />
            ))}
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg,rgb(var(--rail)),transparent 25%,transparent 75%,rgb(var(--rail)))',
            }}
          />
        </div>
      )}

      <div className="flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-accent"
            style={{ animation: `octo-dot-pulse 1.2s ${i * 0.2}s infinite` }}
          />
        ))}
      </div>

      {label && <div className="text-[12px] text-dim">{label}</div>}
    </div>
  );
}
