import { Workflow, ExternalLink, AlertTriangle } from 'lucide-react';
import { SidebarHeader, SidebarEmpty } from '../SidebarShell';
import { useUi } from '../../stores/ui';
import { useOrchestrator } from '../../stores/orchestrator';
import { useWorkspace } from '../../stores/workspace';
import { STATUS_COLOR } from '../../lib/graphModel';

const GRAPH_TAB_ID = 'agent-graph';

const LEGEND: { label: string; color: string }[] = [
  { label: 'Running', color: STATUS_COLOR.running },
  { label: 'Queued', color: STATUS_COLOR.queued },
  { label: 'Done', color: STATUS_COLOR.done },
  { label: 'Error', color: STATUS_COLOR.error },
  { label: 'Cancelled', color: STATUS_COLOR.cancelled },
  { label: 'Pending', color: STATUS_COLOR.pending },
];

export function GraphView() {
  const openTab = useUi((s) => s.openTab);
  const specs = useWorkspace((s) => s.specs);
  const runs = useOrchestrator((s) => s.runs);

  const active = Object.values(runs).filter(
    (r) => r.status === 'running' || r.status === 'queued'
  );
  const genericRunning = active.filter((r) => !r.agent || r.routeReason === 'generic').length;

  const openGraph = () =>
    openTab({ id: GRAPH_TAB_ID, title: 'Agent Graph', kind: 'graph' });

  return (
    <>
      <SidebarHeader title="Agent Graph" />
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3 border-b border-ink-800/60 space-y-3">
          <p className="text-[11px] text-ink-400 leading-snug">
            An interactive flow chart of every agent run — waves, task dependencies, the agent and
            skill the orchestrator assigned, and the model actually used. Click a node to verify and
            audit a run.
          </p>
          <button
            onClick={openGraph}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-md bg-accent/15 text-accent hover:bg-accent/25"
          >
            <Workflow size={14} /> Open interactive graph
            <ExternalLink size={12} />
          </button>
        </div>

        {/* Live summary */}
        <section className="px-3 py-3 border-b border-ink-800/60">
          <h3 className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-2">
            Live
          </h3>
          <div className="text-[11px] text-ink-300">
            {active.length === 0 ? 'No agents in flight.' : `${active.length} agent(s) running.`}
          </div>
          {genericRunning > 0 && (
            <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-300">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>
                {genericRunning} running with no matched agent — open the graph to see which.
              </span>
            </div>
          )}
        </section>

        {/* Legend */}
        <section className="px-3 py-3 border-b border-ink-800/60">
          <h3 className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-2">
            Legend
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {LEGEND.map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-ink-300">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: l.color }}
                />
                {l.label}
              </div>
            ))}
          </div>
        </section>

        {specs.length === 0 && (
          <div className="px-3 py-3">
            <SidebarEmpty
              title="No specs yet"
              description="Create a spec with a tasks.md to populate the graph."
            />
          </div>
        )}
      </div>
    </>
  );
}
