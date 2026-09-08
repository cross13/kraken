import { ReactFlow, Background, BackgroundVariant, Controls, MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes';

// The whole loop, including what feeds each run. Draggable and zoomable — the
// point is to poke at it.
const nodes: Node[] = [
  // Row 0 — what feeds a run, each sitting above the stage it reaches.
  { id: 'ticket', type: 'side', position: { x: -40, y: 0 }, data: { label: 'Tickets', icon: 'tickets', sub: 'Jira · Linear · MCP' } },
  { id: 'steering', type: 'side', position: { x: 180, y: 0 }, data: { label: 'Steering', icon: 'steering', sub: 'Project context' } },
  { id: 'skills', type: 'side', position: { x: 430, y: 0 }, data: { label: 'Skills', icon: 'skills', sub: 'Injected, not labelled' } },
  { id: 'agents', type: 'side', position: { x: 660, y: 0 }, data: { label: 'Agents', icon: 'agents', sub: 'Routed by content' } },

  // Row 1 — the two authored documents and their gates.
  { id: 'req', type: 'phase', position: { x: 0, y: 170 }, data: { label: 'Requirements', icon: 'requirements', step: 'Stage 1', sub: 'User stories + EARS acceptance criteria' } },
  { id: 'g1', type: 'gate', position: { x: 230, y: 178 }, data: { label: 'Approve', sub: 'Or revise with feedback' } },
  { id: 'clarify', type: 'phase', position: { x: 430, y: 170 }, data: { label: 'Clarify', icon: 'clarify', step: 'Stage 2a', sub: 'Open questions, answered with one click' } },
  { id: 'plan', type: 'phase', position: { x: 660, y: 170 }, data: { label: 'Plan', icon: 'plan', step: 'Stage 2b', sub: 'Diagram, affected files, contracts, waves' } },
  { id: 'g2', type: 'gate', position: { x: 890, y: 178 }, data: { label: 'Approve', sub: 'Derives tasks.md from ## Tasks' } },

  // Row 2 — the line wraps: build, then ship.
  { id: 'hooks', type: 'side', position: { x: 250, y: 290 }, data: { label: 'Hooks', icon: 'hooks', sub: 'Fire on events' } },
  { id: 'build', type: 'phase', position: { x: 230, y: 400 }, data: { label: 'Build', icon: 'build', step: 'Stage 3', sub: 'Waves of parallel Claude subprocesses' } },
  { id: 'ship', type: 'phase', position: { x: 470, y: 400 }, data: { label: 'Ship', icon: 'ship', step: 'Done', sub: 'Auto summary → branch → commit → PR' } },
];

const flow = (
  id: string,
  source: string,
  target: string,
  gate = false,
  wrap = false
): Edge => ({
  id,
  source,
  target,
  type: wrap ? 'smoothstep' : undefined,
  animated: !gate,
  style: { stroke: gate ? 'rgba(155,107,255,0.7)' : 'rgba(118,185,0,0.7)', strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: gate ? '#9B6BFF' : '#76B900', width: 14, height: 14 },
});

const feed = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  style: { stroke: '#4a4a4a', strokeWidth: 1, strokeDasharray: '4 4' },
});

const edges: Edge[] = [
  flow('f1', 'req', 'g1', true),
  flow('f2', 'g1', 'clarify', true),
  flow('f3', 'clarify', 'plan'),
  flow('f4', 'plan', 'g2', true),
  flow('f5', 'g2', 'build', true, true),
  flow('f6', 'build', 'ship'),

  feed('s1', 'ticket', 'req'),
  feed('s2', 'steering', 'req'),
  feed('s3', 'skills', 'clarify'),
  feed('s4', 'agents', 'plan'),
  feed('s5', 'hooks', 'build'),
];

export function WorkflowFlow() {
  return (
    <div className="h-[520px] w-full overflow-hidden border border-line bg-panel">
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
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333333" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
