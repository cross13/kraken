import { useState } from 'react';

/**
 * Glow-framed product screenshot. Falls back to a labelled placeholder pane
 * when the screenshot file isn't present yet (so the site builds before the
 * Electron captures exist).
 */
export function AppShot({
  src,
  alt,
  caption,
  className = '',
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className={`group relative ${className}`}>
      {/* Ambient glow */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-accent/15 blur-3xl transition group-hover:bg-accent/25" />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-950 shadow-deep">
        {/* Faux window chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] bg-ink-900/60 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-bad/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-ok/70" />
          <span className="ml-3 font-mono text-[11px] text-ink-500">{alt}</span>
        </div>
        {failed ? (
          <div className="grid aspect-[16/10] place-items-center bg-ink-950">
            <div className="text-center">
              <div className="font-mono text-xs text-ink-500">{alt}</div>
              <div className="mt-1 text-[11px] text-ink-600">screenshot pending</div>
            </div>
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailed(true)}
            className="block w-full"
          />
        )}
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-sm text-ink-400">{caption}</figcaption>
      )}
    </figure>
  );
}
