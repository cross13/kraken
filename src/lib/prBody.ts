// Composing a pull-request description out of what the branch actually contains.
//
// The completion summary answers "what does this spec say we built". A PR
// description has to answer "what is in this branch" — which is a different
// question whenever the branch carries earlier commits, hand edits, or work
// from more than one spec. So the prose here is grounded in `git log` and
// `git diff --numstat` against the merge base, and the spec only supplies the
// intent and the criteria a reviewer should check against.
//
// Deterministic scaffold, one AI-written paragraph. Anything a parser can
// produce should not cost a run, and anything a run produces should be
// verifiable against something.

import type { BranchSummary, SpecMeta } from '../../electron/shared/types';
import { extractCriteria } from './specTrace';

/** Keep the file table readable; a 300-file PR body helps nobody. */
const MAX_FILES = 30;
const MAX_COMMITS = 20;

export function prTitle(meta: SpecMeta): string {
  return `${meta.kind === 'feature' ? 'feat' : 'fix'}: ${meta.name}`;
}

function fileTable(files: BranchSummary['files']): string {
  if (!files.length) return '_No committed file changes on this branch._';
  const shown = files.slice(0, MAX_FILES);
  const rows = shown.map((f) => {
    const churn = f.binary ? 'binary' : `+${f.added} / −${f.deleted}`;
    return `| \`${f.path}\` | ${STATUS_WORD[f.status] ?? f.status} | ${churn} |`;
  });
  const more =
    files.length > shown.length ? `\n\n_…and ${files.length - shown.length} more files._` : '';
  return `| File | | Lines |\n|---|---|---|\n${rows.join('\n')}${more}`;
}

const STATUS_WORD: Record<string, string> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
};

function commitList(commits: BranchSummary['commits']): string {
  if (!commits.length) return '_No commits ahead of the base branch yet._';
  const shown = commits.slice(0, MAX_COMMITS);
  const more =
    commits.length > shown.length ? `\n- _…and ${commits.length - shown.length} more commits._` : '';
  return shown.map((c) => `- \`${c.hash.slice(0, 7)}\` ${c.subject}`).join('\n') + more;
}

/**
 * The acceptance criteria a reviewer should be able to check, as an unticked
 * checklist. Unticked on purpose: Octo knows the tasks ran, not that the
 * behavior is right, and pre-ticking someone else's review is a lie.
 */
function criteriaChecklist(requirementsMd: string): string {
  const criteria = extractCriteria(requirementsMd);
  if (!criteria.length) return '';
  // The trailing `(US-2)` is Octo's own bookkeeping — a reviewer reading the PR
  // has no story list to resolve it against.
  const rows = criteria.map(
    (c) => `- [ ] **${c.id}** ${c.text.replace(/\s*\(\s*US[-\s]?\d{1,3}\s*\)\s*$/i, '').trim()}`
  );
  return `\n## Acceptance criteria\n\n${rows.join('\n')}\n`;
}

export interface PrBodyInput {
  meta: SpecMeta;
  /** the spec directory, relative to the workspace root */
  specRel: string;
  branch: BranchSummary;
  /** the AI-written paragraph; the rest of the body is derived */
  overview: string;
  /** requirements.md or bugfix.md, for the criteria checklist */
  requirementsMd?: string;
}

export function buildPrBody({
  meta,
  specRel,
  branch,
  overview,
  requirementsMd,
}: PrBodyInput): string {
  const churn =
    branch.files.length > 0
      ? `${branch.files.length} file${branch.files.length === 1 ? '' : 's'} · +${branch.added} / −${branch.deleted}`
      : 'no committed changes';
  const range = branch.base ? `\`${branch.base}\` → \`${branch.branch}\`` : `\`${branch.branch}\``;

  return [
    overview.trim() || `Completes the ${meta.kind} spec **${meta.name}**.`,
    '',
    '## What’s in this branch',
    '',
    `${range} — ${branch.commits.length} commit${branch.commits.length === 1 ? '' : 's'}, ${churn}.`,
    '',
    commitList(branch.commits),
    '',
    fileTable(branch.files),
    criteriaChecklist(requirementsMd ?? ''),
    '',
    '---',
    '',
    `Spec: \`${specRel}\` — planned and built with Octo.`,
  ].join('\n');
}

/**
 * A compact rendering of the branch for the model to write the overview from.
 * It gets the real commits and the real churn, so "do not invent changes" is an
 * instruction it can actually follow.
 */
export function branchDigest(branch: BranchSummary): string {
  const commits = branch.commits.slice(0, MAX_COMMITS).map((c) => `- ${c.subject}`);
  const files = branch.files
    .slice(0, MAX_FILES)
    .map((f) => `- ${f.path} (${STATUS_WORD[f.status] ?? f.status}, +${f.added}/-${f.deleted})`);
  return [
    `Base: ${branch.base ?? 'unknown'} → ${branch.branch ?? 'HEAD'}`,
    `${branch.commits.length} commits, ${branch.files.length} files, +${branch.added}/-${branch.deleted}`,
    '',
    'Commits:',
    commits.length ? commits.join('\n') : '(none)',
    '',
    'Files:',
    files.length ? files.join('\n') : '(none)',
  ].join('\n');
}
