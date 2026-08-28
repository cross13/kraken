// Pure data layer for the Agent Graph: merge live orchestrator runs with the
// persisted run history into a per-task picture, and compute verification
// warnings (did the orchestrator assign a real, installed agent/skill, and did
// the model we asked for match what the backend reported?).

import type {
  ActiveRun,
  FinishedRun,
  RunRow,
  AgentMeta,
  SkillMeta,
  RunKind,
} from '../../electron/shared/types';
import { resolveAgent, resolveSkill } from './verifyLibrary';

export type NodeStatus = 'running' | 'queued' | 'done' | 'error' | 'cancelled' | 'pending';

/** Merged view of the most relevant run for a task (live wins over history). */
export interface RunInfo {
  /** request/run id — same value live and in the DB */
  runId?: string;
  agent?: string | null;
  skill?: string | null;
  routeReason?: string | null;
  agentScope?: 'workspace' | 'global' | null;
  skillScope?: 'workspace' | 'global' | null;
  model?: string | null;
  resolvedModel?: string | null;
  status: NodeStatus;
  /** true when sourced from the in-flight orchestrator store */
  live: boolean;
  startedAt?: number;
  /** what kind of work this run is (task/spec/hook/audit/chat/…) */
  kind?: RunKind | null;
  /** human one-liner of what the run is doing (live runs only) */
  title?: string | null;
  /** raw source tag, e.g. "hook:<id>:<trigger>" — used to classify old rows */
  source?: string | null;
}

// ---------- Run grouping (hooks vs spec-flow vs chat …) ----------

/**
 * Coarse display group a run belongs to. This is what lets the graph answer
 * "which nodes are hooks and which are spec-flow generation?": task execution
 * (the wave lanes) is distinct from spec drafting, hooks, audits, and chat.
 */
export type RunGroup = 'execution' | 'spec' | 'hook' | 'audit' | 'chat';

/** RunKind → display group. Task/refine/polish are all "execution". */
export const KIND_TO_GROUP: Record<RunKind, RunGroup> = {
  task: 'execution',
  refine: 'execution',
  polish: 'execution',
  spec: 'spec',
  hook: 'hook',
  audit: 'audit',
  chat: 'chat',
};

export interface GroupMeta {
  label: string;
  /** one-line explainer of what runs in this group */
  hint: string;
  /** accent colour for lane headers / node borders */
  color: string;
}

export const GROUP_META: Record<RunGroup, GroupMeta> = {
  execution: { label: 'Task execution', hint: 'Wave tasks from tasks.md', color: '#38bdf8' },
  spec: { label: 'Spec generation', hint: 'Drafting requirements / plan / tasks', color: '#a78bfa' },
  hook: { label: 'Hooks', hint: 'Event-triggered agent runs', color: '#fbbf24' },
  audit: { label: 'Audit', hint: 'Drift detection (spec-doctor)', color: '#2dd4bf' },
  chat: { label: 'Chat', hint: 'Interactive chat runs', color: '#94a3b8' },
};

/** The groups that live in the "loose" lanes (everything except wave tasks). */
export const LOOSE_GROUPS: RunGroup[] = ['spec', 'hook', 'audit', 'chat'];

/**
 * Derive a run's kind. Prefer the explicit column; fall back to the `source`
 * tag so rows written before the kind was persisted (notably hook runs, whose
 * source is `hook:<id>:<trigger>`) still classify correctly.
 */
export function deriveKind(
  kind: RunKind | string | null | undefined,
  source: string | null | undefined
): RunKind | null {
  if (kind) return kind as RunKind;
  if (source?.startsWith('hook:')) return 'hook';
  return null;
}

/** Classify a run into a display group; anything unrecognised falls to chat. */
export function runGroup(kind?: RunKind | string | null): RunGroup {
  if (kind && (kind as RunKind) in KIND_TO_GROUP) return KIND_TO_GROUP[kind as RunKind];
  return 'chat';
}

function statusFromRow(s: RunRow['status']): NodeStatus {
  return s;
}

function infoFromActive(r: ActiveRun): RunInfo {
  return {
    runId: r.requestId,
    agent: r.agent,
    skill: r.skill,
    routeReason: r.routeReason ?? null,
    agentScope: r.agentScope ?? null,
    skillScope: r.skillScope ?? null,
    model: r.model ?? null,
    status: r.status === 'queued' ? 'queued' : 'running',
    live: true,
    startedAt: r.startedAt,
    kind: deriveKind(r.kind, r.source),
    title: r.title ?? null,
    source: r.source ?? null,
  };
}

function infoFromFinished(r: FinishedRun): RunInfo {
  return {
    runId: r.requestId,
    agent: r.agent,
    skill: r.skill,
    routeReason: r.routeReason ?? null,
    agentScope: r.agentScope ?? null,
    skillScope: r.skillScope ?? null,
    model: r.model ?? null,
    status: r.status,
    live: true,
    startedAt: r.startedAt,
    kind: deriveKind(r.kind, r.source),
    title: r.title ?? null,
    source: r.source ?? null,
  };
}

function infoFromRow(r: RunRow): RunInfo {
  return {
    runId: r.id,
    agent: r.agent,
    skill: r.skill,
    routeReason: r.route_reason,
    agentScope: (r.agent_scope as 'workspace' | 'global' | null) ?? null,
    skillScope: (r.skill_scope as 'workspace' | 'global' | null) ?? null,
    model: r.model,
    resolvedModel: r.resolved_model,
    status: statusFromRow(r.status),
    live: false,
    startedAt: r.started_at ? Date.parse(r.started_at) : undefined,
    kind: deriveKind(r.kind, r.source),
    title: null,
    source: r.source ?? null,
  };
}

export interface RunIndex {
  /** best (most relevant) run per task id */
  byTask: Map<string, RunInfo>;
  /** spec-level runs not tied to a task (chat/spec/audit/hook) */
  loose: RunInfo[];
}

/**
 * Build the per-task run index for one spec. Live running/queued runs always
 * win; otherwise the most recent finished run (live log or DB history) is used.
 */
export function indexRuns(
  specId: string | null,
  live: ActiveRun[],
  log: FinishedRun[],
  history: RunRow[],
  includeHistory: boolean
): RunIndex {
  const byTask = new Map<string, RunInfo>();
  const loose: RunInfo[] = [];
  const looseSeen = new Set<string>();

  const consider = (taskId: string | undefined | null, info: RunInfo, sortKey: number) => {
    if (taskId) {
      const cur = byTask.get(taskId);
      // A genuinely in-flight (in-memory) run beats everything; otherwise prefer
      // the most recent. Note: a *persisted* row can still read 'running' if it
      // was orphaned by a crash — that is NOT live, so it must compete on recency
      // only, never trump a newer finished run (which would freeze the spinner).
      const curLive = !!cur?.live && (cur.status === 'running' || cur.status === 'queued');
      const newLive = info.live && (info.status === 'running' || info.status === 'queued');
      if (!cur || (newLive && !curLive) || (newLive === curLive && sortKey >= (cur.startedAt ?? 0))) {
        byTask.set(taskId, info);
      }
    } else {
      if (info.runId && looseSeen.has(info.runId)) return;
      if (info.runId) looseSeen.add(info.runId);
      loose.push(info);
    }
  };

  // 1. Live in-flight runs for this spec.
  for (const r of live) {
    if (specId && r.specId !== specId) continue;
    consider(r.taskId, infoFromActive(r), r.startedAt ?? Number.MAX_SAFE_INTEGER);
  }
  // 2. Live finished-run log (this session).
  for (const r of log) {
    if (specId && r.specId !== specId) continue;
    consider(r.taskId, infoFromFinished(r), r.startedAt ?? 0);
  }
  // 3. Persisted history (across sessions).
  if (includeHistory) {
    for (const r of history) {
      if (specId && r.spec_id !== specId) continue;
      consider(r.task_id, infoFromRow(r), r.started_at ? Date.parse(r.started_at) : 0);
    }
  }

  return { byTask, loose };
}

export interface Warning {
  level: 'warn' | 'info';
  message: string;
}

/**
 * Verification: does the run's chosen agent/skill resolve to an installed file,
 * and does the model line up? Surfaced so the user can fix agent/skill files.
 */
export function verifyRun(
  info: RunInfo | undefined,
  agents: AgentMeta[],
  skills: SkillMeta[]
): Warning[] {
  if (!info) return [];
  const out: Warning[] = [];

  if (!info.agent) {
    out.push({
      level: 'warn',
      message: 'No agent assigned (generic Claude) — no installed agent matched this work.',
    });
  } else {
    const a = resolveAgent(info.agent, agents);
    if (!a.installed) {
      out.push({
        level: 'warn',
        message: `Agent "${info.agent}" is not installed in .claude/agents — it won't load.`,
      });
    }
  }

  if (info.routeReason === 'generic') {
    out.push({ level: 'warn', message: 'Routing fell back to generic — consider adding a matching agent.' });
  }

  if (info.skill) {
    const s = resolveSkill(info.skill, skills);
    if (!s.installed) {
      out.push({ level: 'info', message: `Skill "${info.skill}" not found as an installed SKILL.md.` });
    }
  }

  if (info.model && info.resolvedModel && info.model !== info.resolvedModel) {
    out.push({
      level: 'info',
      message: `Requested model "${info.model}" but backend used "${info.resolvedModel}".`,
    });
  }

  return out;
}

export const STATUS_COLOR: Record<NodeStatus, string> = {
  running: '#38bdf8', // sky/accent
  queued: '#a78bfa', // violet
  done: '#34d399', // green
  error: '#f87171', // red
  cancelled: '#6b7280', // gray
  pending: '#52525b', // dim
};

export function fmtDuration(ms: number): string {
  if (ms < 1000) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
