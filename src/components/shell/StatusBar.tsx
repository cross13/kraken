import { GitBranch, PanelBottom } from 'lucide-react';
import { useUi } from '../../stores/ui';
import { useGit } from '../../stores/git';
import { useOrchestrator } from '../../stores/orchestrator';
import { useWorkspace } from '../../stores/workspace';
import { cn } from '../../lib/cn';

/**
 * The bottom edge: where you are in git, how much is uncommitted, what is
 * running, and what the editor area is showing. Every item is also the way to
 * the thing it names — the branch opens Changes, the run count opens the panel.
 */
export function StatusBar() {
  const branch = useGit((s) => s.branch);
  const changed = useGit((s) => s.files.length);
  const showSide = useUi((s) => s.showSide);
  const sideOpen = useUi((s) => s.sideOpen);
  const sideView = useUi((s) => s.sideView);
  const panelOpen = useUi((s) => s.panelOpen);
  const togglePanel = useUi((s) => s.togglePanel);
  const tabs = useUi((s) => s.tabs);
  const activeTabId = useUi((s) => s.activeTabId);
  const surface = useUi((s) => s.surface);
  const root = useWorkspace((s) => s.root);
  const running = useOrchestrator(
    (s) =>
      Object.values(s.runs).filter((r) => r.status === 'running' || r.status === 'queued').length
  );

  const tab = tabs.find((t) => t.id === activeTabId);
  const where = tab
    ? tab.kind === 'diff'
      ? `${tab.path} ↔ HEAD`
      : root && tab.path.startsWith(`${root}/`)
        ? tab.path.slice(root.length + 1)
        : tab.path
    : surface;

  // Don't close Changes when it is already the view on screen.
  const openChanges = () => {
    if (!(sideOpen && sideView === 'changes')) showSide('changes');
  };

  return (
    <footer className="k-chrome flex items-center gap-4 h-7 px-3.5 shrink-0 text-[11.5px] text-faint">
      {branch && (
        <button
          onClick={openChanges}
          title="Open Changes"
          className="flex items-center gap-1.5 font-mono hover:text-ink-50 max-w-[240px]"
        >
          <GitBranch size={12} className="shrink-0" />
          <span className="truncate">{branch}</span>
        </button>
      )}
      {branch && (
        <button onClick={openChanges} className="hover:text-ink-50 tabular-nums">
          {changed === 0 ? 'No uncommitted changes' : `${changed} uncommitted ${changed === 1 ? 'change' : 'changes'}`}
        </button>
      )}
      <span className="flex-1" />
      <span className="font-mono truncate max-w-[40vw]" title={tab?.path}>
        {where}
      </span>
      <button
        onClick={togglePanel}
        title="Toggle the runs panel (⌘⇧J)"
        aria-pressed={panelOpen}
        className={cn('flex items-center gap-1.5 hover:text-ink-50', (panelOpen || running > 0) && 'text-ink-50')}
      >
        {running > 0 ? (
          <span className="w-[7px] h-[7px] rounded-full bg-accent animate-pulse-dot" />
        ) : (
          <PanelBottom size={12} />
        )}
        <span className="tabular-nums">{running > 0 ? `${running} running` : 'Runs'}</span>
      </button>
    </footer>
  );
}
