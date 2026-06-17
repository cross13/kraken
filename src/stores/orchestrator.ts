import { create } from 'zustand';
import type { ActiveRun, FinishedRun, RunPhaseStatus } from '../../electron/shared/types';

const LOG_CAP = 50;

/** Source/kinds that count toward wave concurrency (the actual orchestrated work). */
function isOrchestrated(run: ActiveRun): boolean {
  return run.kind === 'task' || run.kind === 'refine' || run.kind === 'polish';
}

/**
 * Global registry of every Claude run in flight — chat, spec drafting, audits,
 * and wave task execution all register here, so the Orchestrator dashboard can
 * show the full picture. Decoupled from the chat store (which keeps a single
 * `busy`) so several specialized agents can run in parallel, each keyed by its
 * own requestId.
 */
interface OrchestratorStore {
  runs: Record<string, ActiveRun>;
  /** most-recent-first ring buffer of finished runs */
  log: FinishedRun[];
  maxConcurrency: number;

  setMaxConcurrency: (n: number) => void;
  startRun: (run: ActiveRun) => void;
  updateRun: (requestId: string, patch: Partial<ActiveRun>) => void;
  /** remove from `runs` without logging (rarely needed) */
  removeRun: (requestId: string) => void;
  /** move a run out of `runs` and into the activity log */
  finishRun: (requestId: string, status: 'done' | 'error' | 'cancelled') => void;
  reset: () => void;
  clearLog: () => void;

  runningCount: () => number;
  /** count of runs that throttle wave scheduling (task/refine/polish only) */
  taskRunningCount: () => number;
  activeForTask: (taskId: string) => ActiveRun | undefined;
}

export const useOrchestrator = create<OrchestratorStore>((set, get) => ({
  runs: {},
  log: [],
  maxConcurrency: 2,

  setMaxConcurrency: (n) => set({ maxConcurrency: Math.max(1, Math.min(8, Math.floor(n))) }),

  startRun: (run) =>
    set((s) => ({
      runs: { ...s.runs, [run.requestId]: { startedAt: Date.now(), ...run } },
    })),

  updateRun: (requestId, patch) =>
    set((s) => {
      const existing = s.runs[requestId];
      if (!existing) return s;
      return { runs: { ...s.runs, [requestId]: { ...existing, ...patch } } };
    }),

  removeRun: (requestId) =>
    set((s) => {
      const { [requestId]: _drop, ...rest } = s.runs;
      return { runs: rest };
    }),

  finishRun: (requestId, status) =>
    set((s) => {
      const run = s.runs[requestId];
      if (!run) return s;
      const { [requestId]: _drop, ...rest } = s.runs;
      const entry: FinishedRun = {
        requestId: run.requestId,
        kind: run.kind,
        agent: run.agent,
        skill: run.skill,
        source: run.source,
        title: run.title,
        specId: run.specId,
        taskId: run.taskId,
        wave: run.wave,
        status,
        startedAt: run.startedAt,
        endedAt: Date.now(),
        model: run.model,
        routeReason: run.routeReason,
        agentScope: run.agentScope,
        skillScope: run.skillScope,
        dependsOn: run.dependsOn,
      };
      return { runs: rest, log: [entry, ...s.log].slice(0, LOG_CAP) };
    }),

  reset: () => set({ runs: {} }),
  clearLog: () => set({ log: [] }),

  runningCount: () =>
    Object.values(get().runs).filter((r) => r.status === 'queued' || r.status === 'running')
      .length,

  taskRunningCount: () =>
    Object.values(get().runs).filter(
      (r) => isOrchestrated(r) && (r.status === 'queued' || r.status === 'running')
    ).length,

  activeForTask: (taskId) =>
    Object.values(get().runs).find(
      (r) => r.taskId === taskId && (r.status === 'queued' || r.status === 'running')
    ),
}));

export type { RunPhaseStatus };
export { isOrchestrated };
