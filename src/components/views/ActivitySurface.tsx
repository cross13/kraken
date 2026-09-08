import {
  Plus,
  Sparkles,
  SquareTerminal,
  X,
  Network,
  History,
  Workflow,
  BarChart3,
} from 'lucide-react';
import { useUi, type ActivityTab } from '../../stores/ui';
import { OrchestratorView } from '../sidebar/OrchestratorView';
import { HistoryView } from '../sidebar/HistoryView';
import { AgentGraphView } from './AgentGraphView';
import { SpecsStudio } from './SpecsStudio';
import { TerminalView } from './TerminalView';
import { cn } from '../../lib/cn';

const TABS: { tab: ActivityTab; label: string; icon: React.ReactNode }[] = [
  { tab: 'runs', label: 'Runs', icon: <Network size={13} /> },
  { tab: 'history', label: 'History', icon: <History size={13} /> },
  { tab: 'specs', label: 'Specs', icon: <BarChart3 size={13} /> },
  { tab: 'terminals', label: 'Terminals', icon: <SquareTerminal size={13} /> },
  { tab: 'graph', label: 'Graph', icon: <Workflow size={13} /> },
];

/**
 * Activity — the single command center for "what's running": live runs with
 * cancel + the one concurrency control, run history, **Specs** (per-spec run
 * analytics), terminals (PTYs stay mounted app-wide), and the agent graph.
 * Everything else in the app shows only indicators that deep-link here.
 *
 * Specs lives here rather than on Home because it answers a question about
 * *runs* — where the effort went — and Home is the board you start work from.
 */
export function ActivitySurface() {
  const tab = useUi((s) => s.activityTab);
  const openActivity = useUi((s) => s.openActivity);

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <div className="flex items-center gap-1 px-4 h-[44px] shrink-0">
        {TABS.map((t) => (
          <button
            key={t.tab}
            onClick={() => openActivity(t.tab)}
            className={cn(
              'flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg transition',
              tab === t.tab
                ? 'bg-accent/12 text-accent font-semibold'
                : 'text-dim hover:text-ink-50 hover:bg-elev'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 relative">
        {/* Each tab owns its own scroller + `k-wide` container — the surface
            no longer pins them into a fixed centre column. */}
        <div
          className="absolute inset-0"
          style={{ display: tab === 'runs' ? 'block' : 'none' }}
        >
          <OrchestratorView />
        </div>
        <div
          className="absolute inset-0"
          style={{ display: tab === 'history' ? 'block' : 'none' }}
        >
          <HistoryView />
        </div>
        {/* Mounted only while open: it queries the history DB on mount, and
            Activity is a surface that stays mounted for the whole session. */}
        {tab === 'specs' && (
          <div className="absolute inset-0">
            <SpecsStudio />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ display: tab === 'terminals' ? 'block' : 'none' }}
        >
          <TerminalsPane />
        </div>
        {tab === 'graph' && (
          <div className="absolute inset-0">
            <AgentGraphView />
          </div>
        )}
      </div>
    </div>
  );
}

/** Terminal list + always-mounted panes (unmounting would kill the PTY). */
function TerminalsPane() {
  const terminals = useUi((s) => s.terminals);
  const activeTerminalId = useUi((s) => s.activeTerminalId);
  const setActiveTerminal = useUi((s) => s.setActiveTerminal);
  const closeTerminal = useUi((s) => s.closeTerminal);
  const addTerminal = useUi((s) => s.addTerminal);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 px-4 py-2 shrink-0 overflow-x-auto">
        {terminals.map((t) => (
          <div
            key={t.id}
            onClick={() => setActiveTerminal(t.id)}
            className={cn(
              'group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[12px] shrink-0 transition',
              t.id === activeTerminalId
                ? 'bg-elev text-ink-50'
                : 'text-ink-300 hover:bg-elev/60'
            )}
          >
            {t.profile === 'claude' ? (
              <Sparkles size={13} className="text-accent shrink-0" />
            ) : (
              <SquareTerminal size={13} className="shrink-0" />
            )}
            <span>{t.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(t.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-ink-100"
              title="Close terminal"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={() => addTerminal('shell')}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] text-dim hover:text-ink-50 hover:bg-elev transition shrink-0"
        >
          <Plus size={13} /> Terminal
        </button>
        <button
          onClick={() => addTerminal('claude')}
          title="Run the interactive Claude CLI — answer its questions, run slash commands"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] text-dim hover:text-accent hover:bg-elev transition shrink-0"
        >
          <Sparkles size={13} /> Claude session
        </button>
      </div>
      <div className="flex-1 min-h-0 relative">
        {terminals.length === 0 ? (
          <p className="px-6 py-6 text-xs text-ink-500 leading-relaxed max-w-md">
            No terminals open. Start a <b className="text-ink-300">Claude session</b> to run the
            interactive CLI — answer its questions, approve permissions, run slash commands —
            or a plain shell.
          </p>
        ) : (
          terminals.map((t) => (
            <div
              key={t.id}
              className="absolute inset-0"
              style={{ display: t.id === activeTerminalId ? 'block' : 'none' }}
            >
              <TerminalView tabId={t.id} profile={t.profile} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
