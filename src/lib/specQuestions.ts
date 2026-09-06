// Generating the Clarify step's questions — the round Octo runs *before* the
// plan, the way Cursor's plan mode asks before it drafts.
//
// The run reads the requirement document and returns questions **with
// pre-loaded options**, because an empty answer box is a worse prompt than two
// concrete choices with their tradeoffs. Output contract:
//
//   Q: How should custom fields be stored?
//   - JSON column in SQLite — no migration, not queryable
//   - Separate table — queryable, needs a migration
//
// Questions land in the requirement doc's `## Open Questions` section (see
// `openQuestions.ts` for the on-disk shape), deduped against what is there.

import { useOrchestrator } from '../stores/orchestrator';
import { addQuestion, cleanOptionText, parseOpenQuestions } from './openQuestions';
import type { SpecMeta } from '../../electron/shared/types';

export interface GeneratedQuestion {
  question: string;
  options: string[];
}

const Q_PREFIX_RE = /^\s*(?:Q\s*\d*\s*[:.)-]|\d+[.)]|[-*]\s*Q[:.])\s*/i;
const OPTION_RE = /^\s*[-*•]\s+(.*)$/;

/**
 * Parse the model's answer into questions + options. Deliberately tolerant: a
 * bare question line without the `Q:` prefix still counts, and a question with
 * no options is kept (the UI falls back to a free-text answer).
 */
export function parseGeneratedQuestions(text: string): GeneratedQuestion[] {
  const out: GeneratedQuestion[] = [];
  const seen = new Set<string>();

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    const isQuestion = Q_PREFIX_RE.test(line) || (!OPTION_RE.test(line) && line.includes('?'));
    if (isQuestion) {
      const question = line.replace(Q_PREFIX_RE, '').trim();
      const key = question.toLowerCase();
      if (question.length < 6 || !/[a-zA-Z]/.test(question) || seen.has(key)) continue;
      seen.add(key);
      out.push({ question, options: [] });
      continue;
    }

    const opt = line.match(OPTION_RE);
    const current = out[out.length - 1];
    if (opt && current) {
      const option = cleanOptionText(opt[1]);
      // An option is a choice, not a paragraph — long prose is the model
      // narrating, and would make an unreadable chip.
      if (option && option.length <= 160) current.options.push(option);
    }
    if (out.length >= 12) break;
  }

  return out.filter((q) => q.question.endsWith('?') || q.options.length > 0);
}

const SYSTEM = `You prepare the CLARIFY step of a spec-driven workflow: the round of questions asked BEFORE the implementation plan is written.

Read the requirement document and surface only the decisions that would MATERIALLY CHANGE the plan — library or dependency choices, data shapes, migration strategy, UX tradeoffs, ambiguous or missing behavior. Ignore anything the document already settles, and anything a competent implementer would just decide.

Output at most 6 questions in EXACTLY this format, nothing else:

Q: <one clear question ending in "?">
- <concrete option> — <the tradeoff, one short clause>
- <concrete option> — <the tradeoff, one short clause>

Rules:
- 2 to 4 options per question, each a real, specific choice (a library name, a data shape, a behavior) — never "yes / no" when a real choice exists, never "it depends".
- Put the option you would recommend FIRST.
- No preamble, no numbering, no commentary, no answers. Do not edit files or use tools.
- If the document leaves nothing material open, output nothing at all.`;

/**
 * Run the clarify-questions pass and append what it found to the requirement
 * document's `## Open Questions`. Resolves with how many questions were added.
 */
export function surfaceQuestions(
  meta: SpecMeta,
  files: Record<string, string>,
  file: string,
  root: string
): Promise<number> {
  return new Promise<number>((resolve) => {
    const md = files[file] ?? '';
    const requestId = crypto.randomUUID();
    let acc = '';
    const orch = useOrchestrator.getState();

    orch.startRun({
      requestId,
      agent: null,
      source: 'surface-questions',
      kind: 'spec',
      title: `Clarify questions · ${meta.name}`,
      specId: meta.id,
      startedAt: Date.now(),
      status: 'running',
    });

    const off = window.octo.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) acc += ev.text;
      if (ev.type !== 'done' && ev.type !== 'error') return;

      off();
      useOrchestrator.getState().finishRun(requestId, ev.type === 'done' ? 'done' : 'error');
      if (ev.type === 'error') return resolve(0);

      const existing = new Set(
        parseOpenQuestions(md).questions.map((q) => q.text.trim().toLowerCase())
      );
      const fresh = parseGeneratedQuestions(acc).filter(
        (q) => !existing.has(q.question.toLowerCase())
      );
      if (!fresh.length) return resolve(0);

      let next = md;
      for (const q of fresh) next = addQuestion(next, q.question, q.options);
      window.octo.specs
        .writeFile(root, meta.id, file, next)
        .then(() => resolve(fresh.length))
        .catch(() => resolve(0));
    });

    const label = file === 'bugfix' ? 'bug analysis' : 'requirements';
    const userText = `${label} document for the spec "${meta.name}":\n\n${md || '(empty)'}\n\nList the open decisions, with options:`;

    window.octo.claude.stream({
      requestId,
      system: SYSTEM,
      messages: [{ role: 'user', content: userText }],
      cwd: root,
      source: 'surface-questions',
      specId: meta.id,
      kind: 'spec',
    });
  });
}
