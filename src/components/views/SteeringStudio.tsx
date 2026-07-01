import { useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Wand2,
  Plus,
  Search,
  Pin,
  PinOff,
  FileCode2,
  ExternalLink,
  Lock,
  Library,
  Eye,
  Trash2,
  Save,
  Globe,
  Briefcase,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { renderMarkdown } from '../../lib/markdown';
import { cn } from '../../lib/cn';
import type {
  SteeringFile,
  SteeringInclusion,
  SteeringWriteInput,
} from '../../../electron/shared/types';
import { ModuleHeader, ModuleTabs, ModuleSection, Explainer, Callout, ScopeChip } from '../ModuleShell';

const EXPLAINER = [
  {
    heading: 'What steering is',
    body: 'Markdown docs in .kraken/steering/ that carry project context — product, stack, conventions, domain knowledge. Kraken prepends the resolved set to every run\'s system prompt (chat, spec drafting, tasks, hooks).',
  },
  {
    heading: 'Always in context',
    body: 'Mode "always" injects the doc into every run. Best for the handful of facts every agent should never forget. Root CLAUDE.md / AGENTS.md are treated this way automatically.',
  },
  {
    heading: 'Looked up when relevant',
    body: '"fileMatch" injects a doc only when the run touches files matching a glob. "auto" advertises the doc in a menu so the model can pull it in itself. Both keep the prompt lean until the doc is actually needed.',
  },
  {
    heading: 'Pin to force-include',
    body: 'Pin any doc (📌) to force it into every run right now — regardless of its mode. Use it to hand the agents a spec or reference for the task at hand, then unpin when done.',
  },
];

const INCLUSION_META: Record<
  SteeringInclusion,
  { label: string; blurb: string }
> = {
  always: { label: 'Always', blurb: 'Injected into every run.' },
  fileMatch: { label: 'On matching files', blurb: 'Injected when the run touches files matching the glob.' },
  manual: { label: 'Manual', blurb: 'Only when pinned or referenced by #name.' },
  auto: { label: 'Auto (menu)', blurb: 'Advertised to the model, which pulls it in if relevant.' },
};

const BLANK: SteeringWriteInput = {
  name: '',
  description: '',
  inclusion: 'always',
  fileMatch: '',
  body: '',
  scope: 'workspace',
};

export function SteeringStudio() {
  const root = useWorkspace((s) => s.root);
  const steering = useWorkspace((s) => s.steering);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const [tab, setTab] = useState<'library' | 'preview'>('library');
  const [query, setQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return steering;
    return steering.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q)
    );
  }, [steering, query]);

  const workspaceDocs = filtered.filter((s) => s.scope === 'workspace');
  const globalDocs = filtered.filter((s) => s.scope === 'global');

  const selected =
    (!creating && steering.find((s) => s.path === selectedPath)) || filtered[0] || null;

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <ModuleHeader
        icon={<Compass size={18} />}
        title="Steering"
        subtitle={`${steering.length} docs · project context injected into every agent run`}
        actions={
          <>
            <button
              onClick={() => {
                setCreating(true);
                setTab('library');
              }}
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 h-8 rounded-lg bg-accent text-accent-fg hover:opacity-90"
            >
              <Plus size={13} /> New doc
            </button>
            <button
              onClick={seedDefaults}
              className="flex items-center gap-1.5 text-[12px] px-3 h-8 rounded-lg bg-elev text-dim hover:text-ink-50"
            >
              <Wand2 size={13} /> Seed defaults
            </button>
          </>
        }
      />

      {!root ? (
        <div className="flex-1 grid place-items-center text-[13px] text-faint">
          Open a folder to manage steering.
        </div>
      ) : (
        <>
          <ModuleTabs
            tabs={[
              { key: 'library', label: 'Library', icon: <Library size={13} /> },
              { key: 'preview', label: 'Injection preview', icon: <Eye size={13} /> },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'library' ? (
            <div className="flex-1 min-h-0 flex">
              {/* list */}
              <div className="w-[300px] shrink-0 border-r border-ink-800/40 flex flex-col min-h-0">
                <div className="p-3">
                  <div className="flex items-center gap-2 px-2.5 h-8 rounded-lg bg-elev">
                    <Search size={13} className="text-faint" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search steering…"
                      className="flex-1 bg-transparent text-[12.5px] text-ink-50 outline-none placeholder:text-faint"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-3">
                  {steering.length === 0 ? (
                    <div className="px-2 py-8 text-center">
                      <p className="text-[12px] text-faint mb-3">No steering docs yet.</p>
                      <button
                        onClick={seedDefaults}
                        className="text-[12px] px-3 py-1.5 rounded-lg bg-accent text-accent-fg font-semibold"
                      >
                        Seed defaults
                      </button>
                    </div>
                  ) : (
                    <>
                      <DocGroup
                        label="Project"
                        docs={workspaceDocs}
                        selected={selected}
                        creating={creating}
                        onSelect={(s) => {
                          setCreating(false);
                          setSelectedPath(s.path);
                        }}
                      />
                      <DocGroup
                        label="Global"
                        docs={globalDocs}
                        selected={selected}
                        creating={creating}
                        onSelect={(s) => {
                          setCreating(false);
                          setSelectedPath(s.path);
                        }}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* detail / editor */}
              <div className="flex-1 min-w-0 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-7 py-6">
                  <Explainer points={EXPLAINER} />
                  {creating ? (
                    <SteeringEditor
                      key="new"
                      initial={BLANK}
                      isNew
                      onSaved={(p) => {
                        setCreating(false);
                        setSelectedPath(p);
                      }}
                      onCancel={() => setCreating(false)}
                    />
                  ) : selected ? (
                    selected.editable === false ? (
                      <RootDocDetail doc={selected} />
                    ) : (
                      <SteeringEditor
                        key={selected.path}
                        initial={{
                          name: selected.name,
                          description: selected.description ?? '',
                          inclusion: selected.inclusion,
                          fileMatch: selected.fileMatch ?? '',
                          body: selected.body,
                          scope: selected.scope,
                          prevPath: selected.path,
                        }}
                        onSaved={(p) => setSelectedPath(p)}
                      />
                    )
                  ) : (
                    <div className="text-[13px] text-faint">Select a doc, or create a new one.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <PreviewPane />
          )}
        </>
      )}

      {/* mobile/quick create is inline in the detail pane; no modal needed */}
    </div>
  );
}

function DocGroup({
  label,
  docs,
  selected,
  creating,
  onSelect,
}: {
  label: string;
  docs: SteeringFile[];
  selected: SteeringFile | null;
  creating: boolean;
  onSelect: (s: SteeringFile) => void;
}) {
  const pins = useWorkspace((s) => s.steeringPins);
  if (docs.length === 0) return null;
  return (
    <div>
      <div className="font-mono text-[9.5px] tracking-[0.16em] text-ink-600 px-2 mb-1.5 uppercase">
        {label} · {docs.length}
      </div>
      <div className="space-y-0.5">
        {docs.map((s) => {
          const active = !creating && selected?.path === s.path;
          const pinned = pins.includes(s.name);
          return (
            <button
              key={s.path}
              onClick={() => onSelect(s)}
              className={cn(
                'w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition',
                active ? 'bg-accent/12 ring-1 ring-accent/30' : 'hover:bg-elev/60'
              )}
            >
              <Compass
                size={13}
                className={cn('mt-0.5 shrink-0', active ? 'text-accent' : 'text-dim')}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] text-ink-100 font-medium truncate">{s.name}</span>
                  {pinned && <Pin size={10} className="text-accent shrink-0" />}
                  {s.editable === false && <Lock size={10} className="text-faint shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wide bg-ink-800/70 text-ink-300">
                    {INCLUSION_META[s.inclusion].label}
                  </span>
                  {s.description && (
                    <span className="text-[11px] text-faint leading-snug line-clamp-1">
                      {s.description}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Read-only detail for the implicit root CLAUDE.md / AGENTS.md. */
function RootDocDetail({ doc }: { doc: SteeringFile }) {
  const openTab = useUi((s) => s.openTab);
  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 grid place-items-center rounded-xl bg-accent/12 text-accent shrink-0">
          <Compass size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[19px] font-bold text-ink-50 truncate">{doc.name}</h2>
            <ScopeChip scope={doc.scope} />
            <span className="flex items-center gap-1 text-[10px] font-mono text-faint px-1.5 py-0.5 rounded bg-ink-800/70 uppercase">
              <Lock size={10} /> read-only
            </span>
          </div>
          <p className="text-[13px] text-dim mt-0.5 leading-relaxed">{doc.description}</p>
        </div>
      </div>
      <Callout>
        This is a root project file, always injected into every run. Edit it directly — it isn't
        managed as a steering doc.{' '}
        <button
          onClick={() =>
            openTab({ id: `file:${doc.path}`, title: doc.name, kind: 'file', filePath: doc.path })
          }
          className="text-accent hover:underline inline-flex items-center gap-1"
        >
          Open file <ExternalLink size={10} />
        </button>
      </Callout>
      <ModuleSection title="Content" desc="Injected verbatim into every run's system prompt.">
        <div className="rounded-xl bg-ink-950 ring-1 ring-ink-800/40 px-5 py-4">
          <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.body) }} />
        </div>
      </ModuleSection>
    </div>
  );
}

function SteeringEditor({
  initial,
  isNew = false,
  onSaved,
  onCancel,
}: {
  initial: SteeringWriteInput;
  isNew?: boolean;
  onSaved: (path: string) => void;
  onCancel?: () => void;
}) {
  const saveSteering = useWorkspace((s) => s.saveSteering);
  const deleteSteering = useWorkspace((s) => s.deleteSteering);
  const togglePin = useWorkspace((s) => s.togglePin);
  const pins = useWorkspace((s) => s.steeringPins);
  const steering = useWorkspace((s) => s.steering);

  const [draft, setDraft] = useState<SteeringWriteInput>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial);
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.prevPath, isNew]);

  const set = (patch: Partial<SteeringWriteInput>) => setDraft((d) => ({ ...d, ...patch }));

  const trimmedName = draft.name.trim();
  const nameConflict =
    isNew && steering.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase());
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const pinned = pins.includes(initial.name);
  const canSave =
    !!trimmedName &&
    !nameConflict &&
    !(draft.inclusion === 'fileMatch' && !draft.fileMatch?.trim());

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setErr(null);
    try {
      const saved = await saveSteering({ ...draft, name: trimmedName });
      onSaved(saved.path);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial.prevPath) return;
    if (!window.confirm(`Delete steering doc "${initial.name}"? This removes the file.`)) return;
    setBusy(true);
    try {
      await deleteSteering(initial.prevPath);
      onCancel?.();
      onSaved('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-[19px] font-bold text-ink-50">
          {isNew ? 'New steering doc' : trimmedName || 'Untitled'}
        </h2>
        <div className="flex items-center gap-2">
          {!isNew && draft.inclusion !== 'always' && (
            <button
              onClick={() => togglePin(initial.name)}
              className={cn(
                'flex items-center gap-1.5 text-[11.5px] px-2.5 h-8 rounded-lg font-medium transition',
                pinned ? 'bg-accent text-accent-fg' : 'bg-elev text-dim hover:text-ink-50'
              )}
              title="Force-include this doc in every run"
            >
              {pinned ? <PinOff size={12} /> : <Pin size={12} />}
              {pinned ? 'Unpin' : 'Pin to runs'}
            </button>
          )}
          {!isNew && (
            <button
              onClick={remove}
              disabled={busy}
              className="flex items-center gap-1.5 text-[11.5px] px-2.5 h-8 rounded-lg bg-elev text-dim hover:text-bad disabled:opacity-40"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <Field label="Name">
          <input
            autoFocus={isNew}
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. api-conventions"
            className="lib-input"
          />
          {nameConflict && <p className="text-[11px] text-bad mt-1">A doc with this name exists.</p>}
        </Field>
        <Field label="Scope">
          <div className="flex gap-1.5">
            {(['workspace', 'global'] as const).map((sc) => (
              <button
                key={sc}
                onClick={() => set({ scope: sc })}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-[12px] font-medium transition',
                  draft.scope === sc
                    ? 'bg-accent/12 text-accent ring-1 ring-accent/30'
                    : 'bg-elev/60 text-dim hover:text-ink-50'
                )}
              >
                {sc === 'workspace' ? <Briefcase size={13} /> : <Globe size={13} />}
                {sc === 'workspace' ? 'Project' : 'Global'}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Description">
        <input
          value={draft.description ?? ''}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="One line — what this doc covers"
          className="lib-input"
        />
      </Field>

      <Field label="When it's injected">
        <div className="grid sm:grid-cols-2 gap-1.5">
          {(Object.keys(INCLUSION_META) as SteeringInclusion[]).map((mode) => {
            const active = draft.inclusion === mode;
            return (
              <button
                key={mode}
                onClick={() => set({ inclusion: mode })}
                className={cn(
                  'flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg text-left transition',
                  active ? 'bg-accent/12 ring-1 ring-accent/30' : 'bg-elev/60 hover:bg-elev'
                )}
              >
                <span
                  className={cn(
                    'text-[12px] font-medium',
                    active ? 'text-accent' : 'text-ink-100'
                  )}
                >
                  {INCLUSION_META[mode].label}
                </span>
                <span className="text-[10.5px] text-faint leading-snug">
                  {INCLUSION_META[mode].blurb}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      {draft.inclusion === 'fileMatch' && (
        <Field label="File glob">
          <input
            value={draft.fileMatch ?? ''}
            onChange={(e) => set({ fileMatch: e.target.value })}
            placeholder="e.g. src/**/*.tsx"
            className="lib-input font-mono"
          />
          <p className="text-[11px] text-faint mt-1">
            Supports <span className="font-mono">*</span> and{' '}
            <span className="font-mono">**</span>. The doc is injected when a run touches a matching
            file.
          </p>
        </Field>
      )}

      <Field label="Content (markdown)">
        <textarea
          value={draft.body}
          onChange={(e) => set({ body: e.target.value })}
          placeholder={'# Title\n\nProject knowledge the agents should have…'}
          className="lib-input min-h-[280px] resize-y font-mono text-[12px] leading-relaxed"
        />
      </Field>

      {err && <p className="text-[12px] text-bad mb-3">{err}</p>}

      <div className="flex items-center justify-end gap-2">
        {isNew && onCancel && (
          <button
            onClick={onCancel}
            className="text-[12px] px-3 h-8 rounded-lg text-dim hover:text-ink-50"
          >
            Cancel
          </button>
        )}
        <button
          onClick={save}
          disabled={!canSave || busy || (!isNew && !dirty)}
          className="flex items-center gap-1.5 text-[12px] font-semibold px-4 h-8 rounded-lg bg-accent text-accent-fg disabled:opacity-40"
        >
          <Save size={13} />
          {busy ? 'Saving…' : isNew ? 'Create doc' : dirty ? 'Save changes' : 'Saved'}
        </button>
      </div>
    </div>
  );
}

function PreviewPane() {
  const root = useWorkspace((s) => s.root);
  const steering = useWorkspace((s) => s.steering);
  const pins = useWorkspace((s) => s.steeringPins);
  const [testPath, setTestPath] = useState('');
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  const hasFileMatch = steering.some((s) => s.inclusion === 'fileMatch');

  useEffect(() => {
    if (!root) return;
    setLoading(true);
    const files = testPath.trim() ? [testPath.trim()] : [];
    window.kraken.steering
      .preview(root, { files, manualRefs: [] })
      .then(setPreview)
      .finally(() => setLoading(false));
  }, [root, testPath, pins, steering]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-7 py-6">
        <ModuleSection
          title="What gets injected"
          desc="The exact steering block prepended to a run's system prompt, given the current always-docs, your pins, and any file the run touches."
        >
          {hasFileMatch && (
            <div className="mb-3">
              <label className="block text-[11px] uppercase tracking-wide text-faint mb-1.5">
                Simulate a run touching this file (tests fileMatch globs)
              </label>
              <input
                value={testPath}
                onChange={(e) => setTestPath(e.target.value)}
                placeholder="e.g. src/components/Button.tsx"
                className="lib-input font-mono"
              />
            </div>
          )}
          {pins.length > 0 && (
            <Callout>
              Pinned (force-included): {pins.map((p) => `#${p}`).join(', ')}
            </Callout>
          )}
        </ModuleSection>

        <div className="rounded-xl bg-ink-950 ring-1 ring-ink-800/40 px-5 py-4 min-h-[200px]">
          {loading ? (
            <div className="text-[12px] text-faint">Composing…</div>
          ) : preview ? (
            <pre className="text-[12px] text-dim whitespace-pre-wrap font-mono leading-relaxed">
              {preview}
            </pre>
          ) : (
            <div className="text-[12px] text-faint">
              Nothing is injected for this scenario. Add an <span className="text-dim">always</span>{' '}
              doc, pin a doc, or enter a matching file path above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] uppercase tracking-wide text-faint mb-1.5">{label}</label>
      {children}
    </div>
  );
}
