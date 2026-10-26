/// <reference types="vite/client" />
// The guides, as the site reads them — the same `guides/<lang>/*.md` the
// desktop app bundles (repo root, shared on purpose: one body of content, two
// readers). See guides/guides.ts for the format and `npm run guides` at the
// repo root for the check that keeps the two languages in step.

import { marked } from 'marked';
import { loadGuides, type GuideLang } from '../../../guides/guides';

export const GUIDES = loadGuides(
  import.meta.glob('../../../guides/*/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >
);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The guides are our own text, but the renderer still escapes raw HTML and only
// follows web links — the same rules as the app's renderer, so a guide renders
// identically in both places.
const renderer = new marked.Renderer();
renderer.html = ({ text }: { text: string }) => escapeHtml(text);
renderer.link = function ({ href, title, tokens }) {
  const body = this.parser.parseInline(tokens);
  if (!/^(?:https?:|mailto:|#|\/)/i.test(href ?? '')) return body;
  const t = title ? ` title="${escapeHtml(title)}"` : '';
  const ext = /^https?:/i.test(href) ? ' target="_blank" rel="noreferrer"' : '';
  return `<a href="${escapeHtml(href)}"${t}${ext}>${body}</a>`;
};

export function renderGuide(src: string): string {
  return marked.parse(src, { gfm: true, renderer, async: false }) as string;
}

/** `/guides` or `/es/guides`, plus an optional guide id. */
export function guideHref(lang: GuideLang, id?: string): string {
  const base = lang === 'es' ? '/es/guides' : '/guides';
  return id ? `${base}/${id}` : base;
}

export const CHROME: Record<GuideLang, Record<string, string>> = {
  en: {
    eyebrow: 'Guides',
    title: 'How to do each thing in 0ct0.',
    blurb:
      'Five short guides take you from install to a merged pull request. Everything else is a how-to you look up when you need it — the same guides the app opens from its ? button.',
    start: 'Start here',
    startBlurb: 'In order. About twenty minutes end to end.',
    howto: 'How to',
    search: 'Search the guides…',
    none: 'No guide matches that.',
    min: 'min',
    next: 'Next',
    prev: 'Previous',
    all: 'All guides',
    inApp: 'In the app: open Learn (the graduation cap) and say what you want to do, press ? in the title bar for the screen you are on, or ⌘K and type the guide’s name.',
    edit: 'Edit this guide',
  },
  es: {
    eyebrow: 'Guías',
    title: 'Cómo hacer cada cosa en 0ct0.',
    blurb:
      'Cinco guías cortas te llevan de instalarlo a un pull request mergeado. El resto son how-tos para buscar cuando los necesites — las mismas guías que abre la app desde su botón ?.',
    start: 'Empezá acá',
    startBlurb: 'En orden. Unos veinte minutos de punta a punta.',
    howto: 'Cómo hacer',
    search: 'Buscá en las guías…',
    none: 'Ninguna guía coincide.',
    min: 'min',
    next: 'Siguiente',
    prev: 'Anterior',
    all: 'Todas las guías',
    inApp: 'En la app: abrí Learn (el birrete) y contá qué querés hacer, tocá ? en la barra de título para la pantalla en la que estás, o ⌘K y escribí el nombre de la guía.',
    edit: 'Editar esta guía',
  },
};
