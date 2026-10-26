import { FileCode2, Wand2 } from 'lucide-react';
import { useUi } from '../../stores/ui';
import { useChat } from '../../stores/chat';
import { useWorkspace } from '../../stores/workspace';
import { SEVERITIES, SEVERITY_META } from '../../lib/codeReview';
import { cn } from '../../lib/cn';
import type { ReviewFinding } from '../../../electron/shared/types';

/**
 * A review's findings, most severe first. Shared by the Ship panel and the PR
 * reviewer: the same finding opens the same file and hands the same fix to the
 * Assistant wherever it was found. `canFix` is off for a PR that is not checked
 * out here — a fix written into this workspace would land on the wrong branch.
 */
export function FindingsList({
  findings,
  canFix = true,
  fileRoot,
  onLocate,
}: {
  findings: ReviewFinding[];
  canFix?: boolean;
  /** where "Open file" reads from — a PR's worktree; defaults to the workspace */
  fileRoot?: string | null;
  /** jump to the finding in a diff instead of opening the bare file */
  onLocate?: (f: ReviewFinding) => void;
}) {
  const workspaceRoot = useWorkspace((s) => s.root);
  const root = fileRoot ?? workspaceRoot;
  const openOverlay = useUi((s) => s.openOverlay);
  const setAssistantOpen = useUi((s) => s.setAssistantOpen);
  const setPendingPrompt = useChat((s) => s.setPendingPrompt);

  if (!findings.length) {
    return <p className="text-[12px] text-dim">No findings — nothing in this change needs attention.</p>;
  }

  const fix = (f: ReviewFinding) => {
    setPendingPrompt(
      `Fix this code review finding, and only this one:\n\n**${f.title}** (${f.severity}) in \`${f.file}${f.line ? `:${f.line}` : ''}\`\n\n${f.detail}${f.suggestion ? `\n\nSuggested fix: ${f.suggestion}` : ''}\n\nRead the code first; if the finding turns out to be wrong, say so instead of changing anything.`
    );
    setAssistantOpen(true);
  };

  return (
    <ul className="space-y-2">
      {SEVERITIES.flatMap((sev) => findings.filter((f) => f.severity === sev)).map((f) => (
        <li key={f.id} className="rounded-lg bg-raised p-3">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                SEVERITY_META[f.severity].cls
              )}
            >
              {SEVERITY_META[f.severity].label}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-ink-50">{f.title}</div>
              {f.file && (
                <div className="mt-0.5 truncate font-mono text-[11px] text-dim">
                  {f.file}
                  {f.line ? `:${f.line}` : ''}
                </div>
              )}
              {f.detail && <p className="mt-1.5 whitespace-pre-wrap text-[12px] text-ink-200">{f.detail}</p>}
              {f.suggestion && (
                <p className="mt-1 whitespace-pre-wrap text-[12px] text-dim">
                  <span className="text-ink-400">Suggestion: </span>
                  {f.suggestion}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              {f.file && (onLocate || root) && (
                <button
                  type="button"
                  title={onLocate ? 'Show in diff' : 'Open file'}
                  onClick={() => (onLocate ? onLocate(f) : openOverlay({ kind: 'file', path: `${root}/${f.file}` }))}
                  className="rounded p-1 text-dim hover:bg-ink-50/[0.06] hover:text-ink-50"
                >
                  <FileCode2 size={13} />
                </button>
              )}
              {canFix && (
                <button
                  type="button"
                  title="Fix with Claude"
                  onClick={() => fix(f)}
                  className="rounded p-1 text-dim hover:bg-ink-50/[0.06] hover:text-ink-50"
                >
                  <Wand2 size={13} />
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One-line tally, e.g. "1 blocker · 2 major". */
export function countsLabel(counts: Record<string, number>): string {
  const parts = SEVERITIES.filter((s) => counts[s]).map((s) => `${counts[s]} ${s}`);
  return parts.length ? parts.join(' · ') : 'no findings';
}
