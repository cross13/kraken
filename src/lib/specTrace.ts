// The trace: which part of the plan satisfies which acceptance criterion.
//
// Reviewing a plan means answering "is every criterion actually handled, and by
// what?" — a question the two documents can't answer side by side, because
// nothing in markdown states the link. So we derive it, in two ways, and say
// which one we used:
//
// 1. **Explicit** — the plan (or a task) names the criterion: `AC-3`. When a
//    criterion has any explicit link we use ONLY those: an author who wrote the
//    reference meant it, and guessing more would dilute it.
// 2. **Inferred** — distinctive vocabulary shared between the criterion and the
//    section. Code-ish terms (backticked identifiers, `file.ts` paths,
//    camelCase) count triple: two blocks that both talk about `openQuestions.ts`
//    are about the same thing, two that both say "system" are not.
//
// Inference is a reading aid, never a verdict: the UI marks inferred links as
// such, and "no task covers this" is reported as a gap to check, not a failure.

import { parseSpecDoc, type SpecListItem } from './specSections';
import { parseTasks, type ParsedTask } from './tasks';

export interface TraceCriterion {
  /** `AC-1`… — the author's own id when the text carries one, else positional */
  id: string;
  text: string;
  /** the requirements section this criterion came from */
  origin: string;
  sectionIds: string[];
  taskIds: string[];
  /** `path/to/file.ts:42` references found in the linked sections */
  files: string[];
  /** true when the plan names this criterion anywhere — the "confirmed" tier */
  explicit: boolean;
  /** which half of the chain was authored, so the UI never overstates a guess */
  citedIn: { sections: boolean; tasks: boolean };
}

export interface TraceSection {
  id: string;
  title: string;
  body: string;
  items: SpecListItem[];
  isList: boolean;
  isCriteria: boolean;
  criterionIds: string[];
  files: string[];
}

export interface SpecTrace {
  criteria: TraceCriterion[];
  sections: TraceSection[];
  tasks: ParsedTask[];
  /** criteria that reach no task — the thing worth catching before Approve */
  gaps: string[];
  /** true when the plan spells out at least one `AC-n`, so links are authored */
  authored: boolean;
}

// ---------------------------------------------------------------------------
// Vocabulary

const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'when', 'then', 'while', 'shall',
  'system', 'user', 'users', 'should', 'must', 'will', 'have', 'has', 'are', 'is', 'be', 'been',
  'was', 'were', 'not', 'but', 'its', 'it', 'they', 'them', 'their', 'there', 'here', 'each',
  'every', 'any', 'all', 'one', 'two', 'three', 'via', 'per', 'able', 'also', 'only', 'same',
  'such', 'than', 'over', 'under', 'after', 'before', 'where', 'which', 'what', 'who', 'how',
  'can', 'may', 'does', 'do', 'done', 'new', 'old', 'more', 'most', 'less', 'other', 'another',
  'plan', 'spec', 'task', 'tasks', 'section', 'sections', 'change', 'changes', 'file', 'files',
]);

const CODE_TERM = /`([^`]+)`|\b([A-Za-z][\w-]*\.(?:tsx?|jsx?|mjs|cjs|json|css|md|sql|ya?ml))\b|\b([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)\b/g;
const FILE_REF = /`([^`\s]+\.[A-Za-z0-9]+(?::\d+)?)`/g;
const AC_REF = /\bAC[-\s]?(\d{1,3})\b/gi;

interface Terms {
  code: Set<string>;
  words: Set<string>;
}

function terms(text: string): Terms {
  const code = new Set<string>();
  for (const m of text.matchAll(CODE_TERM)) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!raw) continue;
    // `src/lib/openQuestions.ts:26` and `openQuestions.ts` are the same subject.
    const base = raw.split('/').pop()!.split(':')[0].toLowerCase();
    if (base.length >= 3) code.add(base);
  }
  const words = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 4) continue;
    if (STOP.has(raw)) continue;
    const w = stem(raw);
    if (STOP.has(w)) continue;
    words.add(w);
  }
  return { code, words };
}

/**
 * Crude stemmer — enough that "clicks", "clicking" and "click" are one word, and
 * "resolve" matches "resolved". A criterion and a plan describe the same act in
 * different tenses far more often than they share an exact spelling.
 */
function stem(raw: string): string {
  let w = raw;
  if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 4) w = w.slice(0, -1);
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1);
  return w;
}

/**
 * A unit of plan text small enough to be *about* one thing: a paragraph, a list
 * item, a table row. Scoring whole sections doesn't work — a long section (or
 * the task list, which restates everything) shares vocabulary with every
 * criterion and wins them all.
 */
interface Block {
  sectionId: string;
  text: string;
  terms: Terms;
  /** the `path:line` this row points at, when the block is an affected-files row */
  file?: string;
}

const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_RULE = /^\s*\|[\s:|-]+\|\s*$/;

function blocksOf(sectionId: string, body: string): Block[] {
  const out: { sectionId: string; text: string; file?: string }[] = [];
  let para: string[] = [];
  const flush = () => {
    const text = para.join(' ').trim();
    if (text) out.push({ sectionId, text });
    para = [];
  };
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (TABLE_RULE.test(line)) continue;
    const row = TABLE_ROW.exec(line);
    if (row) {
      flush();
      const cells = row[1].split('|').map((c) => c.trim());
      const file = fileRefs(cells[0] ?? '')[0];
      out.push({ sectionId, text: cells.join(' '), file });
      continue;
    }
    if (/^(?:[-*+]|\d+[.)])\s+/.test(line)) {
      flush();
      out.push({ sectionId, text: line.replace(/^(?:[-*+]|\d+[.)])\s+/, '') });
      continue;
    }
    para.push(line);
  }
  flush();
  return out.map((b) => ({ ...b, terms: terms(b.text) }));
}

/**
 * How much a word is worth: one that shows up all over this plan ("question",
 * "plan") says nothing about *which* part matches, while a word used once or
 * twice is close to an identifier.
 */
function weights(all: Terms[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const t of all) for (const w of t.words) df.set(w, (df.get(w) ?? 0) + 1);
  const n = Math.max(all.length, 1);
  const out = new Map<string, number>();
  for (const [w, count] of df) {
    out.set(w, count <= 2 ? 1.4 : count / n <= 0.35 ? 1 : 0.3);
  }
  return out;
}

function overlap(a: Terms, b: Terms, w: Map<string, number>): number {
  let score = 0;
  // A shared identifier (`openQuestions.ts`, `setPlanTab`) is near-proof that
  // two blocks are about the same thing; a shared common word is a hint.
  for (const c of a.code) if (b.code.has(c)) score += 3;
  for (const word of a.words) if (b.words.has(word)) score += w.get(word) ?? 1;
  return score;
}

function acRefs(text: string): string[] {
  return Array.from(text.matchAll(AC_REF)).map((m) => `AC-${Number(m[1])}`);
}

function fileRefs(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(FILE_REF)) {
    const ref = m[1];
    // A bare `package.json` mention is noise; a path or a line number is a
    // pointer the reviewer can actually follow.
    if (ref.includes('/') || ref.includes(':')) out.push(ref);
  }
  return Array.from(new Set(out));
}

/**
 * Keep the links that matter. The cut is **relative to this criterion's own best
 * match** rather than an absolute score, because absolute scores scale with how
 * long and how repetitive the plan is — a fixed floor either links everything in
 * a wordy plan or nothing in a terse one. `floor` only rules out a match that
 * rests on a single common word.
 */
function pick<T extends { score: number }>(scored: T[], floor: number, max: number): T[] {
  const best = scored.reduce((m, s) => Math.max(m, s.score), 0);
  if (best < floor) return [];
  return scored
    .filter((s) => s.score >= floor && s.score >= best * 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/**
 * Link one piece of text to the candidates it shares the most distinctive
 * vocabulary with — the same matcher the plan trace uses, exposed for the
 * requirements review (criterion → user story).
 */
export function bestMatches(
  text: string,
  candidates: { id: string; text: string }[],
  max = 1
): string[] {
  if (!candidates.length) return [];
  const cand = candidates.map((c) => ({ id: c.id, terms: terms(c.text) }));
  const w = weights(cand.map((c) => c.terms));
  const t = terms(text);
  return pick(
    cand.map((c) => ({ id: c.id, score: overlap(t, c.terms, w) })),
    1.2,
    max
  ).map((c) => c.id);
}

// ---------------------------------------------------------------------------

const SHALL = /\bSHALL\b/;

/**
 * Pull the acceptance criteria out of a requirements (or bugfix) document.
 * Criteria are EARS list items; an author-written `AC-3` in the line wins over
 * the positional id, so ids stay stable when the list is reordered.
 */
export function extractCriteria(requirementsMd: string): TraceCriterion[] {
  const doc = parseSpecDoc(requirementsMd);
  const out: TraceCriterion[] = [];
  let n = 0;
  for (const section of doc.sections) {
    // `## Resolved Decisions` and `## Open Questions` are inputs to the plan,
    // not criteria the plan has to satisfy.
    if (/open questions|resolved decisions/i.test(section.title)) continue;
    for (const item of section.items) {
      if (!SHALL.test(item.text)) continue;
      n++;
      const own = acRefs(item.text)[0];
      out.push({
        id: own ?? `AC-${n}`,
        text: item.text.replace(AC_REF, '').replace(/^[\s:.—-]+/, '').trim(),
        origin: section.title,
        sectionIds: [],
        taskIds: [],
        files: [],
        explicit: false,
        citedIn: { sections: false, tasks: false },
      });
    }
  }
  return out;
}

/** Sections that are inputs or bookkeeping, never the answer to a criterion. */
const NOT_AN_ANSWER = /^(tasks|open questions|critical decisions|risks|verification)\b/i;

/**
 * Build the criterion ↔ plan trace. `tasksMd` is optional: before the Plan gate
 * the tasks live only inside the plan's own `## Tasks` section, which is where
 * this falls back to.
 */
export function buildTrace(
  requirementsMd: string,
  planMd: string,
  tasksMd?: string
): SpecTrace {
  const criteria = extractCriteria(requirementsMd);
  const planDoc = parseSpecDoc(planMd);
  const sections: TraceSection[] = planDoc.sections.map((s) => ({
    id: s.id,
    title: s.title,
    body: s.body,
    items: s.items,
    isList: s.isList,
    isCriteria: s.isCriteria,
    criterionIds: [],
    files: fileRefs(s.body),
  }));
  const tasks = parseTasks((tasksMd ?? '').trim() ? tasksMd! : planMd).tasks;

  // `## Tasks` is matched through the task list itself, and the bookkeeping
  // sections restate the whole plan — scoring them would drown everything else.
  const blocks = planDoc.sections
    .filter((s) => !NOT_AN_ANSWER.test(s.title))
    .flatMap((s) => blocksOf(s.id, s.body));
  const taskTerms = tasks.map((t) => terms(t.description));
  const w = weights([...blocks.map((b) => b.terms), ...taskTerms]);

  const authored =
    sections.some((s) => acRefs(s.body).length > 0) ||
    tasks.some((t) => acRefs(t.description).length > 0);

  for (const c of criteria) {
    const ct = terms(c.text);

    const explicitBlocks = blocks.filter((b) => acRefs(b.text).includes(c.id));
    const explicitTasks = tasks.filter((t) => acRefs(t.description).includes(c.id)).map((t) => t.id);
    c.citedIn = { sections: explicitBlocks.length > 0, tasks: explicitTasks.length > 0 };
    c.explicit = c.citedIn.sections || c.citedIn.tasks;

    // Score every block, then roll the winners up to their sections: a section
    // links because one concrete part of it answers the criterion, not because
    // it happens to be long.
    const hits = explicitBlocks.length
      ? explicitBlocks.map((b) => ({ block: b, score: 99 }))
      : pick(
          blocks.map((b) => ({ block: b, score: overlap(ct, b.terms, w) })),
          1.2,
          5
        );

    const sectionIds: string[] = [];
    const files = new Set<string>();
    for (const h of hits) {
      if (!sectionIds.includes(h.block.sectionId)) sectionIds.push(h.block.sectionId);
      if (h.block.file) files.add(h.block.file);
    }
    c.sectionIds = sectionIds.slice(0, 3);

    c.taskIds = explicitTasks.length
      ? explicitTasks
      : pick(
          tasks.map((t, i) => ({ id: t.id, score: overlap(ct, taskTerms[i], w) })),
          1.2,
          3
        ).map((t) => t.id);

    // A task that names files pins them down better than a prose section does.
    for (const id of c.taskIds) {
      const t = tasks.find((x) => x.id === id);
      for (const f of fileRefs(t?.description ?? '')) files.add(f);
    }
    c.files = Array.from(files).slice(0, 6);

    for (const sid of c.sectionIds) {
      const s = sections.find((x) => x.id === sid);
      if (s && !s.criterionIds.includes(c.id)) s.criterionIds.push(c.id);
    }
  }

  return {
    criteria,
    sections,
    tasks,
    gaps: criteria.filter((c) => c.taskIds.length === 0).map((c) => c.id),
    authored,
  };
}
