import { create } from 'zustand';
import type { ChatMessage, StreamChannel } from '../../electron/shared/types';

interface ChatStore {
  messages: ChatMessage[];
  busy: boolean;
  currentRequestId: string | null;
  selectedAgent: string | null;
  /** a prompt handed off from elsewhere (e.g. the Welcome command bar) for the
   *  ChatPanel to send on its next render */
  pendingPrompt: string | null;

  setSelectedAgent: (a: string | null) => void;
  setPendingPrompt: (text: string | null) => void;
  push: (m: ChatMessage) => void;
  appendDelta: (id: string, text: string, channel?: StreamChannel) => void;
  finish: (id: string) => void;
  fail: (id: string, error: string) => void;
  clear: () => void;
  setBusy: (b: boolean, requestId?: string | null) => void;
}

export const useChat = create<ChatStore>((set) => ({
  messages: [
    {
      id: 'sys-1',
      role: 'system',
      createdAt: Date.now(),
      content:
        "Welcome to Kraken. Open a workspace and start a spec, or chat below. Type `/` to invoke a skill, `@` to invoke an agent.",
    },
  ],
  busy: false,
  currentRequestId: null,
  selectedAgent: null,
  pendingPrompt: null,

  setSelectedAgent: (a) => set({ selectedAgent: a }),
  setPendingPrompt: (text) => set({ pendingPrompt: text }),

  push: (m) => set((s) => ({ messages: [...s.messages, m] })),

  appendDelta: (id, text, channel = 'text') =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== id) return m;
        const segments = m.segments ? [...m.segments] : [];
        const last = segments[segments.length - 1];
        // text/thinking stream incrementally and merge; tool/tool_result arrive
        // as complete chunks and always start their own segment.
        const mergeable = channel === 'text' || channel === 'thinking';
        const startsNew = !(mergeable && last && last.kind === channel);
        if (startsNew) segments.push({ kind: channel, text });
        else segments[segments.length - 1] = { ...last, text: last.text + text };
        // Keep the flat content readable (history/persistence/fallback): blank
        // line between channel switches.
        const sep = startsNew && m.content ? '\n\n' : '';
        return { ...m, content: m.content + sep + text, segments, streaming: true };
      }),
    })),

  finish: (id) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
      busy: false,
      currentRequestId: null,
    })),

  fail: (id, error) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== id) return m;
        const errText = `\n\n⚠ ${error}`;
        const segments = m.segments
          ? [...m.segments, { kind: 'text' as const, text: errText }]
          : m.segments;
        return { ...m, content: m.content + errText, segments, streaming: false };
      }),
      busy: false,
      currentRequestId: null,
    })),

  clear: () => set({ messages: [] }),

  setBusy: (b, requestId) =>
    set({ busy: b, currentRequestId: requestId ?? null }),
}));
