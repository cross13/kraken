import { ChevronRight, ChevronDown, File, Folder, FolderOpen, RefreshCw, Palette } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWorkspace } from '../../stores/workspace';
import { useUi, stageForPhase, tabId } from '../../stores/ui';
import { useGit, statusLetter } from '../../stores/git';
import { cn } from '../../lib/cn';
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';
import { MarkdownOutline } from '../shell/MarkdownOutline';
import type { DirEntry } from '../../../electron/shared/types';

export function ExplorerView() {
  const root = useWorkspace((s) => s.root);
  const tree = useWorkspace((s) => s.tree);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);
  const openLibrary = useUi((s) => s.openLibrary);
  const specs = useWorkspace((s) => s.specs);
  const openSpec = useUi((s) => s.openSpec);
  const showSide = useUi((s) => s.showSide);
  const activeSpecId = useUi((s) => s.activeSpecId);
  const onSpec = useUi((s) => s.activeTabId === null && s.surface === 'spec');
  const [specsOpen, setSpecsOpen] = useState(true);
  const open = specs.filter((s) => s.phase !== 'done');

  return (
    <>
      <SidebarHeader
        title="Explorer"
        actions={
          <>
            <SidebarButton
              onClick={() => openLibrary('appearance')}
              title="Appearance — syntax themes & languages"
            >
              <Palette size={13} />
            </SidebarButton>
            <SidebarButton onClick={refreshAll} title="Refresh">
              <RefreshCw size={13} />
            </SidebarButton>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto py-1">
        {!root ? (
          <SidebarEmpty
            title="No workspace"
            description="Open a folder to begin."
            action={
              <button
                onClick={pickWorkspace}
                className="text-xs px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90"
              >
                Open folder
              </button>
            }
          />
        ) : (
          <>
            {/* Specs in flight, above the tree: the work, then the files. */}
            {open.length > 0 && (
              <div className="px-1 pb-1.5 mb-1.5 border-b border-ink-50/[0.06]">
                <div className="flex items-center">
                  <button
                    onClick={() => setSpecsOpen((o) => !o)}
                    className="flex-1 flex items-center gap-1 text-xs font-semibold text-ink-50 rounded-md px-1.5 py-1 hover:bg-ink-800/60"
                  >
                    {specsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Specs
                  </button>
                  <button
                    onClick={() => showSide('specs')}
                    className="text-[11px] text-faint hover:text-ink-50 px-1.5"
                  >
                    All
                  </button>
                </div>
                {specsOpen &&
                  open.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => openSpec(s.id, stageForPhase(s.phase))}
                      title={s.id}
                      className={cn(
                        'w-full flex items-center gap-2 text-xs rounded-md pl-[22px] pr-1.5 py-1',
                        onSpec && activeSpecId === s.id
                          ? 'bg-ink-50/[0.07] text-ink-50 font-medium'
                          : 'text-ink-200 hover:bg-ink-800/60'
                      )}
                    >
                      <span className="flex-1 truncate text-left">{s.name || s.id}</span>
                      <span className="text-[10.5px] text-faint capitalize shrink-0">{s.phase}</span>
                    </button>
                  ))}
              </div>
            )}
            <div className="px-1">
              {tree.map((entry) => (
                <TreeNode key={entry.path} entry={entry} depth={0} />
              ))}
            </div>
          </>
        )}
      </div>
      <MarkdownOutline />
    </>
  );
}

function TreeNode({ entry, depth }: { entry: DirEntry; depth: number }) {
  const [open, setOpen] = useState(depth < 1 && entry.name === '.octo');
  const openFile = useUi((s) => s.openFile);
  const active = useUi((s) => s.activeTabId === tabId('file', entry.path));
  const root = useWorkspace((s) => s.root);
  const changed = useGit((s) => s.files);
  const rel = root && entry.path.startsWith(`${root}/`) ? entry.path.slice(root.length + 1) : null;
  // A folder is marked when anything under it changed; a file with its letter.
  const mark = useMemo(() => {
    if (!rel) return null;
    if (entry.type === 'dir') return changed.some((f) => f.path.startsWith(`${rel}/`)) ? 'dir' : null;
    const f = changed.find((c) => c.path === rel);
    return f ? statusLetter(f) : null;
  }, [changed, rel, entry.type]);

  if (entry.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-1 text-xs text-ink-200 hover:bg-ink-800/60 rounded-md px-1.5 py-1"
          style={{ paddingLeft: 6 + depth * 12 }}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {open ? <FolderOpen size={13} className="text-accent" /> : <Folder size={13} className="text-ink-300" />}
          <span className="flex-1 truncate text-left">{entry.name}</span>
          {mark && <span title="Contains changes" className="w-1.5 h-1.5 rounded-full bg-ink-400 shrink-0" />}
        </button>
        {open && entry.children?.map((c) => <TreeNode key={c.path} entry={c} depth={depth + 1} />)}
      </div>
    );
  }
  return (
    <button
      onClick={() => openFile(entry.path)}
      className={cn(
        'w-full flex items-center gap-1 text-xs rounded-md px-1.5 py-1',
        active ? 'bg-ink-50/[0.07] text-ink-50 font-medium' : 'text-ink-300 hover:bg-ink-800/60',
        mark && !active && 'text-ink-50'
      )}
      style={{ paddingLeft: 18 + depth * 12 }}
    >
      <File size={13} className="text-ink-400 shrink-0" />
      <span className="flex-1 truncate text-left">{entry.name}</span>
      {mark && (
        <span
          title={mark === 'A' ? 'Added' : mark === 'D' ? 'Deleted' : 'Modified'}
          className="font-mono text-[11px] font-semibold shrink-0"
          style={mark === 'A' ? { color: 'var(--diff-add-text)' } : undefined}
        >
          {mark}
        </span>
      )}
    </button>
  );
}
