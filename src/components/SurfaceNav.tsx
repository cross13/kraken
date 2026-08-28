import { Home, FileCode2, Activity, LibraryBig } from 'lucide-react';
import { useUi, type Surface } from '../stores/ui';
import { useOrchestrator } from '../stores/orchestrator';
import { OctoLogo } from './OctoLogo';
import { cn } from '../lib/cn';

const NAV: { surface: Surface; icon: React.ReactNode; label: string }[] = [
  { surface: 'home', icon: <Home size={18} />, label: 'Home' },
  { surface: 'spec', icon: <FileCode2 size={18} />, label: 'Spec' },
  { surface: 'activity', icon: <Activity size={18} />, label: 'Activity' },
  { surface: 'library', icon: <LibraryBig size={18} />, label: 'Library' },
];

/** The whole left nav: the brand mark + four surfaces, on the app frame. */
export function SurfaceNav() {
  const surface = useUi((s) => s.surface);
  const setSurface = useUi((s) => s.setSurface);
  const activeSpecId = useUi((s) => s.activeSpecId);
  const openSpec = useUi((s) => s.openSpec);
  const running = useOrchestrator(
    (s) =>
      Object.values(s.runs).filter((r) => r.status === 'running' || r.status === 'queued').length
  );

  return (
    <nav className="w-[60px] shrink-0 flex flex-col items-center pt-1 pb-3 gap-1.5">
      {/* brand mark — the rail's anchor, the kit's app tile */}
      <div className="mb-3 w-10 h-10 grid place-items-center rounded-[12px] octo-tile">
        <OctoLogo className="w-[22px] h-[27px]" />
      </div>

      {NAV.map((it) => {
        const active = surface === it.surface;
        const disabled = it.surface === 'spec' && !activeSpecId;
        const count = it.surface === 'activity' ? running : 0;
        return (
          <button
            key={it.surface}
            disabled={disabled}
            onClick={() =>
              it.surface === 'spec' && activeSpecId ? openSpec(activeSpecId) : setSurface(it.surface)
            }
            title={
              disabled
                ? `${it.label} — open a spec first`
                : count > 0
                  ? `${it.label} — ${count} running`
                  : it.label
            }
            className={cn(
              'relative w-10 h-10 grid place-items-center rounded-[12px] transition shrink-0',
              active
                ? 'text-accent bg-accent/15'
                : disabled
                  ? 'text-ink-600 cursor-default'
                  : 'text-faint hover:text-ink-50 hover:bg-ink-50/[0.06]'
            )}
          >
            {it.icon}
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 grid place-items-center rounded-full bg-accent text-accent-fg text-[9px] font-bold leading-none ring-2 ring-rail">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
