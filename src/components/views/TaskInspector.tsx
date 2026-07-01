import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ban,
  Circle,
  Bot,
  Sparkles,
  FileText,
  FilePlus2,
  FilePen,
  Clock,
  Cpu,
  Terminal,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ListChecks,
} from 'lucide-react';
import { useOrchestrator } from '../../stores/orchestrator';
import { useWorkspace } from '../../stores/workspace';
import { useChat } from '../../stores/chat';
import {
  indexRuns,
  verifyRun,
  fmtDuration,
  STATUS_COLOR,
  type NodeStatus,
} from '../../lib/graphModel';
import { routeAgent } from '../../lib/agentRouter';
import { scopeLabel } from '../../lib/verifyLibrary';
import { cn } from '../../lib/cn';
import type { ParsedTask } from '../../lib/tasks';
import type { SpecMeta, RunRow, RunFileRow } from '../../../electron/shared/types';

const STATUS_LABEL: Record<NodeStatus, string> = {
  running: 'Running',
  queued: 'Queued',
  done: 'Done',
  error: 'Error',
  cancelled: 'Cancelled',
  pending: 'Not run yet',
};

function StatusGlyph({ status, size = 14 }: { status: NodeStatus; size?: number }) {
  const color = STATUS_COLOR[status];
  if (status === 'running' || status === 'queued')
    return <Loader2 size={size} className="animate-spin" style={{ color }} />;
  if (status === 'done') return <CheckCircle2 size={size} style={{ color }} />;
  if (status === 'error') return <AlertCircle size={size} style={{ color }} />;
  if (status === 'cancelled') return <Ban size={size} style={{ color }} />;
  return <Circle size={size} style={{ color }} />;
}

/**
 * Full-screen inspector for a single task — surfaces everything about the run
 * (or the run that is about to run): the resolved agent + its persona, the
 * skill, model/backend, invocation, files written, and the full transcript.
 * Pulls live state from the orchestrator and the persisted record from history,
 * the same data the Agent Graph drawer shows.
 */
export function TaskInspector({
  task,
  meta,
  onClose,
}: {
  task: ParsedTask;
  meta: SpecMeta;
  onClose: () => void;
}) {
  const runs = useOrchestrator((s) => s.runs);
  const log = useOrchestrator((s) => s.log);
  const root = useWorkspace((s) => s.root);
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const selectedAgent = useChat((s) => s.selectedAgent);

  const [history, setHistory] = useState<RunRow[]>([]);
  const [row, setRow] = useState<RunRow | null>(null);
  const [files, setFiles] = useState<RunFileRow[]>([]);
  const [loadingRow, setLoadingRow] = useState(false);

  useEffect(() => {
    let alive = true;
    window.kraken.history
      .listRuns({ workspacePath: root ?? null, specId: meta.id, limit: 300 })
      .then((h) => alive && setHistory(h))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [root, meta.id]);

  const info = useMemo(
    () => indexRuns(meta.id, Object.values(runs), log, history, true).byTask.get(task.id),
    [meta.id, runs, log, history, task.id]
  );
  const status: NodeStatus = info?.status ?? (task.done ? 'done' : 'pending');
  const warnings = useMemo(() => verifyRun(info, agents, skills), [info, agents, skills]);

  // The agent that would run this task (used when there's no run yet, and to
  // resolve the persona for a run whose agent is still installed).
  const routed = useMemo(
    () =>
      routeAgent(
        { kind: 'task-execute', taskAgent: task.agent, taskText: task.description },
        agents,
        selectedAgent
      ),
    [task.agent, task.description, agents, selectedAgent]
  );

  const agentName = info?.agent ?? routed.name ?? null;
  const agentMeta = agentName ? agents.find((a) => a.name === agentName) ?? null : null;
  const skillName = info?.skill ?? null;
  const skillMeta = skillName ? skills.find((s) => s.name === skillName) ?? null : null;
  const routeReason = info?.routeReason ?? routed.reason ?? null;

  useEffect(() => {
    let alive = true;
    if (!info?.runId) {
      setRow(null);
      setFiles([]);
      return;
    }
    setLoadingRow(true);
    Promise.all([
      window.kraken.history.getRun(info.runId),
      window.kraken.history.listRunFiles(info.runId),
    ])
      .then(([r, f]) => {
        if (!alive) return;
        setRow(r);
        setFiles(f);
      })
      .finally(() => {
        if (alive) setLoadingRow(false);
      });
    return () => {
      alive = false;
    };
  }, [info?.runId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  let command: string | null = null;
  if (row?.command) {
    try {
      const c = JSON.parse(row.command);
      command = Array.isArray(c) ? c.join(' ') : String(c);
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

  const live = status === 'running' || status === 'queued';
  const elapsed = info?.startedAt
    ? fmtDuration(
        (live ? Date.now() : row?.ended_at ? Date.parse(row.ended_at) : Date.now()) - info.startedAt
      )
    : row?.duration_ms != null
      ? fmtDuration(row.duration_ms)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full h-full max-w-[1240px] max-h-[92vh] rounded-2xl bg-panel shadow-card ring-1 ring-ink-50/[0.06] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-rail shrink-0">
          <StatusGlyph status={status} size={18} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] text-faint">{task.id}</span>
              <span
                className="font-mono text-[11px] px-2 py-0.5 rounded"
                style={{ color: STATUS_COLOR[status], background: `${STATUS_COLOR[status]}1f` }}
              >
                {STATUS_LABEL[status]}
              </span>
              <span className="font-mono text-[11px] text-ink-600">{task.waveLabel}</span>
            </div>
            <h2 className="font-display text-[18px] font-semibold text-ink-50 leading-tight truncate mt-0.5">
              {task.description || '(no description)'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-lg text-faint hover:text-ink-100 hover:bg-elev shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-2 flex-wrap px-6 py-3 bg-rail/60 shrink-0">
          <Chip icon={<Bot size={11} />} tone="accent">
            {agentName ?? 'generic'}
            {info?.agentScope
              ? ` · ${scopeLabel(info.agentScope)}`
              : agentMeta
                ? ` · ${scopeLabel(agentMeta.scope)}`
                : ''}
          </Chip>
          {skillName && (
            <Chip icon={<Sparkles size={11} />} tone="sky">
              {skillName}
            </Chip>
          )}
          {(info?.resolvedModel || info?.model || row?.model) && (
            <Chip icon={<Cpu size={11} />}>
              {info?.resolvedModel ?? row?.resolved_model ?? info?.model ?? row?.model}
            </Chip>
          )}
          {elapsed && <Chip icon={<Clock size={11} />}>{elapsed}</Chip>}
          {files.length > 0 && (
            <Chip icon={<FileText size={11} />} tone="emerald">
              {files.length} file{files.length === 1 ? '' : 's'}
            </Chip>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {warnings.length > 0 && (
            <div className="mb-5 space-y-1.5">
              {warnings.map((w, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 text-[12px] rounded-lg px-3 py-2 leading-snug',
                    w.level === 'warn' ? 'bg-amber-500/10 text-amber-300' : 'bg-elev text-dim'
                  )}
                >
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* LEFT — task + agent + skill */}
            <div className="space-y-5">
              <Section icon={<ListChecks size={13} />} title="Task">
                <Field label="ID">{task.id}</Field>
                <Field label="Wave">{task.waveLabel}</Field>
                <Field label="Status">{STATUS_LABEL[status]}</Field>
                <Field label="Depends on">
                  {task.dependencies.length ? task.dependencies.join(', ') : '—'}
                </Field>
                <Field label="Declared">{task.agent ? `@${task.agent}` : '—'}</Field>
                <Field label="Spec">
                  {meta.name} ({meta.kind})
                </Field>
              </Section>

              <Section icon={<Bot size={13} />} title="Agent">
                <Field label="Name">{agentName ?? 'generic Claude'}</Field>
                <Field label="Scope">
                  {info?.agentScope
                    ? scopeLabel(info.agentScope)
                    : agentMeta
                      ? scopeLabel(agentMeta.scope)
                      : '—'}
                </Field>
                <Field label="Routing">{routeReason ?? '—'}</Field>
                {agentMeta?.model && <Field label="Model">{agentMeta.model}</Field>}
                {agentMeta?.description && <Field label="About">{agentMeta.description}</Field>}
                {!agentMeta && agentName && (
                  <p className="text-[11px] text-amber-300 mt-1.5">
                    Not installed in <code className="md-codespan">.claude/agents</code> — generic
                    Claude will run.
                  </p>
                )}
                {agentMeta?.body && (
                  <Collapsible label="Persona (system prompt)">
                    <CodeBody text={agentMeta.body} />
                  </Collapsible>
                )}
              </Section>

              {(skillMeta || skillName) && (
                <Section icon={<Sparkles size={13} />} title="Skill">
                  <Field label="Name">{skillName}</Field>
                  <Field label="Scope">
                    {info?.skillScope
                      ? scopeLabel(info.skillScope)
                      : skillMeta
                        ? scopeLabel(skillMeta.scope)
                        : '—'}
                  </Field>
                  {skillMeta?.description && <Field label="About">{skillMeta.description}</Field>}
                  {skillMeta?.body && (
                    <Collapsible label="Instructions (SKILL.md)">
                      <CodeBody text={skillMeta.body} />
                    </Collapsible>
                  )}
                </Section>
              )}
            </div>

            {/* RIGHT — run record */}
            <div className="space-y-5">
              <Section icon={<Cpu size={13} />} title="Model & backend">
                <Field label="Requested">{row?.model ?? info?.model ?? '—'}</Field>
                <Field label="Actual">{row?.resolved_model ?? info?.resolvedModel ?? '—'}</Field>
                <Field label="Source">{row?.model_source ?? '—'}</Field>
                <Field label="Backend">{row?.backend ?? '—'}</Field>
              </Section>

              <Section icon={<Terminal size={13} />} title="Invocation">
                {loadingRow && <p className="text-[11px] text-faint">Loading run record…</p>}
                {!loadingRow && !info?.runId && (
                  <p className="text-[11px] text-faint leading-relaxed">
                    No run yet — this is the agent that will execute {task.id} when you run it.
                  </p>
                )}
                {!loadingRow && info?.runId && !row && (
                  <p className="text-[11px] text-faint leading-relaxed">
                    Live run in progress — the persisted invocation + transcript appear once it
                    finishes. Watch the Activity stream for live output.
                  </p>
                )}
                {command && <CodeBody text={command} />}
                {tools && (
                  <Field label="Tools">
                    <span className="font-mono text-[11px]">{tools.join(', ')}</span>
                  </Field>
                )}
                {row?.permission_mode && <Field label="Perms">{row.permission_mode}</Field>}
                {row?.duration_ms != null && (
                  <Field label="Duration">{fmtDuration(row.duration_ms)}</Field>
                )}
                {row?.source && <Field label="Source">{row.source}</Field>}
              </Section>

              <Section
                icon={<FileText size={13} />}
                title={`Files changed${files.length ? ` (${files.length})` : ''}`}
              >
                {files.length === 0 ? (
                  <p className="text-[11px] text-faint">
                    No files recorded{loadingRow ? '…' : ' for this run.'}
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 text-[12px] text-ink-200 rounded px-2 py-1.5 hover:bg-elev/60"
                        title={f.path}
                      >
                        {f.op === 'write' ? (
                          <FilePlus2 size={13} className="text-emerald-400 shrink-0" />
                        ) : (
                          <FilePen size={13} className="text-sky-400 shrink-0" />
                        )}
                        <span className="font-mono truncate flex-1">{f.path}</span>
                        <span className="text-[10px] text-faint shrink-0">
                          {f.tool}
                          {f.count > 1 ? ` ×${f.count}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </div>

          {/* Transcript — full width */}
          {(row?.error || row?.response || row?.prompt || row?.system) && (
            <div className="mt-5 space-y-3">
              {row?.error && (
                <Section icon={<AlertCircle size={13} className="text-bad" />} title="Error" tone="bad">
                  <CodeBody text={row.error} tone="bad" />
                </Section>
              )}
              {row?.response && (
                <Collapsible label="Response" defaultOpen>
                  <CodeBody text={row.response} />
                </Collapsible>
              )}
              {row?.prompt && (
                <Collapsible label="Prompt">
                  <CodeBody text={row.prompt} />
                </Collapsible>
              )}
              {row?.system && (
                <Collapsible label="System prompt">
                  <CodeBody text={row.system} />
                </Collapsible>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Tone = 'default' | 'accent' | 'sky' | 'emerald';

function Chip({
  icon,
  tone = 'default',
  children,
}: {
  icon: React.ReactNode;
  tone?: Tone;
  children: React.ReactNode;
}) {
  const tones: Record<Tone, string> = {
    default: 'bg-elev text-dim',
    accent: 'bg-accent/15 text-accent',
    sky: 'bg-sky-500/15 text-sky-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
  };
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono',
        tones[tone]
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function Section({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: 'bad';
  children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-2xl bg-card p-4', tone === 'bad' && 'ring-1 ring-bad/30')}>
      <h3 className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-faint mb-2.5">
        {icon}
        {title.toUpperCase()}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 py-1 text-[12.5px]">
      <span className="text-faint">{label}</span>
      <span className="text-ink-100 break-words min-w-0">{children}</span>
    </div>
  );
}

function Collapsible({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown size={13} className="text-faint" />
        ) : (
          <ChevronRight size={13} className="text-faint" />
        )}
        <span className="font-mono text-[11px] tracking-wider text-faint">
          {label.toUpperCase()}
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function CodeBody({ text, tone }: { text: string; tone?: 'bad' }) {
  return (
    <pre
      className={cn(
        'text-[11px] leading-relaxed rounded-lg p-3 max-h-[360px] overflow-auto whitespace-pre-wrap break-words font-mono',
        tone === 'bad' ? 'bg-bad/10 text-bad' : 'bg-bg text-dim'
      )}
    >
      {text}
    </pre>
  );
}
