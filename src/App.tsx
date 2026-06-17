import { useEffect } from 'react';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { EditorArea } from './components/EditorArea';
import { ChatPanel } from './components/ChatPanel';
import { StatusBar } from './components/StatusBar';
import { TitleBar } from './components/TitleBar';
import { ResizeHandle } from './components/ResizeHandle';
import { useWorkspace } from './stores/workspace';
import { useUi } from './stores/ui';
import { useOrchestrator } from './stores/orchestrator';

export default function App() {
  const restoreLast = useWorkspace((s) => s.restoreLast);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const chatOpen = useUi((s) => s.chatOpen);
  const sidebarWidth = useUi((s) => s.sidebarWidth);
  const setSidebarWidth = useUi((s) => s.setSidebarWidth);
  const chatWidth = useUi((s) => s.chatWidth);
  const setChatWidth = useUi((s) => s.setChatWidth);

  useEffect(() => {
    restoreLast();
  }, [restoreLast]);

  // Register every hook agent run in the orchestrator store so it shows up in
  // the Orchestrator dashboard + Agent Graph and can be cancelled there. Hook
  // runs are fired from the main process, so this global listener is the only
  // place they get registered on the renderer side.
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
    <div className="h-full w-full flex flex-col bg-ink-950 text-ink-100">
      <TitleBar />
      <div className="flex-1 min-h-0 flex">
        <ActivityBar />

        {sidebarOpen && (
          <>
            <div
              className="border-r border-ink-800 bg-ink-900/40 shrink-0"
              style={{ width: sidebarWidth }}
            >
              <Sidebar />
            </div>
            <ResizeHandle width={sidebarWidth} side="right" onResize={setSidebarWidth} />
          </>
        )}

        <main className="flex-1 min-w-0 flex flex-col">
          <EditorArea />
        </main>

        {chatOpen && (
          <>
            <ResizeHandle width={chatWidth} side="left" onResize={setChatWidth} />
            <div
              className="border-l border-ink-800 bg-ink-900/40 shrink-0"
              style={{ width: chatWidth }}
            >
              <ChatPanel />
            </div>
          </>
        )}
      </div>
      <StatusBar />
    </div>
  );
}
