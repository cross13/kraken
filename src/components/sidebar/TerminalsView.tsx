import { Plus, SquareTerminal, Sparkles, X } from 'lucide-react';
import { useUi } from '../../stores/ui';
import { useWorkspace } from '../../stores/workspace';
import { cn } from '../../lib/cn';

export function TerminalsView() {
  const tabs = useUi((s) => s.tabs);
  const activeTabId = useUi((s) => s.activeTabId);
  const openTab = useUi((s) => s.openTab);
  const setActiveTab = useUi((s) => s.setActiveTab);
  const closeTab = useUi((s) => s.closeTab);
  const root = useWorkspace((s) => s.root);

  const terminals = tabs.filter((t) => t.kind === 'terminal');

  const newTerminal = (profile: 'shell' | 'claude') => {
    const n = terminals.length + 1;
    const id = `term-${crypto.randomUUID()}`;
    openTab({
      id,
      kind: 'terminal',
      title: profile === 'claude' ? `Claude ${n}` : `Terminal ${n}`,
      termProfile: profile,
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2.5 border-b border-ink-800 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          Terminals
        </span>
      </div>

      <div className="p-2 flex flex-col gap-1.5 border-b border-ink-800">
        <button
          onClick={() => newTerminal('shell')}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-ink-200 bg-ink-800/50 hover:bg-ink-800 transition"
        >
          <Plus size={14} /> New Terminal
        </button>
        <button
          onClick={() => newTerminal('claude')}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-ink-200 bg-ink-800/50 hover:bg-ink-800 transition"
          title="Run the interactive Claude CLI"
        >
          <Sparkles size={14} /> New Claude Session
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-1">
        {terminals.length === 0 ? (
          <p className="px-2 py-3 text-xs text-ink-500 leading-relaxed">
            No terminals open. Start one to run <code>claude</code> interactively —
            answer its questions, run slash commands, anything you'd do in a real
            terminal.
            {!root && (
              <>
                {' '}
                <span className="text-ink-400">Open a workspace to set the working directory.</span>
              </>
            )}
          </p>
        ) : (
          terminals.map((t) => (
            <div
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs',
                t.id === activeTabId
                  ? 'bg-ink-800/70 text-ink-50'
                  : 'text-ink-300 hover:bg-ink-800/40'
              )}
            >
              {t.termProfile === 'claude' ? (
                <Sparkles size={14} className="shrink-0 text-accent" />
              ) : (
                <SquareTerminal size={14} className="shrink-0" />
              )}
              <span className="truncate flex-1">{t.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-ink-100"
                title="Close terminal"
              >
                <X size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
