import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Wand2,
  Plus,
  Search,
  Cpu,
  Wrench,
  MessageSquarePlus,
  Check,
  Pin,
  FileCode2,
  ExternalLink,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useChat } from '../../stores/chat';
import { useUi } from '../../stores/ui';
import {
  useModuleConfig,
  ROUTABLE_ACTIONS,
  type RoutableAction,
} from '../../stores/moduleConfig';
import { renderMarkdown } from '../../lib/markdown';
import {
  agentScaffold,
  agentPath,
  slugify,
  actionsRoutingTo,
} from '../../lib/library';
import { cn } from '../../lib/cn';
import type { AgentMeta } from '../../../electron/shared/types';
import {
  ModuleHeader,
  ModuleSection,
  Explainer,
  Callout,
  ScopeChip,
} from '../ModuleShell';

const EXPLAINER = [
  {
    heading: 'What an agent is',
    body: 'A markdown file in .claude/agents/ with front-matter (name, description, model, tools) and a body that becomes the system prompt. Kraken loads workspace agents first, then global ~/.claude ones.',
  },
  {
    heading: 'How one gets picked',
    body: 'Per-task @agent wins, then a chat @override, then a pin you set here, then the best keyword match (project-local agents get a bonus), then the bundled default. Nothing installed → generic Claude.',
  },
  {
    heading: 'Which is best for a task',
    body: 'Name + description are scored against the work. A "frontend" agent beats a generic executor on UI tasks. The Orchestration module lets you preview and tune this.',
  },
  {
    heading: 'Making your own',
    body: 'Click New agent for a ready-to-edit scaffold in the correct format, or Seed defaults to install the bundled SDD agent library.',
  },
];

export function AgentsStudio() {
  const root = useWorkspace((s) => s.root);
  const agents = useWorkspace((s) => s.agents);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const [query, setQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? agents.filter(
          (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
        )
      : agents;
    return list;
  }, [agents, query]);

  const workspaceAgents = filtered.filter((a) => a.scope === 'workspace');
  const globalAgents = filtered.filter((a) => a.scope === 'global');

  const selected = agents.find((a) => a.path === selectedPath) ?? filtered[0] ?? null;

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <ModuleHeader
        icon={<Bot size={18} />}
        title="Agents"
        subtitle={`${agents.length} installed · specialists that carry out the work`}
        actions={
          <>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 h-8 rounded-lg bg-accent text-accent-fg hover:opacity-90"
            >
              <Plus size={13} /> New agent
            </button>
            <button
              onClick={seedDefaults}
              className="flex items-center gap-1.5 text-[12px] px-3 h-8 rounded-lg bg-elev text-dim hover:text-ink-50"
            >
              <Wand2 size={13} /> Seed defaults
            </button>
          </>
        }
      />

      {!root ? (
        <div className="flex-1 grid place-items-center text-[13px] text-faint">
          Open a folder to manage agents.
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* list */}
          <div className="w-[300px] shrink-0 border-r border-ink-800/40 flex flex-col min-h-0">
            <div className="p-3">
              <div className="flex items-center gap-2 px-2.5 h-8 rounded-lg bg-elev">
                <Search size={13} className="text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search agents…"
                  className="flex-1 bg-transparent text-[12.5px] text-ink-50 outline-none placeholder:text-faint"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-3">
              {agents.length === 0 ? (
                <div className="px-2 py-8 text-center">
                  <p className="text-[12px] text-faint mb-3">No agents installed.</p>
                  <button
                    onClick={seedDefaults}
                    className="text-[12px] px-3 py-1.5 rounded-lg bg-accent text-accent-fg font-semibold"
                  >
                    Seed defaults
                  </button>
                </div>
              ) : (
                <>
                  <AgentGroup
                    label="Project"
                    agents={workspaceAgents}
                    selected={selected}
                    onSelect={(a) => setSelectedPath(a.path)}
                  />
                  <AgentGroup
                    label="Global"
                    agents={globalAgents}
                    selected={selected}
                    onSelect={(a) => setSelectedPath(a.path)}
                  />
                </>
              )}
            </div>
          </div>

          {/* detail */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-7 py-6">
              <Explainer points={EXPLAINER} />
              {selected ? (
                <AgentDetail agent={selected} agents={agents} />
              ) : (
                <div className="text-[13px] text-faint">Select an agent to inspect it.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {creating && (
        <NewAgentDialog
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            setSelectedPath(p);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function AgentGroup({
  label,
  agents,
  selected,
  onSelect,
}: {
  label: string;
  agents: AgentMeta[];
  selected: AgentMeta | null;
  onSelect: (a: AgentMeta) => void;
}) {
  const pinnedAgents = useModuleConfig((s) => s.config.pinnedAgents);
  const pinnedNames = new Set(Object.values(pinnedAgents));
  if (agents.length === 0) return null;
  return (
    <div>
      <div className="font-mono text-[9.5px] tracking-[0.16em] text-ink-600 px-2 mb-1.5 uppercase">
        {label} · {agents.length}
      </div>
      <div className="space-y-0.5">
        {agents.map((a) => {
          const active = selected?.path === a.path;
          return (
            <button
              key={a.path}
              onClick={() => onSelect(a)}
              className={cn(
                'w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition',
                active ? 'bg-accent/12 ring-1 ring-accent/30' : 'hover:bg-elev/60'
              )}
            >
              <Bot size={13} className={cn('mt-0.5 shrink-0', active ? 'text-accent' : 'text-dim')} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] text-ink-100 font-medium truncate">{a.name}</span>
                  {pinnedNames.has(a.name) && <Pin size={10} className="text-accent shrink-0" />}
                </div>
                <p className="text-[11px] text-faint leading-snug line-clamp-2">{a.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgentDetail({ agent, agents }: { agent: AgentMeta; agents: AgentMeta[] }) {
  const [body, setBody] = useState('');
  const selectedAgent = useChat((s) => s.selectedAgent);
  const setSelectedAgent = useChat((s) => s.setSelectedAgent);
  const openTab = useUi((s) => s.openTab);
  const config = useModuleConfig((s) => s.config);
  const pinAgent = useModuleConfig((s) => s.pinAgent);

  useEffect(() => {
    window.kraken.agents.read(agent.path).then(setBody);
  }, [agent.path]);

  const isChatAgent = selectedAgent === agent.name;
  const bestFor = useMemo(() => actionsRoutingTo(agent.name, agents), [agent.name, agents]);
  const pinnedActions = ROUTABLE_ACTIONS.filter(
    (a) => config.pinnedAgents[a.key] === agent.name
  );

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 grid place-items-center rounded-xl bg-accent/12 text-accent shrink-0">
          <Bot size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[19px] font-bold text-ink-50 truncate">{agent.name}</h2>
            <ScopeChip scope={agent.scope} />
          </div>
          <p className="text-[13px] text-dim mt-0.5 leading-relaxed">{agent.description}</p>
        </div>
      </div>

      {/* meta chips */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {agent.model && (
          <span className="flex items-center gap-1.5 text-[11.5px] text-dim px-2.5 py-1 rounded-lg bg-elev">
            <Cpu size={12} className="text-accent" /> {agent.model}
          </span>
        )}
        {agent.tools && agent.tools.length > 0 && (
          <span className="flex items-center gap-1.5 text-[11.5px] text-dim px-2.5 py-1 rounded-lg bg-elev">
            <Wrench size={12} className="text-accent" /> {agent.tools.length} tools
          </span>
        )}
        <button
          onClick={() =>
            openTab({
              id: `agent:${agent.path}`,
              title: `agent: ${agent.name}`,
              kind: 'agent',
              filePath: agent.path,
            })
          }
          className="flex items-center gap-1.5 text-[11.5px] text-dim px-2.5 py-1 rounded-lg bg-elev hover:text-ink-50"
        >
          <FileCode2 size={12} /> Open file <ExternalLink size={10} />
        </button>
        <button
          onClick={() => setSelectedAgent(isChatAgent ? null : agent.name)}
          className={cn(
            'flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-lg font-medium transition',
            isChatAgent
              ? 'bg-accent text-accent-fg'
              : 'bg-elev text-dim hover:text-ink-50'
          )}
        >
          {isChatAgent ? <Check size={12} /> : <MessageSquarePlus size={12} />}
          {isChatAgent ? 'Chat agent' : 'Use in chat'}
        </button>
      </div>

      {/* routing insight */}
      <ModuleSection
        title="Best for"
        desc="SDD steps this agent would be auto-selected for, given the current library."
      >
        {bestFor.length === 0 ? (
          <Callout>
            No step routes here by default — it only runs when named explicitly (per-task
            @{agent.name}, chat override) or pinned below.
          </Callout>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {bestFor.map((a) => (
              <span
                key={a.key}
                className="text-[11.5px] px-2.5 py-1 rounded-lg bg-good/12 text-good font-medium"
              >
                {a.label}
              </span>
            ))}
          </div>
        )}
      </ModuleSection>

      {/* pinning */}
      <ModuleSection
        title="Pin to steps"
        desc="Force this agent for specific steps, overriding automatic routing. Applies to every run."
      >
        <div className="grid sm:grid-cols-2 gap-1.5">
          {ROUTABLE_ACTIONS.map((a) => {
            const pinnedHere = config.pinnedAgents[a.key] === agent.name;
            const pinnedElsewhere =
              config.pinnedAgents[a.key] && config.pinnedAgents[a.key] !== agent.name;
            return (
              <button
                key={a.key}
                onClick={() => pinAgent(a.key as RoutableAction, pinnedHere ? null : agent.name)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition',
                  pinnedHere ? 'bg-accent/12 ring-1 ring-accent/30' : 'bg-elev/60 hover:bg-elev'
                )}
              >
                <span
                  className={cn(
                    'w-4 h-4 grid place-items-center rounded shrink-0',
                    pinnedHere ? 'bg-accent text-accent-fg' : 'bg-ink-800 text-transparent'
                  )}
                >
                  <Check size={11} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-ink-100 truncate">{a.label}</span>
                  {pinnedElsewhere && (
                    <span className="block text-[10px] text-faint truncate">
                      pinned to {config.pinnedAgents[a.key]}
                    </span>
                  )}
                </span>
                {pinnedHere && <Pin size={12} className="text-accent shrink-0" />}
              </button>
            );
          })}
        </div>
        {pinnedActions.length > 0 && (
          <p className="text-[11px] text-faint mt-2">
            Pinned for {pinnedActions.map((a) => a.label).join(', ')}.
          </p>
        )}
      </ModuleSection>

      {/* body */}
      <ModuleSection title="System prompt" desc="The full agent body injected into the model.">
        <div className="rounded-xl bg-ink-950 ring-1 ring-ink-800/40 px-5 py-4">
          <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
        </div>
      </ModuleSection>
    </div>
  );
}

function NewAgentDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (path: string) => void;
}) {
  const root = useWorkspace((s) => s.root);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const agents = useWorkspace((s) => s.agents);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const slug = slugify(name);
  const exists = agents.some((a) => a.name === slug || a.name === name.trim());

  const create = async () => {
    if (!root || !name.trim() || exists) return;
    setBusy(true);
    setErr(null);
    try {
      const path = agentPath(root, slug);
      await window.kraken.fs.write(path, agentScaffold(slug, description.trim()));
      await refreshAll();
      onCreated(path);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <LibDialogShell title="New agent" onClose={onClose}>
      <p className="text-[12px] text-dim mb-4">
        Writes a scaffolded agent to <code className="font-mono text-accent">.claude/agents/</code>{' '}
        in Claude Code's format. Edit the body afterwards to define its behavior.
      </p>
      <LibField label="Name">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. frontend-specialist"
          className="lib-input"
        />
      </LibField>
      {name.trim() && (
        <p className="text-[11px] text-faint -mt-2 mb-3">
          → <span className="font-mono text-dim">.claude/agents/{slug}.md</span>
          {exists && <span className="text-bad ml-2">name already exists</span>}
        </p>
      )}
      <LibField label="Description (when to use it)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Use for React/Tailwind UI work — components, styling, accessibility…"
          className="lib-input min-h-[80px] resize-none"
        />
      </LibField>
      {err && <p className="text-[12px] text-bad mb-3">{err}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-lg text-dim hover:text-ink-50">
          Cancel
        </button>
        <button
          onClick={create}
          disabled={!name.trim() || exists || busy}
          className="text-[12px] font-semibold px-4 h-8 rounded-lg bg-accent text-accent-fg disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Create agent'}
        </button>
      </div>
    </LibDialogShell>
  );
}

// Shared dialog chrome + fields (also used by the Skills studio).
export function LibDialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[14vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-2xl bg-panel shadow-card ring-1 ring-ink-50/[0.06] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-[16px] font-bold text-ink-50 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function LibField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] uppercase tracking-wide text-faint mb-1.5">{label}</label>
      {children}
    </div>
  );
}
