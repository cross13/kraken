import { useUi } from '../../stores/ui';
import { ResizeHandle } from '../ResizeHandle';
import { ExplorerView } from '../sidebar/ExplorerView';
import { ChangesView } from './ChangesView';
import { SearchView } from './SearchView';
import { SpecsSideView } from './SpecsSideView';

/**
 * The side bar: one floating panel holding the side view the activity bar
 * picked. It is in the layout flow (the editor area gives up the width) — the
 * old Explorer was a slide-over with a scrim, which meant you could never look
 * at the tree and a file at the same time.
 */
export function SideBar() {
  const open = useUi((s) => s.sideOpen);
  const view = useUi((s) => s.sideView);
  const width = useUi((s) => s.sideWidth);
  const setWidth = useUi((s) => s.setSideWidth);

  if (!open) return null;

  return (
    <>
      <aside
        aria-label={view}
        className="shrink-0 flex flex-col rounded-xl ring-1 ring-ink-50/[0.07] bg-ink-950 overflow-hidden"
        style={{ width }}
      >
        {view === 'explorer' && <ExplorerView />}
        {view === 'search' && <SearchView />}
        {view === 'changes' && <ChangesView />}
        {view === 'specs' && <SpecsSideView />}
      </aside>
      <ResizeHandle width={width} side="right" onResize={setWidth} />
    </>
  );
}
