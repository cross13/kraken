import { cn } from '../lib/cn';
import { OctoMascot, type MascotState } from './wide/OctoMascot';

interface Props {
  className?: string;
  /** Which face. Defaults to `work` — the brand's resting expression. */
  state?: MascotState;
  /** Pulse a soft accent glow behind the mark. */
  glow?: boolean;
  /** Bring the mark to life: squashing body, swaying arms, blinking eyes. */
  animated?: boolean;
  /** `mark` (default) is the 14–26px drawing; `simple` from ~40px, `full` ≥64px. */
  detail?: 'full' | 'simple' | 'mark';
  /** Stagger the arm sway so two marks on screen never move in lockstep. */
  seed?: number;
}

/**
 * Octo's brand mark — the same octopus samurai the Travel Display colony is
 * made of (`OctoMascot`), so the app has **one creature**, not a logo and a
 * mascot that merely rhyme.
 *
 * The colony's state vocabulary comes with it: the mark is `work` wherever it
 * stands for the app itself, and the caller passes `done` / `fail` / `think` /
 * `sleep` wherever it stands for a run. `animated` off adds `.k-still`, which
 * freezes the whole creature — the mark in the nav rail is furniture, not a
 * thing that should breathe at you all day.
 *
 * Sizing: pass a **width** class only (`w-[18px]`, `w-12`); the drawing is
 * square-ish (`MASCOT_ASPECT`) and sets its own height.
 */
export function OctoMark({
  className,
  state = 'work',
  glow,
  animated,
  detail = 'mark',
  seed = 0,
}: Props) {
  return (
    <div
      className={cn('relative shrink-0', `k-mascot-${state}`, !animated && 'k-still', className)}
      style={glow ? { animation: 'octo-glow-pulse 3.5s ease-in-out infinite' } : undefined}
    >
      <div className={animated ? 'k-mascot-bob' : undefined}>
        <OctoMascot state={state} detail={detail} seed={seed} />
      </div>
    </div>
  );
}
