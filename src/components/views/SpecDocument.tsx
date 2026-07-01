import { useMemo } from 'react';
import { CheckCircle2, Circle, CheckSquare, Square, FileText } from 'lucide-react';
import { parseSpecDoc, highlightEars, type SpecSection } from '../../lib/specSections';
import { renderMarkdown } from '../../lib/markdown';
import { cn } from '../../lib/cn';

/**
 * Read mode for Requirements / Bugfix / Design documents — renders the markdown
 * as a spacious column of structured section cards (one per H2), with EARS
 * acceptance criteria and checkbox lists shown as clean checklists.
 */
export function SpecDocument({ md, onEdit }: { md: string; onEdit?: () => void }) {
  const doc = useMemo(() => parseSpecDoc(md), [md]);

  if (!md.trim()) {
    return (
      <div className="h-full grid place-items-center px-6">
        <div className="max-w-sm text-center">
          <div className="w-12 h-12 mx-auto grid place-items-center rounded-2xl bg-accent/12 text-accent mb-4">
            <FileText size={22} />
          </div>
          <h3 className="font-display text-base font-semibold text-ink-50 mb-1.5">
            Nothing here yet
          </h3>
          <p className="text-[13px] text-dim leading-relaxed mb-4">
            Use <b className="text-ink-100">Ask Claude</b> in the header to draft this document,
            or switch to <b className="text-ink-100">Edit</b> to write it yourself.
          </p>
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
      <div className="max-w-[1000px] mx-auto px-8 py-10 space-y-5">
        {doc.title && (
          <h1 className="font-display text-[30px] font-bold text-ink-50 leading-tight mb-1">
            {doc.title}
          </h1>
        )}
        {doc.sections.map((s, i) => (
          <SectionCard key={s.id} section={s} index={i + 1} />
        ))}
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
        <div
          className="md text-[14px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(section.body) }}
        />
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
