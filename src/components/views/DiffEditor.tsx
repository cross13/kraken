import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileCode2, MessageSquareWarning, RefreshCw, Undo2, Wand2, WrapText } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { useGit } from '../../stores/git';
import { cn } from '../../lib/cn';
import { fixFindingPrompt, parseReview, SEVERITY_META } from '../../lib/codeReview';
import { useChat } from '../../stores/chat';
import type { FileDiff, ReviewFinding } from '../../../electron/shared/types';

/**
 * One file against HEAD, the way GitHub draws it: green for what was added, red
 * for what was removed, the changed words inside a changed line marked a shade
 * stronger. **Split** puts HEAD on the left and the working tree on the right;
 * **Unified** stacks them. It re-reads the diff whenever the working tree's
 * change list moves, so a task run editing the file updates the tab under you.
 */

type Layout = 'split' | 'unified';

interface Line {
  kind: 'ctx' | 'add' | 'del';
  old?: number;
  new?: number;
  text: string;
}

/** A row of the split view: either side may be missing. */
interface Pair {
  left?: Line;
  right?: Line;
}

type Block =
  // `raw` is the whole hunk as git wrote it — what a revert sends back.
  | { kind: 'hunk'; text: string; raw: string }
  | { kind: 'ctx'; line: Line }
  // A run of removals followed by additions — one "change" you can step to.
  | { kind: 'change'; index: number; dels: Line[]; adds: Line[] };

function parse(patch: string): { blocks: Block[]; changes: number } {
  const blocks: Block[] = [];
  let o = 0;
  let n = 0;
  let changes = 0;
  let cur: { dels: Line[]; adds: Line[] } | null = null;
  const flush = () => {
    if (cur) blocks.push({ kind: 'change', index: changes++, ...cur });
    cur = null;
  };
  for (const l of patch.split('\n')) {
    const h = l.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
    if (h) {
      flush();
      o = Number(h[1]);
      n = Number(h[2]);
      blocks.push({ kind: 'hunk', text: l, raw: '' });
    } else if (l.startsWith('+')) {
      cur ??= { dels: [], adds: [] };
      cur.adds.push({ kind: 'add', new: n++, text: l.slice(1) });
    } else if (l.startsWith('-')) {
      // A removal after additions starts a new change, as git orders - before +.
      if (cur && cur.adds.length) flush();
      cur ??= { dels: [], adds: [] };
      cur.dels.push({ kind: 'del', old: o++, text: l.slice(1) });
    } else if (l.startsWith(' ')) {
      flush();
      blocks.push({ kind: 'ctx', line: { kind: 'ctx', old: o++, new: n++, text: l.slice(1) } });
    }
    // Anything else is not a line of the file: "\\ No newline at end of file",
    // or the empty string the patch's trailing newline leaves behind.
  }
  flush();
  // Attach each hunk's full text, split exactly the way the backend splits it.
  const raws: string[] = [];
  for (const l of patch.split('\n')) {
    if (l.startsWith('@@')) raws.push(l + '\n');
    else if (raws.length && l !== '') raws[raws.length - 1] += l + '\n';
  }
  let h = 0;
  for (const b of blocks) if (b.kind === 'hunk') b.raw = raws[h++] ?? '';
  return { blocks, changes };
}

/** The part of two lines that differs, by common prefix and suffix. */
function wordSpan(a: string, b: string): { start: number; endA: number; endB: number } | null {
  let start = 0;
  const max = Math.min(a.length, b.length);
  while (start < max && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  // Nothing in common: marking the whole line twice says nothing the row
  // colour did not already say.
  if (start === 0 && endA === a.length && endB === b.length) return null;
  return { start, endA, endB };
}

function Code({ text, mark, cls }: { text: string; mark?: [number, number]; cls: string }) {
  if (!mark || mark[0] >= mark[1]) return <>{text || ' '}</>;
  return (
    <>
      {text.slice(0, mark[0])}
      <span className={cls}>{text.slice(mark[0], mark[1])}</span>
      {text.slice(mark[1])}
    </>
  );
}

export function DiffEditor({ path }: { path: string }) {
  const root = useWorkspace((s) => s.root);
  const openFile = useUi((s) => s.openFile);
  // The change list is the cheapest "the working tree moved" signal there is.
  const files = useGit((s) => s.files);
  const refreshGit = useGit((s) => s.refresh);
  const author = useGit((s) => s.authors[path]);
  const openOverlay = useUi((s) => s.openOverlay);
  const openSpec = useUi((s) => s.openSpec);
  const stamp = useMemo(() => {
    const f = files.find((x) => x.path === path);
    return f ? `${f.status}:${f.added ?? ''}:${f.deleted ?? ''}:${f.mtime ?? ''}` : 'clean';
  }, [files, path]);

  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      return localStorage.getItem('octo.diffLayout') === 'unified' ? 'unified' : 'split';
    } catch {
      return 'split';
    }
  });
  const [wrap, setWrap] = useState(false);
  // Reverting throws work away, so it is confirmed where it was asked — on the
  // hunk's own row — rather than in a dialog that names nothing.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const revert = async (raw: string) => {
    if (!root) return;
    setRevertError(null);
    const res = await window.octo.git.revertHunk({ cwd: root, path, hunk: raw });
    setConfirming(null);
    if (!res.ok) setRevertError(res.error ?? 'Could not revert this hunk.');
    await refreshGit();
    // The file's line counts can come out the same; force the re-read.
    setTick((n) => n + 1);
  };

  // The last code review of the spec whose branch this is, narrowed to this
  // file. Advisory, and possibly older than the code on screen — it says so.
  const branch = useGit((s) => s.branch);
  const reviewed = useWorkspace((s) =>
    branch ? s.specs.find((sp) => sp.branch === branch && sp.review) : undefined
  );
  const [findings, setFindings] = useState<ReviewFinding[]>([]);
  useEffect(() => {
    if (!root || !reviewed) {
      setFindings([]);
      return;
    }
    let cancelled = false;
    window.octo.specs
      .readReview(root, reviewed.id)
      .then((md) => {
        if (cancelled || !md) return;
        setFindings(parseReview(md, `branch:${branch}`).findings.filter((f) => f.file === path));
      })
      .catch(() => {
        if (!cancelled) setFindings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [root, reviewed?.id, reviewed?.review?.at, branch, path]);
  const [at, setAt] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    window.octo.git
      .fileDiff({ cwd: root, path })
      .then((d) => {
        if (!cancelled) setDiff(d);
      })
      .catch((e) => {
        if (!cancelled)
          setDiff({
            ok: false,
            path,
            status: 'M',
            patch: '',
            added: 0,
            deleted: 0,
            binary: false,
            truncated: false,
            error: String(e),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [root, path, stamp, tick]);

  const { blocks, changes } = useMemo(() => parse(diff?.patch ?? ''), [diff?.patch]);

  // A finding sits under the line it is about when that line is in the diff;
  // the rest (file-wide, or about a line outside every hunk) go above it.
  const { byLine, loose } = useMemo(() => {
    const shown = new Set<number>();
    for (const b of blocks) {
      if (b.kind === 'ctx' && b.line.new) shown.add(b.line.new);
      if (b.kind === 'change') for (const l of b.adds) if (l.new) shown.add(l.new);
    }
    const byLine = new Map<number, ReviewFinding[]>();
    const loose: ReviewFinding[] = [];
    for (const f of findings) {
      if (f.line && shown.has(f.line)) byLine.set(f.line, [...(byLine.get(f.line) ?? []), f]);
      else loose.push(f);
    }
    return { byLine, loose };
  }, [blocks, findings]);
  const under = (line?: number) =>
    line && byLine.has(line) ? byLine.get(line)!.map((f) => <Finding key={f.id} finding={f} />) : null;

  const pickLayout = (l: Layout) => {
    setLayout(l);
    try {
      localStorage.setItem('octo.diffLayout', l);
    } catch {
      // ignore (e.g. storage disabled)
    }
  };

  const go = (delta: number) => {
    if (changes === 0) return;
    const next = (at + delta + changes) % changes;
    setAt(next);
    scroller.current
      ?.querySelector(`[data-change="${next}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const body = () => {
    if (!diff) return <Note>Reading the diff…</Note>;
    if (!diff.ok) return <Note tone="bad">{diff.error ?? 'Could not read the diff.'}</Note>;
    if (diff.binary) return <Note>Binary file — there is no text diff to show.</Note>;
    if (blocks.length === 0) return <Note>No changes against HEAD.</Note>;

    return (
      <div
        className={cn(
          'font-mono text-[12px] leading-[22px] text-ink-100 py-2',
          wrap ? 'diff-wrap' : 'min-w-max'
        )}
      >
        {blocks.map((b, i) => {
          if (b.kind === 'hunk')
            return (
              <div key={i} className="diff-row diff-hunk items-center">
                <span className="diff-code">{b.text}</span>
                {diff.status === 'M' && !diff.truncated && (
                  <span className="sticky right-2 flex items-center gap-1.5 pr-2 font-sans text-[11.5px]">
                    {confirming === b.raw ? (
                      <>
                        <span className="text-ink-50">Put this hunk back to HEAD?</span>
                        <button
                          onClick={() => void revert(b.raw)}
                          className="h-5 px-2 rounded bg-danger text-ink-950 font-semibold"
                        >
                          Revert
                        </button>
                        <button onClick={() => setConfirming(null)} className="h-5 px-2 rounded bg-elev text-ink-50">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirming(b.raw)}
                        title="Put this hunk back to what the last commit has"
                        className="flex items-center gap-1 h-5 px-1.5 rounded text-faint hover:text-ink-50 hover:bg-elev"
                      >
                        <Undo2 size={11} /> Revert hunk
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          if (b.kind === 'ctx')
            return (
              <div key={i}>
                {layout === 'split' ? (
                  <SplitRow pair={{ left: b.line, right: b.line }} />
                ) : (
                  <UnifiedRow line={b.line} />
                )}
                {under(b.line.new)}
              </div>
            );

          // A change: pair the i-th removal with the i-th addition.
          const rows = Math.max(b.dels.length, b.adds.length);
          const pairs: Pair[] = Array.from({ length: rows }, (_, k) => ({
            left: b.dels[k],
            right: b.adds[k],
          }));
          const spans = pairs.map((p) => (p.left && p.right ? wordSpan(p.left.text, p.right.text) : null));
          return (
            <div
              key={i}
              data-change={b.index}
              className={cn(b.index === at && changes > 1 && 'shadow-[inset_3px_0_0_rgb(var(--ink-50))]')}
            >
              {layout === 'split'
                ? pairs.map((p, k) => <SplitRow key={k} pair={p} span={spans[k]} />)
                : [
                    ...b.dels.map((l, k) => (
                      <UnifiedRow key={`d${k}`} line={l} mark={spans[k] ? [spans[k]!.start, spans[k]!.endA] : undefined} />
                    )),
                    ...b.adds.map((l, k) => (
                      <UnifiedRow key={`a${k}`} line={l} mark={spans[k] ? [spans[k]!.start, spans[k]!.endB] : undefined} />
                    )),
                  ]}
              {b.adds.map((l) => under(l.new))}
            </div>
          );
        })}
        {diff.truncated && <Note>The diff was cut — this file changed more than can be shown here.</Note>}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <div className="flex items-center gap-2 flex-wrap border-b border-ink-800/60 px-4 min-h-10 py-1 shrink-0">
        <span className="font-mono text-[11.5px] text-faint truncate min-w-0">{path}</span>
        {diff?.ok && (
          <span className="font-mono text-[11.5px] tabular-nums shrink-0">
            <span style={{ color: 'var(--diff-add-text)' }}>+{diff.added}</span>{' '}
            <span style={{ color: 'var(--diff-del-text)' }}>−{diff.deleted}</span>
          </span>
        )}
        <span className="flex-1" />
        {changes > 0 && (
          <>
            <span className="text-[12px] text-faint tabular-nums">
              Change {Math.min(at + 1, changes)} of {changes}
            </span>
            <IconBtn title="Previous change" onClick={() => go(-1)}>
              <ArrowUp size={13} />
            </IconBtn>
            <IconBtn title="Next change" onClick={() => go(1)}>
              <ArrowDown size={13} />
            </IconBtn>
          </>
        )}
        <div role="group" aria-label="Diff layout" className="flex p-0.5 rounded-lg bg-elev">
          {(['split', 'unified'] as Layout[]).map((l) => (
            <button
              key={l}
              aria-pressed={layout === l}
              onClick={() => pickLayout(l)}
              className={cn(
                'h-6 px-2.5 rounded-md text-[12px] capitalize transition',
                layout === l ? 'bg-ink-950 text-ink-50 font-semibold ring-1 ring-ink-700' : 'text-dim hover:text-ink-50'
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <IconBtn title="Wrap lines" active={wrap} onClick={() => setWrap((w) => !w)}>
          <WrapText size={13} />
        </IconBtn>
        <IconBtn title="Re-read from git" onClick={() => void refreshGit()}>
          <RefreshCw size={13} />
        </IconBtn>
        {root && diff?.status !== 'D' && (
          <button
            onClick={() => openFile(`${root}/${path}`)}
            className="flex items-center gap-1.5 h-7 px-2 rounded-lg text-[12px] text-dim hover:text-ink-50 hover:bg-elev"
          >
            <FileCode2 size={13} /> Open file
          </button>
        )}
      </div>

      {/* Where this change came from. File-level: the run that last wrote the
          file, not a claim about each line. */}
      {author && (
        <div className="flex items-center gap-2.5 flex-wrap px-4 py-1.5 border-b border-ink-800/60 bg-ink-900 text-[12px] text-dim shrink-0">
          <span className="w-[18px] h-[18px] grid place-items-center bg-agent text-agent-fg font-mono text-[9.5px] font-semibold shrink-0">
            AI
          </span>
          <span className="flex-1 min-w-0 truncate">
            Last written by{' '}
            <span className="font-mono text-ink-50">
              {[author.task_id, author.agent ? `@${author.agent}` : (author.kind ?? author.source)]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {author.spec_id && (
              <>
                {' '}
                in <span className="font-mono text-ink-50">{author.spec_id}</span>
              </>
            )}
          </span>
          {author.spec_id && (
            <button
              onClick={() => openSpec(author.spec_id!, 'build')}
              className="h-6 px-2 rounded-md bg-elev text-ink-50 hover:opacity-80"
            >
              Open spec
            </button>
          )}
          <button
            onClick={() => openOverlay({ kind: 'run', runId: author.run_id })}
            className="h-6 px-2 rounded-md bg-elev text-ink-50 hover:opacity-80"
          >
            View run
          </button>
        </div>
      )}

      {revertError && (
        <div className="px-4 py-1.5 border-b border-ink-800/60 text-[12px] text-danger-text shrink-0">
          {revertError}
        </div>
      )}

      {loose.length > 0 && (
        <div className="border-b border-ink-800/60 shrink-0 max-h-[30%] overflow-y-auto">
          {loose.map((f) => (
            <Finding key={f.id} finding={f} />
          ))}
        </div>
      )}

      {layout === 'split' && diff?.ok && blocks.length > 0 && (
        <div className="grid grid-cols-2 border-b border-ink-800/60 text-[11.5px] text-faint shrink-0">
          <div className="px-4 py-1 border-r border-ink-800/60">HEAD</div>
          <div className="px-4 py-1">Working tree</div>
        </div>
      )}

      <div ref={scroller} className="flex-1 overflow-auto">
        {body()}
      </div>
    </div>
  );
}

/**
 * One code-review finding, in the "waits on you" colour. It comes from the last
 * review of the branch (`review.md`), which may predate the code beside it.
 */
function Finding({ finding }: { finding: ReviewFinding }) {
  const sev = SEVERITY_META[finding.severity];
  const setPendingPrompt = useChat((s) => s.setPendingPrompt);
  const setAssistantOpen = useUi((s) => s.setAssistantOpen);
  // Hands the finding to the Assistant, which opens beside the diff — so the
  // fix is watched landing in the very lines it is about.
  const fix = () => {
    setPendingPrompt(fixFindingPrompt(finding));
    setAssistantOpen(true);
  };
  return (
    <div className="flex items-start gap-2.5 px-4 py-2 bg-agent-tint/60 border-y border-agent/25 font-sans text-[12.5px] leading-snug whitespace-normal">
      <MessageSquareWarning size={14} className="text-agent-text mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('px-1.5 py-px rounded text-[10.5px] font-semibold', sev.cls)}>{sev.label}</span>
          <span className="font-semibold text-ink-50">{finding.title}</span>
          {finding.line && <span className="font-mono text-[11px] text-faint">line {finding.line}</span>}
          <span className="text-[11px] text-faint">from the last code review</span>
        </div>
        <p className="mt-0.5 text-ink-200">{finding.detail}</p>
        {finding.suggestion && <p className="mt-0.5 text-dim">Suggestion: {finding.suggestion}</p>}
      </div>
      <button
        onClick={fix}
        title="Send this finding to the Assistant to fix"
        className="shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-agent text-agent-fg text-[12px] font-semibold hover:opacity-90"
      >
        <Wand2 size={12} /> Fix with Claude
      </button>
    </div>
  );
}

function SplitRow({ pair, span }: { pair: Pair; span?: ReturnType<typeof wordSpan> }) {
  const { left, right } = pair;
  const changed = left?.kind === 'del' || right?.kind === 'add';
  return (
    <div className="grid grid-cols-2">
      <div
        className={cn(
          'diff-row border-r border-ink-800/60',
          left?.kind === 'del' ? 'diff-del' : !left && changed && 'diff-empty'
        )}
      >
        <span className="diff-num">{left?.old ?? ''}</span>
        <span className="diff-code">
          {left && (
            <Code
              text={left.text}
              cls="diff-del-word"
              mark={left.kind === 'del' && span ? [span.start, span.endA] : undefined}
            />
          )}
        </span>
      </div>
      <div className={cn('diff-row', right?.kind === 'add' ? 'diff-add' : !right && changed && 'diff-empty')}>
        <span className="diff-num">{right?.new ?? ''}</span>
        <span className="diff-code">
          {right && (
            <Code
              text={right.text}
              cls="diff-add-word"
              mark={right.kind === 'add' && span ? [span.start, span.endB] : undefined}
            />
          )}
        </span>
      </div>
    </div>
  );
}

function UnifiedRow({ line, mark }: { line: Line; mark?: [number, number] }) {
  return (
    <div className={cn('diff-row', line.kind === 'add' && 'diff-add', line.kind === 'del' && 'diff-del')}>
      <span className="diff-num">{line.old ?? ''}</span>
      <span className="diff-num">{line.new ?? ''}</span>
      <span className="diff-code">
        <span className="select-none text-faint">
          {line.kind === 'add' ? '+ ' : line.kind === 'del' ? '− ' : '  '}
        </span>
        <Code text={line.text} mark={mark} cls={line.kind === 'add' ? 'diff-add-word' : 'diff-del-word'} />
      </span>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'w-7 h-7 grid place-items-center rounded-lg transition',
        active ? 'bg-accent/15 text-accent' : 'bg-elev text-dim hover:text-ink-50'
      )}
    >
      {children}
    </button>
  );
}

function Note({ children, tone }: { children: React.ReactNode; tone?: 'bad' }) {
  return (
    <div className={cn('px-6 py-5 font-sans text-[13px]', tone === 'bad' ? 'text-danger-text' : 'text-faint')}>
      {children}
    </div>
  );
}
