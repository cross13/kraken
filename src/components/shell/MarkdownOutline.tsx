import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useUi } from '../../stores/ui';
import { useGit } from '../../stores/git';
import { cn } from '../../lib/cn';

interface Heading {
  level: number;
  text: string;
  line: number;
}

/** ATX headings (`#`…`######`), skipping anything inside a fenced code block. */
export function markdownHeadings(source: string): Heading[] {
  const out: Heading[] = [];
  let fence: string | null = null;
  source.split('\n').forEach((raw, i) => {
    const f = raw.match(/^\s{0,3}(```+|~~~+)/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      return;
    }
    if (fence) return;
    const h = raw.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) out.push({ level: h[1].length, text: h[2].replace(/[*_`]/g, ''), line: i + 1 });
  });
  return out;
}

/**
 * The **outline** of the markdown file on screen, at the foot of the Explorer:
 * its headings, indented by level. Clicking one opens the file at that line —
 * a long README is navigated by its own structure, not by scrolling. It shows
 * only while a markdown file is the active tab.
 */
export function MarkdownOutline() {
  const tab = useUi((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const openFile = useUi((s) => s.openFile);
  // Any change to the working tree may be this file changing.
  const changes = useGit((s) => s.files);
  const [open, setOpen] = useState(true);
  const [source, setSource] = useState('');

  const path = tab?.kind === 'file' && /\.(md|mdx|markdown)$/i.test(tab.path) ? tab.path : null;

  useEffect(() => {
    if (!path) {
      setSource('');
      return;
    }
    let cancelled = false;
    window.octo.fs
      .read(path)
      .then((s) => {
        if (!cancelled) setSource(s);
      })
      .catch(() => {
        if (!cancelled) setSource('');
      });
    return () => {
      cancelled = true;
    };
  }, [path, changes]);

  const headings = useMemo(() => markdownHeadings(source), [source]);
  if (!path || headings.length === 0) return null;

  const top = Math.min(...headings.map((h) => h.level));

  return (
    <div className="shrink-0 max-h-[40%] flex flex-col border-t border-ink-50/[0.06]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-ink-50 hover:bg-ink-800/60 shrink-0"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Outline
      </button>
      {open && (
        <div className="overflow-y-auto px-1 pb-1.5">
          {headings.map((h) => (
            <button
              key={h.line}
              onClick={() => openFile(path, h.line)}
              title={`Line ${h.line}`}
              className={cn(
                'w-full text-left text-xs rounded-md py-1 pr-1.5 truncate hover:bg-ink-800/60',
                tab?.line === h.line ? 'bg-ink-50/[0.07] text-ink-50 font-medium' : 'text-ink-200',
                h.level === top && 'text-ink-50'
              )}
              style={{ paddingLeft: 10 + (h.level - top) * 12 }}
            >
              {h.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
