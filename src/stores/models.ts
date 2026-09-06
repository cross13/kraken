import { create } from 'zustand';
import type { ModelInfo, ModelDiscovery } from '../../electron/shared/types';

// Model routing, collapsed to two knobs: the global default model (Settings →
// Models, persisted in the main process) and an optional **planning model**
// used for the thinking-heavy spec steps (requirements / plan / tasks /
// audit). Execution steps (task / refine / polish / chat) always use the
// global default. Purely renderer-side: the resolved id is passed as
// `payload.model` on the Claude stream, so no backend change is needed.
//
// The list of *selectable* models is discovered, not hardcoded — see
// `models:list` in main.ts. It merges the Anthropic Models API (authoritative
// for the user's key) with the ids named in the local Claude Code config, and
// falls back to a bundled catalog. Each entry carries its `source` so the UI
// can say where it came from instead of implying availability it hasn't checked.

export type StepKey =
  | 'requirements'
  | 'plan'
  | 'tasks'
  | 'task'
  | 'refine'
  | 'polish'
  | 'audit'
  | 'chat';

export type ModelOption = ModelInfo;

/** Steps that use the planning model when one is set. */
const PLANNING_STEPS: ReadonlySet<StepKey> = new Set(['requirements', 'plan', 'tasks', 'audit']);

const KEY = 'octo.planningModel';

function load(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}
function save(m: string) {
  try {
    if (m) localStorage.setItem(KEY, m);
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Sort order: verified account models first, then local config, then catalog. */
const SOURCE_RANK: Record<ModelInfo['source'], number> = {
  api: 0,
  'cli-config': 1,
  catalog: 2,
};

function sortModels(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort(
    (a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source] || a.label.localeCompare(b.label)
  );
}

interface ModelsStore {
  /** model id for planning steps; '' inherits the global default */
  planningModel: string;
  setPlanningModel: (model: string) => void;
  /** resolved model id for a step, or undefined to inherit the global default */
  modelFor: (step: StepKey) => string | undefined;

  /** discovered models, best source first */
  available: ModelInfo[];
  discovery: ModelDiscovery | null;
  loading: boolean;
  /** re-run discovery; safe to call on mount and after the API key changes */
  refresh: (workspacePath?: string | null) => Promise<void>;
}

export const useModels = create<ModelsStore>((set, get) => ({
  planningModel: load(),
  setPlanningModel: (model) => {
    save(model);
    set({ planningModel: model });
  },
  modelFor: (step) =>
    PLANNING_STEPS.has(step) && get().planningModel ? get().planningModel : undefined,

  available: [],
  discovery: null,
  loading: false,
  refresh: async (workspacePath) => {
    set({ loading: true });
    try {
      const discovery = await window.octo.models.list(workspacePath ?? null);
      set({ discovery, available: sortModels(discovery.models) });
    } catch {
      // Discovery is best-effort — leave whatever list we already had.
    } finally {
      set({ loading: false });
    }
  },
}));
