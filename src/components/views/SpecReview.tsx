import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, FileCode2, Link2, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { cn } from '../../lib/cn';
import { Markdown } from '../Markdown';
import { highlightEars } from '../../lib/specSections';
import { buildTrace, type TraceCriterion } from '../../lib/specTrace';

/**
 * **Review** — the plan read against the requirements, side by side.
 *
 * Source and Cards each show one document at a time, which is the wrong shape
 * for the question a reviewer actually has: *is every criterion handled, and by
 * what?* Here the criteria sit on the left and the plan on the right, and
 * selecting a criterion pulls its part of the plan forward — the sections that
 * satisfy it stay lit, everything else recedes, and the criterion opens the
 * chain it reaches: section → task → file.
 *
 * The links are derived (`lib/specTrace.ts`), explicitly when the plan names an
 * `AC-n` and by shared vocabulary otherwise — inferred links say so, because a
 * guess presented as a fact is worse than no link at all.
 */
export function SpecReview({
  requirementsMd,
  planMd,
  tasksMd,
  reqLabel,
}: {
  requirementsMd: string;
  planMd: string;
  tasksMd: string;
  /** `requirements.md` or `bugfix.md` — the doc the criteria come from */
  reqLabel: string;
}) {
  const root = useWorkspace((s) => s.root);
  const openOverlay = useUi((s) => s.openOverlay);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'inferred' | 'gaps'>('all');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const trace = useMemo(
    () => buildTrace(requirementsMd, planMd, tasksMd),
    [requirementsMd, planMd, tasksMd]
  );

  const { criteria, sections, gaps } = trace;
  const selected = criteria.find((c) => c.id === sel) ?? null;
  // Coverage is claimed at two strengths, and the difference matters: a plan
  // that writes `AC-3` has been checked by its author, while a match we inferred
  // from shared wording is a lead. Reporting both as "covered" would be a lie
  // that hides exactly the criteria worth re-reading.
  const confirmed = criteria.filter((c) => c.explicit && c.taskIds.length > 0);
  const inferred = criteria.filter((c) => !c.explicit && c.taskIds.length > 0);
  const shown =
    filter === 'gaps'
      ? criteria.filter((c) => c.taskIds.length === 0)
      : filter === 'inferred'
        ? inferred
        : criteria;

  const revealSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const selectCriterion = (id: string) => {
    const next = sel === id ? null : id;
    setSel(next);
    const first = next ? criteria.find((c) => c.id === next)?.sectionIds[0] : undefined;
    if (first) window.setTimeout(() => revealSection(first), 0);
  };

  const openFile = (ref: string) => {
    if (!root) return;
    const rel = ref.split(':')[0];
    openOverlay({ kind: 'file', path: rel.startsWith('/') ? rel : `${root}/${rel}` });
  };

  if (!criteria.length) {
    return (
      <div className="h-full grid place-items-center px-6">
        <div className="max-w-[46ch] text-center">
          <div className="w-11 h-11 mx-auto grid place-items-center rounded-2xl bg-elev text-faint mb-3">
            <Link2 size={19} />
          </div>
          <h3 className="font-display text-[15px] font-semibold text-ink-50 mb-1.5">
            Nothing to trace yet
          </h3>
          <p className="text-[12.5px] text-dim leading-relaxed">
            Review pairs each acceptance criterion in{' '}
            <code className="font-mono text-ink-200">{reqLabel}</code> with the part of the plan
            that satisfies it. That document has no <b className="text-ink-100">SHALL</b> criteria
            yet — draft or improve it first, and this view fills itself in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Coverage — the one line that answers "is this plan complete?" */}
      <div className="flex items-center gap-4 px-5 py-2.5 bg-panel border-y border-line/60 shrink-0 overflow-x-auto">
        <span className="text-[12px] text-dim shrink-0">Coverage</span>
        <div className="flex gap-[3px] w-[260px] shrink-0">
          {criteria.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCriterion(c.id)}
              title={`${c.id} — ${
                c.taskIds.length === 0
                  ? 'no task covers this'
                  : c.explicit
                    ? `named in the plan · ${c.taskIds.join(', ')}`
                    : `inferred · ${c.taskIds.join(', ')}`
              }`}
              className={cn(
                'h-1.5 flex-1 transition',
                c.id === sel && 'ring-1 ring-ink-50/40',
                c.taskIds.length === 0
                  ? 'bg-bad'
                  : c.explicit
                    ? 'bg-accent hover:opacity-80'
                    : 'bg-accent/35 hover:bg-accent/55'
              )}
            />
          ))}
        </div>
        <span className="font-mono text-[11.5px] text-faint shrink-0 whitespace-nowrap">
          {confirmed.length} confirmed · {inferred.length} inferred · {gaps.length} uncovered
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All {criteria.length}
          </FilterChip>
          {inferred.length > 0 && (
            <FilterChip active={filter === 'inferred'} onClick={() => setFilter('inferred')}>
              Inferred {inferred.length}
            </FilterChip>
          )}
          <FilterChip
            active={filter === 'gaps'}
            onClick={() => setFilter('gaps')}
            warn={gaps.length > 0}
          >
            Uncovered {gaps.length}
          </FilterChip>
        </div>
        <span className="ml-auto text-[11.5px] text-faint shrink-0">
          {selected
            ? `Showing what ${selected.id} touches — click it again for the whole plan.`
            : 'Click a criterion to trace it through the plan.'}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col xl:flex-row">
        {/* Left — the criteria */}
        <aside className="xl:w-[440px] shrink-0 flex flex-col min-h-0 border-b xl:border-b-0 xl:border-r border-line/60 max-h-[42%] xl:max-h-none">
          <div className="flex items-baseline gap-2 px-4 pt-3.5 pb-2 shrink-0">
            <span className="font-mono text-[11px] text-accent-text">{reqLabel}</span>
            <span className="text-[11.5px] text-faint">acceptance criteria</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 flex flex-col gap-2">
            {shown.map((c) => (
              <CriterionCard
                key={c.id}
                c={c}
                selected={c.id === sel}
                dimmed={!!sel && c.id !== sel}
                sectionTitle={(id) => sections.find((s) => s.id === id)?.title ?? id}
                onSelect={() => selectCriterion(c.id)}
                onSection={revealSection}
                onFile={openFile}
              />
            ))}
            {!shown.length && (
              <p className="text-[12.5px] text-faint px-1 py-3">
                {filter === 'gaps'
                  ? 'Every criterion reaches a task.'
                  : 'Every link is written into the plan — nothing is guessed.'}
              </p>
            )}
          </div>
        </aside>

        {/* Right — the plan */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex items-baseline gap-2 px-5 pt-3.5 pb-2 shrink-0">
            <span className="font-mono text-[11px] text-accent-text">plan.md</span>
            <span className="text-[11.5px] text-faint truncate">
              {selected
                ? `highlighting the sections that satisfy ${selected.id}`
                : `${sections.length} sections`}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 flex flex-col gap-2.5">
            {sections.map((s, i) => {
              const linked = !!selected && selected.sectionIds.includes(s.id);
              const dimmed = !!selected && !linked;
              return (
                <section
                  key={s.id}
                  ref={(el) => {
                    sectionRefs.current[s.id] = el;
                  }}
                  className={cn(
                    'bg-card p-5 ring-1 ring-inset transition',
                    linked ? 'ring-accent/60' : 'ring-ink-50/[0.05]',
                    dimmed && 'opacity-40'
                  )}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-[11.5px] text-faint tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h2 className="font-display text-[16px] font-semibold text-ink-50 flex-1 min-w-0 truncate">
                      {s.title}
                    </h2>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.criterionIds.map((id) => (
                        <button
                          key={id}
                          onClick={() => selectCriterion(id)}
                          title={`Trace ${id}`}
                          className={cn(
                            'font-mono text-[10px] px-1.5 py-0.5 transition',
                            id === sel
                              ? 'bg-accent/20 text-accent-text'
                              : 'bg-ink-50/[0.06] text-faint hover:text-ink-100'
                          )}
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  </div>

                  {s.isList ? (
                    <ul className="flex flex-col gap-1.5">
                      {s.items.map((it, k) => (
                        <li key={k} className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              'mt-[7px] w-1 h-1 rounded-full shrink-0',
                              it.checked ? 'bg-ok' : 'bg-faint'
                            )}
                          />
                          <span
                            className="flex-1 text-[13.5px] leading-relaxed text-ink-100"
                            dangerouslySetInnerHTML={{ __html: highlightEars(it.text) }}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Markdown source={s.body} className="text-[13.5px] leading-relaxed" />
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FilterChip({
  active,
  warn,
  onClick,
  children,
}: {
  active: boolean;
  warn?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-[11.5px] px-2.5 py-1 rounded-md transition whitespace-nowrap',
        active
          ? warn
            ? 'bg-bad/15 text-bad'
            : 'bg-accent/15 text-accent-text'
          : 'bg-elev text-faint hover:text-ink-100'
      )}
    >
      {children}
    </button>
  );
}

function CriterionCard({
  c,
  selected,
  dimmed,
  sectionTitle,
  onSelect,
  onSection,
  onFile,
}: {
  c: TraceCriterion;
  selected: boolean;
  dimmed: boolean;
  sectionTitle: (id: string) => string;
  onSelect: () => void;
  onSection: (id: string) => void;
  onFile: (ref: string) => void;
}) {
  const gap = c.taskIds.length === 0;
  return (
    <div
      onClick={onSelect}
      className={cn(
        'p-3.5 cursor-pointer border-l-2 transition bg-card hover:bg-elev/60',
        selected ? 'border-accent bg-raised' : gap ? 'border-bad/70' : 'border-transparent',
        dimmed && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'font-mono text-[11px] font-medium',
            selected ? 'text-accent-text' : 'text-faint'
          )}
        >
          {c.id}
        </span>
        <span className="text-[10.5px] text-ink-600 truncate">{c.origin}</span>
        <span
          className={cn(
            'ml-auto shrink-0 text-[10.5px] px-1.5 py-0.5 flex items-center gap-1',
            gap
              ? 'bg-bad/15 text-bad'
              : c.explicit
                ? 'bg-accent/15 text-accent-text'
                : 'bg-ink-50/[0.06] text-faint'
          )}
        >
          {gap ? (
            <>
              <AlertTriangle size={9} /> no task
            </>
          ) : c.explicit ? (
            <>
              <Check size={9} /> confirmed
            </>
          ) : (
            <>
              <Sparkles size={9} /> inferred
            </>
          )}
        </span>
      </div>

      <p
        className={cn(
          'mt-2 text-[13px] leading-relaxed',
          selected ? 'text-ink-100' : 'text-dim'
        )}
        dangerouslySetInnerHTML={{ __html: highlightEars(c.text) }}
      />

      {selected && (
        <div className="mt-3 pt-3 border-t border-line/70 flex flex-col gap-2">
          <TraceRow label="plan">
            {c.sectionIds.length ? (
              c.sectionIds.map((id) => (
                <button
                  key={id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSection(id);
                  }}
                  className="text-[11.5px] px-2 py-0.5 bg-ink-50/[0.06] text-ink-100 hover:bg-ink-50/[0.1] transition flex items-center gap-1"
                >
                  {sectionTitle(id)} <ArrowRight size={10} className="text-faint" />
                </button>
              ))
            ) : (
              <Missing>no section of the plan matches this</Missing>
            )}
          </TraceRow>

          <TraceRow label="tasks">
            {c.taskIds.length ? (
              c.taskIds.map((id) => (
                <span
                  key={id}
                  className="font-mono text-[11px] px-2 py-0.5 bg-accent/15 text-accent-text"
                >
                  {id}
                </span>
              ))
            ) : (
              <Missing>nothing in the task waves covers this yet</Missing>
            )}
          </TraceRow>

          {c.files.length > 0 && (
            <TraceRow label="files">
              {c.files.map((f) => (
                <button
                  key={f}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFile(f);
                  }}
                  title="Open this file"
                  className="font-mono text-[11px] px-2 py-0.5 bg-agent/12 text-agent-text hover:bg-agent/20 transition flex items-center gap-1"
                >
                  <FileCode2 size={10} /> {f}
                </button>
              ))}
            </TraceRow>
          )}

          <p className="text-[10.5px] text-ink-600 flex items-start gap-1.5 leading-snug">
            {c.explicit ? (
              <>
                <Check size={10} className="text-ok shrink-0 mt-[2px]" />
                <span>
                  {c.citedIn.sections && c.citedIn.tasks
                    ? `the plan names ${c.id} in the section and on its task`
                    : c.citedIn.tasks
                      ? `named on the task — the sections above are matched by wording`
                      : `named in the plan — the tasks above are matched by wording`}
                </span>
              </>
            ) : (
              <>
                <Sparkles size={10} className="shrink-0 mt-[2px]" />
                <span>
                  matched by shared wording — write {c.id} into the plan to make it exact
                </span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function TraceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="font-mono text-[10px] text-ink-600 w-[38px] shrink-0 pt-1">{label}</span>
      <div className="flex-1 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <span className="text-[11.5px] text-bad/90 pt-0.5">{children}</span>;
}
