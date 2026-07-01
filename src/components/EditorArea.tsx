import { X } from 'lucide-react';
import { useUi } from '../stores/ui';
import { cn } from '../lib/cn';
import { WelcomeView } from './views/WelcomeView';
import { SpecEditor } from './views/SpecEditor';
import { SpecSummaryView } from './views/SpecSummaryView';
import { SourceControlView } from './sidebar/SourceControlView';
import { SettingsView } from './sidebar/SettingsView';
import { QuestionsView } from './views/QuestionsView';
import { FileViewer } from './views/FileViewer';
import { AgentViewer } from './views/AgentViewer';
import { SkillViewer } from './views/SkillViewer';
import { AgentsStudio } from './views/AgentsStudio';
import { SkillsStudio } from './views/SkillsStudio';
import { RouterStudio } from './views/RouterStudio';
import { HooksStudio } from './views/HooksStudio';
import { SteeringStudio } from './views/SteeringStudio';
import { SpecsStudio } from './views/SpecsStudio';
import { SyntaxStudio } from './views/SyntaxStudio';
import { RunViewer } from './views/RunViewer';
import { HookEditor } from './views/HookEditor';
import { AgentGraphView } from './views/AgentGraphView';
import { TerminalView } from './views/TerminalView';

export function EditorArea() {
  const tabs = useUi((s) => s.tabs);
  const activeTabId = useUi((s) => s.activeTabId);
  const setActiveTab = useUi((s) => s.setActiveTab);
  const closeTab = useUi((s) => s.closeTab);

  const active = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-9 border-b border-ink-800/40 flex items-end bg-ink-950 overflow-x-auto">
        {tabs.map((t) => {
          const selected = t.id === activeTabId;
          return (
            <div
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'group h-full flex items-center gap-2 px-3 cursor-pointer text-xs',
                selected
                  ? 'bg-ink-900 text-ink-50 border-t border-t-accent'
                  : 'text-ink-400 hover:bg-ink-900/60'
              )}
            >
              <span className="truncate max-w-[200px]">{t.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-ink-100"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {/* Terminals stay mounted across tab switches (toggled with display) so
            their PTY process survives — unmounting would kill the shell. */}
        {tabs
          .filter((t) => t.kind === 'terminal')
          .map((t) => (
            <div
              key={t.id}
              className="absolute inset-0"
              style={{ display: t.id === activeTabId ? 'block' : 'none' }}
            >
              <TerminalView tabId={t.id} profile={t.termProfile ?? 'shell'} />
            </div>
          ))}
        {(!active || active.kind === 'welcome') && <WelcomeView />}
        {active?.kind === 'spec' && active.specId && active.specFile && (
          <SpecEditor key={active.id} specId={active.specId} file={active.specFile} />
        )}
        {active?.kind === 'summary' && active.specId && (
          <SpecSummaryView key={active.id} specId={active.specId} />
        )}
        {active?.kind === 'source-control' && (
          <SourceControlView key={active.id} variant="page" />
        )}
        {active?.kind === 'settings' && <SettingsView key={active.id} variant="page" />}
        {active?.kind === 'questions' && active.specId && (
          <QuestionsView key={active.id} specId={active.specId} />
        )}
        {active?.kind === 'file' && active.filePath && (
          <FileViewer key={active.id} path={active.filePath} />
        )}
        {active?.kind === 'agent' && active.filePath && (
          <AgentViewer key={active.id} path={active.filePath} />
        )}
        {active?.kind === 'skill' && active.filePath && (
          <SkillViewer key={active.id} path={active.filePath} />
        )}
        {active?.kind === 'agents-studio' && <AgentsStudio key={active.id} />}
        {active?.kind === 'skills-studio' && <SkillsStudio key={active.id} />}
        {active?.kind === 'router-studio' && <RouterStudio key={active.id} />}
        {active?.kind === 'hooks-studio' && <HooksStudio key={active.id} />}
        {active?.kind === 'steering-studio' && <SteeringStudio key={active.id} />}
        {active?.kind === 'specs-studio' && <SpecsStudio key={active.id} />}
        {active?.kind === 'syntax-studio' && <SyntaxStudio key={active.id} />}
        {active?.kind === 'run' && active.runId && (
          <RunViewer key={active.id} runId={active.runId} />
        )}
        {active?.kind === 'hook' && (
          <HookEditor key={active.id} tabId={active.id} hookId={active.hookId} />
        )}
        {active?.kind === 'graph' && <AgentGraphView key={active.id} />}
      </div>
    </div>
  );
}
