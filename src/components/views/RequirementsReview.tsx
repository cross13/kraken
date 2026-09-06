import { useMemo, useState } from 'react';
import { ArrowRight, Check, HelpCircle, Sparkles, Users } from 'lucide-react';
import { useUi } from '../../stores/ui';
import { cn } from '../../lib/cn';
import { highlightEars } from '../../lib/specSections';
import { reviewRequirements, type ReqCriterion } from '../../lib/reqReview';
import type { SpecMeta } from '../../../electron/shared/types';

/**
 * **Review**, for the requirements document.
 *
 * The plan's Review asks "is every criterion covered?". This one asks the
 * question a step earlier — *can this be planned?* — and it has three parts,
 * none of them visible reading the markdown top to bottom: every criterion
 * answers a **user story** (and every story has criteria), every criterion is
 * in EARS form, and no criterion rests on a word nobody can test.
 *
 * Criteria are grouped under the story they serve, so the connection the
 * document only implies becomes the layout. Findings read **violet** — the
 * palette's "needs your decision" — not red: a story without criteria isn't
 * broken, it needs the author.
 */
export function RequirementsReview({
  meta,
  requirementsMd,
  planMd,
  tasksMd,
}: {
  meta: SpecMeta;
  requirementsMd: string;
  planMd: string;
  tasksMd: string;
}) {
  const openOverlay = useUi((s) => s.openOverlay);
  const [story, setStory] = useState<string | null>(null);
  const [crit, setCrit] = useState<string | null>(null);
  const [needsOnly, setNeedsOnly] = useState(false);

  const review = useMemo(
    () => reviewRequirements(requirementsMd, planMd, tasksMd),
    [requirementsMd, planMd, tasksMd]
  );
  const { stories, criteria, flagged, scope, questions, hasPlan, storyMode } = review;

  const needsLook = (c: ReqCriterion) => flagged.includes(c.id);
  const visible = criteria.filter((c) => (needsOnly ? needsLook(c) : true));
  const tied = criteria.filter((c) => c.storyId).length;

  // A bug spec has no user stories, so the lens becomes the section a criterion
  // came from — Expected Behavior, Unchanged Behavior. Same question either way:
  // what does this criterion belong to?
  const lenses = storyMode
    ? stories.map((s) => ({
        id: s.id,
        headline: s.want,
        role: s.role,
        why: s.why,
        ids: s.criterionIds,
      }))
    : Array.from(new Set(criteria.map((c) => c.origin))).map((origin) => ({
        id: origin,
        headline: origin,
        role: null as string | null,
        why: '',
        ids: criteria.filter((c) => c.origin === origin).map((c) => c.id),
      }));
  const groupKey = (c: ReqCriterion) => (storyMode ? c.storyId : c.origin);

  const groups = lenses
    .filter((l) => !story || l.id === story)
    .map((l) => ({
      id: l.id,
      title: l.headline,
      orphan: storyMode && l.ids.length === 0,
      crits: visible.filter((c) => groupKey(c) === l.id),
    }))
    .filter((g) => !needsOnly || g.crits.length > 0 || g.orphan);
  const loose = storyMode ? visible.filter((c) => !c.storyId) : [];

  if (!criteria.length && !stories.length) {
    return (
      <div className="h-full grid place-items-center px-6">
        <div className="max-w-[46ch] text-center">
          <div className="w-11 h-11 mx-auto grid place-items-center rounded-2xl bg-elev text-faint mb-3">
            <Users size={19} />
          </div>
          <h3 className="font-display text-[15px] font-semibold text-ink-50 mb-1.5">
            Nothing to review yet
          </h3>
          <p className="text-[12.5px] text-dim leading-relaxed">
            Review groups each acceptance criterion under the user story it answers, and checks
            that it can actually be tested. This document has neither yet — draft it first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Readiness — the gate question, answered in one line */}
      <div className="flex items-center gap-4 px-5 py-2.5 bg-panel border-y border-line/60 shrink-0 overflow-x-auto">
        <span className="text-[12px] text-dim shrink-0">Ready to plan</span>
        <div className="flex gap-[3px] w-[260px] shrink-0">
          {criteria.map((c) => (
            <button
              key={c.id}
              onClick={() => setCrit(crit === c.id ? null : c.id)}
              title={`${c.id} — ${
                !c.storyId
                  ? 'no story asks for this'
                  : c.vague.length
                    ? `untestable: ${c.vague.join(', ')}`
                    : c.form
              }`}
              className={cn(
                'h-1.5 flex-1 transition',
                c.id === crit && 'ring-1 ring-ink-50/40',
                needsLook(c) ? 'bg-agent hover:opacity-80' : 'bg-accent hover:opacity-80'
              )}
            />
          ))}
        </div>
        <span className="font-mono text-[11.5px] text-faint shrink-0 whitespace-nowrap">
          {storyMode
            ? `${tied}/${criteria.length} answer a story · ${flagged.length} need a look`
            : `${criteria.length} criteria · ${flagged.length} need a look`}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Chip active={!needsOnly} onClick={() => setNeedsOnly(false)}>
            All {criteria.length}
          </Chip>
          <Chip active={needsOnly} agent={flagged.length > 0} onClick={() => setNeedsOnly(true)}>
            Needs a look {flagged.length}
          </Chip>
        </div>
        <span className="ml-auto text-[11.5px] text-faint shrink-0">
          {story
            ? storyMode
              ? `Showing only what ${story} asks for — click it again for everything.`
              : `Showing only ${story} — click it again for everything.`
            : storyMode
              ? 'Click a story to see just its criteria, or a criterion to check it.'
              : 'Click a section to narrow the list, or a criterion to check it.'}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col xl:flex-row">
        {/* Left — the stories, and the context that bounds them */}
        <aside className="xl:w-[430px] shrink-0 flex flex-col min-h-0 border-b xl:border-b-0 xl:border-r border-line/60 max-h-[40%] xl:max-h-none">
          <div className="flex items-baseline gap-2 px-4 pt-3.5 pb-2 shrink-0">
            <span className="font-mono text-[11px] text-accent-text">
              {storyMode ? 'user stories' : 'behavior'}
            </span>
            <span className="text-[11.5px] text-faint">
              {storyMode ? 'who wants what, and why' : 'what the criteria belong to'}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 flex flex-col gap-2">
            {lenses.map((s) => {
              const on = s.id === story;
              const orphan = storyMode && s.ids.length === 0;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setStory(on ? null : s.id);
                    setCrit(null);
                  }}
                  className={cn(
                    'p-3.5 cursor-pointer border-l-2 transition bg-card hover:bg-elev/60',
                    on ? 'border-accent bg-raised' : orphan ? 'border-agent/70' : 'border-transparent',
                    story && !on && 'opacity-60'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'font-mono text-[11px] font-medium',
                        on ? 'text-accent-text' : 'text-faint'
                      )}
                    >
                      {s.id}
                    </span>
                    <span
                      className={cn(
                        'ml-auto text-[10.5px] px-1.5 py-0.5',
                        orphan ? 'bg-agent/15 text-agent-text' : 'bg-ink-50/[0.06] text-faint'
                      )}
                    >
                      {orphan
                        ? 'no criteria'
                        : `${s.ids.length} criteri${s.ids.length === 1 ? 'on' : 'a'}`}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'mt-2 text-[13px] leading-relaxed',
                      on ? 'text-ink-100' : 'text-dim'
                    )}
                  >
                    {s.role ? (
                      <>
                        As <b className="font-semibold text-ink-200">{s.role}</b>, I want{' '}
                        {s.headline}
                        {s.why && <>, so that {s.why}</>}.
                      </>
                    ) : (
                      <>
                        {s.ids.length} criteri{s.ids.length === 1 ? 'on' : 'a'} under{' '}
                        <b className="font-semibold text-ink-200">{s.headline}</b>.
                      </>
                    )}
                  </p>
                </div>
              );
            })}

            {scope.map((sec) => (
              <div key={sec.title} className="mt-1 p-3.5 bg-panel ring-1 ring-inset ring-ink-50/[0.05]">
                <span className="font-mono text-[10px] text-faint">{sec.title.toLowerCase()}</span>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {sec.items.slice(0, 5).map((it, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-[7px] w-1 h-1 shrink-0 bg-ink-600" />
                      <span
                        className="flex-1 text-[12.5px] leading-relaxed text-faint"
                        dangerouslySetInnerHTML={{ __html: highlightEars(it) }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {questions.open > 0 && (
              <div className="p-3.5 bg-agent-tint ring-1 ring-inset ring-agent/30">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-agent-text">open questions</span>
                  <span className="ml-auto font-mono text-[10.5px] text-agent-text">
                    {questions.open} open · {questions.resolved} resolved
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                  The plan will guess at {questions.open === 1 ? 'this' : 'these'} unless{' '}
                  {questions.open === 1 ? 'it is' : 'they are'} answered first.
                </p>
                <button
                  onClick={() => openOverlay({ kind: 'questions', specId: meta.id })}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-agent text-agent-fg hover:opacity-90 transition"
                >
                  <HelpCircle size={12} /> Answer them <ArrowRight size={11} />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Right — the criteria, grouped by the story they serve */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex items-baseline gap-2 px-5 pt-3.5 pb-2 shrink-0">
            <span className="font-mono text-[11px] text-accent-text">acceptance criteria</span>
            <span className="text-[11.5px] text-faint truncate">
              {story
                ? `for ${story}`
                : storyMode
                  ? 'grouped by the story they serve'
                  : 'grouped by the behavior they define'}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.id}>
                <div className="flex items-center gap-2.5 pb-2 border-b border-line/70">
                  <span
                    className={cn(
                      'font-mono text-[11px] font-medium',
                      g.orphan ? 'text-agent-text' : 'text-faint'
                    )}
                  >
                    {g.id}
                  </span>
                  <span className={cn('text-[12.5px] truncate', g.orphan ? 'text-agent-text' : 'text-dim')}>
                    {g.title}
                  </span>
                  <span className="ml-auto font-mono text-[10.5px] text-ink-600 shrink-0">
                    {g.crits.length ? `${g.crits.length} criteria` : 'none'}
                  </span>
                </div>
                {g.crits.map((c) => (
                  <CriterionRow
                    key={c.id}
                    c={c}
                    open={crit === c.id}
                    hasPlan={hasPlan}
                    storyWant={g.title}
                    onToggle={() => setCrit(crit === c.id ? null : c.id)}
                  />
                ))}
                {g.orphan && (
                  <p className="py-3 text-[12.5px] text-agent-text leading-relaxed">
                    No criterion answers this story — nothing in the plan will be built for it.
                    Write one, or drop the story.
                  </p>
                )}
              </div>
            ))}

            {loose.length > 0 && !story && (
              <div>
                <div className="flex items-center gap-2.5 pb-2 border-b border-line/70">
                  <span className="font-mono text-[11px] font-medium text-agent-text">—</span>
                  <span className="text-[12.5px] text-agent-text">
                    not asked for by any story
                  </span>
                  <span className="ml-auto font-mono text-[10.5px] text-ink-600 shrink-0">
                    {loose.length} criteria
                  </span>
                </div>
                {loose.map((c) => (
                  <CriterionRow
                    key={c.id}
                    c={c}
                    open={crit === c.id}
                    hasPlan={hasPlan}
                    storyWant={null}
                    onToggle={() => setCrit(crit === c.id ? null : c.id)}
                  />
                ))}
              </div>
            )}

            {!groups.length && !loose.length && (
              <p className="text-[12.5px] text-faint py-3">
                Every criterion answers a story and can be tested.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Chip({
  active,
  agent,
  onClick,
  children,
}: {
  active: boolean;
  agent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-[11.5px] px-2.5 py-1 rounded-md transition whitespace-nowrap',
        active
          ? agent
            ? 'bg-agent/18 text-agent-text'
            : 'bg-accent/15 text-accent-text'
          : 'bg-elev text-faint hover:text-ink-100'
      )}
    >
      {children}
    </button>
  );
}

function CriterionRow({
  c,
  open,
  hasPlan,
  storyWant,
  onToggle,
}: {
  c: ReqCriterion;
  open: boolean;
  hasPlan: boolean;
  storyWant: string | null;
  onToggle: () => void;
}) {
  const flags: string[] = [];
  if (!c.storyId) flags.push('no story');
  if (c.form === 'not EARS') flags.push('not EARS');
  if (c.vague.length) flags.push('vague');

  return (
    <div
      onClick={onToggle}
      className="py-3 border-b border-line/40 cursor-pointer hover:bg-elev/40 transition"
    >
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            'font-mono text-[11px] w-[38px] shrink-0',
            open ? 'text-accent-text' : 'text-faint'
          )}
        >
          {c.id}
        </span>
        <span
          className={cn('flex-1 text-[13.5px] leading-relaxed', open ? 'text-ink-100' : 'text-dim')}
          dangerouslySetInnerHTML={{ __html: highlightEars(c.text) }}
        />
        <div className="flex gap-1.5 shrink-0">
          {flags.length ? (
            flags.map((f) => (
              <span
                key={f}
                className="font-mono text-[9.5px] px-1.5 py-0.5 bg-agent/18 text-agent-text"
              >
                {f}
              </span>
            ))
          ) : (
            <span className="font-mono text-[9.5px] px-1.5 py-0.5 bg-ink-50/[0.06] text-ink-600">
              {c.form}
            </span>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-2.5 ml-[50px] pl-3.5 py-3 pr-3 bg-panel border-l-2 border-accent flex flex-col gap-2">
          <Check2 label="form">
            <span className="text-ink-200">
              {c.form === 'not EARS'
                ? 'not EARS — a criterion needs one trigger and one observable outcome'
                : `${c.form} — one trigger, one observable outcome`}
            </span>
          </Check2>
          <Check2 label="story">
            {c.storyId ? (
              <span className="text-ink-200">
                {c.storyId}
                {storyWant ? ` — ${storyWant}` : ''}
                {!c.storyCited && (
                  <span className="text-ink-600"> · matched by wording, not written down</span>
                )}
              </span>
            ) : (
              <span className="text-agent-text">
                no user story asks for this — cut it, or write the story
              </span>
            )}
          </Check2>
          {c.vague.length > 0 && (
            <Check2 label="vague">
              <span className="text-agent-text">
                “{c.vague.join('”, “')}” cannot be tested — name the number or the observable
              </span>
            </Check2>
          )}
          {hasPlan && (
            <Check2 label="plan">
              {c.planSections.length || c.planTasks.length ? (
                <span className="text-accent-text">
                  {[...c.planSections, ...c.planTasks].join(' · ')}
                </span>
              ) : (
                <span className="text-faint">nothing in the plan covers it yet</span>
              )}
            </Check2>
          )}
          <p className="text-[10.5px] text-ink-600 flex items-start gap-1.5 leading-snug pt-0.5">
            {c.storyCited ? (
              <>
                <Check size={10} className="text-ok shrink-0 mt-[2px]" />
                <span>the criterion names its story</span>
              </>
            ) : (
              <>
                <Sparkles size={10} className="shrink-0 mt-[2px]" />
                <span>write {c.storyId ?? 'US-n'} into the line to make the link exact</span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function Check2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="font-mono text-[10px] text-ink-600 w-[38px] shrink-0 pt-[2px]">{label}</span>
      <span className="flex-1 text-[11.5px] leading-relaxed">{children}</span>
    </div>
  );
}
