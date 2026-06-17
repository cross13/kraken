import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ban,
  Circle,
  Bot,
  Sparkles,
  AlertTriangle,
  X,
  RefreshCw,
  FileText,
  FilePlus2,
  FilePen,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useOrchestrator } from '../../stores/orchestrator';
import { parseTasks, type ParsedTask } from '../../lib/tasks';
import {
  indexRuns,
  verifyRun,
  fmtDuration,
  STATUS_COLOR,
  type RunInfo,
  type NodeStatus,
  type Warning,
} from '../../lib/graphModel';
import { scopeLabel } from '../../lib/verifyLibrary';
import type { RunRow, RunFileRow, SpecMeta } from '../../../electron/shared/types';
import { cn } from '../../lib/cn';

// ---------- Node data ----------

interface TaskNodeData {
  task: ParsedTask;
  info?: RunInfo;
  warnings: Warning[];
  done: boolean;
  /** number of distinct files this run created/edited */
  fileCount: number;
  onOpen: (taskId: string, info?: RunInfo) => void;
  [key: string]: unknown;
}
interface WaveNodeData {
  label: string;
  [key: string]: unknown;
}
interface MiscNodeData {
  info: RunInfo;
  onOpen: (taskId: string | null, info?: RunInfo) => void;
  [key: string]: unknown;
}

function StatusGlyph({ status }: { status: NodeStatus }) {
  if (status === 'running' || status === 'queued')
    return <Loader2 size={12} className="animate-spin" style={{ color: STATUS_COLOR[status] }} />;
  if (status === 'done') return <CheckCircle2 size={12} style={{ color: STATUS_COLOR.done }} />;
  if (status === 'error') return <AlertCircle size={12} style={{ color: STATUS_COLOR.error }} />;
  if (status === 'cancelled') return <Ban size={12} style={{ color: STATUS_COLOR.cancelled }} />;
  return <Circle size={12} style={{ color: STATUS_COLOR.pending }} />;
}

// ---------- Custom nodes ----------

/**
 * Resolve the node status to display. A `running`/`queued` status only counts as
 * a live spinner when it comes from an in-flight (in-memory) run. A stale record
 * — e.g. an orphaned DB row — falls back to the checkbox: done if ticked, else
 * pending. This is what keeps a finished task from spinning forever.
 */
function nodeStatus(info: RunInfo | undefined, done: boolean): NodeStatus {
  const raw = info?.status ?? (done ? 'done' : 'pending');
  if ((raw === 'running' || raw === 'queued') && !info?.live) return done ? 'done' : 'pending';
  return raw;
}

function TaskNode({ data }: NodeProps) {
  const d = data as TaskNodeData;
  const status: NodeStatus = nodeStatus(d.info, d.done);
  const color = STATUS_COLOR[status];
  const live = status === 'running' || status === 'queued';
  const hasWarn = d.warnings.some((w) => w.level === 'warn');

  return (
    <div
      onClick={() => d.onOpen(d.task.id, d.info)}
      className={cn(
        'w-[230px] rounded-lg border bg-ink-900 px-2.5 py-2 cursor-pointer transition',
        'hover:border-accent/60 shadow-sm'
      )}
      style={{ borderColor: live ? color : 'rgba(82,82,91,0.6)' }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#52525b' }} />
      <div className="flex items-center gap-1.5">
        <StatusGlyph status={status} />
        <span className="text-[10px] font-mono text-ink-400">{d.task.id}</span>
        {d.task.waveLabel && (
          <span className="text-[9px] text-ink-600 ml-auto">{d.task.waveLabel}</span>
        )}
        {hasWarn && <AlertTriangle size={11} className="text-amber-400" />}
      </div>
      <div className="text-[11px] text-ink-100 leading-snug mt-1 line-clamp-2">
        {d.task.description || '(no description)'}
      </div>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        <span className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 bg-accent/15 text-accent">
          <Bot size={9} />
          {d.info?.agent ?? 'generic'}
          {d.info?.agentScope ? ` · ${scopeLabel(d.info.agentScope)}` : ''}
        </span>
        {d.info?.skill && (
          <span className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 bg-sky-500/15 text-sky-300">
            <Sparkles size={9} />
            {d.info.skill}
          </span>
        )}
        {d.fileCount > 0 && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 bg-emerald-500/15 text-emerald-300"
            title={`${d.fileCount} file${d.fileCount === 1 ? '' : 's'} written`}
          >
            <FileText size={9} />
            {d.fileCount}
          </span>
        )}
      </div>
      {(d.info?.resolvedModel || d.info?.model) && (
        <div className="text-[9px] text-ink-500 mt-1 font-mono truncate">
          {d.info.resolvedModel ?? d.info.model}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: '#52525b' }} />
    </div>
  );
}

function WaveNode({ data }: NodeProps) {
  const d = data as WaveNodeData;
  return (
    <div className="rounded-md bg-ink-800/80 border border-ink-700 px-3 py-1.5">
      <Handle type="target" position={Position.Left} style={{ background: '#52525b' }} />
      <span className="text-[11px] font-semibold text-ink-100 uppercase tracking-wide">
        {d.label}
      </span>
      <Handle type="source" position={Position.Right} style={{ background: '#52525b' }} />
    </div>
  );
}

function MiscNode({ data }: NodeProps) {
  const d = data as MiscNodeData;
  const status = d.info.status;
  return (
    <div
      onClick={() => d.onOpen(null, d.info)}
      className="w-[200px] rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-2 cursor-pointer hover:border-accent/60"
    >
      <div className="flex items-center gap-1.5">
        <StatusGlyph status={status} />
        <span className="text-[10px] text-ink-300">{d.info.agent ?? 'chat / spec'}</span>
      </div>
      {(d.info.resolvedModel || d.info.model) && (
        <div className="text-[9px] text-ink-500 mt-1 font-mono truncate">
          {d.info.resolvedModel ?? d.info.model}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: '#52525b' }} />
    </div>
  );
}

const nodeTypes = { task: TaskNode, wave: WaveNode, misc: MiscNode };

// ---------- Graph builder ----------

function buildGraph(
  doc: ReturnType<typeof parseTasks>,
  index: ReturnType<typeof indexRuns>,
  verify: (info?: RunInfo) => Warning[],
  fileCounts: Map<string, number>,
  onOpen: (taskId: string | null, info?: RunInfo) => void
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const waveNums = Array.from(new Set(doc.tasks.map((t) => t.waveNum))).sort((a, b) => a - b);
  const COL_W = 290;
  const ROW_H = 132;

  waveNums.forEach((num, wi) => {
    const x = wi * COL_W;
    const waveTasks = doc.tasks.filter((t) => t.waveNum === num);
    const label = waveTasks[0]?.waveLabel ?? `Wave ${num}`;
    const waveId = `wave-${num}`;
    nodes.push({
      id: waveId,
      type: 'wave',
      position: { x, y: 0 },
      data: { label },
      draggable: true,
    });
    // sequential wave edge
    if (wi > 0) {
      edges.push({
        id: `we-${waveNums[wi - 1]}-${num}`,
        source: `wave-${waveNums[wi - 1]}`,
        target: waveId,
        style: { stroke: '#3f3f46' },
      });
    }
    waveTasks.forEach((task, ti) => {
      const info = index.byTask.get(task.id);
      const id = `task-${task.id}`;
      nodes.push({
        id,
        type: 'task',
        position: { x, y: 70 + ti * ROW_H },
        data: {
          task,
          info,
          warnings: verify(info),
          done: task.done,
          fileCount: info?.runId ? fileCounts.get(info.runId) ?? 0 : 0,
          onOpen,
        },
        draggable: true,
      });
      // wave → task grouping edge
      edges.push({
        id: `wt-${num}-${task.id}`,
        source: waveId,
        target: id,
        style: { stroke: '#27272a' },
      });
    });
  });

  // explicit task dependency edges
  for (const task of doc.tasks) {
    for (const dep of task.dependencies) {
      if (!doc.tasks.find((t) => t.id === dep)) continue;
      const info = index.byTask.get(task.id);
      const live = !!info?.live && (info.status === 'running' || info.status === 'queued');
      edges.push({
        id: `dep-${dep}-${task.id}`,
        source: `task-${dep}`,
        target: `task-${task.id}`,
        animated: live,
        style: { stroke: live ? STATUS_COLOR.running : '#52525b', strokeWidth: 1.5 },
      });
    }
  }

  // loose (chat / spec / audit) runs in a left lane
  index.loose.slice(0, 12).forEach((info, i) => {
    nodes.push({
      id: `misc-${info.runId ?? i}`,
      type: 'misc',
      position: { x: -COL_W, y: i * 90 },
      data: { info, onOpen },
      draggable: true,
    });
  });

  return { nodes, edges };
}

// ---------- Detail drawer ----------

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 py-1 text-[11px]">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-200 break-words min-w-0">{children}</span>
    </div>
  );
}

function DetailDrawer({
  info,
  warnings,
  onClose,
}: {
  info: RunInfo;
  warnings: Warning[];
  onClose: () => void;
}) {
  const [row, setRow] = useState<RunRow | null>(null);
  const [files, setFiles] = useState<RunFileRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!info.runId) {
      setRow(null);
      setFiles([]);
      return;
    }
    setLoading(true);
    const runId = info.runId;
    Promise.all([
      window.kraken.history.getRun(runId),
      window.kraken.history.listRunFiles(runId),
    ])
      .then(([r, f]) => {
        if (!alive) return;
        setRow(r);
        setFiles(f);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [info.runId]);

  let command: string[] | string | null = null;
  if (row?.command) {
    try {
      command = JSON.parse(row.command);
    } catch {
      command = row.command;
    }
  }
  let tools: string[] | null = null;
  if (row?.tools) {
    try {
      tools = JSON.parse(row.tools);
    } catch {
      tools = null;
    }
  }

  return (
    <div className="absolute top-0 right-0 h-full w-[380px] bg-ink-950/95 backdrop-blur border-l border-ink-800 flex flex-col z-10">
      <div className="h-9 px-3 flex items-center justify-between border-b border-ink-800 shrink-0">
        <span className="text-xs font-semibold text-ink-100">Run verification</span>
        <button onClick={onClose} className="text-ink-500 hover:text-ink-100">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {warnings.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-1.5 text-[11px] rounded-md px-2 py-1.5 leading-snug',
                  w.level === 'warn'
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    : 'bg-ink-800/60 text-ink-300 border border-ink-700'
                )}
              >
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        <section className="mb-3">
          <h4 className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
            Routing
          </h4>
          <Row label="Agent">
            {info.agent ?? 'generic'}{' '}
            {info.agentScope && <span className="text-ink-500">({scopeLabel(info.agentScope)})</span>}
          </Row>
          <Row label="Reason">{info.routeReason ?? '—'}</Row>
          <Row label="Skill">
            {info.skill ?? '—'}{' '}
            {info.skillScope && <span className="text-ink-500">({scopeLabel(info.skillScope)})</span>}
          </Row>
          <Row label="Status">{info.status}</Row>
        </section>

        <section className="mb-3">
          <h4 className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
            Model
          </h4>
          <Row label="Requested">{row?.model ?? info.model ?? '—'}</Row>
          <Row label="Actual">{row?.resolved_model ?? info.resolvedModel ?? '—'}</Row>
          <Row label="Source">{row?.model_source ?? '—'}</Row>
          <Row label="Backend">{row?.backend ?? '—'}</Row>
        </section>

        <section className="mb-3">
          <h4 className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
            Invocation
          </h4>
          {loading && <p className="text-[11px] text-ink-500">Loading run record…</p>}
          {!loading && !row && (
            <p className="text-[11px] text-ink-500">
              No persisted record (live run — details appear once it starts).
            </p>
          )}
          {command && (
            <pre className="text-[10px] bg-ink-900 border border-ink-800 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words text-ink-300">
              {Array.isArray(command) ? command.join(' ') : command}
            </pre>
          )}
          {tools && (
            <Row label="Tools">
              <span className="text-[10px] font-mono">{tools.join(', ')}</span>
            </Row>
          )}
          {row?.permission_mode && <Row label="Perms">{row.permission_mode}</Row>}
          {row?.duration_ms != null && <Row label="Duration">{fmtDuration(row.duration_ms)}</Row>}
        </section>

        <section className="mb-3">
          <h4 className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1 flex items-center gap-1.5">
            Output files
            {files.length > 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                {files.length}
              </span>
            )}
          </h4>
          {files.length === 0 ? (
            <p className="text-[11px] text-ink-500">
              No files recorded for this run{loading ? '…' : ' (read-only, or none written yet).'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-1.5 text-[11px] text-ink-200 rounded px-1.5 py-1 hover:bg-ink-800/50"
                  title={f.path}
                >
                  {f.op === 'write' ? (
                    <FilePlus2 size={12} className="text-emerald-400 shrink-0" />
                  ) : (
                    <FilePen size={12} className="text-sky-400 shrink-0" />
                  )}
                  <span className="font-mono truncate">
                    {f.path.split('/').slice(-2).join('/')}
                  </span>
                  <span className="text-[9px] text-ink-500 ml-auto shrink-0">
                    {f.tool}
                    {f.count > 1 ? ` ×${f.count}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {row?.prompt && (
          <section className="mb-3">
            <h4 className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
              Prompt
            </h4>
            <pre className="text-[10px] bg-ink-900 border border-ink-800 rounded-md p-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-ink-300">
              {row.prompt}
            </pre>
          </section>
        )}
        {row?.system && (
          <section className="mb-3">
            <h4 className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-1">
              System
            </h4>
            <pre className="text-[10px] bg-ink-900 border border-ink-800 rounded-md p-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-ink-400">
              {row.system}
            </pre>
          </section>
        )}
        {row?.error && (
          <section className="mb-3">
            <h4 className="text-[10px] uppercase tracking-wider text-bad font-semibold mb-1">Error</h4>
            <pre className="text-[10px] bg-bad/10 border border-bad/30 rounded-md p-2 whitespace-pre-wrap break-words text-bad">
              {row.error}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}

// ---------- Main view ----------

export function AgentGraphView() {
  const specs = useWorkspace((s) => s.specs);
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const root = useWorkspace((s) => s.root);
  const runs = useOrchestrator((s) => s.runs);
  const log = useOrchestrator((s) => s.log);

  const [specId, setSpecId] = useState<string | null>(specs[0]?.id ?? null);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [tasksMd, setTasksMd] = useState('');
  const [history, setHistory] = useState<RunRow[]>([]);
  const [fileCounts, setFileCounts] = useState<Map<string, number>>(new Map());
  const [selected, setSelected] = useState<{ info: RunInfo; warnings: Warning[] } | null>(null);

  // Keep a valid spec selected as the spec list changes.
  useEffect(() => {
    if (!specId && specs[0]) setSpecId(specs[0].id);
  }, [specs, specId]);

  // Load the selected spec's tasks.md.
  useEffect(() => {
    let alive = true;
    if (!root || !specId) {
      setTasksMd('');
      return;
    }
    window.kraken.specs.read(root, specId).then((res) => {
      if (alive) setTasksMd(res.files.tasks ?? '');
    });
    return () => {
      alive = false;
    };
  }, [root, specId]);

  const loadHistory = useCallback(() => {
    if (!specId) {
      setHistory([]);
      setFileCounts(new Map());
      return;
    }
    window.kraken.history
      .listRuns({ workspacePath: root ?? null, specId, limit: 300 })
      .then(setHistory);
    window.kraken.history
      .runFileCounts({ workspacePath: root ?? null, specId })
      .then((rows) => setFileCounts(new Map(rows.map((r) => [r.run_id, r.files]))));
  }, [root, specId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const doc = useMemo(() => parseTasks(tasksMd), [tasksMd]);
  const liveRuns = useMemo(() => Object.values(runs), [runs]);

  const index = useMemo(
    () => indexRuns(specId, liveRuns, log, history, includeHistory),
    [specId, liveRuns, log, history, includeHistory]
  );

  const onOpen = useCallback(
    (_taskId: string | null, info?: RunInfo) => {
      if (!info) {
        setSelected(null);
        return;
      }
      setSelected({ info, warnings: verifyRun(info, agents, skills) });
    },
    [agents, skills]
  );

  const computed = useMemo(
    () => buildGraph(doc, index, (info) => verifyRun(info, agents, skills), fileCounts, onOpen),
    [doc, index, agents, skills, fileCounts, onOpen]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(computed.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computed.edges);

  // Re-sync when the underlying graph changes (live status, spec switch).
  useEffect(() => {
    setNodes(computed.nodes);
    setEdges(computed.edges);
  }, [computed, setNodes, setEdges]);

  // Verification summary stats.
  const stats = useMemo(() => {
    let warns = 0;
    const models = new Map<string, number>();
    for (const info of index.byTask.values()) {
      if (verifyRun(info, agents, skills).some((w) => w.level === 'warn')) warns++;
      const m = info.resolvedModel ?? info.model;
      if (m) models.set(m, (models.get(m) ?? 0) + 1);
    }
    return { warns, runs: index.byTask.size, models: [...models.entries()] };
  }, [index, agents, skills]);

  if (specs.length === 0) {
    return (
      <div className="h-full grid place-items-center text-ink-500 text-sm">
        No specs yet — create a spec with a tasks.md to see its agent graph.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-10 px-3 flex items-center gap-3 border-b border-ink-800 shrink-0">
        <select
          value={specId ?? ''}
          onChange={(e) => setSpecId(e.target.value || null)}
          className="bg-ink-900 border border-ink-700 rounded-md text-xs text-ink-100 px-2 py-1 max-w-[240px]"
        >
          {specs.map((s: SpecMeta) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] text-ink-300 cursor-pointer">
          <input
            type="checkbox"
            checked={includeHistory}
            onChange={(e) => setIncludeHistory(e.target.checked)}
          />
          Include history
        </label>
        <button
          onClick={loadHistory}
          className="text-[11px] flex items-center gap-1 text-ink-400 hover:text-ink-100"
          title="Reload run history"
        >
          <RefreshCw size={11} /> Refresh
        </button>
        <div className="ml-auto text-[11px] text-ink-500 flex items-center gap-3">
          <span>{stats.runs} tracked</span>
          {fileCounts.size > 0 && (
            <span className="text-emerald-400 flex items-center gap-1">
              <FileText size={11} />
              {[...fileCounts.values()].reduce((a, b) => a + b, 0)} files
            </span>
          )}
          {stats.warns > 0 && (
            <span className="text-amber-400 flex items-center gap-1">
              <AlertTriangle size={11} /> {stats.warns} warning{stats.warns === 1 ? '' : 's'}
            </span>
          )}
          {stats.models.length > 0 && (
            <span className="font-mono text-ink-400 truncate max-w-[280px]">
              {stats.models.map(([m, n]) => `${m}×${n}`).join('  ')}
            </span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          onPaneClick={() => setSelected(null)}
        >
          <Background color="#27272a" gap={20} />
          <Controls className="!bg-ink-900 !border-ink-700" />
          <MiniMap
            pannable
            zoomable
            className="!bg-ink-900 !border !border-ink-700"
            nodeColor={(n) => {
              const d = n.data as TaskNodeData;
              return STATUS_COLOR[nodeStatus(d?.info, !!d?.done)] ?? '#52525b';
            }}
          />
        </ReactFlow>

        {selected && (
          <DetailDrawer
            info={selected.info}
            warnings={selected.warnings}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
