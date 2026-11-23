import { Plus, Sparkles, SquareTerminal, X } from 'lucide-react';
import { useUi } from '../../stores/ui';
import { TerminalView } from './TerminalView';
import { cn } from '../../lib/cn';

/** Terminal list + always-mounted panes (unmounting would kill the PTY). */
export function TerminalsPane() {
  const terminals = useUi((s) => s.terminals);
  const activeTerminalId = useUi((s) => s.activeTerminalId);
  const setActiveTerminal = useUi((s) => s.setActiveTerminal);
  const closeTerminal = useUi((s) => s.closeTerminal);
  const addTerminal = useUi((s) => s.addTerminal);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 px-4 py-2 shrink-0 overflow-x-auto">
        {terminals.map((t) => (
          <div
            key={t.id}
            onClick={() => setActiveTerminal(t.id)}
            className={cn(
              'group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[12px] shrink-0 transition',
              t.id === activeTerminalId
                ? 'bg-elev text-ink-50'
                : 'text-ink-300 hover:bg-elev/60'
            )}
          >
            {t.profile === 'claude' ? (
              <Sparkles size={13} className="text-accent shrink-0" />
            ) : (
              <SquareTerminal size={13} className="shrink-0" />
            )}
            <span>{t.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(t.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-ink-100"
              title="Close terminal"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={() => addTerminal('shell')}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] text-dim hover:text-ink-50 hover:bg-elev transition shrink-0"
        >
          <Plus size={13} /> Terminal
        </button>
        <button
          onClick={() => addTerminal('claude')}
          title="Run the interactive Claude CLI — answer its questions, run slash commands"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] text-dim hover:text-accent hover:bg-elev transition shrink-0"
        >
          <Sparkles size={13} /> Claude session
        </button>
      </div>
      <div className="flex-1 min-h-0 relative">
        {terminals.length === 0 ? (
          <p className="px-6 py-6 text-xs text-ink-500 leading-relaxed max-w-md">
            No terminals open. Start a <b className="text-ink-300">Claude session</b> to run the
            interactive CLI — answer its questions, approve permissions, run slash commands —
            or a plain shell.
          </p>
        ) : (
          terminals.map((t) => (
            <div
              key={t.id}
              className="absolute inset-0"
              style={{ display: t.id === activeTerminalId ? 'block' : 'none' }}
            >
              <TerminalView tabId={t.id} profile={t.profile} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
