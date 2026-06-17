import { useEffect, useState } from 'react';
import {
  ListTodo,
  Loader2,
  Square,
  X,
  CheckCircle2,
  AlertCircle,
  Ban,
  Wand2,
  Bot,
  Sparkles,
  Check,
  Globe,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { SidebarHeader, SidebarEmpty } from '../SidebarShell';
import { cn } from '../../lib/cn';
import { useOrchestrator } from '../../stores/orchestrator';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { LibBadge } from '../LibBadge';
import {
  resolveAgent,
  resolveSkill,
  scopeLabel,
  type LibResolution,
} from '../../lib/verifyLibrary';
import type { ActiveRun, FinishedRun } from '../../../electron/shared/types';

const TASK_KINDS = new Set(['task', 'refine']);

function isTaskRun(r: { kind?: string }) {
  return !!r.kind && TASK_KINDS.has(r.kind);
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/** Strip the "T3: " prefix from a run title — the id is shown separately. */
function taskBody(run: { title?: string; taskId?: string }): string {
  if (!run.title) return run.taskId ?? 'task';
  return run.title.replace(/^(Refine\s+)?[A-Za-z]?\d+[:.]?\s*/, '').trim() || run.title;
}

export function TasksView() {
  const runs = useOrchestrator((s) => s.runs);
  const log = useOrchestrator((s) => s.log);
  const maxConcurrency = useOrchestrator((s) => s.maxConcurrency);
  const finishRun = useOrchestrator((s) => s.finishRun);

  const active = Object.values(runs)
    .filter((r) => isTaskRun(r) && (r.status === 'running' || r.status === 'queued'))
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  const taskLog = log.filter((e) => isTaskRun(e)).slice(0, 30);

  // Tick once a second so elapsed timers advance.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (active.length === 0) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active.length]);

  const cancelOne = (run: ActiveRun) => {
    window.kraken.claude.cancel(run.requestId);
    finishRun(run.requestId, 'cancelled');
  };

  const stopAll = () => active.forEach(cancelOne);

  // Group running tasks by spec for clear tracking.
  const groups = new Map<string, ActiveRun[]>();
  for (const r of active) {
    const key = r.specId ?? '—';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  // Distinct agents/skills referenced by active runs (fall back to recent) for
  // the verification panel — "what is actually being used, and from where".
  const refSource = active.length > 0 ? active : taskLog;
  const usedAgents = Array.from(
    new Set(refSource.map((r) => r.agent).filter((n): n is string => !!n))
  ).sort();
  const usedSkills = Array.from(
    new Set(refSource.map((r) => r.skill).filter((n): n is string => !!n))
  ).sort();

  return (
    <>
      <SidebarHeader
        title="Running Tasks"
        actions={
          active.length > 0 ? (
            <button
              onClick={stopAll}
              className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-bad/20 text-bad hover:bg-bad/30"
            >
              <Square size={10} /> Stop all
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2.5 border-b border-ink-800/60 flex items-center gap-2">
          <div
            className={cn(
              'w-7 h-7 grid place-items-center rounded-lg shrink-0',
              active.length > 0 ? 'bg-accent/15 text-accent' : 'bg-ink-800 text-ink-400'
            )}
          >
            {active.length > 0 ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ListTodo size={14} />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink-50 leading-tight">
              {active.length === 0
                ? 'No tasks running'
                : `${active.length} task${active.length === 1 ? '' : 's'} running`}
            </div>
            <div className="text-[10px] text-ink-500">
              {active.length} / {maxConcurrency} parallel slots in use
            </div>
          </div>
        </div>

        <VerificationPanel
          agents={usedAgents}
          skills={usedSkills}
          live={active.length > 0}
        />

        <section className="px-3 py-3 border-b border-ink-800/60">
          {active.length === 0 ? (
            <p className="text-[11px] text-ink-500 leading-snug">
              Task executions show up here while they run — each with its task id, the
              agent doing the work, and the governing skill. Launch a wave from a spec's
              Tasks view to populate this.
            </p>
          ) : (
            <div className="space-y-3">
              {Array.from(groups.entries()).map(([specId, items]) => (
                <div key={specId}>
                  <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">
                    <ListTodo size={10} />
                    <span className="font-mono normal-case text-ink-400">{specId}</span>
                    <span className="ml-auto">{items.length} running</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((r) => (
                      <TaskRunCard key={r.requestId} run={r} onCancel={() => cancelOne(r)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="px-3 py-3">
          <h3 className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-2">
            Recently finished
          </h3>
          {taskLog.length === 0 ? (
            <SidebarEmpty
              title="Nothing yet"
              description="Completed task runs are recorded here for the session."
            />
          ) : (
            <div className="space-y-1">
              {taskLog.map((e) => (
                <TaskLogRow key={e.requestId} entry={e} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function VerificationPanel({
  agents,
  skills,
  live,
}: {
  agents: string[];
  skills: string[];
  live: boolean;
}) {
  const wsAgents = useWorkspace((s) => s.agents);
  const wsSkills = useWorkspace((s) => s.skills);
  if (agents.length === 0 && skills.length === 0) return null;

  return (
    <section className="px-3 py-3 border-b border-ink-800/60">
      <h3 className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1">
        <ShieldCheck size={11} /> Library verification
      </h3>
      <p className="text-[10px] text-ink-500 mb-2 leading-snug">
        {live
          ? 'What the running tasks resolve to'
          : 'From recent task runs'}{' '}
        — verified against the installed <code className="text-ink-400">.claude/</code> library
        (<span className="text-ok">root</span> = this project, global = ~/.claude).
      </p>
      <div className="space-y-2.5">
        {agents.length > 0 && (
          <div>
            <div className="text-[9px] uppercase tracking-wider text-ink-500 mb-1">Agents</div>
            <div className="space-y-0.5">
              {agents.map((n) => (
                <LibVerifyRow key={`a:${n}`} kind="agent" name={n} resolved={resolveAgent(n, wsAgents)} />
              ))}
            </div>
          </div>
        )}
        {skills.length > 0 && (
          <div>
            <div className="text-[9px] uppercase tracking-wider text-ink-500 mb-1">Skills</div>
            <div className="space-y-0.5">
              {skills.map((n) => (
                <LibVerifyRow key={`s:${n}`} kind="skill" name={n} resolved={resolveSkill(n, wsSkills)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function LibVerifyRow({
  kind,
  name,
  resolved,
}: {
  kind: 'agent' | 'skill';
  name: string;
  resolved: LibResolution;
}) {
  const openTab = useUi((s) => s.openTab);
  const Icon = kind === 'agent' ? Bot : Sparkles;
  const open = () =>
    resolved.path &&
    openTab({ id: `${kind}:${resolved.path}`, title: `${kind}: ${name}`, kind, filePath: resolved.path });

  return (
    <div
      className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-ink-800/40"
      title={resolved.installed ? resolved.path : `Not found in .claude/${kind}s (root) or ~/.claude`}
    >
      <Icon size={12} className={cn('shrink-0', kind === 'agent' ? 'text-accent' : 'text-sky-300')} />
      <span className="text-xs text-ink-100 truncate">{name}</span>
      {resolved.installed ? (
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              'flex items-center gap-0.5 text-[10px]',
              resolved.scope === 'workspace' ? 'text-ok' : 'text-ink-400'
            )}
          >
            {resolved.scope === 'workspace' ? <Check size={10} /> : <Globe size={10} />}
            {scopeLabel(resolved.scope)}
          </span>
          <button onClick={open} className="text-[10px] text-accent hover:underline">
            open
          </button>
        </span>
      ) : (
        <span className="ml-auto flex items-center gap-1 text-[10px] text-warn shrink-0">
          <AlertTriangle size={10} /> not installed
        </span>
      )}
    </div>
  );
}

function MetaBadges({
  agent,
  skill,
  refine,
}: {
  agent: string | null;
  skill?: string | null;
  refine?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <LibBadge kind="agent" name={agent} />
      <LibBadge kind="skill" name={skill} />
      {refine && (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 flex items-center gap-1">
          <Wand2 size={9} /> refine
        </span>
      )}
    </div>
  );
}

function useOpenRun() {
  const openTab = useUi((s) => s.openTab);
  return (requestId: string, label: string) =>
    openTab({ id: `run:${requestId}`, title: `run: ${label}`, kind: 'run', runId: requestId });
}

function TaskRunCard({ run, onCancel }: { run: ActiveRun; onCancel: () => void }) {
  const elapsed = run.startedAt ? fmtDuration(Date.now() - run.startedAt) : null;
  const openRun = useOpenRun();
  return (
    <div
      onClick={() => openRun(run.requestId, run.taskId ?? 'task')}
      title="Open this run to verify the agent & skill in the system prompt"
      className="rounded-md border border-accent/30 bg-accent/[0.06] p-2.5 cursor-pointer hover:border-accent/50"
    >
      <div className="flex items-center gap-1.5 mb-1">
        {run.taskId && (
          <span className="text-[10px] font-mono font-semibold text-ink-100 bg-ink-800 px-1.5 py-0.5 rounded">
            {run.taskId}
          </span>
        )}
        {run.wave && <span className="text-[10px] text-ink-500">{run.wave}</span>}
        <span className="text-[10px] text-accent ml-auto flex items-center gap-1">
          <Loader2 size={10} className="animate-spin" />
          {elapsed}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          title="Cancel this task"
          className="text-ink-500 hover:text-bad"
        >
          <X size={12} />
        </button>
      </div>
      <div className="text-xs text-ink-100 leading-snug line-clamp-2 mb-1.5">
        {taskBody(run)}
      </div>
      <MetaBadges agent={run.agent} skill={run.skill} refine={run.kind === 'refine'} />
    </div>
  );
}

function TaskLogRow({ entry }: { entry: FinishedRun }) {
  const openRun = useOpenRun();
  const duration =
    entry.startedAt != null ? fmtDuration(entry.endedAt - entry.startedAt) : null;
  const statusIcon =
    entry.status === 'done' ? (
      <CheckCircle2 size={12} className="text-ok" />
    ) : entry.status === 'error' ? (
      <AlertCircle size={12} className="text-bad" />
    ) : (
      <Ban size={12} className="text-ink-500" />
    );
  return (
    <div
      onClick={() => openRun(entry.requestId, entry.taskId ?? 'task')}
      title="Open this run to verify the agent & skill in the system prompt"
      className="flex items-start gap-2 px-1.5 py-1.5 rounded-md hover:bg-ink-800/40 cursor-pointer"
    >
      <span className="mt-0.5 shrink-0">{statusIcon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {entry.taskId && (
            <span className="text-[10px] font-mono font-semibold text-ink-200">
              {entry.taskId}
            </span>
          )}
          {entry.specId && (
            <span className="text-[10px] font-mono text-ink-600 truncate">{entry.specId}</span>
          )}
          {duration && <span className="text-[10px] text-ink-600 ml-auto">{duration}</span>}
        </div>
        <div className="text-[11px] text-ink-300 leading-snug truncate">{taskBody(entry)}</div>
        <div className="mt-1">
          <MetaBadges agent={entry.agent} skill={entry.skill} refine={entry.kind === 'refine'} />
        </div>
      </div>
    </div>
  );
}
