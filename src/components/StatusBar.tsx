import { useEffect, useState } from 'react';
import {
  Check,
  AlertCircle,
  Cpu,
  FolderGit2,
  Terminal,
  Cloud,
  GitBranch,
  Loader2,
} from 'lucide-react';
import { useWorkspace } from '../stores/workspace';
import { useUi } from '../stores/ui';
import { useChat } from '../stores/chat';
import { useOrchestrator } from '../stores/orchestrator';

export function StatusBar() {
  const root = useWorkspace((s) => s.root);
  const specs = useWorkspace((s) => s.specs);
  const setActivity = useUi((s) => s.setActivity);
  const busy = useChat((s) => s.busy);
  const running = useOrchestrator(
    (s) =>
      Object.values(s.runs).filter(
        (r) => r.status === 'running' || r.status === 'queued'
      ).length
  );
  const [hasKey, setHasKey] = useState(false);
  const [model, setModel] = useState('');
  const [backend, setBackend] = useState<'cli' | 'api'>('cli');
  const [cliFound, setCliFound] = useState(false);
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    window.kraken.settings.hasApiKey().then(setHasKey);
    window.kraken.settings.getModel().then(setModel);
    window.kraken.settings.getBackend().then(setBackend);
    window.kraken.cli.detect().then((s) => setCliFound(s.found));
  }, [busy]);

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
  }, [root, busy]);

  const projectName = root ? root.split('/').filter(Boolean).pop() : null;

  return (
    <footer className="h-6 px-3 border-t border-ink-800 bg-ink-950 flex items-center justify-between text-[10px] text-ink-400">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActivity('settings')}
          title={root ? `${root}\nClick to change project directory` : 'Open a project'}
          className="flex items-center gap-1 hover:text-ink-100 transition"
        >
          <FolderGit2 size={10} />
          {projectName ?? 'No project'}
        </button>
        {branch && (
          <>
            <span className="text-ink-700">·</span>
            <button
              onClick={() => setActivity('source-control')}
              title="Branch — click to open Source Control"
              className="flex items-center gap-1 hover:text-ink-100 transition"
            >
              <GitBranch size={10} />
              <span className="font-mono">{branch}</span>
            </button>
          </>
        )}
        <span className="text-ink-700">·</span>
        <span>{specs.length} spec{specs.length === 1 ? '' : 's'}</span>
      </div>
      <div className="flex items-center gap-3">
        {running > 0 && (
          <button
            onClick={() => setActivity('orchestrator')}
            title="Open the Orchestrator"
            className="flex items-center gap-1 text-accent hover:text-accent/80 transition"
          >
            <Loader2 size={10} className="animate-spin" />
            {running} agent{running === 1 ? '' : 's'}
          </button>
        )}
        <span className="flex items-center gap-1">
          <Cpu size={10} />
          {model || 'claude'}
        </span>
        {backend === 'cli' ? (
          <span className="flex items-center gap-1">
            <Terminal size={10} />
            {cliFound ? (
              <span className="text-ok">local CLI</span>
            ) : (
              <span className="text-warn">CLI missing</span>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Cloud size={10} />
            {hasKey ? (
              <>
                <Check size={10} className="text-ok" /> API key
              </>
            ) : (
              <>
                <AlertCircle size={10} className="text-warn" /> No API key
              </>
            )}
          </span>
        )}
      </div>
    </footer>
  );
}
