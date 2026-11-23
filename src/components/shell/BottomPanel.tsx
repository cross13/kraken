import { History, Network, SquareTerminal, X } from 'lucide-react';
import { useUi, type PanelTab } from '../../stores/ui';
import { useOrchestrator } from '../../stores/orchestrator';
import { OrchestratorView } from '../sidebar/OrchestratorView';
import { HistoryView } from '../sidebar/HistoryView';
import { TerminalsPane } from '../views/TerminalsPane';
import { ResizeHandle } from '../ResizeHandle';
import { cn } from '../../lib/cn';

const TABS: { tab: PanelTab; label: string; icon: React.ReactNode }[] = [
  { tab: 'runs', label: 'Runs', icon: <Network size={12} /> },
  { tab: 'terminals', label: 'Terminal', icon: <SquareTerminal size={12} /> },
  { tab: 'history', label: 'History', icon: <History size={12} /> },
];

/**
 * The panel under the editor area (⌘⇧J): **Runs**, **Terminal** and **History**
 * on screen beside the file a task is editing, so watching a run or answering
 * Claude no longer means leaving what you were reading.
 *
 * Its upper edge is a drag handle (`panelHeight`, persisted, capped at 70% of
 * the window).
 *
 * It is **always mounted** and hidden with `display` while closed: the
 * terminals' PTYs live in `TerminalsPane`, and unmounting it would kill every
 * shell and Claude session. Runs and History mount only while shown — History
 * queries the DB on mount.
 */
export function BottomPanel() {
  const open = useUi((s) => s.panelOpen);
  const tab = useUi((s) => s.panelTab);
  const openPanel = useUi((s) => s.openPanel);
  const toggle = useUi((s) => s.togglePanel);
  const terminals = useUi((s) => s.terminals.length);
  const height = useUi((s) => s.panelHeight);
  const setHeight = useUi((s) => s.setPanelHeight);
  const running = useOrchestrator(
    (s) =>
      Object.values(s.runs).filter((r) => r.status === 'running' || r.status === 'queued').length
  );

  return (
    <>
    {/* Drag the panel's upper edge to resize it; the height is remembered, and
        capped again at render because the window may have shrunk since. */}
    {open && <ResizeHandle width={height} side="top" onResize={setHeight} className="-my-0.5 rounded-full" />}
    <section
      aria-label="Panel"
      className="shrink-0 flex-col rounded-xl ring-1 ring-ink-50/[0.07] bg-ink-950 overflow-hidden"
      style={{ display: open ? 'flex' : 'none', height: `min(${height}px, 70vh)` }}
    >
      <div role="tablist" className="flex items-center gap-1 h-9 px-2.5 shrink-0 border-b border-ink-50/[0.06]">
        {TABS.map((t) => {
          const count = t.tab === 'runs' ? running : t.tab === 'terminals' ? terminals : 0;
          return (
            <button
              key={t.tab}
              role="tab"
              aria-selected={tab === t.tab}
              onClick={() => openPanel(t.tab)}
              className={cn(
                'flex items-center gap-1.5 px-2 h-6 rounded-md text-[12px] transition',
                tab === t.tab ? 'bg-ink-50/[0.07] text-ink-50 font-semibold' : 'text-faint hover:text-ink-50'
              )}
            >
              {t.icon}
              {t.label}
              {count > 0 && <span className="tabular-nums font-normal">· {count}</span>}
            </button>
          );
        })}
        <span className="flex-1" />
        <button
          onClick={toggle}
          title="Close the panel (⌘⇧J)"
          aria-label="Close the panel"
          className="w-6 h-6 grid place-items-center rounded-md text-faint hover:text-ink-50 hover:bg-elev"
        >
          <X size={13} />
        </button>
      </div>
      <div className="flex-1 min-h-0 relative">
        {open && tab === 'runs' && (
          <div className="absolute inset-0 overflow-auto">
            <OrchestratorView />
          </div>
        )}
        {/* Kept mounted whatever the tab — and whether or not the panel is open. */}
        <div className="absolute inset-0" style={{ display: tab === 'terminals' ? 'block' : 'none' }}>
          <TerminalsPane />
        </div>
        {open && tab === 'history' && (
          <div className="absolute inset-0 overflow-auto">
            <HistoryView />
          </div>
        )}
      </div>
    </section>
    </>
  );
}
