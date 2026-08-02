import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  CheckCircle2,
  Loader2,
  Unlock,
  ListChecks,
  Square,
  Wand2,
  X,
  Rocket,
  ArrowRight,
  Maximize2,
} from 'lucide-react';
import { parseTasks, isTaskRunnable, summarize, type ParsedTask } from '../../lib/tasks';
import { draftSpecDoc, firstStageFile } from '../../lib/specActions';
import { routeAgent, routeSkill, bestSkillByText, skillSystemBlocks } from '../../lib/agentRouter';
import { resolveAgent, resolveSkill } from '../../lib/verifyLibrary';
import { useChat } from '../../stores/chat';
import { useWorkspace } from '../../stores/workspace';
import { useModels } from '../../stores/models';
import { useOrchestrator, isOrchestrated } from '../../stores/orchestrator';
import { cn } from '../../lib/cn';
import { KrakenLogo } from '../KrakenLogo';
import { TaskInspector } from './TaskInspector';
import type { SpecMeta } from '../../../electron/shared/types';

interface Props {
  meta: SpecMeta;
  tasksMd: string;
  designMd: string;
  requirementsMd: string;
  onReload: () => void;
  /** called when the last task completes and the spec advances to Ship */
  onShip?: () => void;
}

export function TaskRunner({ meta, tasksMd, designMd, requirementsMd, onReload, onShip }: Props) {
  const doc = useMemo(() => parseTasks(tasksMd), [tasksMd]);
  const stats = useMemo(() => summarize(doc), [doc]);
  const [refiningTaskId, setRefiningTaskId] = useState<string | null>(null);
  const [refineFeedback, setRefineFeedback] = useState('');
  const [inspectId, setInspectId] = useState<string | null>(null);

  const push = useChat((s) => s.push);
  const appendDelta = useChat((s) => s.appendDelta);
  const finish = useChat((s) => s.finish);
  const fail = useChat((s) => s.fail);
  const selectedAgent = useChat((s) => s.selectedAgent);
  const root = useWorkspace((s) => s.root);
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  // The SDD skill governing this spec (sdd-feature / sdd-bugfix); a per-task
  // domain skill (e.g. a frontend skill) is matched at launch time.
  const specSkillMeta = routeSkill(meta.kind, skills);

  // Orchestration: multiple specialized agents can run in parallel within a wave.
  const runs = useOrchestrator((s) => s.runs);
  const maxConcurrency = useOrchestrator((s) => s.maxConcurrency);
  const setMaxConcurrency = useOrchestrator((s) => s.setMaxConcurrency);
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);

  // Only this spec's orchestrated runs (task/refine/polish) drive the wave UI.
  const activeRuns = Object.values(runs).filter(
    (r) =>
      isOrchestrated(r) &&
      r.specId === meta.id &&
      (r.status === 'running' || r.status === 'queued')
  );
  const runningCount = activeRuns.length;
  const runningTaskIds = new Set(
    activeRuns.map((r) => r.taskId).filter(Boolean) as string[]
  );
  const anyRunning = runningCount > 0;

  // A live "Improve plan" pass over tasks.md (self-review, streamed like a draft).
  const improvingPlan = Object.values(runs).some(
    (r) =>
      r.specId === meta.id &&
      r.source === 'spec:tasks' &&
      (r.status === 'running' || r.status === 'queued')
  );

  const improvePlan = () => {
    if (improvingPlan || anyRunning) return;
    void draftSpecDoc({
      meta,
      files: {
        [firstStageFile(meta.kind)]: requirementsMd,
        design: designMd,
        tasks: tasksMd,
      },
      file: 'tasks',
      improve: true,
    }).then(() => onReload());
  };

  // Load the configured concurrency once.
  useEffect(() => {
    window.kraken.settings.getMaxConcurrency().then(setMaxConcurrency);
  }, [setMaxConcurrency]);

  // Scheduler state lives in refs so event callbacks see fresh values.
  const waveQueueRef = useRef<ParsedTask[]>([]);
  const waveActiveRef = useRef<Set<string>>(new Set());
  const waveCtxRef = useRef<{ num: number; label: string } | null>(null);
  const waveFailedRef = useRef(false);

  const groups = useMemo(() => {
    const m = new Map<number, ParsedTask[]>();
    for (const t of doc.tasks) {
      if (!m.has(t.waveNum)) m.set(t.waveNum, []);
      m.get(t.waveNum)!.push(t);
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [doc.tasks]);

  const specRel = root ? meta.path.replace(root + '/', '') : meta.path;

  /** Start one Claude run, tracked in the orchestrator store (one requestId each). */
  const launchRun = (opts: {
    task?: ParsedTask;
    source: string;
    kind: 'task' | 'refine' | 'polish';
    title: string;
    skill?: string | null;
    skillBlock?: string;
    wave?: string;
    agentName: string | null;
    agentLabel: string;
    agentBody: string;
    systemText: string;
    userText: string;
    model?: string;
    fireComplete?: boolean;
    onSettled?: (ok: boolean) => void;
    // routing/audit metadata for the agent graph
    routeReason?: string | null;
    agentScope?: 'workspace' | 'global' | null;
    skillScope?: 'workspace' | 'global' | null;
    dependsOn?: string[];
  }) => {
    push({
      id: crypto.randomUUID(),
      role: 'user',
      content: opts.userText,
      createdAt: Date.now(),
    });
    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    push({
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true,
      agent: opts.agentName ?? opts.agentLabel,
    });
    startRun({
      requestId,
      taskId: opts.task?.id,
      agent: opts.agentName,
      source: opts.source,
      specId: meta.id,
      status: 'running',
      kind: opts.kind,
      title: opts.title,
      skill: opts.skill,
      wave: opts.wave,
      startedAt: Date.now(),
      model: opts.model,
      routeReason: opts.routeReason ?? null,
      agentScope: opts.agentScope ?? null,
      skillScope: opts.skillScope ?? null,
      dependsOn: opts.dependsOn,
    });

    const off = window.kraken.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) appendDelta(assistantId, ev.text, ev.channel);
      if (ev.type === 'done') {
        finish(assistantId);
        off();
        finishRun(requestId, 'done');
        onReload();
        if (opts.fireComplete && opts.task && root) {
          void window.kraken.hooks.fire('task-complete', {
            root,
            specId: meta.id,
            taskId: opts.task.id,
          });
        }
        opts.onSettled?.(true);
      }
      if (ev.type === 'error') {
        fail(assistantId, ev.error ?? 'Unknown error');
        off();
        finishRun(requestId, 'error');
        onReload();
        opts.onSettled?.(false);
      }
    });

    // Skill instructions + agent persona + task context, in that order.
    const composedSystem = [opts.skillBlock, opts.agentBody, opts.systemText]
      .filter(Boolean)
      .join('\n\n---\n\n');

    window.kraken.claude.stream({
      requestId,
      system: composedSystem,
      messages: [{ role: 'user', content: opts.userText }],
      cwd: root,
      source: opts.source,
      specId: meta.id,
      agent: opts.agentName,
      kind: opts.kind,
      taskId: opts.task?.id,
      wave: opts.wave,
      dependsOn: opts.dependsOn,
      skill: opts.skill,
      skillScope: opts.skillScope,
      routeReason: opts.routeReason,
      agentScope: opts.agentScope,
      model: opts.model,
    });
  };

  const runTaskInternal = (task: ParsedTask, onSettled?: (ok: boolean) => void) => {
    const routed = routeAgent(
      { kind: 'task-execute', taskAgent: task.agent, taskText: task.description },
      agents,
      selectedAgent
    );
    const domainSkill = bestSkillByText(task.description, skills);
    const chosenSkill = domainSkill ?? specSkillMeta;
    launchRun({
      task,
      source: `task:${task.id}`,
      kind: 'task',
      title: `${task.id}: ${task.description}`,
      skill: chosenSkill?.name ?? null,
      skillBlock: skillSystemBlocks([specSkillMeta, domainSkill]),
      wave: task.waveLabel,
      agentName: routed.name,
      agentLabel: 'spec-task-executor',
      agentBody: routed.body,
      systemText: buildExecutorSystem(meta, specRel, task, requirementsMd, designMd, tasksMd),
      userText: `Execute task **${task.id}**: ${task.description}`,
      model: useModels.getState().modelFor('task'),
      fireComplete: true,
      onSettled,
      routeReason: routed.reason,
      agentScope: resolveAgent(routed.name, agents).scope ?? null,
      skillScope: resolveSkill(chosenSkill?.name, skills).scope ?? null,
      dependsOn: task.dependencies,
    });
  };

  const runTask = (task: ParsedTask) => {
    if (runningTaskIds.has(task.id)) return;
    runTaskInternal(task);
  };

  /** Top up concurrent slots from the active wave queue. */
  const pump = () => {
    const max = useOrchestrator.getState().maxConcurrency;
    while (
      useOrchestrator.getState().taskRunningCount() < max &&
      waveQueueRef.current.length > 0
    ) {
      const task = waveQueueRef.current.shift()!;
      if (useOrchestrator.getState().activeForTask(task.id)) continue;
      waveActiveRef.current.add(task.id);
      runTaskInternal(task, (ok) => {
        if (!ok) waveFailedRef.current = true;
        waveActiveRef.current.delete(task.id);
        if (waveQueueRef.current.length > 0) {
          pump();
        } else if (waveActiveRef.current.size === 0) {
          const ctx = waveCtxRef.current;
          waveCtxRef.current = null;
          // Only fire wave-complete when every task in the wave succeeded.
          if (ctx && root && !waveFailedRef.current) {
            void window.kraken.hooks.fire('wave-complete', {
              root,
              specId: meta.id,
              specKind: meta.kind,
              label: ctx.label,
            });
          }
        }
      });
    }
  };

  const runWave = (num: number) => {
    const wave = doc.tasks.filter((t) => t.waveNum === num);
    const pending = wave.filter(
      (t) => !t.done && isTaskRunnable(t, doc.tasks) && !runningTaskIds.has(t.id)
    );
    if (pending.length === 0) return;
    waveQueueRef.current = [...waveQueueRef.current, ...pending];
    waveCtxRef.current = { num, label: wave[0]?.waveLabel ?? `Wave ${num}` };
    waveFailedRef.current = false;
    pump();
  };

  const refineTask = (task: ParsedTask, feedback: string) => {
    const routed = routeAgent(
      { kind: 'task-refine', taskAgent: task.agent, taskText: task.description },
      agents,
      selectedAgent
    );
    const domainSkill = bestSkillByText(task.description, skills);
    const chosenSkill = domainSkill ?? specSkillMeta;
    launchRun({
      task,
      source: `refine:${task.id}`,
      kind: 'refine',
      title: `Refine ${task.id}: ${task.description}`,
      skill: chosenSkill?.name ?? null,
      skillBlock: skillSystemBlocks([specSkillMeta, domainSkill]),
      wave: task.waveLabel,
      agentName: routed.name,
      agentLabel: 'spec-task-executor',
      agentBody: routed.body,
      systemText: buildRefineSystem(meta, specRel, task, feedback, requirementsMd, designMd, tasksMd),
      userText: `Refine task **${task.id}**: ${task.description}\n\n**Feedback:** ${feedback}`,
      model: useModels.getState().modelFor('refine'),
      routeReason: routed.reason,
      agentScope: resolveAgent(routed.name, agents).scope ?? null,
      skillScope: resolveSkill(chosenSkill?.name, skills).scope ?? null,
      dependsOn: task.dependencies,
    });
  };

  const startRefine = (task: ParsedTask) => {
    setRefiningTaskId(task.id);
    setRefineFeedback('');
  };

  const cancelRefine = () => {
    setRefiningTaskId(null);
    setRefineFeedback('');
  };

  const submitRefine = (task: ParsedTask) => {
    const feedback = refineFeedback.trim();
    if (!feedback) return;
    setRefiningTaskId(null);
    setRefineFeedback('');
    refineTask(task, feedback);
  };

  const runNext = () => {
    const next = doc.tasks.find(
      (t) => isTaskRunnable(t, doc.tasks) && !runningTaskIds.has(t.id)
    );
    if (next) runTask(next);
  };

  const cancel = () => {
    waveQueueRef.current = [];
    waveActiveRef.current = new Set();
    waveCtxRef.current = null;
    autopilotCancelRef.current = true;
    unblockHookRef.current = true;
    setWaitingOnHook(false);
    // Cancel this spec's orchestrated runs AND its in-flight hook agents (a
    // blocking hook left running is exactly what freezes everything else) —
    // leave chat / other specs alone.
    const all = useOrchestrator.getState().runs;
    Object.values(all)
      .filter((r) => (isOrchestrated(r) || r.kind === 'hook') && r.specId === meta.id)
      .forEach((r) => {
        void window.kraken.claude.cancel(r.requestId);
        useOrchestrator.getState().finishRun(r.requestId, 'cancelled');
      });
  };

  // ---------- Autopilot: run all remaining waves autonomously ----------
  const [autopilotOn, setAutopilotOn] = useState(false);
  const autopilotCancelRef = useRef(false);
  // Blocking-hook wait state, so a stuck hook can never freeze autopilot.
  const [waitingOnHook, setWaitingOnHook] = useState(false);
  const blockingHookReqsRef = useRef<Set<string>>(new Set());
  const unblockHookRef = useRef(false);

  const runTaskAsync = (task: ParsedTask) =>
    new Promise<boolean>((resolve) => runTaskInternal(task, resolve));

  const readFreshTasks = async () => {
    try {
      const md = await window.kraken.fs.read(`${meta.path}/tasks.md`);
      return parseTasks(md);
    } catch {
      return parseTasks(tasksMd);
    }
  };

  /**
   * Fire wave-complete and, if a blocking hook is configured, wait for it to
   * finish. Resilient by design — autopilot must never freeze on a stuck hook:
   * the wait resolves when the hook(s) finish, OR autopilot is stopped, OR the
   * user clicks Unblock, OR no hook starts within a few seconds.
   */
  const fireWaveCompleteAndWait = (label: string) =>
    new Promise<void>((resolve) => {
      if (!root) return resolve();
      const hooks = useWorkspace.getState().hooks;
      const blocking = hooks.some(
        (h) => h.enabled && h.trigger === 'wave-complete' && h.blocking
      );
      const fire = () =>
        void window.kraken.hooks.fire('wave-complete', {
          root,
          specId: meta.id,
          specKind: meta.kind,
          label,
        });
      if (!blocking) {
        fire();
        return resolve();
      }

      blockingHookReqsRef.current = new Set();
      unblockHookRef.current = false;
      let inflight = 0;
      let sawStart = false;
      let settled = false;
      const startedAt = Date.now();

      const finishWait = () => {
        if (settled) return;
        settled = true;
        off();
        clearInterval(timer);
        setWaitingOnHook(false);
        blockingHookReqsRef.current = new Set();
        unblockHookRef.current = false;
        resolve();
      };

      const off = window.kraken.hooks.onEvent((ev) => {
        if (ev.trigger !== 'wave-complete') return;
        if (ev.type === 'started') {
          inflight++;
          sawStart = true;
          setWaitingOnHook(true);
          if (ev.requestId) blockingHookReqsRef.current.add(ev.requestId);
        } else {
          inflight--;
          if (ev.requestId) blockingHookReqsRef.current.delete(ev.requestId);
          if (sawStart && inflight <= 0) finishWait();
        }
      });

      fire();

      // Watchdog: release on stop / explicit unblock, and bail if nothing started.
      const timer = setInterval(() => {
        if (autopilotCancelRef.current || unblockHookRef.current) return finishWait();
        if (!sawStart && Date.now() - startedAt > 4000) return finishWait();
      }, 400);
    });

  /** Release a stuck blocking hook: cancel its run(s) and let autopilot proceed. */
  const unblockHook = () => {
    blockingHookReqsRef.current.forEach((id) => void window.kraken.claude.cancel(id));
    unblockHookRef.current = true; // force-resolve even if the terminal event is lost
  };

  const autopilot = async () => {
    if (!root) return;
    setAutopilotOn(true);
    autopilotCancelRef.current = false;
    try {
      const waveNums = Array.from(new Set(doc.tasks.map((t) => t.waveNum))).sort((a, b) => a - b);
      for (const num of waveNums) {
        // Drain this wave, re-reading fresh state each round (agents tick boxes).
        for (;;) {
          if (autopilotCancelRef.current) return;
          const fresh = await readFreshTasks();
          const pending = fresh.tasks.filter(
            (t) => t.waveNum === num && !t.done && isTaskRunnable(t, fresh.tasks)
          );
          if (pending.length === 0) break;
          const max = useOrchestrator.getState().maxConcurrency;
          const batch = pending.slice(0, max);
          const results = await Promise.all(batch.map((t) => runTaskAsync(t)));
          if (results.some((ok) => !ok)) return; // stop autopilot on failure
        }
        if (autopilotCancelRef.current) return;
        await fireWaveCompleteAndWait(`Wave ${num}`);
      }
      // All waves done → advance the spec to 'done' (fires spec-done → docs hook).
      const after = await readFreshTasks();
      if (after.tasks.length > 0 && after.tasks.every((t) => t.done) && meta.phase === 'tasks') {
        await window.kraken.specs.advance(root, meta.id);
        onReload();
      }
    } finally {
      setAutopilotOn(false);
    }
  };

  const stopAutopilot = () => {
    autopilotCancelRef.current = true;
    cancel();
    setAutopilotOn(false);
  };

  // The automatic payoff: when the last task completes, the spec advances to
  // `done` and the flow navigates to Ship — no opt-in clicks. (Autopilot's own
  // advance is guarded the same way: once phase is `done` this never re-fires.)
  const advancedRef = useRef(false);
  useEffect(() => {
    if (advancedRef.current || !root) return;
    if (!stats.allDone || stats.total === 0 || anyRunning || autopilotOn) return;
    if (meta.phase !== 'tasks') return;
    advancedRef.current = true;
    void (async () => {
      await window.kraken.specs.advance(root, meta.id);
      onReload();
      onShip?.();
    })();
  });

  // When autopilot (or anything else) flips the phase to done, land on Ship.
  const prevPhaseRef = useRef(meta.phase);
  useEffect(() => {
    if (prevPhaseRef.current !== 'done' && meta.phase === 'done') onShip?.();
    prevPhaseRef.current = meta.phase;
  }, [meta.phase, onShip]);

  if (doc.tasks.length === 0) {
    const phaseHint =
      meta.phase === 'requirements'
        ? `This spec is in the **${meta.phase}** phase. Advance twice (→ design → tasks) to generate tasks.md, then come back here.`
        : meta.phase === 'design'
          ? `This spec is in the **${meta.phase}** phase. Advance once (→ tasks) to generate tasks.md, then come back here.`
          : `tasks.md exists but no tasks are parsed yet. Click **Ask Claude** above to have it draft real, executable tasks.`;
    return (
      <div className="h-full grid place-items-center bg-ink-950 px-6">
        <div className="flex items-start gap-3 max-w-md rounded-xl border border-ink-800/80 bg-ink-900/40 p-5">
          <div className="w-8 h-8 grid place-items-center rounded-lg bg-accent/15 text-accent shrink-0">
            <ListChecks size={16} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ink-50 mb-0.5">No tasks to run yet</h3>
            <p
              className="text-[12px] text-ink-300 leading-snug"
              dangerouslySetInnerHTML={{
                __html: phaseHint.replace(/\*\*(.+?)\*\*/g, '<b class="text-ink-50">$1</b>'),
              }}
            />
            <p className="text-[11px] text-ink-500 mt-2">
              Once tasks exist (lines like <code className="text-ink-300">- [ ] T1: …</code>), each
              one gets a Run button here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentWaveIdx = groups.findIndex(([, tasks]) => tasks.some((t) => !t.done));
  const waveProgress =
    currentWaveIdx === -1 ? groups.length : currentWaveIdx + 1;

  const changeConcurrency = async (n: number) => {
    const clamped = Math.max(1, Math.min(8, n));
    setMaxConcurrency(clamped);
    await window.kraken.settings.setMaxConcurrency(clamped);
  };

  return (
    <div className="h-full flex flex-col bg-ink-950">
      {/* Progress header — one primary CTA: Run all (autopilot) */}
      <div className="px-6 pt-3.5 pb-3 shrink-0 bg-ink-900/40 space-y-2.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 grid place-items-center rounded-lg bg-accent/15 text-accent shrink-0">
              <ListChecks size={15} />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[12px] text-ink-100 tabular-nums whitespace-nowrap">
                {stats.done}/{stats.total} tasks · wave {waveProgress}/{groups.length}
                {runningCount > 0 && (
                  <span className="text-accent"> · {runningCount} running</span>
                )}
              </div>
              <div className="mt-1.5 w-[260px] h-[4px] rounded-full bg-elev overflow-hidden">
                <div
                  className={cn('h-full transition-all', stats.allDone ? 'bg-good' : 'bg-accent')}
                  style={{ width: `${stats.pctDone}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex-1" />

          {/* concurrency — the single control, mirrored in Activity */}
          <div
            className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] text-faint"
            title="Max parallel agents (wave concurrency)"
          >
            <span>parallel</span>
            <button
              onClick={() => changeConcurrency(maxConcurrency - 1)}
              disabled={maxConcurrency <= 1}
              className="w-5 h-5 grid place-items-center rounded bg-elev text-ink-200 hover:bg-line disabled:opacity-40"
            >
              −
            </button>
            <span className="text-ink-50 w-3 text-center">{maxConcurrency}</span>
            <button
              onClick={() => changeConcurrency(maxConcurrency + 1)}
              disabled={maxConcurrency >= 8}
              className="w-5 h-5 grid place-items-center rounded bg-elev text-ink-200 hover:bg-line disabled:opacity-40"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {waitingOnHook && (
              <button
                onClick={unblockHook}
                title="A blocking hook is running. Unblock cancels it and lets the run continue."
                className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
              >
                <Unlock size={11} /> Unblock
              </button>
            )}
            {autopilotOn ? (
              <button
                onClick={stopAutopilot}
                className="text-[11px] flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bad/20 text-bad hover:bg-bad/30"
              >
                <Square size={11} /> Stop autopilot
              </button>
            ) : anyRunning ? (
              <button
                onClick={cancel}
                className="text-[11px] flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bad/20 text-bad hover:bg-bad/30"
              >
                <Square size={11} /> Stop {runningCount > 1 ? `(${runningCount})` : ''}
              </button>
            ) : stats.allDone ? (
              <button
                onClick={onShip}
                className="text-[11px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-good/20 text-ok font-semibold hover:bg-good/30 transition"
              >
                <CheckCircle2 size={12} /> All complete — open Ship <ArrowRight size={11} />
              </button>
            ) : (
              <>
                <button
                  onClick={improvePlan}
                  disabled={improvingPlan}
                  title="Claude critically reviews the task plan — coverage, wave ordering, granularity — and refines tasks.md in place"
                  className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent/12 text-accent hover:bg-accent/20 transition disabled:opacity-50"
                >
                  {improvingPlan ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Wand2 size={11} />
                  )}
                  {improvingPlan ? 'Improving…' : 'Improve plan'}
                </button>
                <button
                  onClick={runNext}
                  className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-elev text-ink-100 hover:bg-line transition"
                >
                  <Play size={11} /> Run next
                </button>
                <button
                  onClick={autopilot}
                  title="Run every remaining wave autonomously, with hooks firing between"
                  className="text-[12px] flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-glow transition"
                >
                  <Rocket size={12} /> Run all
                </button>
              </>
            )}
          </div>
        </div>

        {waitingOnHook && (
          <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-500/10 rounded-lg px-2.5 py-1.5">
            <Loader2 size={12} className="animate-spin shrink-0" />
            <span className="flex-1">
              Waiting on a blocking hook to finish before the next wave. If it's stuck, click{' '}
              <b>Unblock</b> to cancel it and continue, or <b>Stop autopilot</b> to halt.
            </span>
          </div>
        )}
      </div>

      {/* Waves inline — the tasks doc rendered as dependency waves */}
      <div className="flex-1 overflow-y-auto px-6 pb-10 pt-3">
        <div className="mx-auto w-full max-w-[var(--k-wide-max)] space-y-7">
          {groups.map(([num, tasks]) => {
            const wavePending = tasks.some((t) => !t.done && isTaskRunnable(t, doc.tasks));
            const waveDone = tasks.filter((t) => t.done).length;
            const allWaveDone = waveDone === tasks.length;
            const waveRunning = tasks.filter((t) => runningTaskIds.has(t.id)).length;
            const blockedBy =
              !allWaveDone && !wavePending && waveRunning === 0 && num > 1
                ? `blocked by wave ${num - 1}`
                : null;
            return (
              <section key={num}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span
                    className={cn(
                      'font-mono text-[11px] tracking-[0.14em] font-semibold',
                      allWaveDone ? 'text-ok' : waveRunning > 0 ? 'text-accent' : 'text-faint'
                    )}
                  >
                    WAVE {num}
                  </span>
                  {allWaveDone ? (
                    <CheckCircle2 size={13} className="text-ok" />
                  ) : waveRunning > 0 ? (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-accent">
                      <span className="w-2 h-2 rounded-full bg-accent animate-pulse-dot" />
                      {waveRunning} running
                    </span>
                  ) : null}
                  <span className="font-mono text-[10.5px] text-faint tabular-nums">
                    {waveDone}/{tasks.length}
                  </span>
                  {blockedBy && (
                    <span className="font-mono text-[10px] text-ink-600">· {blockedBy}</span>
                  )}
                  <span className="flex-1 h-px bg-ink-800/70" />
                  {wavePending && (
                    <button
                      onClick={() => runWave(num)}
                      title="Run this wave's tasks in parallel"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent/15 text-accent text-[11px] font-semibold hover:bg-accent/25 transition"
                    >
                      <Play size={10} /> Run wave
                    </button>
                  )}
                </div>
                <div className="ml-2 pl-4 border-l border-ink-800/60 space-y-1">
                  {tasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      runnable={isTaskRunnable(t, doc.tasks)}
                      running={runningTaskIds.has(t.id)}
                      agent={activeRuns.find((r) => r.taskId === t.id)?.agent ?? null}
                      disabled={runningCount >= maxConcurrency && !runningTaskIds.has(t.id)}
                      refining={refiningTaskId === t.id}
                      refineFeedback={refineFeedback}
                      onRun={() => runTask(t)}
                      onInspect={() => setInspectId(t.id)}
                      onRefineStart={() => startRefine(t)}
                      onRefineChange={setRefineFeedback}
                      onRefineSubmit={() => submitRefine(t)}
                      onRefineCancel={cancelRefine}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {inspectId &&
        (() => {
          const t = doc.tasks.find((x) => x.id === inspectId);
          return t ? (
            <TaskInspector task={t} meta={meta} onClose={() => setInspectId(null)} />
          ) : null;
        })()}
    </div>
  );
}

function TaskCard({
  task,
  runnable,
  running,
  agent,
  disabled,
  refining,
  refineFeedback,
  onRun,
  onInspect,
  onRefineStart,
  onRefineChange,
  onRefineSubmit,
  onRefineCancel,
}: {
  task: ParsedTask;
  runnable: boolean;
  running: boolean;
  agent: string | null;
  disabled: boolean;
  refining: boolean;
  refineFeedback: string;
  onRun: () => void;
  onInspect: () => void;
  onRefineStart: () => void;
  onRefineChange: (v: string) => void;
  onRefineSubmit: () => void;
  onRefineCancel: () => void;
}) {
  const state = task.done ? 'done' : running ? 'running' : runnable ? 'ready' : 'locked';
  return (
    <div
      onClick={onInspect}
      title="Inspect task — agent, run details & transcript"
      className={cn(
        'group relative rounded-lg px-3 py-2 transition cursor-pointer font-mono',
        state === 'running' ? 'bg-accent/[0.06]' : 'hover:bg-ink-50/[0.03]',
        state === 'done' && 'opacity-60 hover:opacity-90'
      )}
    >
      {/* Kiro-style inline action line above the task text */}
      <div className="flex items-center gap-2 mb-1 text-[12px]">
        {state === 'running' ? (
          <span className="flex items-center gap-1.5 text-accent">
            <KrakenLogo animated className="w-3.5 h-[17px]" /> Task in progress
          </span>
        ) : state === 'ready' && !refining ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRun();
            }}
            disabled={disabled}
            title={
              disabled ? 'At max concurrency — another task is running' : 'Execute this task with Claude'
            }
            className={cn(
              'flex items-center gap-1.5 transition',
              disabled ? 'text-ink-600 cursor-not-allowed' : 'text-accent hover:text-accent-2'
            )}
          >
            <Play size={11} /> Start task
          </button>
        ) : state === 'done' && !refining ? (
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-ok">
              <CheckCircle2 size={12} /> Completed
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefineStart();
              }}
              disabled={disabled}
              title="The output isn't right? Give Claude targeted feedback to adjust this task's work."
              className="flex items-center gap-1 text-faint hover:text-ink-100 transition disabled:opacity-50"
            >
              <Wand2 size={11} /> Refine
            </button>
          </span>
        ) : state === 'locked' ? (
          <span className="text-ink-600">
            Blocked{task.dependencies.length > 0 ? ` by ${task.dependencies.join(', ')}` : ''}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {running && agent && (
            <span className="text-[10px] text-faint truncate max-w-[130px]">{agent}</span>
          )}
          {task.agent && <span className="text-[10px] text-accent/80">@{task.agent}</span>}
          <Maximize2
            size={12}
            className="text-faint opacity-0 group-hover:opacity-100 transition"
          />
        </span>
      </div>

      {/* the task as it reads in tasks.md */}
      <div
        className={cn(
          'text-[13px] leading-relaxed',
          task.done ? 'line-through decoration-ink-700 text-faint' : 'text-ink-100'
        )}
      >
        <span className={cn('mr-2', task.done ? 'text-ok' : 'text-faint')}>
          [{task.done ? 'x' : ' '}]
        </span>
        <span className={cn('mr-1.5', state === 'running' ? 'text-accent' : 'text-accent-2/90')}>
          {task.id}:
        </span>
        {task.description || '(no description)'}
      </div>

      {task.dependencies.length > 0 && !task.done && state !== 'locked' && (
        <div className="mt-0.5 pl-8 text-[11px] italic text-accent-2/60">
          _Depends on: {task.dependencies.join(', ')}_
        </div>
      )}

      {state === 'running' && (
        <div className="mt-2 h-[2px] rounded-full bg-elev overflow-hidden">
          <div
            className="h-full w-1/2 animate-flow"
            style={{
              background:
                'linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent2)) 50%, rgb(var(--accent)))',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      )}

      {refining && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2.5 rounded-lg bg-bg/60 p-2 space-y-2"
        >
          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-accent font-semibold">
            <Wand2 size={11} /> REFINE {task.id}
          </div>
          <textarea
            autoFocus
            value={refineFeedback}
            onChange={(e) => onRefineChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onRefineSubmit();
              if (e.key === 'Escape') onRefineCancel();
            }}
            placeholder="What needs to change? e.g. 'use strict TypeScript types', 'add a test for the empty case'…"
            rows={3}
            className="w-full text-[12px] px-2 py-1.5 rounded-md bg-bg focus:ring-1 focus:ring-accent outline-none resize-y"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={onRefineCancel}
              className="text-[11px] px-2 py-1 rounded-md text-dim hover:bg-elev"
            >
              <X size={11} className="inline -mt-0.5" /> Cancel
            </button>
            <button
              onClick={onRefineSubmit}
              disabled={!refineFeedback.trim()}
              className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40 shadow-glow"
            >
              <Wand2 size={11} /> Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildExecutorSystem(
  meta: SpecMeta,
  specRel: string,
  task: ParsedTask,
  requirementsMd: string,
  designMd: string,
  tasksMd: string
): string {
  const reqLabel = meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md';
  return `You are executing exactly one task from a Spec-Driven Development plan.

**Spec**: ${meta.name} (${meta.kind})
**Task**: ${task.id} — ${task.description}
**Wave**: ${task.waveLabel}${
    task.dependencies.length ? ` (depends on ${task.dependencies.join(', ')})` : ''
  }
**Spec files**: \`${specRel}/${reqLabel}\`, \`${specRel}/design.md\`, \`${specRel}/tasks.md\`

## Before editing
1. Re-read \`${specRel}/${reqLabel}\` and \`${specRel}/design.md\` to ground yourself.
2. Locate the target source files in the workspace.

## To execute
- Use **Read / Edit / Write / Glob / Grep** (and Bash if enabled) to make the change.
- Make only the minimum change required by this task. Don't touch other tasks.
- When the task is implemented, edit \`${specRel}/tasks.md\` to tick this checkbox:
  - Change \`- [ ] ${task.id}\` to \`- [x] ${task.id}\`.
- In your chat reply, briefly list the files you changed and the outcome.

## Hard rules
- Do not start any other task — only ${task.id}.
- Do not invent behaviors that aren't in the spec.
- Bias to the simplest implementation that satisfies the task.

## Reference — current ${reqLabel}
${requirementsMd || '(empty)'}

## Reference — current design.md
${designMd || '(empty)'}

## Reference — current tasks.md
${tasksMd}`;
}

function buildRefineSystem(
  meta: SpecMeta,
  specRel: string,
  task: ParsedTask,
  feedback: string,
  requirementsMd: string,
  designMd: string,
  tasksMd: string
): string {
  const reqLabel = meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md';
  return `You are **refining** a task you (or a previous run) already completed.

**Spec**: ${meta.name} (${meta.kind})
**Task**: ${task.id} — ${task.description}
**Wave**: ${task.waveLabel}
**Spec files**: \`${specRel}/${reqLabel}\`, \`${specRel}/design.md\`, \`${specRel}/tasks.md\`

## User feedback on the previous output
> ${feedback.split('\n').join('\n> ')}

## What to do
1. **Read** the current state of the files you changed for this task. Use Grep/Glob if you need to find them.
2. Make **targeted** adjustments that address the feedback — do not redo unrelated work, do not touch other tasks.
3. If the change requires touching tests or docs, do that too. Bias to the smallest correct delta.
4. Keep \`${specRel}/tasks.md\` in sync: the checkbox for ${task.id} should remain \`[x]\` if the task is still complete after your refinement.
5. In your chat reply, briefly state what you changed and why, and whether the feedback is now fully addressed.

## Hard rules
- Only refine ${task.id}. Do not start or modify other tasks.
- Do not invent behaviors that aren't in the spec.
- If the feedback is ambiguous or contradicts the spec, ask the user **one** clarifying question before editing.

## Reference — current ${reqLabel}
${requirementsMd || '(empty)'}

## Reference — current design.md
${designMd || '(empty)'}

## Reference — current tasks.md
${tasksMd}`;
}

