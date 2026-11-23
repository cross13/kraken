import { useEffect, useMemo, useRef, useState } from 'react';
import { Hash, WrapText, Palette, Download, Sparkles, GitCompare } from 'lucide-react';
import { useUi } from '../../stores/ui';
import { useSyntax } from '../../stores/syntax';
import { detectLanguage } from '../../lib/fileLang';
import { highlight, ensureLanguage, isLanguageReady, isInstallable } from '../../lib/prism';
import { BUILTIN_THEMES, findBuiltin, themeToCssVars } from '../../lib/syntaxThemes';
import { useTheme } from '../../stores/theme';
import { cn } from '../../lib/cn';
import { Markdown } from '../Markdown';
import { markdownHeadings } from '../shell/MarkdownOutline';
import { useWorkspace } from '../../stores/workspace';
import { useGit } from '../../stores/git';

/**
 * How a markdown file is shown. `split` is the default: a README is read far
 * more often than it is inspected, but the source beside it is what tells you
 * *why* it renders the way it does.
 */
type MdMode = 'code' | 'split' | 'preview';
const MD_MODES: { id: MdMode; label: string }[] = [
  { id: 'code', label: 'Code' },
  { id: 'split', label: 'Split' },
  { id: 'preview', label: 'Preview' },
];

function loadMdMode(): MdMode {
  try {
    const v = localStorage.getItem('octo.mdMode');
    if (v === 'code' || v === 'split' || v === 'preview') return v;
  } catch {
    // ignore (e.g. storage disabled)
  }
  return 'split';
}

// Files larger than this are shown as plain text — highlighting a huge blob
// would jank the UI for little benefit.
const MAX_HIGHLIGHT = 400_000;

export function FileViewer({
  path,
  line,
  lineNonce,
}: {
  path: string;
  /** scroll to and mark this line (a search hit); `lineNonce` re-triggers it */
  line?: number;
  lineNonce?: number;
}) {
  const codeScroll = useRef<HTMLDivElement>(null);
  const previewScroll = useRef<HTMLDivElement>(null);
  const [mark, setMark] = useState<{ top: number; height: number } | null>(null);
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const config = useSyntax((s) => s.config);
  const activeTheme = useSyntax((s) => s.activeTheme);
  const setTheme = useSyntax((s) => s.setTheme);
  const setLineNumbers = useSyntax((s) => s.setLineNumbers);
  const setWrap = useSyntax((s) => s.setWrap);
  const installLanguage = useSyntax((s) => s.installLanguage);
  const openLibrary = useUi((s) => s.openLibrary);
  const openDiff = useUi((s) => s.openDiff);
  const root = useWorkspace((s) => s.root);
  const rel = root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : null;
  // Re-read when git says this file moved, so an agent's edit shows up live.
  const change = useGit((s) => (rel ? s.files.find((f) => f.path === rel) : undefined));
  const stamp = change ? `${change.status}:${change.added ?? ''}:${change.deleted ?? ''}:${change.mtime ?? ''}` : '';

  const isMarkdown = /\.(md|mdx|markdown)$/i.test(path);
  const [mdMode, setMdModeState] = useState<MdMode>(loadMdMode);
  const setMdMode = (m: MdMode) => {
    setMdModeState(m);
    try {
      localStorage.setItem('octo.mdMode', m);
    } catch {
      // ignore (e.g. storage disabled)
    }
  };
  const showCode = !isMarkdown || mdMode !== 'preview';
  const showPreview = isMarkdown && mdMode !== 'code';

  const lang = useMemo(() => detectLanguage(path), [path]);
  const installed = lang ? config.languages.includes(lang.id) : false;
  const tooBig = content.length > MAX_HIGHLIGHT;

  useEffect(() => {
    setError(null);
    window.octo.fs
      .read(path)
      .then(setContent)
      .catch((e) => setError(String(e)));
  }, [path, stamp]);

  // Resolve highlighting — load an installed grammar on demand, else plain text.
  useEffect(() => {
    let cancelled = false;
    if (!lang || !content || tooBig) {
      setHighlighted(null);
    } else if (isLanguageReady(lang.id)) {
      setHighlighted(highlight(content, lang.id));
    } else if (installed && isInstallable(lang.id)) {
      ensureLanguage(lang.id).then((ok) => {
        if (!cancelled) setHighlighted(ok ? highlight(content, lang.id) : null);
      });
    } else {
      setHighlighted(null);
    }
    return () => {
      cancelled = true;
    };
  }, [content, lang, installed, tooBig]);

  // Bring a requested line into view and mark it. Rows have one fixed height
  // unless wrapping is on, where a line's position cannot be computed — then
  // the file simply opens at the top.
  useEffect(() => {
    const box = codeScroll.current;
    const pre = box?.querySelector<HTMLElement>('.code-lc');
    if (!line || !box || !pre || !content || config.wrap) {
      setMark(null);
      return;
    }
    const lh = parseFloat(getComputedStyle(pre).lineHeight) || 20;
    const top = pre.offsetTop + (line - 1) * lh;
    setMark({ top, height: lh });
    box.scrollTop = Math.max(0, top - box.clientHeight / 3);
  }, [line, lineNonce, content, config.wrap, highlighted]);

  // In the rendered half the same jump lands on the heading that line is under
  // — the n-th heading of the source is the n-th heading element of the preview.
  useEffect(() => {
    const box = previewScroll.current;
    if (!line || !box || !content) return;
    const before = markdownHeadings(content).filter((h) => h.line <= line).length;
    if (before === 0) {
      box.scrollTop = 0;
      return;
    }
    const el = box.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')[before - 1];
    el?.scrollIntoView({ block: 'start' });
  }, [line, lineNonce, content, mdMode]);

  const showNumbers = config.lineNumbers && !config.wrap;
  const lines = useMemo(() => content.split('\n'), [content]);
  const gutter = useMemo(
    () => (showNumbers ? lines.map((_, i) => i + 1).join('\n') : ''),
    [showNumbers, lines]
  );

  const canInstall = lang && isInstallable(lang.id) && !installed && !isLanguageReady(lang.id);
  // The default syntax theme is drawn for a dark panel; on a light palette it
  // is near-white text on paper. Someone who never picked a theme gets the
  // light one there — an explicit choice is always respected.
  const appTheme = useTheme((s) => s.theme);
  const lightApp = appTheme === 'brasa' || appTheme === 'daylight';
  const lightDefault = lightApp && config.theme === 'abyss' ? findBuiltin('github-light') : null;
  const themeVars = themeToCssVars(
    lightDefault ? { ...lightDefault, bg: 'transparent' } : activeTheme()
  );
  const customNames = Object.keys(config.customThemes);

  if (error) return <div className="p-6 text-sm text-bad">{error}</div>;

  return (
    <div className="h-full flex flex-col bg-ink-950">
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-ink-800/60 px-4 h-10 shrink-0">
        <span className="text-[11px] text-ink-500 font-mono truncate flex-1 min-w-0" title={path}>
          {rel ?? path}
        </span>
        {lang && (
          <span className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-elev text-dim shrink-0">
            {lang.label}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {isMarkdown && (
            <div role="group" aria-label="Markdown view" className="flex p-0.5 rounded-lg bg-elev">
              {MD_MODES.map((m) => (
                <button
                  key={m.id}
                  aria-pressed={mdMode === m.id}
                  onClick={() => setMdMode(m.id)}
                  className={cn(
                    'h-6 px-2.5 rounded-md text-[12px] transition',
                    mdMode === m.id
                      ? 'bg-ink-950 text-ink-50 font-semibold ring-1 ring-ink-700'
                      : 'text-dim hover:text-ink-50'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {rel && change && (
            <button
              onClick={() => openDiff(rel)}
              title="Open this file's diff against HEAD"
              className="flex items-center gap-1.5 h-7 px-2 rounded-lg bg-elev text-[12px] text-dim hover:text-ink-50"
            >
              <GitCompare size={13} /> Changes
            </button>
          )}
          <div className="flex items-center gap-1 px-2 h-7 rounded-lg bg-elev">
            <Palette size={12} className="text-faint" />
            <select
              value={config.theme}
              onChange={(e) => setTheme(e.target.value)}
              className="bg-transparent text-[11.5px] text-ink-100 outline-none cursor-pointer"
              title="Syntax color theme"
            >
              {BUILTIN_THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
              {customNames.length > 0 && (
                <optgroup label="Custom">
                  {customNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <ToolbarToggle
            active={config.lineNumbers}
            onClick={() => setLineNumbers(!config.lineNumbers)}
            title="Line numbers"
          >
            <Hash size={13} />
          </ToolbarToggle>
          <ToolbarToggle active={config.wrap} onClick={() => setWrap(!config.wrap)} title="Wrap lines">
            <WrapText size={13} />
          </ToolbarToggle>
          <ToolbarToggle
            active={false}
            onClick={() => openLibrary('appearance')}
            title="Syntax settings — themes & languages"
          >
            <Sparkles size={13} />
          </ToolbarToggle>
        </div>
      </div>

      {/* install prompt for detected-but-not-installed languages */}
      {canInstall && (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-accent/[0.07] border-b border-ink-800/60 shrink-0">
          <Download size={13} className="text-accent shrink-0" />
          <span className="text-[12px] text-dim flex-1">
            <span className="text-ink-100 font-medium">{lang!.label}</span> highlighting isn't
            installed yet.
          </span>
          <button
            onClick={() => installLanguage(lang!.id)}
            className="text-[11.5px] font-medium px-2.5 h-7 rounded-lg bg-accent text-accent-fg hover:opacity-90 shrink-0"
          >
            Install {lang!.label}
          </button>
        </div>
      )}
      {tooBig && (
        <div className="px-4 py-1.5 text-[11px] text-faint bg-ink-900/60 border-b border-ink-800/60 shrink-0">
          Large file — highlighting disabled.
        </div>
      )}

      {/* code and, for markdown, the rendered document beside it */}
      <div className="flex-1 min-h-0 flex">
        {showCode && (
          <div
            ref={codeScroll}
            className={cn('min-w-0 overflow-auto', showPreview ? 'w-1/2 border-r border-ink-800/60' : 'flex-1')}
          >
            <div
              className={cn('code-view relative flex px-4 py-4 min-h-full', config.wrap && 'wrap')}
              style={themeVars}
            >
              {mark && (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 bg-agent/15 shadow-[inset_3px_0_0_rgb(var(--agent))] pointer-events-none"
                  style={{ top: mark.top, height: mark.height }}
                />
              )}
              {showNumbers && <pre className="code-ln m-0">{gutter}</pre>}
              <pre className="code-lc m-0">
                {highlighted != null ? (
                  <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                ) : (
                  <code>{content}</code>
                )}
              </pre>
            </div>
          </div>
        )}
        {showPreview && (
          // `Markdown` is the app's one renderer: raw HTML escaped, link and
          // image schemes allow-listed. A file from an opened workspace is
          // exactly the untrusted text those overrides exist for.
          <div ref={previewScroll} className={cn('min-w-0 k-scroll', showCode ? 'w-1/2' : 'flex-1')}>
            <div className="k-read k-pad-y">
              <Markdown source={content} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'w-7 h-7 grid place-items-center rounded-lg transition',
        active ? 'bg-accent/15 text-accent' : 'bg-elev text-dim hover:text-ink-50'
      )}
    >
      {children}
    </button>
  );
}
