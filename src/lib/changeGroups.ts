import type { FileAuthor, SpecMeta } from '../../electron/shared/types';
import type { ChangedFile } from '../stores/git';

/**
 * The working tree grouped by **what produced each change**. A group is one
 * task of one spec (`T3`), one non-task run of a spec (a plan draft, a review
 * fix), an Assistant run, or — last, always — the files no run is known to
 * have written. Attribution is file-level and last-writer-wins (see
 * `FileAuthor`): it answers "which run touched this file most recently", which
 * is the question a reviewer has when a file shows up changed.
 */
export interface ChangeGroup {
  key: string;
  /** mono id shown first: `T3`, or empty */
  id: string;
  title: string;
  /** who ran it, when a run did */
  agent: string | null;
  /** the most recent run in the group — what "View run" opens */
  runId: string | null;
  specId: string | null;
  files: ChangedFile[];
}

/** `specId → taskId → description`, read from each spec's tasks.md. */
export type TaskTitles = Record<string, Record<string, string>>;

const KIND_LABEL: Record<string, string> = {
  task: 'Task run',
  refine: 'Refine',
  polish: 'Polish',
  review: 'Code review',
  hook: 'Hook',
  chat: 'Assistant',
};

export function groupByTask(
  files: ChangedFile[],
  authors: Record<string, FileAuthor>,
  specs: SpecMeta[],
  titles: TaskTitles
): ChangeGroup[] {
  const groups = new Map<string, ChangeGroup & { at: string }>();
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const a = authors[f.path];
    const spec = a?.spec_id ? specs.find((s) => s.id === a.spec_id) : undefined;
    const specName = spec ? spec.name || spec.id : (a?.spec_id ?? null);
    let key = '';
    let id = '';
    let title = 'Edited by hand';
    if (a?.task_id && a.spec_id) {
      key = `task:${a.spec_id}:${a.task_id}`;
      id = a.task_id;
      title = titles[a.spec_id]?.[a.task_id] ?? specName ?? a.task_id;
    } else if (a?.spec_id) {
      const what = KIND_LABEL[a.kind ?? ''] ?? a.kind ?? a.source;
      key = `spec:${a.spec_id}:${what}`;
      title = `${specName} · ${what}`;
    } else if (a) {
      const what = KIND_LABEL[a.kind ?? ''] ?? (a.source === 'chat' ? 'Assistant' : (a.kind ?? a.source));
      key = `run:${what}`;
      title = what;
    }
    const g = groups.get(key) ?? {
      key,
      id,
      title,
      agent: a?.agent ?? null,
      runId: a?.run_id ?? null,
      specId: a?.spec_id ?? null,
      files: [],
      at: a?.last_at ?? '',
    };
    g.files.push(f);
    if (a && a.last_at > g.at) {
      g.at = a.last_at;
      g.runId = a.run_id;
      g.agent = a.agent ?? g.agent;
    }
    groups.set(key, g);
  }
  // Runs first, most recent on top; hand edits last.
  return [...groups.values()].sort((x, y) =>
    x.key === '' ? 1 : y.key === '' ? -1 : y.at.localeCompare(x.at)
  );
}

export function groupByFolder(files: ChangedFile[]): ChangeGroup[] {
  const by = new Map<string, ChangedFile[]>();
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const i = f.path.lastIndexOf('/');
    const dir = i === -1 ? '/' : f.path.slice(0, i);
    by.set(dir, [...(by.get(dir) ?? []), f]);
  }
  return [...by.entries()].map(([dir, list]) => ({
    key: dir,
    id: '',
    title: dir,
    agent: null,
    runId: null,
    specId: null,
    files: list,
  }));
}
