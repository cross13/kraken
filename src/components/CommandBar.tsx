import { useEffect, useState } from 'react';
import {
  Command,
  GitBranch,
  Cpu,
  Terminal,
  Cloud,
  Check,
  AlertCircle,
  Contrast,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
} from 'lucide-react';
import { useUi } from '../stores/ui';
import { useWorkspace } from '../stores/workspace';
import { useOrchestrator } from '../stores/orchestrator';
import { useTheme, THEME_LABEL } from '../stores/theme';
import { KrakenLogo } from './KrakenLogo';
import { CommandPalette } from './CommandPalette';
import { cn } from '../lib/cn';

/**
 * Mission Control top bar — the command spine of the app. Replaces the old
 * TitleBar + StatusBar: brand, a ⌘K command-palette trigger, a live agent
 * indicator, and the workspace/model/backend status, all in one row.
 */
export function CommandBar() {
  const root = useWorkspace((s) => s.root);
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);
  const setActivity = useUi((s) => s.setActivity);
  const openTab = useUi((s) => s.openTab);
  const toggleChat = useUi((s) => s.toggleChat);
  const chatOpen = useUi((s) => s.chatOpen);
  const focusMode = useUi((s) => s.focusMode);
  const toggleFocus = useUi((s) => s.toggleFocus);
  const openSourceControl = () =>
    openTab({ id: 'source-control', title: 'Source Control', kind: 'source-control' });
  const theme = useTheme((s) => s.theme);
  const cycleTheme = useTheme((s) => s.cycleTheme);

  const running = useOrchestrator(
    (s) =>
      Object.values(s.runs).filter((r) => r.status === 'running' || r.status === 'queued').length
  );

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [branch, setBranch] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [backend, setBackend] = useState<'cli' | 'api'>('cli');
  const [cliFound, setCliFound] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  // ⌘K / Ctrl-K opens the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.kraken.settings.getModel().then(setModel);
    window.kraken.settings.getBackend().then(setBackend);
    window.kraken.settings.hasApiKey().then(setHasKey);
    window.kraken.cli.detect().then((s) => setCliFound(s.found));
  }, []);

  useEffect(() => {
    if (!root) {
      setBranch(null);
      return;
    }
    const read = () =>
      window.kraken.git
        .status(root)
        .then((s) => setBranch(s.isRepo ? s.branch : null))
        .catch(() => setBranch(null));
    read();
    const t = setInterval(read, 5000);
    return () => clearInterval(t);
  }, [root]);

  const workspaceName = root ? root.split('/').filter(Boolean).pop() : 'No workspace';

  return (
    <>
      <header className="titlebar-drag flex items-center gap-4 h-[52px] px-4 bg-rail shrink-0">
        {/* brand */}
        <div className="flex items-center gap-2.5 pl-16">
          <div className="w-7 h-7 grid place-items-center rounded-[8px] bg-accent text-accent-fg shadow-glow">
            <KrakenLogo className="w-4 h-4" />
          </div>
          <span className="font-display text-[16px] font-bold tracking-tight text-ink-50">
            Kraken
          </span>
        </div>

        {/* command palette trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="titlebar-nodrag flex-1 max-w-[520px] flex items-center gap-2.5 bg-ink-50/[0.04] rounded-[10px] px-3.5 py-2 text-[13px] text-faint hover:bg-ink-50/[0.07] hover:text-dim transition"
          title="Open command palette"
        >
          <Command size={13} />
          <span>Jump to spec, task, or run a command…</span>
          <kbd className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded bg-elev text-faint">
            ⌘K
          </kbd>
        </button>

        <div className="flex-1" />

        {/* live agent indicator */}
        <button
          onClick={() => setActivity('orchestrator')}
          title="Open the Orchestrator"
          className={cn(
            'titlebar-nodrag flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-[12px] transition',
            running > 0
              ? 'bg-accent/10 text-accent'
              : 'bg-ink-50/[0.04] text-dim hover:text-ink-100'
          )}
        >
          <span
            className={cn(
              'w-[7px] h-[7px] rounded-full',
              running > 0 ? 'bg-accent animate-pulse-dot' : 'bg-good'
            )}
          />
          {running > 0 ? `${running} agent${running === 1 ? '' : 's'} running` : 'idle'}
        </button>

        {/* project · branch */}
        <button
          onClick={() => (root ? openSourceControl() : pickWorkspace())}
          title={root ? `${root}\nClick to open Source Control` : 'Open a project'}
          className="titlebar-nodrag flex items-center gap-1.5 font-mono text-[12px] text-faint hover:text-ink-100 transition max-w-[260px]"
        >
          <span className="text-dim truncate">{workspaceName}</span>
          {branch && (
            <>
              <span className="text-ink-700">·</span>
              <GitBranch size={12} className="shrink-0" />
              <span className="truncate">{branch}</span>
            </>
          )}
        </button>

        <span className="text-ink-700">·</span>

        {/* model + backend */}
        <button
          onClick={() => openTab({ id: 'settings', title: 'Settings', kind: 'settings' })}
          title="Open Settings"
          className="titlebar-nodrag flex items-center gap-2 font-mono text-[12px] text-faint hover:text-ink-100 transition"
        >
          <Cpu size={12} />
          <span>{model || 'claude'}</span>
          {backend === 'cli' ? (
            <Terminal size={12} className={cliFound ? 'text-good' : 'text-warn'} />
          ) : hasKey ? (
            <Check size={12} className="text-good" />
          ) : (
            <Cloud size={12} className="text-warn" />
          )}
        </button>

        {/* controls */}
        <div className="titlebar-nodrag flex items-center gap-1">
          <IconButton onClick={cycleTheme} title={`Theme: ${THEME_LABEL[theme]}`}>
            <Contrast size={15} />
          </IconButton>
          <IconButton
            active={focusMode}
            onClick={toggleFocus}
            title={focusMode ? 'Exit focus — show rail + activity' : 'Focus mode — hide rail + activity'}
          >
            {focusMode ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </IconButton>
          {!focusMode && (
            <IconButton active={chatOpen} onClick={toggleChat} title="Toggle activity stream">
              <Activity size={15} />
            </IconButton>
          )}
        </div>
      </header>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}

function IconButton({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'w-8 h-8 grid place-items-center rounded-lg transition',
        active ? 'text-accent bg-accent/10' : 'text-faint hover:text-ink-100 hover:bg-elev'
      )}
    >
      {children}
    </button>
  );
}
