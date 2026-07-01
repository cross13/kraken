import { useState } from 'react';
import {
  Zap,
  Wand2,
  Plus,
  Play,
  Pencil,
  Globe,
  Briefcase,
  Bot,
  Terminal,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { cn } from '../../lib/cn';
import type { HookConfig, HookTrigger } from '../../../electron/shared/types';
import { ModuleHeader, ModuleSection, Explainer, Callout } from '../ModuleShell';
import { LibDialogShell, LibField } from './AgentsStudio';

const EXPLAINER = [
  {
    heading: 'What a hook is',
    body: 'A JSON rule in .kraken/hooks/ that fires a Claude run (or a shell command) automatically when an app event happens — no manual trigger needed.',
  },
  {
    heading: 'When they fire',
    body: 'On spec-advance, spec-done, task-complete, wave-complete, or a file save inside the app — plus manual "Run now". Each hook can target one specific agent.',
  },
  {
    heading: 'Blocking vs background',
    body: 'A blocking hook makes Autopilot wait for it between waves (e.g. run tests before continuing). Non-blocking hooks run in the background and show up in History.',
  },
  {
    heading: 'Safe by design',
    body: 'Hook runs write through the CLI (not the in-app save), so a file-save hook can’t retrigger itself, and a per-hook cooldown prevents loops.',
  },
];

const TRIGGER_REF: { trigger: HookTrigger; label: string; desc: string }[] = [
  { trigger: 'spec-advance', label: 'Spec advances', desc: 'A spec moves to its next phase.' },
  { trigger: 'spec-done', label: 'Spec done', desc: 'A spec reaches the done phase.' },
  { trigger: 'task-complete', label: 'Task complete', desc: 'A single task finishes.' },
  { trigger: 'wave-complete', label: 'Wave complete', desc: 'A whole wave of tasks finishes.' },
  { trigger: 'file-save-in-app', label: 'File saved', desc: 'A spec file is saved in the app (optional glob).' },
  { trigger: 'manual', label: 'Manual', desc: 'Only when you press Run now.' },
];

const TRIGGER_LABEL: Record<HookTrigger, string> = Object.fromEntries(
  TRIGGER_REF.map((t) => [t.trigger, t.label])
) as Record<HookTrigger, string>;

export function HooksStudio() {
  const root = useWorkspace((s) => s.root);
  const hooks = useWorkspace((s) => s.hooks);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const openTab = useUi((s) => s.openTab);
  const [genOpen, setGenOpen] = useState(false);

  const newHook = () => openTab({ id: `hook:new:${Date.now()}`, title: 'New hook', kind: 'hook' });

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <ModuleHeader
        icon={<Zap size={18} />}
        title="Hooks"
        subtitle={`${hooks.length} configured · event-driven automation`}
        actions={
          <>
            <button
              onClick={() => setGenOpen(true)}
              className="flex items-center gap-1.5 text-[12px] px-3 h-8 rounded-lg bg-elev text-dim hover:text-ink-50"
            >
              <Sparkles size={13} /> Generate
            </button>
            <button
              onClick={newHook}
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 h-8 rounded-lg bg-accent text-accent-fg hover:opacity-90"
            >
              <Plus size={13} /> New hook
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

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-7 py-6">
          {!root ? (
            <div className="text-[13px] text-faint">Open a folder to manage hooks.</div>
          ) : (
            <>
              <Explainer points={EXPLAINER} defaultOpen={hooks.length === 0} />

              <ModuleSection title="Your hooks" desc="Toggle, run, or edit. Double-click opens the full editor.">
                {hooks.length === 0 ? (
                  <Callout>
                    No hooks yet. Seed the defaults (a wave-complete code validator + a spec-done
                    changelog writer), describe one in plain language with Generate, or build one from
                    scratch with New hook.
                  </Callout>
                ) : (
                  <div className="space-y-1.5">
                    {hooks.map((h) => (
                      <HookCard key={h.path} hook={h} triggerLabel={TRIGGER_LABEL[h.trigger]} />
                    ))}
                  </div>
                )}
              </ModuleSection>

              <ModuleSection title="Trigger reference" desc="The events a hook can listen for.">
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {TRIGGER_REF.map((t) => (
                    <div key={t.trigger} className="rounded-lg bg-elev/40 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Zap size={11} className="text-accent" />
                        <span className="text-[12px] font-medium text-ink-100">{t.label}</span>
                        <code className="ml-auto font-mono text-[10px] text-faint">{t.trigger}</code>
                      </div>
                      <p className="text-[11px] text-faint mt-0.5">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </ModuleSection>
            </>
          )}
        </div>
      </div>

      {genOpen && <GenerateHookDialog onClose={() => setGenOpen(false)} />}
    </div>
  );
}

function HookCard({ hook, triggerLabel }: { hook: HookConfig; triggerLabel: string }) {
  const root = useWorkspace((s) => s.root);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const openTab = useUi((s) => s.openTab);

  const edit = () =>
    openTab({ id: `hook:${hook.id}`, title: hook.title || hook.id, kind: 'hook', hookId: hook.id });

  const toggle = async () => {
    if (!root) return;
    await window.kraken.hooks.toggle(root, hook.id, !hook.enabled);
    await refreshAll();
  };

  const run = async () => {
    if (!root) return;
    await window.kraken.hooks.fireOne(root, hook.id, { root });
  };

  return (
    <div
      onDoubleClick={edit}
      className={cn(
        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-elev/40 hover:bg-elev/70 transition',
        !hook.enabled && 'opacity-55'
      )}
    >
      <div className="w-8 h-8 grid place-items-center rounded-lg bg-accent/12 text-accent shrink-0">
        {hook.actionType === 'run-command' ? <Terminal size={15} /> : <Bot size={15} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-ink-50 truncate">{hook.title || hook.id}</span>
          {hook.scope === 'global' ? (
            <Globe size={11} className="text-faint" />
          ) : (
            <Briefcase size={11} className="text-faint" />
          )}
          {hook.blocking && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 uppercase">
              blocking
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-faint">
          <span className="text-accent/80">{triggerLabel}</span>
          {hook.agent && <span className="truncate">· @{hook.agent}</span>}
          {hook.description && <span className="truncate">· {hook.description}</span>}
        </div>
      </div>
      <button
        onClick={toggle}
        title={hook.enabled ? 'Disable' : 'Enable'}
        className={cn(
          'w-9 h-5 rounded-full p-0.5 transition shrink-0',
          hook.enabled ? 'bg-accent' : 'bg-ink-700'
        )}
      >
        <span
          className={cn(
            'block w-4 h-4 rounded-full bg-white transition-transform',
            hook.enabled && 'translate-x-4'
          )}
        />
      </button>
      <button onClick={run} title="Run now" className="text-dim hover:text-accent shrink-0">
        <Play size={14} />
      </button>
      <button onClick={edit} title="Edit" className="text-dim hover:text-ink-50 shrink-0">
        <Pencil size={14} />
      </button>
    </div>
  );
}

function GenerateHookDialog({ onClose }: { onClose: () => void }) {
  const root = useWorkspace((s) => s.root);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const [nl, setNl] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!root || !nl.trim()) return;
    setBusy(true);
    await window.kraken.hooks.generateFromNl(root, nl.trim());
    // The hook file is written asynchronously by Claude; refresh shortly after.
    setTimeout(() => refreshAll(), 1500);
    onClose();
  };

  return (
    <LibDialogShell title="Generate a hook" onClose={onClose}>
      <p className="text-[12px] text-dim mb-4">
        Describe the automation in plain language. Claude writes a hook JSON into{' '}
        <code className="font-mono text-accent">.kraken/hooks/</code> — it appears in the list when
        it finishes.
      </p>
      <LibField label="Description">
        <textarea
          autoFocus
          value={nl}
          onChange={(e) => setNl(e.target.value)}
          placeholder="After a wave completes, run the tests and fix any failures."
          className="lib-input min-h-[90px] resize-none"
        />
      </LibField>
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-lg text-dim hover:text-ink-50">
          Cancel
        </button>
        <button
          onClick={generate}
          disabled={!nl.trim() || busy}
          className="text-[12px] font-semibold px-4 h-8 rounded-lg bg-accent text-accent-fg disabled:opacity-40"
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </LibDialogShell>
  );
}
