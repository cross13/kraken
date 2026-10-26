import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Clock } from 'lucide-react';
import { Section } from '../components/ui';
import { GITHUB_URL } from '../components/site';
import { GUIDES, CHROME, guideHref, renderGuide } from '../lib/guides';
import { AREA_LABELS, GUIDE_AREAS, type GuideLang } from '../../../guides/guides';
import { LangSwitch } from '../components/LangSwitch';
import { NotFound } from './NotFound';

export function Guide({ lang }: { lang: GuideLang }) {
  const { id = '' } = useParams();
  const t = CHROME[lang];
  const list = GUIDES.byLang[lang];
  const guide = GUIDES.get(id, lang);

  if (!guide) return <NotFound />;

  // Reading order: the start track is a path, how-tos read on within their area.
  const siblings = list.filter((g) =>
    guide.track === 'start' ? g.track === 'start' : g.track === 'howto' && g.area === guide.area
  );
  const at = siblings.findIndex((g) => g.id === guide.id);
  const prev = siblings[at - 1];
  const next = siblings[at + 1];

  const groups = [
    { label: t.start, items: list.filter((g) => g.track === 'start') },
    ...GUIDE_AREAS.map((a) => ({
      label: AREA_LABELS[a][lang],
      items: list.filter((g) => g.track === 'howto' && g.area === a),
    })).filter((g) => g.items.length),
  ];

  return (
    <Section className="pt-20 pb-24 sm:pt-24">
      <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            <Link
              to={guideHref(lang)}
              className="mb-5 flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
            >
              <ArrowLeft size={14} /> {t.all}
            </Link>
            {groups.map((grp) => (
              <div key={grp.label} className="mb-5">
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-600">
                  {grp.label}
                </div>
                {grp.items.map((g) => (
                  <Link
                    key={g.id}
                    to={guideHref(lang, g.id)}
                    className={`block border-l-2 py-1 pl-3 text-[13px] transition-colors ${
                      g.id === guide.id
                        ? 'border-accent text-ink-100'
                        : 'border-transparent text-ink-500 hover:text-ink-200'
                    }`}
                  >
                    {g.title}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-[72ch]">
          <Link
            to={guideHref(lang)}
            className="mb-6 flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100 lg:hidden"
          >
            <ArrowLeft size={14} /> {t.all}
          </Link>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-600">
            <span>
              {guide.track === 'start'
                ? `${t.start} · ${String(guide.order).padStart(2, '0')}`
                : AREA_LABELS[guide.area][lang]}
            </span>
            <span className="flex items-center gap-1.5 normal-case tracking-normal">
              <Clock size={12} /> {guide.minutes} {t.min}
            </span>
            <span className="ml-auto">
              <LangSwitch lang={lang} hrefFor={(l) => guideHref(l, guide.id)} />
            </span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-[1.1] tracking-tight text-ink-50 sm:text-4xl">
            {guide.title}
          </h1>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-300">{guide.summary}</p>

          <div
            className="guide-prose mt-10"
            // Our own markdown, rendered with raw HTML escaped (lib/guides.ts).
            dangerouslySetInnerHTML={{ __html: renderGuide(guide.body) }}
          />

          <p className="mt-10 border-l-2 border-agent pl-4 text-sm text-ink-400">{t.inApp}</p>

          <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2">
            {prev ? (
              <Link to={guideHref(lang, prev.id)} className="group bg-panel p-5 hover:bg-card">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-600">
                  <ArrowLeft size={12} /> {t.prev}
                </span>
                <span className="mt-1.5 block text-[15px] font-semibold text-ink-100">{prev.title}</span>
              </Link>
            ) : (
              <span className="hidden bg-panel sm:block" />
            )}
            {next ? (
              <Link to={guideHref(lang, next.id)} className="group bg-panel p-5 text-right hover:bg-card">
                <span className="flex items-center justify-end gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-600">
                  {t.next} <ArrowRight size={12} />
                </span>
                <span className="mt-1.5 block text-[15px] font-semibold text-ink-100">{next.title}</span>
              </Link>
            ) : (
              <span className="hidden bg-panel sm:block" />
            )}
          </div>

          <a
            href={`${GITHUB_URL}/blob/main/guides/${lang}/${guide.id}.md`}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-100"
          >
            {t.edit} <ArrowUpRight size={14} />
          </a>
        </article>
      </div>
    </Section>
  );
}
