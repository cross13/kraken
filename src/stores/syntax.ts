import { create } from 'zustand';
import {
  BUILTIN_THEMES,
  DEFAULT_THEME_ID,
  findBuiltin,
  type SyntaxTheme,
} from '../lib/syntaxThemes';

// Configuration for file-viewer syntax highlighting: the active color theme
// (built-in or user-installed custom), which extra language grammars are
// installed, and rendering preferences. Persisted to localStorage.

export interface SyntaxConfig {
  /** active theme id — a built-in id or a custom theme name */
  theme: string;
  /** user-installed custom themes, keyed by name */
  customThemes: Record<string, SyntaxTheme>;
  /** installed extra language ids (core languages are always available) */
  languages: string[];
  lineNumbers: boolean;
  wrap: boolean;
}

const KEY = 'kraken.syntax';

const DEFAULTS: SyntaxConfig = {
  theme: DEFAULT_THEME_ID,
  customThemes: {},
  languages: [],
  lineNumbers: true,
  wrap: false,
};

function load(): SyntaxConfig {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return { ...DEFAULTS, ...(JSON.parse(v) as Partial<SyntaxConfig>) };
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}
function save(c: SyntaxConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

interface SyntaxStore {
  config: SyntaxConfig;
  setTheme: (id: string) => void;
  installTheme: (name: string, theme: SyntaxTheme) => void;
  removeTheme: (name: string) => void;
  installLanguage: (id: string) => void;
  removeLanguage: (id: string) => void;
  setLineNumbers: (b: boolean) => void;
  setWrap: (b: boolean) => void;
  /** resolved colors for the active theme (falls back to the default) */
  activeTheme: () => SyntaxTheme;
  isInstalled: (langId: string) => boolean;
}

export const useSyntax = create<SyntaxStore>((set, get) => ({
  config: load(),

  setTheme: (id) =>
    set((s) => {
      const config = { ...s.config, theme: id };
      save(config);
      return { config };
    }),

  installTheme: (name, theme) =>
    set((s) => {
      const customThemes = { ...s.config.customThemes, [name]: theme };
      const config = { ...s.config, customThemes, theme: name };
      save(config);
      return { config };
    }),

  removeTheme: (name) =>
    set((s) => {
      const customThemes = { ...s.config.customThemes };
      delete customThemes[name];
      const theme = s.config.theme === name ? DEFAULT_THEME_ID : s.config.theme;
      const config = { ...s.config, customThemes, theme };
      save(config);
      return { config };
    }),

  installLanguage: (id) =>
    set((s) => {
      if (s.config.languages.includes(id)) return s;
      const config = { ...s.config, languages: [...s.config.languages, id] };
      save(config);
      return { config };
    }),

  removeLanguage: (id) =>
    set((s) => {
      const config = { ...s.config, languages: s.config.languages.filter((l) => l !== id) };
      save(config);
      return { config };
    }),

  setLineNumbers: (b) =>
    set((s) => {
      const config = { ...s.config, lineNumbers: b };
      save(config);
      return { config };
    }),

  setWrap: (b) =>
    set((s) => {
      const config = { ...s.config, wrap: b };
      save(config);
      return { config };
    }),

  activeTheme: () => {
    const { theme, customThemes } = get().config;
    return customThemes[theme] ?? findBuiltin(theme) ?? BUILTIN_THEMES[0].theme;
  },

  isInstalled: (langId) => get().config.languages.includes(langId),
}));
