import { spawn, type IPty } from 'node-pty';
import { createRequire } from 'node:module';
import { chmodSync, existsSync } from 'node:fs';
import path from 'node:path';

// node-pty ships an N-API prebuilt binary (ABI-stable across Node and Electron),
// so no from-source rebuild is required. On macOS/Linux the prebuilt `spawn-helper`
// is occasionally extracted without its executable bit, which makes every spawn fail
// with `posix_spawnp failed`. Restore it once, best-effort, at module load.
function ensureSpawnHelperExecutable() {
  if (process.platform === 'win32') return;
  try {
    const require = createRequire(import.meta.url);
    const pkg = require.resolve('node-pty/package.json');
    const helper = path.join(
      path.dirname(pkg),
      'prebuilds',
      `${process.platform}-${process.arch}`,
      'spawn-helper'
    );
    if (existsSync(helper)) chmodSync(helper, 0o755);
  } catch {
    // Packaged path differs (asar.unpacked) or module layout changed — ignore.
  }
}
ensureSpawnHelperExecutable();

export interface TerminalSpawnOpts {
  termId: string;
  file: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  cols: number;
  rows: number;
}

export interface TerminalExit {
  exitCode: number;
  signal?: number;
}

/**
 * Owns the live PTY processes keyed by `termId`. The main process resolves the
 * command/env policy (shell vs. `claude`, expanded PATH) and wires `onData`/`onExit`
 * to the renderer over IPC; this class only manages process lifecycle.
 */
export class TerminalManager {
  private terms = new Map<string, IPty>();

  create(
    opts: TerminalSpawnOpts,
    onData: (data: string) => void,
    onExit: (e: TerminalExit) => void
  ): { pid: number } {
    // Replace any existing terminal with the same id (defensive — ids are unique).
    this.kill(opts.termId);
    const term = spawn(opts.file, opts.args, {
      name: 'xterm-256color',
      cols: Math.max(2, opts.cols || 80),
      rows: Math.max(1, opts.rows || 24),
      cwd: opts.cwd,
      env: opts.env as { [key: string]: string },
    });
    this.terms.set(opts.termId, term);
    term.onData(onData);
    term.onExit(({ exitCode, signal }) => {
      this.terms.delete(opts.termId);
      onExit({ exitCode, signal });
    });
    return { pid: term.pid };
  }

  write(termId: string, data: string) {
    this.terms.get(termId)?.write(data);
  }

  resize(termId: string, cols: number, rows: number) {
    const term = this.terms.get(termId);
    if (!term) return;
    try {
      term.resize(Math.max(2, cols), Math.max(1, rows));
    } catch {
      // Resizing a terminal that just exited throws — harmless.
    }
  }

  kill(termId: string) {
    const term = this.terms.get(termId);
    if (!term) return;
    this.terms.delete(termId);
    try {
      term.kill();
    } catch {
      // Already gone.
    }
  }

  killAll() {
    for (const id of [...this.terms.keys()]) this.kill(id);
  }

  has(termId: string) {
    return this.terms.has(termId);
  }
}
