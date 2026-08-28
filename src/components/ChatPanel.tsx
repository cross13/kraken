import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Sparkles,
  Bot,
  X,
  Terminal,
  Brain,
  CornerDownRight,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { KrakenLogo } from './KrakenLogo';
import { useChat } from '../stores/chat';
import { useWorkspace } from '../stores/workspace';
import { useOrchestrator } from '../stores/orchestrator';
import { useModels } from '../stores/models';
import { skillSystemBlock } from '../lib/agentRouter';
import { Markdown } from './Markdown';
import { cn } from '../lib/cn';
import type { MessageSegment } from '../../electron/shared/types';

export function ChatPanel() {
  const messages = useChat((s) => s.messages);
  const busy = useChat((s) => s.busy);
  const currentRequestId = useChat((s) => s.currentRequestId);
  const push = useChat((s) => s.push);
  const appendDelta = useChat((s) => s.appendDelta);
  const finish = useChat((s) => s.finish);
  const fail = useChat((s) => s.fail);
  const setBusy = useChat((s) => s.setBusy);
  const selectedAgent = useChat((s) => s.selectedAgent);
  const setSelectedAgent = useChat((s) => s.setSelectedAgent);
  const pendingPrompt = useChat((s) => s.pendingPrompt);
  const setPendingPrompt = useChat((s) => s.setPendingPrompt);
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const root = useWorkspace((s) => s.root);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const startRun = useOrchestrator((s) => s.startRun);
  const finishRun = useOrchestrator((s) => s.finishRun);

  const [input, setInput] = useState('');
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showSkillMenu, setShowSkillMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // A prompt handed off from the Welcome command bar — send it once chat is idle.
  useEffect(() => {
    if (pendingPrompt && !busy) {
      const text = pendingPrompt;
      setPendingPrompt(null);
      send(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt, busy]);

  const send = (textArg?: string) => {
    const raw = textArg ?? input;
    if (!raw.trim() || busy) return;
    const text = raw.trim();
    setInput('');

    let skillContext = '';
    let skillName: string | null = null;
    let working = text;
    if (working.startsWith('/')) {
      const [name, ...rest] = working.slice(1).split(/\s+/);
      const skill = skills.find((s) => s.name === name);
      if (skill) {
        working = rest.join(' ') || working;
        skillName = skill.name;
        // Inject the skill's full instructions, not just its description.
        skillContext = skillSystemBlock(skill);
      }
    }

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: text,
      createdAt: Date.now(),
    };
    push(userMsg);

    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    push({
      id: assistantId,
      role: 'assistant' as const,
      content: '',
      createdAt: Date.now(),
      streaming: true,
      agent: selectedAgent ?? undefined,
    });
    setBusy(true, requestId);
    const model = useModels.getState().modelFor('chat');
    startRun({
      requestId,
      agent: selectedAgent ?? null,
      skill: skillName,
      source: 'chat',
      kind: 'chat',
      title: text.length > 80 ? text.slice(0, 80) + '…' : text,
      startedAt: Date.now(),
      status: 'running',
      model,
      routeReason: selectedAgent ? 'chat-override' : null,
    });

    const agent = selectedAgent ? agents.find((a) => a.name === selectedAgent) : null;
    const editingHint = root
      ? `You are running with file-edit permissions in the workspace at \`${root}\`. When the user asks you to draft, edit, or refine a spec file (anything under \`.kraken/specs/\`), use the **Read**, **Edit**, and **Write** tools to apply the change directly to disk rather than pasting the full file in chat. Keep your chat reply to a short summary of what changed.`
      : 'No workspace is open — file-edit tools will fail; ask the user to open a folder.';
    const system = [
      'You are Kraken, a Spec-Driven Development assistant. Write GitHub-flavored markdown.',
      editingHint,
      agent?.body,
      skillContext,
    ]
      .filter(Boolean)
      .join('\n\n');

    const history = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      .concat([{ role: 'user', content: working }]);

    const off = window.kraken.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) appendDelta(assistantId, ev.text, ev.channel);
      if (ev.type === 'done') {
        finish(assistantId);
        off();
        finishRun(requestId, 'done');
        // Claude may have created/edited files via tools — re-scan workspace.
        refreshAll();
      }
      if (ev.type === 'error') {
        fail(assistantId, ev.error ?? 'Unknown');
        off();
        finishRun(requestId, 'error');
        refreshAll();
      }
    });

    window.kraken.claude.stream({
      requestId,
      system,
      messages: history,
      cwd: root,
      source: 'chat',
      agent: selectedAgent,
      kind: 'chat',
      skill: skillName,
      model,
      routeReason: selectedAgent ? 'chat-override' : null,
    });
  };

  const stop = () => {
    if (currentRequestId) {
      window.kraken.claude.cancel(currentRequestId);
      finishRun(currentRequestId, 'cancelled');
    }
  };

  const onInputChange = (v: string) => {
    setInput(v);
    setShowAgentMenu(v.endsWith('@') && (v.length === 1 || v[v.length - 2] === ' '));
    setShowSkillMenu(v === '/' || (v.endsWith(' /') && agents.length > 0));
  };

  return (
    <div className="h-full flex flex-col">
      {selectedAgent && (
        <div className="mx-3 mt-1 px-3 py-1.5 flex items-center gap-2 rounded-lg bg-accent/[0.08]">
          <Bot size={12} className="text-accent" />
          <span className="text-[11px] text-ink-200">
            Speaking as <b className="text-ink-50">{selectedAgent}</b>
          </span>
          <button
            onClick={() => setSelectedAgent(null)}
            className="ml-auto text-ink-400 hover:text-ink-100"
          >
            <X size={11} />
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4 space-y-4">
        {messages.map((m) => (
          <Message
            key={m.id}
            role={m.role}
            content={m.content}
            segments={m.segments}
            streaming={m.streaming}
            agent={m.agent}
          />
        ))}
      </div>

      <div className="p-3 space-y-2">
        {/* Working bar — the session's live status, with cancel */}
        {busy && (
          <div className="flex items-center gap-2.5 rounded-xl bg-card ring-1 ring-ink-50/[0.06] px-3.5 py-2.5">
            <KrakenLogo animated className="w-[18px] h-[22px] shrink-0" />
            <span className="text-[13px] text-ink-200">Working…</span>
            <button
              onClick={stop}
              className="ml-auto text-[12px] px-3 py-1.5 rounded-lg bg-elev text-ink-100 hover:bg-line transition"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl bg-card ring-1 ring-ink-50/[0.06] focus-within:ring-accent/40 transition pl-3.5 pr-2 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask a question or describe a task"
            rows={2}
            className="flex-1 bg-transparent text-[13.5px] py-1 resize-none outline-none placeholder:text-faint"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || busy}
            title="Send (Enter) — / for skills, @ for agents"
            className="w-8 h-8 shrink-0 grid place-items-center rounded-full bg-accent text-accent-fg hover:opacity-90 disabled:opacity-30 transition"
          >
            <ArrowUp size={15} />
          </button>
        </div>
        {showSkillMenu && skills.length > 0 && (
          <Popover title="Skills" icon={<Sparkles size={11} />}>
            {skills.map((s) => (
              <PopoverItem
                key={s.path}
                title={s.name}
                description={s.description}
                onClick={() => {
                  setInput(`/${s.name} `);
                  setShowSkillMenu(false);
                  inputRef.current?.focus();
                }}
              />
            ))}
          </Popover>
        )}
        {showAgentMenu && agents.length > 0 && (
          <Popover title="Agents" icon={<Bot size={11} />}>
            {agents.map((a) => (
              <PopoverItem
                key={a.path}
                title={a.name}
                description={a.description}
                onClick={() => {
                  setSelectedAgent(a.name);
                  setInput(input.replace(/@$/, ''));
                  setShowAgentMenu(false);
                  inputRef.current?.focus();
                }}
              />
            ))}
          </Popover>
        )}
      </div>
    </div>
  );
}

function Message({
  role,
  content,
  segments,
  streaming,
  agent,
}: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  segments?: MessageSegment[];
  streaming?: boolean;
  agent?: string;
}) {
  if (role === 'system') {
    return (
      <div className="text-[11px] text-ink-500 italic px-3 py-2 rounded-lg bg-ink-50/[0.03]">
        {content}
      </div>
    );
  }

  // The user's ask reads as a raised card; the agent replies in the open,
  // under an avatar + name row (Kiro-style session transcript).
  if (role === 'user') {
    return (
      <div className="rounded-xl bg-card ring-1 ring-ink-50/[0.06] px-4 py-3 text-[13.5px] leading-relaxed">
        <div className="whitespace-pre-wrap text-ink-100">{content}</div>
      </div>
    );
  }

  const hasSegments = segments && segments.length > 0;
  return (
    <div className="px-0.5">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="w-7 h-7 grid place-items-center rounded-full bg-elev shrink-0">
          <KrakenLogo animated={streaming} className="w-[15px] h-[19px]" />
        </span>
        <span className="text-[13px] font-semibold text-ink-50">{agent ?? 'Kraken'}</span>
        {streaming && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
        )}
      </div>
      <div className="pl-[38px] text-sm leading-relaxed">
        {hasSegments ? (
          <div className="space-y-2">
            {segments!.map((seg, i) => (
              <SegmentView key={i} seg={seg} />
            ))}
          </div>
        ) : (
          <Markdown source={content} />
        )}
      </div>
    </div>
  );
}

/** Renders one channel-tagged segment of an assistant message. */
function SegmentView({ seg }: { seg: MessageSegment }) {
  if (seg.kind === 'text') {
    if (!seg.text.trim()) return null;
    return <Markdown source={seg.text} />;
  }
  if (seg.kind === 'thinking') {
    return (
      <Disclosure
        defaultOpen
        icon={<Brain size={12} />}
        label="Thinking"
        tone="thinking"
      >
        <div className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-400 italic">
          {seg.text}
        </div>
      </Disclosure>
    );
  }
  if (seg.kind === 'tool') {
    // A tool call as a quiet card, Kiro's "Read file(s)" style. The summary is
    // markdown (incl. a fenced bash block for commands).
    return (
      <div className="rounded-lg bg-card ring-1 ring-ink-50/[0.06] overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-dim">
          <Terminal size={11} className="text-accent" /> Tool
        </div>
        <Markdown source={seg.text} className="px-3 pb-2 text-[12px]" />
      </div>
    );
  }
  // tool_result
  return (
    <Disclosure icon={<CornerDownRight size={12} />} label="Result" tone="result">
      <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-ink-400 font-mono">
        {seg.text}
      </pre>
    </Disclosure>
  );
}

/** Collapsible block used for thinking / tool-result segments. */
function Disclosure({
  icon,
  label,
  tone,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'thinking' | 'result';
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(
        'rounded-md border overflow-hidden',
        tone === 'thinking' ? 'border-ink-800 bg-ink-950/40' : 'border-ink-800 bg-ink-950/60'
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-ink-500 font-semibold hover:text-ink-300"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {icon}
        {label}
      </button>
      {open && <div className="px-2.5 pb-1.5">{children}</div>}
    </div>
  );
}

function Popover({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 rounded-lg border border-ink-800 bg-ink-950 shadow-glow overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-ink-400 font-semibold border-b border-ink-800">
        {icon} {title}
      </div>
      <div className="max-h-60 overflow-y-auto py-1">{children}</div>
    </div>
  );
}

function PopoverItem({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2.5 py-1.5 hover:bg-ink-800/60"
    >
      <div className="text-xs font-medium text-ink-100">{title}</div>
      <div className="text-[10px] text-ink-400 line-clamp-1">{description}</div>
    </button>
  );
}
