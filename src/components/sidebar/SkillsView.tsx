import { Sparkles, Globe, Briefcase, Wand2 } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';

export function SkillsView() {
  const root = useWorkspace((s) => s.root);
  const skills = useWorkspace((s) => s.skills);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const openTab = useUi((s) => s.openTab);

  return (
    <>
      <SidebarHeader
        title="Skills"
        actions={
          <SidebarButton onClick={seedDefaults} title="Seed defaults">
            <Wand2 size={13} />
          </SidebarButton>
        }
      />
      <div className="flex-1 overflow-y-auto py-1">
        {!root ? (
          <SidebarEmpty title="No workspace" description="Open a folder to manage skills." />
        ) : skills.length === 0 ? (
          <SidebarEmpty
            title="No skills"
            description="Seed defaults to add SDD feature & bugfix skills."
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
            {skills.map((s) => (
              <button
                key={s.path}
                onClick={() =>
                  openTab({
                    id: `skill:${s.path}`,
                    title: `skill: ${s.name}`,
                    kind: 'skill',
                    filePath: s.path,
                  })
                }
                className="w-full flex items-start gap-2 px-2 py-2 rounded-md hover:bg-ink-800/60 text-left"
              >
                <Sparkles size={13} className="mt-0.5 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-ink-100 font-medium truncate">{s.name}</span>
                    {s.scope === 'global' ? (
                      <Globe size={10} className="text-ink-500" />
                    ) : (
                      <Briefcase size={10} className="text-ink-500" />
                    )}
                  </div>
                  <p className="text-[11px] text-ink-400 leading-snug line-clamp-2">
                    {s.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
