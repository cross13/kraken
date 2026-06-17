import { cn } from '../lib/cn';

interface Props {
  className?: string;
  /** Show a soft glow halo behind the mark. */
  glow?: boolean;
}

/**
 * Kraken mark — bulbous mantle with eyes and six tentacles curling in
 * alternating directions. Single-color: inherits `currentColor`.
 */
export function KrakenLogo({ className, glow }: Props) {
  return (
    <div className={cn('relative grid place-items-center', className)}>
      {glow && (
        <div className="absolute inset-0 rounded-full bg-accent/25 blur-md" />
      )}
      <svg
        viewBox="0 0 32 32"
        className="relative w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Mantle (head) */}
          <path
            d="M16 3.5
               C 10 3.5, 6.5 7.5, 6.5 12
               C 6.5 14.2, 7.5 15.8, 9 16.7
               L 9 17.5
               C 13.5 19, 18.5 19, 23 17.5
               L 23 16.7
               C 24.5 15.8, 25.5 14.2, 25.5 12
               C 25.5 7.5, 22 3.5, 16 3.5 Z"
            fill="currentColor"
            fillOpacity="0.14"
          />

          {/* Tentacle: far-left, curling back under */}
          <path d="M10 17.6 C 6.2 19, 3.2 19.4, 3.2 22 C 3.2 24, 4.8 25, 6.8 24.2" />
          {/* Tentacle: left, sweeping down */}
          <path d="M12 18.5 C 10.4 22, 7.4 24, 8.6 27.5" />
          {/* Tentacle: center-left, straight down with a curl */}
          <path d="M14 19 C 13.6 23, 12.6 25.5, 12.2 28.6" />
          {/* Tentacle: center-right, mirror */}
          <path d="M18 19 C 18.4 23, 19.4 25.5, 19.8 28.6" />
          {/* Tentacle: right */}
          <path d="M20 18.5 C 21.6 22, 24.6 24, 23.4 27.5" />
          {/* Tentacle: far-right, curling back under */}
          <path d="M22 17.6 C 25.8 19, 28.8 19.4, 28.8 22 C 28.8 24, 27.2 25, 25.2 24.2" />
        </g>

        {/* Eyes — solid dots so they read clearly even at 16px */}
        <circle cx="12.6" cy="10.8" r="1.45" fill="currentColor" />
        <circle cx="19.4" cy="10.8" r="1.45" fill="currentColor" />
      </svg>
    </div>
  );
}
