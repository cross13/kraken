import { Compass, Globe, Briefcase, Wand2 } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';
import type { SteeringInclusion } from '../../../electron/shared/types';

const INCLUSION_LABEL: Record<SteeringInclusion, string> = {
  always: 'always',
  fileMatch: 'fileMatch',
  manual: 'manual',
  auto: 'auto',
};

export function SteeringView() {
  const root = useWorkspace((s) => s.root);
  const steering = useWorkspace((s) => s.steering);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const openTab = useUi((s) => s.openTab);

  return (
    <>
      <SidebarHeader
        title="Steering"
        actions={
          <SidebarButton onClick={seedDefaults} title="Seed defaults">
            <Wand2 size={13} />
          </SidebarButton>
        }
      />
      <div className="flex-1 overflow-y-auto py-1">
        {!root ? (
          <SidebarEmpty title="No workspace" description="Open a folder to manage steering." />
        ) : steering.length === 0 ? (
          <SidebarEmpty
            title="No steering files"
            description="Seed defaults to create product / tech / structure steering."
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
            {steering.map((s) => (
              <div
                key={s.path}
                className="group rounded-md px-2 py-2 hover:bg-ink-800/60 cursor-pointer"
                onDoubleClick={() =>
                  openTab({
                    id: `file:${s.path}`,
                    title: s.name,
                    kind: 'file',
                    filePath: s.path,
                  })
                }
              >
                <div className="flex items-start gap-2">
                  <Compass size={13} className="mt-0.5 shrink-0 text-ink-300" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-ink-100 font-medium truncate">{s.name}</span>
                      {s.scope === 'global' ? (
                        <Globe size={10} className="text-ink-500" />
                      ) : (
                        <Briefcase size={10} className="text-ink-500" />
                      )}
                      <span className="text-[9px] uppercase tracking-wide text-ink-500 border border-ink-700 rounded px-1">
                        {INCLUSION_LABEL[s.inclusion]}
                      </span>
                    </div>
                    {s.description ? (
                      <p className="text-[11px] text-ink-400 leading-snug line-clamp-2">
                        {s.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="text-[10px] text-ink-500 px-3 py-2 border-t border-ink-800">
        Steering is injected into every Claude run's system prompt.
      </div>
    </>
  );
}
