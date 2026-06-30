import { useEffect } from 'react';
import { CommandBar } from './components/CommandBar';
import { SpecRail } from './components/SpecRail';
import { EditorArea } from './components/EditorArea';
import { ActivityStream } from './components/ActivityStream';
import { ResizeHandle } from './components/ResizeHandle';
import { useWorkspace } from './stores/workspace';
import { useUi } from './stores/ui';
import { useOrchestrator } from './stores/orchestrator';

export default function App() {
  const restoreLast = useWorkspace((s) => s.restoreLast);
  const chatOpen = useUi((s) => s.chatOpen);
  const sidebarWidth = useUi((s) => s.sidebarWidth);
  const setSidebarWidth = useUi((s) => s.setSidebarWidth);
  const chatWidth = useUi((s) => s.chatWidth);
  const setChatWidth = useUi((s) => s.setChatWidth);

  useEffect(() => {
    restoreLast();
  }, [restoreLast]);

  // Register every hook agent run in the orchestrator store so it shows up in
  // the activity stream + Orchestrator and can be cancelled there. Hook runs are
  // fired from the main process, so this global listener is the only place they
  // get registered on the renderer side.
  useEffect(() => {
    const off = window.kraken.hooks.onEvent((ev) => {
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
    <div className="h-full w-full flex flex-col bg-ink-950 text-ink-100 font-sans">
      <CommandBar />
      <div className="flex-1 min-h-0 flex">
        {/* Spec rail — the Mission Control left rail (nav + active spec) */}
        <div className="shrink-0" style={{ width: sidebarWidth }}>
          <SpecRail />
        </div>
        <ResizeHandle width={sidebarWidth} side="right" onResize={setSidebarWidth} />

        {/* Main stage — tabbed runner / editor */}
        <main className="flex-1 min-w-0 flex flex-col">
          <EditorArea />
        </main>

        {/* Activity stream — fused live agents + chat */}
        {chatOpen && (
          <>
            <ResizeHandle width={chatWidth} side="left" onResize={setChatWidth} />
            <div className="shrink-0" style={{ width: chatWidth }}>
              <ActivityStream />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
