import { useState } from 'react';
import { FileCode2, Bug, X } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { cn } from '../../lib/cn';
import type { SpecKind } from '../../../electron/shared/types';

export function NewSpecDialog({
  onClose,
  defaultKind = 'feature',
}: {
  onClose: () => void;
  defaultKind?: SpecKind;
}) {
  const [kind, setKind] = useState<SpecKind>(defaultKind);
  const [name, setName] = useState('');
  const createSpec = useWorkspace((s) => s.createSpec);
  const openTab = useUi((s) => s.openTab);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const spec = await createSpec(name.trim(), kind);
    const initialFile: 'requirements' | 'bugfix' =
      kind === 'feature' ? 'requirements' : 'bugfix';
    openTab({
      id: `spec:${spec.id}:${initialFile}`,
      title: `${spec.name} / ${initialFile}.md`,
      kind: 'spec',
      specId: spec.id,
      specFile: initialFile,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-[480px] rounded-xl border border-ink-800 bg-ink-900 shadow-glow p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">New spec</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-100">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <KindCard
            selected={kind === 'feature'}
            onClick={() => setKind('feature')}
            icon={<FileCode2 size={18} />}
            title="Feature"
            description="Requirements → Design → Tasks"
            tone="accent"
          />
          <KindCard
            selected={kind === 'bugfix'}
            onClick={() => setKind('bugfix')}
            icon={<Bug size={18} />}
            title="Bugfix"
            description="Analysis → Design → Tasks"
            tone="warn"
          />
        </div>

        <label className="block text-[11px] uppercase tracking-wider text-ink-400 font-semibold mb-1">
          Name
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onClose();
          }}
          placeholder={kind === 'feature' ? 'User authentication' : 'Logout button does nothing on Safari'}
          className="w-full text-sm px-3 py-2 rounded-md bg-ink-950 border border-ink-800 focus:border-accent outline-none"
        />

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-md text-ink-300 hover:bg-ink-800">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="text-xs px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40"
          >
            Create spec
          </button>
        </div>
      </div>
    </div>
  );
}

function KindCard({
  selected,
  onClick,
  icon,
  title,
  description,
  tone,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: 'accent' | 'warn';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left p-3 rounded-lg border transition',
        selected
          ? tone === 'accent'
            ? 'border-accent bg-accent/10'
            : 'border-warn bg-warn/10'
          : 'border-ink-800 bg-ink-950 hover:border-ink-700'
      )}
    >
      <div
        className={cn(
          'w-8 h-8 grid place-items-center rounded-md mb-2',
          tone === 'accent' ? 'bg-accent/20 text-accent' : 'bg-warn/20 text-warn'
        )}
      >
        {icon}
      </div>
      <div className="text-sm font-medium text-ink-50">{title}</div>
      <div className="text-[11px] text-ink-400">{description}</div>
    </button>
  );
}
