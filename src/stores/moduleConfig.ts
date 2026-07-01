import { create } from 'zustand';
import { setRouterConfig, type RouterConfig } from '../lib/agentRouter';

// User-tunable configuration for the Agents / Skills / Orchestration modules.
// Purely renderer-side and persisted to localStorage (same pattern as
// `models.ts`). The routing-relevant subset is pushed into the agent router via
// `setRouterConfig`, so every run (chat, task, hook) picks it up automatically
// without touching the IPC boundary.

/** Actions the router can be configured for — used by per-action agent pins. */
export type RoutableAction =
  | 'requirements'
  | 'bugfix'
  | 'design'
  | 'tasks'
  | 'task-execute'
  | 'task-refine'
  | 'polish'
  | 'audit';

export const ROUTABLE_ACTIONS: { key: RoutableAction; label: string; hint: string }[] = [
  { key: 'requirements', label: 'Requirements', hint: 'Draft & refine feature requirements' },
  { key: 'bugfix', label: 'Bug analysis', hint: 'Analyze & triage a bug report' },
  { key: 'design', label: 'Design', hint: 'Draft & refine the design document' },
  { key: 'tasks', label: 'Task planning', hint: 'Break the design into dependency waves' },
  { key: 'task-execute', label: 'Task execution', hint: 'Run a task — the parallel workhorse' },
  { key: 'task-refine', label: 'Task refine', hint: 'Adjust a completed task from feedback' },
  { key: 'polish', label: 'Polish', hint: 'Final review pass when all tasks are done' },
  { key: 'audit', label: 'Audit', hint: 'spec-doctor drift check (read-only)' },
];

export interface ModuleConfig extends RouterConfig {
  /** action key → pinned agent name (empty = auto-route) */
  pinnedAgents: Partial<Record<RoutableAction, string>>;
}

export const DEFAULTS: ModuleConfig = {
  workspaceBonus: 0.5,
  specialistThreshold: 2,
  localFirst: true,
  pinnedAgents: {},
  skillInjection: true,
  domainSkillInjection: true,
  domainSkillThreshold: 2,
  disabledSkills: [],
};

const KEY = 'kraken.moduleConfig';

function load(): ModuleConfig {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return { ...DEFAULTS, ...(JSON.parse(v) as Partial<ModuleConfig>) };
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}
function save(c: ModuleConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

/** Push the routing-relevant slice into the pure router module. */
function syncRouter(c: ModuleConfig) {
  setRouterConfig({
    workspaceBonus: c.workspaceBonus,
    specialistThreshold: c.specialistThreshold,
    localFirst: c.localFirst,
    pinnedAgents: c.pinnedAgents as Record<string, string>,
    skillInjection: c.skillInjection,
    domainSkillInjection: c.domainSkillInjection,
    domainSkillThreshold: c.domainSkillThreshold,
    disabledSkills: c.disabledSkills,
  });
}

interface ModuleConfigStore {
  config: ModuleConfig;
  set: <K extends keyof ModuleConfig>(key: K, value: ModuleConfig[K]) => void;
  pinAgent: (action: RoutableAction, agent: string | null) => void;
  toggleSkill: (name: string, enabled: boolean) => void;
  reset: () => void;
}

// Prime the router with persisted config before any run happens.
const initial = load();
syncRouter(initial);

export const useModuleConfig = create<ModuleConfigStore>((set, get) => ({
  config: initial,
  set: (key, value) =>
    set((s) => {
      const config = { ...s.config, [key]: value };
      save(config);
      syncRouter(config);
      return { config };
    }),
  pinAgent: (action, agent) =>
    set((s) => {
      const pinnedAgents = { ...s.config.pinnedAgents };
      if (agent) pinnedAgents[action] = agent;
      else delete pinnedAgents[action];
      const config = { ...s.config, pinnedAgents };
      save(config);
      syncRouter(config);
      return { config };
    }),
  toggleSkill: (name, enabled) =>
    set((s) => {
      const set0 = new Set(s.config.disabledSkills);
      if (enabled) set0.delete(name);
      else set0.add(name);
      const config = { ...s.config, disabledSkills: [...set0] };
      save(config);
      syncRouter(config);
      return { config };
    }),
  reset: () =>
    set(() => {
      const config = { ...DEFAULTS };
      save(config);
      syncRouter(config);
      return { config };
    }),
}));
