import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  FileText,
  PenLine,
  ListChecks,
  Rocket,
  CheckCircle2,
  Bot,
  Sparkles,
  Webhook,
  Compass,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  requirements: FileText,
  design: PenLine,
  tasks: ListChecks,
  execution: Rocket,
  done: CheckCircle2,
  agents: Bot,
  skills: Sparkles,
  hooks: Webhook,
  steering: Compass,
};

export interface PhaseData {
  label: string;
  sub?: string;
  icon: string;
  step?: string;
  [key: string]: unknown;
}

/** A spec-loop phase: glowing card with handles on both sides. */
export function PhaseNode({ data }: NodeProps) {
  const d = data as PhaseData;
  const Icon = ICONS[d.icon] ?? FileText;
  return (
    <div className="group relative w-[168px] rounded-2xl border border-accent/30 bg-ink-900/90 px-4 py-3.5 shadow-glow backdrop-blur-sm">
      <div className="absolute -inset-px -z-10 rounded-2xl bg-accent/10 blur-md" />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-accent" />
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          {d.step && (
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-accent/80">
              {d.step}
            </div>
          )}
          <div className="font-display text-sm font-semibold leading-tight text-ink-50">
            {d.label}
          </div>
        </div>
      </div>
      {d.sub && <div className="mt-2 text-[11px] leading-snug text-ink-400">{d.sub}</div>}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-accent" />
    </div>
  );
}

/** A supporting input (agent / skill / hook / steering): cyan pill. */
export function SideNode({ data }: NodeProps) {
  const d = data as PhaseData;
  const Icon = ICONS[d.icon] ?? Bot;
  return (
    <div className="relative flex w-[150px] items-center gap-2 rounded-xl border border-glowcyan/30 bg-ink-900/85 px-3 py-2.5 shadow-glowcyan backdrop-blur-sm">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-glowcyan/15 text-glowcyan">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold leading-tight text-ink-50">{d.label}</div>
        {d.sub && <div className="text-[10px] leading-tight text-ink-400">{d.sub}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-glowcyan" />
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-glowcyan" />
    </div>
  );
}

export const nodeTypes = { phase: PhaseNode, side: SideNode };
