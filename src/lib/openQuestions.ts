// Parse and edit the `## Open Questions` section of a spec markdown file.
//
// Markdown is the source of truth. The convention mirrors the task checklist
// style so questions stay human-readable and diff-friendly:
//
//   ## Open Questions
//   - [ ] How should we handle rate limiting?
//     - Token bucket in main — no dependency, resets on restart
//     - Redis-backed — survives restarts, adds a service
//   - [x] What is the default concurrency? — **Resolved:** Default 2, max 8.
//
// An unchecked item is open; a checked item is resolved, with its answer after
// a `— **Resolved:**` marker on the same line.
//
// **Indented list items under a question are its answer options** — the
// pre-loaded choices the Clarify step turns into one-click chips (Cursor's plan
// mode asks with options rather than an empty box). They are plain items, not
// checkboxes, and they survive resolve/reopen so a decision can be revisited.

export interface QuestionOption {
  text: string;
  /** line index of this option within the source markdown */
  lineIndex: number;
}

export interface ParsedQuestion {
  text: string;
  resolved: boolean;
  answer?: string;
  /** line index within the source markdown — stable for one parsed snapshot */
  lineIndex: number;
  raw: string;
  /** indentation width of the question's own list marker */
  indent: number;
  /** pre-loaded answer options, from the indented items under the question */
  options: QuestionOption[];
}

export interface ParsedQuestionsDoc {
  questions: ParsedQuestion[];
  /** whether the file already has an `## Open Questions` heading */
  hasSection: boolean;
}

const HEADING_RE = /^#{1,6}\s+/;
const SECTION_RE = /^#{2,6}\s+Open Questions\s*$/i;
const ITEM_RE = /^(\s*)-\s*\[( |x|X)\]\s*(.*)$/;
/** Any list item — a question (with checkbox) or an option (indented, plain). */
const ANY_ITEM_RE = /^(\s*)[-*]\s+(.*)$/;
// "<question> — **Resolved:** <answer>" (accepts a few dash/arrow separators)
const RESOLVED_RE = /^(.*?)\s*(?:—|→|->|--)\s*\*\*Resolved:\*\*\s*(.*)$/;
/** A stray checkbox on an option line. */
const OPTION_BOX_RE = /^\[[ xX]\]\s*/;
/** Enumeration labels models like to add: "**A.**", "A)", "1.", "b:". */
const OPTION_LABEL_RE = /^(?:\*\*)?(?:[A-Za-z]|\d{1,2})[.):](?:\*\*)?\s+/;

/** The indented items under a question, cleaned of their enumeration label. */
export function cleanOptionText(raw: string): string {
  return raw
    .replace(OPTION_BOX_RE, '')
    .replace(OPTION_LABEL_RE, '')
    // Chips render as plain text, so bold markers would show up literally.
    .replace(/\*\*/g, '')
    .trim();
}

export function parseOpenQuestions(md: string): ParsedQuestionsDoc {
  const lines = md.split('\n');
  const questions: ParsedQuestion[] = [];
  let inSection = false;
  let hasSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SECTION_RE.test(line)) {
      inSection = true;
      hasSection = true;
      continue;
    }
    // Any other heading ends the section.
    if (inSection && HEADING_RE.test(line)) {
      inSection = false;
      continue;
    }
    if (!inSection) continue;

    const item = line.match(ANY_ITEM_RE);
    if (!item) continue;
    const indent = item[1].length;
    const last = questions[questions.length - 1];

    // More indented than the question above it → one of its answer options.
    if (last && indent > last.indent) {
      const text = cleanOptionText(item[2]);
      if (text) last.options.push({ text, lineIndex: i });
      continue;
    }

    const m = line.match(ITEM_RE);
    if (!m) continue;

    const resolved = m[2].toLowerCase() === 'x';
    let text = m[3].trim();
    let answer: string | undefined;
    const rm = text.match(RESOLVED_RE);
    if (rm) {
      text = rm[1].trim();
      answer = rm[2].trim();
    }
    questions.push({ text, resolved, answer, lineIndex: i, raw: line, indent, options: [] });
  }

  return { questions, hasSection };
}

export function serializeQuestion(q: {
  text: string;
  resolved: boolean;
  answer?: string;
}): string {
  const box = q.resolved ? 'x' : ' ';
  const answer = q.answer?.trim();
  if (q.resolved && answer) {
    return `- [${box}] ${q.text.trim()} — **Resolved:** ${answer}`;
  }
  return `- [${box}] ${q.text.trim()}`;
}

/** Replace a single question line, preserving its leading indentation. */
export function updateQuestionLine(
  md: string,
  lineIndex: number,
  q: { text: string; resolved: boolean; answer?: string }
): string {
  const lines = md.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return md;
  const indent = lines[lineIndex].match(/^(\s*)-/)?.[1] ?? '';
  lines[lineIndex] = indent + serializeQuestion(q);
  return lines.join('\n');
}

/** Remove a question **and the option lines that belong to it**. */
export function removeQuestion(md: string, q: ParsedQuestion): string {
  const lines = md.split('\n');
  if (q.lineIndex < 0 || q.lineIndex >= lines.length) return md;
  const last = q.options.length ? q.options[q.options.length - 1].lineIndex : q.lineIndex;
  lines.splice(q.lineIndex, last - q.lineIndex + 1);
  return lines.join('\n');
}

/**
 * Add a new open question (with its pre-loaded options, if any), creating the
 * `## Open Questions` section if absent.
 */
export function addQuestion(md: string, text: string, options: string[] = []): string {
  const clean = text.trim();
  if (!clean) return md;
  const item = [
    `- [ ] ${clean}`,
    ...options.map((o) => o.trim()).filter(Boolean).map((o) => `  - ${o}`),
  ].join('\n');
  const lines = md.split('\n');

  let sectionIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_RE.test(lines[i])) {
      sectionIdx = i;
      break;
    }
  }

  if (sectionIdx === -1) {
    const sep = md.length === 0 || md.endsWith('\n') ? '' : '\n';
    const lead = md.length === 0 ? '' : '\n';
    return `${md}${sep}${lead}## Open Questions\n${item}\n`;
  }

  // Insert after the last existing list item in the section (or the heading) —
  // options included, so a question stays glued to its choices.
  let insertAfter = sectionIdx;
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    if (HEADING_RE.test(lines[i])) break;
    if (ANY_ITEM_RE.test(lines[i])) insertAfter = i;
  }
  lines.splice(insertAfter + 1, 0, ...item.split('\n'));
  return lines.join('\n');
}

// ---------- Resolved Decisions ----------
// When the requirements' open questions are answered, their Q&A is consolidated
// into a `## Resolved Decisions` section so the plan phase consumes settled
// inputs instead of digging through a checklist.

export interface Decision {
  question: string;
  answer: string;
}

const DECISIONS_RE = /^#{2,6}\s+Resolved Decisions\s*$/i;
const DECISIONS_NOTE =
  '<!-- Generated from Open Questions — settled answers that inform the plan. -->';

export function hasDecisionsSection(md: string): boolean {
  return md.split('\n').some((l) => DECISIONS_RE.test(l));
}

/** Build / replace the `## Resolved Decisions` section from the given decisions. */
export function writeDecisionsSection(md: string, decisions: Decision[]): string {
  const body = decisions.length
    ? decisions.map((d) => `- **${d.question.trim()}** — ${d.answer.trim() || '_(no answer)_'}`).join('\n')
    : '_No resolved questions yet._';
  const sectionLines = ['## Resolved Decisions', DECISIONS_NOTE, body];

  const lines = md.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (DECISIONS_RE.test(lines[i])) {
      start = i;
      break;
    }
  }

  if (start === -1) {
    const sep = md.length === 0 || md.endsWith('\n') ? '' : '\n';
    const lead = md.length === 0 ? '' : '\n';
    return `${md}${sep}${lead}${sectionLines.join('\n')}\n`;
  }

  // Replace the existing section (up to the next heading).
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (HEADING_RE.test(lines[i])) {
      end = i;
      break;
    }
  }
  const before = lines.slice(0, start);
  const after = lines.slice(end);
  const out = [...before, ...sectionLines];
  if (after.length) out.push('', ...after);
  return out.join('\n');
}
