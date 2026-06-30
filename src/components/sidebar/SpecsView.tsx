import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Home,
  FileCode2,
  Bug,
  ChevronRight,
  Circle,
  CheckCircle2,
  Play,
  HelpCircle,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { useOrchestrator } from '../../stores/orchestrator';
import { SidebarButton, SidebarEmpty } from '../SidebarShell';
import { NewSpecDialog } from '../dialogs/NewSpecDialog';
import { cn } from '../../lib/cn';
import type { SpecMeta, SpecPhase } from '../../../electron/shared/types';

const PHASE_INDEX: Record<SpecPhase, number> = {
  requirements: 0,
  design: 1,
  tasks: 2,
  done: 3,
};

// Compact relative timestamp (e.g. "4m", "3h", "2d") for the row meta line.
function ago(iso?: string) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

export function SpecsView() {
  const root = useWorkspace((s) => s.root);
  const specs = useWorkspace((s) => s.specs);
  const openTab = useUi((s) => s.openTab);
  const activeTabId = useUi((s) => s.activeTabId);
  const runs = useOrchestrator((s) => s.runs);
  const [showNew, setShowNew] = useState(false);

  // Specs with a live (running/queued) agent run — drives the status dot.
  const runningSpecIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of Object.values(runs)) {
      if (r.specId && (r.status === 'running' || r.status === 'queued')) set.add(r.specId);
    }
    return set;
  }, [runs]);

  // Most-recently-updated first — matches the design's "RECENT" ordering.
  const recent = useMemo(
    () =>
      [...specs].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [specs]
  );

  const goHome = () =>
    openTab({ id: 'welcome', title: 'Welcome', kind: 'welcome' });
  const isHome = activeTabId === 'welcome';

  return (
    <>
      <div className="flex items-center justify-between pl-3 pr-2 h-9 border-b border-ink-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] uppercase tracking-wider text-faint font-semibold">Specs</h2>
          {specs.length > 0 && (
            <span className="text-[10.5px] font-semibold text-dim bg-ink-50/[0.045] px-2 py-px rounded-full font-mono">
              {specs.length}
            </span>
          )}
        </div>
        <SidebarButton onClick={() => setShowNew(true)} title="New spec">
          <Plus size={14} />
        </SidebarButton>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!root ? (
          <SidebarEmpty title="No workspace" description="Open a folder to manage specs." />
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
          <>
            <button
              onClick={goHome}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-1 transition text-left',
                isHome ? 'bg-accent/10 text-ink-50' : 'text-dim hover:bg-ink-50/[0.045]'
              )}
            >
              <Home size={15} className="shrink-0" />
              <span className="text-[13px] font-medium">Welcome</span>
            </button>
            <div className="text-[10px] font-semibold tracking-[0.13em] text-faint px-2.5 pt-2.5 pb-1.5">
              RECENT
            </div>
            <div className="space-y-0.5">
              {recent.map((s) => (
                <SpecRow key={s.id} spec={s} running={runningSpecIds.has(s.id)} />
              ))}
            </div>
          </>
        )}
      </div>
      {showNew && <NewSpecDialog onClose={() => setShowNew(false)} />}
    </>
  );
}

function SpecRow({ spec, running }: { spec: SpecMeta; running: boolean }) {
  const openTab = useUi((s) => s.openTab);
  const activeTabId = useUi((s) => s.activeTabId);
  const tabs = useUi((s) => s.tabs);

  const isActive = useMemo(
    () => tabs.find((t) => t.id === activeTabId)?.specId === spec.id,
    [tabs, activeTabId, spec.id]
  );
  const [open, setOpen] = useState(isActive);
  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const isFeature = spec.kind === 'feature';
  const phaseIdx = PHASE_INDEX[spec.phase];

  const files: { key: 'requirements' | 'bugfix' | 'design' | 'tasks'; label: string }[] = isFeature
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

  const openFile = (key: typeof files[number]['key'], label: string) =>
    openTab({
      id: `spec:${spec.id}:${key}`,
      title: `${spec.name} / ${label}`,
      kind: 'spec',
      specId: spec.id,
      specFile: key,
    });

  // Status dot: live run → green (pulsing), shipped → faint, otherwise accent.
  const status = running
    ? { cls: 'bg-good', halo: '--good', ping: true }
    : spec.phase === 'done'
    ? { cls: 'bg-faint', halo: '--faint', ping: false }
    : { cls: 'bg-accent', halo: '--accent', ping: false };

  return (
    <div>
      <div
        onClick={() => openFile(files[0].key, files[0].label)}
        className={cn(
          'flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-lg cursor-pointer transition',
          isActive ? 'bg-accent/10' : 'hover:bg-ink-50/[0.045]'
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="p-0.5 -m-0.5 text-faint hover:text-ink-100 shrink-0"
          title={open ? 'Collapse' : 'Expand'}
        >
          <ChevronRight size={12} className={cn('transition-transform', open && 'rotate-90')} />
        </button>
        <span className="relative shrink-0 grid place-items-center" style={{ width: 8, height: 8 }}>
          <span
            className={cn('w-[7px] h-[7px] rounded-full', status.cls)}
            style={{ boxShadow: `0 0 0 3px rgb(var(${status.halo}) / 0.18)` }}
          />
          {status.ping && (
            <span className={cn('absolute inset-0 rounded-full animate-ping2', status.cls)} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-[13px] font-medium truncate',
              isActive ? 'text-ink-50' : 'text-ink-100'
            )}
          >
            {spec.name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isFeature ? (
              <FileCode2 size={11} className="text-faint shrink-0" />
            ) : (
              <Bug size={11} className="text-faint shrink-0" />
            )}
            <div className="flex gap-[3px]">
              {[0, 1, 2].map((i) => {
                const state =
                  phaseIdx > i || spec.phase === 'done'
                    ? 'done'
                    : phaseIdx === i
                    ? 'active'
                    : 'todo';
                return (
                  <span
                    key={i}
                    className={cn(
                      'w-3.5 h-[3px] rounded-sm',
                      state === 'done' ? 'bg-good' : state === 'active' ? 'bg-accent' : 'bg-ink-700'
                    )}
                  />
                );
              })}
            </div>
            <span className="ml-auto text-[10.5px] text-faint font-mono">{ago(spec.updatedAt)}</span>
          </div>
        </div>
      </div>

      {open && (
        <div className="ml-[26px] mt-0.5 mb-1 space-y-0.5">
          {files.map((f) => (
            <button
              key={f.key}
              onClick={() => openFile(f.key, f.label)}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-ink-400 hover:bg-ink-50/[0.04] hover:text-ink-100"
            >
              <PhaseDot phase={spec.phase} target={f.key} />
              <span className="truncate flex-1 text-left">{f.label}</span>
              {f.key === 'tasks' && (
                <span
                  className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-accent/15 text-accent-2 font-semibold"
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
            className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-ink-400 hover:bg-ink-50/[0.04] hover:text-ink-100"
            title="Manage open questions with AI suggestions"
          >
            <HelpCircle size={11} className="text-faint" />
            <span className="truncate flex-1 text-left">Open Questions</span>
          </button>
        </div>
      )}
    </div>
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
