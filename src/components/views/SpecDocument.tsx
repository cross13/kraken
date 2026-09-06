import { useMemo } from 'react';
import { CheckCircle2, Circle, CheckSquare, Square, FileText } from 'lucide-react';
import { parseSpecDoc, highlightEars, type SpecSection } from '../../lib/specSections';
import { Markdown } from '../Markdown';
import { cn } from '../../lib/cn';

/**
 * Read mode for Requirements / Bugfix / Plan documents — renders the markdown
 * as structured section cards (one per H2), with EARS acceptance criteria and
 * checkbox lists shown as clean checklists.
 *
 * The cards flow into a **auto-fitting grid** rather than one narrow column:
 * the window is wide, and a spec is a set of sections to scan, not a novel to
 * read top to bottom. Each card keeps its own comfortable measure, and wide
 * displays get two or three of them side by side instead of empty gutters.
 */
export function SpecDocument({
  md,
  onEdit,
  source,
}: {
  md: string;
  onEdit?: () => void;
  /** What a draft of this document would be grounded in — shown while it is empty. */
  source?: { label: string; text: string } | null;
}) {
  const doc = useMemo(() => parseSpecDoc(md), [md]);

  // An empty document is genuinely empty now — specs no longer start as a
  // skeleton of `<placeholder>` tokens. So this state carries the weight of the
  // first impression, and it shows the material a draft would use rather than
  // just saying there is none.
  if (!md.trim()) {
    return (
      <div className="h-full overflow-y-auto grid place-items-center px-6 py-8">
        <div className={cn('w-full', source ? 'max-w-xl' : 'max-w-sm text-center')}>
          {!source && (
            <div className="w-12 h-12 mx-auto grid place-items-center rounded-2xl bg-accent/12 text-accent mb-4">
              <FileText size={22} />
            </div>
          )}
          <h3 className="font-display text-base font-semibold text-ink-50 mb-1.5">
            {source ? 'Ready to draft' : 'Nothing here yet'}
          </h3>
          <p className="text-[13px] text-dim leading-relaxed mb-4">
            {source ? (
              <>
                This document is empty. <b className="text-ink-100">Draft with Claude</b> at the
                bottom of the screen writes it from {source.label} below.
              </>
            ) : (
              <>
                Use <b className="text-ink-100">Draft with Claude</b> at the bottom of the screen,
                or switch to <b className="text-ink-100">Edit</b> (⌘E) and write it yourself.
              </>
            )}
          </p>
          {source && (
            <div className="rounded-lg border border-ink-700/70 bg-card p-3.5 mb-4">
              <div className="text-[10px] uppercase tracking-[0.07em] text-ink-500 font-semibold mb-2">
                {source.label}
              </div>
              <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-dim font-sans max-h-[320px] overflow-y-auto">
                {source.text}
              </pre>
            </div>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-[12px] px-3.5 py-1.5 rounded-lg bg-elev text-ink-100 hover:bg-line transition"
            >
              Switch to Edit
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="k-wide py-8">
        {doc.title && (
          <h1 className="font-display text-[30px] font-bold text-ink-50 leading-tight mb-5">
            {doc.title}
          </h1>
        )}
        <div className="k-cards items-start" style={{ ['--k-card' as string]: '540px' }}>
          {doc.sections.map((s, i) => (
            <SectionCard key={s.id} section={s} index={i + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ section, index }: { section: SpecSection; index: number }) {
  return (
    <section className="rounded-2xl bg-card p-6 md:p-7">
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[12px] text-faint tabular-nums">
          {String(index).padStart(2, '0')}
        </span>
        <h2 className="font-display text-[18px] font-semibold text-ink-50 flex-1 min-w-0">
          {section.title}
        </h2>
        {section.isCriteria && (
          <span className="font-mono text-[10px] tracking-wider px-2 py-1 rounded-md bg-accent/12 text-accent shrink-0">
            EARS
          </span>
        )}
      </div>

      {section.isList ? (
        <ul className="space-y-2">
          {section.items.map((it, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl bg-elev/50 px-4 py-3"
            >
              <Marker checked={it.checked} criteria={section.isCriteria} />
              <span
                className={cn(
                  'flex-1 text-[14px] leading-relaxed',
                  it.checked ? 'text-dim line-through decoration-ink-600' : 'text-ink-100'
                )}
                dangerouslySetInnerHTML={{ __html: highlightEars(it.text) }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <Markdown source={section.body} className="text-[14px] leading-relaxed" />
      )}
    </section>
  );
}

function Marker({ checked, criteria }: { checked?: boolean; criteria: boolean }) {
  if (checked === true)
    return <CheckSquare size={17} className="mt-0.5 shrink-0 text-ok" />;
  if (checked === false)
    return <Square size={17} className="mt-0.5 shrink-0 text-faint" />;
  if (criteria)
    return <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-accent" />;
  return <Circle size={7} className="mt-2 shrink-0 fill-faint text-faint" />;
}
