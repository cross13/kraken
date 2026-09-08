// Shared site constants.
export const GITHUB_URL = 'https://github.com/cross13/kraken';

/** The product's spoken name; `0ct0` is its wordmark. */
export const NAME = '0ct0';

/**
 * When the URL carries ?shot, scroll-reveal animations render in their final
 * (visible) state immediately — so headless full-page screenshots capture every
 * section instead of leaving below-the-fold reveals at opacity 0.
 */
export const STILL =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('shot');

export const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/workflow', label: 'The loop' },
  { to: '/docs', label: 'Docs' },
  { to: '/download', label: 'Download' },
] as const;
