// The renderer and the preload are built separately, and in `npm run dev` the
// renderer hot-reloads while the preload only changes when Electron restarts.
// So a renderer that calls a method the running preload predates is a normal
// state during development, not a corner case — and left unguarded it throws
// "undefined is not a function" from inside a `useEffect`, which React reports
// far from the cause.
//
// `bridgeReady` turns that into something a component can render: the feature
// hides itself and says why, instead of failing silently or taking the tree
// down with it.

/** True when the running preload actually exposes `octo[ns][method]`. */
export function bridgeReady(ns: string, method: string): boolean {
  const api = (window as unknown as { octo?: Record<string, unknown> }).octo;
  const bag = api?.[ns] as Record<string, unknown> | undefined;
  return typeof bag?.[method] === 'function';
}

/** The one sentence to show when it isn't. */
export const STALE_BRIDGE =
  'This part of the app is newer than the running Electron process. Restart the dev server (npm run dev) to pick it up.';
