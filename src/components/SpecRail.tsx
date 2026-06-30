import { useMemo, useState } from 'react';
import {
  Folder,
  FileCode2,
  Sparkles,
  Bot,
  Compass,
  Zap,
  GitBranch,
  ListTodo,
  SquareTerminal,
  Network,
  Workflow,
  History,
  Settings,
  Plus,
  Bug,
} from 'lucide-react';
import { useUi, type ActivityTab } from '../stores/ui';
import { useWorkspace } from '../stores/workspace';
import { useOrchestrator } from '../stores/orchestrator';
import { cn } from '../lib/cn';
import { NewSpecDialog } from './dialogs/NewSpecDialog';
import type { SpecMeta, SpecPhase } from '../../electron/shared/types';

// Sidebar views re-homed into the rail body for non-spec destinations.
import { ExplorerView } from './sidebar/ExplorerView';
import { SkillsView } from './sidebar/SkillsView';
import { AgentsView } from './sidebar/AgentsView';
import { SteeringView } from './sidebar/SteeringView';
import { HooksView } from './sidebar/HooksView';
import { SourceControlView } from './sidebar/SourceControlView';
import { OrchestratorView } from './sidebar/OrchestratorView';
import { GraphView } from './sidebar/GraphView';
import { TasksView } from './sidebar/TasksView';
import { TerminalsView } from './sidebar/TerminalsView';
import { HistoryView } from './sidebar/HistoryView';
import { SettingsView } from './sidebar/SettingsView';

const PHASE_INDEX: Record<SpecPhase, number> = {
  requirements: 0,
  design: 1,
  tasks: 2,
  done: 3,
};

const NAV: { tab: ActivityTab; icon: React.ReactNode; label: string }[] = [
  { tab: 'specs', icon: <FileCode2 size={17} />, label: 'Specs' },
  { tab: 'explorer', icon: <Folder size={17} />, label: 'Explorer' },
  { tab: 'agents', icon: <Bot size={17} />, label: 'Agents' },
  { tab: 'skills', icon: <Sparkles size={17} />, label: 'Skills' },
  { tab: 'steering', icon: <Compass size={17} />, label: 'Steering' },
  { tab: 'hooks', icon: <Zap size={17} />, label: 'Hooks' },
  { tab: 'source-control', icon: <GitBranch size={17} />, label: 'Source Control' },
  { tab: 'tasks', icon: <ListTodo size={17} />, label: 'Running Tasks' },
  { tab: 'terminal', icon: <SquareTerminal size={17} />, label: 'Terminals' },
  { tab: 'orchestrator', icon: <Network size={17} />, label: 'Orchestrator' },
  { tab: 'graph', icon: <Workflow size={17} />, label: 'Agent Graph' },
  { tab: 'history', icon: <History size={17} />, label: 'History' },
  { tab: 'settings', icon: <Settings size={17} />, label: 'Settings' },
];

function ago(iso?: string) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

export function SpecRail() {
  const activity = useUi((s) => s.activity);
  const setActivity = useUi((s) => s.setActivity);
  const openTab = useUi((s) => s.openTab);

  const running = useOrchestrator(
    (s) =>
      Object.values(s.runs).filter((r) => r.status === 'running' || r.status === 'queued').length
  );
  const runningTasks = useOrchestrator(
    (s) =>
      Object.values(s.runs).filter(
        (r) => (r.kind === 'task' || r.kind === 'refine') && (r.status === 'running' || r.status === 'queued')
      ).length
  );
  const badgeFor = (tab: ActivityTab) =>
    tab === 'orchestrator' || tab === 'graph' ? running : tab === 'tasks' ? runningTasks : 0;

  const onSelect = (tab: ActivityTab) => {
    setActivity(tab);
    if (tab === 'graph') openTab({ id: 'agent-graph', title: 'Agent Graph', kind: 'graph' });
  };

  return (
    <div className="h-full flex bg-rail">
      {/* destination nav */}
      <nav className="w-[52px] shrink-0 flex flex-col items-center py-2 gap-0.5 overflow-y-auto">
        {NAV.map((it) => {
          const active = activity === it.tab;
          const count = badgeFor(it.tab);
          return (
            <button
              key={it.tab}
              onClick={() => onSelect(it.tab)}
              title={count > 0 ? `${it.label} — ${count} running` : it.label}
              className={cn(
                'relative w-9 h-9 grid place-items-center rounded-[10px] transition shrink-0',
                active ? 'text-accent bg-accent/12' : 'text-faint hover:text-ink-50 hover:bg-elev'
              )}
            >
              {active && (
                <span className="absolute left-[-2px] top-2 bottom-2 w-[2.5px] rounded-full bg-accent" />
              )}
              {it.icon}
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 grid place-items-center rounded-full bg-accent text-accent-fg text-[9px] font-bold leading-none ring-2 ring-rail">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* destination body */}
      <div className="flex-1 min-w-0 flex flex-col">
        {activity === 'specs' ? (
          <SpecRailBody />
        ) : (
          <div className="h-full flex flex-col min-h-0">
            {activity === 'explorer' && <ExplorerView />}
            {activity === 'skills' && <SkillsView />}
            {activity === 'agents' && <AgentsView />}
            {activity === 'steering' && <SteeringView />}
            {activity === 'hooks' && <HooksView />}
            {activity === 'source-control' && <SourceControlView />}
            {activity === 'orchestrator' && <OrchestratorView />}
            {activity === 'graph' && <GraphView />}
            {activity === 'tasks' && <TasksView />}
            {activity === 'terminal' && <TerminalsView />}
            {activity === 'history' && <HistoryView />}
            {activity === 'settings' && <SettingsView />}
          </div>
        )}
      </div>
    </div>
  );
}

function SpecRailBody() {
  const root = useWorkspace((s) => s.root);
  const specs = useWorkspace((s) => s.specs);
  const tabs = useUi((s) => s.tabs);
  const activeTabId = useUi((s) => s.activeTabId);
  const runs = useOrchestrator((s) => s.runs);
  const [showNew, setShowNew] = useState(false);

  const runningSpecIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of Object.values(runs)) {
      if (r.specId && (r.status === 'running' || r.status === 'queued')) set.add(r.specId);
    }
    return set;
  }, [runs]);

  const sorted = useMemo(
    () => [...specs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [specs]
  );

  // The active spec = the spec of the open tab, else the most recent one.
  const activeSpecId = useMemo(() => {
    const onTab = tabs.find((t) => t.id === activeTabId)?.specId;
    return onTab ?? sorted[0]?.id ?? null;
  }, [tabs, activeTabId, sorted]);

  const active = sorted.find((s) => s.id === activeSpecId) ?? null;
  const others = sorted.filter((s) => s.id !== activeSpecId);

  return (
    <>
      <div className="flex items-center justify-between px-3.5 h-[42px] shrink-0">
        <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
          SPECS · {specs.length}
        </span>
        <button
          onClick={() => setShowNew(true)}
          title="New spec"
          className="w-6 h-6 grid place-items-center rounded-md bg-elev text-dim hover:text-accent hover:bg-accent/12 transition"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!root ? (
          <p className="px-1 py-6 text-[12px] text-faint">Open a folder to manage specs.</p>
        ) : specs.length === 0 ? (
          <div className="px-1 py-6 text-center">
            <p className="text-[12px] text-faint mb-3">No specs yet.</p>
            <button
              onClick={() => setShowNew(true)}
              className="text-[12px] px-3 py-1.5 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90"
            >
              + New spec
            </button>
          </div>
        ) : (
          <>
            {active && (
              <>
                <div className="font-mono text-[10px] tracking-[0.14em] text-ink-600 px-1 mb-2">
                  ACTIVE SPEC
                </div>
                <SpecHeroCard spec={active} running={runningSpecIds.has(active.id)} />
              </>
            )}
            {others.length > 0 && (
              <>
                <div className="font-mono text-[10px] tracking-[0.14em] text-ink-600 px-1 mt-5 mb-2">
                  OTHER SPECS
                </div>
                <div className="space-y-0.5">
                  {others.map((s) => (
                    <OtherSpecRow key={s.id} spec={s} running={runningSpecIds.has(s.id)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {showNew && <NewSpecDialog onClose={() => setShowNew(false)} />}
    </>
  );
}

const PHASE_LABELS = ['Req', 'Design', 'Tasks', 'Done'];

function SpecHeroCard({ spec, running }: { spec: SpecMeta; running: boolean }) {
  const openTab = useUi((s) => s.openTab);
  const isFeature = spec.kind === 'feature';
  const phaseIdx = PHASE_INDEX[spec.phase];

  const openPhase = (idx: number) => {
    const key =
      idx === 0 ? (isFeature ? 'requirements' : 'bugfix') : idx === 1 ? 'design' : 'tasks';
    const label = idx === 0 ? (isFeature ? 'requirements.md' : 'bugfix.md') : idx === 1 ? 'design.md' : 'tasks.md';
    openTab({
      id: `spec:${spec.id}:${key}`,
      title: `${spec.name} / ${label}`,
      kind: 'spec',
      specId: spec.id,
      specFile: key as 'requirements' | 'design' | 'tasks' | 'bugfix',
    });
  };

  return (
    <div className="rounded-xl bg-gradient-to-b from-elev to-card p-3.5">
      <div className="flex items-start gap-2">
        <span className="font-display text-[17px] font-bold text-ink-50 leading-tight flex-1 min-w-0 truncate">
          {spec.name}
        </span>
        {running && <span className="mt-1 w-[7px] h-[7px] rounded-full bg-accent animate-pulse-dot shrink-0" />}
      </div>
      <div className="font-mono text-[11px] text-faint mt-1 mb-3 flex items-center gap-1.5">
        {isFeature ? <FileCode2 size={11} /> : <Bug size={11} />}
        {spec.kind} · {ago(spec.updatedAt)}
      </div>
      <div className="flex gap-1 mb-1.5">
        {[0, 1, 2, 3].map((i) => {
          const done = i < phaseIdx || spec.phase === 'done';
          const cur = i === phaseIdx && spec.phase !== 'done';
          return (
            <button
              key={i}
              onClick={() => i < 3 && openPhase(i)}
              className={cn(
                'flex-1 h-[5px] rounded-full transition',
                done ? 'bg-good' : cur ? 'bg-accent' : 'bg-elev',
                i < 3 && 'hover:opacity-80'
              )}
              title={`Open ${PHASE_LABELS[i]}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between font-mono text-[9.5px] text-faint">
        {PHASE_LABELS.map((l, i) => (
          <span key={l} className={cn(i === phaseIdx && spec.phase !== 'done' && 'text-accent')}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function OtherSpecRow({ spec, running }: { spec: SpecMeta; running: boolean }) {
  const openTab = useUi((s) => s.openTab);
  const isFeature = spec.kind === 'feature';
  const initial = isFeature ? 'requirements' : 'bugfix';
  const target =
    spec.phase === 'requirements' ? initial : spec.phase === 'design' ? 'design' : 'tasks';

  const dot = running ? 'bg-accent' : spec.phase === 'done' ? 'bg-good' : 'bg-ink-600';

  return (
    <button
      onClick={() =>
        openTab({
          id: `spec:${spec.id}:${target}`,
          title: `${spec.name} / ${target}.md`,
          kind: 'spec',
          specId: spec.id,
          specFile: target as 'requirements' | 'design' | 'tasks' | 'bugfix',
        })
      }
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-elev/60 transition text-left"
    >
      <span className={cn('w-[7px] h-[7px] rounded-full shrink-0', dot, running && 'animate-pulse-dot')} />
      <span className="flex-1 min-w-0 truncate text-[13px] text-ink-200">{spec.name}</span>
      <span className="font-mono text-[10px] text-ink-600 shrink-0">{ago(spec.updatedAt)}</span>
    </button>
  );
}
