import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Search } from 'lucide-react';
import { Section, Reveal, Eyebrow } from '../components/ui';
import { GUIDES, CHROME, guideHref } from '../lib/guides';
import { AREA_LABELS, GUIDE_AREAS, type GuideLang } from '../../../guides/guides';
import { LangSwitch } from '../components/LangSwitch';

export function Guides({ lang }: { lang: GuideLang }) {
  const t = CHROME[lang];
  const list = GUIDES.byLang[lang];
  const [q, setQ] = useState('');

  const start = list.filter((g) => g.track === 'start');
  const howtos = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter(
      (g) =>
        g.track === 'howto' &&
        (!needle ||
          g.title.toLowerCase().includes(needle) ||
          g.summary.toLowerCase().includes(needle) ||
          g.body.toLowerCase().includes(needle))
    );
  }, [list, q]);

  return (
    <>
      <Section className="pt-20 pb-12 sm:pt-24">
        <Reveal>
          <div className="flex max-w-3xl flex-col gap-5">
            <div className="flex items-center gap-3">
              <Eyebrow>{t.eyebrow}</Eyebrow>
              <LangSwitch lang={lang} hrefFor={(l) => guideHref(l)} />
            </div>
            <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-tight text-ink-50 sm:text-5xl">
              {t.title}
            </h1>
            <p className="text-[17px] leading-relaxed text-ink-300">{t.blurb}</p>
          </div>
        </Reveal>
      </Section>

      <Section className="py-10">
        <Reveal>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink-50">{t.start}</h2>
            <span className="text-sm text-ink-500">{t.startBlurb}</span>
          </div>
        </Reveal>
        <ol className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {start.map((g, i) => (
            <Reveal key={g.id} delay={0.04 * i} className="h-full">
              <li className="h-full">
                <Link
                  to={guideHref(lang, g.id)}
                  className="group flex h-full flex-col gap-3 bg-panel p-5 transition-colors hover:bg-card"
                >
                  <span className="font-mono text-xs text-accent-text">
                    {String(g.order).padStart(2, '0')}
                  </span>
                  <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink-100">
                    {g.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-400">{g.summary}</p>
                  <span className="mt-auto flex items-center gap-1.5 pt-2 font-mono text-[11px] text-ink-600">
                    <Clock size={12} /> {g.minutes} {t.min}
                    <ArrowRight
                      size={14}
                      className="ml-auto text-ink-600 transition-colors group-hover:text-accent-text"
                    />
                  </span>
                </Link>
              </li>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section className="py-10 pb-24">
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink-50">{t.howto}</h2>
            <label className="flex w-full items-center gap-2 border border-line bg-panel px-3 py-2 sm:w-80">
              <Search size={15} className="shrink-0 text-ink-600" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.search}
                className="w-full bg-transparent text-sm text-ink-100 placeholder:text-ink-600 focus:outline-none"
              />
            </label>
          </div>
        </Reveal>

        {howtos.length === 0 && <p className="mt-8 text-sm text-ink-500">{t.none}</p>}

        <div className="mt-8 flex flex-col gap-10">
          {GUIDE_AREAS.map((area) => {
            const items = howtos.filter((g) => g.area === area);
            if (!items.length) return null;
            return (
              <div key={area}>
                <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
                  {AREA_LABELS[area][lang]}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((g) => (
                    <Link
                      key={g.id}
                      to={guideHref(lang, g.id)}
                      className="card group flex flex-col gap-2 p-5"
                    >
                      <h4 className="font-display text-[15px] font-semibold tracking-tight text-ink-100 group-hover:text-accent-text">
                        {g.title}
                      </h4>
                      <p className="text-sm leading-relaxed text-ink-400">{g.summary}</p>
                      <span className="mt-auto flex items-center gap-1.5 pt-1 font-mono text-[11px] text-ink-600">
                        <Clock size={12} /> {g.minutes} {t.min}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
