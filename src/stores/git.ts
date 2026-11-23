import { create } from 'zustand';
import { useWorkspace } from './workspace';
import type { FileAuthor } from '../../electron/shared/types';

/** One row of `git status`, with line counts against HEAD when git has them. */
export type ChangedFile = Awaited<
  ReturnType<typeof window.octo.git.listChanges>
>['files'][number];

/**
 * The working tree as the shell sees it: the branch and the files that differ
 * from HEAD. One store so the activity-bar badge, the Changes side view, the
 * Explorer's decorations and the status bar can never disagree about what
 * changed — they used to each ask git on their own schedule.
 */
interface GitStore {
  isRepo: boolean;
  branch: string | null;
  files: ChangedFile[];
  /**
   * The run that last wrote each changed file, by repository-relative path —
   * only when that run is newer than HEAD. A file committed after its run and
   * then edited by hand is yours, not the run's.
   */
  authors: Record<string, FileAuthor>;
  error: string | null;
  refresh: () => Promise<void>;
}

function authorsOf(
  root: string,
  files: ChangedFile[],
  written: FileAuthor[],
  headAt?: string
): Record<string, FileAuthor> {
  const changed = new Set(files.map((f) => f.path));
  const since = headAt ? Date.parse(headAt) : 0;
  const out: Record<string, FileAuthor> = {};
  for (const a of written) {
    // Tool calls name files absolutely; git names them from the repository.
    const rel = a.path.startsWith(`${root}/`) ? a.path.slice(root.length + 1) : a.path;
    if (!changed.has(rel) || Date.parse(a.last_at) < since) continue;
    const prev = out[rel];
    if (!prev || prev.last_at < a.last_at) out[rel] = a;
  }
  return out;
}

let inflight: Promise<void> | null = null;

export const useGit = create<GitStore>((set) => ({
  isRepo: false,
  branch: null,
  files: [],
  authors: {},
  error: null,
  refresh: () => {
    // Callers are a poll, a focus listener and a dozen buttons: collapse them.
    if (inflight) return inflight;
    const root = useWorkspace.getState().root;
    if (!root) {
      set({ isRepo: false, branch: null, files: [], authors: {}, error: null });
      return Promise.resolve();
    }
    inflight = (async () => {
      try {
        const [status, changes, written] = await Promise.all([
          window.octo.git.status(root),
          window.octo.git.listChanges(root),
          // History is a mirror, never a dependency: without it the list is
          // simply ungrouped.
          window.octo.history.fileAuthors(root).catch(() => [] as FileAuthor[]),
        ]);
        // The workspace may have changed while git was running.
        if (useWorkspace.getState().root !== root) return;
        set({
          isRepo: status.isRepo,
          branch: status.isRepo ? status.branch : null,
          files: changes.ok ? changes.files : [],
          authors: changes.ok ? authorsOf(root, changes.files, written, changes.headAt) : {},
          error: changes.ok ? null : (changes.error ?? null),
        });
      } catch (e) {
        set({ error: String(e) });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },
}));

/** Single-letter status for a file row: A(dded) · M(odified) · D(eleted). */
export function statusLetter(f: ChangedFile): 'A' | 'M' | 'D' {
  if (f.untracked || f.status.includes('A')) return 'A';
  if (f.status.includes('D')) return 'D';
  return 'M';
}
