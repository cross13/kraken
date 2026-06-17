import { useEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  Circle,
  CheckCircle2,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  ArrowRight,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useOrchestrator } from '../../stores/orchestrator';
import { cn } from '../../lib/cn';
import {
  parseOpenQuestions,
  updateQuestionLine,
  removeQuestionLine,
  addQuestion,
  writeDecisionsSection,
  hasDecisionsSection,
  type ParsedQuestion,
} from '../../lib/openQuestions';
import type { SpecMeta } from '../../../electron/shared/types';

/** key that survives a reload (question text is stable across resolve/reopen) */
const keyOf = (text: string) => text;

export function QuestionsView({ specId }: { specId: string }) {
  const root = useWorkspace((s) => s.root)!;
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);

  const [meta, setMeta] = useState<SpecMeta | null>(null);
  const [filesMd, setFilesMd] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  // Per-question editable answer draft (suggestion streams here too).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [suggesting, setSuggesting] = useState<Record<string, boolean>>({});
  const [newQ, setNewQ] = useState('');

  // In-flight suggestion streams, cancelled on unmount.
  const activeRef = useRef<Map<string, () => void>>(new Map());
  useEffect(() => {
    const active = activeRef.current;
    return () => {
      for (const [requestId, off] of active) {
        off();
        void window.kraken.claude.cancel(requestId);
      }
      active.clear();
    };
  }, []);

  const load = async () => {
    const res = await window.kraken.specs.read(root, specId);
    setMeta(res.meta);
    setFilesMd(res.files);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, specId]);

  // Questions are anchored to the requirement phase file (requirements.md /
  // bugfix.md), so resolving them updates the very doc the design phase reads.
  const reqFile = meta?.kind === 'bugfix' ? 'bugfix' : 'requirements';
  const reqLabel = `${reqFile}.md`;
  const reqMd = filesMd[reqFile] ?? '';
  const reqExists = typeof filesMd[reqFile] === 'string';

  const questions: ParsedQuestion[] = reqExists ? parseOpenQuestions(reqMd).questions : [];
  const openCount = questions.filter((q) => !q.resolved).length;
  const resolved = questions.filter((q) => q.resolved);
  const allResolved = questions.length > 0 && openCount === 0;
  const decisionsSynced = hasDecisionsSection(reqMd);

  const writeReq = async (newMd: string) => {
    await window.kraken.specs.writeFile(root, specId, reqFile, newMd);
    await load();
  };

  const resolveQ = async (q: ParsedQuestion, answer: string) => {
    setDrafts((d) => {
      const { [keyOf(q.text)]: _drop, ...rest } = d;
      return rest;
    });
    await writeReq(
      updateQuestionLine(reqMd, q.lineIndex, { text: q.text, resolved: true, answer })
    );
  };

  const reopenQ = async (q: ParsedQuestion) => {
    await writeReq(updateQuestionLine(reqMd, q.lineIndex, { text: q.text, resolved: false }));
  };

  const removeQ = async (q: ParsedQuestion) => {
    await writeReq(removeQuestionLine(reqMd, q.lineIndex));
  };

  const addQ = async () => {
    if (!newQ.trim()) return;
    const text = newQ.trim();
    setNewQ('');
    await writeReq(addQuestion(reqMd, text));
  };

  // Fold the resolved Q&A into a `## Resolved Decisions` section the design step reads.
  const applyToRequirements = async () => {
    if (!resolved.length) return;
    setApplying(true);
    const decisions = resolved.map((q) => ({ question: q.text, answer: q.answer ?? '' }));
    try {
      await writeReq(writeDecisionsSection(reqMd, decisions));
    } finally {
      setApplying(false);
    }
  };

  // Stream a recommended answer for one question into its draft box.
  const suggest = (q: ParsedQuestion): Promise<void> => {
    const key = keyOf(q.text);
    if (suggesting[key]) return Promise.resolve();
    setSuggesting((s) => ({ ...s, [key]: true }));
    setDrafts((d) => ({ ...d, [key]: '' }));

    const requestId = crypto.randomUUID();
    startRun({
      requestId,
      agent: null,
      source: 'open-questions',
      kind: 'spec',
      title: `Answer · ${q.text.slice(0, 48)}`,
      specId,
      startedAt: Date.now(),
      status: 'running',
    });

    const system =
      'You help resolve open questions in a software requirements spec. Given the requirements ' +
      'and one open question, propose a concise, decisive recommended answer (2–4 sentences). Be ' +
      'specific and actionable, grounded in the spec. Output only the answer prose — no preamble ' +
      'and do not restate the question.';
    const userText = `Requirements for "${meta?.name ?? specId}":\n\n${reqMd}\n\n---\n\nOpen question: ${q.text}\n\nRecommended answer:`;

    return new Promise<void>((resolveP) => {
      const off = window.kraken.claude.onEvent((ev) => {
        if (ev.requestId !== requestId) return;
        if (ev.type === 'delta' && ev.text) {
          setDrafts((d) => ({ ...d, [key]: (d[key] ?? '') + ev.text }));
        }
        if (ev.type === 'done' || ev.type === 'error') {
          off();
          activeRef.current.delete(requestId);
          setSuggesting((s) => ({ ...s, [key]: false }));
          finishRun(requestId, ev.type === 'done' ? 'done' : 'error');
          resolveP();
        }
      });
      activeRef.current.set(requestId, off);
      window.kraken.claude.stream({
        requestId,
        system,
        messages: [{ role: 'user', content: userText }],
        cwd: root,
        source: 'open-questions',
        specId,
        kind: 'spec',
      });
    });
  };

  const suggestAllOpen = async () => {
    for (const q of questions.filter((q) => !q.resolved)) {
      await suggest(q);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-ink-400">Loading questions…</div>;
  }

  return (
    <div className="h-full flex flex-col bg-ink-950">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-ink-800 px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 grid place-items-center rounded-lg bg-accent/10 text-accent shrink-0">
            <HelpCircle size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
              Open Questions · <span className="font-mono normal-case text-ink-400">{reqLabel}</span>
            </div>
            <div className="text-base font-semibold text-ink-50 truncate leading-tight">
              {meta?.name ?? specId}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-[11px] text-ink-400 flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Circle size={10} className="text-warn" /> {openCount} open
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={10} className="text-ok" /> {resolved.length} resolved
            </span>
          </div>
          {openCount > 0 && (
            <button
              onClick={suggestAllOpen}
              className="text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent ring-1 ring-inset ring-accent/30 hover:bg-accent/25 transition"
              title="Suggest answers for every open question"
            >
              <Sparkles size={13} /> Suggest all
            </button>
          )}
        </div>
      </div>

      {/* Apply-to-requirements banner */}
      {questions.length > 0 && (
        <div
          className={cn(
            'flex items-center gap-3 px-6 py-2.5 border-b border-ink-800 text-[11px]',
            allResolved ? 'bg-ok/5' : 'bg-ink-900/40'
          )}
        >
          <div className="flex-1 text-ink-300 leading-snug">
            {allResolved ? (
              <>
                All questions answered. Apply them to <code className="text-ink-200">{reqLabel}</code>{' '}
                so the <b className="text-ink-100">design step</b> uses these decisions.
              </>
            ) : (
              <>
                Answer the {openCount} open question{openCount === 1 ? '' : 's'}, then apply them to{' '}
                <code className="text-ink-200">{reqLabel}</code> for the design step.
              </>
            )}
            {decisionsSynced && (
              <span className="ml-2 text-ok inline-flex items-center gap-1">
                <Check size={11} /> Resolved Decisions written
              </span>
            )}
          </div>
          <button
            onClick={applyToRequirements}
            disabled={!resolved.length || applying}
            className={cn(
              'shrink-0 text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition disabled:opacity-40',
              allResolved
                ? 'bg-accent text-accent-fg hover:opacity-90'
                : 'bg-ink-800 text-ink-200 hover:bg-ink-700'
            )}
            title={`Write resolved answers into ${reqLabel} as a Resolved Decisions section`}
          >
            {applying ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
            {decisionsSynced ? 'Update requirements' : 'Apply to requirements'}
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {!reqExists ? (
          <div className="text-sm text-ink-400">
            This spec has no <code className="text-ink-300">{reqLabel}</code> yet.
          </div>
        ) : questions.length === 0 ? (
          <div className="text-sm text-ink-400 mb-3">
            No open questions yet. Add the decisions you need to settle before design.
          </div>
        ) : (
          <div className="space-y-2 mb-3">
            {questions.map((q) => (
              <QuestionCard
                key={`${q.lineIndex}:${q.text}`}
                q={q}
                draft={drafts[keyOf(q.text)]}
                busy={!!suggesting[keyOf(q.text)]}
                onDraft={(v) => setDrafts((d) => ({ ...d, [keyOf(q.text)]: v }))}
                onSuggest={() => suggest(q)}
                onResolve={(answer) => resolveQ(q, answer)}
                onReopen={() => reopenQ(q)}
                onRemove={() => removeQ(q)}
              />
            ))}
          </div>
        )}

        {/* Add */}
        {reqExists && (
          <div className="flex items-center gap-1.5">
            <input
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addQ()}
              placeholder={`Add a question to ${reqLabel}…`}
              className="flex-1 text-xs px-2 py-1.5 rounded-md bg-ink-900 border border-ink-800 focus:border-accent outline-none"
            />
            <button
              onClick={addQ}
              disabled={!newQ.trim()}
              className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
            >
              <Plus size={12} /> Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  draft,
  busy,
  onDraft,
  onSuggest,
  onResolve,
  onReopen,
  onRemove,
}: {
  q: ParsedQuestion;
  draft: string | undefined;
  busy: boolean;
  onDraft: (v: string) => void;
  onSuggest: () => void;
  onResolve: (answer: string) => void;
  onReopen: () => void;
  onRemove: () => void;
}) {
  const answerValue = draft ?? q.answer ?? '';
  const hasDraft = draft !== undefined;

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        q.resolved ? 'border-ink-800 bg-ink-900/40' : 'border-ink-800 bg-ink-900/70'
      )}
    >
      <div className="flex items-start gap-2">
        {q.resolved ? (
          <CheckCircle2 size={15} className="text-ok mt-0.5 shrink-0" />
        ) : (
          <Circle size={15} className="text-warn mt-0.5 shrink-0" />
        )}
        <p className="flex-1 text-sm text-ink-100 leading-snug">{q.text}</p>
        <button
          onClick={onRemove}
          title="Delete question"
          className="text-ink-600 hover:text-bad shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {(q.resolved || hasDraft || busy) && (
        <div className="mt-2 pl-6">
          <textarea
            value={answerValue}
            onChange={(e) => onDraft(e.target.value)}
            rows={3}
            placeholder="Recommended answer…"
            className="w-full text-xs px-2 py-1.5 rounded-md bg-ink-950 border border-ink-800 focus:border-accent outline-none resize-y font-mono text-ink-200"
          />
        </div>
      )}

      <div className="mt-2 pl-6 flex items-center gap-1.5">
        <button
          onClick={onSuggest}
          disabled={busy}
          className="text-[11px] flex items-center gap-1 px-2 py-1 rounded text-accent hover:bg-accent/10 disabled:opacity-50"
          title="Suggest an answer with Claude"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {busy ? 'Suggesting…' : q.answer || hasDraft ? 'Re-suggest' : 'Suggest answer'}
        </button>

        {!q.resolved && (
          <button
            onClick={() => onResolve(answerValue.trim())}
            disabled={!answerValue.trim() || busy}
            className="text-[11px] flex items-center gap-1 px-2 py-1 rounded bg-ok/15 text-ok hover:bg-ok/25 disabled:opacity-40"
            title="Mark resolved with this answer"
          >
            <Check size={11} /> Resolve
          </button>
        )}

        {q.resolved && (
          <>
            <button
              onClick={() => onResolve(answerValue.trim())}
              disabled={!answerValue.trim() || answerValue.trim() === (q.answer ?? '')}
              className="text-[11px] flex items-center gap-1 px-2 py-1 rounded text-ink-300 hover:bg-ink-800 disabled:opacity-40"
              title="Save edited answer"
            >
              <Check size={11} /> Save answer
            </button>
            <button
              onClick={onReopen}
              className="text-[11px] flex items-center gap-1 px-2 py-1 rounded text-ink-300 hover:bg-ink-800"
              title="Reopen this question"
            >
              <RotateCcw size={11} /> Reopen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
