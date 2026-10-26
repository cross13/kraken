import { useId } from 'react';
import { cn } from '../../lib/cn';

/**
 * The five things a run can be, as a face. Green executes, violet decides,
 * red failed — the brand's two-accent rule, applied to a creature.
 */
export type MascotState = 'work' | 'think' | 'sleep' | 'done' | 'fail';

/** Height/width of the viewBox — a mascot `w` px wide is `w * ASPECT` tall. */
export const MASCOT_ASPECT = 1;

/**
 * The state's light: what the eyes behind the visor, the antenna LED and the
 * halo glow with. Theme variables, so the light follows the palette — CSS
 * variables only reach SVG through `style`, never presentation attributes.
 */
const LIGHT: Record<MascotState, string> = {
  work: 'rgb(var(--accent-num))',
  think: 'rgb(var(--agent-text))',
  sleep: 'rgb(var(--agent) / 0.8)',
  done: 'rgb(var(--accent-text))',
  fail: 'rgb(var(--danger-text))',
};

// Mochi's own body. These are literals on purpose, like a tracker's brand hue:
// a lavender daifuku with a cyan-to-magenta rim *is* the character, and
// re-tinting it per palette would make it a different creature. Only the light
// (above) is the theme's.
const CYAN = '#3EF0FF';
const MAGENTA = '#FF3EA5';
const TRACE = '#2FD6E8';
const INK = '#2E2850';
const GLASS = '#120F22';
const MOUTH = '#4A3F6B';

// ---- the creature (a 200 × 200 box, the same one as Cross's drawing) --------
/** A daifuku: a high soft dome settling into a wide, slightly flattened bottom. */
const BODY = 'M 30,150 C 30,96 60,62 100,62 C 140,62 170,96 170,150 C 170,168 150,173 100,173 C 50,173 30,168 30,150 Z';
const ANTENNA = 'M 110,64 C 112,52 116,46 124,40';
const TRACES = 'M 38,152 L 52,152 L 60,160 L 72,160 M 162,152 L 148,152 L 140,160 L 128,160';

/** Lights behind the visor glass. Drawn twice by the caller: blurred for the glow, then sharp. */
function Eyes({ state, light, mark }: { state: MascotState; light: string; mark: boolean }) {
  const fill = { fill: light };
  const stroke = { stroke: light };
  const both = (draw: (dx: number) => JSX.Element) => [0, 40].map((dx) => <g key={dx}>{draw(dx)}</g>);

  // The mark is furniture: at rest it looks at you rather than scanning.
  if (state === 'work' && !mark) {
    return (
      <>
        <rect className="k-mochi-scan" x={50} y={90} width={16} height={38} style={fill} opacity={0.35} />
        {both((dx) => <rect x={73 + dx} y={104} width={14} height={9} rx={3} style={fill} />)}
      </>
    );
  }
  if (state === 'think') {
    return (
      <g className="k-mochi-look">
        {both((dx) => <rect x={70 + dx} y={97} width={11} height={13} rx={5} style={fill} />)}
      </g>
    );
  }
  if (state === 'sleep') {
    return (
      <>
        {both((dx) => (
          <path d={`M ${73 + dx},110 Q ${80 + dx},115 ${87 + dx},110`} fill="none" style={stroke} strokeWidth={3.5} strokeLinecap="round" opacity={0.8} />
        ))}
      </>
    );
  }
  if (state === 'done') {
    return (
      <>
        {both((dx) => (
          <path d={`M ${72 + dx},113 L ${80 + dx},104 L ${88 + dx},113`} fill="none" style={stroke} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </>
    );
  }
  if (state === 'fail') {
    return (
      <>
        {both((dx) => (
          <path d={`M ${74 + dx},103 L ${86 + dx},115 M ${86 + dx},103 L ${74 + dx},115`} fill="none" style={stroke} strokeWidth={4} strokeLinecap="round" />
        ))}
      </>
    );
  }
  // Open, blinking.
  return <g className="k-mascot-eyes">{both((dx) => <rect x={74 + dx} y={100} width={12} height={18} rx={5} style={fill} />)}</g>;
}

function Mouth({ state }: { state: MascotState }) {
  const ink = { stroke: MOUTH };
  if (state === 'think') return <ellipse cx={100} cy={142} rx={3.6} ry={4.2} style={{ fill: MOUTH }} />;
  if (state === 'sleep') return <ellipse cx={100} cy={142} rx={2.6} ry={2} style={{ fill: MOUTH }} />;
  if (state === 'done') return <path d="M 91,138 Q 100,151 109,138 Z" style={{ fill: MOUTH }} />;
  if (state === 'fail')
    return <path d="M 89,143 L 93,140 L 97,143 L 101,140 L 105,143 L 109,140" fill="none" style={ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />;
  return (
    <path d="M 92,140 Q 96,144 100,140 Q 104,144 108,140" fill="none" style={ink} strokeWidth={2.6} strokeLinecap="round" />
  );
}

/**
 * Mochi — a cyberpunk daifuku: a soft lavender blob with a dark neon visor, an
 * antenna with an LED, circuit traces and a cyan-to-magenta rim. It comes from
 * Cross (`cross/Sources/CrossKit/Mascot.swift`), redrawn here as SVG so both
 * apps share one creature. Sized by its container's width; the caller owns
 * position, drift and bob (`.k-mascot` / `.k-mascot-bob` in styles.css) so a
 * whole colony can be staggered from one place.
 *
 * **The light behind the visor is the run's state**, and each state has its own
 * eyes: a scanning bar while it works, a sideways glance with thought bubbles
 * while it decides, shut while queued, ^ ^ with sparkles when done, crossed out
 * when it failed.
 *
 * `detail="simple"` keeps the circuits and cheeks but drops the halo blur and
 * the extras; `detail="mark"` is the **app-wide brand mark** (`OctoMark`,
 * 14–26px): body, antenna, visor and eyes, nothing else — anything finer is a
 * smudge at 16 pixels.
 */
export function OctoMascot({
  state,
  seed = 0,
  detail = 'full',
  className,
}: {
  state: MascotState;
  /** Stagger the motion so two neighbours never move in lockstep. */
  seed?: number;
  /** `simple` under ~40px, `mark` under ~26px — see above. */
  detail?: 'full' | 'simple' | 'mark';
  className?: string;
}) {
  const light = LIGHT[state];
  const full = detail === 'full';
  const mark = detail === 'mark';
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (name: string) => `${name}-${uid}`;
  const delay = { animationDelay: `${-((seed * 0.37) % 4.4)}s` };

  return (
    <svg
      viewBox="0 0 200 200"
      className={cn('block w-full h-auto', className)}
      style={{ overflow: 'visible' }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-mascot={uid}
    >
      <defs>
        <linearGradient id={id('skin')} x1="100" y1="62" x2="100" y2="173" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFBFF" />
          <stop offset="0.6" stopColor="#EDE4FF" />
          <stop offset="1" stopColor="#C4B3EE" />
        </linearGradient>
        <linearGradient id={id('rim')} x1="30" y1="110" x2="170" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={CYAN} stopOpacity={0.9} />
          <stop offset="1" stopColor={MAGENTA} stopOpacity={0.9} />
        </linearGradient>
        <clipPath id={id('visor')}>
          <rect x={50} y={90} width={100} height={38} rx={19} />
        </clipPath>
        <filter id={id('glow')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={3} />
        </filter>
        <filter id={id('halo')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={14} />
        </filter>
      </defs>

      {/* glow and floor shadow, in the state's light */}
      {full && <ellipse cx={100} cy={128} rx={64} ry={46} style={{ fill: light }} opacity={0.3} filter={`url(#${id('halo')})`} />}
      <ellipse cx={100} cy={177} rx={62} ry={6} style={{ fill: light }} opacity={0.4} />

      {/* antenna and LED */}
      <path d={ANTENNA} fill="none" style={{ stroke: INK }} strokeWidth={mark ? 6 : 3.2} strokeLinecap="round" />
      <g className="k-mochi-led" style={delay}>
        {!mark && <circle cx={125} cy={39} r={9} style={{ fill: light }} opacity={0.28} />}
        <circle cx={125} cy={39} r={mark ? 8 : 4.6} style={{ fill: light }} />
      </g>

      {/* body */}
      <path d={BODY} fill={`url(#${id('skin')})`} stroke={`url(#${id('rim')})`} strokeWidth={mark ? 6 : 2.6} />
      {!mark && <ellipse cx={68} cy={82} rx={13} ry={5.5} fill="#fff" opacity={0.9} transform="rotate(-30 68 82)" />}

      {/* circuit traces with current along them, a data port and neon cheeks */}
      {!mark && (
        <>
          <path className="k-mochi-flow" d={TRACES} fill="none" style={{ stroke: TRACE }} strokeWidth={1.7} strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
          <circle cx={72} cy={160} r={2.4} style={{ fill: TRACE }} />
          <circle cx={128} cy={160} r={2.4} style={{ fill: TRACE }} />
          <rect x={164} y={122} width={9} height={17} rx={2.5} style={{ fill: INK }} />
          <rect x={166} y={125} width={5} height={3} rx={1} style={{ fill: CYAN }} />
          <rect x={166} y={131} width={5} height={3} rx={1} style={{ fill: MAGENTA }} />
          <rect x={55} y={134} width={15} height={5} rx={2.5} style={{ fill: MAGENTA }} opacity={0.6} />
          <rect x={130} y={134} width={15} height={5} rx={2.5} style={{ fill: MAGENTA }} opacity={0.6} />
        </>
      )}

      {/* the visor, and the lights behind it */}
      <rect x={50} y={90} width={100} height={38} rx={19} style={{ fill: GLASS, stroke: INK }} strokeWidth={mark ? 3 : 2} />
      <g clipPath={`url(#${id('visor')})`}>
        {!mark && (
          <g filter={`url(#${id('glow')})`}>
            <Eyes state={state} light={light} mark={mark} />
          </g>
        )}
        <Eyes state={state} light={light} mark={mark} />
      </g>
      {!mark && <path d="M 62,96 L 82,96" fill="none" stroke="#fff" strokeOpacity={0.22} strokeWidth={2} strokeLinecap="round" />}

      {!mark && <Mouth state={state} />}

      {/* what each state adds around it */}
      {full && state === 'think' &&
        (
          [
            [66, 54, 3, 0],
            [55, 44, 4, 0.15],
            [42, 31, 5, 0.3],
          ] as const
        ).map(([cx, cy, r, d]) => (
          <circle key={cx} className="k-mochi-thought" cx={cx} cy={cy} r={r} style={{ fill: light, animationDelay: `${d}s` }} />
        ))}
      {full && state === 'done' &&
        (
          [
            [34, 74, 8, light, 0],
            [166, 62, 8, MAGENTA, 0.5],
            [176, 112, 6, CYAN, 1],
          ] as const
        ).map(([x, y, r, c, d]) => (
          <path
            key={x}
            className="k-spark"
            style={{ fill: c, animationDelay: `${d}s`, transformBox: 'fill-box', transformOrigin: '50% 50%' }}
            d={`M ${x},${y - r} L ${x + r * 0.28},${y - r * 0.28} L ${x + r},${y} L ${x + r * 0.28},${y + r * 0.28} L ${x},${y + r} L ${x - r * 0.28},${y + r * 0.28} L ${x - r},${y} L ${x - r * 0.28},${y - r * 0.28} Z`}
          />
        ))}
    </svg>
  );
}
