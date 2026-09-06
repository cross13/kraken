import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, List, X } from 'lucide-react';
import { Markdown } from '../Markdown';
import { cn } from '../../lib/cn';
import { parseZenDoc, type ZenMark, type ZenSection } from '../../lib/zenDoc';
import { reviewRequirements } from '../../lib/reqReview';
import type { SpecDocFile } from '../../lib/specActions';
import type { SpecMeta } from '../../../electron/shared/types';

/**
 * **Zen** — the reading mode for `requirements.md` and `plan.md`.
 *
 * Source, Cards and Review all answer a question *about* the document. Zen
 * answers none: it is the document, for a human who has to read it and decide.
 * So it takes the whole window and drops every piece of chrome the reading does
 * not need — file tabs, the phase strip, the view switcher, the gate bar.
 *
 * Three things are left, and each earns its place:
 *
 * - **One column at a reading measure.** Long-form type, not UI type.
 * - **The gutter.** Every id the app knows (`AC-3`, `T1`, the story a criterion
 *   answers, the section number) sits in an 84px margin to the LEFT of the
 *   prose instead of as a chip inside it — see `lib/zenDoc.ts`. The second
 *   accent in the gutter means the same thing it means everywhere else in Octo:
 *   this one needs your decision.
 * - **The spine.** Where you are, and how much is left. It follows the scroll.
 *
 * The gate action lives at the END of the document rather than in permanent
 * chrome: you read the plan, and then you approve it.
 */

type Measure = 'comfort' | 'wide';

const MEASURE_PX: Record<Measure, number> = { comfort: 752, wide: 940 };
const GUTTER = 112; // 84px margin + 28px gap

function load<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    // storage disabled — the preference just doesn't persist
  }
}

export function ZenReader({
  meta,
  file,
  fileName,
  content,
  files,
  gate,
  onClose,
}: {
  meta: SpecMeta;
  file: SpecDocFile;
  fileName: string;
  content: string;
  files: Record<string, string>;
  /** the one action that moves the spec forward, when this doc is at its gate */
  gate: { label: string; next: string; blocked?: string | null; onApprove: () => Promise<void> } | null;
  onClose: () => void;
}) {
  const [measure, setMeasure] = useState<Measure>(() => load<Measure>('octo.zen.measure', 'comfort'));
  const [focus, setFocus] = useState(() => load('octo.zen.focus', 'on') === 'on');
  const [active, setActive] = useState<string | null>(null);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // What the markdown alone cannot say: which story a criterion answers, and
  // whether its wording can be tested at all. Same source as the Review view,
  // so the two modes never disagree about the same document.
  const marks = useMemo(() => {
    if (file !== 'requirements' && file !== 'bugfix') return null;
    const map = new Map<string, Partial<ZenMark>>();
    try {
      const r = reviewRequirements(content, files.plan, files.tasks);
      for (const s of r.stories) {
        if (!s.criterionIds.length) map.set(s.id, { sub: 'no criterion', tone: 'decide' });
      }
      for (const c of r.criteria) {
        if (c.vague.length) map.set(c.id, { sub: 'vague', tone: 'decide' });
        else if (!c.storyId) map.set(c.id, { sub: 'no story', tone: 'decide' });
        else map.set(c.id, { sub: c.storyId });
      }
    } catch {
      // A document too malformed to review still has to be readable.
    }
    return map;
  }, [file, content, files.plan, files.tasks]);

  const markFor = useCallback((id: string) => marks?.get(id), [marks]);
  const doc = useMemo(() => parseZenDoc(content, { markFor }), [content, markFor]);

  const colW = MEASURE_PX[measure];
  const activeId = active ?? doc.sections[0]?.id ?? null;
  const activeIdx = Math.max(0, doc.sections.findIndex((s) => s.id === activeId));

  useEffect(() => save('octo.zen.measure', measure), [measure]);
  useEffect(() => save('octo.zen.focus', focus ? 'on' : 'off'), [focus]);

  // Esc leaves. Captured, so it never also closes the slide-over behind zen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // The spine follows the scroll: the active section is the last one whose
  // heading has passed the reading line, a little below the top of the column.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const measureNow = () => {
      frame = 0;
      const line = el.getBoundingClientRect().top + 160;
      let current = doc.sections[0]?.id ?? null;
      for (const s of doc.sections) {
        const node = sectionRefs.current[s.id];
        if (node && node.getBoundingClientRect().top <= line) current = s.id;
      }
      setActive((prev) => (prev === current ? prev : current));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measureNow);
    };
    measureNow();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [doc.sections]);

  const jump = (id: string) => {
    setContentsOpen(false);
    setActive(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const approve = async () => {
    if (!gate || gate.blocked) return;
    setApproving(true);
    try {
      await gate.onApprove();
      onClose();
    } finally {
      setApproving(false);
    }
  };

  const stackStyle = { width: colW + GUTTER, maxWidth: '100%' } as const;
  const proseStyle = { fontSize: 17.5, lineHeight: 1.72 } as const;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-rail text-dim font-sans">
      {/* The only permanent chrome in the whole mode: 2px of progress. */}
      <div className="h-[2px] shrink-0 bg-ink-50/[0.05]">
        <div
          className="h-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${Math.round(((activeIdx + 1) / Math.max(1, doc.sections.length)) * 100)}%` }}
        />
      </div>

      {/* Zen covers the whole window, title bar included, so this strip IS the
          title bar: it stays draggable and leaves room for the traffic lights. */}
      <div className="titlebar-drag flex items-center gap-3 h-[52px] px-4 shrink-0">
        <div className="w-16 shrink-0" />

        {/* Below xl the spine has nowhere to live, so Contents folds in here. */}
        <div className="relative xl:hidden titlebar-nodrag">
          <button
            onClick={() => setContentsOpen((o) => !o)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-ink-50/[0.05] text-[11.5px] text-ink-100 hover:bg-ink-50/[0.09] transition"
          >
            <List size={12} className="text-faint" />
            {doc.sections[activeIdx]?.number} · {doc.sections[activeIdx]?.title ?? fileName}
            <ChevronDown size={11} className="text-faint" />
          </button>
          {contentsOpen && (
            <div
              onMouseLeave={() => setContentsOpen(false)}
              className="absolute left-0 top-9 z-10 w-[280px] max-h-[60vh] overflow-y-auto rounded-xl bg-elev ring-1 ring-ink-50/[0.07] shadow-card p-1.5"
            >
              {doc.sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => jump(s.id)}
                  className={cn(
                    'w-full flex items-baseline gap-2.5 px-2.5 py-2 rounded-lg text-left transition',
                    s.id === activeId ? 'bg-ink-50/[0.06] text-ink-50' : 'text-dim hover:bg-ink-50/[0.04]'
                  )}
                >
                  <span className="font-mono text-[10px] text-faint">{s.number}</span>
                  <span className="text-[12.5px] leading-snug">{s.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="hidden xl:inline font-mono text-[11px] text-faint tracking-wide">{fileName}</span>
        <span className="font-mono text-[11px] text-ink-600">/</span>
        <span className="font-mono text-[11px] text-faint truncate min-w-0">{meta.name}</span>

        <div className="titlebar-nodrag ml-auto flex items-center gap-5 shrink-0">
          <div className="hidden lg:flex items-center gap-2.5">
            <span className="font-mono text-[10px] tracking-[0.12em] text-ink-600">MEASURE</span>
            {(['comfort', 'wide'] as Measure[]).map((m) => (
              <button
                key={m}
                onClick={() => setMeasure(m)}
                className={cn(
                  'text-[11.5px] transition',
                  measure === m ? 'text-ink-100' : 'text-ink-600 hover:text-dim'
                )}
              >
                {m === 'comfort' ? 'Comfortable' : 'Wide'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setFocus((f) => !f)}
            title="Dims every section but the one you are reading"
            className={cn(
              'text-[11.5px] transition',
              focus ? 'text-accent-text' : 'text-ink-600 hover:text-dim'
            )}
          >
            {focus ? 'Focus on' : 'Focus off'}
          </button>
          <button
            onClick={onClose}
            title="Leave zen  (Esc)"
            className="flex items-center gap-1.5 font-mono text-[10.5px] text-ink-600 hover:text-dim transition"
          >
            <X size={12} />
            Esc
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* The spine — where you are, and how far is left. */}
        <div className="hidden xl:flex w-[252px] shrink-0 flex-col pl-8 pt-9">
          <div className="font-mono text-[10px] tracking-[0.14em] text-ink-600 mb-4">CONTENTS</div>
          {/* `pl-3 -ml-3` keeps the active tick inside the scroll box: it sits 12px
              left of the row, and an overflow container would otherwise clip it. */}
          <div className="flex flex-col overflow-y-auto min-h-0 pl-3 -ml-3">
            {doc.sections.map((s, i) => {
              const on = s.id === activeId;
              return (
                <button
                  key={s.id}
                  onClick={() => jump(s.id)}
                  className="relative flex items-baseline gap-2.5 pr-3.5 py-1.5 text-left group"
                >
                  <span
                    className={cn(
                      'absolute -left-3 top-1.5 bottom-1.5 w-[2px] transition-colors',
                      on ? 'bg-accent' : 'bg-transparent'
                    )}
                  />
                  <span className={cn('font-mono text-[10px]', on ? 'text-accent-text' : 'text-ink-600')}>
                    {s.number}
                  </span>
                  <span
                    className={cn(
                      'text-[12.5px] leading-snug transition-colors group-hover:text-ink-100',
                      on ? 'text-ink-50' : i < activeIdx ? 'text-ink-600' : 'text-faint'
                    )}
                  >
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto pb-7 pt-4">
            <div className="h-px w-[150px] bg-ink-50/[0.07] mb-3" />
            <div className="font-mono text-[10.5px] leading-[1.7] text-ink-600">
              {doc.stats.sections} sections
              <br />~{doc.stats.minutes} min read
              {doc.stats.open > 0 && (
                <>
                  <br />
                  <span className="text-agent-text">{doc.stats.open} still open</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto">
          <div className="flex justify-center px-6 lg:px-10 pt-9">
            <div className="zen-prose" style={{ ...stackStyle, ...proseStyle }}>
              {(doc.title || doc.lead) && (
                <ZenRow>
                  <div className="mb-14">
                    <div className="font-mono text-[10.5px] tracking-[0.16em] text-faint mb-4">
                      {file === 'plan' ? 'TECHNICAL PLAN' : file === 'tasks' ? 'TASKS' : 'REQUIREMENTS'}
                    </div>
                    {doc.title && (
                      <h1 className="font-display text-[36px] font-semibold leading-[1.14] tracking-[-0.015em] text-ink-50 mb-5">
                        {doc.title}
                      </h1>
                    )}
                    {doc.lead && (
                      <p className="border-l-2 border-accent pl-[18px] text-[18px] leading-[1.6] text-ink-200 m-0">
                        {doc.lead}
                      </p>
                    )}
                  </div>
                </ZenRow>
              )}

              {doc.sections.map((s) => (
                <Section
                  key={s.id}
                  section={s}
                  dim={focus && s.id !== activeId}
                  innerRef={(el) => {
                    sectionRefs.current[s.id] = el;
                  }}
                />
              ))}

              {/* The end of the document is where the action belongs. */}
              <ZenRow>
                <div className="mt-[76px] mb-32">
                  <div className="h-px bg-ink-50/[0.08] mb-[30px]" />
                  <div className="flex items-center gap-5 flex-wrap">
                    <div>
                      <div className="font-display text-[15px] font-semibold text-ink-200 mb-0.5">
                        End of {fileName}
                      </div>
                      <div className="font-mono text-[11px] text-faint">
                        {doc.stats.sections} sections
                        {doc.stats.criteria > 0 && ` · ${doc.stats.criteria} criteria`}
                        {doc.stats.tasks > 0 && ` · ${doc.stats.tasks} tasks`}
                        {doc.stats.open > 0 && ` · ${doc.stats.open} open`}
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={onClose}
                        className="px-3.5 py-2.5 rounded-lg text-[13px] text-faint hover:text-ink-100 hover:bg-ink-50/[0.05] transition"
                      >
                        Back to editor
                      </button>
                      {gate && (
                        <button
                          onClick={approve}
                          disabled={!!gate.blocked || approving}
                          title={gate.blocked ?? `Marks ${fileName} approved and opens ${gate.next}`}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition',
                            gate.blocked
                              ? 'bg-elev text-ink-600 cursor-not-allowed'
                              : 'bg-accent text-accent-fg hover:brightness-110'
                          )}
                        >
                          {approving ? 'Approving…' : gate.label}
                          <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  {gate?.blocked && (
                    <p className="mt-3 text-[12.5px] text-agent-text m-0">{gate.blocked}</p>
                  )}
                </div>
              </ZenRow>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One row of the reading grid: a gutter that holds the ids, and the column that
 * holds the prose. Below xl the gutter has nowhere to go, so the mark moves
 * above the block instead of beside it.
 */
function ZenRow({
  mark,
  children,
}: {
  mark?: { label: string; sub?: string; tone: 'default' | 'decide' };
  children: React.ReactNode;
}) {
  return (
    <div className="zen-row">
      <div className="zen-gutter">
        {mark && (
          <>
            <span
              className={cn(
                'font-mono text-[11px]',
                mark.tone === 'decide' ? 'text-agent-text' : 'text-faint'
              )}
            >
              {mark.label}
            </span>
            {mark.sub && (
              <span
                className={cn(
                  'zen-sub font-mono text-[9.5px]',
                  mark.tone === 'decide' ? 'text-agent-text/70' : 'text-ink-600'
                )}
              >
                {mark.sub}
              </span>
            )}
          </>
        )}
      </div>
      <div className="zen-col">{children}</div>
    </div>
  );
}

function Section({
  section,
  dim,
  innerRef,
}: {
  section: ZenSection;
  dim: boolean;
  innerRef: (el: HTMLElement | null) => void;
}) {
  return (
    <section
      ref={innerRef}
      className="scroll-mt-11 transition-opacity duration-200"
      style={{ opacity: dim ? 0.3 : 1 }}
    >
      <ZenRow
        mark={{
          label: section.number,
          sub: section.tone === 'decide' ? 'for you' : undefined,
          tone: section.tone,
        }}
      >
        <h2 className="font-display text-[22px] font-semibold tracking-[-0.008em] text-ink-50 mb-4">
          {section.title}
        </h2>
      </ZenRow>

      {section.rows.map((row) =>
        row.kind === 'md' ? (
          <ZenRow key={row.key}>
            <Markdown source={row.md} />
          </ZenRow>
        ) : (
          row.items.map((it) => (
            <ZenRow key={it.key} mark={it.mark}>
              <div className="flex gap-3 items-start mb-3.5">
                {it.checked !== undefined && <Box checked={it.checked} decide={it.mark.tone === 'decide'} />}
                <span
                  className={cn('flex-1 min-w-0', it.checked === true && 'text-faint')}
                  dangerouslySetInnerHTML={{ __html: it.html }}
                />
              </div>
            </ZenRow>
          ))
        )
      )}
      {/* The ramp's own margins carry most of the gap; this is the rest of it. */}
      <div className="h-[26px]" />
    </section>
  );
}

function Box({ checked, decide }: { checked: boolean; decide: boolean }) {
  return (
    <span
      className={cn(
        'mt-1.5 w-[14px] h-[14px] shrink-0 grid place-items-center rounded-sm',
        checked
          ? 'bg-accent text-accent-fg'
          : decide
            ? 'ring-[1.5px] ring-inset ring-agent'
            : 'ring-[1.5px] ring-inset ring-ink-600'
      )}
    >
      {checked && <Check size={10} strokeWidth={3} />}
    </span>
  );
}
