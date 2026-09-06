import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  HelpCircle,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  ArrowRight,
  SkipForward,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useOrchestrator } from '../../stores/orchestrator';
import { cn } from '../../lib/cn';
import {
  parseOpenQuestions,
  updateQuestionLine,
  removeQuestion,
  addQuestion,
  writeDecisionsSection,
  hasDecisionsSection,
  type ParsedQuestion,
} from '../../lib/openQuestions';
import { surfaceQuestions } from '../../lib/specQuestions';
import type { SpecMeta } from '../../../electron/shared/types';

/** key that survives a reload (question text is stable across resolve/reopen) */
const keyOf = (text: string) => text;

/**
 * **Clarify** — the interactive round between the requirements and the plan.
 *
 * Cursor's plan mode asks before it drafts; so does this. Every question is a
 * card with **pre-loaded options**: one click answers it, "Other" takes free
 * text, and Claude can recommend. Answers live in the requirement document's
 * `## Open Questions`, and applying them writes `## Resolved Decisions` — the
 * section the plan prompt treats as settled.
 *
 * Two variants: `stage` (a panel inside the Plan stage, with the footer that
 * continues to the plan) and `overlay` (the slide-over opened from the menu).
 */
export function QuestionsView({
  specId,
  variant = 'overlay',
  onSkip,
  onDone,
}: {
  specId: string;
  variant?: 'overlay' | 'stage';
  /** stage: leave the questions and go straight to the plan document */
  onSkip?: () => void;
  /** stage: decisions written — continue to the plan */
  onDone?: () => void;
}) {
  const root = useWorkspace((s) => s.root)!;
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);

  const [meta, setMeta] = useState<SpecMeta | null>(null);
  const [filesMd, setFilesMd] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genNote, setGenNote] = useState<string | null>(null);

  // Per-question editable answer draft (a suggestion streams here too).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [writing, setWriting] = useState<Record<string, boolean>>({});
  const [suggesting, setSuggesting] = useState<Record<string, boolean>>({});
  const [newQ, setNewQ] = useState('');

  // In-flight suggestion streams, cancelled on unmount.
  const activeRef = useRef<Map<string, () => void>>(new Map());
  useEffect(() => {
    const active = activeRef.current;
    return () => {
      for (const [requestId, off] of active) {
        off();
        void window.octo.claude.cancel(requestId);
      }
      active.clear();
    };
  }, []);

  const load = async () => {
    const res = await window.octo.specs.read(root, specId);
    setMeta(res.meta);
    setFilesMd(res.files);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, specId]);

  // Questions are anchored to the requirement phase file (requirements.md /
  // bugfix.md), so resolving them updates the very doc the plan phase reads.
  const reqFile = meta?.kind === 'bugfix' ? 'bugfix' : 'requirements';
  const reqLabel = `${reqFile}.md`;
  const reqMd = filesMd[reqFile] ?? '';
  const reqExists = typeof filesMd[reqFile] === 'string';

  const questions: ParsedQuestion[] = useMemo(
    () => (reqExists ? parseOpenQuestions(reqMd).questions : []),
    [reqExists, reqMd]
  );
  const open = questions.filter((q) => !q.resolved);
  const resolved = questions.filter((q) => q.resolved);
  const allResolved = questions.length > 0 && open.length === 0;
  const decisionsSynced = hasDecisionsSection(reqMd);
  const progress = questions.length ? resolved.length / questions.length : 0;

  const writeReq = async (newMd: string) => {
    await window.octo.specs.writeFile(root, specId, reqFile, newMd);
    await load();
  };

  const resolveQ = async (q: ParsedQuestion, answer: string) => {
    const key = keyOf(q.text);
    setWriting((w) => ({ ...w, [key]: true }));
    setDrafts((d) => {
      const { [key]: _drop, ...rest } = d;
      return rest;
    });
    try {
      await writeReq(
        updateQuestionLine(reqMd, q.lineIndex, { text: q.text, resolved: true, answer })
      );
    } finally {
      setWriting((w) => ({ ...w, [key]: false }));
    }
  };

  const reopenQ = async (q: ParsedQuestion) => {
    await writeReq(updateQuestionLine(reqMd, q.lineIndex, { text: q.text, resolved: false }));
  };

  const removeQ = async (q: ParsedQuestion) => {
    await writeReq(removeQuestion(reqMd, q));
  };

  const addQ = async () => {
    if (!newQ.trim()) return;
    const text = newQ.trim();
    setNewQ('');
    await writeReq(addQuestion(reqMd, text));
  };

  /** Ask Claude for the decisions worth settling before the plan. */
  const generate = async () => {
    if (!meta || generating) return;
    setGenerating(true);
    setGenNote(null);
    try {
      const added = await surfaceQuestions(meta, filesMd, reqFile, root);
      await load();
      setGenNote(
        added > 0
          ? `${added} question${added === 1 ? '' : 's'} added`
          : 'Nothing material left open — you can go straight to the plan.'
      );
    } finally {
      setGenerating(false);
    }
  };

  // Fold the resolved Q&A into a `## Resolved Decisions` section the plan reads.
  const apply = async (then?: () => void) => {
    if (!resolved.length) return;
    setApplying(true);
    const decisions = resolved.map((q) => ({ question: q.text, answer: q.answer ?? '' }));
    try {
      await writeReq(writeDecisionsSection(reqMd, decisions));
      then?.();
    } finally {
      setApplying(false);
    }
  };

  // Stream a recommended answer for one question into its draft box. With
  // options present, the model has to pick one of them rather than invent a
  // third — that is the whole point of pre-loading the choices.
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

    const system = q.options.length
      ? 'You help settle an open question in a software spec. You are given the requirements, ' +
        'one question, and the candidate options. Pick exactly ONE option and answer with it: ' +
        'restate the chosen option, then one short sentence on why. Never invent a new option ' +
        'unless every option is wrong — then say so in one sentence. No preamble.'
      : 'You help resolve open questions in a software requirements spec. Given the requirements ' +
        'and one open question, propose a concise, decisive recommended answer (2–4 sentences). Be ' +
        'specific and actionable, grounded in the spec. Output only the answer prose — no preamble ' +
        'and do not restate the question.';
    const optionBlock = q.options.length
      ? `\n\nOptions:\n${q.options.map((o) => `- ${o.text}`).join('\n')}`
      : '';
    const userText = `Requirements for "${meta?.name ?? specId}":\n\n${reqMd}\n\n---\n\nOpen question: ${q.text}${optionBlock}\n\nRecommended answer:`;

    return new Promise<void>((resolveP) => {
      const off = window.octo.claude.onEvent((ev) => {
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
      window.octo.claude.stream({
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
    for (const q of open) await suggest(q);
  };

  // 1–9 answers the first unanswered question — the fastest possible pass over
  // a list of choices. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const n = Number(e.key);
      if (!n || n < 1 || n > 9) return;
      const q = open[0];
      const opt = q?.options[n - 1];
      if (!q || !opt) return;
      e.preventDefault();
      void resolveQ(q, opt.text);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // `open` is derived from the document, so the document is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqMd, variant]);

  if (loading) {
    return <div className="p-6 text-sm text-faint">Loading questions…</div>;
  }

  const stage = variant === 'stage';

  return (
    <div className="h-full min-h-0 flex flex-col bg-ink-950">
      {/* Header — what this step is, and how far along it is */}
      <div className="flex items-center gap-4 px-5 py-3 shrink-0 border-b border-ink-50/[0.05]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 grid place-items-center rounded-lg bg-agent/12 text-agent-text shrink-0">
            <HelpCircle size={15} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink-50 leading-tight">
              {stage ? 'Clarify before planning' : 'Open Questions'}
            </div>
            <div className="text-[11px] text-faint truncate">
              Decisions that change the plan · written to{' '}
              <code className="font-mono text-dim">{reqLabel}</code>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 hidden md:flex items-center gap-3">
          {questions.length > 0 && (
            <>
              <div className="h-1.5 flex-1 max-w-[280px] rounded-full bg-ink-50/[0.07] overflow-hidden">
                <div
                  className="h-full rounded-full bg-ok transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <span className="text-[11px] text-faint tabular-nums whitespace-nowrap">
                {resolved.length}/{questions.length} answered
              </span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {genNote && <span className="text-[11px] text-faint hidden lg:inline">{genNote}</span>}
          <button
            onClick={generate}
            disabled={generating || !reqExists}
            title="Ask Claude which decisions must be settled before planning — with options"
            className="text-[12px] font-medium flex items-center gap-1.5 px-3 h-8 rounded-lg bg-agent/15 text-agent-text ring-1 ring-inset ring-agent/25 hover:bg-agent/25 transition disabled:opacity-40"
          >
            {generating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <MessageSquarePlus size={13} />
            )}
            {questions.length ? 'Find more' : 'Find open decisions'}
          </button>
          {open.length > 0 && (
            <button
              onClick={suggestAllOpen}
              title="Have Claude recommend an answer for every open question"
              className="text-[12px] flex items-center gap-1.5 px-3 h-8 rounded-lg bg-elev text-dim hover:text-ink-50 transition"
            >
              <Sparkles size={13} /> Suggest all
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={cn(stage ? 'k-wide' : 'px-5', 'py-5')}>
          {!reqExists ? (
            <div className="text-sm text-faint">
              This spec has no <code className="text-dim">{reqLabel}</code> yet.
            </div>
          ) : questions.length === 0 ? (
            <EmptyState generating={generating} onGenerate={generate} onSkip={onSkip} note={genNote} />
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <QuestionCard
                  key={`${q.lineIndex}:${q.text}`}
                  q={q}
                  hotkeys={stage && q === open[0]}
                  draft={drafts[keyOf(q.text)]}
                  busy={!!suggesting[keyOf(q.text)]}
                  writing={!!writing[keyOf(q.text)]}
                  onDraft={(v) => setDrafts((d) => ({ ...d, [keyOf(q.text)]: v }))}
                  onSuggest={() => suggest(q)}
                  onResolve={(answer) => resolveQ(q, answer)}
                  onReopen={() => reopenQ(q)}
                  onRemove={() => removeQ(q)}
                />
              ))}
            </div>
          )}

          {/* Add your own */}
          {reqExists && (
            <div className="flex items-center gap-1.5 mt-4">
              <input
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addQ()}
                placeholder={`Add a decision to settle before planning…`}
                className="flex-1 text-[12.5px] px-3 py-2 rounded-lg bg-ink-900 ring-1 ring-inset ring-ink-50/[0.06] focus:ring-accent outline-none"
              />
              <button
                onClick={addQ}
                disabled={!newQ.trim()}
                className="text-[12px] flex items-center gap-1 px-3 py-2 rounded-lg bg-elev text-dim hover:text-ink-50 disabled:opacity-40"
              >
                <Plus size={12} /> Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer — the one action that moves the spec forward */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 bg-ink-900/50">
        <span className="text-[11.5px] text-faint leading-snug">
          {questions.length === 0
            ? 'No decisions pending — the plan can be drafted straight away.'
            : allResolved
              ? 'All answered. Applying writes them into the requirements as Resolved Decisions.'
              : `${open.length} question${open.length === 1 ? '' : 's'} still open — answering them makes the plan concrete.`}
          {decisionsSynced && (
            <span className="ml-2 text-ok inline-flex items-center gap-1">
              <Check size={11} /> Decisions written
            </span>
          )}
        </span>
        <div className="flex-1" />
        {stage ? (
          <>
            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg text-dim hover:bg-elev hover:text-ink-100 transition"
            >
              <SkipForward size={13} /> Skip to plan
            </button>
            {questions.length === 0 ? (
              // Nothing to settle — the forward action is simply the plan.
              <button
                onClick={onDone}
                className="flex items-center gap-1.5 text-[12.5px] px-4 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-glow transition"
              >
                <Check size={13} /> Continue <ArrowRight size={12} /> Plan
              </button>
            ) : (
              <button
                onClick={() => void apply(onDone)}
                disabled={!resolved.length || applying}
                title="Write the answers into the requirements, then continue to the plan"
                className="flex items-center gap-1.5 text-[12.5px] px-4 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-glow transition disabled:opacity-40"
              >
                {applying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Apply {resolved.length || ''} decision{resolved.length === 1 ? '' : 's'}
                <ArrowRight size={12} /> Plan
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => void apply()}
            disabled={!resolved.length || applying}
            title={`Write resolved answers into ${reqLabel} as a Resolved Decisions section`}
            className={cn(
              'flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg transition disabled:opacity-40',
              allResolved
                ? 'bg-accent text-accent-fg font-semibold hover:opacity-90'
                : 'bg-elev text-ink-100 hover:bg-line'
            )}
          >
            {applying ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
            {decisionsSynced ? 'Update requirements' : 'Apply to requirements'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EmptyState({
  generating,
  onGenerate,
  onSkip,
  note,
}: {
  generating: boolean;
  onGenerate: () => void;
  onSkip?: () => void;
  note: string | null;
}) {
  return (
    <div className="rounded-2xl bg-card px-6 py-8 text-center">
      <div className="w-11 h-11 mx-auto grid place-items-center rounded-2xl bg-agent/12 text-agent-text mb-3">
        <HelpCircle size={20} />
      </div>
      <h3 className="font-display text-[15px] font-semibold text-ink-50 mb-1">
        Nothing to clarify yet
      </h3>
      <p className="text-[12.5px] text-dim leading-relaxed max-w-[52ch] mx-auto mb-4">
        {note ??
          'Let Claude read the requirements and surface the decisions that would change the plan — each one with concrete options to pick from.'}
      </p>
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 text-[12.5px] px-4 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-glow transition disabled:opacity-50"
        >
          {generating ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <MessageSquarePlus size={13} />
          )}
          Find open decisions
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-[12.5px] px-3.5 py-2 rounded-lg text-dim hover:bg-elev hover:text-ink-100 transition"
          >
            Skip to plan
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  hotkeys,
  draft,
  busy,
  writing,
  onDraft,
  onSuggest,
  onResolve,
  onReopen,
  onRemove,
}: {
  q: ParsedQuestion;
  /** show the 1–9 hints (only the question the keyboard would answer) */
  hotkeys: boolean;
  draft: string | undefined;
  busy: boolean;
  writing: boolean;
  onDraft: (v: string) => void;
  onSuggest: () => void;
  onResolve: (answer: string) => void;
  onReopen: () => void;
  onRemove: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const answerValue = draft ?? q.answer ?? '';
  const hasDraft = draft !== undefined;
  const showBox = custom || hasDraft || busy || (q.resolved && !q.options.length);
  // An option is "chosen" when the answer starts with it — a suggestion adds a
  // trailing "why", and that should still light up the chip it picked.
  const chosen = (text: string) =>
    q.resolved && normalize(q.answer ?? '').startsWith(normalize(text).slice(0, 40));

  return (
    <div
      className={cn(
        'rounded-2xl p-4 md:p-5 ring-1 ring-inset transition',
        q.resolved ? 'bg-card ring-ink-50/[0.05]' : 'bg-card ring-accent/15'
      )}
    >
      <div className="flex items-start gap-2.5">
        {q.resolved ? (
          <CheckCircle2 size={16} className="text-ok mt-0.5 shrink-0" />
        ) : (
          <Circle size={16} className="text-agent-text mt-0.5 shrink-0" />
        )}
        <p className="flex-1 text-[14.5px] font-medium text-ink-50 leading-snug">{q.text}</p>
        <button
          onClick={onRemove}
          title="Delete question"
          className="text-ink-600 hover:text-bad shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Options — one click is the whole answer */}
      {q.options.length > 0 && (
        <div className="mt-3 pl-[26px] k-cards" style={{ ['--k-card' as string]: '260px' }}>
          {q.options.map((o, i) => {
            const active = chosen(o.text);
            return (
              <button
                key={o.lineIndex}
                onClick={() => onResolve(o.text)}
                disabled={writing}
                className={cn(
                  'group flex items-start gap-2.5 text-left px-3.5 py-2.5 rounded-xl ring-1 ring-inset transition disabled:opacity-60',
                  active
                    ? 'bg-ok/10 ring-ok/40 text-ink-50'
                    : 'bg-elev/60 ring-ink-50/[0.06] text-ink-100 hover:bg-elev hover:ring-accent/40'
                )}
              >
                <span
                  className={cn(
                    'mt-[1px] w-[18px] h-[18px] grid place-items-center rounded-md text-[10px] font-semibold shrink-0 tabular-nums',
                    active ? 'bg-ok/20 text-ok' : 'bg-ink-50/[0.07] text-faint'
                  )}
                >
                  {active ? <Check size={11} /> : hotkeys ? i + 1 : String.fromCharCode(65 + i)}
                </span>
                <span className="text-[12.5px] leading-snug">{o.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Resolved, with an answer that came from free text or a suggestion */}
      {q.resolved && !showBox && !q.options.some((o) => chosen(o.text)) && (
        <p className="mt-3 pl-[26px] text-[12.5px] text-dim leading-relaxed">{q.answer}</p>
      )}

      {showBox && (
        <div className="mt-3 pl-[26px]">
          <textarea
            value={answerValue}
            onChange={(e) => onDraft(e.target.value)}
            rows={3}
            autoFocus={custom}
            placeholder="Your answer…"
            className="w-full text-[12.5px] px-3 py-2 rounded-xl bg-ink-950 ring-1 ring-inset ring-ink-50/[0.07] focus:ring-accent outline-none resize-y font-mono text-ink-200"
          />
        </div>
      )}

      <div className="mt-2.5 pl-[26px] flex flex-wrap items-center gap-1.5">
        {!q.resolved && q.options.length > 0 && !showBox && (
          <button
            onClick={() => setCustom(true)}
            className="text-[11.5px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-dim hover:bg-elev hover:text-ink-100"
          >
            <Pencil size={11} /> Other…
          </button>
        )}
        <button
          onClick={onSuggest}
          disabled={busy}
          className="text-[11.5px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-agent-text hover:bg-agent/10 disabled:opacity-50"
          title={
            q.options.length
              ? 'Have Claude pick the best option and say why'
              : 'Suggest an answer with Claude'
          }
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {busy ? 'Thinking…' : q.answer || hasDraft ? 'Re-suggest' : 'Ask Claude'}
        </button>

        {showBox && !q.resolved && (
          <button
            onClick={() => onResolve(answerValue.trim())}
            disabled={!answerValue.trim() || busy || writing}
            className="text-[11.5px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-ok/15 text-ok hover:bg-ok/25 disabled:opacity-40"
          >
            <Check size={11} /> Use this answer
          </button>
        )}

        {q.resolved && (
          <>
            {showBox && (
              <button
                onClick={() => onResolve(answerValue.trim())}
                disabled={!answerValue.trim() || answerValue.trim() === (q.answer ?? '')}
                className="text-[11.5px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-dim hover:bg-elev disabled:opacity-40"
              >
                <Check size={11} /> Save answer
              </button>
            )}
            <button
              onClick={() => {
                setCustom(false);
                onReopen();
              }}
              className="text-[11.5px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-dim hover:bg-elev hover:text-ink-100"
              title="Reopen this question"
            >
              <RotateCcw size={11} /> Change
            </button>
          </>
        )}

        {hotkeys && !q.resolved && q.options.length > 0 && (
          <span className="ml-auto text-[10.5px] text-ink-600 hidden md:inline">
            press 1–{Math.min(q.options.length, 9)} to answer
          </span>
        )}
      </div>
    </div>
  );
}

const normalize = (s: string) => s.trim().toLowerCase();
