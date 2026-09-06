import { useEffect, useState } from 'react';
import {
  Search,
  GitBranch,
  Cpu,
  Terminal,
  Cloud,
  Check,
  Contrast,
  MessageSquare,
  MonitorSmartphone,
} from 'lucide-react';
import { useUi } from '../stores/ui';
import { useWorkspace } from '../stores/workspace';
import { useOrchestrator } from '../stores/orchestrator';
import { useTheme, THEME_LABEL } from '../stores/theme';
import { CommandPalette } from './CommandPalette';
import { cn } from '../lib/cn';

/**
 * The title bar — part of the dark app frame. A centered project pill opens
 * the ⌘K palette (Kiro-style); the right side keeps the compact status
 * controls: the single live-runs pill, branch (repo drawer), model/backend
 * (Settings), theme, and the Assistant toggle.
 */
export function CommandBar() {
  const root = useWorkspace((s) => s.root);
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);
  const openActivity = useUi((s) => s.openActivity);
  const openLibrary = useUi((s) => s.openLibrary);
  const openOverlay = useUi((s) => s.openOverlay);
  const toggleAssistant = useUi((s) => s.toggleAssistant);
  const assistantOpen = useUi((s) => s.assistantOpen);
  const theme = useTheme((s) => s.theme);
  const cycleTheme = useTheme((s) => s.cycleTheme);

  const running = useOrchestrator(
    (s) =>
      Object.values(s.runs).filter((r) => r.status === 'running' || r.status === 'queued').length
  );

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [wideOpen, setWideOpen] = useState(false);
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
    window.octo.settings.getModel().then(setModel);
    window.octo.settings.getBackend().then(setBackend);
    window.octo.settings.hasApiKey().then(setHasKey);
    window.octo.cli.detect().then((s) => setCliFound(s.found));
  }, []);

  // Reflect whether the Travel Display (wide second window) is currently open.
  useEffect(() => {
    window.octo.win.isWideOpen().then(setWideOpen);
    return window.octo.win.onWideState((s) => setWideOpen(s.open));
  }, []);

  useEffect(() => {
    if (!root) {
      setBranch(null);
      return;
    }
    const read = () =>
      window.octo.git
        .status(root)
        .then((s) => setBranch(s.isRepo ? s.branch : null))
        .catch(() => setBranch(null));
    read();
    const t = setInterval(read, 5000);
    return () => clearInterval(t);
  }, [root]);

  const workspaceName = root ? root.split('/').filter(Boolean).pop() : null;

  return (
    <>
      <header className="titlebar-drag relative flex items-center h-[52px] px-4 shrink-0">
        {/* left: room for the macOS traffic lights */}
        <div className="w-20 shrink-0" />

        {/* centered project pill — the ⌘K front door */}
        <div className="absolute left-1/2 -translate-x-1/2 titlebar-nodrag">
          <button
            onClick={() => (workspaceName ? setPaletteOpen(true) : pickWorkspace())}
            title={root ? `${root}\n⌘K — jump to a spec or run a command` : 'Open a project'}
            className="flex items-center justify-center gap-2 w-[380px] max-w-[44vw] h-[34px] rounded-[10px] bg-ink-50/[0.05] ring-1 ring-ink-50/[0.05] text-[13px] text-dim hover:bg-ink-50/[0.08] hover:text-ink-100 transition"
          >
            <Search size={13} className="text-faint" />
            <span className="truncate">{workspaceName ?? 'Open a project…'}</span>
          </button>
        </div>

        <div className="flex-1" />

        {/* right: compact status controls */}
        <div className="titlebar-nodrag flex items-center gap-1.5">
          {running > 0 && (
            <button
              onClick={() => openActivity('runs')}
              title="Open Activity"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11.5px] bg-accent/10 text-accent transition"
            >
              <span className="w-[7px] h-[7px] rounded-full bg-accent animate-pulse-dot" />
              {running}
            </button>
          )}
          {branch && (
            <button
              onClick={() => openOverlay({ kind: 'repo' })}
              title={`${branch} — open the repository panel`}
              className="flex items-center gap-1.5 font-mono text-[11.5px] text-faint hover:text-ink-100 px-2 py-1.5 rounded-lg hover:bg-ink-50/[0.06] transition max-w-[180px]"
            >
              <GitBranch size={12} className="shrink-0" />
              <span className="truncate">{branch}</span>
            </button>
          )}
          <button
            onClick={() => openLibrary('settings')}
            title="Open Settings"
            className="flex items-center gap-1.5 font-mono text-[11.5px] text-faint hover:text-ink-100 px-2 py-1.5 rounded-lg hover:bg-ink-50/[0.06] transition"
          >
            <Cpu size={12} />
            <span className="max-w-[120px] truncate">{model || 'claude'}</span>
            {backend === 'cli' ? (
              <Terminal size={11} className={cliFound ? 'text-good' : 'text-warn'} />
            ) : hasKey ? (
              <Check size={11} className="text-good" />
            ) : (
              <Cloud size={11} className="text-warn" />
            )}
          </button>
          <IconButton
            active={wideOpen}
            onClick={() => window.octo.win.toggleWide()}
            title="Travel Display — a wide run monitor for a second screen"
          >
            <MonitorSmartphone size={15} />
          </IconButton>
          <IconButton onClick={cycleTheme} title={`Theme: ${THEME_LABEL[theme]}`}>
            <Contrast size={15} />
          </IconButton>
          <IconButton
            active={assistantOpen}
            onClick={toggleAssistant}
            title="Toggle the Assistant (⌘J)"
          >
            <MessageSquare size={15} />
          </IconButton>
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
        active ? 'text-accent bg-accent/12' : 'text-faint hover:text-ink-100 hover:bg-ink-50/[0.06]'
      )}
    >
      {children}
    </button>
  );
}
