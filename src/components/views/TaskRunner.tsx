import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  CheckCircle2,
  Loader2,
  Unlock,
  Sparkles,
  ListChecks,
  Square,
  Wand2,
  X,
  Rocket,
} from 'lucide-react';
import { parseTasks, isTaskRunnable, summarize, type ParsedTask } from '../../lib/tasks';
import { routeAgent, routeSkill, bestSkillByText, skillSystemBlocks } from '../../lib/agentRouter';
import { resolveAgent, resolveSkill } from '../../lib/verifyLibrary';
import { useChat } from '../../stores/chat';
import { useWorkspace } from '../../stores/workspace';
import { useOrchestrator, isOrchestrated } from '../../stores/orchestrator';
import { CompletionSummary } from './CompletionSummary';
import { cn } from '../../lib/cn';
import type { SpecMeta } from '../../../electron/shared/types';

interface Props {
  meta: SpecMeta;
  tasksMd: string;
  designMd: string;
  requirementsMd: string;
  onReload: () => void;
}

export function TaskRunner({ meta, tasksMd, designMd, requirementsMd, onReload }: Props) {
  const doc = useMemo(() => parseTasks(tasksMd), [tasksMd]);
  const stats = useMemo(() => summarize(doc), [doc]);
  const [refiningTaskId, setRefiningTaskId] = useState<string | null>(null);
  const [refineFeedback, setRefineFeedback] = useState('');

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

  const polish = () => {
    const text = `All tasks for **${meta.name}** are complete. Please polish the implementation:

1. Review the diff for correctness and edge cases.
2. Spot any missing tests or regressions vs the spec's acceptance criteria.
3. Suggest cleanups: dead code, awkward abstractions, naming, comments.
4. If anything is genuinely wrong, apply the fix directly using Edit/Write tools.

Reference \`${specRel}/requirements.md\`${
      meta.kind === 'bugfix' ? ` and \`${specRel}/bugfix.md\`` : ''
    }, \`${specRel}/design.md\`, and \`${specRel}/tasks.md\`. Keep your chat reply concise.`;
    const routed = routeAgent({ kind: 'polish' }, agents, selectedAgent);
    launchRun({
      source: 'polish',
      kind: 'polish',
      title: `Polish ${meta.name}`,
      agentName: routed.name,
      agentLabel: 'code-reviewer',
      agentBody: routed.body,
      systemText: buildPolishSystem(meta, specRel),
      userText: text,
      routeReason: routed.reason,
      agentScope: resolveAgent(routed.name, agents).scope ?? null,
    });
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

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <div className="px-6 py-3 space-y-2 bg-ink-900/30 shrink-0">
      <div className="flex items-center gap-2">
        <ListChecks size={13} className="text-accent" />
        <h3 className="text-[11px] uppercase tracking-wider text-ink-300 font-semibold">
          Tasks · {stats.done}/{stats.total} done
        </h3>
        <div className="flex-1 h-1 bg-ink-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${stats.pctDone}%` }}
          />
        </div>
        <div className="flex items-center gap-1">
          {waitingOnHook && (
            <button
              onClick={unblockHook}
              title="A blocking hook is running. Unblock cancels it and lets the run continue."
              className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
            >
              <Unlock size={11} /> Unblock
            </button>
          )}
          {autopilotOn ? (
            <button
              onClick={stopAutopilot}
              className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md bg-bad/20 text-bad hover:bg-bad/30"
            >
              <Square size={11} /> Stop autopilot
            </button>
          ) : anyRunning ? (
            <button
              onClick={cancel}
              className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md bg-bad/20 text-bad hover:bg-bad/30"
            >
              <Square size={11} /> Stop {runningCount > 1 ? `(${runningCount})` : ''}
            </button>
          ) : stats.allDone ? (
            <button
              onClick={polish}
              className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md bg-gradient-to-r from-accent to-accent/70 text-accent-fg hover:opacity-90"
              title="Have Claude review and refine the implementation"
            >
              <Sparkles size={11} /> Polish
            </button>
          ) : (
            <>
              <button
                onClick={runNext}
                className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-elev text-ink-100 hover:bg-line transition"
              >
                <Play size={11} /> Run next
              </button>
              <button
                onClick={autopilot}
                title="Run all remaining waves autonomously, with hooks firing between"
                className="text-[11px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-glow transition"
              >
                <Rocket size={11} /> Run all waves
              </button>
            </>
          )}
        </div>
      </div>

      {waitingOnHook && (
        <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-1.5">
          <Loader2 size={12} className="animate-spin shrink-0" />
          <span className="flex-1">
            Waiting on a blocking hook to finish before the next wave. If it's stuck, click{' '}
            <b>Unblock</b> to cancel it and continue, or <b>Stop autopilot</b> to halt.
          </span>
        </div>
      )}

      {stats.allDone && <CompletionSummary meta={meta} specRel={specRel} />}

      <p className="text-[11px] text-ink-500 leading-snug">
        Click <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-accent/15 text-accent font-semibold">
          <Play size={9} /> Run
        </span> on a task, or <b className="text-ink-300">Run wave</b> to launch its tasks in
        parallel (up to {maxConcurrency} at once — set in Settings). Each task can name a
        specialized agent with <code className="text-ink-300">@agent-name</code>.
      </p>

      {activeRuns.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeRuns.map((r) => (
            <span
              key={r.requestId}
              className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md bg-accent/10 text-ink-200 ring-1 ring-accent/30"
            >
              <Loader2 size={10} className="text-accent animate-spin" />
              {r.taskId ? <span className="font-mono text-ink-400">{r.taskId}</span> : null}
              <span className="text-accent">{r.agent ?? 'claude'}</span>
              <button
                onClick={() => window.kraken.claude.cancel(r.requestId)}
                title="Stop this run"
                className="text-ink-500 hover:text-bad"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      </div>
      {/* Kanban wave runner — one column per wave, live parallel-agent cards */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
        <div className="h-full flex gap-4" style={{ minWidth: 'min-content' }}>
          {groups.map(([num, tasks]) => {
            const wavePending = tasks.some((t) => !t.done && isTaskRunnable(t, doc.tasks));
            const allWaveDone = tasks.every((t) => t.done);
            const waveRunning = tasks.filter((t) => runningTaskIds.has(t.id)).length;
            return (
              <div key={num} className="w-[300px] shrink-0 flex flex-col gap-3 overflow-hidden">
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'font-mono text-[12px] font-bold tracking-wide',
                      waveRunning > 0 ? 'text-accent' : 'text-ink-200'
                    )}
                  >
                    WAVE {num}
                  </span>
                  {allWaveDone ? (
                    <span className="w-4 h-4 grid place-items-center rounded-full bg-good/[0.16] text-ok">
                      <CheckCircle2 size={11} />
                    </span>
                  ) : waveRunning > 0 ? (
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse-dot" />
                  ) : null}
                  <span className="font-mono text-[10px] text-ink-600">
                    {waveRunning > 0
                      ? `${waveRunning} running`
                      : allWaveDone
                        ? 'done'
                        : `${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
                  </span>
                  {wavePending && (
                    <button
                      onClick={() => runWave(num)}
                      title="Run this wave's tasks in parallel"
                      className="ml-auto flex items-center gap-1 text-[11px] text-faint hover:text-accent transition"
                    >
                      <Play size={10} /> Run
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
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
                      onRefineStart={() => startRefine(t)}
                      onRefineChange={setRefineFeedback}
                      onRefineSubmit={() => submitRefine(t)}
                      onRefineCancel={cancelRefine}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
  onRefineStart: () => void;
  onRefineChange: (v: string) => void;
  onRefineSubmit: () => void;
  onRefineCancel: () => void;
}) {
  const state = task.done ? 'done' : running ? 'running' : runnable ? 'ready' : 'locked';
  return (
    <div
      className={cn(
        'rounded-xl p-3 transition',
        state === 'running' && 'bg-accent/[0.08] shadow-[0_0_22px_-12px_rgb(var(--accent))]',
        state === 'done' && 'bg-card opacity-60',
        state === 'ready' && 'bg-elev hover:bg-elev/70',
        state === 'locked' && 'bg-card/40'
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={cn(
            'font-mono text-[11px] font-semibold',
            state === 'done'
              ? 'text-ok'
              : state === 'running'
                ? 'text-accent'
                : state === 'locked'
                  ? 'text-ink-600'
                  : 'text-faint'
          )}
        >
          {task.id}
          {state === 'done'
            ? ' ✓'
            : state === 'running'
              ? ' · running'
              : state === 'locked'
                ? ' · blocked'
                : ''}
        </span>
        {task.agent && (
          <span className="font-mono text-[10px] text-accent/80">@{task.agent}</span>
        )}
        {running && agent && (
          <span className="ml-auto font-mono text-[10px] text-faint truncate max-w-[120px]">
            {agent}
          </span>
        )}
      </div>

      <div
        className={cn(
          'text-[12.5px] leading-snug',
          task.done ? 'line-through decoration-ink-700 text-faint' : 'text-ink-100'
        )}
      >
        {task.description || '(no description)'}
      </div>

      {task.dependencies.length > 0 && !task.done && (
        <div className="mt-1.5 font-mono text-[9.5px] text-ink-600">
          deps: {task.dependencies.join(', ')}
        </div>
      )}

      {state === 'running' && (
        <div className="mt-2.5 h-[3px] rounded-full bg-elev overflow-hidden">
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

      {state === 'ready' && !refining && (
        <button
          onClick={onRun}
          disabled={disabled}
          title={disabled ? 'At max concurrency — another task is running' : 'Execute this task with Claude'}
          className={cn(
            'mt-2.5 w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition',
            disabled
              ? 'bg-elev text-faint cursor-not-allowed'
              : 'bg-accent text-accent-fg hover:opacity-90 shadow-glow'
          )}
        >
          <Play size={11} /> Run task
        </button>
      )}

      {state === 'done' && !refining && (
        <button
          onClick={onRefineStart}
          disabled={disabled}
          title="The output isn't right? Give Claude targeted feedback to adjust this task's work."
          className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-elev text-dim hover:text-ink-100 transition disabled:opacity-50"
        >
          <Wand2 size={11} /> Refine
        </button>
      )}

      {refining && (
        <div className="mt-2.5 rounded-lg bg-bg/60 p-2 space-y-2">
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

function buildPolishSystem(meta: SpecMeta, specRel: string): string {
  return `You are polishing the implementation of the spec "${meta.name}" (${meta.kind}).

All tasks in \`${specRel}/tasks.md\` are marked done. The user wants a critical review:

- **Correctness** — bugs, races, off-by-ones, missing edge cases, integration mismatches.
- **Regressions** — interactions with Unchanged Behavior (for bugfix specs) or untouched code paths.
- **Coverage** — every acceptance criterion (every EARS statement) should be exercised by at least one test.
- **Cleanups** — dead code, awkward abstractions, naming, missing types or docs.

When you find something genuinely wrong, apply the fix directly using the Edit/Write tools. For optional suggestions, list them in chat. Be specific: cite file:line.

Reference \`${specRel}/${
    meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md'
  }\`, \`${specRel}/design.md\`, and \`${specRel}/tasks.md\` before forming opinions.`;
}
