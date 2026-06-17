import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Square,
  Trash2,
  Sparkles,
  Bot,
  X,
  Terminal,
  Brain,
  CornerDownRight,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useChat } from '../stores/chat';
import { useWorkspace } from '../stores/workspace';
import { useOrchestrator } from '../stores/orchestrator';
import { skillSystemBlock } from '../lib/agentRouter';
import { renderMarkdown } from '../lib/markdown';
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
  const clear = useChat((s) => s.clear);
  const selectedAgent = useChat((s) => s.selectedAgent);
  const setSelectedAgent = useChat((s) => s.setSelectedAgent);
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

  const send = () => {
    if (!input.trim() || busy) return;
    const text = input.trim();
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
    startRun({
      requestId,
      agent: selectedAgent ?? null,
      skill: skillName,
      source: 'chat',
      kind: 'chat',
      title: text.length > 80 ? text.slice(0, 80) + '…' : text,
      startedAt: Date.now(),
      status: 'running',
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
      <div className="flex items-center justify-between px-3 h-9 border-b border-ink-800 shrink-0">
        <h2 className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Chat</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={clear}
            title="Clear chat"
            className="p-1 rounded-md text-ink-400 hover:text-ink-100 hover:bg-ink-800/60"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {selectedAgent && (
        <div className="px-3 py-1.5 border-b border-ink-800 flex items-center gap-2 bg-ink-900/60">
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

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-3">
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

      <div className="border-t border-ink-800 p-3">
        <div className="rounded-lg border border-ink-800 bg-ink-950 focus-within:border-ink-700 transition">
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
            placeholder="Ask Claude…  Type / for skills, @ for agents"
            rows={3}
            className="w-full bg-transparent text-sm px-3 py-2 resize-none outline-none placeholder:text-ink-500"
          />
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-ink-800/60">
            <div className="flex items-center gap-1.5 text-[10px] text-ink-500">
              <kbd className="px-1.5 py-0.5 rounded bg-ink-800 text-ink-300">Enter</kbd>
              send
              <kbd className="ml-1 px-1.5 py-0.5 rounded bg-ink-800 text-ink-300">Shift+Enter</kbd>
              newline
            </div>
            {busy ? (
              <button
                onClick={stop}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-bad/20 text-bad hover:bg-bad/30"
              >
                <Square size={11} /> Stop
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40"
              >
                <Send size={11} /> Send
              </button>
            )}
          </div>
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
      <div className="text-[11px] text-ink-500 italic px-2 py-1.5 rounded-md bg-ink-900/40 border border-dashed border-ink-800">
        {content}
      </div>
    );
  }
  const hasSegments = role === 'assistant' && segments && segments.length > 0;
  return (
    <div
      className={cn(
        'rounded-lg px-3 py-2.5 text-sm leading-relaxed',
        role === 'user'
          ? 'bg-accent/10 border border-accent/20'
          : 'bg-ink-900 border border-ink-800'
      )}
    >
      <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
        {role === 'user' ? 'You' : agent ?? 'Claude'}
        {streaming && (
          <span className="ml-1 w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
        )}
      </div>
      {role === 'user' ? (
        <div className="whitespace-pre-wrap text-ink-100">{content}</div>
      ) : hasSegments ? (
        <div className="space-y-1.5">
          {segments!.map((seg, i) => (
            <SegmentView key={i} seg={seg} />
          ))}
        </div>
      ) : (
        <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
      )}
    </div>
  );
}

/** Renders one channel-tagged segment of an assistant message. */
function SegmentView({ seg }: { seg: MessageSegment }) {
  if (seg.kind === 'text') {
    if (!seg.text.trim()) return null;
    return <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.text) }} />;
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
    // The tool summary is markdown (incl. a fenced bash block for commands).
    return (
      <div className="rounded-md border border-accent/25 border-l-2 border-l-accent bg-ink-950/70 overflow-hidden">
        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-accent/90 font-semibold border-b border-ink-800/60">
          <Terminal size={11} /> Command
        </div>
        <div
          className="md px-2.5 py-1.5 text-[12px]"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.text) }}
        />
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
