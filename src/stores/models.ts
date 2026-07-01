import { create } from 'zustand';

// Per-step model routing — pick the best/cheapest model for each SDD step to
// optimize spend. Purely renderer-side: the resolved id is passed as
// `payload.model` on the Claude stream (CLI `--model` / API model), so no
// backend change is needed. Persisted to localStorage.

export type StepKey =
  | 'requirements'
  | 'design'
  | 'tasks'
  | 'task'
  | 'refine'
  | 'polish'
  | 'audit'
  | 'chat';

export interface ModelOption {
  id: string;
  label: string;
  tier: string;
  /** input / output $ per 1M tokens */
  price: string;
}

// Current Claude lineup (see the claude-api skill for ids + pricing).
export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', tier: 'Fast & cheap', price: '$1 / $5' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', tier: 'Balanced', price: '$3 / $15' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8', tier: 'Most capable', price: '$5 / $25' },
  { id: 'claude-fable-5', label: 'Fable 5', tier: 'Frontier', price: '$10 / $50' },
];

export const STEPS: { key: StepKey; label: string; hint: string }[] = [
  { key: 'requirements', label: 'Requirements', hint: 'Draft & refine requirements / bug analysis' },
  { key: 'design', label: 'Design', hint: 'Draft & refine the design document' },
  { key: 'tasks', label: 'Tasks', hint: 'Break the design into dependency-ordered waves' },
  { key: 'task', label: 'Task execution', hint: 'Run a task — the parallel workhorse (biggest spend)' },
  { key: 'refine', label: 'Refine', hint: 'Adjust a completed task from feedback' },
  { key: 'polish', label: 'Polish', hint: 'Final review pass when all tasks are done' },
  { key: 'audit', label: 'Audit', hint: 'spec-doctor drift check (read-only)' },
  { key: 'chat', label: 'Chat', hint: 'Freeform chat in the activity stream' },
];

const KEY = 'kraken.stepModels';

function load(): Record<string, string> {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return JSON.parse(v) as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}
function save(m: Record<string, string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}

interface ModelsStore {
  stepModels: Record<string, string>;
  setStep: (step: StepKey, model: string) => void;
  /** resolved model id for a step, or undefined to inherit the global default */
  modelFor: (step: StepKey) => string | undefined;
}

export const useModels = create<ModelsStore>((set, get) => ({
  stepModels: load(),
  setStep: (step, model) =>
    set((s) => {
      const next = { ...s.stepModels };
      if (model) next[step] = model;
      else delete next[step];
      save(next);
      return { stepModels: next };
    }),
  modelFor: (step) => get().stepModels[step] || undefined,
}));
