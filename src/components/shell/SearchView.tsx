import { useEffect, useMemo, useRef, useState } from 'react';
import { CaseSensitive, Regex } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { SidebarHeader, SidebarEmpty } from '../SidebarShell';
import { cn } from '../../lib/cn';
import type { WorkspaceSearch } from '../../../electron/shared/types';

/**
 * Search across the workspace (⌘⇧F). `git grep` underneath, so it sees tracked
 * and untracked files, honours `.gitignore` and skips binaries — which is why it
 * never returns `node_modules`. Results are grouped by file; a hit opens the
 * file as a tab at that line.
 */
export function SearchView() {
  const root = useWorkspace((s) => s.root);
  const openFile = useUi((s) => s.openFile);
  const input = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [caseSensitive, setCase] = useState(false);
  const [regex, setRegex] = useState(false);
  const [result, setResult] = useState<WorkspaceSearch | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    input.current?.focus();
    const focus = () => {
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener('octo:focus-search', focus);
    return () => window.removeEventListener('octo:focus-search', focus);
  }, []);

  // Search as you type, a beat after the last key; a stale answer is dropped.
  useEffect(() => {
    if (!root || query.trim().length < 2) {
      setResult(null);
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(() => {
      window.octo.git
        .search({ cwd: root, query, caseSensitive, regex })
        .then((r) => {
          if (!cancelled) setResult(r);
        })
        .catch((e) => {
          if (!cancelled) setResult({ ok: false, matches: [], truncated: false, error: String(e) });
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [root, query, caseSensitive, regex]);

  const groups = useMemo(() => {
    const by = new Map<string, WorkspaceSearch['matches']>();
    for (const m of result?.matches ?? []) by.set(m.path, [...(by.get(m.path) ?? []), m]);
    return [...by.entries()];
  }, [result]);

  const total = result?.matches.length ?? 0;

  return (
    <>
      <SidebarHeader title="Search" />
      {!root ? (
        <SidebarEmpty title="No workspace" description="Open a folder to begin." />
      ) : (
        <>
          <div className="p-2.5 border-b border-ink-50/[0.06]">
            <div className="flex items-center gap-1 rounded-lg ring-1 ring-ink-700 bg-ink-950 pl-2.5 pr-1 h-8">
              <label htmlFor="ws-search" className="sr-only">
                Search the workspace
              </label>
              <input
                id="ws-search"
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files"
                spellCheck={false}
                className="flex-1 min-w-0 bg-transparent text-[12.5px] text-ink-50 placeholder:text-ink-600 outline-none"
              />
              <Toggle active={caseSensitive} onClick={() => setCase((v) => !v)} title="Match case">
                <CaseSensitive size={14} />
              </Toggle>
              <Toggle active={regex} onClick={() => setRegex((v) => !v)} title="Regular expression">
                <Regex size={13} />
              </Toggle>
            </div>
            <p className="mt-1.5 px-0.5 text-[11.5px] text-faint min-h-[16px]">
              {busy
                ? 'Searching…'
                : result?.error
                  ? result.error
                  : result
                    ? total === 0
                      ? 'No matches.'
                      : `${total}${result.truncated ? '+' : ''} ${total === 1 ? 'match' : 'matches'} in ${groups.length} ${groups.length === 1 ? 'file' : 'files'}${result.truncated ? ' — showing the first 500' : ''}`
                    : 'Type at least two characters.'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto py-1.5">
            {groups.map(([path, list]) => (
              <section key={path} className="px-1.5 pb-1.5">
                <button
                  onClick={() => openFile(`${root}/${path}`, list[0].line)}
                  title={path}
                  className="w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-ink-50/[0.04] rounded-md"
                >
                  <span className="flex-1 truncate font-mono text-[12px] font-medium text-ink-50">{path}</span>
                  <span className="text-[11px] text-faint tabular-nums shrink-0">{list.length}</span>
                </button>
                {list.map((m, i) => (
                  <button
                    key={`${m.line}:${i}`}
                    onClick={() => openFile(`${root}/${path}`, m.line)}
                    className="w-full flex items-baseline gap-2 pl-4 pr-2 py-0.5 text-left rounded-md hover:bg-ink-50/[0.04]"
                  >
                    <span className="w-8 text-right font-mono text-[11px] text-ink-600 tabular-nums shrink-0">
                      {m.line}
                    </span>
                    <span className="flex-1 truncate font-mono text-[11.5px] text-ink-200">
                      <Hit text={m.text.trimStart()} query={query} caseSensitive={caseSensitive} regex={regex} />
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** The matched span, marked. A regex is not re-run here: the row shows as is. */
function Hit({
  text,
  query,
  caseSensitive,
  regex,
}: {
  text: string;
  query: string;
  caseSensitive: boolean;
  regex: boolean;
}) {
  if (regex) return <>{text}</>;
  const i = caseSensitive ? text.indexOf(query) : text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return <>{text}</>;
  // Keep the hit on screen in a narrow side bar: drop a long lead-in.
  const from = i > 24 ? i - 20 : 0;
  return (
    <>
      {from > 0 && '…'}
      {text.slice(from, i)}
      <span className="bg-agent/25 text-ink-50 rounded-sm">{text.slice(i, i + query.length)}</span>
      {text.slice(i + query.length)}
    </>
  );
}

function Toggle({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'w-6 h-6 grid place-items-center rounded-md transition shrink-0',
        active ? 'bg-accent/15 text-accent' : 'text-faint hover:text-ink-50'
      )}
    >
      {children}
    </button>
  );
}
