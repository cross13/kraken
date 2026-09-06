import { useId } from 'react';
import { cn } from '../../lib/cn';

/**
 * The five things a run can be, as a face. Green executes, violet decides,
 * red failed — the brand's two-accent rule, applied to a creature.
 */
export type MascotState = 'work' | 'think' | 'sleep' | 'done' | 'fail';

/** Height/width of the viewBox — a mascot `w` px wide is `w * ASPECT` tall. */
export const MASCOT_ASPECT = 122 / 120;

// Every colour resolves through a theme variable, so the colony re-skins with
// the rest of the app. CSS variables only reach SVG through `style`, never
// through presentation attributes — the one constraint every drawing here obeys.
const PALETTE: Record<MascotState, { rim: string; body: string; eye: string; tint: string }> = {
  work: {
    rim: 'rgb(var(--accent2))',
    body: 'rgb(var(--card))',
    eye: 'rgb(var(--accent-num))',
    tint: 'rgb(var(--accent))',
  },
  think: {
    rim: 'rgb(var(--agent2))',
    body: 'rgb(var(--agent-tint))',
    eye: 'rgb(var(--agent-text))',
    tint: 'rgb(var(--agent))',
  },
  sleep: {
    rim: 'rgb(var(--agent) / 0.55)',
    body: 'rgb(var(--bg))',
    eye: 'rgb(var(--agent) / 0.8)',
    tint: 'rgb(var(--agent) / 0.5)',
  },
  done: {
    rim: 'rgb(var(--accent) / 0.6)',
    body: 'rgb(var(--bg))',
    eye: 'rgb(var(--accent-text))',
    tint: 'rgb(var(--accent))',
  },
  fail: {
    rim: 'rgb(var(--danger))',
    body: 'rgb(var(--card))',
    eye: 'rgb(var(--danger-text))',
    tint: 'rgb(var(--danger))',
  },
};

// Lacquer, steel and the ink that never changes with state.
const LACQUER = 'rgb(var(--rail))';
const STEEL = 'rgb(var(--ink-100))';
const SPINE = 'rgb(var(--ink-600))';
const GLINT = 'rgb(var(--ink-50))';

// ---- the creature ---------------------------------------------------------
const HEAD =
  'M 24,80 C 24,38 40,18 60,18 C 80,18 96,38 96,80 C 96,89 84,94 60,94 C 36,94 24,89 24,80 Z';
const SHADE =
  'M 96,80 C 96,38 80,18 60,18 C 74,27 84,46 84,80 C 84,88 76,92 62,93.6 C 84,93.4 96,89 96,80 Z';
/** Five arms; the sixth is the sword hand and is re-pathed per state. */
const ARMS: [string, number][] = [
  ['M 31,88 C 26,99 24,108 29,112 C 32,114 35,111 34,107', 8],
  ['M 43,92 C 40,102 39,111 43,115', 7],
  ['M 55,94 C 54,104 53,112 56,116', 6.4],
  ['M 67,94 C 68,104 69,112 66,116', 6.4],
  ['M 79,92 C 82,102 83,111 79,115', 7],
];
/** The mark level has no katana, so the sixth arm is just an arm again. */
const PLAIN_HAND = 'M 89,88 C 94,99 96,108 91,112 C 88,114 85,111 86,107';
const HAND: Record<MascotState, string> = {
  work: 'M 91,88 C 99,86 105,82 101,75',
  think: 'M 91,88 C 98,88 103,84 100,78',
  sleep: 'M 91,88 C 97,94 100,102 95,108',
  done: 'M 91,88 C 99,85 104,80 100,74',
  fail: 'M 91,88 C 97,96 99,104 94,110',
};

// ---- the armour -----------------------------------------------------------
const KABUTO = 'M 25,50 C 25,29 40,15 60,15 C 80,15 95,29 95,50 Z';
const BRIM = 'M 19,49 L 101,49 L 96,59 L 24,59 Z';
const KUWAGATA_L = 'M 51,49 C 43,37 35,25 33,10 C 39,19 50,31 56,43 Z';
const KUWAGATA_R = 'M 69,49 C 77,37 85,25 87,10 C 81,19 70,31 64,43 Z';
const FUKIGAESHI_L = 'M 25,45 L 11,41 L 9,59 L 24,59 Z';
const FUKIGAESHI_R = 'M 95,45 L 109,41 L 111,59 L 96,59 Z';
const SHIKORO: [string, string][] = [
  ['M 23,59 L 9,62 L 7,72 L 23,70 Z', 'M 97,59 L 111,62 L 113,72 L 97,70 Z'],
  ['M 23,70 L 7,73 L 6,84 L 24,81 Z', 'M 97,70 L 113,73 L 114,84 L 96,81 Z'],
];
const CHIN = 'M 47,84 L 73,84 L 71,93 L 49,93 Z';

/** Where the katana sits. Its pose is the state — read the sword, not the face. */
const SWORD_POSE: Record<MascotState, string> = {
  work: 'rotate(-6 100 76)',
  think: '',
  sleep: 'rotate(26 96 104)',
  done: 'rotate(-16 100 74)',
  fail: 'rotate(150 96 104)',
};

/** Eyes carry the status: scanning, shut, happy, or crossed out. */
function Eyes({ state, eye, mark }: { state: MascotState; eye: string; mark?: boolean }) {
  if (state === 'sleep') {
    return (
      <>
        <path d="M 33,60 C 38,51 48,51 53,60" fill="none" style={{ stroke: eye }} strokeWidth={4.5} strokeLinecap="round" />
        <path d="M 67,60 C 72,51 82,51 87,60" fill="none" style={{ stroke: eye }} strokeWidth={4.5} strokeLinecap="round" />
      </>
    );
  }
  if (state === 'done') {
    return (
      <>
        <path d="M 32,63 C 38,48 48,48 54,63" fill="none" style={{ stroke: eye }} strokeWidth={5} strokeLinecap="round" />
        <path d="M 66,63 C 72,48 82,48 88,63" fill="none" style={{ stroke: eye }} strokeWidth={5} strokeLinecap="round" />
      </>
    );
  }
  if (state === 'fail') {
    return (
      <>
        <path d="M 35,47 L 51,65 M 51,47 L 35,65" fill="none" style={{ stroke: eye }} strokeWidth={4.5} strokeLinecap="round" />
        <path d="M 69,47 L 85,65 M 85,47 L 69,65" fill="none" style={{ stroke: eye }} strokeWidth={4.5} strokeLinecap="round" />
      </>
    );
  }
  // Working / deciding: the big anime eye, two highlights, blinking.
  return (
    <>
      {[43, 77].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={56} rx={11.5} ry={13.5} style={{ fill: eye }} />
          {!mark && <circle cx={cx - 3.6} cy={50.5} r={3.9} style={{ fill: GLINT }} />}
          {!mark && <circle cx={cx + 4.2} cy={61.5} r={2} style={{ fill: GLINT }} opacity={0.75} />}
        </g>
      ))}
    </>
  );
}

function Mouth({ state, eye, body }: { state: MascotState; eye: string; body: string }) {
  if (state === 'work')
    return <path d="M 54,78 C 56.5,83 63.5,83 66,78" fill="none" style={{ stroke: eye }} strokeWidth={3} strokeLinecap="round" />;
  if (state === 'think')
    return <ellipse cx={60} cy={79} rx={4} ry={4.6} fill="none" style={{ stroke: eye }} strokeWidth={3} />;
  if (state === 'sleep')
    return <ellipse cx={60} cy={79} rx={3.4} ry={4.4} style={{ fill: eye }} opacity={0.85} />;
  if (state === 'done')
    return (
      <>
        <path d="M 49,75 C 53,88 67,88 71,75 Z" style={{ fill: eye }} />
        <path d="M 55,82.5 C 57,86 63,86 65,82.5 Z" style={{ fill: body }} opacity={0.55} />
      </>
    );
  return (
    <path d="M 50,80 C 53,75 56,85 60,80 C 64,75 67,85 70,80" fill="none" style={{ stroke: eye }} strokeWidth={3} strokeLinecap="round" />
  );
}

/** Blade, guard and wrapped hilt. Sheathed for `think` — only the tsuka shows. */
function Katana({ state, rim, eye, full }: { state: MascotState; rim: string; eye: string; full: boolean }) {
  if (state === 'think') {
    return (
      <g className="k-sword">
        <path d="M 92,80 L 100,74 L 118,96 L 110,102 Z" style={{ fill: LACQUER, stroke: rim }} strokeWidth={2} strokeLinejoin="round" />
        <path d="M 96,77 L 101,73 L 108,81 L 103,85 Z" style={{ fill: eye }} />
        <path d="M 99,70 L 104,66 L 110,73 L 105,77 Z" style={{ fill: LACQUER }} />
        {full && <path d="M 100,68 L 106,74 M 102,66 L 108,72" style={{ stroke: 'rgb(var(--bg))' }} strokeWidth={1.4} />}
      </g>
    );
  }
  return (
    <g className="k-sword">
      <path d="M 97,79 L 103,74 L 119,20 L 113,17 Z" style={{ fill: STEEL, stroke: SPINE }} strokeWidth={1.4} strokeLinejoin="round" />
      {full && <path d="M 100,76 L 115,20" style={{ stroke: GLINT }} strokeWidth={1.2} opacity={0.85} />}
      <path d="M 94,80 L 104,72 L 109,78 L 99,86 Z" style={{ fill: eye }} />
      <path d="M 89,88 L 97,81 L 102,87 L 94,94 Z" style={{ fill: LACQUER }} />
      {full && <path d="M 91,88 L 96,93 M 94,85 L 99,90" style={{ stroke: eye }} strokeWidth={1.4} opacity={0.7} />}
    </g>
  );
}

/**
 * One octopus samurai. Sized by its container's width; the caller owns
 * position, drift and bob (`.k-mascot` / `.k-mascot-bob` in styles.css) so a
 * whole colony can be staggered from one place.
 *
 * **The katana's pose is the run's state** — drawn and cutting, sheathed with
 * a hand on the hilt, resting, flicked clean (chiburi) after a win, or driven
 * into the ground on a failure. It reads across a room before the face does.
 *
 * `detail="simple"` drops the rivets, lacing, mon and cel shade: below ~40px
 * those stop being detail and become noise, so the reef and the compressed
 * colony ask for the simplified drawing, exactly as a sprite sheet would.
 *
 * `detail="mark"` goes one step further and is the **app-wide brand mark**
 * (`OctoMark`, 14–26px): arms, head, eyes and the kabuto silhouette, nothing
 * else. The katana, the mouth, the chin guard and the neck guard all become
 * single-pixel smudges at that size, and a blade sticking out of the rail's
 * brand tile reads as an artefact rather than a sword — so the mark keeps only
 * what still carries identity when it is 16 pixels tall.
 */
export function OctoMascot({
  state,
  seed = 0,
  detail = 'full',
  className,
}: {
  state: MascotState;
  /** Stagger the arm sway so two neighbours never move in lockstep. */
  seed?: number;
  /** `simple` under ~40px, `mark` under ~26px — see above. */
  detail?: 'full' | 'simple' | 'mark';
  className?: string;
}) {
  const { rim, body, eye, tint } = PALETTE[state];
  const full = detail === 'full';
  const mark = detail === 'mark';
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const armStyle = (i: number) => ({ stroke: rim, animationDelay: `${-((i * 0.5 + seed * 0.17) % 2.4)}s` });

  return (
    <svg
      viewBox="0 0 120 122"
      className={cn('block w-full h-auto', className)}
      style={{ overflow: 'visible' }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-mascot={uid}
    >
      {/* arms, then the sword hand */}
      {ARMS.map(([d, w], i) => (
        <path key={i} d={d} fill="none" style={armStyle(i)} strokeWidth={w} strokeLinecap="round" className="k-mascot-tent" />
      ))}
      <path d={mark ? PLAIN_HAND : HAND[state]} fill="none" style={armStyle(5)} strokeWidth={mark ? 8 : 7.6} strokeLinecap="round" className="k-mascot-tent" />

      {/* head */}
      <path d={HEAD} style={{ fill: body, stroke: rim }} strokeWidth={mark ? 4.6 : 3.5} strokeLinejoin="round" />
      {/* Shading is black-at-low-alpha, not a token: it multiplies correctly
          over every palette, where a fixed grey would only suit one. */}
      {full && <path d={SHADE} fill="#000" opacity={0.24} />}
      {full && (state === 'work' || state === 'think' || state === 'done') && (
        <g className="k-mascot-blush">
          <ellipse cx={31} cy={72} rx={6} ry={3.6} style={{ fill: tint }} />
          <ellipse cx={89} cy={72} rx={6} ry={3.6} style={{ fill: tint }} />
        </g>
      )}
      <g className="k-mascot-eyes">
        <Eyes state={state} eye={eye} mark={mark} />
      </g>
      {!mark && <Mouth state={state} eye={eye} body={body} />}

      {/* chin plate — deliberately a chin guard, not a menpo: the mouth still emotes */}
      {!mark && <path d={CHIN} style={{ fill: LACQUER, stroke: rim }} strokeWidth={1.8} strokeLinejoin="round" />}
      {full && <path d="M 55,88 L 65,88" style={{ stroke: eye }} strokeWidth={1.4} opacity={0.8} />}

      {/* shikoro — the layered neck guard, one beat behind the head */}
      {SHIKORO.slice(0, full ? 2 : mark ? 0 : 1).map(([l, r], i) => (
        <g key={i} className="k-mascot-shikoro">
          <path d={l} style={{ fill: LACQUER, stroke: rim }} strokeWidth={1.6} strokeLinejoin="round" />
          <path d={r} style={{ fill: LACQUER, stroke: rim }} strokeWidth={1.6} strokeLinejoin="round" />
        </g>
      ))}
      {full && (
        <g className="k-mascot-shikoro" style={{ stroke: eye }} strokeWidth={1.5} strokeLinecap="round" opacity={0.9}>
          <path d="M 12,64 L 12,69 M 17,63 L 17,68 M 11,75 L 11,80 M 16,74 L 16,79" />
          <path d="M 108,64 L 108,69 M 103,63 L 103,68 M 109,75 L 109,80 M 104,74 L 104,79" />
        </g>
      )}

      {/* kabuto */}
      <g className="k-mascot-crest">
        <path d={FUKIGAESHI_L} style={{ fill: LACQUER, stroke: rim }} strokeWidth={mark ? 2.4 : 1.8} strokeLinejoin="round" />
        <path d={FUKIGAESHI_R} style={{ fill: LACQUER, stroke: rim }} strokeWidth={mark ? 2.4 : 1.8} strokeLinejoin="round" />
        {full && (
          <>
            <circle cx={16} cy={50} r={3.4} style={{ fill: eye }} />
            <circle cx={104} cy={50} r={3.4} style={{ fill: eye }} />
          </>
        )}
        <path d={KABUTO} style={{ fill: LACQUER, stroke: rim }} strokeWidth={mark ? 2.8 : 2} strokeLinejoin="round" />
        {!mark && <path d="M 60,15 L 60,49" stroke="#000" strokeWidth={1.5} opacity={0.45} />}
        {!mark && <circle cx={60} cy={20} r={3.2} style={{ fill: eye }} />}
        {full && (
          <g style={{ fill: eye }} opacity={0.85}>
            <circle cx={38} cy={34} r={1.5} />
            <circle cx={47} cy={25} r={1.5} />
            <circle cx={73} cy={25} r={1.5} />
            <circle cx={82} cy={34} r={1.5} />
          </g>
        )}
        <path d={BRIM} style={{ fill: LACQUER, stroke: rim }} strokeWidth={mark ? 2.4 : 1.8} strokeLinejoin="round" />
        <path d={KUWAGATA_L} style={{ fill: eye }} />
        <path d={KUWAGATA_R} style={{ fill: eye }} />
        {!mark && <circle cx={60} cy={44} r={5} style={{ fill: LACQUER, stroke: eye }} strokeWidth={1.6} />}
      </g>

      {/* the katana, posed by state */}
      {!mark && (
        <g className="k-mascot-sword" transform={SWORD_POSE[state] || undefined}>
          <Katana state={state} rim={rim} eye={eye} full={full} />
        </g>
      )}

      {/* what each state does with the blade */}
      {!mark && state === 'work' && (
        <path className="k-slash" d="M 30,26 C 56,8 90,10 112,30" fill="none" style={{ stroke: GLINT }} strokeWidth={3} strokeLinecap="round" opacity={0} />
      )}
      {!mark && state === 'done' && (
        <>
          <path className="k-chiburi" d="M 104,72 C 112,64 116,52 114,40" fill="none" style={{ stroke: GLINT }} strokeWidth={2.4} strokeLinecap="round" opacity={0} />
          {full &&
            [
              [16, 22],
              [104, 60],
              [30, 96],
              [96, 14],
            ].map(([x, y], i) => (
              <path
                key={i}
                className="k-petal"
                style={{ fill: 'rgb(var(--agent2))', animationDelay: `${-i * 0.9}s` }}
                d={`M ${x},${y} C ${x + 4},${y - 3} ${x + 6},${y + 2} ${x},${y + 6} C ${x - 6},${y + 2} ${x - 4},${y - 3} ${x},${y} Z`}
                opacity={0.9}
              />
            ))}
        </>
      )}
      {!mark && state === 'fail' && (
        <path className="k-drop" d="M 20,30 C 25,39 25,45 20,45 C 15,45 15,39 20,30 Z" style={{ fill: 'rgb(var(--ink-400))' }} opacity={0.8} />
      )}
    </svg>
  );
}
