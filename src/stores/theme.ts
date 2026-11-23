import { create } from 'zustand';

// `signal` is the brand palette (Claude Design · "Paleta y Tokens"): green =
// execute & progress, violet = agent & wait, radius 0. The other three are the
// palettes from the original design (Octo Welcome.dc.html). The active theme
// is written to `<html data-theme>`, which swaps the CSS variables defined in
// styles.css — re-skinning the entire app at once.
//
// `brasa` / `brasa-dark` are the IDE-shell palettes (Claude Design · "Brasa"):
// paper + ink with one orange accent for what waits on you, and its charcoal
// counterpart. They are the default since the IDE-shell refactor.
export type Theme = 'brasa' | 'brasa-dark' | 'signal' | 'abyss' | 'bioluminescent' | 'daylight';

export const THEME_ORDER: Theme[] = [
  'brasa',
  'brasa-dark',
  'signal',
  'abyss',
  'bioluminescent',
  'daylight',
];

export const THEME_LABEL: Record<Theme, string> = {
  brasa: 'Brasa',
  'brasa-dark': 'Brasa dark',
  signal: 'Signal',
  abyss: 'Abyss',
  bioluminescent: 'Bioluminescent',
  daylight: 'Daylight',
};

const STORAGE_KEY = 'octo.theme';

// `apply()` persists on every boot, so every existing install has a stored
// theme and would never see a new default. The IDE-shell refactor moves each
// install to Brasa exactly once; a choice made after that sticks.
const MIGRATED_KEY = 'octo.theme.brasa';

function load(): Theme {
  try {
    if (!localStorage.getItem(MIGRATED_KEY)) {
      localStorage.setItem(MIGRATED_KEY, '1');
      return 'brasa';
    }
    const v = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (v && THEME_ORDER.includes(v)) return v;
  } catch {
    // ignore (storage disabled)
  }
  return 'brasa';
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
