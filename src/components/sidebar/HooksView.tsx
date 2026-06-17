import { Zap, Globe, Briefcase, Wand2, Plus, Play } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';
import { cn } from '../../lib/cn';
import type { HookTrigger } from '../../../electron/shared/types';

const TRIGGER_LABEL: Record<HookTrigger, string> = {
  'spec-advance': 'spec advance',
  'spec-done': 'spec done',
  'task-complete': 'task done',
  'wave-complete': 'wave done',
  'file-save-in-app': 'file save',
  manual: 'manual',
};

export function HooksView() {
  const root = useWorkspace((s) => s.root);
  const hooks = useWorkspace((s) => s.hooks);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const openTab = useUi((s) => s.openTab);

  const newHook = () =>
    openTab({ id: 'hook:new', title: 'New hook', kind: 'hook', hookId: undefined });

  const toggle = async (id: string, enabled: boolean) => {
    if (!root) return;
    await window.kraken.hooks.toggle(root, id, enabled);
    await refreshAll();
  };

  const run = async (id: string) => {
    if (!root) return;
    await window.kraken.hooks.fireOne(root, id, { root });
  };

  return (
    <>
      <SidebarHeader
        title="Hooks"
        actions={
          <>
            <SidebarButton onClick={newHook} title="New hook">
              <Plus size={13} />
            </SidebarButton>
            <SidebarButton onClick={seedDefaults} title="Seed defaults">
              <Wand2 size={13} />
            </SidebarButton>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto py-1">
        {!root ? (
          <SidebarEmpty title="No workspace" description="Open a folder to manage hooks." />
        ) : hooks.length === 0 ? (
          <SidebarEmpty
            title="No hooks"
            description="Seed defaults to install validate & docs hooks, or create your own."
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
            {hooks.map((h) => (
              <div
                key={h.path}
                className="group rounded-md px-2 py-2 hover:bg-ink-800/60 cursor-pointer"
                onDoubleClick={() =>
                  openTab({
                    id: `hook:${h.id}`,
                    title: h.title,
                    kind: 'hook',
                    hookId: h.id,
                  })
                }
              >
                <div className="flex items-start gap-2">
                  <Zap
                    size={13}
                    className={cn('mt-0.5 shrink-0', h.enabled ? 'text-accent' : 'text-ink-600')}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'text-xs font-medium truncate',
                          h.enabled ? 'text-ink-100' : 'text-ink-500 line-through'
                        )}
                      >
                        {h.title}
                      </span>
                      {h.scope === 'global' ? (
                        <Globe size={10} className="text-ink-500" />
                      ) : (
                        <Briefcase size={10} className="text-ink-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] uppercase tracking-wide text-ink-500 border border-ink-700 rounded px-1">
                        {TRIGGER_LABEL[h.trigger]}
                      </span>
                      {h.blocking ? (
                        <span className="text-[9px] uppercase tracking-wide text-amber-400/80">
                          blocking
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        run(h.id);
                      }}
                      title="Run now"
                      className="p-1 rounded text-ink-400 hover:text-accent"
                    >
                      <Play size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(h.id, !h.enabled);
                      }}
                      title={h.enabled ? 'Disable' : 'Enable'}
                      className={cn(
                        'w-7 h-4 rounded-full relative transition',
                        h.enabled ? 'bg-accent' : 'bg-ink-700'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 w-3 h-3 rounded-full bg-white transition',
                          h.enabled ? 'left-3.5' : 'left-0.5'
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="text-[10px] text-ink-500 px-3 py-2 border-t border-ink-800">
        Hooks fire Claude on spec / task / wave events. Double-click to edit.
      </div>
    </>
  );
}
