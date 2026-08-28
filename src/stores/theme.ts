import { create } from 'zustand';

// `signal` is the brand palette (Claude Design · "Paleta y Tokens"): green =
// execute & progress, violet = agent & wait, radius 0. The other three are the
// palettes from the original design (Kraken Welcome.dc.html). The active theme
// is written to `<html data-theme>`, which swaps the CSS variables defined in
// styles.css — re-skinning the entire app at once.
export type Theme = 'signal' | 'abyss' | 'bioluminescent' | 'daylight';

export const THEME_ORDER: Theme[] = ['signal', 'abyss', 'bioluminescent', 'daylight'];

export const THEME_LABEL: Record<Theme, string> = {
  signal: 'Signal',
  abyss: 'Abyss',
  bioluminescent: 'Bioluminescent',
  daylight: 'Daylight',
};

const STORAGE_KEY = 'kraken.theme';

function load(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (v && THEME_ORDER.includes(v)) return v;
  } catch {
    // ignore (storage disabled)
  }
  return 'signal';
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

interface ThemeStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cycleTheme: () => void;
}

export const useTheme = create<ThemeStore>((set, get) => {
  const initial = load();
  // Apply immediately so first paint matches the persisted choice.
  apply(initial);
  return {
    theme: initial,
    setTheme: (t) => {
      apply(t);
      set({ theme: t });
    },
    cycleTheme: () => {
      const next = THEME_ORDER[(THEME_ORDER.indexOf(get().theme) + 1) % THEME_ORDER.length];
      apply(next);
      set({ theme: next });
    },
  };
});
