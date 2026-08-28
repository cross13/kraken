import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  PencilLine,
  RotateCcw,
  Sparkles,
  Stethoscope,
  HelpCircle,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useChat } from '../../stores/chat';
import { useOrchestrator } from '../../stores/orchestrator';
import { useUi, type SpecStage } from '../../stores/ui';
import { cn } from '../../lib/cn';
import { TaskRunner } from './TaskRunner';
import { SpecDocument } from './SpecDocument';
import { ShipView } from './ShipView';
import { MarkdownEditor } from '../MarkdownEditor';
import { OctoLogo } from '../OctoLogo';
import { draftSpecDoc, firstStageFile, type SpecDocFile } from '../../lib/specActions';
import { isStubDoc } from '../../lib/specDoc';
import { highlight } from '../../lib/prism';
import { routeAgent } from '../../lib/agentRouter';
import { resolveAgent } from '../../lib/verifyLibrary';
import { parseOpenQuestions, addQuestion } from '../../lib/openQuestions';
import type { SpecMeta, SpecPhase } from '../../../electron/shared/types';
import { extractTasksSection } from '../../../electron/shared/planTasks';

const PHASE_ORDER: SpecPhase[] = ['requirements', 'plan', 'build', 'done'];
const STAGES: SpecStage[] = ['define', 'plan', 'build'];

/** How a doc stage renders: line-numbered source (default), section cards, or raw edit. */
type DocView = 'source' | 'cards' | 'edit';

function stageLabels(kind: 'feature' | 'bugfix') {
  return kind === 'feature'
    ? ['Requirements', 'Plan', 'Build']
    : ['Bug analysis', 'Plan', 'Build'];
}

function stageFileNames(kind: 'feature' | 'bugfix') {
  return [
    kind === 'feature' ? 'requirements.md' : 'bugfix.md',
    'plan.md',
    'tasks.md',
  ];
}

/**
 * The Spec surface — one continuous guided flow per spec. A phase stepper is
 * the navigation; each doc stage ends in a gate bar whose Approve both
 * advances the phase and navigates to the next doc; Tasks executes inline;
 * Ship is the automatic completion payoff.
 */
export function SpecFlow({ specId }: { specId: string }) {
  const root = useWorkspace((s) => s.root)!;
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const deleteSpec = useWorkspace((s) => s.deleteSpec);
  const stage = useUi((s) => s.specStage);
  const setStage = useUi((s) => s.setSpecStage);
  const setSurface = useUi((s) => s.setSurface);
  const openOverlay = useUi((s) => s.openOverlay);

  const [meta, setMeta] = useState<SpecMeta | null>(null);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [view, setView] = useState<DocView>('source');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [surfacing, setSurfacing] = useState(false);
  // Ship lives inside the Build stage. Before the spec is done there is nothing
  // to ship, so the switcher only appears at `done` — and lands on Ship, which
  // is the payoff the user just earned.
  const [buildTab, setBuildTab] = useState<'tasks' | 'ship'>('tasks');
  const debounceRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  const load = async () => {
    const res = await window.octo.specs.read(root, specId);
    setMeta(res.meta);
    setFiles(res.files);
  };

  useEffect(() => {
    load();
  }, [root, specId]);

  // Agents edit spec files from anywhere (Home drafts, hooks, the Assistant).
  // Reload from disk whenever any Claude run finishes, unless the user has
  // unsaved local edits.
  useEffect(() => {
    const off = window.octo.claude.onEvent((ev) => {
      if (ev.type !== 'done' && ev.type !== 'error') return;
      if (dirtyRef.current) return;
      void load();
    });
    return () => {
      off();
    };
  }, [root, specId]);

  useEffect(() => {
    if (meta?.phase === 'done') setBuildTab('ship');
  }, [meta?.phase]);

  const audit = useAudit(meta, files, load);

  if (!meta) return <div className="p-6 text-sm text-ink-400">Loading spec…</div>;

  const phaseIdx = PHASE_ORDER.indexOf(meta.phase);
  const stageIdx = STAGES.indexOf(stage);
  const isDocStage = stage === 'define' || stage === 'plan';
  const file: SpecDocFile | null =
    stage === 'define' ? firstStageFile(meta.kind) : stage === 'plan' ? 'plan' : stage === 'build' ? 'tasks' : null;
  const content = file ? (files[file] ?? '') : '';

  const onChange = (v: string) => {
    if (!file) return;
    setFiles((prev) => ({ ...prev, [file]: v }));
    dirtyRef.current = true;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setSaving(true);
    debounceRef.current = window.setTimeout(async () => {
      const updated = await window.octo.specs.writeFile(root, specId, file, v);
      setMeta(updated);
      setSaving(false);
      setSavedAt(Date.now());
      debounceRef.current = null;
      dirtyRef.current = false;
    }, 400);
  };

  const approve = async () => {
    const updated = await window.octo.specs.advance(root, specId);
    setMeta(updated);
    await load();
    await refreshAll();
    setStage(STAGES[Math.min(stageIdx + 1, STAGES.length - 1)]);
  };

  const reopenTasks = async () => {
    const updated = await window.octo.specs.setPhase(root, specId, 'build');
    setMeta(updated);
    await load();
    await refreshAll();
    setBuildTab('tasks');
    setStage('build');
  };

  const surfaceQuestions = async () => {
    if (!file || surfacing) return;
    setSurfacing(true);
    const added = await runSurfaceQuestions(meta, files, file, root);
    setSurfacing(false);
    await load();
    if (added > 0) openOverlay({ kind: 'questions', specId: meta.id });
  };

  const removeSpec = async () => {
    await deleteSpec(meta.id);
    setSurface('home');
  };

  const labels = stageLabels(meta.kind);
  const fileNames = stageFileNames(meta.kind);
  // The Plan gate is the one gate with a hard precondition: approving it derives
  // tasks.md from the plan's `## Tasks` section, so a plan without one would land
  // the user in an empty Build stage.
  const gateBlocked =
    stage === 'plan' && !!files.plan?.trim() && extractTasksSection(files.plan) === null
      ? 'This plan has no ## Tasks section yet — Approve would leave Build empty. Use Improve with Claude to add the waves.'
      : null;
  const shipReady = meta.phase === 'done';
  const showingShip = stage === 'build' && shipReady && buildTab === 'ship';

  return (
    <div className="h-full flex flex-col bg-ink-950">
      {/* Row 1 — file tabs (the stages as documents) + doc tools */}
      <div className="flex items-end gap-0.5 px-4 pt-1.5 shrink-0 border-b border-ink-50/[0.05]">
        {STAGES.map((s, i) => {
          const active = i === stageIdx;
          const reachable = i <= phaseIdx;
          return (
            <button
              key={s}
              disabled={!reachable}
              onClick={() => reachable && setStage(s)}
              title={reachable ? fileNames[i] : `${fileNames[i]} — locked until the previous gate is approved`}
              className={cn(
                'relative px-3.5 py-2.5 text-[13px] rounded-t-lg transition',
                active
                  ? 'text-ink-50 bg-ink-50/[0.03]'
                  : reachable
                    ? 'text-faint hover:text-ink-100'
                    : 'text-ink-600 cursor-default'
              )}
            >
              {fileNames[i]}
              {active && (
                <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-accent" />
              )}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2 pb-1.5 shrink-0">
          <SaveStatus saving={saving} savedAt={savedAt} />
          {isDocStage && (
            <div className="flex rounded-lg bg-ink-50/[0.04] p-0.5">
              {(
                [
                  { key: 'source', icon: <Code2 size={12} />, title: 'Source — the raw markdown, line-numbered' },
                  { key: 'cards', icon: <BookOpen size={12} />, title: 'Cards — structured section view' },
                  { key: 'edit', icon: <Pencil size={12} />, title: 'Edit the markdown' },
                ] as { key: DocView; icon: React.ReactNode; title: string }[]
              ).map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  title={v.title}
                  className={cn(
                    'px-2 py-1 rounded-md transition',
                    view === v.key ? 'bg-elev text-ink-50' : 'text-faint hover:text-ink-100'
                  )}
                >
                  {v.icon}
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              title="More actions"
              className="w-8 h-8 grid place-items-center rounded-lg text-ink-300 hover:text-ink-50 hover:bg-ink-800 transition"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-9 z-30 w-[240px] rounded-xl bg-elev ring-1 ring-ink-50/[0.07] shadow-card p-1.5"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <MenuItem
                  icon={<Stethoscope size={13} />}
                  label="Audit for drift"
                  hint="spec-doctor, read-only"
                  onClick={() => {
                    setMenuOpen(false);
                    audit();
                  }}
                />
                {stage === 'define' && (
                  <MenuItem
                    icon={
                      surfacing ? <Loader2 size={13} className="animate-spin" /> : <HelpCircle size={13} />
                    }
                    label="Surface open questions"
                    hint="review before design"
                    onClick={() => {
                      setMenuOpen(false);
                      void surfaceQuestions();
                    }}
                  />
                )}
                {meta.phase === 'done' && (
                  <MenuItem
                    icon={<RotateCcw size={13} />}
                    label="Reopen tasks (re-sync)"
                    hint="spec drifted from code"
                    onClick={() => {
                      setMenuOpen(false);
                      void reopenTasks();
                    }}
                  />
                )}
                <MenuItem
                  icon={<Trash2 size={13} />}
                  label="Delete spec"
                  hint="folder + history"
                  danger
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2 — breadcrumb */}
      <div className="flex items-center gap-1.5 px-5 pt-3 pb-1 font-mono text-[11.5px] text-faint shrink-0">
        <span>.octo</span>
        <ChevronRight size={11} className="text-ink-600 shrink-0" />
        <span>specs</span>
        <ChevronRight size={11} className="text-ink-600 shrink-0" />
        <span className="truncate max-w-[220px]">{meta.id}</span>
        <ChevronRight size={11} className="text-ink-600 shrink-0" />
        <span className="text-ink-200">{showingShip ? 'summary.md' : fileNames[stageIdx]}</span>
      </div>

      {/* Row 3 — spec strip: name + numbered phase chips */}
      <div className="flex items-center gap-4 px-5 py-2 shrink-0 min-w-0 overflow-x-auto">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-50 shrink-0">
          <FileText size={14} className="text-accent" />
          Spec: {meta.name}
        </span>
        <Stepper
          labels={labels}
          phaseIdx={phaseIdx}
          stageIdx={stageIdx}
          onNavigate={(i) => setStage(STAGES[i])}
        />
      </div>

      {/* Stage body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {stage === 'build' ? (
          stageIdx <= phaseIdx ? (
            <div className="flex-1 min-h-0 flex flex-col">
              {shipReady && (
                <div className="flex items-center gap-1 px-5 pt-2 shrink-0">
                  <BuildTab active={buildTab === 'tasks'} onClick={() => setBuildTab('tasks')}>
                    Task list
                  </BuildTab>
                  <BuildTab active={buildTab === 'ship'} onClick={() => setBuildTab('ship')}>
                    Ship
                  </BuildTab>
                </div>
              )}
              {showingShip ? (
                <ShipView meta={meta} onReopen={reopenTasks} />
              ) : (
                <TaskRunner
                  meta={meta}
                  tasksMd={files.tasks ?? ''}
                  planMd={files.plan ?? ''}
                  requirementsMd={files.requirements ?? files.bugfix ?? ''}
                  onReload={load}
                  onShip={() => setBuildTab('ship')}
                />
              )}
            </div>
          ) : (
            <LockedStage
              label="Tasks"
              hint={`Approve ${labels[phaseIdx].toLowerCase()} first — each gate writes the next document's template.`}
            />
          )
        ) : stageIdx > phaseIdx ? (
          <LockedStage
            label={labels[stageIdx]}
            hint={`Approve ${labels[phaseIdx].toLowerCase()} first — each gate writes the next document's template.`}
          />
        ) : (
          <DocStage
            meta={meta}
            files={files}
            file={file!}
            content={content}
            view={view}
            onChange={onChange}
            onEdit={() => setView('edit')}
            stageIdx={stageIdx}
            phaseIdx={phaseIdx}
            nextLabel={labels[stageIdx + 1]}
            stageLabel={labels[stageIdx]}
            onApprove={approve}
            onContinue={() => setStage(STAGES[stageIdx + 1])}
            blocked={gateBlocked}
          />
        )}
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 grid place-items-center"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="w-[400px] rounded-xl bg-ink-900 ring-1 ring-ink-50/[0.08] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-ink-50 mb-1.5">Delete “{meta.name}”?</h3>
            <p className="text-[12px] text-ink-400 mb-4">
              Removes the spec folder on disk and its run history. This can't be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 rounded-md text-ink-300 hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                onClick={removeSpec}
                className="text-xs px-3 py-1.5 rounded-md bg-bad/20 text-bad hover:bg-bad/30"
              >
                Delete spec
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Sub-tab inside the Build stage: the task list, or the Ship panel. */
function BuildTab({
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
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-[12px] rounded-md transition',
        active ? 'bg-ink-50/[0.06] text-ink-50' : 'text-faint hover:text-ink-100'
      )}
    >
      {children}
    </button>
  );
}

/** Kiro-style numbered phase chips — the active one reads as a raised pill. */
function Stepper({
  labels,
  phaseIdx,
  stageIdx,
  onNavigate,
}: {
  labels: string[];
  phaseIdx: number;
  stageIdx: number;
  onNavigate: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {labels.map((s, i) => {
        // `done` is phase 3 but there is no fourth stage — every chip is complete.
        const complete = i < phaseIdx || phaseIdx === PHASE_ORDER.length - 1;
        const viewing = i === stageIdx;
        const reachable = i <= phaseIdx;
        return (
          <button
            key={s}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && onNavigate(i)}
            title={reachable ? `Open ${s}` : `${s} — locked until the previous gate is approved`}
            className={cn(
              'flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg transition shrink-0',
              viewing
                ? 'bg-elev text-ink-50 ring-1 ring-ink-50/[0.08]'
                : reachable
                  ? 'text-dim hover:bg-ink-50/[0.05] hover:text-ink-100'
                  : 'text-ink-600 cursor-default'
            )}
          >
            <span
              className={cn(
                'w-[19px] h-[19px] grid place-items-center rounded-full text-[10.5px] font-semibold shrink-0',
                complete
                  ? 'bg-ok/15 text-ok'
                  : viewing
                    ? 'bg-accent text-accent-fg'
                    : 'bg-ink-50/[0.07] text-faint'
              )}
            >
              {complete ? <Check size={11} /> : i + 1}
            </span>
            <span className="text-[12.5px] font-medium whitespace-nowrap">{s}</span>
          </button>
        );
      })}
    </div>
  );
}

function DocStage({
  meta,
  files,
  file,
  content,
  view,
  onChange,
  onEdit,
  stageIdx,
  phaseIdx,
  stageLabel,
  nextLabel,
  onApprove,
  onContinue,
  blocked,
}: {
  meta: SpecMeta;
  files: Record<string, string>;
  file: SpecDocFile;
  content: string;
  view: DocView;
  onChange: (v: string) => void;
  onEdit: () => void;
  stageIdx: number;
  phaseIdx: number;
  stageLabel: string;
  nextLabel: string;
  onApprove: () => Promise<void>;
  onContinue: () => void;
  /** why this gate can't be approved yet, or null */
  blocked?: string | null;
}) {
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [approving, setApproving] = useState(false);

  // Live drafting state: any spec-drafting run for this file, no matter where
  // it was started (Home composer, Quick Plan, the gate bar).
  const drafting = useOrchestrator((s) =>
    Object.values(s.runs).some(
      (r) =>
        r.specId === meta.id &&
        r.source === `spec:${file}` &&
        (r.status === 'running' || r.status === 'queued')
    )
  );

  // "Has content" isn't "has been written": creating a spec seeds a template.
  // A stub gets Draft as its primary action; Approve stays reachable anyway.
  const stub = isStubDoc(content);
  const empty = !content.trim();
  const atGate = stageIdx === phaseIdx;

  const draft = () => {
    // The composer text that created this spec grounds the very first draft.
    const isFirst = file === firstStageFile(meta.kind);
    void draftSpecDoc({ meta, files, file, brief: isFirst ? meta.brief : undefined });
  };

  const submitRevision = () => {
    const fb = feedback.trim();
    if (!fb) return;
    setRevising(false);
    setFeedback('');
    void draftSpecDoc({ meta, files, file, feedback: fb });
  };

  const approveClick = async () => {
    setApproving(true);
    try {
      await onApprove();
    } finally {
      setApproving(false);
    }
  };

  return (
    <>
      {drafting && (
        <div className="flex items-center gap-2.5 px-6 py-2 bg-accent/[0.07] text-accent text-[12px] shrink-0">
          <OctoLogo animated className="w-4 h-5 shrink-0" />
          Claude is drafting {file}.md — the document refreshes when it finishes. Watch progress in
          the Assistant (⌘J).
        </div>
      )}

      <div className="flex-1 min-h-0">
        {view === 'edit' ? (
          <MarkdownEditor value={content} onChange={onChange} placeholder="Start writing…" />
        ) : view === 'cards' || !content.trim() ? (
          <SpecDocument md={content} onEdit={onEdit} />
        ) : (
          <SourceDoc md={content} />
        )}
      </div>

      {/* Gate bar — the one CTA that moves the spec forward */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-3 bg-ink-900/50">
        {revising ? (
          <div className="flex-1 flex items-center gap-2">
            <PencilLine size={14} className="text-accent shrink-0" />
            <input
              autoFocus
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRevision();
                if (e.key === 'Escape') setRevising(false);
              }}
              placeholder={`What should change in ${stageLabel.toLowerCase()}? e.g. "split the export flow into its own story"`}
              className="flex-1 text-[13px] px-3 py-2 rounded-lg bg-bg focus:ring-1 focus:ring-accent outline-none"
            />
            <button
              onClick={() => setRevising(false)}
              className="text-[12px] px-2.5 py-2 rounded-lg text-dim hover:bg-elev"
            >
              <X size={13} className="inline -mt-0.5" /> Cancel
            </button>
            <button
              onClick={submitRevision}
              disabled={!feedback.trim() || drafting}
              className="text-[12px] flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 disabled:opacity-40 shadow-glow"
            >
              <Sparkles size={12} /> Revise
            </button>
          </div>
        ) : (
          <>
            {!stub && (
              <>
                <button
                  onClick={() => setRevising(true)}
                  disabled={drafting}
                  className="flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg bg-elev text-ink-100 hover:bg-line transition disabled:opacity-50"
                >
                  <PencilLine size={13} /> Revise with feedback…
                </button>
                <button
                  onClick={() => void draftSpecDoc({ meta, files, file, improve: true })}
                  disabled={drafting}
                  title={`Claude critically reviews ${stageLabel.toLowerCase()} — gaps, ambiguities, contradictions — and refines it in place`}
                  className="flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg bg-accent/12 text-accent hover:bg-accent/20 transition disabled:opacity-50"
                >
                  {drafting ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                  Improve with Claude
                </button>
              </>
            )}
            {blocked && (
              <span className="text-[11.5px] text-warn/90 leading-snug max-w-[46ch]">{blocked}</span>
            )}
            <div className="flex-1" />
            {stub ? (
              <>
                {!empty && atGate && (
                  <button
                    onClick={approveClick}
                    disabled={approving || drafting || !!blocked}
                    title={blocked ?? `Approve ${stageLabel.toLowerCase()} as written`}
                    className="flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg bg-elev text-ink-100 hover:bg-line transition disabled:opacity-50"
                  >
                    {approving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Approve as written
                  </button>
                )}
                <button
                  onClick={draft}
                  disabled={drafting}
                  className="flex items-center gap-1.5 text-[12.5px] px-4 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-glow transition disabled:opacity-50"
                >
                  {drafting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  Draft {stageLabel.toLowerCase()} with Claude
                </button>
              </>
            ) : atGate ? (
              <button
                onClick={approveClick}
                disabled={approving || drafting || !!blocked}
                title={blocked ?? `Marks ${stageLabel.toLowerCase()} approved and opens ${nextLabel}`}
                className="flex items-center gap-1.5 text-[12.5px] px-4 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-glow transition disabled:opacity-50"
              >
                {approving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Approve {stageLabel.toLowerCase()} <ArrowRight size={12} /> {nextLabel}
              </button>
            ) : (
              <button
                onClick={onContinue}
                className="flex items-center gap-1.5 text-[12.5px] px-4 py-2 rounded-lg bg-elev text-ink-100 hover:bg-line transition"
              >
                Continue <ArrowRight size={12} /> {nextLabel}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

/**
 * The Kiro-style reading view: the document as line-numbered, markdown-
 * highlighted source. Markdown is line-oriented, so per-line highlighting
 * keeps headings / lists / emphasis colored without multi-line token state.
 */
function SourceDoc({ md }: { md: string }) {
  const lines = useMemo(() => md.replace(/\n$/, '').split('\n'), [md]);
  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="octo-editor text-[13px]">
        {lines.map((l, i) => (
          <div key={i} className="code-line">
            <span className="code-ln" style={{ minWidth: '4ch' }}>
              {i + 1}
            </span>
            <span
              className="code-lc language-markdown"
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              dangerouslySetInnerHTML={{ __html: highlight(l || ' ', 'markdown') }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function LockedStage({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="h-full grid place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="w-12 h-12 mx-auto grid place-items-center rounded-2xl bg-ink-800 text-ink-500 mb-4">
          <Check size={20} />
        </div>
        <h3 className="text-sm font-semibold text-ink-100 mb-1">{label} is locked</h3>
        <p className="text-[12px] text-ink-400 leading-relaxed">{hint}</p>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition',
        danger ? 'text-bad hover:bg-bad/10' : 'text-ink-100 hover:bg-ink-50/[0.06]'
      )}
    >
      <span className={danger ? 'text-bad' : 'text-faint'}>{icon}</span>
      <span className="flex-1 text-[12.5px]">{label}</span>
      {hint && <span className="font-mono text-[10px] text-faint">{hint}</span>}
    </button>
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

// ---------------------------------------------------------------------------
// Audit (spec-doctor) — unchanged behavior, reported through the Assistant.

function useAudit(meta: SpecMeta | null, files: Record<string, string>, onReload?: () => void) {
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
  const setAssistantOpen = useUi((s) => s.setAssistantOpen);

  return () => {
    if (!meta) return;
    const specRel = meta.path.replace(root ? root + '/' : '', '');
    const reqLabel = meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md';
    const userText = `Audit the spec "${meta.name}" for inconsistencies (SDD re-sync).

Read \`${specRel}/${reqLabel}\`, \`${specRel}/plan.md\`, and \`${specRel}/tasks.md\`, then inspect the actual code in the workspace. Report:
1. Acceptance criteria with no corresponding task or implementation.
2. Tasks or code with no backing requirement (scope creep).
3. Places where the code contradicts the spec (drift).
4. A concrete recommendation: which spec phase to reopen (if any) and what to change.

Be specific — cite file:line. Do not edit anything; this is a read-only audit.`;

    push({ id: crypto.randomUUID(), role: 'user', content: userText, createdAt: Date.now() });
    setAssistantOpen(true);

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

    const off = window.octo.claude.onEvent((ev) => {
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

    const base = `You are the Octo SDD agent auditing a ${meta.kind} spec titled "${meta.name}". Current phase: ${meta.phase}.`;
    const context = [
      files.requirements && `# requirements.md\n${files.requirements}`,
      files.bugfix && `# bugfix.md\n${files.bugfix}`,
      files.plan && `# plan.md\n${files.plan}`,
      files.tasks && `# tasks.md\n${files.tasks}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    const system = [routed.body, base, context && `# Current spec files\n\n${context}`]
      .filter(Boolean)
      .join('\n\n---\n\n');

    window.octo.claude.stream({
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

// ---------------------------------------------------------------------------
// Surface open questions — appends deduped questions to `## Open Questions`.

function extractQuestionLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split('\n')) {
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

function runSurfaceQuestions(
  meta: SpecMeta,
  files: Record<string, string>,
  file: string,
  root: string
): Promise<number> {
  return new Promise<number>((resolve) => {
    const md = files[file] ?? '';
    const requestId = crypto.randomUUID();
    let acc = '';
    const orch = useOrchestrator.getState();

    orch.startRun({
      requestId,
      agent: null,
      source: 'surface-questions',
      kind: 'spec',
      title: `Surface questions · ${meta.name}`,
      specId: meta.id,
      startedAt: Date.now(),
      status: 'running',
    });

    const off = window.octo.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) acc += ev.text;
      if (ev.type === 'done' || ev.type === 'error') {
        off();
        useOrchestrator.getState().finishRun(requestId, ev.type === 'done' ? 'done' : 'error');
        if (ev.type === 'error') return resolve(0);
        const existing = new Set(
          parseOpenQuestions(md).questions.map((q) => q.text.trim().toLowerCase())
        );
        const fresh = extractQuestionLines(acc).filter((q) => !existing.has(q.toLowerCase()));
        if (!fresh.length) return resolve(0);
        let next = md;
        for (const q of fresh) next = addQuestion(next, q);
        window.octo.specs
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

    window.octo.claude.stream({
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
