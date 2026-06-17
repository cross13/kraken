import { useEffect, useState } from 'react';
import { PanelLeft, MessageSquare, FolderOpen, GitBranch } from 'lucide-react';
import { useUi } from '../stores/ui';
import { useWorkspace } from '../stores/workspace';
import { cn } from '../lib/cn';
import { KrakenLogo } from './KrakenLogo';

export function TitleBar() {
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const toggleChat = useUi((s) => s.toggleChat);
  const setActivity = useUi((s) => s.setActivity);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const chatOpen = useUi((s) => s.chatOpen);
  const root = useWorkspace((s) => s.root);
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    if (!root) {
      setBranch(null);
      return;
    }
    const read = () =>
      window.kraken.git
        .status(root)
        .then((s) => setBranch(s.isRepo ? s.branch : null))
        .catch(() => setBranch(null));
    read();
    const t = setInterval(read, 5000);
    return () => clearInterval(t);
  }, [root]);

  const workspaceName = root ? root.split('/').filter(Boolean).pop() : 'No workspace';

  return (
    <header className="titlebar-drag flex items-center justify-between h-11 px-4 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
      <div className="flex items-center gap-3 pl-16">
        <div className="flex items-center gap-2">
          <KrakenLogo className="w-6 h-6 text-accent" glow />
          <span className="text-sm font-semibold tracking-tight">Kraken</span>
          <span className="text-ink-500 text-xs">·</span>
          <span className="text-ink-300 text-xs">SDD workbench</span>
        </div>
      </div>

      <div className="titlebar-nodrag flex items-center gap-1">
        <button
          onClick={pickWorkspace}
          title={root ? `${root}\nClick to change project directory` : 'Open a project'}
          className="flex items-center gap-1.5 text-xs text-ink-300 hover:text-ink-100 px-2 py-1 rounded-md hover:bg-ink-800/60 transition"
        >
          <FolderOpen size={14} />
          <span className="max-w-[200px] truncate">{workspaceName}</span>
        </button>
        {branch && (
          <button
            onClick={() => setActivity('source-control')}
            title="Branch — click to open Source Control"
            className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-100 px-2 py-1 rounded-md hover:bg-ink-800/60 transition max-w-[180px]"
          >
            <GitBranch size={13} className="shrink-0" />
            <span className="font-mono truncate">{branch}</span>
          </button>
        )}
      </div>

      <div className="titlebar-nodrag flex items-center gap-1">
        <IconButton active={sidebarOpen} onClick={toggleSidebar} title="Toggle sidebar">
          <PanelLeft size={15} />
        </IconButton>
        <IconButton active={chatOpen} onClick={toggleChat} title="Toggle chat">
          <MessageSquare size={15} />
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded-md transition',
        active ? 'text-ink-50 bg-ink-800/80' : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800/60'
      )}
    >
      {children}
    </button>
  );
}

