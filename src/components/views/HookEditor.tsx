import { useEffect, useState } from 'react';
import { Zap, Save, Trash2, Play, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import type { HookConfig, HookTrigger, HookActionType } from '../../../electron/shared/types';

const TRIGGERS: HookTrigger[] = [
  'spec-advance',
  'spec-done',
  'task-complete',
  'wave-complete',
  'file-save-in-app',
  'manual',
];

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `hook-${Date.now()}`
  );
}

const EMPTY: Omit<HookConfig, 'scope' | 'path'> = {
  id: '',
  title: '',
  description: '',
  trigger: 'manual',
  enabled: true,
  actionType: 'ask-claude',
  agent: null,
  instructions: '',
  command: '',
  blocking: false,
};

export function HookEditor({ tabId, hookId }: { tabId: string; hookId?: string }) {
  const root = useWorkspace((s) => s.root);
  const hooks = useWorkspace((s) => s.hooks);
  const agents = useWorkspace((s) => s.agents);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const openTab = useUi((s) => s.openTab);
  const closeTab = useUi((s) => s.closeTab);

  const [draft, setDraft] = useState<Omit<HookConfig, 'scope' | 'path'>>(EMPTY);
  const [nl, setNl] = useState('');
  const [saved, setSaved] = useState(false);
  const isNew = !hookId;

  useEffect(() => {
    if (hookId) {
      const found = hooks.find((h) => h.id === hookId);
      if (found) {
        const { scope: _s, path: _p, ...rest } = found;
        setDraft(rest);
      }
    } else {
      setDraft(EMPTY);
    }
  }, [hookId, hooks]);

  const patch = (p: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setSaved(false);
  };

  const save = async () => {
    if (!root) return;
    const id = draft.id || slugify(draft.title);
    const hook = { ...draft, id } as HookConfig;
    await window.kraken.hooks.write(root, hook);
    await refreshAll();
    setSaved(true);
    if (isNew) {
      closeTab(tabId);
      openTab({ id: `hook:${id}`, title: hook.title || id, kind: 'hook', hookId: id });
    }
  };

  const remove = async () => {
    if (!root || !draft.id) return;
    await window.kraken.hooks.delete(root, draft.id);
    await refreshAll();
    closeTab(tabId);
  };

  const runNow = async () => {
    if (!root || !draft.id) return;
    await window.kraken.hooks.fireOne(root, draft.id, { root });
  };

  const generate = async () => {
    if (!root || !nl.trim()) return;
    await window.kraken.hooks.generateFromNl(root, nl.trim());
    setNl('');
  };

  const labelCls = 'block text-[11px] uppercase tracking-wide text-ink-400 mb-1';
  const inputCls =
    'w-full bg-ink-900 border border-ink-700 rounded-md px-2.5 py-1.5 text-sm text-ink-100 focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <div className="h-full overflow-y-auto bg-ink-950">
      <div className="max-w-2xl mx-auto px-8 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-ink-200">
            <Zap size={16} className="text-accent" />
            <span className="text-sm font-medium">{isNew ? 'New hook' : draft.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button
                onClick={runNow}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-ink-700 text-ink-300 hover:text-ink-100"
              >
                <Play size={12} /> Run now
              </button>
            )}
            {!isNew && (
              <button
                onClick={remove}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-ink-700 text-red-400/80 hover:text-red-400"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
            <button
              onClick={save}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90"
            >
              <Save size={12} /> {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        {isNew && (
          <div className="rounded-md border border-ink-800 bg-ink-900/40 p-3">
            <label className={labelCls}>Create from description</label>
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="e.g. After a wave, run the tests and fix failures"
                value={nl}
                onChange={(e) => setNl(e.target.value)}
              />
              <button
                onClick={generate}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-ink-700 text-ink-300 hover:text-ink-100 shrink-0"
              >
                <Sparkles size={12} /> Generate
              </button>
            </div>
            <p className="text-[10px] text-ink-500 mt-1.5">
              Claude writes a hook JSON into .kraken/hooks/. Refresh the Hooks list when it
              finishes.
            </p>
          </div>
        )}

        <div>
          <label className={labelCls}>Title</label>
          <input
            className={inputCls}
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <input
            className={inputCls}
            value={draft.description ?? ''}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Trigger</label>
            <select
              className={inputCls}
              value={draft.trigger}
              onChange={(e) => patch({ trigger: e.target.value as HookTrigger })}
            >
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Action</label>
            <select
              className={inputCls}
              value={draft.actionType}
              onChange={(e) => patch({ actionType: e.target.value as HookActionType })}
            >
              <option value="ask-claude">Ask Claude</option>
              <option value="run-command">Run command</option>
            </select>
          </div>
        </div>

        {draft.trigger === 'file-save-in-app' && (
          <div>
            <label className={labelCls}>File glob (optional)</label>
            <input
              className={inputCls}
              placeholder="e.g. **/*.md"
              value={draft.fileGlob ?? ''}
              onChange={(e) => patch({ fileGlob: e.target.value })}
            />
          </div>
        )}

        {draft.actionType === 'ask-claude' ? (
          <>
            <div>
              <label className={labelCls}>Agent (optional)</label>
              <select
                className={inputCls}
                value={draft.agent ?? ''}
                onChange={(e) => patch({ agent: e.target.value || null })}
              >
                <option value="">— generic —</option>
                {agents.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Instructions</label>
              <textarea
                className={inputCls + ' min-h-[160px] font-mono text-xs leading-relaxed'}
                value={draft.instructions ?? ''}
                onChange={(e) => patch({ instructions: e.target.value })}
              />
            </div>
          </>
        ) : (
          <div>
            <label className={labelCls}>Shell command</label>
            <input
              className={inputCls + ' font-mono text-xs'}
              placeholder="e.g. npm run typecheck"
              value={draft.command ?? ''}
              onChange={(e) => patch({ command: e.target.value })}
            />
          </div>
        )}

        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 text-xs text-ink-300">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
            />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-300">
            <input
              type="checkbox"
              checked={!!draft.blocking}
              onChange={(e) => patch({ blocking: e.target.checked })}
            />
            Blocking (autopilot waits for it)
          </label>
        </div>
      </div>
    </div>
  );
}
