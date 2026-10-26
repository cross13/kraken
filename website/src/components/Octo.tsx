import { useId } from 'react';

/**
 * The mark IS the mascot.
 *
 * Mochi — the cyberpunk daifuku the desktop app is made of — mirrored from the
 * app's `src/components/wide/OctoMascot.tsx` (itself a port of the sibling
 * Cross app's `Mascot.swift`), so the site and the app show the same creature
 * rather than two that merely rhyme. Two levels of detail: `mark` (14–26px —
 * body, antenna, visor, eyes) and `full` (≥64px — plus the halo, circuit
 * traces, data port, cheeks and mouth).
 *
 * On the site it is always in its resting `work` light, Signal's #C4F06A.
 * Mochi's body colours are literals in the app too: the lavender skin and the
 * cyan-to-magenta rim are the character, only the light follows the theme.
 */

const LIGHT = '#C4F06A';
const INK = '#2E2850';
const GLASS = '#120F22';
const BODY =
  'M 30,150 C 30,96 60,62 100,62 C 140,62 170,96 170,150 C 170,168 150,173 100,173 C 50,173 30,168 30,150 Z';

export function OctoMark({ className = '', detail = 'mark' }: { className?: string; detail?: 'mark' | 'full' }) {
  const mark = detail === 'mark';
  // Gradient/clip ids must be unique per instance: the nav and the footer share a page.
  const id = `mochi${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`${id}-skin`} x1="100" y1="62" x2="100" y2="173" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFBFF" />
          <stop offset="0.6" stopColor="#EDE4FF" />
          <stop offset="1" stopColor="#C4B3EE" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="30" y1="110" x2="170" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3EF0FF" stopOpacity={0.9} />
          <stop offset="1" stopColor="#FF3EA5" stopOpacity={0.9} />
        </linearGradient>
        <clipPath id={`${id}-visor`}>
          <rect x={50} y={90} width={100} height={38} rx={19} />
        </clipPath>
        <filter id={`${id}-halo`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={14} />
        </filter>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={3} />
        </filter>
      </defs>

      {!mark && <ellipse cx={100} cy={128} rx={64} ry={46} fill={LIGHT} opacity={0.3} filter={`url(#${id}-halo)`} />}
      <ellipse cx={100} cy={177} rx={62} ry={6} fill={LIGHT} opacity={0.4} />

      <path d="M 110,64 C 112,52 116,46 124,40" fill="none" stroke={INK} strokeWidth={mark ? 6 : 3.2} strokeLinecap="round" />
      {!mark && <circle cx={125} cy={39} r={9} fill={LIGHT} opacity={0.28} />}
      <circle cx={125} cy={39} r={mark ? 8 : 4.6} fill={LIGHT} />

      <path d={BODY} fill={`url(#${id}-skin)`} stroke={`url(#${id}-rim)`} strokeWidth={mark ? 6 : 2.6} />
      {!mark && <ellipse cx={68} cy={82} rx={13} ry={5.5} fill="#fff" opacity={0.9} transform="rotate(-30 68 82)" />}

      {!mark && (
        <>
          <path
            d="M 38,152 L 52,152 L 60,160 L 72,160 M 162,152 L 148,152 L 140,160 L 128,160"
            fill="none"
            stroke="#2FD6E8"
            strokeWidth={1.7}
            strokeDasharray="5 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
          <circle cx={72} cy={160} r={2.4} fill="#2FD6E8" />
          <circle cx={128} cy={160} r={2.4} fill="#2FD6E8" />
          <rect x={164} y={122} width={9} height={17} rx={2.5} fill={INK} />
          <rect x={166} y={125} width={5} height={3} rx={1} fill="#3EF0FF" />
          <rect x={166} y={131} width={5} height={3} rx={1} fill="#FF3EA5" />
          <rect x={55} y={134} width={15} height={5} rx={2.5} fill="#FF3EA5" opacity={0.6} />
          <rect x={130} y={134} width={15} height={5} rx={2.5} fill="#FF3EA5" opacity={0.6} />
        </>
      )}

      <rect x={50} y={90} width={100} height={38} rx={19} fill={GLASS} stroke={INK} strokeWidth={mark ? 3 : 2} />
      <g clipPath={`url(#${id}-visor)`} fill={LIGHT}>
        {!mark && (
          <g filter={`url(#${id}-glow)`}>
            <rect x={74} y={100} width={12} height={18} rx={5} />
            <rect x={114} y={100} width={12} height={18} rx={5} />
          </g>
        )}
        <rect x={74} y={100} width={12} height={18} rx={5} />
        <rect x={114} y={100} width={12} height={18} rx={5} />
      </g>
      {!mark && (
        <>
          <path d="M 62,96 L 82,96" stroke="#fff" strokeOpacity={0.22} strokeWidth={2} strokeLinecap="round" />
          <path
            d="M 92,140 Q 96,144 100,140 Q 104,144 108,140"
            fill="none"
            stroke="#4A3F6B"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

/**
 * The trailing zero: the mark's abstraction. The green bar is Mochi's visor,
 * cutting across the counter exactly as the visor cuts across the body — which
 * is what makes the two zeros of `0ct0` rhyme instead of merely repeat.
 */
export function BarZero({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 84 108" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx={42} cy={56} rx={30} ry={44} fill="none" stroke="currentColor" strokeWidth={13} />
      <rect x={0} y={41} width={84} height={11} fill="#A6E62E" />
    </svg>
  );
}

/**
 * The lockup. `size="nav"` is the compact form the full lockup degrades to
 * below ~96px of height: the mark plus `ct0`, never the creature squeezed
 * against display type it can no longer hold its own against.
 */
export function Wordmark({ size = 'nav' }: { size?: 'nav' | 'hero' }) {
  if (size === 'hero') {
    return (
      <span className="inline-flex items-end gap-2 sm:gap-3" aria-label="0ct0">
        {/* `full` from ~64px up: the halo, circuits, cheeks and mouth are what
            make Mochi a face rather than a blob at hero size. */}
        <OctoMark className="-mb-2 h-24 w-24 sm:h-32 sm:w-32" detail="full" />
        <span className="font-display text-[5.5rem] font-bold leading-[0.78] tracking-[-0.045em] text-ink-100 sm:text-[7rem]">
          ct
        </span>
        <BarZero className="ml-0.5 h-[4.8rem] w-[3.7rem] text-ink-100 sm:h-[6.1rem] sm:w-[4.7rem]" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="0ct0">
      <OctoMark className="h-[22px] w-[22px]" />
      <span className="font-display text-[19px] font-bold tracking-tight text-ink-100">
        ct<span className="text-accent-text">0</span>
      </span>
    </span>
  );
}
