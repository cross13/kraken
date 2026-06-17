import { ChevronRight, ChevronDown, File, Folder, FolderOpen, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';
import type { DirEntry } from '../../../electron/shared/types';

export function ExplorerView() {
  const root = useWorkspace((s) => s.root);
  const tree = useWorkspace((s) => s.tree);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);

  return (
    <>
      <SidebarHeader
        title="Explorer"
        actions={
          <SidebarButton onClick={refreshAll} title="Refresh">
            <RefreshCw size={13} />
          </SidebarButton>
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
          <div className="px-1">
            {tree.map((entry) => (
              <TreeNode key={entry.path} entry={entry} depth={0} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function TreeNode({ entry, depth }: { entry: DirEntry; depth: number }) {
  const [open, setOpen] = useState(depth < 1 && entry.name === '.kraken');
  const openTab = useUi((s) => s.openTab);

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
          <span className="truncate">{entry.name}</span>
        </button>
        {open && entry.children?.map((c) => <TreeNode key={c.path} entry={c} depth={depth + 1} />)}
      </div>
    );
  }
  return (
    <button
      onClick={() =>
        openTab({
          id: `file:${entry.path}`,
          title: entry.name,
          kind: 'file',
          filePath: entry.path,
        })
      }
      className="w-full flex items-center gap-1 text-xs text-ink-300 hover:bg-ink-800/60 rounded-md px-1.5 py-1"
      style={{ paddingLeft: 18 + depth * 12 }}
    >
      <File size={13} className="text-ink-400" />
      <span className="truncate">{entry.name}</span>
    </button>
  );
}
