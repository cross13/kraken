import { useEffect, useRef } from 'react';
import { renderMarkdown } from '../lib/markdown';
import { useTheme } from '../stores/theme';
import { cn } from '../lib/cn';

/**
 * Markdown → HTML **plus the mermaid pass**.
 *
 * `renderMarkdown` turns a ```mermaid fence into an inert placeholder holding
 * the source; this component turns those into SVG. mermaid is imported
 * dynamically so its ~500 kB only loads for documents that actually contain a
 * diagram, and it is *bundled* rather than CDN-loaded because `index.html`'s CSP
 * is `script-src 'self'`.
 *
 * Every markdown surface in the app renders through here, so a diagram works the
 * same in a spec document, the Assistant, a run transcript or a skill viewer.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme((s) => s.theme);
  const html = renderMarkdown(source);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.md-mermaid[data-mermaid]'));
    if (nodes.length === 0) return;

    let cancelled = false;
    void (async () => {
      const mermaid = (await import('mermaid')).default;
      if (cancelled) return;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: mermaidTheme(),
      });
      for (const [i, node] of nodes.entries()) {
        const src = node.dataset.mermaid ?? '';
        try {
          const { svg } = await mermaid.render(`octo-mermaid-${seq++}-${i}`, src);
          if (cancelled) return;
          node.innerHTML = svg;
        } catch {
          if (cancelled) return;
          // A diagram that doesn't parse must not take the document with it:
          // fall back to the source, which is what the reader saw before.
          const pre = document.createElement('pre');
          pre.className = 'md-code';
          pre.textContent = src;
          node.replaceChildren(pre);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // `theme` is a dependency because the diagram colours come from the theme's
    // CSS variables — re-render the SVGs when the palette changes.
  }, [html, theme]);

  return (
    <div ref={ref} className={cn('md', className)} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

let seq = 0;

/** Map the active theme's CSS variables onto mermaid's theme variables. */
function mermaidTheme(): Record<string, string> {
  const s = getComputedStyle(document.documentElement);
  const c = (name: string, fallback: string) => {
    const v = s.getPropertyValue(name).trim();
    return v ? `rgb(${v.split(/\s+/).join(', ')})` : fallback;
  };
  const bg = c('--bg', '#131318');
  const panel = c('--panel', '#19191f');
  const card = c('--card', '#202028');
  const line = c('--line', '#3e3e4a');
  const ink = c('--ink-100', '#f0f0f6');
  const accent = c('--accent', '#8b7af9');
  return {
    background: bg,
    mainBkg: card,
    primaryColor: card,
    primaryTextColor: ink,
    primaryBorderColor: line,
    secondaryColor: panel,
    tertiaryColor: panel,
    lineColor: line,
    textColor: ink,
    nodeBorder: line,
    clusterBkg: panel,
    clusterBorder: line,
    edgeLabelBackground: bg,
    titleColor: accent,
    fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, sans-serif',
    fontSize: '13px',
  };
}
