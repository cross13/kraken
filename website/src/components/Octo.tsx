/**
 * The mark IS the mascot.
 *
 * One drawing, mirrored path-for-path from the desktop app's
 * `src/components/wide/OctoMascot.tsx`, so the site and the app show the same
 * creature rather than two that merely rhyme. Two levels of detail: `mark`
 * (14–26px — arms, head, eyes, kabuto silhouette) and `full` (≥64px — plus the
 * katana, the cel shade, the lacing and the rivets).
 *
 * `tone="green"` inverts it for the one place it sits on a green fill (the app
 * icon treatment), where #0F1400 is the only ink the palette allows.
 */

type Tone = 'grey' | 'green';

// The armour is darker here than the app's `--rail` (#1A1A1A). In the app the
// mark always sits on rail, panel or card, all of which are lighter than the
// lacquer, so the kabuto separates on its own. This page's ground is #1E1E1E —
// four values off — and at nav size the helmet vanished into it, leaving a
// green smudge. The head stays #2A2A2A so head and armour still read as two
// pieces, which is the thing that stops it looking like a beetle.
const INK: Record<Tone, { rim: string; body: string; eye: string; tint: string; lacquer: string }> = {
  grey: { rim: '#8AD000', body: '#2A2A2A', eye: '#C4F06A', tint: '#76B900', lacquer: '#121212' },
  green: { rim: '#0F1400', body: '#2A2A2A', eye: '#8AD000', tint: '#0F1400', lacquer: '#141414' },
};

const ARMS: [string, number][] = [
  ['M 31,88 C 26,99 24,108 29,112 C 32,114 35,111 34,107', 8],
  ['M 43,92 C 40,102 39,111 43,115', 7],
  ['M 55,94 C 54,104 53,112 56,116', 6.4],
  ['M 67,94 C 68,104 69,112 66,116', 6.4],
  ['M 79,92 C 82,102 83,111 79,115', 7],
];
const PLAIN_HAND = 'M 89,88 C 94,99 96,108 91,112 C 88,114 85,111 86,107';
const WORK_HAND = 'M 91,88 C 99,86 105,82 101,75';
const HEAD =
  'M 24,80 C 24,38 40,18 60,18 C 80,18 96,38 96,80 C 96,89 84,94 60,94 C 36,94 24,89 24,80 Z';
const SHADE =
  'M 96,80 C 96,38 80,18 60,18 C 74,27 84,46 84,80 C 84,88 76,92 62,93.6 C 84,93.4 96,89 96,80 Z';
const KABUTO = 'M 25,50 C 25,29 40,15 60,15 C 80,15 95,29 95,50 Z';
const BRIM = 'M 19,49 L 101,49 L 96,59 L 24,59 Z';
const KUWAGATA_L = 'M 51,49 C 43,37 35,25 33,10 C 39,19 50,31 56,43 Z';
const KUWAGATA_R = 'M 69,49 C 77,37 85,25 87,10 C 81,19 70,31 64,43 Z';
const FUKIGAESHI_L = 'M 25,45 L 11,41 L 9,59 L 24,59 Z';
const FUKIGAESHI_R = 'M 95,45 L 109,41 L 111,59 L 96,59 Z';
const CHIN = 'M 47,84 L 73,84 L 71,93 L 49,93 Z';

export function OctoMark({
  className = '',
  detail = 'mark',
  tone = 'grey',
}: {
  className?: string;
  detail?: 'mark' | 'full';
  tone?: Tone;
}) {
  const { rim, body, eye, tint, lacquer } = INK[tone];
  const mark = detail === 'mark';
  return (
    <svg
      viewBox="0 0 120 122"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <g fill="none" stroke={rim} strokeLinecap="round">
        {ARMS.map(([d, w]) => (
          <path key={d} d={d} strokeWidth={w} />
        ))}
        <path d={mark ? PLAIN_HAND : WORK_HAND} strokeWidth={mark ? 8 : 7.6} />
      </g>

      <path d={HEAD} fill={body} stroke={rim} strokeWidth={mark ? 4.6 : 3.5} strokeLinejoin="round" />
      {/* Shading is black-at-low-alpha, not a token: it multiplies correctly
          over every ground, where a fixed grey would only suit one. */}
      {!mark && <path d={SHADE} fill="#000000" opacity={0.24} />}
      {!mark && (
        <>
          <ellipse cx={31} cy={72} rx={6} ry={3.6} fill={tint} />
          <ellipse cx={89} cy={72} rx={6} ry={3.6} fill={tint} />
        </>
      )}

      {[43, 77].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={56} rx={11.5} ry={13.5} fill={eye} />
          {!mark && <circle cx={cx - 3.6} cy={50.5} r={3.9} fill="#FAFAFA" />}
          {!mark && <circle cx={cx + 4.2} cy={61.5} r={2} fill="#FAFAFA" opacity={0.75} />}
        </g>
      ))}

      {!mark && (
        <>
          <path
            d="M 54,78 C 56.5,83 63.5,83 66,78"
            fill="none"
            stroke={eye}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <path d={CHIN} fill={lacquer} stroke={rim} strokeWidth={1.8} strokeLinejoin="round" />
          <g fill={lacquer} stroke={rim} strokeWidth={1.6} strokeLinejoin="round">
            <path d="M 23,59 L 9,62 L 7,72 L 23,70 Z" />
            <path d="M 97,59 L 111,62 L 113,72 L 97,70 Z" />
            <path d="M 23,70 L 7,73 L 6,84 L 24,81 Z" />
            <path d="M 97,70 L 113,73 L 114,84 L 96,81 Z" />
          </g>
        </>
      )}

      <g stroke={rim} strokeLinejoin="round">
        <path d={FUKIGAESHI_L} fill={lacquer} strokeWidth={mark ? 2.4 : 1.8} />
        <path d={FUKIGAESHI_R} fill={lacquer} strokeWidth={mark ? 2.4 : 1.8} />
        <path d={KABUTO} fill={lacquer} strokeWidth={mark ? 2.8 : 2} />
        <path d={BRIM} fill={lacquer} strokeWidth={mark ? 2.4 : 1.8} />
      </g>
      {!mark && <circle cx={60} cy={20} r={3.2} fill={eye} />}
      <path d={KUWAGATA_L} fill={eye} />
      <path d={KUWAGATA_R} fill={eye} />
      {!mark && <circle cx={60} cy={44} r={5} fill={lacquer} stroke={eye} strokeWidth={1.6} />}

      {/* The katana's pose is the run's state. At rest, on the site, it is drawn. */}
      {!mark && (
        <g transform="rotate(-6 100 76)">
          <path
            d="M 97,79 L 103,74 L 119,20 L 113,17 Z"
            fill="#F2F2F2"
            stroke="#848484"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <path d="M 100,76 L 115,20" stroke="#FAFAFA" strokeWidth={1.2} opacity={0.85} />
          <path d="M 94,80 L 104,72 L 109,78 L 99,86 Z" fill={eye} />
          <path d="M 89,88 L 97,81 L 102,87 L 94,94 Z" fill={lacquer} />
        </g>
      )}
    </svg>
  );
}

/**
 * The trailing zero: the mark's abstraction. The green bar is the kabuto's
 * brim, cutting the counter exactly as the brim cuts the head — which is what
 * makes the two zeros of `0ct0` rhyme instead of merely repeat.
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
        {/* `full` from ~64px up: at `mark` detail the brim cuts the eyes into
            slits and the kuwagata read as antennae — the creature only holds
            together at hero size with its mouth, chin and katana. */}
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
