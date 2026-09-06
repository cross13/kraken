// Zen reading turns a spec document into ROWS, not sections.
//
// The reading view's one structural idea is that every id the app knows —
// the section number, `AC-3`, `T1`, the story a criterion answers — belongs in
// a margin to the left of the prose, never inline. A chip inside the sentence
// is what makes generated specs read like a form; the same id at 11px in the
// gutter keeps the line uninterrupted and the document scannable.
//
// That only works if the id and its text are SIBLINGS in the layout, so this
// module flattens each `## section` into a list of rows that share one
// gutter + column geometry:
//
//   { kind: 'md' }   a run of ordinary markdown (rendered by <Markdown>, so
//                    mermaid, tables and code fences keep working)
//   { kind: 'ids' }  consecutive `AC-1: …` / `- [ ] T2: …` lines, each one
//                    carrying the mark its gutter shows
//
// Everything else about the document is left exactly as written: zen reads the
// markdown, it does not re-model it. Review is where the re-modelling lives.

import { parseSpecDoc, highlightEars } from './specSections';

/** `decide` is the palette's "needs your decision" — the second accent. */
export type ZenTone = 'default' | 'decide';

export interface ZenMark {
  label: string;
  /** the small second line under the label (`US-1`, `vague`, `wave 2`) */
  sub?: string;
  tone: ZenTone;
}

export interface ZenIdItem {
  key: string;
  mark: ZenMark;
  /** inline HTML — EARS keywords, `code` and **bold** already wrapped */
  html: string;
  /** undefined when the line is not a checkbox */
  checked?: boolean;
}

export type ZenRow =
  | { kind: 'md'; key: string; md: string }
  | { kind: 'ids'; key: string; items: ZenIdItem[] };

export interface ZenSection {
  id: string;
  title: string;
  /** `01`… — its position in the document, shown in the gutter */
  number: string;
  tone: ZenTone;
  rows: ZenRow[];
}

export interface ZenStats {
  sections: number;
  /** `AC-n` lines */
  criteria: number;
  /** `T-n` lines */
  tasks: number;
  /** unchecked boxes anywhere in the document */
  open: number;
  minutes: number;
}

export interface ZenDoc {
  title?: string;
  /** the blockquote under the H1 — the brief, or the plan's one-line objective */
  lead?: string;
  sections: ZenSection[];
  stats: ZenStats;
}

/**
 * A top-level line that opens with an id the spec vocabulary knows.
 * Tolerates the checkbox and the `@agent` pin task lines carry:
 *
 *   AC-1: WHEN … THEN …
 *   - US-2: As a reviewer, I want …
 *   - [ ] T3 @frontend-dev: build the panel — _outcome: …_
 */
const ID_LINE =
  /^(?:[-*+]\s+)?(?:\[([ xX])\]\s+)?((?:AC|US|NFR|FR|Q|T|R)[-\s]?\d{1,3}[a-z]?)\s*(?:@[\w./-]+)?\s*[:.—–-]\s+(.+)$/;

const FENCE = /^\s*(?:```|~~~)/;
const BLOCKQUOTE_ONLY = /^\s*>/;
const DECIDE_SECTION = /open question|critical decision|unresolved|needs? (?:a )?decision/i;

/**
 * Case-normalise an id and collapse `US 2` to `US-2`, but never INVENT a
 * separator: the app writes tasks as `T1`, so a gutter reading `T-1` would
 * contradict the `@agent` pins and the Critical Decisions entries beside it.
 */
function normalizeId(raw: string): string {
  const m = /^([A-Za-z]+)([-\s]?)(\d+[a-z]?)$/.exec(raw.trim());
  if (!m) return raw.trim().toUpperCase();
  return `${m[1].toUpperCase()}${m[2] ? '-' : ''}${m[3]}`;
}

const WAVE_H3 = /^###\s+(wave\s*\d+)/i;
const TASK_ID = /^T-?\d/;
const UNCHECKED = /^(?:[-*+]\s+)?\[ \]\s+/gm;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function words(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

export interface ZenOptions {
  /**
   * Lets the caller replace an id's gutter mark with what it knows that the
   * markdown alone cannot say — the user story a criterion answers, or that
   * its wording cannot be tested. Returning undefined keeps the plain id.
   */
  markFor?: (id: string) => Partial<ZenMark> | undefined;
}

export function parseZenDoc(md: string, opts: ZenOptions = {}): ZenDoc {
  const doc = parseSpecDoc(md ?? '');
  let sections = doc.sections;
  let lead: string | undefined;

  // Anything above the first `##` that is purely a blockquote is the document's
  // lead — the composer brief on requirements, the objective line on a plan.
  const first = sections[0];
  if (first && first.title === 'Overview' && first.body.trim()) {
    const lines = first.body.split('\n').filter((l) => l.trim());
    if (lines.every((l) => BLOCKQUOTE_ONLY.test(l))) {
      lead = lines.map((l) => l.replace(/^\s*>\s?/, '')).join(' ').trim();
      sections = sections.slice(1);
    }
  }

  let criteria = 0;
  let tasks = 0;
  // Every unchecked box, wherever it sits — an Open Question is not an id line,
  // and it is exactly the kind of "still open" the end of the document reports.
  const open = ((md ?? '').match(UNCHECKED) ?? []).length;

  const out: ZenSection[] = sections.map((s, i) => {
    const rows: ZenRow[] = [];
    let mdBuf: string[] = [];
    let idBuf: ZenIdItem[] = [];
    let pending: string[] = [];
    let fenced = false;
    let n = 0;
    // A plan's tasks live under `### Wave 1`; the wave is what the gutter wants
    // to say about them, and the caller can still override it.
    let wave: string | null = null;

    const flushMd = () => {
      const body = mdBuf.join('\n').trim();
      mdBuf = [];
      if (body) rows.push({ kind: 'md', key: `${s.id}-m${n++}`, md: body });
    };
    const flushIds = () => {
      if (!idBuf.length) return;
      rows.push({ kind: 'ids', key: `${s.id}-i${n++}`, items: idBuf });
      idBuf = [];
    };

    for (const raw of s.body.split('\n')) {
      if (FENCE.test(raw)) fenced = !fenced;

      const m = fenced ? null : ID_LINE.exec(raw);
      if (m) {
        // A run of id lines survives the blank lines between them.
        pending = [];
        flushMd();
        const id = normalizeId(m[2]);
        const checked = m[1] === undefined ? undefined : m[1].toLowerCase() === 'x';
        if (id.startsWith('AC')) criteria++;
        const isTask = TASK_ID.test(id);
        if (isTask) tasks++;
        const extra = opts.markFor?.(id);
        const sub = extra?.sub ?? (isTask && wave ? wave.toLowerCase() : undefined);
        idBuf.push({
          key: `${s.id}-${id}-${idBuf.length}`,
          mark: { label: extra?.label ?? id, sub, tone: extra?.tone ?? 'default' },
          html: highlightEars(m[3].trim()),
          checked,
        });
        continue;
      }

      if (!raw.trim() && idBuf.length) {
        // Hold the blank: it only ends the run if real prose follows.
        pending.push(raw);
        continue;
      }

      const h3 = fenced ? null : WAVE_H3.exec(raw);
      if (h3) wave = h3[1].replace(/\s+/, ' ').trim();

      if (idBuf.length) flushIds();
      if (pending.length) {
        mdBuf.push(...pending);
        pending = [];
      }
      mdBuf.push(raw);
    }
    flushIds();
    flushMd();

    return {
      id: s.id,
      title: s.title,
      number: pad(i + 1),
      tone: DECIDE_SECTION.test(s.title) ? 'decide' : 'default',
      rows,
    };
  });

  return {
    title: doc.title,
    lead,
    sections: out,
    stats: {
      sections: out.length,
      criteria,
      tasks,
      open,
      minutes: Math.max(1, Math.round(words(md ?? '') / 220)),
    },
  };
}
