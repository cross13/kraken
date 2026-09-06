// Shared between main (deriving `tasks.md` when the Plan gate is approved) and
// the renderer (guarding that gate). Dependency-free, like the rest of shared/.

/** `## Tasks`, tolerating a suffix like `## Tasks (waves)`. */
const TASKS_HEADING = /^##\s+tasks\b/i;
/** An H2 — `### Wave 1` must NOT match, or the section would end at wave one. */
const H2 = /^##\s+/;
/** `- [ ] T1: …`, tolerating the emphasis models like to add around the id. */
const TASK_LINE = /^\s*-\s*\[[ xX]\]\s*[*_]*\s*T\d+/;

/**
 * The body of a plan's `## Tasks` section, or `null` when the plan has no usable
 * task list.
 *
 * "Usable" means at least one `- [ ] T1: …` line: a heading with prose under it
 * is not a task list, and approving on it would land the user in an empty Build
 * stage. That is exactly what the Plan gate refuses to do.
 */
export function extractTasksSection(planMd: string): string | null {
  const lines = planMd.split('\n');
  const start = lines.findIndex((l) => TASKS_HEADING.test(l.trim()));
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (H2.test(lines[i])) {
      end = i;
      break;
    }
  }
  const body = lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
  return body.split('\n').some((l) => TASK_LINE.test(l)) ? body : null;
}

/** `tasks.md` derived from a plan — the Build stage's live, tickable copy. */
export function tasksDocFromPlan(specName: string, planMd: string): string | null {
  const section = extractTasksSection(planMd);
  return section === null ? null : `# Tasks — ${specName}\n\n${section}\n`;
}
