import { ReactFlow, MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes';

// A compact, non-interactive horizontal SDD loop for the hero/section.
const nodes: Node[] = [
  { id: 'req', type: 'phase', position: { x: 0, y: 60 }, data: { label: 'Requirements', icon: 'requirements', step: 'Phase 1', sub: 'EARS criteria' } },
  { id: 'design', type: 'phase', position: { x: 230, y: 60 }, data: { label: 'Design', icon: 'design', step: 'Phase 2', sub: 'Architecture' } },
  { id: 'tasks', type: 'phase', position: { x: 460, y: 60 }, data: { label: 'Tasks', icon: 'tasks', step: 'Phase 3', sub: 'Dependency waves' } },
  { id: 'exec', type: 'phase', position: { x: 690, y: 60 }, data: { label: 'Execution', icon: 'execution', step: 'Phase 4', sub: 'Parallel agents' } },
  { id: 'done', type: 'phase', position: { x: 920, y: 60 }, data: { label: 'Done', icon: 'done', step: 'Shipped', sub: 'Audited & synced' } },
];

const edge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  animated: true,
  style: { stroke: 'rgba(124,92,255,0.6)', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#7c5cff' },
});

const edges: Edge[] = [
  edge('e1', 'req', 'design'),
  edge('e2', 'design', 'tasks'),
  edge('e3', 'tasks', 'exec'),
  edge('e4', 'exec', 'done'),
];

export function SddFlow() {
  return (
    <div className="h-[200px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
      />
    </div>
  );
}
