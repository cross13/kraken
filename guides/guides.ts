// The guides: one body of how-to content read by two very different readers —
// the public site (`website/`, someone deciding whether to install) and the app
// itself (Quick Start › Guides and the `?` in the command bar, someone stuck on
// a screen right now).
//
// This file is the format and nothing else. It is dependency-free and uses no
// bundler features so `scripts/guides-check.mjs` can import it with Node's TS
// stripping; each consumer globs the markdown itself and hands the raw text to
// `loadGuides`. The content lives next to it in `guides/<lang>/<id>.md`.

export const GUIDE_LANGS = ['en', 'es'] as const;
export type GuideLang = (typeof GUIDE_LANGS)[number];

/** `start` is the ordered first-hour path; `howto` is everything you look up. */
export const GUIDE_TRACKS = ['start', 'howto'] as const;
export type GuideTrack = (typeof GUIDE_TRACKS)[number];

export const GUIDE_AREAS = [
  'setup',
  'specs',
  'build',
  'ship',
  'tickets',
  'library',
  'activity',
] as const;
export type GuideArea = (typeof GUIDE_AREAS)[number];

/**
 * Where a guide lives in the app — the screen *Take me there* opens, and the
 * screen whose `?` offers it. Mirrors `Surface` + `SpecStage` + `ActivityTab` +
 * `LibrarySection` in `src/stores/ui.ts`; the app checks the two stay in step
 * with a `satisfies` (`src/lib/guides.ts`), the check script checks the files.
 */
export const GUIDE_GOTOS = [
  'home',
  'spec:define',
  'spec:plan',
  'spec:build',
  'activity:runs',
  'activity:history',
  'activity:specs',
  'activity:reviews',
  'activity:terminals',
  'activity:graph',
  'library:agents',
  'library:skills',
  'library:hooks',
  'library:steering',
  'library:routing',
  'library:tickets',
  'library:appearance',
  'library:settings',
] as const;
export type GuideGoto = (typeof GUIDE_GOTOS)[number];

/**
 * A guide can be *verified* in the app: these are Quick Start's `StepId`s, and a
 * guide carrying one shows a real green check when that step is actually true.
 */
export const GUIDE_CHECKS = ['workspace', 'backend', 'library', 'steering', 'spec', 'tracker'] as const;
export type GuideCheck = (typeof GUIDE_CHECKS)[number];

export const AREA_LABELS: Record<GuideArea, Record<GuideLang, string>> = {
  setup: { en: 'Setup & settings', es: 'Configuración' },
  specs: { en: 'Specs', es: 'Specs' },
  build: { en: 'Build & tasks', es: 'Build y tareas' },
  ship: { en: 'Ship & review', es: 'Ship y review' },
  tickets: { en: 'Tickets', es: 'Tickets' },
  library: { en: 'Library', es: 'Library' },
  activity: { en: 'Activity', es: 'Activity' },
};

export interface Guide {
  id: string;
  lang: GuideLang;
  title: string;
  /** One sentence — the card text and the meta description. */
  summary: string;
  track: GuideTrack;
  /** Position in its track (and area, for how-tos). */
  order: number;
  area: GuideArea;
  minutes: number;
  goto: GuideGoto;
  check?: GuideCheck;
  /** Markdown, front matter removed. */
  body: string;
}

const REQUIRED = ['id', 'title', 'summary', 'track', 'order', 'area', 'minutes', 'goto'] as const;

/**
 * Parse one guide. Front matter is flat `key: value` lines — no YAML library,
 * and no nesting to need one. Returns the problems instead of throwing so the
 * check script can report every file at once.
 */
export function parseGuide(
  raw: string,
  lang: GuideLang,
  file: string
): { guide?: Guide; errors: string[] } {
  const errors: string[] = [];
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { errors: [`${file}: missing front matter`] };

  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
    else if (line.trim()) errors.push(`${file}: unreadable front-matter line "${line}"`);
  }
  for (const k of REQUIRED) if (!fm[k]) errors.push(`${file}: missing "${k}"`);

  const oneOf = <T extends string>(k: string, list: readonly T[]): T | undefined => {
    const v = fm[k];
    if (v === undefined || v === '') return undefined;
    if ((list as readonly string[]).includes(v)) return v as T;
    errors.push(`${file}: "${k}: ${v}" is not one of ${list.join(', ')}`);
    return undefined;
  };
  const num = (k: string): number => {
    const n = Number(fm[k]);
    if (fm[k] !== undefined && !Number.isFinite(n)) errors.push(`${file}: "${k}" must be a number`);
    return n;
  };

  const track = oneOf('track', GUIDE_TRACKS);
  const area = oneOf('area', GUIDE_AREAS);
  const goto = oneOf('goto', GUIDE_GOTOS);
  const check = oneOf('check', GUIDE_CHECKS);
  const order = num('order');
  const minutes = num('minutes');
  const body = m[2].trim();
  if (!body) errors.push(`${file}: empty body`);

  if (errors.length || !track || !area || !goto) return { errors };
  return {
    errors,
    guide: {
      id: fm.id,
      lang,
      title: fm.title,
      summary: fm.summary,
      track,
      order,
      area,
      minutes,
      goto,
      check,
      body,
    },
  };
}

/** `guides/es/first-spec.md` → `{ lang: 'es', id: 'first-spec' }`. */
export function guidePath(path: string): { lang: GuideLang; id: string } | null {
  const m = path.match(/(?:^|\/)(en|es)\/([a-z0-9-]+)\.md$/);
  return m ? { lang: m[1] as GuideLang, id: m[2] } : null;
}

export interface GuideLibrary {
  /** By language, sorted: the start track in order, then how-tos by area and order. */
  byLang: Record<GuideLang, Guide[]>;
  get(id: string, lang: GuideLang): Guide | undefined;
}

/**
 * Build the library from a `{ path: rawMarkdown }` record — what both
 * consumers' `import.meta.glob(…, { query: '?raw', eager: true })` produce.
 * A file that fails to parse is dropped here; the check script is what refuses it.
 */
export function loadGuides(files: Record<string, string>): GuideLibrary {
  const byLang: Record<GuideLang, Guide[]> = { en: [], es: [] };
  for (const [path, raw] of Object.entries(files)) {
    const p = guidePath(path);
    if (!p) continue;
    const { guide } = parseGuide(raw, p.lang, path);
    if (guide) byLang[p.lang].push(guide);
  }
  for (const lang of GUIDE_LANGS) byLang[lang].sort(compareGuides);
  return {
    byLang,
    get: (id, lang) => byLang[lang].find((g) => g.id === id),
  };
}

export function compareGuides(a: Guide, b: Guide): number {
  if (a.track !== b.track) return a.track === 'start' ? -1 : 1;
  if (a.track === 'howto' && a.area !== b.area)
    return GUIDE_AREAS.indexOf(a.area) - GUIDE_AREAS.indexOf(b.area);
  return a.order - b.order;
}

/** The guide after this one in reading order — the start track's "Next". */
export function nextGuide(list: Guide[], g: Guide): Guide | undefined {
  if (g.track !== 'start') return undefined;
  const start = list.filter((x) => x.track === 'start');
  return start[start.findIndex((x) => x.id === g.id) + 1];
}
