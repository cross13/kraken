import { create } from 'zustand';

export type ActivityTab =
  | 'explorer'
  | 'specs'
  | 'skills'
  | 'agents'
  | 'steering'
  | 'hooks'
  | 'source-control'
  | 'orchestrator'
  | 'graph'
  | 'tasks'
  | 'terminal'
  | 'history'
  | 'settings';

// Panel sizing — persisted so the user's layout survives reloads.
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 560;
const CHAT_MIN = 300;
const CHAT_MAX = 760;

function clampSidebar(n: number) {
  return Math.round(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, n)));
}
function clampChat(n: number) {
  return Math.round(Math.max(CHAT_MIN, Math.min(CHAT_MAX, n)));
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

export interface OpenTab {
  id: string;
  title: string;
  kind:
    | 'spec'
    | 'summary'
    | 'source-control'
    | 'questions'
    | 'file'
    | 'agent'
    | 'skill'
    | 'agents-studio'
    | 'skills-studio'
    | 'router-studio'
    | 'hooks-studio'
    | 'syntax-studio'
    | 'welcome'
    | 'settings'
    | 'run'
    | 'hook'
    | 'graph'
    | 'terminal';
  // for hook tabs (hook id, or 'new' to create):
  hookId?: string;
  // for spec tabs:
  specId?: string;
  specFile?: 'requirements' | 'design' | 'tasks' | 'bugfix';
  // generic file path:
  filePath?: string;
  // for run tabs:
  runId?: string;
  // for terminal tabs — the tab id doubles as the PTY id:
  termProfile?: 'shell' | 'claude';
}

interface UiStore {
  activity: ActivityTab;
  setActivity: (t: ActivityTab) => void;

  sidebarOpen: boolean;
  toggleSidebar: () => void;
  sidebarWidth: number;
  setSidebarWidth: (n: number) => void;

  chatOpen: boolean;
  toggleChat: () => void;
  chatWidth: number;
  setChatWidth: (n: number) => void;

  // Focus mode — collapses the spec rail + activity stream so a step fills the
  // screen. Auto-engages when a spec tab is active; toggled from the chrome.
  focusMode: boolean;
  toggleFocus: () => void;
  setFocus: (b: boolean) => void;

  // The most recently active spec — lets spec-less surfaces (e.g. the Source
  // Control tab) still resolve "the spec you're working on" for their defaults.
  lastSpecId: string | null;

  tabs: OpenTab[];
  activeTabId: string | null;
  openTab: (tab: OpenTab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

export const useUi = create<UiStore>((set, get) => ({
  activity: 'specs',
  setActivity: (t) => set({ activity: t, sidebarOpen: true }),

  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  sidebarWidth: loadNum('kraken.sidebarWidth', 288),
  setSidebarWidth: (n) => {
    const w = clampSidebar(n);
    saveNum('kraken.sidebarWidth', w);
    set({ sidebarWidth: w });
  },

  chatOpen: true,
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  chatWidth: loadNum('kraken.chatWidth', 420),
  setChatWidth: (n) => {
    const w = clampChat(n);
    saveNum('kraken.chatWidth', w);
    set({ chatWidth: w });
  },

  focusMode: false,
  toggleFocus: () => set((s) => ({ focusMode: !s.focusMode })),
  setFocus: (b) => set({ focusMode: b }),

  lastSpecId: null,

  tabs: [{ id: 'welcome', title: 'Welcome', kind: 'welcome' }],
  activeTabId: 'welcome',

  openTab: (tab) => {
    const existing = get().tabs.find((t) => t.id === tab.id);
    // A spec step takes over the screen; anything else shows the full shell.
    const focusMode = tab.kind === 'spec';
    const lastSpecId = tab.kind === 'spec' && tab.specId ? tab.specId : get().lastSpecId;
    if (existing) {
      set({ activeTabId: tab.id, focusMode, lastSpecId });
      return;
    }
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id, focusMode, lastSpecId }));
  },

  closeTab: (id) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeTabId = s.activeTabId;
      if (activeTabId === id) {
        activeTabId = tabs.length ? tabs[tabs.length - 1].id : null;
      }
      const active = tabs.find((t) => t.id === activeTabId);
      return { tabs, activeTabId, focusMode: active?.kind === 'spec' };
    });
  },

  setActiveTab: (id) =>
    set((s) => {
      const tab = s.tabs.find((t) => t.id === id);
      return {
        activeTabId: id,
        focusMode: tab?.kind === 'spec',
        lastSpecId: tab?.kind === 'spec' && tab.specId ? tab.specId : s.lastSpecId,
      };
    }),
}));
