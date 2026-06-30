import { useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Cpu,
  ArrowUpRight,
  ArrowRight,
  FilePlus2,
  Bug,
  FileCode2,
  Zap,
  BookOpen,
  Bot,
  Play,
  FolderOpen,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { useChat } from '../../stores/chat';
import { useOrchestrator } from '../../stores/orchestrator';
import { NewSpecDialog } from '../dialogs/NewSpecDialog';
import { cn } from '../../lib/cn';
import type { AgentMeta, SpecMeta, SpecKind } from '../../../electron/shared/types';

// Deterministic avatar hue per agent name — drawn from the design's palette.
const HUES = ['#7c5cff', '#2bb3d6', '#35d6a0', '#f3b14e', '#ef6b6b', '#9b80ff', '#22d3c5'];
function hueFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}
function mono(name: string) {
  return (name.replace(/[^a-z0-9]/gi, '')[0] ?? '?').toUpperCase();
}

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

const PHASE_INDEX: Record<SpecMeta['phase'], number> = {
  requirements: 0,
  design: 1,
  tasks: 2,
  done: 3,
};

export function WelcomeView() {
  const root = useWorkspace((s) => s.root);
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const specs = useWorkspace((s) => s.specs);
  const agents = useWorkspace((s) => s.agents);
  const setActivity = useUi((s) => s.setActivity);
  const openTab = useUi((s) => s.openTab);
  const chatOpen = useUi((s) => s.chatOpen);
  const toggleChat = useUi((s) => s.toggleChat);
  const skills = useWorkspace((s) => s.skills);
  const setPendingPrompt = useChat((s) => s.setPendingPrompt);
  const selectedAgent = useChat((s) => s.selectedAgent);
  const setSelectedAgent = useChat((s) => s.setSelectedAgent);
  const runs = useOrchestrator((s) => s.runs);
  const runningCount = useOrchestrator((s) => s.runningCount());

  const [showNew, setShowNew] = useState(false);
  const [newKind, setNewKind] = useState<SpecKind>('feature');
  const [command, setCommand] = useState('');
  const [menu, setMenu] = useState<'slash' | 'at' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }, []);

  // Running agents grouped by spec, for the spec cards.
  const runningBySpec = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of Object.values(runs)) {
      if (!r.specId || !(r.status === 'running' || r.status === 'queued')) continue;
      const arr = map.get(r.specId) ?? [];
      if (r.agent) arr.push(r.agent);
      map.set(r.specId, arr);
    }
    return map;
  }, [runs]);

  const runningAgentNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of Object.values(runs)) {
      if (r.agent && (r.status === 'running' || r.status === 'queued')) set.add(r.agent);
    }
    return set;
  }, [runs]);

  // Continue working: unfinished specs first, then most-recently-updated.
  const continuing = useMemo(() => {
    return [...specs]
      .sort((a, b) => {
        const ad = a.phase === 'done' ? 1 : 0;
        const bd = b.phase === 'done' ? 1 : 0;
        if (ad !== bd) return ad - bd;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, 4);
  }, [specs]);

  const activeCount = specs.filter((s) => s.phase !== 'done').length;

  const newSpec = (kind: SpecKind) => {
    setNewKind(kind);
    setShowNew(true);
  };

  const openSpec = (spec: SpecMeta) => {
    const file: 'requirements' | 'bugfix' = spec.kind === 'feature' ? 'requirements' : 'bugfix';
    openTab({
      id: `spec:${spec.id}:${file}`,
      title: `${spec.name} / ${file}.md`,
      kind: 'spec',
      specId: spec.id,
      specFile: file,
    });
  };

  const runSpec = (spec: SpecMeta) => {
    openTab({
      id: `spec:${spec.id}:tasks`,
      title: `${spec.name} / tasks.md`,
      kind: 'spec',
      specId: spec.id,
      specFile: 'tasks',
    });
  };

  const openAgent = (a: AgentMeta) => {
    openTab({ id: `agent:${a.path}`, title: a.name, kind: 'agent', filePath: a.path });
  };

  const submitCmd = () => {
    const text = command.trim();
    if (!text) return;
    if (!chatOpen) toggleChat();
    setPendingPrompt(text);
    setCommand('');
    setMenu(null);
  };

  const onCmdChange = (v: string) => {
    setCommand(v);
    if (v.endsWith('@') && (v.length === 1 || v[v.length - 2] === ' ')) setMenu('at');
    else if (v === '/' || v.endsWith(' /')) setMenu('slash');
    else setMenu(null);
  };

  // ---- No workspace: focused open-folder hero ----
  if (!root) {
    return (
      <div className="h-full overflow-y-auto bg-ink-950 grid place-items-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto grid place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 shadow-glow text-white text-3xl">
            🐙
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-50">
            Welcome to Kraken
          </h1>
          <p className="mt-2 text-sm text-dim leading-relaxed">
            Open any folder to begin. Specs live in{' '}
            <code className="font-mono text-[12px] text-accent-2 bg-accent/15 px-1.5 py-0.5 rounded">
              .kraken/specs/
            </code>
            ; your existing <code className="font-mono text-[12px] text-accent-2 bg-accent/15 px-1.5 py-0.5 rounded">.claude/</code>{' '}
            agents &amp; skills load automatically.
          </p>
          <button
            onClick={pickWorkspace}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white text-sm font-semibold shadow-glow hover:opacity-95 transition"
          >
            <FolderOpen size={16} /> Open folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-ink-950">
      <div className="max-w-[1060px] mx-auto px-11 pt-9 pb-16">
        {/* greeting */}
        <div className="flex items-end justify-between gap-5 mb-[18px]">
          <div>
            <div className="text-[12.5px] text-faint font-medium tracking-[0.02em] mb-1.5">
              {greeting} · {specs.length} spec{specs.length === 1 ? '' : 's'} in flight
            </div>
            <h1 className="m-0 text-[29px] font-semibold tracking-[-0.02em] text-ink-50">
              What should we build?
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 px-3 py-[7px] rounded-full bg-card border border-ink-800">
            <span className="relative w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-good" />
              {runningCount > 0 && (
                <span className="absolute inset-0 rounded-full bg-good animate-ping2" />
              )}
            </span>
            <span className="text-xs text-dim">
              <b className="text-ink-50 font-semibold">{runningCount}</b> agents running
            </span>
          </div>
        </div>

        {/* command bar */}
        <div className="relative mb-[34px]">
          <div className="flex items-center gap-3 pl-4 pr-3 py-3 rounded-[15px] bg-card border border-ink-800 focus-within:border-accent/50 focus-within:shadow-glow transition">
            <Sparkles size={19} className="text-accent-2 shrink-0" />
            <input
              ref={inputRef}
              value={command}
              onChange={(e) => onCmdChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCmd();
                if (e.key === 'Escape') setMenu(null);
              }}
              placeholder="Describe a feature, paste a bug, or ask Claude…  Type / for skills, @ for agents"
              className="flex-1 bg-transparent border-none outline-none text-ink-50 text-[15px] placeholder:text-faint"
            />
            {selectedAgent && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-accent-2 bg-accent/15 pl-2 pr-1 py-1 rounded-md">
                @{selectedAgent}
                <button onClick={() => setSelectedAgent(null)} className="hover:text-ink-50">
                  <X size={11} />
                </button>
              </span>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-faint font-mono px-2.5 py-1 rounded-md bg-ink-50/[0.045]">
              <Cpu size={13} /> agent
            </div>
            <button
              onClick={submitCmd}
              className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 bg-gradient-to-br from-accent to-accent-2 text-white text-[13px] font-semibold shadow-glow hover:opacity-95 transition"
            >
              Start <ArrowUpRight size={14} />
            </button>
          </div>

          {/* quick chips */}
          <div className="flex items-center gap-2.5 mt-3">
            <button
              onClick={() => newSpec('feature')}
              className="flex items-center gap-1.5 border border-ink-800 rounded-[9px] px-3 py-[7px] bg-card text-dim text-[12.5px] font-medium hover:border-accent/45 hover:text-ink-50 transition"
            >
              <FilePlus2 size={15} className="text-accent-2" /> New feature spec
            </button>
            <button
              onClick={() => newSpec('bugfix')}
              className="flex items-center gap-1.5 border border-ink-800 rounded-[9px] px-3 py-[7px] bg-card text-dim text-[12.5px] font-medium hover:border-accent/45 hover:text-ink-50 transition"
            >
              <Bug size={15} className="text-warn" /> New bugfix spec
            </button>
            <div className="flex-1" />
            <span className="text-[11.5px] text-faint">
              Feature flow: <b className="text-dim font-medium">Requirements → Design → Tasks</b>
            </span>
          </div>

          {/* / and @ popovers */}
          {menu === 'slash' && skills.length > 0 && (
            <Popover label="Skills">
              {skills.slice(0, 6).map((k) => (
                <button
                  key={k.path}
                  onMouseDown={() => {
                    setCommand(`/${k.name} `);
                    setMenu(null);
                    inputRef.current?.focus();
                  }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[9px] hover:bg-accent/15 text-left"
                >
                  <Sparkles size={15} className="text-accent-2 w-4 text-center shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ink-50 font-medium truncate">{k.name}</div>
                    <div className="text-[11px] text-faint truncate">{k.description}</div>
                  </div>
                  <span className="font-mono text-[10.5px] text-faint shrink-0">/{k.name}</span>
                </button>
              ))}
            </Popover>
          )}
          {menu === 'at' && agents.length > 0 && (
            <Popover label="Agents">
              {agents.slice(0, 6).map((a) => (
                <button
                  key={a.path}
                  onMouseDown={() => {
                    setSelectedAgent(a.name);
                    setCommand(command.replace(/@$/, ''));
                    setMenu(null);
                    inputRef.current?.focus();
                  }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[9px] hover:bg-accent/15 text-left"
                >
                  <Avatar name={a.name} size={24} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ink-50 font-medium truncate">{a.name}</div>
                    <div className="text-[11px] text-faint truncate">{a.description}</div>
                  </div>
                </button>
              ))}
            </Popover>
          )}
        </div>

        {/* Continue working */}
        {continuing.length > 0 && (
          <>
            <SectionHeader
              title="Continue working"
              badge={`${activeCount} active`}
              action={
                <button
                  onClick={() => setActivity('specs')}
                  className="flex items-center gap-1.5 text-[12.5px] text-dim hover:text-ink-50 transition"
                >
                  View all <ArrowRight size={13} />
                </button>
              }
            />
            <div className="grid grid-cols-2 gap-3.5 mb-[38px]">
              {continuing.map((s) => (
                <SpecCard
                  key={s.id}
                  spec={s}
                  runningAgents={runningBySpec.get(s.id) ?? []}
                  onOpen={() => openSpec(s)}
                  onRun={() => runSpec(s)}
                />
              ))}
            </div>
          </>
        )}

        {/* Your Kraken — agent fleet */}
        <div className="flex items-center gap-3 mb-[15px]">
          <span className="text-lg animate-float">🐙</span>
          <h2 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-ink-50">Your Kraken</h2>
          <span className="text-xs text-faint">— run agents in parallel across specs</span>
          <div className="flex-1" />
          <button
            onClick={() => setActivity('orchestrator')}
            className="flex items-center gap-1.5 border border-accent/45 bg-accent/15 text-accent-2 px-3 py-1.5 rounded-[9px] text-xs font-semibold hover:bg-accent hover:text-white transition"
          >
            <Zap size={14} /> Run fleet
          </button>
        </div>
        {agents.length > 0 ? (
          <div className="grid grid-cols-5 gap-2.5 mb-[38px]">
            {agents.slice(0, 10).map((a) => (
              <AgentCard
                key={a.path}
                agent={a}
                running={runningAgentNames.has(a.name)}
                onClick={() => openAgent(a)}
              />
            ))}
          </div>
        ) : (
          <EmptyHint
            text="No agents installed yet."
            actionLabel="Seed defaults"
            onAction={seedDefaults}
          />
        )}

        {/* SDD loop + discovery */}
        <div className="grid grid-cols-[1.55fr_1fr] gap-3.5">
          <div className="border border-ink-800 rounded-[14px] bg-card px-[22px] py-5">
            <div className="flex items-center gap-2.5 mb-4">
              <BookOpen size={17} className="text-accent-2" />
              <h3 className="m-0 text-sm font-semibold text-ink-50">The SDD loop</h3>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { n: 1, t: 'Requirements', d: 'capture user stories and EARS acceptance criteria.' },
                { n: 2, t: 'Design', d: 'architecture, components, data, sequences, testing.' },
                { n: 3, t: 'Tasks', d: 'dependency-ordered waves with explicit outcomes.' },
              ].map((l) => (
                <div key={l.n} className="flex gap-3 items-start">
                  <span className="w-6 h-6 shrink-0 grid place-items-center rounded-lg font-mono text-xs font-semibold text-accent-2 bg-accent/15 border border-accent/45">
                    {l.n}
                  </span>
                  <div className="pt-px text-[13px]">
                    <span className="font-semibold text-ink-50">{l.t}</span>
                    <span className="text-dim"> — {l.d}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3.5 border-t border-ink-800 text-xs text-faint leading-relaxed">
              Bugfix specs swap step 1 for{' '}
              <b className="text-dim font-medium">Reproduce → Diagnose → Fix</b>, with regression
              guards instead of new acceptance criteria.
            </div>
          </div>
          <div className="flex flex-col gap-3.5">
            <DiscoveryCard
              icon={<Bot size={20} className="text-accent-2" />}
              title="Browse agents"
              desc="Specialized SDD agents you invoke from chat with @."
              onClick={() => setActivity('agents')}
            />
            <DiscoveryCard
              icon={<Sparkles size={20} className="text-accent-2" />}
              title="Browse skills"
              desc="Reusable SKILL.md packages with progressive disclosure."
              onClick={() => setActivity('skills')}
            />
          </div>
        </div>
      </div>

      {showNew && <NewSpecDialog defaultKind={newKind} onClose={() => setShowNew(false)} />}
    </div>
  );
}

function SectionHeader({
  title,
  badge,
  action,
}: {
  title: string;
  badge?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-ink-50">{title}</h2>
      {badge && (
        <span className="text-[11px] text-faint bg-ink-50/[0.045] px-2 py-0.5 rounded-full font-mono">
          {badge}
        </span>
      )}
      <div className="flex-1" />
      {action}
    </div>
  );
}

function SpecCard({
  spec,
  runningAgents,
  onOpen,
  onRun,
}: {
  spec: SpecMeta;
  runningAgents: string[];
  onOpen: () => void;
  onRun: () => void;
}) {
  const isFeature = spec.kind === 'feature';
  const stepNames = isFeature
    ? ['Requirements', 'Design', 'Tasks']
    : ['Reproduce', 'Diagnose', 'Fix'];
  const phaseIdx = PHASE_INDEX[spec.phase];
  const running = runningAgents.length > 0;
  const status = running
    ? { label: 'Running', cls: 'text-good', dot: 'bg-good', pulse: true }
    : spec.phase === 'done'
    ? { label: 'Done', cls: 'text-faint', dot: 'bg-faint', pulse: false }
    : { label: 'In progress', cls: 'text-accent-2', dot: 'bg-accent', pulse: false };

  return (
    <div
      onClick={onOpen}
      className="relative border border-ink-800 rounded-[14px] bg-card px-[18px] py-[17px] cursor-pointer overflow-hidden transition hover:-translate-y-[3px] hover:border-accent/45 hover:shadow-card"
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: isFeature ? 'rgb(var(--accent))' : 'rgb(var(--warn))' }}
      />
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.03em] px-2 py-[3px] rounded-md',
            isFeature ? 'text-accent-2 bg-accent/15' : 'text-warn bg-warn/15'
          )}
        >
          {isFeature ? <FileCode2 size={12} /> : <Bug size={12} />}
          {isFeature ? 'FEATURE' : 'BUGFIX'}
        </span>
        <span className={cn('flex items-center gap-1.5 text-[11px] font-medium', status.cls)}>
          <span
            className={cn('w-1.5 h-1.5 rounded-full', status.dot, status.pulse && 'animate-pulse-slow')}
          />
          {status.label}
        </span>
        <div className="flex-1" />
        <span className="text-[10.5px] text-faint font-mono">{ago(spec.updatedAt)} ago</span>
      </div>

      <div className="text-[16.5px] font-semibold tracking-[-0.01em] text-ink-50 mb-4 truncate">
        {spec.name}
      </div>

      <div className="flex gap-2.5 mb-[15px]">
        {stepNames.map((name, i) => {
          const state = phaseIdx > i || spec.phase === 'done' ? 'done' : phaseIdx === i ? 'active' : 'todo';
          return (
            <div key={name} className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className={cn(
                    'w-[5px] h-[5px] rounded-full',
                    state === 'done' ? 'bg-good' : state === 'active' ? 'bg-accent' : 'bg-ink-700'
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    state === 'done' ? 'text-dim' : state === 'active' ? 'text-accent-2' : 'text-faint'
                  )}
                >
                  {name}
                </span>
              </div>
              <div className="h-[3px] rounded-full bg-ink-800 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full origin-left',
                    state === 'done' ? 'bg-good' : state === 'active' ? 'bg-accent' : 'bg-ink-700'
                  )}
                  style={{ width: state === 'done' ? '100%' : state === 'active' ? '55%' : '10%' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5">
        {runningAgents.length > 0 ? (
          <div className="flex items-center">
            {runningAgents.slice(0, 3).map((n, i) => (
              <span key={n + i} className="-mr-1.5">
                <Avatar name={n} size={23} ring />
              </span>
            ))}
            <span className="text-[11px] text-faint ml-3">
              {runningAgents.length} running
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-faint">idle</span>
        )}
        <div className="flex-1" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          className="flex items-center gap-1.5 border border-ink-700 bg-ink-50/[0.045] text-dim px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium hover:border-accent/45 hover:text-accent-2 transition"
        >
          <Play size={13} /> {spec.phase === 'done' ? 'Review' : 'Resume'}
        </button>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  running,
  onClick,
}: {
  agent: AgentMeta;
  running: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="relative border border-ink-800 rounded-[13px] bg-card px-3 py-3.5 cursor-pointer overflow-hidden transition hover:border-accent/45"
    >
      <div className="flex items-center justify-between mb-2.5">
        <Avatar name={agent.name} size={30} />
        {running && (
          <span className="relative w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-good" />
            <span className="absolute inset-0 rounded-full bg-good animate-ping2" />
          </span>
        )}
      </div>
      <div className="text-[13px] font-semibold text-ink-50 mb-1 truncate">{agent.name}</div>
      <div className="text-[10.5px] text-faint leading-snug h-[30px] overflow-hidden">
        {agent.description}
      </div>
      <div
        className={cn(
          'flex items-center gap-1.5 mt-2.5 text-[10.5px] font-semibold',
          running ? 'text-good' : 'text-faint'
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', running ? 'bg-good' : 'bg-ink-700')} />
        {running ? 'Running' : 'Idle'}
      </div>
    </div>
  );
}

function DiscoveryCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex-1 border border-ink-800 rounded-[14px] bg-card px-[19px] py-[18px] cursor-pointer transition hover:border-accent/45 hover:-translate-y-0.5"
    >
      {icon}
      <div className="text-sm font-semibold text-ink-50 mt-3 mb-1">{title}</div>
      <div className="text-[11.5px] text-faint leading-snug">{desc}</div>
    </div>
  );
}

function Popover({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="absolute top-[60px] left-3.5 w-[330px] bg-elev border border-ink-700 rounded-[13px] shadow-[0_18px_50px_rgba(0,0,0,0.5)] p-1.5 z-30 animate-rise">
      <div className="text-[10px] font-semibold tracking-[0.12em] text-faint px-2.5 pt-1.5 pb-1.5">
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Avatar({
  name,
  size,
  ring,
}: {
  name: string;
  size: number;
  ring?: boolean;
}) {
  return (
    <span
      title={name}
      className="grid place-items-center rounded-[7px] text-white font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: hueFor(name),
        border: ring ? '2px solid rgb(var(--card))' : undefined,
      }}
    >
      {mono(name)}
    </span>
  );
}

function EmptyHint({
  text,
  actionLabel,
  onAction,
}: {
  text: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center justify-between border border-ink-800 rounded-[14px] bg-card px-5 py-4 mb-[38px]">
      <span className="text-xs text-faint">{text}</span>
      <button
        onClick={onAction}
        className="text-xs px-3 py-1.5 rounded-lg bg-accent/15 text-accent-2 border border-accent/45 hover:bg-accent hover:text-white transition"
      >
        {actionLabel}
      </button>
    </div>
  );
}
