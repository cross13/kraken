import { useEffect } from 'react';
import { CommandBar } from './components/CommandBar';
import { ActivityBar } from './components/shell/ActivityBar';
import { SideBar } from './components/shell/SideBar';
import { EditorTabs } from './components/shell/EditorTabs';
import { StatusBar } from './components/shell/StatusBar';
import { BottomPanel } from './components/shell/BottomPanel';
import { FileViewer } from './components/views/FileViewer';
import { DiffEditor } from './components/views/DiffEditor';
import { OverlayPanel } from './components/OverlayPanel';
import { AssistantDrawer } from './components/AssistantDrawer';
import { ResizeHandle } from './components/ResizeHandle';
import { HomeView } from './components/views/HomeView';
import { QuickStart } from './components/views/QuickStart';
import { LearnView } from './components/views/LearnView';
import { SpecFlow } from './components/views/SpecFlow';
import { ActivitySurface } from './components/views/ActivitySurface';
import { LibrarySurface } from './components/views/LibrarySurface';
import { useWorkspace } from './stores/workspace';
import { useUi } from './stores/ui';
import { useOrchestrator } from './stores/orchestrator';
import { useGit } from './stores/git';

export default function App() {
  const restoreLast = useWorkspace((s) => s.restoreLast);
  const surface = useUi((s) => s.surface);
  const activeSpecId = useUi((s) => s.activeSpecId);
  const assistantOpen = useUi((s) => s.assistantOpen);
  const assistantWidth = useUi((s) => s.assistantWidth);
  const setAssistantWidth = useUi((s) => s.setAssistantWidth);
  const toggleAssistant = useUi((s) => s.toggleAssistant);
  const closeOverlay = useUi((s) => s.closeOverlay);
  const toggleExplorer = useUi((s) => s.toggleExplorer);
  const quickStartOpen = useUi((s) => s.quickStartOpen);
  const setQuickStart = useUi((s) => s.setQuickStart);
  const togglePanel = useUi((s) => s.togglePanel);
  const tabs = useUi((s) => s.tabs);
  const activeTabId = useUi((s) => s.activeTabId);
  const root = useWorkspace((s) => s.root);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  // A surface is on screen only while no editor tab is.
  const show = (name: typeof surface) => (activeTab === null && surface === name ? 'block' : 'none');

  // Restore the last workspace, then fade out the boot splash (index.html).
  // A short floor keeps the brand animation from flashing on fast boots.
  useEffect(() => {
    const shownAt = Date.now();
    Promise.resolve(restoreLast()).finally(() => {
      const splash = document.getElementById('boot-splash');
      if (!splash) return;
      const wait = Math.max(0, 900 - (Date.now() - shownAt));
      setTimeout(() => {
        splash.classList.add('done');
        setTimeout(() => splash.remove(), 400);
        // First launch only. Shown once and remembered, because an onboarding
        // screen that reappears is one people learn to dismiss without reading.
        try {
          if (!localStorage.getItem('octo.quickStartSeen')) {
            localStorage.setItem('octo.quickStartSeen', '1');
            useUi.getState().setQuickStart(true);
          }
        } catch {
          // storage disabled — skip the tour rather than fail the boot
        }
      }, wait);
    });
  }, [restoreLast]);

  // Global shortcuts: ⌘J assistant, ⌘⇧J runs panel, ⌘⇧E explorer, ⌘⇧F search, ⌘W closes
  // the editor tab, esc closes the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (e.shiftKey) togglePanel();
        else toggleAssistant();
      }
      // ⌘W closes the tab on screen — and only then swallows the key, so with
      // no tab open it keeps its native meaning.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'w') {
        const { activeTabId: id, closeTab } = useUi.getState();
        if (id) {
          e.preventDefault();
          closeTab(id);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        toggleExplorer();
      }
      // ⌘⇧F always lands in the search box, whatever the side bar was showing.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const ui = useUi.getState();
        if (!(ui.sideOpen && ui.sideView === 'search')) ui.showSide('search');
        window.dispatchEvent(new Event('octo:focus-search'));
      }
      // Quick Start and Zen own Escape themselves, on the capture phase.
      if (e.key === 'Escape') closeOverlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleAssistant, togglePanel, toggleExplorer, closeOverlay]);

  // Keep the working tree's change list fresh: on open, on a slow poll, when
  // the window regains focus (you committed in a terminal), and whenever a run
  // finishes (an agent just edited files).
  useEffect(() => {
    const refresh = () => void useGit.getState().refresh();
    refresh();
    const t = setInterval(refresh, 6000);
    window.addEventListener('focus', refresh);
    const unsub = useOrchestrator.subscribe((s, prev) => {
      if (s.log !== prev.log) refresh();
    });
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', refresh);
      unsub();
    };
  }, [root]);

  // Mirror the live run registry to the Travel Display (the wide second window).
  // The main window is authoritative; we push a serialized snapshot whenever the
  // registry changes (throttled) plus once on mount so a freshly-opened travel
  // window immediately shows what's already running.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const push = () => {
      const s = useOrchestrator.getState();
      window.octo.fleet.push({
        runs: Object.values(s.runs),
        maxConcurrency: s.maxConcurrency,
      });
    };
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        push();
      }, 250);
    };
    push();
    const unsub = useOrchestrator.subscribe((s, prev) => {
      if (s.runs !== prev.runs || s.maxConcurrency !== prev.maxConcurrency) schedule();
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);

  // Register every hook agent run in the orchestrator store so it shows up in
  // Activity and can be cancelled there. Hook runs are fired from the main
  // process, so this global listener is the only place they get registered on
  // the renderer side.
  useEffect(() => {
    const off = window.octo.hooks.onEvent((ev) => {
      const store = useOrchestrator.getState();
      if (ev.type === 'started') {
        store.startRun({
          requestId: ev.requestId,
          agent: null,
          source: `hook:${ev.hookId}`,
          specId: ev.specId ?? null,
          status: 'running',
          kind: 'hook',
          title: `Hook: ${ev.hookId} (${ev.trigger})`,
          startedAt: Date.now(),
        });
      } else {
        store.finishRun(ev.requestId, ev.type === 'done' ? 'done' : 'error');
      }
    });
    return () => {
      off();
    };
  }, []);

  return (
    // The frame (title bar, icon rail, canvas) is the darkest surface; the
    // working panels float on it with rounded corners + a hairline ring.
    <div className="h-full w-full flex flex-col bg-rail text-ink-100 font-sans">
      {/* Full-window, above everything, like Zen. */}
      {quickStartOpen && <QuickStart onClose={() => setQuickStart(false)} />}

      <CommandBar />
      <div className="flex-1 min-h-0 flex">
        <ActivityBar />

        <div className="flex-1 min-w-0 flex gap-1.5 pl-1.5 pr-2 pb-2">
          <SideBar />

          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            {/* The editor area: a tab strip over either the active surface or an
                editor tab. Surfaces are singletons and stay mounted
                (display-toggled) so terminals keep their PTYs and lists keep
                their scroll; the Spec flow mounts per spec; a file or diff tab
                mounts only while it is the one on screen. */}
            <main className="flex-1 min-h-0 flex flex-col rounded-xl ring-1 ring-ink-50/[0.07] bg-ink-950 overflow-hidden">
              <EditorTabs />
              <div className="flex-1 min-h-0 relative">
                <div className="absolute inset-0" style={{ display: show('home') }}>
                  <HomeView />
                </div>
                {activeSpecId && (
                  <div className="absolute inset-0" style={{ display: show('spec') }}>
                    <SpecFlow key={activeSpecId} specId={activeSpecId} />
                  </div>
                )}
                <div className="absolute inset-0" style={{ display: show('activity') }}>
                  <ActivitySurface />
                </div>
                <div className="absolute inset-0" style={{ display: show('library') }}>
                  <LibrarySurface />
                </div>
                <div className="absolute inset-0" style={{ display: show('learn') }}>
                  <LearnView />
                </div>
                {activeTab && (
                  <div className="absolute inset-0">
                    {activeTab.kind === 'file' ? (
                      <FileViewer
                        key={activeTab.id}
                        path={activeTab.path}
                        line={activeTab.line}
                        lineNonce={activeTab.nonce}
                      />
                    ) : (
                      <DiffEditor key={activeTab.id} path={activeTab.path} />
                    )}
                  </div>
                )}
              </div>
            </main>
            <BottomPanel />
          </div>

          {/* Assistant — the session panel (⌘J), context-scoped to the active spec */}
          {assistantOpen && (
            <>
              <ResizeHandle width={assistantWidth} side="left" onResize={setAssistantWidth} />
              <div
                className="shrink-0 rounded-xl ring-1 ring-ink-50/[0.07] bg-ink-950 overflow-hidden"
                style={{ width: assistantWidth }}
              >
                <AssistantDrawer />
              </div>
            </>
          )}
        </div>
      </div>
      <StatusBar />

      <OverlayPanel />
    </div>
  );
}
