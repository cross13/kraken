import { useUi } from '../stores/ui';
import { ExplorerView } from './sidebar/ExplorerView';
import { SpecsView } from './sidebar/SpecsView';
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

export function Sidebar() {
  const activity = useUi((s) => s.activity);

  return (
    <div className="h-full flex flex-col">
      {activity === 'explorer' && <ExplorerView />}
      {activity === 'specs' && <SpecsView />}
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
  );
}
