// Parse and edit the `## Open Questions` section of a spec markdown file.
//
// Markdown is the source of truth. The convention mirrors the task checklist
// style so questions stay human-readable and diff-friendly:
//
//   ## Open Questions
//   - [ ] How should we handle rate limiting?
//   - [x] What is the default concurrency? — **Resolved:** Default 2, max 8.
//
// An unchecked item is open; a checked item is resolved, with its answer after
// a `— **Resolved:**` marker on the same line.

export interface ParsedQuestion {
  text: string;
  resolved: boolean;
  answer?: string;
  /** line index within the source markdown — stable for one parsed snapshot */
  lineIndex: number;
  raw: string;
}

export interface ParsedQuestionsDoc {
  questions: ParsedQuestion[];
  /** whether the file already has an `## Open Questions` heading */
  hasSection: boolean;
}

const HEADING_RE = /^#{1,6}\s+/;
const SECTION_RE = /^#{2,6}\s+Open Questions\s*$/i;
const ITEM_RE = /^(\s*)-\s*\[( |x|X)\]\s*(.*)$/;
// "<question> — **Resolved:** <answer>" (accepts a few dash/arrow separators)
const RESOLVED_RE = /^(.*?)\s*(?:—|→|->|--)\s*\*\*Resolved:\*\*\s*(.*)$/;

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
    questions.push({ text, resolved, answer, lineIndex: i, raw: line });
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

export function removeQuestionLine(md: string, lineIndex: number): string {
  const lines = md.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return md;
  lines.splice(lineIndex, 1);
  return lines.join('\n');
}

/** Add a new open question, creating the `## Open Questions` section if absent. */
export function addQuestion(md: string, text: string): string {
  const clean = text.trim();
  if (!clean) return md;
  const item = `- [ ] ${clean}`;
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

  // Insert after the last existing list item in the section (or the heading).
  let insertAfter = sectionIdx;
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    if (HEADING_RE.test(lines[i])) break;
    if (ITEM_RE.test(lines[i])) insertAfter = i;
  }
  lines.splice(insertAfter + 1, 0, item);
  return lines.join('\n');
}

// ---------- Resolved Decisions ----------
// When the requirements' open questions are answered, their Q&A is consolidated
// into a `## Resolved Decisions` section so the design phase consumes settled
// inputs instead of digging through a checklist.

export interface Decision {
  question: string;
  answer: string;
}

const DECISIONS_RE = /^#{2,6}\s+Resolved Decisions\s*$/i;
const DECISIONS_NOTE =
  '<!-- Generated from Open Questions — settled answers that inform the design. -->';

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
