import {
  Folder,
  FileCode,
  Sparkles,
  Bot,
  Settings,
  History,
  Compass,
  Zap,
  GitBranch,
  Network,
  Workflow,
  ListTodo,
} from 'lucide-react';
import { useUi, type ActivityTab } from '../stores/ui';
import { useOrchestrator } from '../stores/orchestrator';
import { cn } from '../lib/cn';

const items: { tab: ActivityTab; icon: React.ReactNode; label: string }[] = [
  { tab: 'explorer', icon: <Folder size={18} />, label: 'Explorer' },
  { tab: 'specs', icon: <FileCode size={18} />, label: 'Specs' },
  { tab: 'skills', icon: <Sparkles size={18} />, label: 'Skills' },
  { tab: 'agents', icon: <Bot size={18} />, label: 'Agents' },
  { tab: 'steering', icon: <Compass size={18} />, label: 'Steering' },
  { tab: 'hooks', icon: <Zap size={18} />, label: 'Hooks' },
  { tab: 'source-control', icon: <GitBranch size={18} />, label: 'Source Control' },
  { tab: 'tasks', icon: <ListTodo size={18} />, label: 'Running Tasks' },
  { tab: 'orchestrator', icon: <Network size={18} />, label: 'Orchestrator' },
  { tab: 'graph', icon: <Workflow size={18} />, label: 'Agent Graph' },
  { tab: 'history', icon: <History size={18} />, label: 'History' },
  { tab: 'settings', icon: <Settings size={18} />, label: 'Settings' },
];

export function ActivityBar() {
  const activity = useUi((s) => s.activity);
  const setActivity = useUi((s) => s.setActivity);
  const openTab = useUi((s) => s.openTab);

  const onSelect = (tab: ActivityTab) => {
    setActivity(tab);
    // The graph lives in a full-width editor tab; open/focus it on selection.
    if (tab === 'graph') openTab({ id: 'agent-graph', title: 'Agent Graph', kind: 'graph' });
  };
  // Live counts surfaced as badges: all agents (Orchestrator) and tasks (Tasks).
  const running = useOrchestrator(
    (s) =>
      Object.values(s.runs).filter(
        (r) => r.status === 'running' || r.status === 'queued'
      ).length
  );
  const runningTasks = useOrchestrator(
    (s) =>
      Object.values(s.runs).filter(
        (r) =>
          (r.kind === 'task' || r.kind === 'refine') &&
          (r.status === 'running' || r.status === 'queued')
      ).length
  );

  const badgeFor = (tab: ActivityTab) =>
    tab === 'orchestrator' || tab === 'graph' ? running : tab === 'tasks' ? runningTasks : 0;

  return (
    <aside className="w-12 shrink-0 bg-ink-950 border-r border-ink-800 flex flex-col items-center py-2 gap-1">
      {items.map((it) => {
        const count = badgeFor(it.tab);
        const showBadge = count > 0;
        return (
          <button
            key={it.tab}
            onClick={() => onSelect(it.tab)}
            title={showBadge ? `${it.label} — ${count} running` : it.label}
            className={cn(
              'relative w-9 h-9 grid place-items-center rounded-md transition group',
              activity === it.tab
                ? 'text-ink-50 bg-ink-800/60'
                : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800/40'
            )}
          >
            {activity === it.tab && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-accent" />
            )}
            {it.icon}
            {showBadge && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 grid place-items-center rounded-full bg-accent text-accent-fg text-[9px] font-bold leading-none ring-2 ring-ink-950">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
