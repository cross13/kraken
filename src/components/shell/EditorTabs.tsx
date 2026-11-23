import { X } from 'lucide-react';
import { useUi, type EditorTab, type SpecStage, type Surface } from '../../stores/ui';
import { stageFileNames } from '../views/SpecFlow';
import { useWorkspace } from '../../stores/workspace';
import { useGit, statusLetter } from '../../stores/git';
import { cn } from '../../lib/cn';

const SURFACE_LABEL: Record<Surface, string> = {
  home: 'Home',
  spec: 'Spec',
  activity: 'Activity',
  library: 'Library',
  learn: 'Learn',
};

const STAGES: SpecStage[] = ['define', 'plan', 'build'];
const PHASES = ['requirements', 'plan', 'build', 'done'];

const base = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/**
 * The editor area's tab strip. The pinned tabs come first and are the
 * **surface**: one tab for Home / Activity / Library / Learn, or — while a spec
 * is the surface — its three documents (`requirements.md` · `plan.md` ·
 * `tasks.md`), which are the spec's stages. They cannot be closed, only
 * switched; a stage past the spec's current gate is locked. The rest are files
 * and diffs. So a spec's documents and the files you open beside them are one
 * row of tabs. The strip is hidden when there is nothing to switch between — a
 * lone "Home" tab would be chrome.
 */
export function EditorTabs() {
  const tabs = useUi((s) => s.tabs);
  const activeTabId = useUi((s) => s.activeTabId);
  const setActiveTab = useUi((s) => s.setActiveTab);
  const closeTab = useUi((s) => s.closeTab);
  const closeAllTabs = useUi((s) => s.closeAllTabs);
  const surface = useUi((s) => s.surface);
  const activeSpecId = useUi((s) => s.activeSpecId);
  const specs = useWorkspace((s) => s.specs);
  const root = useWorkspace((s) => s.root);
  const changed = useGit((s) => s.files);

  const specStage = useUi((s) => s.specStage);
  const showSpecDoc = useUi((s) => s.showSpecDoc);
  const spec = surface === 'spec' ? specs.find((s) => s.id === activeSpecId) : null;

  if (tabs.length === 0 && !spec) return null;

  const surfaceLabel = SURFACE_LABEL[surface];
  const phaseIdx = spec ? Math.min(PHASES.indexOf(spec.phase), STAGES.length - 1) : -1;
  const pinned = (active: boolean) =>
    cn(
      'shrink-0 max-w-[220px] px-3.5 border-r border-ink-50/[0.06] truncate transition',
      active
        ? 'bg-ink-950 text-ink-50 font-medium shadow-[inset_0_2px_0_rgb(var(--ink-50))]'
        : 'text-faint hover:text-ink-100'
    );

  const statusOf = (t: EditorTab) => {
    const rel = t.kind === 'diff' ? t.path : root && t.path.startsWith(`${root}/`) ? t.path.slice(root.length + 1) : null;
    const f = rel ? changed.find((c) => c.path === rel) : undefined;
    return f ? statusLetter(f) : null;
  };

  return (
    <div
      role="tablist"
      aria-label="Open editors"
      className="flex items-stretch h-9 shrink-0 bg-ink-900 border-b border-ink-50/[0.06] overflow-x-auto"
    >
      {spec ? (
        <>
          <span
            title={spec.id}
            className="shrink-0 max-w-[180px] flex items-center px-3 text-[12px] text-faint border-r border-ink-50/[0.06] truncate"
          >
            {spec.name || spec.id}
          </span>
          {stageFileNames(spec.kind).map((name, i) => {
            const reachable = i <= phaseIdx;
            const active = activeTabId === null && specStage === STAGES[i];
            return (
              <button
                key={name}
                role="tab"
                aria-selected={active}
                disabled={!reachable}
                onClick={() => showSpecDoc(STAGES[i])}
                title={reachable ? name : `${name} — locked until the previous gate is approved`}
                className={cn(
                  pinned(active),
                  'font-mono text-[12px]',
                  !reachable && 'text-ink-600 hover:text-ink-600 cursor-default'
                )}
              >
                {name}
              </button>
            );
          })}
        </>
      ) : (
        <button
          role="tab"
          aria-selected={activeTabId === null}
          onClick={() => setActiveTab(null)}
          title={surfaceLabel}
          className={cn(pinned(activeTabId === null), 'text-[12.5px]')}
        >
          {surfaceLabel}
        </button>
      )}

      {tabs.map((t) => {
        const active = t.id === activeTabId;
        const letter = statusOf(t);
        return (
          <div
            key={t.id}
            className={cn(
              'group shrink-0 flex items-center border-r border-ink-50/[0.06] transition',
              active ? 'bg-ink-950 shadow-[inset_0_2px_0_rgb(var(--ink-50))]' : 'hover:bg-ink-50/[0.03]'
            )}
          >
            <button
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              // Middle-click closes, as in every editor.
              onAuxClick={(e) => {
                if (e.button === 1) closeTab(t.id);
              }}
              title={t.kind === 'diff' ? `${t.path} — diff against HEAD` : t.path}
              className={cn(
                'h-full pl-3.5 pr-1 flex items-center gap-2 font-mono text-[12px] max-w-[260px]',
                active ? 'text-ink-50 font-medium' : 'text-faint group-hover:text-ink-100'
              )}
            >
              <span className="truncate">
                {base(t.path)}
                {t.kind === 'diff' && <span className="text-faint font-normal"> ↔ HEAD</span>}
              </span>
              {letter && (
                <span
                  className="font-semibold"
                  style={
                    letter === 'A'
                      ? { color: 'var(--diff-add-text)' }
                      : letter === 'D'
                        ? { color: 'var(--diff-del-text)' }
                        : undefined
                  }
                >
                  {letter}
                </span>
              )}
            </button>
            <button
              onClick={() => closeTab(t.id)}
              title="Close"
              aria-label={`Close ${base(t.path)}`}
              className={cn(
                'mr-1.5 w-5 h-5 grid place-items-center rounded text-faint hover:text-ink-50 hover:bg-elev',
                !active && 'opacity-0 group-hover:opacity-100 focus:opacity-100'
              )}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      <span className="flex-1" />
      {tabs.length > 1 && (
        <button
          onClick={closeAllTabs}
          className="shrink-0 px-3 text-[11.5px] text-faint hover:text-ink-100"
        >
          Close all
        </button>
      )}
    </div>
  );
}
