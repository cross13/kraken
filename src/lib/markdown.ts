import { marked } from 'marked';
import { highlight, resolveLang } from './prism';

const renderer = new marked.Renderer();

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Which URL schemes may appear in a rendered document.
 *
 * marked's own `cleanUrl` only `encodeURI`s an href — it does **not** reject
 * `javascript:`, so an unfiltered `[x](javascript:...)` renders as a live
 * `<a href="javascript:...">`. The markdown reaching this renderer includes
 * text the app did not author — a tracker's ticket description and comments, a
 * run transcript, a skill body — and the renderer it lands in has `window.octo`
 * on it. The allowlist is the boundary, not a nicety.
 */
const SAFE_SCHEME = /^(?:https?:|mailto:|tel:|#|\/|\.{0,2}\/)/i;
/** Images may additionally be inline data, but only as an image payload. */
const SAFE_IMG_SCHEME = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i;

function safeUrl(href: string | null | undefined, image = false): string | null {
  const raw = (href ?? '').trim();
  if (!raw) return null;
  // Test with whitespace and control characters removed: `java\nscript:` is the
  // classic bypass, and the HTML parser collapses it back for us.
  const probe = raw.replace(/[\u0000-\u0020]/g, '');
  if (SAFE_SCHEME.test(probe)) return raw;
  if (image && SAFE_IMG_SCHEME.test(probe)) return raw;
  return null;
}

// Raw HTML is markdown's escape hatch, and every markdown source in this app can
// carry text somebody else wrote. Escape both the block-level and the inline
// `html` token — marked routes both through this one method — so a document
// renders as the text it is, never as markup.
renderer.html = ({ text }: { text: string }) => escapeHtml(text);

renderer.link = function ({ href, title, tokens }) {
  const body = this.parser.parseInline(tokens);
  const url = safeUrl(href);
  // A link we will not follow still shows its text: dropping it would silently
  // lose content the reader is meant to see.
  if (!url) return body;
  const t = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${escapeHtml(url)}"${t} rel="noopener noreferrer">${body}</a>`;
};

renderer.image = ({ href, title, text }) => {
  const url = safeUrl(href, true);
  if (!url) return escapeHtml(text ?? '');
  const t = title ? ` title="${escapeHtml(title)}"` : '';
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text ?? '')}"${t}>`;
};

renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  // Mermaid is not a syntax-highlighting target: emit an inert placeholder
  // carrying the source, which <Markdown> replaces with the rendered SVG. The
  // <pre> inside is the fallback for anything that injects this HTML directly.
  if ((lang ?? '').trim().toLowerCase() === 'mermaid') {
    return `<div class="md-mermaid" data-mermaid="${escapeHtml(text)}"><pre class="md-code">${escapeHtml(text)}</pre></div>`;
  }
  const resolved = resolveLang(lang);
  const html = highlight(text, resolved);
  const cls = resolved === 'plain' ? '' : ` language-${resolved}`;
  return `<pre class="md-code${cls}"><code class="language-${resolved}">${html}</code></pre>`;
};

// `text` here is already escaped by marked's tokenizer, so it is emitted as-is.
renderer.codespan = ({ text }: { text: string }) => `<code class="md-codespan">${text}</code>`;

marked.setOptions({ gfm: true, breaks: false, renderer });

export function renderMarkdown(src: string): string {
  return marked.parse(src) as string;
}
