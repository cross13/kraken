import { create } from 'zustand';
import type {
  SpecMeta,
  TicketProviderConfig,
  TicketSummary,
} from '../../electron/shared/types';
import type { GuideLang } from '../../guides/guides';

// The shell is an IDE: an activity bar, a side bar holding one **side view**
// (explorer / changes / specs), and an editor area. The editor area shows either
// the active **surface** — the five singleton pages below — or an **editor tab**
// (a file or a file's diff against HEAD). Surfaces and tabs share one tab strip:
// the surface is its pinned first tab. Detail views that are not files still
// open in the slide-over overlay.
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

/** Tabs of the panel under the editor area. */
export type PanelTab = 'runs' | 'terminals' | 'history';

/** What the side bar is showing. */
export type SideView = 'explorer' | 'search' | 'changes' | 'specs';

/**
 * A tab in the editor area. `file` holds an absolute path (it can live outside
 * the workspace — a PR review worktree); `diff` holds a repository-relative one,
 * because that is what git is asked about.
 */
export interface EditorTab {
  id: string;
  kind: 'file' | 'diff';
  path: string;
  /** a `file` tab opened at a line (a search hit); `nonce` re-triggers the same line */
  line?: number;
  nonce?: number;
}

export const tabId = (kind: EditorTab['kind'], path: string) => `${kind}:${path}`;

/** A live PTY session, hosted app-wide so the process survives navigation. */
export interface TerminalSession {
  id: string;
  title: string;
  profile: 'shell' | 'claude';
}

// Panel sizing — persisted so the user's layout survives reloads.
const ASSISTANT_MIN = 300;
const ASSISTANT_MAX = 760;

const SIDE_MIN = 200;
const SIDE_MAX = 520;
function clampSide(n: number) {
  return Math.round(Math.max(SIDE_MIN, Math.min(SIDE_MAX, n)));
}
// The panel's ceiling follows the window: at most ~70% of its height, so a
// height saved on a tall display cannot bury the editor on a laptop.
function clampPanel(n: number) {
  const max = Math.max(200, Math.round((typeof window === 'undefined' ? 900 : window.innerHeight) * 0.7));
  return Math.round(Math.max(140, Math.min(max, n)));
}
function loadSideView(): SideView {
  try {
    const v = localStorage.getItem('octo.sideView');
    if (v === 'explorer' || v === 'search' || v === 'changes' || v === 'specs') return v;
  } catch {
    // ignore (e.g. storage disabled)
  }
  return 'explorer';
}

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

  // ---- Side bar (explorer / changes / specs) ----
  sideView: SideView;
  sideOpen: boolean;
  sideWidth: number;
  /** Show a side view; asking for the one already on screen closes the bar. */
  showSide: (view: SideView) => void;
  setSideOpen: (b: boolean) => void;
  setSideWidth: (n: number) => void;
  /** ⌘⇧E — kept under its old name; it now toggles the Explorer side view. */
  toggleExplorer: () => void;

  // ---- Editor tabs (files and diffs, beside the surface) ----
  tabs: EditorTab[];
  /** `null` = the surface is on screen. */
  activeTabId: string | null;
  openFile: (path: string, line?: number) => void;
  openDiff: (relPath: string) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string | null) => void;

  // ---- Bottom panel (runs · terminals · history, under the editor area) ----
  panelOpen: boolean;
  panelTab: PanelTab;
  /** persisted; clamped so the panel can neither vanish nor swallow the editor */
  panelHeight: number;
  setPanelHeight: (n: number) => void;
  togglePanel: () => void;
  /** Open the panel on a tab (it stays open if it already was). */
  openPanel: (tab: PanelTab) => void;
  /** Bumped when the tab strip asks a spec stage to show its *document*. */
  specDocNonce: number;
  showSpecDoc: (stage: SpecStage) => void;

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

  // ---- Slide-over overlay (agent / skill / run / questions / hook / repo). A
  // `file` overlay is redirected to an editor tab. ----
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
  setSurface: (s) =>
    set({ surface: s, activeTabId: null, zenOpen: s === 'spec' && get().zenOpen }),

  activeSpecId: null,
  specStage: 'define',
  openSpec: (specId, stage) =>
    set((s) => ({
      surface: 'spec',
      activeTabId: null,
      activeSpecId: specId,
      specStage: stage ?? (specId === s.activeSpecId ? s.specStage : 'define'),
    })),
  closeSpec: () =>
    set({
      surface: 'home',
      activeTabId: null,
      activeSpecId: null,
      specStage: 'define',
      zenOpen: false,
    }),
  setSpecStage: (stage) => set({ specStage: stage, zenOpen: false }),

  activityTab: 'runs',
  openActivity: (tab) => {
    // Terminals moved under the editor area. Every older caller (⌘K, guides,
    // "Open a terminal") still asks Activity for them; send it to the panel.
    if (tab === 'terminals') return get().openPanel('terminals');
    set((s) => ({
      surface: 'activity',
      activeTabId: null,
      activityTab: tab ?? (s.activityTab === 'terminals' ? 'runs' : s.activityTab),
    }));
  },

  librarySection: 'agents',
  openLibrary: (section) =>
    set((s) => ({
      surface: 'library',
      activeTabId: null,
      librarySection: section ?? s.librarySection,
    })),

  assistantOpen: false,
  toggleAssistant: () => set((s) => ({ assistantOpen: !s.assistantOpen })),
  setAssistantOpen: (b) => set({ assistantOpen: b }),
  assistantWidth: clampAssistant(loadNum('octo.chatWidth', 420)),
  setAssistantWidth: (n) => {
    const w = clampAssistant(n);
    saveNum('octo.chatWidth', w);
    set({ assistantWidth: w });
  },

  sideView: loadSideView(),
  sideOpen: loadBool('octo.sideOpen', true),
  sideWidth: clampSide(loadNum('octo.sideWidth', 280)),
  showSide: (view) =>
    set((s) => {
      const sideOpen = s.sideView === view ? !s.sideOpen : true;
      saveBool('octo.sideOpen', sideOpen);
      try {
        localStorage.setItem('octo.sideView', view);
      } catch {
        // ignore (e.g. storage disabled)
      }
      return { sideView: view, sideOpen };
    }),
  setSideOpen: (b) => {
    saveBool('octo.sideOpen', b);
    set({ sideOpen: b });
  },
  setSideWidth: (n) => {
    const w = clampSide(n);
    saveNum('octo.sideWidth', w);
    set({ sideWidth: w });
  },
  toggleExplorer: () => get().showSide('explorer'),

  tabs: [],
  activeTabId: null,
  openFile: (path, line) =>
    set((s) => {
      const id = tabId('file', path);
      const at = line ? { line, nonce: Date.now() } : {};
      const tabs = s.tabs.some((t) => t.id === id)
        ? s.tabs.map((t) => (t.id === id && line ? { ...t, ...at } : t))
        : [...s.tabs, { id, kind: 'file' as const, path, ...at }];
      return { tabs, activeTabId: id, zenOpen: false };
    }),
  openDiff: (relPath) =>
    set((s) => {
      const id = tabId('diff', relPath);
      const tabs = s.tabs.some((t) => t.id === id)
        ? s.tabs
        : [...s.tabs, { id, kind: 'diff' as const, path: relPath }];
      return { tabs, activeTabId: id, zenOpen: false };
    }),
  closeTab: (id) =>
    set((s) => {
      const i = s.tabs.findIndex((t) => t.id === id);
      if (i === -1) return {};
      const tabs = s.tabs.filter((t) => t.id !== id);
      // Closing the tab on screen lands on its neighbour, then on the surface.
      const activeTabId =
        s.activeTabId === id ? (tabs[i]?.id ?? tabs[i - 1]?.id ?? null) : s.activeTabId;
      return { tabs, activeTabId };
    }),
  closeAllTabs: () => set({ tabs: [], activeTabId: null }),
  setActiveTab: (id) => set({ activeTabId: id, zenOpen: false }),

  panelOpen: false,
  panelTab: 'runs',
  panelHeight: clampPanel(loadNum('octo.panelHeight', 300)),
  setPanelHeight: (n) => {
    const h = clampPanel(n);
    saveNum('octo.panelHeight', h);
    set({ panelHeight: h });
  },
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  openPanel: (tab) => set({ panelOpen: true, panelTab: tab }),
  specDocNonce: 0,
  showSpecDoc: (stage) =>
    set((s) => ({
      surface: 'spec',
      activeTabId: null,
      specStage: stage,
      zenOpen: false,
      specDocNonce: s.specDocNonce + 1,
    })),

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
  // A file is a tab now, not a slide-over. Every older call site still says
  // `openOverlay({kind:'file'})`; routing it here moves them all at once.
  openOverlay: (o) => {
    if (o.kind === 'file') {
      get().openFile(o.path);
      set({ overlay: null });
      return;
    }
    set({ overlay: o });
  },
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
      // A new terminal opens where terminals live — the panel — without
      // taking you off the file or spec you were on.
      panelOpen: true,
      panelTab: 'terminals' as const,
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
      activeTabId: null,
      composerNonce: s.composerNonce + 1,
      composerDraft: draft ?? null,
    })),
  takeComposerDraft: () => {
    const d = get().composerDraft;
    if (d !== null) set({ composerDraft: null });
    return d;
  },
}));
