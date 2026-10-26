import { Link } from 'react-router-dom';
import { GUIDE_LANGS, type GuideLang } from '../../../guides/guides';

/** EN | ES — links, not state: each language has its own URL. */
export function LangSwitch({
  lang,
  hrefFor,
}: {
  lang: GuideLang;
  hrefFor: (l: GuideLang) => string;
}) {
  return (
    <span className="inline-flex border border-line">
      {GUIDE_LANGS.map((l) => (
        <Link
          key={l}
          to={hrefFor(l)}
          aria-current={l === lang ? 'true' : undefined}
          className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
            l === lang ? 'bg-card text-ink-100' : 'text-ink-600 hover:text-ink-200'
          }`}
        >
          {l}
        </Link>
      ))}
    </span>
  );
}
