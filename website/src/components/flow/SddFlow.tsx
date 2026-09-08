import { ReactFlow, MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes';

// The three-stage loop as it actually runs: two documents, two gates, one
// build stage that ends in a PR. Compact and non-interactive — the full
// picture with agents, skills and hooks lives on /workflow.
const nodes: Node[] = [
  {
    id: 'req',
    type: 'phase',
    position: { x: 0, y: 40 },
    data: { label: 'Requirements', icon: 'requirements', step: 'Stage 1', sub: 'EARS criteria, per user story' },
  },
  {
    id: 'g1',
    type: 'gate',
    position: { x: 210, y: 48 },
    data: { label: 'Approve', sub: 'Review, then advance' },
  },
  {
    id: 'clarify',
    type: 'phase',
    position: { x: 400, y: 40 },
    data: { label: 'Clarify', icon: 'clarify', step: 'Stage 2a', sub: 'Decide before drafting' },
  },
  {
    id: 'plan',
    type: 'phase',
    position: { x: 610, y: 40 },
    data: { label: 'Plan', icon: 'plan', step: 'Stage 2b', sub: 'Files, contracts, waves' },
  },
  {
    id: 'g2',
    type: 'gate',
    position: { x: 820, y: 48 },
    data: { label: 'Approve', sub: 'Derives tasks.md' },
  },
  {
    id: 'build',
    type: 'phase',
    position: { x: 1010, y: 40 },
    data: { label: 'Build', icon: 'build', step: 'Stage 3', sub: 'Parallel task waves' },
  },
  {
    id: 'ship',
    type: 'phase',
    position: { x: 1220, y: 40 },
    data: { label: 'Ship', icon: 'ship', step: 'Done', sub: 'Summary, commit, PR' },
  },
];

const edge = (id: string, source: string, target: string, gate = false): Edge => ({
  id,
  source,
  target,
  animated: !gate,
  style: { stroke: gate ? 'rgba(155,107,255,0.7)' : 'rgba(118,185,0,0.7)', strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: gate ? '#9B6BFF' : '#76B900', width: 14, height: 14 },
});

const edges: Edge[] = [
  edge('e1', 'req', 'g1', true),
  edge('e2', 'g1', 'clarify', true),
  edge('e3', 'clarify', 'plan'),
  edge('e4', 'plan', 'g2', true),
  edge('e5', 'g2', 'build', true),
  edge('e6', 'build', 'ship'),
];

export function SddFlow() {
  return (
    <div className="h-[190px] w-full overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.06 }}
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
