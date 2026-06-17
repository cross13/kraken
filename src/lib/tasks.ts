export interface ParsedTask {
  id: string;
  description: string;
  done: boolean;
  waveNum: number;
  waveLabel: string;
  dependencies: string[];
  /** optional per-task specialized agent, written as `- [ ] T1 @agent-name: ...` */
  agent?: string;
  lineIndex: number;
  raw: string;
}

export interface ParsedWave {
  num: number;
  label: string;
  dependencies: string[];
}

export interface ParsedTasksDoc {
  tasks: ParsedTask[];
  waves: ParsedWave[];
}

const waveRegex = /^##\s*Wave\s+(\d+)\s*(?:\(([^)]*)\))?/i;
// - [ ] T1: description...  or  - [ ] T1 @agent-name: description...
// Tolerates markdown emphasis the model often adds around the id, e.g.
// `- [ ] **T1**: …` or `- [ ] **T1:** …` — the `[*_]*` runs absorb the markers
// so the id, agent, and description still parse cleanly (no manual cleanup).
const taskRegex =
  /^(\s*)-\s*\[(\s|x|X)\]\s*[*_]*\s*(T\d+)\s*[*_]*\s*(?:@([\w-]+))?\s*[*_]*\s*[:.\-]?\s*[*_]*\s*(.*)$/;

export function parseTasks(md: string): ParsedTasksDoc {
  const lines = md.split('\n');
  const tasks: ParsedTask[] = [];
  const waves: ParsedWave[] = [];
  let currentWaveNum = 1;
  let currentLabel = 'Wave 1';
  let currentDeps: string[] = [];
  let currentPerTask: Record<string, string[]> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const wm = line.match(waveRegex);
    if (wm) {
      currentWaveNum = parseInt(wm[1], 10);
      currentLabel = `Wave ${currentWaveNum}`;
      const parsed = parseWaveDeps(wm[2] ?? '');
      currentDeps = parsed.waveDeps;
      currentPerTask = parsed.perTask;
      waves.push({ num: currentWaveNum, label: currentLabel, dependencies: currentDeps });
      continue;
    }
    const tm = line.match(taskRegex);
    if (tm) {
      const id = tm[3];
      const agent = tm[4];
      const inline = tm[5];
      // Pick up "(depends on T1, T2)" inside the task line too.
      const inlineDeps = Array.from(inline.matchAll(/depends?\s+on\s+([T0-9,\s]+)/gi)).flatMap(
        (m) => Array.from(m[1].matchAll(/T\d+/g)).map((x) => x[0])
      );
      tasks.push({
        id,
        // Drop emphasis runs that wrap the whole description (e.g. `**build it**`)
        // so the rendered text is clean; inner emphasis is left untouched.
        description: inline.trim().replace(/^[*_]+/, '').replace(/[*_]+$/, '').trim(),
        done: tm[2].toLowerCase() === 'x',
        waveNum: currentWaveNum,
        waveLabel: currentLabel,
        // Wave-level deps + this task's per-task deps + inline deps, minus any
        // self-reference (a task can never depend on itself — that deadlocks).
        dependencies: dedupe([
          ...currentDeps,
          ...(currentPerTask[id] ?? []),
          ...inlineDeps,
        ]).filter((d) => d !== id),
        agent: agent || undefined,
        lineIndex: i,
        raw: line,
      });
    }
  }

  return { tasks, waves };
}

/**
 * Parse a wave header's parenthetical dependency note into wave-level deps and
 * per-task deps. Supports:
 *   "depends on T1, T3"                     -> waveDeps [T1, T3]
 *   "depends on T2; T6 also depends on T4"  -> waveDeps [T2], perTask {T6:[T4]}
 *
 * A clause whose "depends on" has a task **subject** (e.g. "T6 also depends on
 * T4") is a per-task dependency — NOT a wave-level one. Treating it as wave-
 * level would make every task in the wave (and the subject task itself) depend
 * on those ids, which permanently blocks the wave.
 */
function parseWaveDeps(text: string): {
  waveDeps: string[];
  perTask: Record<string, string[]>;
} {
  const waveDeps: string[] = [];
  const perTask: Record<string, string[]> = {};
  if (!text.trim()) return { waveDeps, perTask };

  // Clauses are separated by ';' (or newlines). Each clause is examined for a
  // "depends on" phrase, optionally prefixed by a subject task id.
  for (const clause of text.split(/[;\n]+/)) {
    const c = clause.trim();
    if (!c) continue;
    const m = c.match(/(?:(T\d+)\s+(?:\w+\s+)*?)?depends?\s+on\s+(.+)$/i);
    if (m) {
      const subject = m[1];
      const targets = Array.from(m[2].matchAll(/T\d+/g)).map((x) => x[0]);
      if (!targets.length) continue;
      if (subject) {
        perTask[subject] = dedupe([...(perTask[subject] ?? []), ...targets]);
      } else {
        waveDeps.push(...targets);
      }
    } else {
      // No "depends on" keyword — treat bare ids (e.g. "(T1, T3)") as wave deps.
      waveDeps.push(...Array.from(c.matchAll(/T\d+/g)).map((x) => x[0]));
    }
  }

  return { waveDeps: dedupe(waveDeps), perTask };
}

function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

export function isTaskRunnable(task: ParsedTask, allTasks: ParsedTask[]): boolean {
  if (task.done) return false;
  // Wave-level: every task in any wave < this one must be done.
  for (const t of allTasks) {
    if (t.waveNum < task.waveNum && !t.done) return false;
  }
  // Explicit dependencies by ID
  for (const depId of task.dependencies) {
    const dep = allTasks.find((t) => t.id === depId);
    if (dep && !dep.done) return false;
  }
  return true;
}

export function summarize(doc: ParsedTasksDoc): {
  total: number;
  done: number;
  pending: number;
  pctDone: number;
  allDone: boolean;
} {
  const total = doc.tasks.length;
  const done = doc.tasks.filter((t) => t.done).length;
  const pending = total - done;
  return {
    total,
    done,
    pending,
    pctDone: total === 0 ? 0 : Math.round((done / total) * 100),
    allDone: total > 0 && pending === 0,
  };
}
