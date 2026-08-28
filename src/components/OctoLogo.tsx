import { useId } from 'react';
import { cn } from '../lib/cn';
import { useTheme } from '../stores/theme';

interface Props {
  className?: string;
  /** Pulse a soft cyan glow behind the mark (dark variant only). */
  glow?: boolean;
  /** Bring the mark to life: bobbing body, swaying tentacles, scanning eyes. */
  animated?: boolean;
  /** Force a colorway; 'auto' picks the light mark on the Daylight theme. */
  variant?: 'auto' | 'dark' | 'light';
}

// Octopus brand mark (Octopus Brand Kit) — viewBox 40 24 120 150.
const TENTACLES = [
  'M 62,106 C 54,124 50,138 58,150',
  'M 80,112 C 76,132 74,148 80,162',
  'M 100,114 C 100,134 98,152 102,166',
  'M 120,112 C 124,132 126,148 120,162',
  'M 138,106 C 146,124 150,138 142,150',
];
const BODY =
  'M 55,112 C 46,68 62,36 100,32 C 138,36 154,68 145,112 L 134,120 L 125,108 L 112,122 L 100,112 L 88,122 L 75,108 L 66,120 Z';
const EYE_LEFT = 'M 72,68 L 92,76 L 92,84 L 72,76 Z';
const EYE_RIGHT = 'M 128,68 L 108,76 L 108,84 L 128,76 Z';

/**
 * Octo brand mark — the octopus from the Octopus Brand Kit. The dark
 * colorway carries the brand gradients (cyan rim on a deep-sea body); the
 * light colorway is flat navy for white/daylight tiles. Keyframes live in
 * styles.css under "Brand".
 */
export function OctoLogo({ className, glow, animated, variant = 'auto' }: Props) {
  const theme = useTheme((s) => s.theme);
  const light = variant === 'light' || (variant === 'auto' && theme === 'daylight');
  // Gradient ids must be unique per instance — the mark renders many times per page.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const rimId = `okRim${uid}`;
  const bodyId = `okBody${uid}`;

  const rim = light ? '#003973' : `url(#${rimId})`;
  const eye = light ? '#00BBDD' : '#7DF3FF';

  return (
    <div
      className={cn('relative grid place-items-center', className)}
      style={animated ? { animation: 'octo-bob 2.6s ease-in-out infinite' } : undefined}
    >
      <svg
        viewBox="40 24 120 150"
        className="relative w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{
          overflow: 'visible',
          ...(glow && !light
            ? { animation: 'octo-glow-pulse 3.5s ease-in-out infinite' }
            : undefined),
        }}
      >
        {!light && (
          <defs>
            <linearGradient id={rimId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#00BBDD" />
              <stop offset="1" stopColor="#003973" />
            </linearGradient>
            <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#001A33" />
              <stop offset="1" stopColor="#000A14" />
            </linearGradient>
          </defs>
        )}

        {TENTACLES.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={rim}
            strokeWidth={8}
            strokeLinecap="round"
            style={
              animated
                ? {
                    transformBox: 'fill-box',
                    transformOrigin: '50% 0%',
                    animation: `octo-tent-sway 2.4s ease-in-out ${-i * 0.5}s infinite`,
                  }
                : undefined
            }
          />
        ))}

        <path
          d={BODY}
          fill={light ? '#003973' : `url(#${bodyId})`}
          stroke={light ? undefined : rim}
          strokeWidth={light ? undefined : 3}
          strokeLinejoin="round"
        />

        <g style={animated ? { animation: 'octo-eye-scan 3.2s linear infinite' } : undefined}>
          <path d={EYE_LEFT} fill={eye} />
          <path d={EYE_RIGHT} fill={eye} />
        </g>
      </svg>
    </div>
  );
}
