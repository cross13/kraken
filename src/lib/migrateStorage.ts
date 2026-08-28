// The app was called Kraken until August 2026; every persisted renderer
// preference was keyed `kraken.*` (theme, module config, model choices, syntax
// prefs, the assistant width, the first-run flag). Copy them across to `octo.*`
// once, so a rename doesn't reset the user's settings.
//
// This module must be imported **before** any store, because Zustand stores read
// localStorage at module-evaluation time. `main.tsx` imports it first.

try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('kraken.')) continue;
    const next = `octo.${key.slice('kraken.'.length)}`;
    if (localStorage.getItem(next) === null) {
      const v = localStorage.getItem(key);
      if (v !== null) localStorage.setItem(next, v);
    }
    localStorage.removeItem(key);
  }
} catch {
  // storage disabled — nothing to migrate
}

export {};
