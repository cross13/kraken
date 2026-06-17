import { marked } from 'marked';
import { highlight, resolveLang } from './prism';

const renderer = new marked.Renderer();

renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
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
