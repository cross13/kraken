/**
 * Signal has no glow and no shadow: depth comes from a lighter grey and a 1px
 * line. So the atmosphere here is exactly that — a hairline grid on the brand
 * grey, faded out at the edges. Fixed, pointer-events-none, behind everything.
 */
export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(#2a2a2a 1px, transparent 1px), linear-gradient(90deg, #2a2a2a 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(120% 90% at 50% 0%, black 20%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(120% 90% at 50% 0%, black 20%, transparent 78%)',
        }}
      />
      {/* One accent hairline under the header band — the palette's only halo. */}
      <div className="absolute inset-x-0 top-16 h-px bg-accent/20" />
    </div>
  );
}
