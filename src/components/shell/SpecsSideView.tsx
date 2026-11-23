import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi, stageForPhase } from '../../stores/ui';
import { useOrchestrator } from '../../stores/orchestrator';
import { SidebarHeader, SidebarButton, SidebarEmpty } from '../SidebarShell';
import { cn } from '../../lib/cn';
import type { SpecMeta } from '../../../electron/shared/types';

const PHASES: { phase: SpecMeta['phase']; label: string }[] = [
  { phase: 'requirements', label: 'Requirements' },
  { phase: 'plan', label: 'Plan' },
  { phase: 'build', label: 'Build' },
];

/**
 * Home's board as a side view: every spec under the phase it is in, so you can
 * move between specs without leaving the file you have open. A phase heading
 * turns to the "waits on you" colour only when a spec in it has no run going —
 * the same rule the board's column rules follow.
 */
export function SpecsSideView() {
  const root = useWorkspace((s) => s.root);
  const specs = useWorkspace((s) => s.specs);
  const activeSpecId = useUi((s) => s.activeSpecId);
  const onSpec = useUi((s) => s.activeTabId === null && s.surface === 'spec');
  const openSpec = useUi((s) => s.openSpec);
  const focusComposer = useUi((s) => s.focusComposer);
  const runs = useOrchestrator((s) => s.runs);
  const [doneOpen, setDoneOpen] = useState(false);

  const runningSpecs = new Set(
    Object.values(runs)
      .filter((r) => r.status === 'running' || r.status === 'queued')
      .map((r) => r.specId)
  );
  const done = specs.filter((s) => s.phase === 'done');

  const row = (s: SpecMeta) => {
    const running = runningSpecs.has(s.id);
    return (
      <button
        key={s.id}
        onClick={() => openSpec(s.id, stageForPhase(s.phase))}
        title={s.id}
        className={cn(
          'w-full flex items-center gap-2 text-left text-[12.5px] rounded-md px-2 py-1.5 transition',
          onSpec && activeSpecId === s.id
            ? 'bg-ink-50/[0.07] text-ink-50 font-medium'
            : 'text-ink-200 hover:bg-ink-50/[0.04]'
        )}
      >
        <span className="flex-1 truncate">{s.name || s.id}</span>
        {running && (
          <span
            title="A run is in flight"
            className="w-[7px] h-[7px] rounded-full bg-accent animate-pulse-dot shrink-0"
          />
        )}
      </button>
    );
  };

  return (
    <>
      <SidebarHeader
        title="Specs"
        actions={
          <SidebarButton onClick={() => focusComposer()} title="New spec">
            <Plus size={13} />
          </SidebarButton>
        }
      />
      <div className="flex-1 overflow-y-auto py-2">
        {!root ? (
          <SidebarEmpty title="No workspace" description="Open a folder to begin." />
        ) : specs.length === 0 ? (
          <SidebarEmpty
            title="No specs yet"
            description="Describe what to build on Home and it lands here."
          />
        ) : (
          <>
            {PHASES.map(({ phase, label }) => {
              const list = specs.filter((s) => s.phase === phase);
              const waiting = list.some((s) => !runningSpecs.has(s.id));
              const running = list.some((s) => runningSpecs.has(s.id));
              return (
                <section key={phase} className="px-1.5 pb-2">
                  <div
                    className={cn(
                      'flex items-center gap-2 px-2 py-1 text-[12px] font-semibold',
                      list.length === 0 ? 'text-ink-600' : waiting ? 'text-agent-text' : 'text-ink-50'
                    )}
                  >
                    {list.length > 0 && waiting && (
                      <span className="w-[7px] h-[7px] rounded-full bg-agent shrink-0" />
                    )}
                    <span className="flex-1">{label}</span>
                    <span className="font-normal text-[11.5px]">
                      {list.length === 0 ? 'empty' : running && !waiting ? 'running' : list.length}
                    </span>
                  </div>
                  {list.map(row)}
                </section>
              );
            })}

            {done.length > 0 && (
              <section className="px-1.5 pt-1 border-t border-ink-50/[0.06]">
                <button
                  onClick={() => setDoneOpen((o) => !o)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-semibold text-faint hover:text-ink-100"
                >
                  {doneOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span className="flex-1 text-left">Shipped</span>
                  <span className="font-normal text-[11.5px]">{done.length}</span>
                </button>
                {doneOpen && done.map(row)}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
