// Parse a spec markdown document (requirements.md / bugfix.md / design.md) into
// a title + a list of H2 sections, so the SpecDocument view can render each as
// its own card. Intentionally tolerant: any markdown parses into *something*.

export interface SpecListItem {
  /** undefined = not a checkbox item; true/false = checked/unchecked */
  checked?: boolean;
  /** the item text (markdown inline, EARS-aware) */
  text: string;
}

export interface SpecSection {
  id: string;
  title: string;
  /** raw markdown body under this heading (excludes the heading line) */
  body: string;
  /** top-level list items parsed out of the body (for checklist rendering) */
  items: SpecListItem[];
  /** true when the body is essentially just a list (render as checklist) */
  isList: boolean;
  /** true when items read like EARS acceptance criteria (contain SHALL) */
  isCriteria: boolean;
}

export interface SpecDoc {
  title?: string;
  sections: SpecSection[];
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const LIST_RE = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/;
const CHECK_RE = /^\[([ xX])\]\s+(.+)$/;

function parseItems(body: string): { items: SpecListItem[]; isList: boolean } {
  const lines = body.split('\n');
  const items: SpecListItem[] = [];
  let listLines = 0;
  let contentLines = 0;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    contentLines++;
    const m = LIST_RE.exec(line);
    // Only treat *top-level* list items (no leading indent) as checklist rows;
    // nested items stay part of their parent's markdown.
    if (m && !/^\s/.test(raw)) {
      listLines++;
      const text = m[1].trim();
      const cb = CHECK_RE.exec(text);
      if (cb) {
        items.push({ checked: cb[1].toLowerCase() === 'x', text: cb[2].trim() });
      } else {
        items.push({ text });
      }
    }
  }
  // "isList" when the section is overwhelmingly a flat list.
  const isList = items.length >= 2 && listLines >= Math.max(2, contentLines - 1);
  return { items, isList };
}

const EARS_RE = /\bSHALL\b/;

export function parseSpecDoc(md: string): SpecDoc {
  const text = (md ?? '').replace(/\r\n/g, '\n');

  // Pull a leading H1 as the document title.
  let title: string | undefined;
  let rest = text;
  const h1 = /^[ \t]*#[ \t]+(.+)\n?/.exec(text);
  if (h1) {
    title = h1[1].trim();
    rest = text.slice(h1[0].length);
  }

  // Find every H2 boundary.
  const re = /^##[ \t]+(.+)$/gm;
  const heads: { idx: number; end: number; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    heads.push({ idx: m.index, end: re.lastIndex, title: m[1].trim() });
  }

  const sections: SpecSection[] = [];
  const make = (t: string, body: string): SpecSection => {
    const trimmed = body.trim();
    const { items, isList } = parseItems(trimmed);
    const isCriteria = items.length > 0 && items.some((it) => EARS_RE.test(it.text));
    return { id: slug(t) || `s${sections.length}`, title: t, body: trimmed, items, isList, isCriteria };
  };

  if (heads.length === 0) {
    if (rest.trim()) sections.push(make(title ?? 'Overview', rest));
    return { title, sections };
  }

  const pre = rest.slice(0, heads[0].idx).trim();
  if (pre) sections.push(make('Overview', pre));
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].end;
    const stop = i + 1 < heads.length ? heads[i + 1].idx : rest.length;
    sections.push(make(heads[i].title, rest.slice(start, stop)));
  }
  return { title, sections };
}

/**
 * Wrap EARS keywords in the item text with a styled span (returns HTML).
 * Caller renders with dangerouslySetInnerHTML inside an already-escaped context.
 */
const EARS_KEYWORDS = [
  'WHEN',
  'WHILE',
  'WHERE',
  'IF',
  'THEN',
  'SHALL CONTINUE TO',
  'SHALL NOT',
  'SHALL',
  'THE SYSTEM',
];

export function highlightEars(text: string): string {
  // Escape first, then wrap keywords.
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  for (const kw of EARS_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'g');
    html = html.replace(re, `<span class="ears-kw">${kw}</span>`);
  }
  // Light inline markdown: `code` and **bold**.
  html = html
    .replace(/`([^`]+)`/g, '<code class="md-codespan">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b class="text-ink-50">$1</b>');
  return html;
}
