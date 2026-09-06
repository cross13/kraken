import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Loader2,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useOrchestrator } from '../../stores/orchestrator';
import { cn } from '../../lib/cn';
import { bridgeReady, STALE_BRIDGE } from '../../lib/bridge';
import { buildPrBody, branchDigest, prTitle } from '../../lib/prBody';
import type { BranchSummary, SpecMeta } from '../../../electron/shared/types';

/**
 * The pull request, composed from the branch rather than from the spec.
 *
 * `ShipView` already had branch → commit → PR; what it did not have was a
 * description of what the branch *contains*. The body here is assembled from
 * `git log` and `git diff --numstat` against the merge base — so it stays true
 * when the branch carries commits the spec never made — with one AI-written
 * overview grounded in that same digest, and the spec's acceptance criteria as
 * an unticked review checklist.
 *
 * Everything is editable before it is sent: this composes a draft, it does not
 * publish behind your back.
 */
export function PrComposer({
  meta,
  specRel,
  requirementsMd,
  fallbackOverview,
  onOpened,
}: {
  meta: SpecMeta;
  specRel: string;
  /** requirements.md / bugfix.md, for the criteria checklist */
  requirementsMd?: string;
  /** the completion summary, used as the overview until one is written here */
  fallbackOverview?: string;
  onOpened?: (url: string) => void;
}) {
  const root = useWorkspace((s) => s.root)!;
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);

  const [branch, setBranch] = useState<BranchSummary | null>(null);
  const [overview, setOverview] = useState('');
  const [title, setTitle] = useState(prTitle(meta));
  const [body, setBody] = useState('');
  const [bodyEdited, setBodyEdited] = useState(false);
  const [writing, setWriting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(meta.prUrl ?? null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const readBranch = useCallback(() => {
    if (!bridgeReady('git', 'branchSummary')) {
      setBranch({
        ok: false,
        branch: null,
        base: null,
        baseGuessed: false,
        commits: [],
        files: [],
        added: 0,
        deleted: 0,
        dirty: false,
        error: STALE_BRIDGE,
      });
      return;
    }
    window.octo.git
      .branchSummary({ cwd: root })
      .then(setBranch)
      .catch(() => setBranch(null));
  }, [root]);

  useEffect(() => {
    readBranch();
  }, [readBranch]);

  // The body is derived until the moment you touch it, then it is yours.
  useEffect(() => {
    if (!branch || bodyEdited) return;
    setBody(
      buildPrBody({
        meta,
        specRel,
        branch,
        overview: overview || fallbackOverview || '',
        requirementsMd,
      })
    );
  }, [branch, overview, fallbackOverview, bodyEdited, meta, specRel, requirementsMd]);

  const accRef = useRef('');
  const writeOverview = () => {
    if (!branch || writing) return;
    setWriting(true);
    setNotice(null);
    accRef.current = '';
    const requestId = crypto.randomUUID();

    startRun({
      requestId,
      agent: null,
      source: 'pr:overview',
      kind: 'spec',
      title: `PR description · ${meta.name}`,
      specId: meta.id,
      startedAt: Date.now(),
      status: 'running',
    });

    const off = window.octo.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) {
        accRef.current += ev.text;
        setOverview(accRef.current);
        setBodyEdited(false);
      }
      if (ev.type === 'done' || ev.type === 'error') {
        off();
        finishRun(requestId, ev.type === 'done' ? 'done' : 'error');
        setWriting(false);
        if (ev.type === 'error') setNotice({ tone: 'bad', text: ev.error ?? 'Could not write the overview' });
      }
    });

    window.octo.claude.stream({
      requestId,
      system:
        'You write the opening of a pull request description: what changed and why, for a reviewer who has not seen the spec. Output GitHub-flavored markdown, two short paragraphs at most, no heading, no preamble, no bullet list. Do not edit any files.',
      messages: [
        {
          role: 'user',
          content: `Write the overview for a pull request from this branch.

Ground it in the commits and files below, and in the spec at \`${specRel}\` (read \`${specRel}/plan.md\` for the intent). Describe what a reviewer will find in the diff — do not restate the plan, and do not mention anything that is not in the branch.

${branchDigest(branch)}`,
        },
      ],
      cwd: root,
      source: 'pr:overview',
      specId: meta.id,
      kind: 'spec',
    });
  };

  const create = async () => {
    setCreating(true);
    setNotice(null);
    try {
      const res = await window.octo.github.createPr({
        cwd: root,
        specId: meta.id,
        title: title.trim() || prTitle(meta),
        body,
        push: true,
      });
      if (res.ok && res.data) {
        setPrUrl(res.data.url);
        setNotice({ tone: 'ok', text: `PR #${res.data.number} opened` });
        onOpened?.(res.data.url);
      } else {
        setNotice({ tone: 'bad', text: res.error ?? 'Could not create the pull request' });
      }
      await refreshAll();
    } finally {
      setCreating(false);
    }
  };

  if (!branch) return null;

  if (!branch.ok) {
    return (
      <Panel>
        <p className="text-[12px] text-dim">
          {branch.error ?? 'This workspace has no git repository, so there is nothing to open a PR from.'}
        </p>
      </Panel>
    );
  }

  const nothingToShip = branch.commits.length === 0;

  return (
    <Panel>
      {/* what the branch is, factually */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
        <span className="flex items-center gap-1.5 text-ink-100">
          <GitBranch size={13} className="text-accent" />
          <code className="font-mono">{branch.base ?? '?'}</code>
          <ChevronRight size={12} className="text-faint" />
          <code className="font-mono text-ink-50">{branch.branch ?? 'HEAD'}</code>
        </span>
        <span className="text-faint">
          {branch.commits.length} commit{branch.commits.length === 1 ? '' : 's'} ·{' '}
          {branch.files.length} file{branch.files.length === 1 ? '' : 's'} ·{' '}
          <span className="text-ok">+{branch.added}</span>{' '}
          <span className="text-danger-text">−{branch.deleted}</span>
        </span>
        {branch.files.length > 0 && (
          <button
            onClick={() => setFilesOpen((v) => !v)}
            className="text-[11.5px] text-faint hover:text-ink-200 transition"
          >
            {filesOpen ? 'hide files' : 'show files'}
          </button>
        )}
      </div>

      {branch.baseGuessed && (
        <Warn>
          No <code className="font-mono">origin/HEAD</code> is set, so{' '}
          <code className="font-mono">{branch.base}</code> is a guess. If that is the wrong base,
          the file list below is wrong too.
        </Warn>
      )}
      {branch.dirty && (
        <Warn>
          The working tree has uncommitted changes — they are <strong>not</strong> in this
          description. Commit them first if they belong in the PR.
        </Warn>
      )}

      {filesOpen && (
        <ul className="max-h-[190px] overflow-y-auto rounded-lg bg-ink-900/60 p-2 space-y-0.5">
          {branch.files.map((f) => (
            <li key={f.path} className="flex items-baseline gap-2 text-[11.5px] font-mono">
              <span className="w-3 shrink-0 text-faint">{f.status}</span>
              <span className="min-w-0 flex-1 truncate text-ink-200" title={f.path}>
                {f.path}
              </span>
              <span className="shrink-0 tabular-nums text-ok">+{f.added}</span>
              <span className="shrink-0 tabular-nums text-danger-text">−{f.deleted}</span>
            </li>
          ))}
        </ul>
      )}

      {/* the draft */}
      <label className="block">
        <span className="block text-[10px] uppercase tracking-[0.07em] text-ink-500 font-semibold mb-1.5">
          Title
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-[13px] px-3 py-2 rounded-lg bg-bg text-ink-50 outline-none focus:ring-1 focus:ring-accent"
        />
      </label>

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] uppercase tracking-[0.07em] text-ink-500 font-semibold">
            Description
          </span>
          {bodyEdited && <span className="text-[10px] text-faint">edited</span>}
          <div className="flex-1" />
          <button
            onClick={writeOverview}
            disabled={writing || nothingToShip}
            title="Claude writes the opening paragraphs from this branch's commits and diff"
            className="flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-lg bg-accent/12 text-accent hover:bg-accent/20 transition disabled:opacity-50"
          >
            {writing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {overview ? 'Rewrite overview' : 'Write overview'}
          </button>
        </div>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setBodyEdited(true);
          }}
          rows={12}
          spellCheck={false}
          className="w-full text-[12px] font-mono leading-relaxed px-3 py-2.5 rounded-lg bg-bg text-ink-100 outline-none focus:ring-1 focus:ring-accent resize-y"
        />
      </div>

      {notice && (
        <div className={cn('text-[12px]', notice.tone === 'ok' ? 'text-ok' : 'text-danger-text')}>
          {notice.text}
        </div>
      )}

      <div className="flex items-center gap-2.5">
        {prUrl ? (
          <button
            onClick={() => void window.octo.shell.openUrl(prUrl)}
            className="flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg bg-elev text-ink-100 hover:bg-line transition"
          >
            <ExternalLink size={13} /> View pull request
          </button>
        ) : null}
        <div className="flex-1" />
        <button
          onClick={create}
          disabled={creating || nothingToShip}
          title={
            nothingToShip
              ? 'This branch has no commits ahead of its base — commit first'
              : 'Push the branch and open the pull request'
          }
          className="flex items-center gap-1.5 text-[12.5px] px-4 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-glow transition disabled:opacity-40"
        >
          {creating ? <Loader2 size={13} className="animate-spin" /> : <GitPullRequest size={13} />}
          {prUrl ? 'Open another PR' : 'Create pull request'}
        </button>
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-ink-700/70 bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-700/70">
        <GitCommitHorizontal size={14} className="text-accent" />
        <h3 className="text-[12.5px] font-medium text-ink-50">Pull request</h3>
        <span className="text-[11px] text-faint">described from the branch</span>
      </header>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-[11.5px] text-dim leading-snug">
      <AlertTriangle size={12} className="text-warn shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}
