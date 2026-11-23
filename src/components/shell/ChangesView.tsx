import { useEffect, useMemo, useState } from 'react';
import { GitPullRequest, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi, tabId } from '../../stores/ui';
import { useGit, statusLetter, type ChangedFile } from '../../stores/git';
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';
import { cn } from '../../lib/cn';
import { parseTasks } from '../../lib/tasks';
import { groupByFolder, groupByTask, type TaskTitles } from '../../lib/changeGroups';

type Grouping = 'task' | 'folder';

/**
 * The Changes side view — what differs from HEAD, one row per file. **By task**
 * (the default) groups the files under the run that last wrote them — `T3` of a
 * spec, a plan draft, the Assistant — with whatever no run wrote under *Edited
 * by hand*; **By folder** is the plain tree order. Clicking a row opens that file's diff as an editor tab; the checkbox
 * is the index (checked = staged), so the commit below takes exactly what is
 * ticked. With nothing ticked it commits everything, which is what "I just want
 * to save this" means. Branches, sync and pull requests stay in the repository
 * panel — this view answers one question: *what changed?*
 */
export function ChangesView() {
  const root = useWorkspace((s) => s.root);
  const isRepo = useGit((s) => s.isRepo);
  const branch = useGit((s) => s.branch);
  const files = useGit((s) => s.files);
  const refresh = useGit((s) => s.refresh);
  const openDiff = useUi((s) => s.openDiff);
  const openOverlay = useUi((s) => s.openOverlay);
  const activeTabId = useUi((s) => s.activeTabId);

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const authors = useGit((s) => s.authors);
  const specs = useWorkspace((s) => s.specs);
  const [grouping, setGroupingState] = useState<Grouping>(() => {
    try {
      return localStorage.getItem('octo.changesGrouping') === 'folder' ? 'folder' : 'task';
    } catch {
      return 'task';
    }
  });
  const setGrouping = (g: Grouping) => {
    setGroupingState(g);
    try {
      localStorage.setItem('octo.changesGrouping', g);
    } catch {
      // ignore (e.g. storage disabled)
    }
  };

  // A task group is titled with the task's own sentence, read from tasks.md of
  // each spec that has a task run among the authors.
  const taskSpecs = useMemo(
    () =>
      [...new Set(Object.values(authors).filter((a) => a.task_id && a.spec_id).map((a) => a.spec_id!))]
        .sort()
        .join('\n'),
    [authors]
  );
  const [titles, setTitles] = useState<TaskTitles>({});
  useEffect(() => {
    if (!root || !taskSpecs) return;
    let cancelled = false;
    void Promise.all(
      taskSpecs.split('\n').map(async (id) => {
        try {
          const spec = await window.octo.specs.read(root, id);
          const doc = parseTasks(spec.files['tasks'] ?? '');
          return [id, Object.fromEntries(doc.tasks.map((t) => [t.id, t.description]))] as const;
        } catch {
          return [id, {}] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) setTitles(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [root, taskSpecs]);

  const groups = useMemo(
    () => (grouping === 'task' ? groupByTask(files, authors, specs, titles) : groupByFolder(files)),
    [grouping, files, authors, specs, titles]
  );

  const staged = files.filter((f) => f.staged).length;

  const toggle = async (f: ChangedFile) => {
    if (!root) return;
    const args = { workspacePath: root, paths: [f.path] };
    await (f.staged ? window.octo.git.unstage(args) : window.octo.git.stage(args));
    await refresh();
  };

  const commit = async () => {
    if (!root || !message.trim() || busy) return;
    setBusy(true);
    setNote(null);
    const res = await window.octo.git.commitPush({
      workspacePath: root,
      message: message.trim(),
      push: false,
      // Something ticked → commit the index as it stands. Nothing → everything.
      stageAll: staged === 0,
    });
    setBusy(false);
    if (res.ok) {
      setMessage('');
      setNote({ ok: true, text: `Committed ${res.commitHash ?? ''}`.trim() });
    } else {
      setNote({ ok: false, text: res.error ?? 'Commit failed.' });
    }
    await refresh();
  };

  return (
    <>
      <SidebarHeader
        title="Changes"
        actions={
          <>
            <SidebarButton
              onClick={() => openOverlay({ kind: 'repo' })}
              title="Repository — branches, sync and pull requests"
            >
              <GitPullRequest size={13} />
            </SidebarButton>
            <SidebarButton onClick={() => void refresh()} title="Refresh">
              <RefreshCw size={13} />
            </SidebarButton>
          </>
        }
      />

      {!root ? (
        <SidebarEmpty title="No workspace" description="Open a folder to begin." />
      ) : !isRepo ? (
        <SidebarEmpty
          title="Not a git repository"
          description="Changes are read from git. Initialise one from the repository panel."
          action={
            <button
              onClick={() => openOverlay({ kind: 'repo' })}
              className="text-xs px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90"
            >
              Open repository panel
            </button>
          }
        />
      ) : (
        <>
          <div className="p-2.5 border-b border-ink-50/[0.06]">
            <div className="rounded-lg ring-1 ring-ink-700 bg-ink-950 p-2.5 flex flex-col gap-2">
              <label htmlFor="commit-msg" className="text-[11.5px] font-medium text-faint">
                Commit message{branch ? ` · ${branch}` : ''}
              </label>
              <textarea
                id="commit-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void commit();
                }}
                rows={2}
                placeholder="What does this change do?"
                className="w-full resize-none bg-transparent text-[12.5px] text-ink-50 placeholder:text-ink-600 outline-none"
              />
              <button
                onClick={() => void commit()}
                disabled={!message.trim() || busy || files.length === 0}
                title="Commit locally (⌘⏎). Push from the repository panel."
                className="self-start text-[12px] font-semibold px-3 h-7 rounded-md bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? 'Committing…' : staged > 0 ? `Commit ${staged} staged` : 'Commit all'}
              </button>
              {note && (
                <p className={cn('text-[11.5px]', note.ok ? 'text-faint' : 'text-danger-text')}>
                  {note.text}
                </p>
              )}
            </div>
          </div>

          <div role="group" aria-label="Group changes" className="flex mx-2.5 mt-2 p-0.5 rounded-lg bg-elev">
            {(['task', 'folder'] as Grouping[]).map((g) => (
              <button
                key={g}
                aria-pressed={grouping === g}
                onClick={() => setGrouping(g)}
                className={cn(
                  'flex-1 h-6 rounded-md text-[12px] transition',
                  grouping === g
                    ? 'bg-ink-950 text-ink-50 font-semibold ring-1 ring-ink-700'
                    : 'text-dim hover:text-ink-50'
                )}
              >
                {g === 'task' ? 'By task' : 'By folder'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto py-1.5">
            {files.length === 0 ? (
              <SidebarEmpty
                title="Nothing changed"
                description="The working tree matches the last commit."
              />
            ) : (
              groups.map((g) => (
                <section key={g.key || 'hand'} className="px-1.5 pb-1.5">
                  {grouping === 'folder' ? (
                    <div className="px-2 py-1 font-mono text-[11px] text-faint truncate" title={g.title}>
                      {g.title}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 px-2 pt-1.5 pb-1">
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            'flex items-baseline gap-1.5 text-[12px] font-semibold',
                            g.key ? 'text-ink-50' : 'text-faint'
                          )}
                        >
                          {g.id && <span className="font-mono shrink-0">{g.id}</span>}
                          <span className="truncate" title={g.title}>
                            {g.title}
                          </span>
                        </div>
                        {g.agent && (
                          <div className="font-mono text-[11px] text-faint truncate">@{g.agent}</div>
                        )}
                      </div>
                      {g.runId && (
                        <button
                          onClick={() => openOverlay({ kind: 'run', runId: g.runId! })}
                          title="Open the run that last wrote these files"
                          className="shrink-0 text-[11px] text-faint hover:text-ink-50"
                        >
                          Run
                        </button>
                      )}
                    </div>
                  )}
                  {g.files.map((f) => {
                    // By task the folder is no longer the heading, so the row
                    // carries the whole path.
                    const name =
                      grouping === 'task' ? f.path : f.path.slice(f.path.lastIndexOf('/') + 1);
                    const active = activeTabId === tabId('diff', f.path);
                    return (
                      <div
                        key={f.path}
                        className={cn(
                          'flex items-center gap-2 rounded-md pl-2 pr-1.5',
                          active ? 'bg-ink-50/[0.07]' : 'hover:bg-ink-50/[0.04]'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={f.staged && !f.unstaged}
                          ref={(el) => {
                            // Partly staged: some of the file is in the index.
                            if (el) el.indeterminate = f.staged && f.unstaged;
                          }}
                          onChange={() => void toggle(f)}
                          aria-label={`Stage ${f.path}`}
                          title={f.staged ? 'Staged — untick to unstage' : 'Tick to stage'}
                          className="shrink-0"
                        />
                        <button
                          onClick={() => openDiff(f.path)}
                          title={`${f.path} — open the diff against HEAD`}
                          className="flex-1 min-w-0 flex items-center gap-2 py-1.5 text-left"
                        >
                          <span
                            className={cn(
                              'flex-1 truncate font-mono text-[12px]',
                              active ? 'text-ink-50 font-medium' : 'text-ink-200',
                              statusLetter(f) === 'D' && 'line-through'
                            )}
                          >
                            {name}
                          </span>
                          {(f.added !== undefined || f.deleted !== undefined) && (
                            <span className="font-mono text-[11px] tabular-nums shrink-0">
                              {!!f.added && <span style={{ color: 'var(--diff-add-text)' }}>+{f.added}</span>}
                              {!!f.added && !!f.deleted && ' '}
                              {!!f.deleted && <span style={{ color: 'var(--diff-del-text)' }}>−{f.deleted}</span>}
                            </span>
                          )}
                          <StatusMark file={f} />
                        </button>
                      </div>
                    );
                  })}
                </section>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}

const LETTER_TITLE = { A: 'Added', M: 'Modified', D: 'Deleted' } as const;

/** The git status letter — green for new, red for deleted, ink for modified. */
export function StatusMark({ file }: { file: ChangedFile }) {
  const l = statusLetter(file);
  return (
    <span
      title={LETTER_TITLE[l]}
      className="w-3 text-center font-mono text-[11.5px] font-semibold shrink-0 text-ink-50"
      style={
        l === 'A'
          ? { color: 'var(--diff-add-text)' }
          : l === 'D'
            ? { color: 'var(--diff-del-text)' }
            : undefined
      }
    >
      {l}
    </span>
  );
}
