import { useEffect, useState, useCallback } from 'react';
import {
  PartyPopper,
  FilePlus2,
  FilePen,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useOrchestrator } from '../../stores/orchestrator';
import { renderMarkdown } from '../../lib/markdown';
import { cn } from '../../lib/cn';
import type { SpecMeta, SpecFileChange } from '../../../electron/shared/types';

/**
 * Shown when every task in a spec is done: a recap of all files changed across
 * the spec's runs (captured in run_files) plus a brief, AI-generated description
 * of the completed work. The description is persisted to `<spec>/summary.md`.
 */
export function CompletionSummary({ meta, specRel }: { meta: SpecMeta; specRel: string }) {
  const root = useWorkspace((s) => s.root);
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);

  const [files, setFiles] = useState<SpecFileChange[]>([]);
  const [summary, setSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [open, setOpen] = useState(true);

  const summaryPath = `${meta.path}/summary.md`;

  const loadFiles = useCallback(() => {
    window.kraken.history
      .listSpecFiles({ workspacePath: root ?? null, specId: meta.id })
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [root, meta.id]);

  useEffect(() => {
    loadFiles();
    let alive = true;
    window.kraken.fs
      .read(summaryPath)
      .then((t) => alive && setSummary(t ?? ''))
      .catch(() => alive && setSummary(''));
    return () => {
      alive = false;
    };
  }, [loadFiles, summaryPath]);

  const generate = () => {
    if (!root || summarizing) return;
    setSummarizing(true);
    setSummary('');
    const requestId = crypto.randomUUID();
    let acc = '';

    startRun({
      requestId,
      agent: null,
      source: 'summary:completion',
      kind: 'spec',
      title: `Summarize changes · ${meta.name}`,
      specId: meta.id,
      startedAt: Date.now(),
      status: 'running',
    });

    const off = window.kraken.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) {
        acc += ev.text;
        setSummary(acc);
      }
      if (ev.type === 'done') {
        off();
        finishRun(requestId, 'done');
        setSummarizing(false);
        if (acc.trim()) void window.kraken.fs.write(summaryPath, acc);
      }
      if (ev.type === 'error') {
        off();
        finishRun(requestId, 'error');
        setSummarizing(false);
      }
    });

    const fileList = files.length
      ? files.map((f) => `- ${f.path} (${f.ops ?? 'edit'})`).join('\n')
      : '(no file changes were recorded — inspect `git diff` instead)';
    const reqLabel = meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md';
    const system = `You write concise completion summaries (like a PR description) for a finished spec. Output GitHub-flavored markdown only — no preamble — and do not edit any files.`;
    const userText = `All tasks for the spec "${meta.name}" are complete. Write a short, human-readable recap of what was built.

Use this structure:
- **Overview** — 1–2 sentences on what changed and why.
- **Changes** — a few bullets grouping the work by area.
- **Files** — for each changed file below, one line: \`path\` — what changed and why.

To ground it, read \`${specRel}/${reqLabel}\` and \`${specRel}/design.md\`, and inspect the changed files (and \`git diff\` if available). Be concise and factual — do not invent changes.

Files changed in this spec (${files.length}):
${fileList}`;

    window.kraken.claude.stream({
      requestId,
      system,
      messages: [{ role: 'user', content: userText }],
      cwd: root,
      source: 'summary:completion',
      specId: meta.id,
      kind: 'spec',
    });
  };

  return (
    <div className="rounded-lg border border-ok/30 bg-ok/[0.04] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ok/[0.06]"
      >
        {open ? (
          <ChevronDown size={14} className="text-ink-400 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-ink-400 shrink-0" />
        )}
        <PartyPopper size={14} className="text-ok shrink-0" />
        <span className="text-[12px] font-semibold text-ink-50">All tasks complete</span>
        <span className="text-[11px] text-ink-400">
          · {files.length} file{files.length === 1 ? '' : 's'} changed
        </span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            generate();
          }}
          className="ml-auto text-[11px] flex items-center gap-1 px-2 py-1 rounded-md bg-accent/15 text-accent hover:bg-accent/25 cursor-pointer"
          title="Generate a brief AI description of the completed work"
        >
          {summarizing ? (
            <Loader2 size={11} className="animate-spin" />
          ) : summary ? (
            <RefreshCw size={11} />
          ) : (
            <Sparkles size={11} />
          )}
          {summary ? 'Regenerate' : 'Generate summary'}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Changed files */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1.5">
              Files changed
            </h4>
            {files.length === 0 ? (
              <p className="text-[11px] text-ink-500">
                No file changes were recorded for this spec (CLI runs capture Write/Edit; API runs
                don't). A summary can still be generated from the spec + git diff.
              </p>
            ) : (
              <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                {files.map((f) => {
                  const created = (f.ops ?? '').includes('write');
                  const tasks = (f.task_ids ?? '')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean);
                  return (
                    <div
                      key={f.path}
                      className="flex items-center gap-2 text-[11px] text-ink-200 rounded px-1.5 py-1 hover:bg-ink-800/40"
                      title={f.path}
                    >
                      {created ? (
                        <FilePlus2 size={12} className="text-emerald-400 shrink-0" />
                      ) : (
                        <FilePen size={12} className="text-sky-400 shrink-0" />
                      )}
                      <span className="font-mono truncate">{f.path}</span>
                      <span className="ml-auto flex items-center gap-1 shrink-0">
                        {tasks.map((t) => (
                          <span
                            key={t}
                            className="text-[9px] font-mono px-1 py-0.5 rounded bg-ink-800 text-ink-400"
                          >
                            {t}
                          </span>
                        ))}
                        {f.count > 1 && (
                          <span className="text-[9px] text-ink-500">×{f.count}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI description */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1.5">
              Summary
            </h4>
            {summary ? (
              <div
                className={cn(
                  'md text-[12px] leading-relaxed max-h-72 overflow-y-auto pr-1',
                  summarizing && 'opacity-80'
                )}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
              />
            ) : (
              <p className="text-[11px] text-ink-500">
                {summarizing
                  ? 'Generating summary…'
                  : 'Click Generate summary for a brief description of everything that changed.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
