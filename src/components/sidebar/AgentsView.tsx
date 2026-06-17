import { Bot, Globe, Briefcase, Wand2 } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { useChat } from '../../stores/chat';
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';
import { cn } from '../../lib/cn';

export function AgentsView() {
  const root = useWorkspace((s) => s.root);
  const agents = useWorkspace((s) => s.agents);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const openTab = useUi((s) => s.openTab);
  const selectedAgent = useChat((s) => s.selectedAgent);
  const setSelectedAgent = useChat((s) => s.setSelectedAgent);

  return (
    <>
      <SidebarHeader
        title="Agents"
        actions={
          <SidebarButton onClick={seedDefaults} title="Seed defaults">
            <Wand2 size={13} />
          </SidebarButton>
        }
      />
      <div className="flex-1 overflow-y-auto py-1">
        {!root ? (
          <SidebarEmpty title="No workspace" description="Open a folder to manage agents." />
        ) : agents.length === 0 ? (
          <SidebarEmpty
            title="No agents"
            description="Seed defaults to install the SDD agent library."
            action={
              <button
                onClick={seedDefaults}
                className="text-xs px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90"
              >
                Seed defaults
              </button>
            }
          />
        ) : (
          <div className="px-1.5 space-y-0.5">
            {agents.map((a) => {
              const active = selectedAgent === a.name;
              return (
                <div
                  key={a.path}
                  className={cn(
                    'group rounded-md px-2 py-2 hover:bg-ink-800/60 cursor-pointer',
                    active && 'bg-ink-800/80 ring-1 ring-accent/40'
                  )}
                  onClick={() => setSelectedAgent(active ? null : a.name)}
                  onDoubleClick={() =>
                    openTab({
                      id: `agent:${a.path}`,
                      title: `agent: ${a.name}`,
                      kind: 'agent',
                      filePath: a.path,
                    })
                  }
                >
                  <div className="flex items-start gap-2">
                    <Bot size={13} className={cn('mt-0.5 shrink-0', active ? 'text-accent' : 'text-ink-300')} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-ink-100 font-medium truncate">{a.name}</span>
                        {a.scope === 'global' ? (
                          <Globe size={10} className="text-ink-500" />
                        ) : (
                          <Briefcase size={10} className="text-ink-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-ink-400 leading-snug line-clamp-2">
                        {a.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="text-[10px] text-ink-500 px-3 py-2 border-t border-ink-800">
        Click to select for chat. Double-click to inspect.
      </div>
    </>
  );
}
