import { useEffect, useState, useRef } from 'react';
import {
  Eye,
  Pencil,
  ArrowRight,
  Sparkles,
  Loader2,
  Stethoscope,
  RotateCcw,
  FileText,
  Bug,
  Check,
  CheckCircle2,
  ScrollText,
  RefreshCw,
  HelpCircle,
  ListChecks,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useChat } from '../../stores/chat';
import { useOrchestrator } from '../../stores/orchestrator';
import { useUi } from '../../stores/ui';
import { renderMarkdown } from '../../lib/markdown';
import { cn } from '../../lib/cn';
import { TaskRunner } from './TaskRunner';
import { routeAgent, routeSkill, skillSystemBlock } from '../../lib/agentRouter';
import { resolveAgent, resolveSkill } from '../../lib/verifyLibrary';
import { parseOpenQuestions, addQuestion } from '../../lib/openQuestions';
import { MarkdownEditor } from '../MarkdownEditor';
import type { SpecMeta, SpecPhase } from '../../../electron/shared/types';

const phaseOrder: SpecPhase[] = ['requirements', 'design', 'tasks', 'done'];

// 'board' is the interactive task runner; only offered for the tasks file.
type SpecView = 'board' | 'edit' | 'preview';

interface Props {
  specId: string;
  file: 'requirements' | 'design' | 'tasks' | 'bugfix';
}

export function SpecEditor({ specId, file }: Props) {
  const root = useWorkspace((s) => s.root)!;
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const [meta, setMeta] = useState<SpecMeta | null>(null);
  const [files, setFiles] = useState<Record<string, string>>({});
  // Tasks open on the interactive Board by default; everything else on Edit.
  const [view, setView] = useState<SpecView>(file === 'tasks' ? 'board' : 'edit');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  // True while the user has local edits not yet persisted — used to avoid
  // clobbering them when we reload the file after an agent run finishes.
  const dirtyRef = useRef(false);

  // Human-readable summary of long spec docs (esp. requirements).
  const [summary, setSummary] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  // Surface open questions out of the requirements into its Open Questions section.
  const [surfacing, setSurfacing] = useState(false);
  const [surfaceMsg, setSurfaceMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await window.kraken.specs.read(root, specId);
    setMeta(res.meta);
    setFiles(res.files);
  };

  useEffect(() => {
    load();
  }, [root, specId]);

  // The agent may edit this spec file from anywhere — the chat panel, a hook, or
  // the orchestrator — not just this view's "Ask Claude" button. Those runs carry a
  // different requestId, so the per-action handlers below never see them. Reload from
  // disk whenever any Claude run finishes so the open file always reflects what was
  // written, unless the user has unsaved local edits (don't clobber their work).
  useEffect(() => {
    const off = window.kraken.claude.onEvent((ev) => {
      if (ev.type !== 'done' && ev.type !== 'error') return;
      if (dirtyRef.current) return;
      void load();
    });
    return () => {
      off();
    };
  }, [root, specId]);

  const content = files[file] ?? '';

  const onChange = (v: string) => {
    setFiles((prev) => ({ ...prev, [file]: v }));
    dirtyRef.current = true;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setSaving(true);
    debounceRef.current = window.setTimeout(async () => {
      const updated = await window.kraken.specs.writeFile(root, specId, file, v);
      setMeta(updated);
      setSaving(false);
      setSavedAt(Date.now());
      debounceRef.current = null;
      dirtyRef.current = false;
    }, 400);
  };

  const advance = async () => {
    if (!meta) return;
    const updated = await window.kraken.specs.advance(root, specId);
    setMeta(updated);
    await load();
    await refreshAll();
  };

  const openTab = useUi((s) => s.openTab);
  const askClaude = useAskClaude(meta, files, file, load);
  const audit = useAudit(meta, files, load);
  const summarize = useSummarize(meta, file);
  const surface = useSurfaceQuestions(meta, files, file);

  // The requirement file is where open questions belong (feeds the design phase).
  const isRequirementFile = file === 'requirements' || file === 'bugfix';

  const runSurface = async () => {
    if (!meta || surfacing) return;
    setSurfacing(true);
    setSurfaceMsg(null);
    const added = await surface();
    setSurfacing(false);
    await load();
    if (added > 0) {
      // Take the user to the Open Questions module to review what was populated.
      openTab({
        id: `spec:${meta.id}:questions`,
        title: `${meta.name} / Open Questions`,
        kind: 'questions',
        specId: meta.id,
      });
    } else {
      setSurfaceMsg('No new questions found');
    }
  };

  const summaryPath = meta ? `${meta.path}/${file}.summary.md` : '';

  // Load a previously-saved summary for this file (if any).
  useEffect(() => {
    if (!summaryPath) return;
    let alive = true;
    window.kraken.fs
      .read(summaryPath)
      .then((t) => {
        if (alive) setSummary(t ?? '');
      })
      .catch(() => {
        if (alive) setSummary('');
      });
    return () => {
      alive = false;
    };
  }, [summaryPath]);

  const runSummarize = () => {
    if (!meta || summarizing) return;
    setSummaryOpen(true);
    setSummarizing(true);
    setSummary('');
    summarize(content, {
      onDelta: (full) => setSummary(full),
      onDone: (full) => {
        setSummarizing(false);
        if (full.trim()) void window.kraken.fs.write(summaryPath, full);
      },
      onError: () => setSummarizing(false),
    });
  };

  const onSummarize = () => {
    if (!summary && !summarizing) runSummarize();
    else setSummaryOpen((o) => !o);
  };

  const reSync = async () => {
    if (!meta) return;
    const updated = await window.kraken.specs.setPhase(root, specId, 'tasks');
    setMeta(updated);
    await load();
    await refreshAll();
  };

  if (!meta) return <div className="p-6 text-sm text-ink-400">Loading spec…</div>;

  const currentPhaseIdx = phaseOrder.indexOf(meta.phase);
  const canAdvance = meta.phase !== 'done';
  const nextPhase = phaseOrder[Math.min(currentPhaseIdx + 1, phaseOrder.length - 1)];

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <SpecHeader
        meta={meta}
        file={file}
        view={view}
        setView={setView}
        canBoard={file === 'tasks'}
        onAskClaude={askClaude}
        onAudit={audit}
        onSummarize={onSummarize}
        canSummarize={file !== 'tasks'}
        hasSummary={!!summary}
        summarizing={summarizing}
        onSurface={runSurface}
        canSurface={isRequirementFile}
        surfacing={surfacing}
        surfaceMsg={surfaceMsg}
        saving={saving}
        savedAt={savedAt}
      />
      <SpecPhaseStrip
        currentIdx={currentPhaseIdx}
        currentStage={file === 'design' ? 1 : file === 'tasks' ? 2 : 0}
        kind={meta.kind}
        phase={meta.phase}
        canAdvance={canAdvance}
        nextPhase={nextPhase}
        onAdvance={advance}
        onReSync={reSync}
        onNavigate={(stage) => {
          const key =
            stage === 0
              ? meta.kind === 'feature'
                ? 'requirements'
                : 'bugfix'
              : stage === 1
                ? 'design'
                : 'tasks';
          const label =
            stage === 0
              ? meta.kind === 'feature'
                ? 'requirements.md'
                : 'bugfix.md'
              : stage === 1
                ? 'design.md'
                : 'tasks.md';
          openTab({
            id: `spec:${meta.id}:${key}`,
            title: `${meta.name} / ${label}`,
            kind: 'spec',
            specId: meta.id,
            specFile: key as 'requirements' | 'design' | 'tasks' | 'bugfix',
          });
        }}
      />
      {summaryOpen && file !== 'tasks' && (
        <SummaryPanel
          summary={summary}
          summarizing={summarizing}
          onRegenerate={runSummarize}
          onClose={() => setSummaryOpen(false)}
        />
      )}
      <div className="flex-1 min-h-0 bg-ink-950">
        {file === 'tasks' && view === 'board' ? (
          <TaskRunner
            meta={meta}
            tasksMd={files.tasks ?? ''}
            designMd={files.design ?? ''}
            requirementsMd={files.requirements ?? files.bugfix ?? ''}
            onReload={load}
          />
        ) : view === 'preview' ? (
          <div
            className="md w-full px-8 py-6 h-full overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        ) : (
          <MarkdownEditor
            value={content}
            onChange={onChange}
            placeholder="Start writing…"
          />
        )}
      </div>
    </div>
  );
}

function SpecHeader({
  meta,
  file,
  view,
  setView,
  canBoard,
  onAskClaude,
  onAudit,
  onSummarize,
  canSummarize,
  hasSummary,
  summarizing,
  onSurface,
  canSurface,
  surfacing,
  surfaceMsg,
  saving,
  savedAt,
}: {
  meta: SpecMeta;
  file: string;
  view: SpecView;
  setView: (v: SpecView) => void;
  canBoard: boolean;
  onAskClaude: () => void;
  onAudit: () => void;
  onSummarize: () => void;
  canSummarize: boolean;
  hasSummary: boolean;
  summarizing: boolean;
  onSurface: () => void;
  canSurface: boolean;
  surfacing: boolean;
  surfaceMsg: string | null;
  saving: boolean;
  savedAt: number | null;
}) {
  const KindIcon = meta.kind === 'feature' ? FileText : Bug;
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3">
      {/* Identity */}
      <div className="min-w-0 flex items-center gap-3">
        <div className="w-9 h-9 grid place-items-center rounded-lg bg-accent/10 text-accent shrink-0">
          <KindIcon size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold flex items-center gap-1.5">
            {meta.kind === 'feature' ? 'Feature spec' : 'Bugfix spec'}
            <span className="text-ink-700">·</span>
            <span className="font-mono text-ink-400 normal-case tracking-normal">{file}.md</span>
          </div>
          <div className="font-display text-[17px] font-semibold text-ink-50 truncate leading-tight">
            {meta.name}
          </div>
        </div>
      </div>

      {/* Document tools */}
      <div className="flex items-center gap-3 shrink-0">
        <SaveStatus saving={saving} savedAt={savedAt} />

        {/* View mode — tasks add an interactive Board alongside the raw markdown */}
        <div className="flex rounded-lg bg-ink-900/60 p-0.5">
          {canBoard && (
            <SegBtn active={view === 'board'} onClick={() => setView('board')}>
              <ListChecks size={11} /> Board
            </SegBtn>
          )}
          <SegBtn active={view === 'edit'} onClick={() => setView('edit')}>
            <Pencil size={11} /> Edit
          </SegBtn>
          <SegBtn active={view === 'preview'} onClick={() => setView('preview')}>
            <Eye size={11} /> Preview
          </SegBtn>
        </div>

        {/* AI assist */}
        <div className="flex items-center gap-1.5">
          {surfaceMsg && (
            <span className="text-[10px] text-ink-500 mr-1">{surfaceMsg}</span>
          )}
          <button
            onClick={onAskClaude}
            className="text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent ring-1 ring-inset ring-accent/30 hover:bg-accent/25 transition"
            title="Ask Claude to draft or refine this section"
          >
            <Sparkles size={13} /> Ask Claude
          </button>
          {canSurface && (
            <button
              onClick={onSurface}
              disabled={surfacing}
              className="text-xs flex items-center justify-center w-8 h-8 rounded-lg text-ink-300 hover:text-ink-50 hover:bg-ink-800 transition disabled:opacity-50"
              title="Surface open questions from these requirements into the Open Questions module"
            >
              {surfacing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <HelpCircle size={15} />
              )}
            </button>
          )}
          {canSummarize && (
            <button
              onClick={onSummarize}
              className={cn(
                'text-xs flex items-center justify-center w-8 h-8 rounded-lg transition relative',
                hasSummary
                  ? 'text-accent hover:bg-ink-800'
                  : 'text-ink-300 hover:text-ink-50 hover:bg-ink-800'
              )}
              title="Summarize — generate a short, human-readable summary of this document"
            >
              {summarizing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ScrollText size={15} />
              )}
            </button>
          )}
          <button
            onClick={onAudit}
            className="text-xs flex items-center justify-center w-8 h-8 rounded-lg text-ink-300 hover:text-ink-50 hover:bg-ink-800 transition"
            title="Audit — run spec-doctor to find drift between requirements, design, tasks, and code"
          >
            <Stethoscope size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveStatus({ saving, savedAt }: { saving: boolean; savedAt: number | null }) {
  if (saving) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-ink-400">
        <Loader2 size={11} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (savedAt) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-ink-500">
        <Check size={11} className="text-ok" /> Saved
      </span>
    );
  }
  return null;
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-xs px-2.5 py-1 rounded-md flex items-center gap-1 transition',
        active ? 'bg-ink-800 text-ink-50 shadow-sm' : 'text-ink-400 hover:text-ink-100'
      )}
    >
      {children}
    </button>
  );
}

function SummaryPanel({
  summary,
  summarizing,
  onRegenerate,
  onClose,
}: {
  summary: string;
  summarizing: boolean;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="bg-ink-900/40 shrink-0">
      <div className="flex items-center gap-2 px-6 py-2">
        <ScrollText size={13} className="text-accent shrink-0" />
        <span className="text-[11px] font-semibold text-ink-100 uppercase tracking-wider">
          Human-readable summary
        </span>
        {summarizing && <Loader2 size={12} className="animate-spin text-accent" />}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onRegenerate}
            disabled={summarizing}
            className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md text-ink-300 hover:text-ink-50 hover:bg-ink-800 disabled:opacity-40 transition"
            title="Regenerate the summary"
          >
            <RefreshCw size={11} /> Regenerate
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 grid place-items-center rounded-md text-ink-500 hover:text-ink-100 hover:bg-ink-800"
            title="Hide summary"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      <div className="px-6 pb-3 max-h-64 overflow-y-auto">
        {summary ? (
          <div className="md text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }} />
        ) : (
          <p className="text-[12px] text-ink-500">
            {summarizing ? 'Generating summary…' : 'No summary yet — click Regenerate.'}
          </p>
        )}
      </div>
    </div>
  );
}

function SpecPhaseStrip({
  currentIdx,
  currentStage,
  kind,
  phase,
  canAdvance,
  nextPhase,
  onAdvance,
  onReSync,
  onNavigate,
}: {
  currentIdx: number;
  currentStage: number;
  kind: 'feature' | 'bugfix';
  phase: SpecPhase;
  canAdvance: boolean;
  nextPhase: SpecPhase;
  onAdvance: () => void;
  onReSync: () => void;
  onNavigate: (stage: number) => void;
}) {
  const stages =
    kind === 'feature'
      ? ['Requirements', 'Design', 'Tasks', 'Done']
      : ['Bug analysis', 'Design', 'Tasks', 'Done'];
  return (
    <div className="flex items-center gap-2 px-6 py-2.5 text-[11px]">
      {/* Pipeline spine — click a step to open that phase's file */}
      <div className="flex items-center min-w-0 overflow-x-auto">
        {stages.map((s, i) => {
          const complete = phase === 'done' ? true : i < currentIdx;
          const isCurrentPhase = phase !== 'done' && i === currentIdx;
          const viewing = i === currentStage;
          const navigable = i < 3;
          return (
            <div key={s} className="flex items-center shrink-0">
              <button
                type="button"
                disabled={!navigable}
                onClick={() => navigable && onNavigate(i)}
                title={navigable ? `Open ${s}` : 'Completion'}
                className={cn(
                  'flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full transition',
                  viewing
                    ? 'bg-accent/15 ring-1 ring-inset ring-accent/40'
                    : navigable
                      ? 'hover:bg-ink-50/[0.05]'
                      : 'cursor-default'
                )}
              >
                <span
                  className={cn(
                    'w-[18px] h-[18px] grid place-items-center rounded-full text-[10px] font-bold shrink-0',
                    complete
                      ? 'bg-ok/20 text-ok'
                      : viewing || isCurrentPhase
                        ? 'bg-accent text-accent-fg'
                        : 'bg-ink-800 text-ink-500'
                  )}
                >
                  {complete ? <Check size={11} /> : i + 1}
                </span>
                <span
                  className={cn(
                    'font-medium whitespace-nowrap',
                    viewing
                      ? 'text-accent'
                      : complete
                        ? 'text-ink-200'
                        : isCurrentPhase
                          ? 'text-ink-100'
                          : 'text-ink-500'
                  )}
                >
                  {s}
                </span>
              </button>
              {i < stages.length - 1 && (
                <span
                  className={cn(
                    'w-5 h-px mx-0.5 shrink-0',
                    complete ? 'bg-ok/40' : 'bg-ink-700'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Workflow action — advancing the spec lives next to the phases it moves through */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {phase === 'done' && (
          <>
            <span className="flex items-center gap-1 text-ok font-medium">
              <CheckCircle2 size={12} /> Complete
            </span>
            <button
              onClick={onReSync}
              title="Reopen the Tasks phase to re-sync the spec with the code"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-ink-300 hover:text-ink-50 hover:bg-ink-800 transition"
            >
              <RotateCcw size={11} /> Re-sync
            </button>
          </>
        )}
        {canAdvance && (
          <button
            onClick={onAdvance}
            title={`Advance the spec to the ${nextPhase} phase`}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-accent text-accent-fg font-medium hover:opacity-90 transition shadow-glow"
          >
            Advance to {nextPhase} <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function useAskClaude(
  meta: SpecMeta | null,
  files: Record<string, string>,
  file: string,
  onReload?: () => void
) {
  const push = useChat((s) => s.push);
  const setBusy = useChat((s) => s.setBusy);
  const appendDelta = useChat((s) => s.appendDelta);
  const finish = useChat((s) => s.finish);
  const fail = useChat((s) => s.fail);
  const selectedAgent = useChat((s) => s.selectedAgent);
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const root = useWorkspace((s) => s.root);
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);

  return () => {
    if (!meta) return;
    const specRel = meta.path.replace(root ? root + '/' : '', '');
    const targetPath = `${specRel}/${file}.md`;
    const ears = `Use EARS notation strictly: "WHEN <event> THEN the system SHALL <behavior>", "WHILE <state> THE system SHALL <behavior>", "IF <precondition> THEN the system SHALL <behavior>".`;
    const editInstruction = `Use the **Read** tool to read the current contents of \`${targetPath}\`, then use the **Edit** or **Write** tool to apply your changes directly to that file. Do not paste the full file in chat — write it to disk. Keep a short summary of what you changed in your reply.`;

    const prompts: Record<string, string> = {
      requirements: `Draft or refine **requirements.md** for the feature spec "${meta.name}".

${ears}

Required sections: Introduction, User Stories, Acceptance Criteria (EARS), Out of Scope, Non-Functional Requirements.

${editInstruction}`,
      bugfix: `Draft or refine **bugfix.md** for the bug "${meta.name}".

Required sections: Reproduction (numbered steps), Current Behavior (WHEN/THEN), Expected Behavior (WHEN/THEN/SHALL), Unchanged Behavior (WHEN/THEN/SHALL CONTINUE TO — these protect against regressions), Environment.

${editInstruction}`,
      design: `Draft or refine **design.md** for "${meta.name}".

Read the current \`${specRel}/${meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md'}\` first. If it has a **Resolved Decisions** section, treat each entry as a settled answer to an open question and reflect those decisions in the design — do not re-open them. Then produce: Overview, Components, Data & State, Sequence (ascii/mermaid), Error Handling, Testing Strategy mapping back to every acceptance criterion, Open Questions.

${editInstruction}`,
      tasks: `Draft or refine **tasks.md** for "${meta.name}".

Read the current \`${specRel}/design.md\` first. Then produce dependency-ordered waves: Wave 1 = no dependencies and parallel-safe; each later wave lists its prerequisites explicitly. Every task has a single observable outcome. Close with a Verification checklist that maps every acceptance criterion to at least one task.

Format each task line **exactly** as \`- [ ] T1: <description>\` — a plain checkbox, then the bare id (T1, T2, …), then a colon. Do NOT wrap the id or checkbox in markdown bold/emphasis (no \`**T1**\`, no \`__T1__\`). Optionally name a specialized agent as \`- [ ] T1 @agent-name: <description>\`.

${editInstruction}`,
    };
    const userText = prompts[file] ?? `Edit \`${targetPath}\` for "${meta.name}".`;

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: userText,
      createdAt: Date.now(),
    };
    push(userMsg);

    const routed = routeAgent(
      { kind: 'spec-file', file: file as 'requirements' | 'bugfix' | 'design' | 'tasks', specKind: meta.kind },
      agents,
      selectedAgent
    );

    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    push({
      id: assistantId,
      role: 'assistant' as const,
      content: '',
      createdAt: Date.now(),
      streaming: true,
      agent: routed.name ?? undefined,
    });
    setBusy(true, requestId);
    startRun({
      requestId,
      agent: routed.name,
      source: `spec:${file}`,
      kind: 'spec',
      title: `Draft ${file}.md · ${meta.name}`,
      specId: meta.id,
      startedAt: Date.now(),
      status: 'running',
      skill: routeSkill(meta.kind, skills)?.name ?? null,
      routeReason: routed.reason,
      agentScope: resolveAgent(routed.name, agents).scope ?? null,
    });

    const agentBody = routed.body;

    const off = window.kraken.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) appendDelta(assistantId, ev.text, ev.channel);
      if (ev.type === 'done') {
        finish(assistantId);
        off();
        finishRun(requestId, 'done');
        // Claude may have written to disk via Edit/Write — reload the file.
        onReload?.();
      }
      if (ev.type === 'error') {
        fail(assistantId, ev.error ?? 'Unknown error');
        off();
        finishRun(requestId, 'error');
        // Still attempt a reload in case partial writes happened.
        onReload?.();
      }
    });

    const specSkill = routeSkill(meta.kind, skills);
    const skillBlock = skillSystemBlock(specSkill);
    const system = [skillBlock, buildSystem(agentBody, meta, files)]
      .filter(Boolean)
      .join('\n\n---\n\n');

    window.kraken.claude.stream({
      requestId,
      system,
      messages: [{ role: 'user', content: userText }],
      cwd: root,
      source: `spec:${file}`,
      specId: meta.id,
      agent: routed.name,
      kind: 'spec',
      skill: specSkill?.name ?? null,
      skillScope: resolveSkill(specSkill?.name, skills).scope ?? null,
      routeReason: routed.reason,
      agentScope: resolveAgent(routed.name, agents).scope ?? null,
    });
  };
}

/** Runs spec-doctor to audit the spec for drift between requirements, design, tasks, and code. */
function useAudit(
  meta: SpecMeta | null,
  files: Record<string, string>,
  onReload?: () => void
) {
  const push = useChat((s) => s.push);
  const setBusy = useChat((s) => s.setBusy);
  const appendDelta = useChat((s) => s.appendDelta);
  const finish = useChat((s) => s.finish);
  const fail = useChat((s) => s.fail);
  const selectedAgent = useChat((s) => s.selectedAgent);
  const agents = useWorkspace((s) => s.agents);
  const root = useWorkspace((s) => s.root);
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);

  return () => {
    if (!meta) return;
    const specRel = meta.path.replace(root ? root + '/' : '', '');
    const reqLabel = meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md';
    const userText = `Audit the spec "${meta.name}" for inconsistencies (SDD re-sync).

Read \`${specRel}/${reqLabel}\`, \`${specRel}/design.md\`, and \`${specRel}/tasks.md\`, then inspect the actual code in the workspace. Report:
1. Acceptance criteria with no corresponding task or implementation.
2. Tasks or code with no backing requirement (scope creep).
3. Places where the code contradicts the spec (drift).
4. A concrete recommendation: which spec phase to reopen (if any) and what to change.

Be specific — cite file:line. Do not edit anything; this is a read-only audit.`;

    push({ id: crypto.randomUUID(), role: 'user', content: userText, createdAt: Date.now() });

    const routed = routeAgent({ kind: 'audit' }, agents, selectedAgent);
    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    push({
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true,
      agent: routed.name ?? 'spec-doctor',
    });
    setBusy(true, requestId);
    startRun({
      requestId,
      agent: routed.name ?? 'spec-doctor',
      source: 'audit',
      kind: 'audit',
      title: `Audit ${meta.name}`,
      specId: meta.id,
      startedAt: Date.now(),
      status: 'running',
      routeReason: routed.reason,
      agentScope: resolveAgent(routed.name, agents).scope ?? null,
    });

    const off = window.kraken.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) appendDelta(assistantId, ev.text, ev.channel);
      if (ev.type === 'done') {
        finish(assistantId);
        off();
        finishRun(requestId, 'done');
        onReload?.();
      }
      if (ev.type === 'error') {
        fail(assistantId, ev.error ?? 'Unknown error');
        off();
        finishRun(requestId, 'error');
      }
    });

    const system = routed.body
      ? `${routed.body}\n\n---\n\n${buildSystem('', meta, files)}`
      : buildSystem('', meta, files);

    window.kraken.claude.stream({
      requestId,
      system,
      messages: [{ role: 'user', content: userText }],
      cwd: root,
      source: 'audit',
      specId: meta.id,
      agent: routed.name,
      kind: 'audit',
      routeReason: routed.reason,
      agentScope: resolveAgent(routed.name, agents).scope ?? null,
    });
  };
}

interface SummarizeHandlers {
  onDelta: (full: string) => void;
  onDone: (full: string) => void;
  onError: (err: string) => void;
}

/**
 * Generates a short, human-readable summary of a (potentially very long) spec
 * document. Streams into the caller's handlers and registers as a tracked run
 * so it shows up in History / the agent graph. It does NOT edit any files —
 * the caller persists the result.
 */
function useSummarize(meta: SpecMeta | null, file: string) {
  const root = useWorkspace((s) => s.root);
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);

  return (content: string, handlers: SummarizeHandlers) => {
    if (!meta) return;
    const requestId = crypto.randomUUID();
    let acc = '';

    startRun({
      requestId,
      agent: null,
      source: `summary:${file}`,
      kind: 'spec',
      title: `Summarize ${file}.md · ${meta.name}`,
      specId: meta.id,
      startedAt: Date.now(),
      status: 'running',
    });

    const off = window.kraken.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) {
        acc += ev.text;
        handlers.onDelta(acc);
      }
      if (ev.type === 'done') {
        off();
        finishRun(requestId, 'done');
        handlers.onDone(acc);
      }
      if (ev.type === 'error') {
        off();
        finishRun(requestId, 'error');
        handlers.onError(ev.error ?? 'Unknown error');
      }
    });

    const label = file === 'bugfix' ? 'bug analysis' : `${file}`;
    const system = `You are a technical writer who distills long software specs into short, faithful, human-readable summaries. Output only the requested markdown summary — no preamble, and do not edit any files or use tools.`;
    const userText = `Summarize the ${label} document for the spec "${meta.name}" so a reader can grasp it in under a minute without reading the full text.

Keep it tight. Use this markdown structure, omitting any section that doesn't apply:

- **TL;DR** — 1–2 sentences on what this is and who it's for.
- **Key points** — 3–6 bullets covering the main goals / requirements / behaviors.
- **Constraints** — brief bullets for notable non-functional requirements or limits, if any.
- **Out of scope** — only if the document states it.

Do not invent anything that isn't in the document. Respond with the summary markdown only.

---

${content || '(the document is empty)'}`;

    window.kraken.claude.stream({
      requestId,
      system,
      messages: [{ role: 'user', content: userText }],
      cwd: root,
      source: `summary:${file}`,
      specId: meta.id,
      kind: 'spec',
    });
  };
}

/** Turn Claude's plain-list response into clean question strings. */
function extractQuestionLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    // Strip leading bullets / numbering / "Q:" prefixes.
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)]|Q\d*[:.]?)\s*/i, '').trim();
    if (line.length < 6 || !/[a-zA-Z]/.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= 20) break;
  }
  return out;
}

/**
 * Surfaces open questions out of the requirements with Claude and appends the new
 * ones to its `## Open Questions` section (deduped). Returns how many were added.
 */
function useSurfaceQuestions(
  meta: SpecMeta | null,
  files: Record<string, string>,
  file: string
) {
  const root = useWorkspace((s) => s.root)!;
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);

  return () =>
    new Promise<number>((resolve) => {
      if (!meta) return resolve(0);
      const md = files[file] ?? '';
      const requestId = crypto.randomUUID();
      let acc = '';

      startRun({
        requestId,
        agent: null,
        source: 'surface-questions',
        kind: 'spec',
        title: `Surface questions · ${meta.name}`,
        specId: meta.id,
        startedAt: Date.now(),
        status: 'running',
      });

      const off = window.kraken.claude.onEvent((ev) => {
        if (ev.requestId !== requestId) return;
        if (ev.type === 'delta' && ev.text) acc += ev.text;
        if (ev.type === 'done' || ev.type === 'error') {
          off();
          finishRun(requestId, ev.type === 'done' ? 'done' : 'error');
          if (ev.type === 'error') return resolve(0);
          const existing = new Set(
            parseOpenQuestions(md).questions.map((q) => q.text.trim().toLowerCase())
          );
          const fresh = extractQuestionLines(acc).filter(
            (q) => !existing.has(q.toLowerCase())
          );
          if (!fresh.length) return resolve(0);
          let next = md;
          for (const q of fresh) next = addQuestion(next, q);
          window.kraken.specs
            .writeFile(root, meta.id, file, next)
            .then(() => resolve(fresh.length))
            .catch(() => resolve(0));
        }
      });

      const label = file === 'bugfix' ? 'bug analysis' : 'requirements';
      const system =
        'You analyze a software requirements document and surface its OPEN QUESTIONS — ' +
        'ambiguities, missing decisions, undefined behaviors, and choices that must be settled ' +
        'before design. Output ONLY the questions, one per line, each a single clear question ' +
        'ending with "?". No numbering, no bullets, no preamble, and do NOT answer them. If the ' +
        'document is already unambiguous, output nothing. Do not edit files or use tools.';
      const userText = `${label} document for the spec "${meta.name}":\n\n${md || '(empty)'}\n\nList the open questions, one per line:`;

      window.kraken.claude.stream({
        requestId,
        system,
        messages: [{ role: 'user', content: userText }],
        cwd: root,
        source: 'surface-questions',
        specId: meta.id,
        kind: 'spec',
      });
    });
}

function buildSystem(
  agentBody: string,
  meta: SpecMeta,
  files: Record<string, string>
): string {
  const base = `You are the Kraken SDD agent helping with a ${meta.kind} spec titled "${meta.name}". Current phase: ${meta.phase}. Be precise. Output GitHub-flavored markdown. Do not invent behaviors that are not stated or strongly implied — ask once for missing context, then commit to a draft.`;
  const context = [
    files.requirements && `# requirements.md\n${files.requirements}`,
    files.bugfix && `# bugfix.md\n${files.bugfix}`,
    files.design && `# design.md\n${files.design}`,
    files.tasks && `# tasks.md\n${files.tasks}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return [base, agentBody, context && `# Current spec files\n\n${context}`]
    .filter(Boolean)
    .join('\n\n');
}
