import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, FileCode2, MessageSquareWarning, Search } from 'lucide-react';
import { useUi } from '../../stores/ui';
import { SEVERITY_META } from '../../lib/codeReview';
import { cn } from '../../lib/cn';
import type { PrFile, ReviewFinding } from '../../../electron/shared/types';

/**
 * GitHub's "Files changed", read from a local checkout: a file list beside every
 * file's diff, with old/new line numbers and the review's findings shown under
 * the line they are about. `root` is where "Open file" reads the full file from
 * — the PR's worktree, so it is the PR's version and not the workspace's.
 */

interface Row {
  kind: 'hunk' | 'ctx' | 'add' | 'del' | 'meta';
  old?: number;
  new?: number;
  text: string;
}

function parsePatch(patch: string): Row[] {
  const rows: Row[] = [];
  let o = 0;
  let n = 0;
  for (const l of patch.split('\n')) {
    const h = l.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
    if (h) {
      o = Number(h[1]);
      n = Number(h[2]);
      rows.push({ kind: 'hunk', text: l });
    } else if (l.startsWith('+')) rows.push({ kind: 'add', new: n++, text: l.slice(1) });
    else if (l.startsWith('-')) rows.push({ kind: 'del', old: o++, text: l.slice(1) });
    else if (l.startsWith('\\')) rows.push({ kind: 'meta', text: l });
    else rows.push({ kind: 'ctx', old: o++, new: n++, text: l.slice(1) });
  }
  return rows;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  A: { label: 'A', cls: 'text-good' },
  D: { label: 'D', cls: 'text-bad' },
  M: { label: 'M', cls: 'text-warn' },
};

/** Past this many rows a diff starts collapsed — GitHub's "Load diff". */
const BIG_DIFF = 1200;

export const rowId = (path: string, line?: number) =>
  `diff-${encodeURIComponent(path)}${line ? `-${line}` : ''}`;

export function DiffFiles({
  files,
  findings = [],
  root,
  focus,
}: {
  files: PrFile[];
  findings?: ReviewFinding[];
  root: string | null;
  /** scroll to a file (and line); `nonce` re-triggers the same target */
  focus?: { path: string; line?: number; nonce: number } | null;
}) {
  const openOverlay = useUi((s) => s.openOverlay);
  const [filter, setFilter] = useState('');
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => [...files].sort((a, b) => a.path.localeCompare(b.path)), [files]);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? sorted.filter((f) => f.path.toLowerCase().includes(q)) : sorted;
  }, [sorted, filter]);
  const byFile = useMemo(() => {
    const m = new Map<string, ReviewFinding[]>();
    for (const f of findings) {
      if (!f.file) continue;
      m.set(f.file, [...(m.get(f.file) ?? []), f]);
    }
    return m;
  }, [findings]);

  // A new file set (another PR, or a re-checkout) starts unviewed.
  useEffect(() => {
    setViewed(new Set());
    setCollapsed(new Set());
    setExpanded(new Set());
  }, [files]);

  const toggle = (set: Set<string>, path: string) => {
    const next = new Set(set);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  };

  const scrollTo = (path: string, line?: number) => {
    setCollapsed((s) => (s.has(path) ? toggle(s, path) : s));
    setViewed((s) => (s.has(path) ? toggle(s, path) : s));
    setExpanded((s) => (s.has(path) ? s : new Set(s).add(path)));
    // `expanded` also force-mounts the file's diff, so its rows exist by the next frames.
    setTimeout(() => {
      const el =
        (line && document.getElementById(rowId(path, line))) || document.getElementById(rowId(path));
      el?.scrollIntoView({ block: line ? 'center' : 'start' });
    }, 60);
  };

  useEffect(() => {
    if (focus) scrollTo(focus.path, focus.line);
  }, [focus?.nonce]);

  if (!files.length) {
    return <p className="k-full py-6 text-[12.5px] text-dim">This pull request changes no files.</p>;
  }

  return (
    <div className="flex h-full min-h-0">
      {/* file list */}
      <div className="flex w-[clamp(220px,20vw,320px)] shrink-0 flex-col border-r border-ink-50/[0.06]">
        <div className="p-2">
          <label className="flex items-center gap-1.5 rounded-md bg-raised px-2 py-1">
            <Search size={12} className="text-faint" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter files"
              className="w-full bg-transparent text-[12px] text-ink-50 outline-none placeholder:text-faint"
            />
          </label>
          <div className="mt-1.5 px-0.5 text-[10.5px] text-faint">
            {viewed.size}/{files.length} viewed
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-auto pb-2">
          {shown.map((f) => {
            const slash = f.path.lastIndexOf('/');
            const n = byFile.get(f.path)?.length ?? 0;
            return (
              <li key={f.path}>
                <button
                  onClick={() => scrollTo(f.path)}
                  title={f.path}
                  className={cn(
                    'flex w-full items-center gap-1.5 px-2.5 py-1 text-left hover:bg-ink-50/[0.04]',
                    viewed.has(f.path) && 'opacity-50'
                  )}
                >
                  <span className={cn('w-3 shrink-0 font-mono text-[10.5px]', STATUS[f.status]?.cls ?? 'text-dim')}>
                    {STATUS[f.status]?.label ?? f.status}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px]">
                    <span className="text-faint">{slash >= 0 ? f.path.slice(0, slash + 1) : ''}</span>
                    <span className="text-ink-50">{f.path.slice(slash + 1)}</span>
                  </span>
                  {n > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5 text-[10.5px] text-warn">
                      <MessageSquareWarning size={11} />
                      {n}
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-[10px] text-faint">
                    <span className="text-good">+{f.added}</span> <span className="text-bad">−{f.deleted}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* diffs */}
      <div className="min-w-0 flex-1 overflow-auto px-3 py-3 space-y-3">
        {shown.map((f) => {
          const isViewed = viewed.has(f.path);
          const isCollapsed = isViewed || collapsed.has(f.path);
          const isExpanded = expanded.has(f.path);
          const lines = f.added + f.deleted;
          // GitHub's rule: deleted and very large files wait to be asked for.
          const gated = !isExpanded && (f.status === 'D' || lines > BIG_DIFF);
          return (
            <section key={f.path} id={rowId(f.path)} className="rounded-lg bg-card ring-1 ring-ink-50/[0.06]">
              <header className="sticky top-0 z-10 flex items-center gap-2 rounded-t-lg bg-card px-2.5 py-1.5 border-b border-ink-50/[0.06]">
                <button
                  onClick={() => setCollapsed((s) => toggle(s, f.path))}
                  className="rounded p-0.5 text-dim hover:text-ink-50"
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>
                <span className={cn('font-mono text-[11px]', STATUS[f.status]?.cls ?? 'text-dim')}>{f.status}</span>
                <span className="min-w-0 truncate font-mono text-[12px] text-ink-50">{f.path}</span>
                <span className="shrink-0 font-mono text-[11px]">
                  <span className="text-good">+{f.added}</span> <span className="text-bad">−{f.deleted}</span>
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {root && f.status !== 'D' && (
                    <button
                      onClick={() => openOverlay({ kind: 'file', path: `${root}/${f.path}` })}
                      title="Open the PR's version of this file"
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-dim hover:bg-ink-50/[0.06] hover:text-ink-50"
                    >
                      <FileCode2 size={12} /> Open
                    </button>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-dim">
                    <input
                      type="checkbox"
                      checked={isViewed}
                      onChange={() => setViewed((s) => toggle(s, f.path))}
                      className="accent-[rgb(var(--accent))]"
                    />
                    Viewed
                  </label>
                </div>
              </header>

              {!isCollapsed &&
                (gated ? (
                  <button
                    onClick={() => setExpanded((s) => new Set(s).add(f.path))}
                    className="w-full px-3 py-2.5 text-left text-[12px] text-accent-text hover:underline"
                  >
                    {f.status === 'D' ? `File deleted (${f.deleted} lines) — show diff` : `Large diff (${lines} lines) — load it`}
                  </button>
                ) : (
                  <Lazy force={isExpanded} estimate={Math.min(lines + 4, 400) * 18}>
                    <FileBody file={f} findings={byFile.get(f.path) ?? []} />
                  </Lazy>
                ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Mount `children` only once they come near the viewport: a PR that deletes a
 * vendored tree is hundreds of thousands of rows, and rendering them all at
 * once freezes the window. Once mounted it stays mounted.
 */
function Lazy({ children, estimate, force }: { children: ReactNode; estimate: number; force?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || force || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '1200px 0px' }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen, force]);
  if (seen || force) return <>{children}</>;
  return <div ref={ref} style={{ height: estimate }} />;
}

function FileBody({ file, findings }: { file: PrFile; findings: ReviewFinding[] }) {
  const rows = useMemo(() => (file.patch ? parsePatch(file.patch) : null), [file.patch]);
  const lineSet = useMemo(
    () => new Set(rows?.filter((r) => r.new != null && r.kind !== 'del').map((r) => r.new!)),
    [rows]
  );
  const outside = findings.filter((x) => !x.line || !lineSet.has(x.line));
  const atLine = new Map<number, ReviewFinding[]>();
  for (const x of findings) {
    if (x.line && lineSet.has(x.line)) atLine.set(x.line, [...(atLine.get(x.line) ?? []), x]);
  }
  return (
    <div>
      {outside.length > 0 && (
        <div className="space-y-1.5 border-b border-ink-50/[0.06] p-2">
          {outside.map((x) => (
            <FindingNote key={x.id} f={x} />
          ))}
        </div>
      )}
      {!rows ? (
        <p className="px-3 py-3 text-[12px] text-dim">Binary file, or too large to show inline.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-[11.5px] leading-[1.55]">
            <tbody>
              {rows.map((r, i) =>
                r.kind === 'hunk' ? (
                  <tr key={i} className="bg-accent/[0.06] text-dim">
                    <td colSpan={3} className="px-3 py-0.5">
                      {r.text}
                    </td>
                  </tr>
                ) : (
                  <DiffRow
                    key={i}
                    row={r}
                    id={r.kind !== 'del' && r.new ? rowId(file.path, r.new) : undefined}
                    notes={r.kind !== 'del' && r.new ? atLine.get(r.new) : undefined}
                  />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DiffRow({ row, id, notes }: { row: Row; id?: string; notes?: ReviewFinding[] }) {
  const tint =
    row.kind === 'add' ? 'bg-good/[0.09]' : row.kind === 'del' ? 'bg-bad/[0.09]' : row.kind === 'meta' ? 'text-faint' : '';
  const sign = row.kind === 'add' ? '+' : row.kind === 'del' ? '−' : ' ';
  return (
    <>
      <tr id={id} className={tint}>
        <td className="w-[1%] select-none whitespace-nowrap px-2 text-right text-faint">{row.old ?? ''}</td>
        <td className="w-[1%] select-none whitespace-nowrap px-2 text-right text-faint">{row.new ?? ''}</td>
        <td className="whitespace-pre pr-4 text-ink-200">
          <span
            className={cn(
              'inline-block w-4 select-none',
              row.kind === 'add' ? 'text-good' : row.kind === 'del' ? 'text-bad' : 'text-faint'
            )}
          >
            {sign}
          </span>
          {row.text}
        </td>
      </tr>
      {notes?.length ? (
        <tr>
          <td colSpan={3} className="px-2 py-1.5">
            <div className="space-y-1.5 font-sans">
              {notes.map((f) => (
                <FindingNote key={f.id} f={f} />
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function FindingNote({ f }: { f: ReviewFinding }) {
  return (
    <div className="max-w-[90ch] rounded-md bg-raised p-2.5 ring-1 ring-ink-50/[0.06] whitespace-normal">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            SEVERITY_META[f.severity].cls
          )}
        >
          {SEVERITY_META[f.severity].label}
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-ink-50">
            {f.title}
            {f.line ? <span className="ml-1.5 font-mono text-[11px] font-normal text-faint">L{f.line}</span> : null}
          </div>
          {f.detail && <p className="mt-1 whitespace-pre-wrap text-[12px] text-ink-200">{f.detail}</p>}
          {f.suggestion && (
            <p className="mt-1 whitespace-pre-wrap text-[12px] text-dim">
              <span className="text-ink-400">Suggestion: </span>
              {f.suggestion}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

