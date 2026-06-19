import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useWorkspace } from '../../stores/workspace';

// Theme tuned to match the app's ink palette (see tailwind.config / index.css).
const THEME = {
  background: '#0c0e16',
  foreground: '#d7dceb',
  cursor: '#7c93ff',
  cursorAccent: '#0c0e16',
  selectionBackground: '#2a3158',
  black: '#0c0e16',
  brightBlack: '#4b5275',
};

export function TerminalView({
  tabId,
  profile,
}: {
  tabId: string;
  profile: 'shell' | 'claude';
}) {
  const root = useWorkspace((s) => s.root);
  const hostRef = useRef<HTMLDivElement>(null);
  // Latest root without re-running the mount effect (the PTY's cwd is fixed at
  // creation; we only read root once).
  const rootRef = useRef(root);
  rootRef.current = root;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      fontSize: 12.5,
      cursorBlink: true,
      theme: THEME,
      scrollback: 5000,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    // Clicking a URL Claude emits opens it in Chrome via the main process.
    term.loadAddon(
      new WebLinksAddon((_e, uri) => {
        void window.kraken.shell.openUrl(uri);
      })
    );
    term.open(host);

    const safeFit = () => {
      try {
        fit.fit();
      } catch {
        // Host not laid out yet — ignore.
      }
    };
    safeFit();
    term.focus();

    // Renderer → PTY keystrokes.
    const inputDisposable = term.onData((data) => {
      window.kraken.terminal.write(tabId, data);
    });

    // PTY → renderer output.
    const offData = window.kraken.terminal.onData((ev) => {
      if (ev.termId === tabId) term.write(ev.data);
    });
    const offExit = window.kraken.terminal.onExit((ev) => {
      if (ev.termId !== tabId) return;
      term.write(`\r\n\x1b[2m[process exited${ev.exitCode ? ` (code ${ev.exitCode})` : ''}]\x1b[0m\r\n`);
    });

    // Keep the PTY size in sync with the panel.
    const ro = new ResizeObserver(() => {
      safeFit();
      window.kraken.terminal.resize(tabId, term.cols, term.rows);
    });
    ro.observe(host);

    window.kraken.terminal
      .create({
        termId: tabId,
        cwd: rootRef.current,
        cols: term.cols,
        rows: term.rows,
        profile,
      })
      .then((res) => {
        if (!res.ok) {
          term.write(`\r\n\x1b[31mFailed to start terminal: ${res.error ?? 'unknown error'}\x1b[0m\r\n`);
        }
      })
      .catch((err) => {
        term.write(`\r\n\x1b[31mFailed to start terminal: ${String(err)}\x1b[0m\r\n`);
      });

    return () => {
      ro.disconnect();
      inputDisposable.dispose();
      offData();
      offExit();
      window.kraken.terminal.kill(tabId);
      term.dispose();
    };
  }, [tabId, profile]);

  return <div ref={hostRef} className="h-full w-full bg-ink-950 p-2 overflow-hidden" />;
}
