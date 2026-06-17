/**
 * Abyssal atmosphere: layered radial wells, a slow-drifting bioluminescent
 * blob, a faint depth grid, drifting particle motes, and a grain overlay.
 * Fixed, pointer-events-none, sits behind all content.
 */
export function Background() {
  // Deterministic motes (no Math.random — stable across renders/SSR).
  const motes = Array.from({ length: 28 }, (_, i) => {
    const left = (i * 37) % 100;
    const top = (i * 53 + 11) % 100;
    const size = 1 + ((i * 7) % 3);
    const delay = (i % 9) * 0.9;
    const dur = 9 + ((i * 13) % 10);
    const cyan = i % 3 === 0;
    return { left, top, size, delay, dur, cyan };
  });

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Depth grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(124,92,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(124,92,255,0.08) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(circle at 50% 30%, black, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 30%, black, transparent 78%)',
        }}
      />
      {/* Drifting glow blobs */}
      <div className="absolute -left-32 top-[-10%] h-[42rem] w-[42rem] rounded-full bg-accent/20 blur-[120px] animate-drift" />
      <div
        className="absolute right-[-12%] top-[6%] h-[34rem] w-[34rem] rounded-full bg-glowcyan/10 blur-[120px] animate-drift"
        style={{ animationDelay: '-6s' }}
      />
      <div
        className="absolute bottom-[-18%] left-1/3 h-[40rem] w-[40rem] rounded-full bg-accent/15 blur-[130px] animate-drift"
        style={{ animationDelay: '-3s' }}
      />

      {/* Particle motes */}
      {motes.map((m, i) => (
        <span
          key={i}
          className="absolute rounded-full animate-floaty"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size,
            height: m.size,
            background: m.cyan ? 'rgba(57,224,230,0.7)' : 'rgba(180,160,255,0.7)',
            boxShadow: m.cyan ? '0 0 8px rgba(57,224,230,0.8)' : '0 0 8px rgba(124,92,255,0.8)',
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.dur}s`,
            opacity: 0.5,
          }}
        />
      ))}

      {/* Grain */}
      <div className="grain absolute inset-0 opacity-[0.04] mix-blend-overlay" />
      {/* Bottom fade to abyss */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-ink-975 to-transparent" />
    </div>
  );
}
