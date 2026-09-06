import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  PanelRight,
  Check,
  ChevronRight,
  Code2,
  Link2,
  FileText,
  Loader2,
  Maximize2,
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
import { SpecReview } from './SpecReview';
import { RequirementsReview } from './RequirementsReview';
import { ZenReader } from './ZenReader';
import { StageBriefing } from './StageBriefing';
import { ShipView } from './ShipView';
import { MarkdownEditor } from '../MarkdownEditor';
import { OctoMark } from '../OctoMark';
import {
  draftSpecDoc,
  firstStageFile,
  groundingText,
  skillsFor,
  type SpecDocFile,
} from '../../lib/specActions';
import { isStubDoc } from '../../lib/specDoc';
import { checkDocument, fixInstructions } from '../../lib/formatCheck';
import { highlight } from '../../lib/prism';
import { matchingSkills, routeAgent } from '../../lib/agentRouter';
import { resolveAgent } from '../../lib/verifyLibrary';
import { hasDecisionsSection, parseOpenQuestions } from '../../lib/openQuestions';
import { surfaceQuestions } from '../../lib/specQuestions';
import { QuestionsView } from './QuestionsView';
import type { SpecMeta, SpecPhase } from '../../../electron/shared/types';
import { extractTasksSection } from '../../../electron/shared/planTasks';

const PHASE_ORDER: SpecPhase[] = ['requirements', 'plan', 'build', 'done'];
const STAGES: SpecStage[] = ['define', 'plan', 'build'];

/** The file each document key is called on disk — what Zen shows as its name. */
const DOC_FILE_NAMES: Record<SpecDocFile, string> = {
  requirements: 'requirements.md',
  bugfix: 'bugfix.md',
  plan: 'plan.md',
  tasks: 'tasks.md',
};

/**
 * How a doc stage renders: line-numbered source (default), section cards, the
 * linked criteria↔plan review (plan.md only), or raw edit.
 */
type DocView = 'source' | 'cards' | 'review' | 'edit';

/**
 * Which view a document opens on the first time you see it.
 *
 * An **empty** document opens on Edit. Specs no longer start from a template,
 * so a new one has genuinely nothing to read — landing on a reading view means
 * looking at an empty-state card and then hunting for the way to type. Edit is
 * where the work is.
 *
 * Anything with content opens on **Review**, because that is the question these
 * documents exist to answer: on the plan, is every criterion covered; on the
 * requirements, can this be planned. `tasks.md` is the exception — it is a list
 * to execute, not a document to review, so it opens on its source.
 */
function defaultViewFor(file: SpecDocFile, content: string): DocView {
  if (!content.trim()) return 'edit';
  if (file === 'tasks') return 'source';
  // Review groups acceptance criteria; with none to group it is an empty panel.
  // A document imported from a ticket is exactly that case — it has real content
  // but its criteria are still the ticket's wording, so read it as source until
  // they have been put in EARS form.
  return /\bSHALL\b/.test(content) ? 'review' : 'source';
}

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
  const closeSpec = useUi((s) => s.closeSpec);
  const openOverlay = useUi((s) => s.openOverlay);
  const zenOpen = useUi((s) => s.zenOpen);
  const setZen = useUi((s) => s.setZen);
  const specAsideOpen = useUi((s) => s.specAsideOpen);
  const toggleSpecAside = useUi((s) => s.toggleSpecAside);

  const [meta, setMeta] = useState<SpecMeta | null>(null);
  const [files, setFiles] = useState<Record<string, string>>({});
  // Each document remembers how it was last read. Empty until a document is
  // actually opened, because the sensible default depends on what is in it —
  // see `defaultViewFor`.
  const [views, setViews] = useState<Record<string, DocView>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [surfacing, setSurfacing] = useState(false);
  // Ship lives inside the Build stage. Before the spec is done there is nothing
  // to ship, so the switcher only appears at `done` — and lands on Ship, which
  // is the payoff the user just earned.
  const [buildTab, setBuildTab] = useState<'tasks' | 'doc' | 'ship'>('tasks');
  // The Plan stage opens on **Clarify** — the interactive question round that
  // runs before the plan is drafted — until its decisions have been applied.
  const [planTab, setPlanTab] = useState<'clarify' | 'doc'>('doc');
  const debounceRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  const load = async () => {
    const res = await window.octo.specs.read(root, specId);
    setMeta(res.meta);
    setFiles(res.files);
    return res;
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
      void load().then((res) => {
        // A plan run may come back with questions instead of a plan (the
        // drafting prompt clarifies before it drafts). Land the user where the
        // answers are given rather than on an untouched template.
        if (!isStubDoc(res.files.plan ?? '')) return;
        const reqMd = res.files[firstStageFile(res.meta.kind)] ?? '';
        const pending = parseOpenQuestions(reqMd).questions.some((q) => !q.resolved);
        if (pending) setPlanTab('clarify');
      });
    });
    return () => {
      off();
    };
  }, [root, specId]);

  useEffect(() => {
    if (meta?.phase === 'done') setBuildTab('ship');
  }, [meta?.phase]);

  // Which document is on screen right now — null over Clarify, the task board
  // and Ship. It doubles as the key the per-document view is remembered under.
  const docKey: SpecDocFile | null = !meta
    ? null
    : stage === 'define'
      ? firstStageFile(meta.kind)
      : stage === 'plan' && planTab === 'doc'
        ? 'plan'
        : stage === 'build' && buildTab === 'doc'
          ? 'tasks'
          : null;
  const onDocument = docKey !== null;
  const view: DocView = (docKey && views[docKey]) || 'source';
  const setView = (v: DocView) => {
    if (docKey) setViews((prev) => ({ ...prev, [docKey]: v }));
  };

  // Resolve each document's opening view **once**, the first time it is shown.
  //
  // It has to be latched rather than derived: the default for an empty document
  // is Edit, and a derived one would stop being empty at the first keystroke and
  // close the editor under the user's hands.
  useEffect(() => {
    if (!docKey || views[docKey]) return;
    setViews((prev) =>
      prev[docKey] ? prev : { ...prev, [docKey]: defaultViewFor(docKey, files[docKey] ?? '') }
    );
  }, [docKey, files, views]);

  // ⌘E jumps in and out of hand-editing — the shortcut for the one action the
  // old icon-only switcher hid. (⌘⇧E is the Explorer drawer, hence no shift.)
  useEffect(() => {
    if (!docKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'e') return;
      e.preventDefault();
      setViews((prev) => {
        const cur = prev[docKey] ?? defaultViewFor(docKey, files[docKey] ?? '');
        return { ...prev, [docKey]: cur === 'edit' ? 'source' : 'edit' };
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docKey]);

  // ⌘⇧Z opens Zen — the full-window reading mode. Not bound while hand-editing,
  // where the same chord is the textarea's redo.
  useEffect(() => {
    if (!docKey || view === 'edit') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      setZen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docKey, view, setZen]);

  // Zen reads the document on screen, so it leaves with it (Clarify, the task
  // board and Ship are not documents).
  useEffect(() => {
    if (!docKey && zenOpen) setZen(false);
  }, [docKey, zenOpen, setZen]);

  const audit = useAudit(meta, files, load);

  if (!meta) return <div className="p-6 text-sm text-ink-400">Loading spec…</div>;

  const phaseIdx = PHASE_ORDER.indexOf(meta.phase);
  const stageIdx = STAGES.indexOf(stage);
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
    const res = await load();
    await refreshAll();
    const next = STAGES[Math.min(stageIdx + 1, STAGES.length - 1)];
    // Requirements → Plan goes through Clarify first (Cursor's plan mode asks
    // before it drafts), unless those decisions are already settled on disk.
    if (next === 'plan') {
      const reqMd = res.files[firstStageFile(updated.kind)] ?? '';
      setPlanTab(hasDecisionsSection(reqMd) ? 'doc' : 'clarify');
    }
    setStage(next);
  };

  const reopenTasks = async () => {
    const updated = await window.octo.specs.setPhase(root, specId, 'build');
    setMeta(updated);
    await load();
    await refreshAll();
    setBuildTab('tasks');
    setStage('build');
  };

  // Menu action: surface the questions from wherever the user is, then take
  // them to the Clarify panel (the overlay when they're not on the Plan stage).
  const findQuestions = async () => {
    if (!file || surfacing) return;
    setSurfacing(true);
    const added = await surfaceQuestions(meta, files, firstStageFile(meta.kind), root);
    setSurfacing(false);
    await load();
    if (added > 0) {
      if (meta.phase === 'requirements') openOverlay({ kind: 'questions', specId: meta.id });
      else {
        setStage('plan');
        setPlanTab('clarify');
      }
    }
  };

  /** Clarify → plan: decisions are written, so draft the plan if it's a stub. */
  const clarifyDone = async () => {
    const res = await load();
    setPlanTab('doc');
    if (isStubDoc(res.files.plan ?? '')) {
      // They just answered everything — the drafting prompt must not open a
      // second, invisible round of questions.
      void draftSpecDoc({ meta: res.meta, files: res.files, file: 'plan', noStops: true });
    }
  };

  const removeSpec = async () => {
    await deleteSpec(meta.id);
    closeSpec();
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
  // Clarify is a panel inside the Plan stage, the way Ship is one inside Build.
  const showingClarify = stage === 'plan' && stageIdx <= phaseIdx && planTab === 'clarify';
  const openQuestionCount = parseOpenQuestions(
    files[firstStageFile(meta.kind)] ?? ''
  ).questions.filter((q) => !q.resolved).length;

  // The same document stage serves `define` and the Plan stage's `plan.md` tab.
  const docStage = file ? (
    <DocStage
      meta={meta}
      files={files}
      file={file}
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
      asideOpen={specAsideOpen}
    />
  ) : null;

  return (
    <div className="h-full flex flex-col bg-ink-950">
      {/* Zen — the full-window reading mode for the document on screen. It takes
          the whole viewport (fixed), so the rest of the flow stays mounted
          underneath and comes back exactly as it was on Esc. */}
      {zenOpen && docKey && (
        <ZenReader
          meta={meta}
          file={docKey}
          fileName={DOC_FILE_NAMES[docKey]}
          content={files[docKey] ?? ''}
          files={files}
          gate={
            stageIdx === phaseIdx && (stage === 'define' || stage === 'plan')
              ? {
                  label: `Approve ${labels[stageIdx].toLowerCase()}`,
                  next: labels[stageIdx + 1],
                  blocked: gateBlocked,
                  onApprove: approve,
                }
              : null
          }
          onClose={() => setZen(false)}
        />
      )}

      {/* Row 1 — file tabs (the stages as documents) + doc tools */}
      <div className="flex items-end gap-0.5 px-4 pt-1.5 shrink-0 border-b border-ink-50/[0.05]">
        {STAGES.map((s, i) => {
          const active = i === stageIdx;
          const reachable = i <= phaseIdx;
          return (
            <button
              key={s}
              disabled={!reachable}
              onClick={() => {
                if (!reachable) return;
                // The file tab names a document, so it opens the document —
                // Clarify is reached through the stage's own sub-tab.
                if (s === 'plan') setPlanTab('doc');
                setStage(s);
              }}
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
          {onDocument && <ViewSwitcher view={view} onView={setView} file={docKey} />}
          {onDocument && (
            <button
              onClick={() => setZen(true)}
              title="Zen — read this document full screen  (⌘⇧Z)"
              className="w-8 h-8 grid place-items-center rounded-lg text-ink-300 hover:text-ink-50 hover:bg-ink-800 transition"
            >
              <Maximize2 size={14} />
            </button>
          )}
          {onDocument && (
            <button
              onClick={toggleSpecAside}
              title={specAsideOpen ? 'Hide who writes this' : 'Show who writes this'}
              className={cn(
                'w-8 h-8 grid place-items-center rounded-lg transition',
                specAsideOpen
                  ? 'text-accent bg-accent/12'
                  : 'text-ink-300 hover:text-ink-50 hover:bg-ink-800'
              )}
            >
              <PanelRight size={14} />
            </button>
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
                {(stage === 'define' || stage === 'plan') && (
                  <MenuItem
                    icon={
                      surfacing ? <Loader2 size={13} className="animate-spin" /> : <HelpCircle size={13} />
                    }
                    label="Find open decisions"
                    hint="clarify before the plan"
                    onClick={() => {
                      setMenuOpen(false);
                      void findQuestions();
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

      {/* Row 2 — spec strip: name + breadcrumb, with the phase chips on the right.
          One row instead of two: vertical space is the document's. */}
      <div className="flex items-center gap-4 px-5 py-2 shrink-0 min-w-0">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-50 shrink-0">
          <FileText size={14} className="text-accent" />
          Spec: {meta.name}
        </span>
        <span className="hidden lg:flex items-center gap-1.5 font-mono text-[11px] text-faint min-w-0">
          <ChevronRight size={11} className="text-ink-600 shrink-0" />
          <span className="truncate max-w-[200px]">{meta.id}</span>
          <ChevronRight size={11} className="text-ink-600 shrink-0" />
          <span className="text-dim truncate">
            {showingShip
              ? 'summary.md'
              : showingClarify
                ? `${fileNames[0]} · open questions`
                : fileNames[stageIdx]}
          </span>
        </span>
        <div className="ml-auto shrink-0">
          <Stepper
            labels={labels}
            phaseIdx={phaseIdx}
            stageIdx={stageIdx}
            onNavigate={(i) => setStage(STAGES[i])}
          />
        </div>
      </div>

      {/* Stage body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {stage === 'build' ? (
          stageIdx <= phaseIdx ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-1 px-5 pt-2 shrink-0">
                <SubTab active={buildTab === 'tasks'} onClick={() => setBuildTab('tasks')}>
                  Task list
                </SubTab>
                <SubTab active={buildTab === 'doc'} onClick={() => setBuildTab('doc')}>
                  tasks.md
                </SubTab>
                {shipReady && (
                  <SubTab active={buildTab === 'ship'} onClick={() => setBuildTab('ship')}>
                    Ship
                  </SubTab>
                )}
              </div>
              {showingShip ? (
                <ShipView meta={meta} onReopen={reopenTasks} />
              ) : buildTab === 'doc' ? (
                // tasks.md as a document: the Build stage used to be the one
                // place where the markdown couldn't be read or hand-edited.
                <div className="flex-1 min-h-0">
                  <DocBody
                    meta={meta}
                    files={files}
                    file="tasks"
                    content={content}
                    view={view}
                    onChange={onChange}
                    onEdit={() => setView('edit')}
                  />
                </div>
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
        ) : stage === 'plan' ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-1 px-5 pt-2 shrink-0">
              <SubTab active={planTab === 'clarify'} onClick={() => setPlanTab('clarify')}>
                Clarify
                {openQuestionCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-px rounded-full bg-agent/20 text-agent-text text-[10px] tabular-nums">
                    {openQuestionCount}
                  </span>
                )}
              </SubTab>
              <SubTab active={planTab === 'doc'} onClick={() => setPlanTab('doc')}>
                plan.md
              </SubTab>
            </div>
            {showingClarify ? (
              <div className="flex-1 min-h-0">
                <QuestionsView
                  specId={meta.id}
                  variant="stage"
                  onSkip={() => setPlanTab('doc')}
                  onDone={() => void clarifyDone()}
                />
              </div>
            ) : (
              docStage
            )}
          </div>
        ) : (
          docStage
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

/** Sub-tab inside a stage: Clarify / plan.md, or the task list / Ship. */
function SubTab({
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

/**
 * How the document is being shown — **Source / Cards / Edit**.
 *
 * These used to be three unlabelled 12px icons in the corner, which is exactly
 * how you lose the way into editing. They are now a labelled segmented control:
 * the mode you are in reads as a pressed pill, Edit carries its ⌘E hint, and
 * the group only renders when a document is actually on screen.
 */
function ViewSwitcher({
  view,
  onView,
  file,
}: {
  view: DocView;
  onView: (v: DocView) => void;
  file: SpecDocFile | null;
}) {
  const items: { key: DocView; icon: React.ReactNode; label: string; title: string }[] = [
    {
      key: 'source',
      icon: <Code2 size={12.5} />,
      label: 'Source',
      title: 'Source — the raw markdown, line-numbered',
    },
    {
      key: 'cards',
      icon: <BookOpen size={12.5} />,
      label: 'Cards',
      title: 'Cards — one card per section, easier to scan',
    },
    // Review exists where a document has to hold against another: the plan
    // against the criteria, the criteria against the stories that ask for them.
    // `tasks.md` has no counterpart — the task board is its review.
    ...(file === 'tasks'
      ? []
      : [
          {
            key: 'review' as DocView,
            icon: <Link2 size={12.5} />,
            label: 'Review',
            title:
              file === 'plan'
                ? 'Review — each acceptance criterion beside the plan that satisfies it'
                : 'Review — each criterion under the user story it answers, and whether it can be tested',
          },
        ]),
    {
      key: 'edit',
      icon: <Pencil size={12.5} />,
      label: 'Edit',
      title: 'Edit the markdown by hand  (⌘E)',
    },
  ];
  return (
    <div className="flex items-center rounded-lg bg-ink-50/[0.04] p-0.5">
      {items.map((v) => {
        const active = view === v.key;
        return (
          <button
            key={v.key}
            onClick={() => onView(v.key)}
            title={v.title}
            aria-pressed={active}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] transition',
              active
                ? v.key === 'edit'
                  ? 'bg-accent/15 text-accent-text ring-1 ring-inset ring-accent/25'
                  : 'bg-elev text-ink-50'
                : 'text-faint hover:text-ink-100'
            )}
          >
            {v.icon}
            <span className="hidden sm:inline">{v.label}</span>
          </button>
        );
      })}
    </div>
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
  asideOpen,
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
  /** show the briefing aside — who writes this document and how */
  asideOpen: boolean;
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
          <OctoMark animated className="w-[18px]" />
          Claude is drafting {file}.md — the document refreshes when it finishes. Watch progress in
          the Assistant (⌘J).
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0">
          <DocBody
            meta={meta}
            files={files}
            file={file}
            content={content}
            view={view}
            onChange={onChange}
            onEdit={onEdit}
          />
        </div>
        {/* Hidden below 1180px, the same breakpoint `.k-split` uses to decide a
            window is wide enough for a primary column plus an aside. */}
        {asideOpen && (
          <div className="hidden [@media(min-width:1180px)]:block shrink-0">
            <StageBriefing meta={meta} files={files} file={file} content={content} drafting={drafting} />
          </div>
        )}
      </div>

      {/* Which skills a draft of this document would carry, and the one action
          that runs it with all of them. Only on the plan: it is the document
          whose quality actually turns on domain knowledge. */}
      {file === 'plan' && (
        <PlanSkillsBar meta={meta} files={files} file={file} drafting={drafting} />
      )}

      {/* Format check — computed from the same parsers the app reads these
          documents with, so it costs nothing and can't invent a violation. */}
      <FormatStrip meta={meta} files={files} file={file} content={content} drafting={drafting} />

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
 * The instructions a plan draft would carry, and a one-press way to run it with
 * all of them.
 *
 * Spec drafting has always injected the two base skills — the SDD skill for the
 * stages and gates, the format skill for the document's shape. What it never
 * did was notice that *this* plan is about a database migration and a React
 * form, and pull in the skills that know about those; `bestSkillByText` existed
 * but only task runs ever called it.
 *
 * The detected skills are shown before the run, not after: a plan drafted with
 * a skill you did not expect is worse than one drafted without it.
 */
function PlanSkillsBar({
  meta,
  files,
  file,
  drafting,
}: {
  meta: SpecMeta;
  files: Record<string, string>;
  file: SpecDocFile;
  drafting: boolean;
}) {
  const skills = useWorkspace((s) => s.skills);
  const base = useMemo(() => skillsFor(meta, file, skills), [meta, file, skills]);
  const detected = useMemo(
    () => matchingSkills(groundingText(meta, files), skills),
    [meta, files, skills]
  );
  // Detection is a suggestion. Clicking a chip drops it from this run — the
  // scoring is substring-based, so it will occasionally offer a skill that
  // matched a word rather than the work.
  const [dropped, setDropped] = useState<string[]>([]);
  const chosen = detected.filter((s) => !dropped.includes(s.name));

  if (!base.length && !detected.length) return null;
  const hasPlan = Boolean(files.plan?.trim());

  return (
    <div className="shrink-0 border-t border-ink-700/60 bg-ink-900/40">
      <div className="flex items-center gap-2.5 px-6 py-2 flex-wrap">
        <Sparkles size={12} className="text-accent shrink-0" />
        <span className="text-[11px] text-faint">Drafts with</span>
        {base.map((s) => (
          <span
            key={s.name}
            title="Injected into every spec run"
            className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-ink-800 text-ink-300"
          >
            {s.name}
          </span>
        ))}
        {detected.length > 0 ? (
          <>
            <span className="text-[11px] text-faint">+ detected</span>
            {detected.map((s) => {
              const on = !dropped.includes(s.name);
              return (
                <button
                  key={s.name}
                  onClick={() =>
                    setDropped((d) => (on ? [...d, s.name] : d.filter((n) => n !== s.name)))
                  }
                  title={`${s.description}\n\nClick to ${on ? 'leave it out of' : 'include it in'} the draft.`}
                  className={cn(
                    'text-[10.5px] font-mono px-1.5 py-0.5 rounded transition',
                    on
                      ? 'bg-accent/15 text-accent hover:bg-accent/25'
                      : 'bg-ink-800 text-ink-600 line-through hover:text-ink-400'
                  )}
                >
                  {s.name}
                </button>
              );
            })}
          </>
        ) : (
          <span className="text-[11px] text-faint">
            · no domain skill matches this work
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() =>
            void draftSpecDoc({
              meta,
              files,
              file,
              domainSkills: chosen.map((s) => s.name),
              improve: hasPlan,
            })
          }
          disabled={drafting}
          title={
            hasPlan
              ? 'Re-draft the plan with every skill above, including the detected ones'
              : 'Draft the plan with every skill above, including the detected ones'
          }
          className="flex items-center gap-1.5 text-[11.5px] px-3 py-1.5 rounded-lg bg-accent/12 text-accent hover:bg-accent/20 transition disabled:opacity-50"
        >
          {drafting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          {hasPlan ? 'Redraft with these skills' : 'Generate plan with these skills'}
          {chosen.length > 0 && (
            <span className="text-[10px] opacity-70">+{chosen.length}</span>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * What in this document the app cannot parse.
 *
 * Deliberately not a hook: every finding comes from the parsers the rest of the
 * app already runs on this text, so it is instant and free, and *Fix with
 * Claude* hands the concrete list to a normal improve run rather than asking
 * the model to go looking.
 */
function FormatStrip({
  meta,
  files,
  file,
  content,
  drafting,
}: {
  meta: SpecMeta;
  files: Record<string, string>;
  file: SpecDocFile;
  content: string;
  drafting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const report = useMemo(
    () => checkDocument(file, content, { planMd: files.plan, tasksMd: files.tasks }),
    [file, content, files.plan, files.tasks]
  );

  // A stub is the template Octo just wrote; flagging its placeholders as the
  // user's mistake would be noise on every freshly created spec.
  if (!report.findings.length || isStubDoc(content)) return null;

  const n = report.findings.length;
  return (
    <div className="shrink-0 border-t border-ink-700/60 bg-warn/[0.06]">
      <div className="flex items-center gap-2.5 px-6 py-2">
        <AlertTriangle size={13} className="text-warn shrink-0" />
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[12px] text-ink-200 hover:text-ink-50 transition text-left"
        >
          {n} formatting {n === 1 ? 'issue' : 'issues'} Octo can't parse
          <span className="text-faint"> · {open ? 'hide' : 'show'}</span>
        </button>
        <div className="flex-1" />
        {report.fixable > 0 && (
          <button
            onClick={() =>
              void draftSpecDoc({ meta, files, file, feedback: fixInstructions(report) })
            }
            disabled={drafting}
            title="Hands the list below to Claude as a targeted revision"
            className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-accent/12 text-accent hover:bg-accent/20 transition disabled:opacity-50"
          >
            {drafting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            Fix with Claude
          </button>
        )}
      </div>
      {open && (
        <ul className="px-6 pb-3 space-y-1.5">
          {report.findings.map((f) => (
            <li key={f.code} className="flex gap-2 text-[11.5px] leading-snug">
              <span
                className={cn(
                  'shrink-0 mt-[3px] px-1.5 py-px rounded text-[10px] font-medium',
                  f.fixable ? 'bg-accent/15 text-accent' : 'bg-agent/15 text-agent-text'
                )}
              >
                {f.fixable ? 'fixable' : 'judgement'}
              </span>
              <span className="text-dim">{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One spec document, in whichever view is selected. */
function DocBody({
  meta,
  files,
  file,
  content,
  view,
  onChange,
  onEdit,
}: {
  meta: SpecMeta;
  files: Record<string, string>;
  file: SpecDocFile;
  content: string;
  view: DocView;
  onChange: (v: string) => void;
  onEdit: () => void;
}) {
  if (view === 'edit') {
    return <MarkdownEditor value={content} onChange={onChange} placeholder="Start writing…" />;
  }
  // An empty document has no sections to lay out as source, so it falls back to
  // the Cards view's empty state — which now also shows what a draft would be
  // grounded in. Only for the first document: the plan is drafted from the
  // approved requirements, which are already on screen a tab away.
  const draftSource =
    (file === 'requirements' || file === 'bugfix') && meta.brief?.trim()
      ? {
          label: meta.ticket?.key ? `From ${meta.ticket.key}` : 'What you asked for',
          text: meta.brief.trim(),
        }
      : null;
  if (!content.trim())
    return <SpecDocument md={content} onEdit={onEdit} source={draftSource} />;
  if (view === 'review') {
    // Same segment, two questions: on the plan "is every criterion covered?",
    // on the requirements "can this be planned?".
    return file === 'plan' ? (
      <SpecReview
        requirementsMd={files.requirements ?? files.bugfix ?? ''}
        planMd={content}
        tasksMd={files.tasks ?? ''}
        reqLabel={meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md'}
      />
    ) : (
      <RequirementsReview
        meta={meta}
        requirementsMd={content}
        planMd={files.plan ?? ''}
        tasksMd={files.tasks ?? ''}
      />
    );
  }
  if (view === 'cards') return <SpecDocument md={content} onEdit={onEdit} />;
  return <SourceDoc md={content} onEdit={onEdit} />;
}

/**
 * The Kiro-style reading view: the document as line-numbered, markdown-
 * highlighted source. Markdown is line-oriented, so per-line highlighting
 * keeps headings / lists / emphasis colored without multi-line token state.
 */
function SourceDoc({ md, onEdit }: { md: string; onEdit?: () => void }) {
  const lines = useMemo(() => md.replace(/\n$/, '').split('\n'), [md]);
  return (
    <div className="h-full overflow-auto">
      <div
        className="k-full py-5 octo-editor text-[13px]"
        // Clicking into text to type is the reflex; honour it rather than
        // making the user find the Edit segment first.
        onDoubleClick={onEdit}
        title={onEdit ? 'Double-click to edit  (⌘E)' : undefined}
      >
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
