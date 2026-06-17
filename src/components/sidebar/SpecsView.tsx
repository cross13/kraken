import { useState } from 'react';
import {
  Plus,
  FileCode2,
  Bug,
  ChevronRight,
  ChevronDown,
  Circle,
  CheckCircle2,
  Play,
  HelpCircle,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';
import { NewSpecDialog } from '../dialogs/NewSpecDialog';
import { cn } from '../../lib/cn';
import type { SpecMeta, SpecPhase } from '../../../electron/shared/types';

export function SpecsView() {
  const root = useWorkspace((s) => s.root);
  const specs = useWorkspace((s) => s.specs);
  const [showNew, setShowNew] = useState(false);

  return (
    <>
      <SidebarHeader
        title="Specs"
        actions={
          <SidebarButton onClick={() => setShowNew(true)} title="New spec">
            <Plus size={13} />
          </SidebarButton>
        }
      />
      <div className="flex-1 overflow-y-auto py-1">
        {!root ? (
          <SidebarEmpty
            title="No workspace"
            description="Open a folder to manage specs."
          />
        ) : specs.length === 0 ? (
          <SidebarEmpty
            title="No specs yet"
            description="Start a feature or bugfix spec."
            action={
              <button
                onClick={() => setShowNew(true)}
                className="text-xs px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90"
              >
                + New spec
              </button>
            }
          />
        ) : (
          <div className="px-1.5 space-y-0.5">
            {specs.map((s) => (
              <SpecRow key={s.id} spec={s} />
            ))}
          </div>
        )}
      </div>
      {showNew && <NewSpecDialog onClose={() => setShowNew(false)} />}
    </>
  );
}

function SpecRow({ spec }: { spec: SpecMeta }) {
  const [open, setOpen] = useState(true);
  const openTab = useUi((s) => s.openTab);
  const Icon = spec.kind === 'feature' ? FileCode2 : Bug;
  const accent = spec.kind === 'feature' ? 'text-accent' : 'text-warn';

  const files: { key: 'requirements' | 'bugfix' | 'design' | 'tasks'; label: string }[] =
    spec.kind === 'feature'
      ? [
          { key: 'requirements', label: 'requirements.md' },
          { key: 'design', label: 'design.md' },
          { key: 'tasks', label: 'tasks.md' },
        ]
      : [
          { key: 'bugfix', label: 'bugfix.md' },
          { key: 'design', label: 'design.md' },
          { key: 'tasks', label: 'tasks.md' },
        ];

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-ink-800/60 text-left"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Icon size={13} className={accent} />
        <span className="flex-1 truncate text-xs text-ink-100">{spec.name}</span>
        <PhaseBadge phase={spec.phase} />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 mb-1 space-y-0.5">
          {files.map((f) => (
            <button
              key={f.key}
              onClick={() =>
                openTab({
                  id: `spec:${spec.id}:${f.key}`,
                  title: `${spec.name} / ${f.label}`,
                  kind: 'spec',
                  specId: spec.id,
                  specFile: f.key,
                })
              }
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-ink-400 hover:bg-ink-800/40 hover:text-ink-100"
            >
              <PhaseDot phase={spec.phase} target={f.key} />
              <span className="truncate flex-1 text-left">{f.label}</span>
              {f.key === 'tasks' && (
                <span
                  className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-accent/15 text-accent font-semibold"
                  title="Open to run tasks with Claude"
                >
                  <Play size={8} /> run
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() =>
              openTab({
                id: `spec:${spec.id}:questions`,
                title: `${spec.name} / Open Questions`,
                kind: 'questions',
                specId: spec.id,
              })
            }
            className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-ink-400 hover:bg-ink-800/40 hover:text-ink-100"
            title="Manage open questions with AI suggestions"
          >
            <HelpCircle size={11} className="text-ink-500" />
            <span className="truncate flex-1 text-left">Open Questions</span>
          </button>
        </div>
      )}
    </div>
  );
}

function PhaseBadge({ phase }: { phase: SpecPhase }) {
  const labels: Record<SpecPhase, string> = {
    requirements: 'REQ',
    design: 'DSGN',
    tasks: 'TASK',
    done: 'DONE',
  };
  const tones: Record<SpecPhase, string> = {
    requirements: 'bg-accent/15 text-accent',
    design: 'bg-warn/15 text-warn',
    tasks: 'bg-ok/15 text-ok',
    done: 'bg-ink-700/60 text-ink-300',
  };
  return (
    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider', tones[phase])}>
      {labels[phase]}
    </span>
  );
}

function PhaseDot({ phase, target }: { phase: SpecPhase; target: string }) {
  const order = ['requirements', 'bugfix', 'design', 'tasks'];
  const phaseOrder: Record<SpecPhase, number> = { requirements: 0, design: 1, tasks: 2, done: 3 };
  // requirements/bugfix both map to index 0
  const targetIdx = target === 'requirements' || target === 'bugfix' ? 0 : order.indexOf(target) - 1;
  const reached = phaseOrder[phase] >= targetIdx;
  if (reached) return <CheckCircle2 size={11} className="text-ok shrink-0" />;
  return <Circle size={11} className="text-ink-600 shrink-0" />;
}
