import { ReactFlow, Background, BackgroundVariant, Controls, MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes';

// Full, interactive SDD workflow: the phase loop fed by agents/skills/hooks/steering.
const nodes: Node[] = [
  // Phase loop (top row)
  { id: 'req', type: 'phase', position: { x: 40, y: 220 }, data: { label: 'Requirements', icon: 'requirements', step: 'Phase 1', sub: 'EARS + open questions' } },
  { id: 'design', type: 'phase', position: { x: 290, y: 220 }, data: { label: 'Design', icon: 'design', step: 'Phase 2', sub: 'Honors decisions' } },
  { id: 'tasks', type: 'phase', position: { x: 540, y: 220 }, data: { label: 'Tasks', icon: 'tasks', step: 'Phase 3', sub: 'Dependency waves' } },
  { id: 'exec', type: 'phase', position: { x: 790, y: 220 }, data: { label: 'Execution', icon: 'execution', step: 'Phase 4', sub: 'Parallel + autopilot' } },
  { id: 'done', type: 'phase', position: { x: 1040, y: 220 }, data: { label: 'Done', icon: 'done', step: 'Shipped', sub: 'Audit · re-sync' } },

  // Supporting inputs (bottom row), each feeding a phase
  { id: 'agents', type: 'side', position: { x: 60, y: 30 }, data: { label: 'Agents', icon: 'agents', sub: 'content-routed' } },
  { id: 'skills', type: 'side', position: { x: 300, y: 30 }, data: { label: 'Skills', icon: 'skills', sub: 'sdd-feature' } },
  { id: 'hooks', type: 'side', position: { x: 800, y: 30 }, data: { label: 'Hooks', icon: 'hooks', sub: 'wave-complete' } },
  { id: 'steering', type: 'side', position: { x: 540, y: 420 }, data: { label: 'Steering', icon: 'steering', sub: 'every run' } },
];

const flow = (id: string, source: string, target: string, color = '#7c5cff'): Edge => ({
  id,
  source,
  target,
  animated: true,
  style: { stroke: `${color}99`, strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color },
});

const feed = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  animated: true,
  style: { stroke: 'rgba(57,224,230,0.5)', strokeWidth: 1.5, strokeDasharray: '4 4' },
});

const edges: Edge[] = [
  flow('p1', 'req', 'design'),
  flow('p2', 'design', 'tasks'),
  flow('p3', 'tasks', 'exec'),
  flow('p4', 'exec', 'done'),
  feed('f1', 'agents', 'req'),
  feed('f2', 'skills', 'design'),
  feed('f3', 'hooks', 'exec'),
  feed('f4', 'steering', 'tasks'),
];

export function WorkflowFlow() {
  return (
    <div className="h-[520px] w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-950/60">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.14 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
        maxZoom={1.6}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="#252b3a" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
