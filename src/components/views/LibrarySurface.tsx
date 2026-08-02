import { Bot, Sparkles, Zap, Compass, Route, Palette, Settings } from 'lucide-react';
import { useUi, type LibrarySection } from '../../stores/ui';
import { AgentsStudio } from './AgentsStudio';
import { SkillsStudio } from './SkillsStudio';
import { HooksStudio } from './HooksStudio';
import { SteeringStudio } from './SteeringStudio';
import { RouterStudio } from './RouterStudio';
import { SyntaxStudio } from './SyntaxStudio';
import { SettingsView } from '../sidebar/SettingsView';
import { cn } from '../../lib/cn';

const SECTIONS: { section: LibrarySection; label: string; hint: string; icon: React.ReactNode }[] = [
  { section: 'agents', label: 'Agents', hint: 'who does the work', icon: <Bot size={15} /> },
  { section: 'skills', label: 'Skills', hint: 'injected instructions', icon: <Sparkles size={15} /> },
  { section: 'hooks', label: 'Hooks', hint: 'event automation', icon: <Zap size={15} /> },
  { section: 'steering', label: 'Steering', hint: 'project context', icon: <Compass size={15} /> },
  { section: 'routing', label: 'Routing', hint: 'why agents get picked', icon: <Route size={15} /> },
  { section: 'appearance', label: 'Appearance', hint: 'themes & syntax', icon: <Palette size={15} /> },
  { section: 'settings', label: 'Settings', hint: 'backend & repo', icon: <Settings size={15} /> },
];

/**
 * Library — the consolidated background-config surface. The spec workflow is
 * the star of the app; everything that tunes it lives here, one section each.
 */
export function LibrarySurface() {
  const section = useUi((s) => s.librarySection);
  const openLibrary = useUi((s) => s.openLibrary);

  return (
    <div className="h-full flex bg-ink-950">
      <aside className="w-[200px] shrink-0 flex flex-col py-4 px-2.5 bg-rail/60">
        <div className="font-mono text-[10px] tracking-[0.16em] text-faint px-2.5 pb-3">
          LIBRARY
        </div>
        {SECTIONS.map((s) => (
          <button
            key={s.section}
            onClick={() => openLibrary(s.section)}
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition mb-0.5',
              section === s.section
                ? 'bg-accent/12 text-accent'
                : 'text-ink-300 hover:text-ink-50 hover:bg-elev'
            )}
          >
            <span className={section === s.section ? 'text-accent' : 'text-faint'}>{s.icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium leading-tight">{s.label}</span>
              <span
                className={cn(
                  'block text-[10px] leading-tight',
                  section === s.section ? 'text-accent/70' : 'text-faint'
                )}
              >
                {s.hint}
              </span>
            </span>
          </button>
        ))}
      </aside>

      <div className="flex-1 min-w-0">
        {section === 'agents' && <AgentsStudio />}
        {section === 'skills' && <SkillsStudio />}
        {section === 'hooks' && <HooksStudio />}
        {section === 'steering' && <SteeringStudio />}
        {section === 'routing' && <RouterStudio />}
        {section === 'appearance' && <SyntaxStudio />}
        {section === 'settings' && <SettingsView variant="page" />}
      </div>
    </div>
  );
}
