import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  FileText,
  HelpCircle,
  Map,
  ListChecks,
  GitPullRequest,
  Bot,
  Sparkles,
  Webhook,
  Compass,
  Ticket,
  CheckCircle2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  requirements: FileText,
  clarify: HelpCircle,
  plan: Map,
  build: ListChecks,
  ship: GitPullRequest,
  done: CheckCircle2,
  agents: Bot,
  skills: Sparkles,
  hooks: Webhook,
  steering: Compass,
  tickets: Ticket,
};

export interface PhaseData {
  label: string;
  sub?: string;
  icon: string;
  step?: string;
  [key: string]: unknown;
}

const dot = '!h-1.5 !w-1.5 !rounded-none !border-0';

/**
 * A stage of the loop. Green means the machine is doing the work — the palette's
 * one meaning for green, kept honest here.
 */
export function PhaseNode({ data }: NodeProps) {
  const d = data as PhaseData;
  const Icon = ICONS[d.icon] ?? FileText;
  return (
    <div className="w-[170px] border border-line bg-panel px-3.5 py-3">
      <Handle type="target" position={Position.Left} className={`${dot} !bg-accent`} />
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center bg-accent text-accent-fg">
          <Icon size={15} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          {d.step && (
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-600">
              {d.step}
            </div>
          )}
          <div className="font-display text-sm font-semibold leading-tight text-ink-100">
            {d.label}
          </div>
        </div>
      </div>
      {d.sub && <div className="mt-2 text-[11px] leading-snug text-ink-500">{d.sub}</div>}
      <Handle type="source" position={Position.Right} className={`${dot} !bg-accent`} />
    </div>
  );
}

/**
 * A gate. Violet is the palette's other accent and it means exactly one thing:
 * this one waits for you. Never green — nothing is executing here.
 */
export function GateNode({ data }: NodeProps) {
  const d = data as PhaseData;
  return (
    <div className="w-[150px] border border-agent bg-agent-tint px-3.5 py-3">
      <Handle type="target" position={Position.Left} className={`${dot} !bg-agent`} />
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-agent-text">Gate</div>
      <div className="mt-0.5 font-display text-sm font-semibold leading-tight text-ink-100">
        {d.label}
      </div>
      {d.sub && <div className="mt-1.5 text-[11px] leading-snug text-ink-400">{d.sub}</div>}
      <Handle type="source" position={Position.Right} className={`${dot} !bg-agent`} />
    </div>
  );
}

/** A supporting input the run picks up: agent, skill, hook, steering, ticket. */
export function SideNode({ data }: NodeProps) {
  const d = data as PhaseData;
  const Icon = ICONS[d.icon] ?? Bot;
  return (
    <div className="flex w-[158px] items-center gap-2.5 border border-line bg-card px-3 py-2.5">
      <Icon size={14} strokeWidth={1.75} className="shrink-0 text-ink-400" />
      <div className="min-w-0">
        <div className="text-xs font-semibold leading-tight text-ink-100">{d.label}</div>
        {d.sub && <div className="text-[10px] leading-tight text-ink-600">{d.sub}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} className={`${dot} !bg-ink-600`} />
      <Handle type="target" position={Position.Top} className={`${dot} !bg-ink-600`} />
    </div>
  );
}

export const nodeTypes = { phase: PhaseNode, gate: GateNode, side: SideNode };
