// Octo parses the spec documents rather than just displaying them, so a
// mis-formatted line is not a cosmetic problem: an emphasised task id is a task
// the runner never sees, a `## Tasks` section with no parsable line makes Build
// land empty, and an un-numbered criterion drops out of the traceability view.
//
// Every violation below is computed from the *same* parser the rest of the app
// uses, in the renderer, for free. That is deliberate: an LLM hook would cost a
// run per save, fire on the 400 ms autosave rather than after a draft (Claude's
// own edits never reach the `specs:write-file` IPC that triggers file-save
// hooks), and could invent a violation. These cannot.
//
// The split that matters is `fixable`: those have exactly one correct answer, so
// "Fix with Claude" can hand them over as concrete instructions. Everything else
// needs judgement and is only reported.

import { extractTasksSection } from '../../electron/shared/planTasks';
import { parseTasks } from './tasks';
import { reviewRequirements } from './reqReview';
import { extractCriteria } from './specTrace';
import { parseSpecDoc } from './specSections';
import type { SpecDocFile } from './agentRouter';

export interface FormatFinding {
  /** Stable id so the UI can key rows without relying on the message. */
  code: string;
  message: string;
  /** true when there is exactly one correct answer, so Claude can just apply it. */
  fixable: boolean;
  /** Blocks the gate — today only a plan with no usable `## Tasks`. */
  blocking?: boolean;
}

export interface FormatReport {
  findings: FormatFinding[];
  fixable: number;
  blocking: boolean;
}

/** `- [ ] **T1**: …` — emphasis around the id, which `zenDoc`'s gutter cannot read. */
const EMPHASISED_ID = /^\s*-\s*\[[ xX]\]\s*[*_]+\s*T\d+/;
/** A criterion line: a top-level bullet asserting SHALL. */
const SHALL_ITEM = /^\s*[-*+]\s+.*\bSHALL\b/;
const HAS_AC_ID = /\bAC[-\s]?\d{1,3}\b/;
const HAS_US_ID = /\bUS[-\s]?\d{1,3}\b/;
const STORY_ITEM = /^\s*[-*+]\s+.*\bas\s+an?\s+.+?,?\s+i\s+want\b/i;
/** A markdown table row whose first cell looks like a path but isn't backticked. */
const BARE_PATH_CELL = /^\s*\|\s*(?!\s*[|`])([^|]*[\w-]\/[\w./-]+)\s*\|/;

function lines(md: string): string[] {
  return md.split('\n');
}

/** Sections whose bullets are questions or bookkeeping, never criteria. */
const NOT_CRITERIA = /open questions|resolved decisions|critical decisions/i;
/** Sections whose bullets are *supposed* to be criteria. */
const CRITERIA_SECTION = /acceptance criteria|expected behavior|unchanged behavior/i;

function checkCriteriaIds(md: string, out: FormatFinding[]): void {
  const doc = parseSpecDoc(md);
  let unnumbered = 0;
  for (const section of doc.sections) {
    if (NOT_CRITERIA.test(section.title)) continue;
    for (const raw of lines(section.body)) {
      if (/^\s/.test(raw)) continue; // indented items are invisible to the parsers anyway
      if (SHALL_ITEM.test(raw) && !HAS_AC_ID.test(raw)) unnumbered++;
    }
  }
  if (unnumbered)
    out.push({
      code: 'ac-unnumbered',
      fixable: true,
      message: `${unnumbered} acceptance criteri${unnumbered === 1 ? 'on has' : 'a have'} no AC-n id — the plan cites those ids, and the Review view traces them.`,
    });
}

function checkStoryIds(md: string, out: FormatFinding[]): void {
  const unnumbered = lines(md).filter(
    (l) => !/^\s/.test(l) && STORY_ITEM.test(l) && !HAS_US_ID.test(l)
  ).length;
  if (unnumbered)
    out.push({
      code: 'us-unnumbered',
      fixable: true,
      message: `${unnumbered} user stor${unnumbered === 1 ? 'y has' : 'ies have'} no US-n id — criteria reference stories by that id.`,
    });
}

/** requirements.md / bugfix.md. */
export function checkRequirements(md: string, planMd?: string, tasksMd?: string): FormatReport {
  const out: FormatFinding[] = [];
  if (!md.trim()) return report(out);

  checkCriteriaIds(md, out);
  checkStoryIds(md, out);

  // A bullet without SHALL is not a criterion to any parser here — it never
  // reaches the Review view and is never traced to a task. Under a heading that
  // announces acceptance criteria that is silent data loss, so it is worth more
  // than the "not EARS" finding below, which can only fire on lines that *are*
  // criteria. Imported tickets land here almost by definition.
  const doc = parseSpecDoc(md);
  const inert = doc.sections
    .filter((sec) => CRITERIA_SECTION.test(sec.title))
    .flatMap((sec) =>
      lines(sec.body)
        .filter((l) => !/^\s/.test(l) && /^\s*[-*+]\s+\S/.test(l) && !/\bSHALL\b/.test(l))
        .map((l) => l.trim())
    );
  if (inert.length)
    out.push({
      code: 'criteria-without-shall',
      fixable: true,
      message: `${inert.length} bullet${inert.length === 1 ? '' : 's'} under an acceptance-criteria heading ${inert.length === 1 ? 'does' : 'do'} not say SHALL, so Octo does not read ${inert.length === 1 ? 'it' : 'them'} as a criterion at all — rewrite in EARS form.`,
    });

  const review = reviewRequirements(md, planMd, tasksMd);
  const notEars = review.criteria.filter((c) => c.form === 'not EARS');
  if (notEars.length)
    out.push({
      code: 'not-ears',
      fixable: false,
      message: `${notEars.length} criteri${notEars.length === 1 ? 'on is' : 'a are'} not in an EARS form (${notEars.map((c) => c.id).join(', ')}) — use WHEN/THEN, WHILE, IF/THEN or WHERE with SHALL.`,
    });
  const vague = review.criteria.filter((c) => c.vague.length);
  if (vague.length)
    out.push({
      code: 'untestable',
      fixable: false,
      message: `${vague.length} criteri${vague.length === 1 ? 'on uses' : 'a use'} untestable wording (${[...new Map(vague.flatMap((c) => c.vague).map((v) => [v.replace(/[-\s]+/g, ' '), v])).values()].slice(0, 4).join(', ')}) — replace the judgement with something observable.`,
    });
  if (review.storyMode && review.orphanStories.length)
    out.push({
      code: 'orphan-story',
      fixable: false,
      message: `${review.orphanStories.join(', ')} ${review.orphanStories.length === 1 ? 'has' : 'have'} no acceptance criterion — a story nothing tests is dropped in Build.`,
    });
  const unlinked = review.storyMode ? review.criteria.filter((c) => !c.storyId) : [];
  if (unlinked.length)
    out.push({
      code: 'criterion-no-story',
      fixable: false,
      message: `${unlinked.map((c) => c.id).join(', ')} answer${unlinked.length === 1 ? 's' : ''} no user story — end the line with the story it serves, e.g. "(US-2)".`,
    });

  return report(out);
}

/** plan.md. */
export function checkPlan(md: string): FormatReport {
  const out: FormatFinding[] = [];
  if (!md.trim()) return report(out);

  const section = extractTasksSection(md);
  if (section === null)
    out.push({
      code: 'no-tasks',
      fixable: true,
      blocking: true,
      message:
        'No usable "## Tasks" section — Approve would leave Build empty. It must be an H2 with at least one "- [ ] T1: …" line under "### Wave n" headings.',
    });

  checkCriteriaIds(md, out);

  const emphasised = lines(md).filter((l) => EMPHASISED_ID.test(l)).length;
  if (emphasised)
    out.push({
      code: 'emphasised-task-id',
      fixable: true,
      message: `${emphasised} task line${emphasised === 1 ? '' : 's'} wrap${emphasised === 1 ? 's' : ''} the id in bold or italics — the runner parses "- [ ] T1:" literally and skips these.`,
    });

  const titles = parseSpecDoc(md).sections.map((s) => s.title.toLowerCase());
  if (!titles.some((t) => /^critical decisions\b/.test(t)))
    out.push({
      code: 'no-critical-decisions',
      fixable: true,
      message:
        'No "## Critical Decisions" heading at the end — Build appends deviations there, and without it the plan drifts from the code silently.',
    });

  const bare = lines(md).filter((l) => BARE_PATH_CELL.test(l)).length;
  if (bare)
    out.push({
      code: 'bare-path',
      fixable: true,
      message: `${bare} table row${bare === 1 ? '' : 's'} name${bare === 1 ? 's' : ''} a path outside backticks — file references are only traced when backticked.`,
    });

  const criteria = extractCriteria(md);
  if (!criteria.length && !HAS_AC_ID.test(md))
    out.push({
      code: 'no-citations',
      fixable: true,
      message:
        'The plan cites no AC-n ids — without them the Review view guesses coverage from wording instead of confirming it.',
    });

  return report(out);
}

/** tasks.md. */
export function checkTasks(md: string): FormatReport {
  const out: FormatFinding[] = [];
  if (!md.trim()) return report(out);

  const emphasised = lines(md).filter((l) => EMPHASISED_ID.test(l)).length;
  if (emphasised)
    out.push({
      code: 'emphasised-task-id',
      fixable: true,
      message: `${emphasised} task line${emphasised === 1 ? '' : 's'} wrap${emphasised === 1 ? 's' : ''} the id in bold or italics — the runner skips these.`,
    });

  const doc = parseTasks(md);
  if (!doc.tasks.length)
    out.push({
      code: 'no-tasks',
      fixable: true,
      blocking: true,
      message:
        'No parsable task lines — each must read "- [ ] T1: <description>" under a "## Wave n" or "### Wave n" heading.',
    });

  const dupes = doc.tasks
    .map((t) => t.id)
    .filter((id, i, all) => all.indexOf(id) !== i);
  if (dupes.length)
    out.push({
      code: 'duplicate-id',
      fixable: true,
      message: `Duplicate task ids (${[...new Set(dupes)].join(', ')}) — dependencies and run records key off them.`,
    });

  const unknownDeps = [
    ...new Set(
      doc.tasks.flatMap((t) => t.dependencies.filter((d) => !doc.tasks.some((x) => x.id === d)))
    ),
  ];
  if (unknownDeps.length)
    out.push({
      code: 'unknown-dependency',
      fixable: false,
      message: `Tasks depend on ${unknownDeps.join(', ')}, which no task defines — those waves can never start.`,
    });

  return report(out);
}

/** The check for whichever document is on screen. */
export function checkDocument(
  file: SpecDocFile,
  md: string,
  ctx: { planMd?: string; tasksMd?: string } = {}
): FormatReport {
  if (file === 'plan') return checkPlan(md);
  if (file === 'tasks') return checkTasks(md);
  return checkRequirements(md, ctx.planMd, ctx.tasksMd);
}

/**
 * The findings as revision feedback — what "Fix with Claude" hands to a normal
 * `improve` run, so the model gets the concrete list rather than a nudge.
 */
export function fixInstructions(report: FormatReport): string {
  const fix = report.findings.filter((f) => f.fixable);
  const judge = report.findings.filter((f) => !f.fixable);
  return [
    'This document does not match the format Octo parses. Fix the mechanical problems below in place, changing nothing else:',
    ...fix.map((f) => `- ${f.message}`),
    judge.length
      ? `\nThen address these, which need your judgement:\n${judge.map((f) => `- ${f.message}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function report(findings: FormatFinding[]): FormatReport {
  return {
    findings,
    fixable: findings.filter((f) => f.fixable).length,
    blocking: findings.some((f) => f.blocking),
  };
}
