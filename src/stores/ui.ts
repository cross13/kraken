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
    | 'questions'
    | 'file'
    | 'agent'
    | 'skill'
    | 'welcome'
    | 'settings'
    | 'run'
    | 'hook'
    | 'graph';
  // for hook tabs (hook id, or 'new' to create):
  hookId?: string;
  // for spec tabs:
  specId?: string;
  specFile?: 'requirements' | 'design' | 'tasks' | 'bugfix';
  // generic file path:
  filePath?: string;
  // for run tabs:
  runId?: string;
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

  tabs: [{ id: 'welcome', title: 'Welcome', kind: 'welcome' }],
  activeTabId: 'welcome',

  openTab: (tab) => {
    const existing = get().tabs.find((t) => t.id === tab.id);
    if (existing) {
      set({ activeTabId: tab.id });
      return;
    }
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
  },

  closeTab: (id) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeTabId = s.activeTabId;
      if (activeTabId === id) {
        activeTabId = tabs.length ? tabs[tabs.length - 1].id : null;
      }
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),
}));
