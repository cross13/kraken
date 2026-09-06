import { marked } from 'marked';
import { highlight, resolveLang } from './prism';

const renderer = new marked.Renderer();

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

renderer.codespan = ({ text }: { text: string }) =>
  `<code class="md-codespan">${text}</code>`;

marked.setOptions({ gfm: true, breaks: false, renderer });

export function renderMarkdown(src: string): string {
  return marked.parse(src) as string;
}
