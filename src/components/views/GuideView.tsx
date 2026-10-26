import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, Check, Clock, CornerDownRight } from 'lucide-react';
import { useUi } from '../../stores/ui';
import { cn } from '../../lib/cn';
import { Markdown } from '../Markdown';
import { GUIDES, GUIDE_CHROME, goTo } from '../../lib/guides';
import { useSetupSteps } from '../../lib/useSetupSteps';
import {
  AREA_LABELS,
  GUIDE_AREAS,
  GUIDE_LANGS,
  nextGuide,
  type Guide,
  type GuideLang,
} from '../../../guides/guides';

/**
 * A guide in the slide-over: the index on the left, the guide on the right.
 *
 * The body is the same markdown the public site renders; what only the app can
 * add is *Take me there* (the screen the guide is about) and, for guides tied
 * to a Quick Start step, a check that is true only when the step really is.
 */
export function GuideView({ id }: { id: string }) {
  const lang = useUi((s) => s.guideLang);
  const setLang = useUi((s) => s.setGuideLang);
  const openOverlay = useUi((s) => s.openOverlay);
  const activeSpecId = useUi((s) => s.activeSpecId);
  const { steps } = useSetupSteps();
  const scroller = useRef<HTMLDivElement>(null);
  const t = GUIDE_CHROME[lang];

  const list = GUIDES.byLang[lang];
  const guide = GUIDES.get(id, lang) ?? list[0];
  const next = guide ? nextGuide(list, guide) : undefined;
  const done = guide?.check ? steps.find((s) => s.id === guide.check)?.done : undefined;

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [guide?.id, lang]);

  const groups = useMemo(() => {
    const out: { label: string; items: Guide[] }[] = [
      { label: t.start, items: list.filter((g) => g.track === 'start') },
    ];
    for (const area of GUIDE_AREAS) {
      const items = list.filter((g) => g.track === 'howto' && g.area === area);
      if (items.length) out.push({ label: AREA_LABELS[area][lang], items });
    }
    return out;
  }, [list, lang, t.start]);

  if (!guide) return <div className="p-6 text-[12px] text-faint">No guides bundled.</div>;

  const startIndex = list.filter((g) => g.track === 'start').findIndex((g) => g.id === guide.id);

  return (
    <div className="h-full flex min-h-0">
      <nav className="w-[230px] shrink-0 border-r border-ink-800/60 overflow-y-auto py-4 px-3">
        <LangToggle lang={lang} onChange={setLang} />
        {groups.map((grp) => (
          <div key={grp.label} className="mt-4">
            <div className="px-2 mb-1 text-[10.5px] uppercase tracking-[0.07em] text-ink-500 font-semibold">
              {grp.label}
            </div>
            {grp.items.map((g) => {
              const isDone = g.check ? steps.find((s) => s.id === g.check)?.done : false;
              return (
                <button
                  key={g.id}
                  onClick={() => openOverlay({ kind: 'guide', id: g.id })}
                  className={cn(
                    'w-full flex items-center gap-2 text-left text-[12px] px-2 py-1.5 rounded-md transition',
                    g.id === guide.id
                      ? 'bg-accent/12 text-accent'
                      : 'text-dim hover:text-ink-50 hover:bg-elev'
                  )}
                >
                  {g.track === 'start' && (
                    <span
                      className={cn(
                        'w-4 h-4 shrink-0 grid place-items-center rounded-full text-[9.5px] tabular-nums',
                        isDone ? 'bg-good/15 text-ok' : 'bg-elev text-faint'
                      )}
                    >
                      {isDone ? <Check size={10} /> : g.order}
                    </span>
                  )}
                  <span className="truncate">{g.title}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div ref={scroller} className="flex-1 min-w-0 overflow-y-auto">
        <article className="k-read py-8">
          <div className="flex items-center gap-2 text-[11px] text-faint">
            <span>
              {guide.track === 'start'
                ? `${t.start} · ${startIndex + 1}/${list.filter((g) => g.track === 'start').length}`
                : AREA_LABELS[guide.area][lang]}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock size={11} /> {guide.minutes} {t.min}
            </span>
            {done && (
              <span className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-good/15 text-ok">
                <Check size={11} /> {t.done}
              </span>
            )}
          </div>
          <h1 className="mt-2 font-display text-[24px] font-semibold tracking-tight text-ink-50">
            {guide.title}
          </h1>
          <p className="mt-1.5 text-[13px] text-dim leading-relaxed">{guide.summary}</p>

          <Markdown source={guide.body} className="md mt-6" />

          <div className="mt-8 pt-5 border-t border-ink-800/60 flex flex-wrap items-center gap-3">
            <button
              onClick={() => goTo(guide.goto)}
              title={guide.goto.startsWith('spec:') && !activeSpecId ? t.noSpec : undefined}
              className="flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 transition"
            >
              <CornerDownRight size={13} /> {t.takeMe}
            </button>
            {next && (
              <button
                onClick={() => openOverlay({ kind: 'guide', id: next.id })}
                className="ml-auto flex items-center gap-1.5 text-[12.5px] px-3 py-2 rounded-lg text-dim hover:text-ink-50 hover:bg-elev transition"
              >
                {t.next}: {next.title} <ArrowRight size={13} />
              </button>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

export function LangToggle({
  lang,
  onChange,
}: {
  lang: GuideLang;
  onChange: (l: GuideLang) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-elev p-0.5">
      {GUIDE_LANGS.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={cn(
            'px-2.5 py-1 rounded-md font-mono text-[10.5px] uppercase transition',
            l === lang ? 'bg-ink-950 text-ink-50' : 'text-faint hover:text-ink-100'
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
