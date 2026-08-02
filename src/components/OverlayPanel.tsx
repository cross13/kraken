import { X } from 'lucide-react';
import { useUi } from '../stores/ui';
import { FileViewer } from './views/FileViewer';
import { AgentViewer } from './views/AgentViewer';
import { SkillViewer } from './views/SkillViewer';
import { RunViewer } from './views/RunViewer';
import { QuestionsView } from './views/QuestionsView';
import { HookEditor } from './views/HookEditor';
import { SourceControlView } from './sidebar/SourceControlView';

const TITLES: Record<string, string> = {
  file: 'File',
  agent: 'Agent',
  skill: 'Skill',
  run: 'Run',
  questions: 'Open Questions',
  hook: 'Hook',
  repo: 'Repository',
};

/**
 * The right slide-over host — detail views that used to be center tabs (file /
 * agent / skill / run viewers, open questions, hook editor, the global repo
 * panel) now open here on top of whatever surface is active.
 */
export function OverlayPanel() {
  const overlay = useUi((s) => s.overlay);
  const closeOverlay = useUi((s) => s.closeOverlay);

  if (!overlay) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={closeOverlay}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        className="relative h-full w-[min(1180px,72vw)] min-w-[520px] py-2 pr-2 flex flex-col animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 flex flex-col rounded-xl ring-1 ring-ink-50/[0.08] bg-ink-950 overflow-hidden shadow-[-24px_0_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-2 px-4 h-[42px] shrink-0 bg-ink-50/[0.03]">
          <span className="font-mono text-[11px] tracking-[0.14em] text-faint">
            {(TITLES[overlay.kind] ?? 'Detail').toUpperCase()}
          </span>
          <button
            onClick={closeOverlay}
            title="Close (esc)"
            className="ml-auto w-7 h-7 grid place-items-center rounded-md text-faint hover:text-ink-50 hover:bg-elev"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {overlay.kind === 'file' && <FileViewer path={overlay.path} />}
          {overlay.kind === 'agent' && <AgentViewer path={overlay.path} />}
          {overlay.kind === 'skill' && <SkillViewer path={overlay.path} />}
          {overlay.kind === 'run' && <RunViewer runId={overlay.runId} />}
          {overlay.kind === 'questions' && <QuestionsView specId={overlay.specId} />}
          {overlay.kind === 'hook' && <HookEditor hookId={overlay.hookId} />}
          {overlay.kind === 'repo' && <SourceControlView variant="page" />}
        </div>
        </div>
      </div>
    </div>
  );
}
