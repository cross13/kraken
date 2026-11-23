import {
  Network,
  History,
  Workflow,
  BarChart3,
  FileSearch,
} from 'lucide-react';
import { useUi, type ActivityTab } from '../../stores/ui';
import { OrchestratorView } from '../sidebar/OrchestratorView';
import { HistoryView } from '../sidebar/HistoryView';
import { AgentGraphView } from './AgentGraphView';
import { SpecsStudio } from './SpecsStudio';
import { PrReviewStudio } from '../review/PrReviewStudio';
import { cn } from '../../lib/cn';

const TABS: { tab: ActivityTab; label: string; icon: React.ReactNode }[] = [
  { tab: 'runs', label: 'Runs', icon: <Network size={13} /> },
  { tab: 'history', label: 'History', icon: <History size={13} /> },
  { tab: 'specs', label: 'Specs', icon: <BarChart3 size={13} /> },
  { tab: 'reviews', label: 'Reviews', icon: <FileSearch size={13} /> },
  { tab: 'graph', label: 'Graph', icon: <Workflow size={13} /> },
];

/**
 * Activity — the single command center for "what's running": live runs with
 * cancel + the one concurrency control, run history, **Specs** (per-spec run
 * analytics), **Reviews** (code review of open pull requests) and the agent graph. Terminals live
 * in the panel under the editor area (`shell/BottomPanel`), beside the code they act on.
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
        {/* Kept mounted so a review in flight survives switching tabs. */}
        <div
          className="absolute inset-0"
          style={{ display: tab === 'reviews' ? 'block' : 'none' }}
        >
          <PrReviewStudio />
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
