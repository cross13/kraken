import { Plus, History, X } from 'lucide-react';
import { useUi } from '../stores/ui';
import { useChat } from '../stores/chat';
import { useWorkspace } from '../stores/workspace';
import { ChatPanel } from './ChatPanel';

/**
 * The Assistant — the free-form chat escape valve, as a right session panel
 * (⌘J). Conversation only: the live run feed lives on the Activity surface.
 */
export function AssistantDrawer() {
  const setAssistantOpen = useUi((s) => s.setAssistantOpen);
  const openActivity = useUi((s) => s.openActivity);
  const activeSpecId = useUi((s) => s.activeSpecId);
  const clear = useChat((s) => s.clear);
  const busy = useChat((s) => s.busy);
  const specs = useWorkspace((s) => s.specs);
  const activeSpec = specs.find((s) => s.id === activeSpecId) ?? null;

  return (
    <div className="h-full flex flex-col bg-ink-950">
      {/* session tab header */}
      <div className="flex items-center gap-2 px-2.5 pt-2 pb-1.5 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-50/[0.05] ring-1 ring-ink-50/[0.05]">
          <span
            className={
              busy
                ? 'w-[7px] h-[7px] rounded-full bg-accent animate-pulse-dot'
                : 'w-[7px] h-[7px] rounded-full bg-good'
            }
          />
          <span className="text-[12.5px] text-ink-100 whitespace-nowrap">
            {activeSpec ? activeSpec.name : 'New Session'}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <HeaderButton onClick={clear} title="New session (clears the thread)">
            <Plus size={14} />
          </HeaderButton>
          <HeaderButton onClick={() => openActivity('history')} title="Run history">
            <History size={14} />
          </HeaderButton>
          <HeaderButton onClick={() => setAssistantOpen(false)} title="Close (⌘J)">
            <X size={14} />
          </HeaderButton>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ChatPanel />
      </div>
    </div>
  );
}

function HeaderButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 grid place-items-center rounded-md text-faint hover:text-ink-50 hover:bg-ink-50/[0.06] transition"
    >
      {children}
    </button>
  );
}
