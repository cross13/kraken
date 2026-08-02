import { X } from 'lucide-react';
import { useUi } from '../stores/ui';
import { ExplorerView } from './sidebar/ExplorerView';

/** The file tree as a left slide-over (⌘⇧E) — no longer a nav destination. */
export function ExplorerDrawer() {
  const open = useUi((s) => s.explorerOpen);
  const toggle = useUi((s) => s.toggleExplorer);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex" onClick={toggle}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative h-full w-[400px] p-2 pl-[68px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 flex flex-col rounded-xl ring-1 ring-ink-50/[0.08] bg-ink-950 overflow-hidden shadow-[24px_0_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-end px-2 pt-2">
          <button
            onClick={toggle}
            title="Close (⌘⇧E)"
            className="w-7 h-7 grid place-items-center rounded-md text-faint hover:text-ink-50 hover:bg-elev"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <ExplorerView />
        </div>
        </div>
      </div>
    </div>
  );
}
