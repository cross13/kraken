import { useEffect, useMemo, useState } from 'react';
import { Hash, WrapText, Palette, Download, Sparkles } from 'lucide-react';
import { useUi } from '../../stores/ui';
import { useSyntax } from '../../stores/syntax';
import { detectLanguage } from '../../lib/fileLang';
import { highlight, ensureLanguage, isLanguageReady, isInstallable } from '../../lib/prism';
import { BUILTIN_THEMES, themeToCssVars } from '../../lib/syntaxThemes';
import { cn } from '../../lib/cn';

// Files larger than this are shown as plain text — highlighting a huge blob
// would jank the UI for little benefit.
const MAX_HIGHLIGHT = 400_000;

export function FileViewer({ path }: { path: string }) {
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const config = useSyntax((s) => s.config);
  const activeTheme = useSyntax((s) => s.activeTheme);
  const setTheme = useSyntax((s) => s.setTheme);
  const setLineNumbers = useSyntax((s) => s.setLineNumbers);
  const setWrap = useSyntax((s) => s.setWrap);
  const installLanguage = useSyntax((s) => s.installLanguage);
  const openTab = useUi((s) => s.openTab);

  const lang = useMemo(() => detectLanguage(path), [path]);
  const installed = lang ? config.languages.includes(lang.id) : false;
  const tooBig = content.length > MAX_HIGHLIGHT;

  useEffect(() => {
    setError(null);
    setHighlighted(null);
    window.kraken.fs
      .read(path)
      .then(setContent)
      .catch((e) => setError(String(e)));
  }, [path]);

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

  const showNumbers = config.lineNumbers && !config.wrap;
  const lines = useMemo(() => content.split('\n'), [content]);
  const gutter = useMemo(
    () => (showNumbers ? lines.map((_, i) => i + 1).join('\n') : ''),
    [showNumbers, lines]
  );

  const canInstall = lang && isInstallable(lang.id) && !installed && !isLanguageReady(lang.id);
  const themeVars = themeToCssVars(activeTheme());
  const customNames = Object.keys(config.customThemes);

  if (error) return <div className="p-6 text-sm text-bad">{error}</div>;

  return (
    <div className="h-full flex flex-col bg-ink-950">
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-ink-800/60 px-4 h-10 shrink-0">
        <span className="text-[11px] text-ink-500 font-mono truncate flex-1 min-w-0">{path}</span>
        {lang && (
          <span className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-elev text-dim shrink-0">
            {lang.label}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
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
            onClick={() => openTab({ id: 'syntax-studio', title: 'Syntax', kind: 'syntax-studio' })}
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

      {/* code */}
      <div className="flex-1 overflow-auto">
        <div className={cn('code-view flex px-4 py-4 min-h-full', config.wrap && 'wrap')} style={themeVars}>
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
