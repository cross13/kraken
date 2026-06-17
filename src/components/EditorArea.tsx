import { X } from 'lucide-react';
import { useUi } from '../stores/ui';
import { cn } from '../lib/cn';
import { WelcomeView } from './views/WelcomeView';
import { SpecEditor } from './views/SpecEditor';
import { QuestionsView } from './views/QuestionsView';
import { FileViewer } from './views/FileViewer';
import { AgentViewer } from './views/AgentViewer';
import { SkillViewer } from './views/SkillViewer';
import { RunViewer } from './views/RunViewer';
import { HookEditor } from './views/HookEditor';
import { AgentGraphView } from './views/AgentGraphView';

export function EditorArea() {
  const tabs = useUi((s) => s.tabs);
  const activeTabId = useUi((s) => s.activeTabId);
  const setActiveTab = useUi((s) => s.setActiveTab);
  const closeTab = useUi((s) => s.closeTab);

  const active = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-9 border-b border-ink-800 flex items-end bg-ink-950 overflow-x-auto">
        {tabs.map((t) => {
          const selected = t.id === activeTabId;
          return (
            <div
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'group h-full flex items-center gap-2 px-3 border-r border-ink-800 cursor-pointer text-xs',
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
      <div className="flex-1 min-h-0 overflow-hidden">
        {!active && <WelcomeView />}
        {active?.kind === 'welcome' && <WelcomeView />}
        {active?.kind === 'spec' && active.specId && active.specFile && (
          <SpecEditor key={active.id} specId={active.specId} file={active.specFile} />
        )}
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
