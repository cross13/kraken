import { create } from 'zustand';
import type {
  SpecMeta,
  TicketProviderConfig,
  TicketSummary,
} from '../../electron/shared/types';
import type { GuideLang } from '../../guides/guides';

// The app is four singleton surfaces — no tab bar, no focus mode. Everything
// else renders as a drawer (assistant, explorer) or a slide-over overlay.
// `learn` is the interactive guide: it asks what you want to do and builds the
// path through the guides from the answer (`views/LearnView.tsx`).
export type Surface = 'home' | 'spec' | 'activity' | 'library' | 'learn';

/** Tabs inside the Activity surface (the single "what's running" center). */
export type ActivityTab = 'runs' | 'history' | 'specs' | 'reviews' | 'terminals' | 'graph';

/** Sections inside the consolidated Library surface. */
export type LibrarySection =
  | 'agents'
  | 'skills'
  | 'hooks'
  | 'steering'
  | 'routing'
  | 'tickets'
  | 'appearance'
  | 'settings';

/**
 * Stages of the spec flow. `define` covers bugfix analysis for bug specs, and
 * `build` covers both running the tasks and shipping — Ship is a panel inside
 * that stage, not a stage of its own.
 */
export type SpecStage = 'define' | 'plan' | 'build';

/** Right slide-over content — detail views that used to be center tabs. */
export type Overlay =
  | { kind: 'file'; path: string }
  | { kind: 'agent'; path: string }
  | { kind: 'skill'; path: string }
  | { kind: 'run'; runId: string }
  | { kind: 'questions'; specId: string }
  | { kind: 'hook'; hookId?: string }
  // The ticket itself, carried rather than looked up: the row the user clicked
  // already holds everything the header needs, so the panel opens filled in and
  // fills the rest as the read lands.
  | { kind: 'ticket'; ticket: TicketSummary; provider?: TicketProviderConfig }
  | { kind: 'repo' }
  // A how-to from `guides/` — the same content the public site renders.
  | { kind: 'guide'; id: string };

/** A live PTY session, hosted app-wide so the process survives navigation. */
export interface TerminalSession {
  id: string;
  title: string;
  profile: 'shell' | 'claude';
}

// Panel sizing — persisted so the user's layout survives reloads.
const ASSISTANT_MIN = 300;
const ASSISTANT_MAX = 760;

function clampAssistant(n: number) {
  return Math.round(Math.max(ASSISTANT_MIN, Math.min(ASSISTANT_MAX, n)));
}

function loadNum(key: string, fallback: number) {
  try {
    const v = localStorage.getItem(key);
    return v ? Number(v) || fallback : fallback;
  } catch {
    return fallback;
  }
}
function saveNum(key: string, n: number) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    // ignore (e.g. storage disabled)
  }
}

/** Guides follow the system language until the reader picks one. */
function loadGuideLang(): GuideLang {
  try {
    const v = localStorage.getItem('octo.guidesLang');
    if (v === 'en' || v === 'es') return v;
  } catch {
    // ignore (e.g. storage disabled)
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function loadBool(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}
function saveBool(key: string, b: boolean) {
  try {
    localStorage.setItem(key, b ? '1' : '0');
  } catch {
    // ignore (e.g. storage disabled)
  }
}

const STAGE_FOR_PHASE: Record<SpecMeta['phase'], SpecStage> = {
  requirements: 'define',
  plan: 'plan',
  build: 'build',
  done: 'build',
};

/** The stage a spec should open on, given its phase. */
export function stageForPhase(phase: SpecMeta['phase']): SpecStage {
  return STAGE_FOR_PHASE[phase];
}

interface UiStore {
  surface: Surface;
  setSurface: (s: Surface) => void;

  // ---- Spec surface (one continuous flow per spec) ----
  activeSpecId: string | null;
  specStage: SpecStage;
  openSpec: (specId: string, stage?: SpecStage) => void;
  /** Leave the spec surface with no spec selected (after a delete or a reset). */
  closeSpec: () => void;
  setSpecStage: (stage: SpecStage) => void;

  // ---- Activity surface ----
  activityTab: ActivityTab;
  openActivity: (tab?: ActivityTab) => void;

  // ---- Library surface ----
  librarySection: LibrarySection;
  openLibrary: (section?: LibrarySection) => void;

  // ---- Assistant drawer (chat) ----
  assistantOpen: boolean;
  toggleAssistant: () => void;
  setAssistantOpen: (b: boolean) => void;
  assistantWidth: number;
  setAssistantWidth: (n: number) => void;

  // ---- Explorer drawer (file tree) ----
  explorerOpen: boolean;
  toggleExplorer: () => void;

  /**
   * The spec flow's **briefing** aside — who runs this step and how. On by
   * default: the whole point is that you don't have to go looking for it.
   */
  specAsideOpen: boolean;
  toggleSpecAside: () => void;

  /**
   * **Quick Start** — the guided first hour. A full-window mode rather than a
   * fifth surface: the four are singletons you live in, and this is one you
   * finish and leave. Auto-opens once on a brand-new install (see `App.tsx`).
   */
  quickStartOpen: boolean;
  setQuickStart: (b: boolean) => void;

  /**
   * **Zen** — the full-window reading mode for the document on screen
   * (`views/ZenReader`). Not an overlay: it takes the whole viewport rather
   * than sliding in beside the surface, so it lives on its own flag.
   */
  zenOpen: boolean;
  setZen: (b: boolean) => void;
  toggleZen: () => void;

  // ---- Slide-over overlay (file / agent / skill / run / questions / hook / repo) ----
  overlay: Overlay | null;
  openOverlay: (o: Overlay) => void;
  closeOverlay: () => void;

  /** Language the guides render in — the only bilingual content in the app. */
  guideLang: GuideLang;
  setGuideLang: (l: GuideLang) => void;

  // ---- Terminals (rendered in Activity, hosted app-wide) ----
  terminals: TerminalSession[];
  activeTerminalId: string | null;
  addTerminal: (profile: 'shell' | 'claude') => void;
  closeTerminal: (id: string) => void;
  setActiveTerminal: (id: string) => void;

  /** Bumped when something (⌘K "New spec") wants Home's composer focused. */
  composerNonce: number;
  /** Text to place in Home's composer on the next focus (Learn's examples). */
  composerDraft: string | null;
  focusComposer: (draft?: string) => void;
  takeComposerDraft: () => string | null;
}

export const useUi = create<UiStore>((set, get) => ({
  surface: 'home',
  // Zen belongs to the document on screen: navigating away closes it.
  setSurface: (s) => set({ surface: s, zenOpen: s === 'spec' && get().zenOpen }),

  activeSpecId: null,
  specStage: 'define',
  openSpec: (specId, stage) =>
    set((s) => ({
      surface: 'spec',
      activeSpecId: specId,
      specStage: stage ?? (specId === s.activeSpecId ? s.specStage : 'define'),
    })),
  closeSpec: () =>
    set({ surface: 'home', activeSpecId: null, specStage: 'define', zenOpen: false }),
  setSpecStage: (stage) => set({ specStage: stage, zenOpen: false }),

  activityTab: 'runs',
  openActivity: (tab) =>
    set((s) => ({ surface: 'activity', activityTab: tab ?? s.activityTab })),

  librarySection: 'agents',
  openLibrary: (section) =>
    set((s) => ({ surface: 'library', librarySection: section ?? s.librarySection })),

  assistantOpen: false,
  toggleAssistant: () => set((s) => ({ assistantOpen: !s.assistantOpen })),
  setAssistantOpen: (b) => set({ assistantOpen: b }),
  assistantWidth: clampAssistant(loadNum('octo.chatWidth', 420)),
  setAssistantWidth: (n) => {
    const w = clampAssistant(n);
    saveNum('octo.chatWidth', w);
    set({ assistantWidth: w });
  },

  explorerOpen: false,
  toggleExplorer: () => set((s) => ({ explorerOpen: !s.explorerOpen })),

  quickStartOpen: false,
  setQuickStart: (b) => set({ quickStartOpen: b }),

  specAsideOpen: loadBool('octo.specAside', true),
  toggleSpecAside: () =>
    set((s) => {
      const next = !s.specAsideOpen;
      saveBool('octo.specAside', next);
      return { specAsideOpen: next };
    }),

  zenOpen: false,
  setZen: (b) => set({ zenOpen: b }),
  toggleZen: () => set((s) => ({ zenOpen: !s.zenOpen })),

  overlay: null,
  openOverlay: (o) => set({ overlay: o }),
  closeOverlay: () => set({ overlay: null }),

  guideLang: loadGuideLang(),
  setGuideLang: (l) => {
    try {
      localStorage.setItem('octo.guidesLang', l);
    } catch {
      // ignore (e.g. storage disabled)
    }
    set({ guideLang: l });
  },

  terminals: [],
  activeTerminalId: null,
  addTerminal: (profile) => {
    const n = get().terminals.filter((t) => t.profile === profile).length + 1;
    const id = `term-${crypto.randomUUID()}`;
    set((s) => ({
      surface: 'activity',
      activityTab: 'terminals',
      terminals: [
        ...s.terminals,
        { id, profile, title: profile === 'claude' ? `Claude ${n}` : `Terminal ${n}` },
      ],
      activeTerminalId: id,
    }));
  },
  closeTerminal: (id) =>
    set((s) => {
      const terminals = s.terminals.filter((t) => t.id !== id);
      const activeTerminalId =
        s.activeTerminalId === id
          ? (terminals[terminals.length - 1]?.id ?? null)
          : s.activeTerminalId;
      return { terminals, activeTerminalId };
    }),
  setActiveTerminal: (id) => set({ activeTerminalId: id }),

  composerNonce: 0,
  composerDraft: null,
  focusComposer: (draft) =>
    set((s) => ({
      surface: 'home',
      composerNonce: s.composerNonce + 1,
      composerDraft: draft ?? null,
    })),
  takeComposerDraft: () => {
    const d = get().composerDraft;
    if (d !== null) set({ composerDraft: null });
    return d;
  },
}));
