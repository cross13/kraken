import {
  Activity,
  Files,
  GitBranch,
  GraduationCap,
  Home,
  LibraryBig,
  ListChecks,
  Search,
} from 'lucide-react';
import { useUi, type SideView, type Surface } from '../../stores/ui';
import { useOrchestrator } from '../../stores/orchestrator';
import { useGit } from '../../stores/git';
import { OctoMark } from '../OctoMark';
import { cn } from '../../lib/cn';

const SIDE: { view: SideView; icon: React.ReactNode; label: string }[] = [
  { view: 'explorer', icon: <Files size={18} />, label: 'Explorer (⌘⇧E)' },
  { view: 'search', icon: <Search size={18} />, label: 'Search (⌘⇧F)' },
  { view: 'changes', icon: <GitBranch size={18} />, label: 'Changes' },
  { view: 'specs', icon: <ListChecks size={18} />, label: 'Specs' },
];

const SURFACES: { surface: Surface; icon: React.ReactNode; label: string }[] = [
  { surface: 'home', icon: <Home size={18} />, label: 'Home' },
  { surface: 'activity', icon: <Activity size={18} />, label: 'Activity' },
  { surface: 'library', icon: <LibraryBig size={18} />, label: 'Library' },
  { surface: 'learn', icon: <GraduationCap size={18} />, label: 'Learn — what do you want to work on?' },
];

/**
 * The left edge of the IDE shell. Two groups, because they do two different
 * things: the top four pick what the **side bar** shows (and close it when
 * asked for the view already on screen), the rest pick the **surface** in the
 * editor area. On the Brasa palettes this is the one charcoal surface; on the
 * others it sits on the frame (`--actbar` falls back to `--rail`).
 */
export function ActivityBar() {
  const surface = useUi((s) => s.surface);
  const setSurface = useUi((s) => s.setSurface);
  const activeTabId = useUi((s) => s.activeTabId);
  const sideView = useUi((s) => s.sideView);
  const sideOpen = useUi((s) => s.sideOpen);
  const showSide = useUi((s) => s.showSide);
  const changed = useGit((s) => s.files.length);
  const running = useOrchestrator(
    (s) =>
      Object.values(s.runs).filter((r) => r.status === 'running' || r.status === 'queued').length
  );

  return (
    <nav
      aria-label="Views"
      className="w-12 shrink-0 ml-2 mb-2 flex flex-col items-center gap-1 py-2 rounded-xl bg-[rgb(var(--actbar))]"
    >
      <div className="mb-2 w-9 h-9 grid place-items-center rounded-lg octo-tile">
        <OctoMark className="w-[22px]" />
      </div>

      {SIDE.map((it) => (
        <BarButton
          key={it.view}
          label={it.view === 'changes' && changed > 0 ? `${it.label} — ${changed} files` : it.label}
          active={sideOpen && sideView === it.view}
          count={it.view === 'changes' ? changed : 0}
          onClick={() => showSide(it.view)}
        >
          {it.icon}
        </BarButton>
      ))}

      <span className="my-1 h-px w-6 bg-[rgb(var(--actbar-ink)/0.25)]" />

      {SURFACES.map((it) => (
        <BarButton
          key={it.surface}
          label={it.surface === 'activity' && running > 0 ? `${it.label} — ${running} running` : it.label}
          // A surface is "on" only while it is what the editor area shows.
          active={activeTabId === null && surface === it.surface}
          count={it.surface === 'activity' ? running : 0}
          onClick={() => setSurface(it.surface)}
        >
          {it.icon}
        </BarButton>
      ))}
    </nav>
  );
}

function BarButton({
  children,
  label,
  active,
  count,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative w-10 h-10 grid place-items-center rounded-lg transition shrink-0',
        active
          ? 'text-[rgb(var(--actbar-ink-strong))] bg-[rgb(var(--actbar-ink-strong)/0.10)]'
          : 'text-[rgb(var(--actbar-ink))] hover:text-[rgb(var(--actbar-ink-strong))] hover:bg-[rgb(var(--actbar-ink-strong)/0.06)]'
      )}
    >
      {active && (
        <span className="absolute -left-1 top-[11px] w-[3px] h-[18px] rounded-r-sm bg-[rgb(var(--actbar-mark))]" />
      )}
      {children}
      {count > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-[rgb(var(--actbar-ink-strong))] text-[rgb(var(--actbar))] text-[10px] font-bold leading-none tabular-nums">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
