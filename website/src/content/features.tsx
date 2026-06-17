import {
  FileText,
  GitBranch,
  Bot,
  Sparkles,
  Webhook,
  Compass,
  Network,
  GitPullRequest,
  HelpCircle,
  TerminalSquare,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Feature {
  icon: LucideIcon;
  title: string;
  blurb: string;
  points: string[];
  accent?: 'purple' | 'cyan';
}

export const FEATURES: Feature[] = [
  {
    icon: FileText,
    title: 'Spec-first, on disk',
    blurb:
      'Every spec is plain markdown next to your code — requirements → design → tasks → execution. Versioned, diff-able, never trapped in a chat.',
    points: ['requirements.md · design.md · tasks.md', 'EARS-formatted acceptance criteria', 'Bugfix specs with regression guards'],
    accent: 'purple',
  },
  {
    icon: Cpu,
    title: 'Two backends, one app',
    blurb:
      'Drive Claude through your local Claude CLI (free with Pro/Max) or the Anthropic API. Switch at runtime — everything else stays the same.',
    points: ['Local Claude CLI by default', 'Anthropic API with your key', 'Key encrypted in the OS keychain'],
    accent: 'cyan',
  },
  {
    icon: Bot,
    title: 'Your agents & skills, loaded',
    blurb:
      'Reads the standard .claude/agents and .claude/skills locations. Your existing Claude Code subagents and skills just work — and route by content.',
    points: ['Workspace + global .claude/', 'Content-aware agent routing', 'Skills injected into the prompt'],
    accent: 'purple',
  },
  {
    icon: Network,
    title: 'Multi-agent orchestration',
    blurb:
      'Run a wave of tasks as parallel Claude subprocesses with a concurrency cap. Autopilot runs every wave to done, waiting on blocking hooks between them.',
    points: ['Parallel task waves', 'Live orchestrator dashboard', 'Per-task @agent specialization'],
    accent: 'cyan',
  },
  {
    icon: Webhook,
    title: 'Event-driven agent hooks',
    blurb:
      'Fire Claude runs on app events — spec-advance, file-save, wave-complete. Validate, document, and improve automatically, with a loop-guard built in.',
    points: ['Event-triggered runs', 'Natural-language hook authoring', 'Cooldowns + loop protection'],
    accent: 'purple',
  },
  {
    icon: Compass,
    title: 'Steering context',
    blurb:
      'Project context in .kraken/steering (plus AGENTS.md / CLAUDE.md) is composed into every run — chat, task, or hook — with always / fileMatch / auto modes.',
    points: ['Uniform context injection', 'Inclusion modes', 'Honors AGENTS.md & CLAUDE.md'],
    accent: 'cyan',
  },
  {
    icon: GitPullRequest,
    title: 'Source control & GitHub',
    blurb:
      'Spec-aware branches, commits, and pull requests. A searchable base-branch picker and an AI-drafted PR description from the spec — without leaving the app.',
    points: ['Branch / commit / push', 'Typeahead PR base picker', 'Generate PR body with Claude'],
    accent: 'purple',
  },
  {
    icon: HelpCircle,
    title: 'Open Questions module',
    blurb:
      'Surface open questions out of the requirements, answer them with AI suggestions, then fold the decisions back in so the design phase builds on settled inputs.',
    points: ['Extract questions from requirements', 'Per-question AI answers', 'Resolved Decisions feed design'],
    accent: 'cyan',
  },
  {
    icon: TerminalSquare,
    title: 'A console that reads like one',
    blurb:
      "Claude's stream is rendered the way a real tool should — prose, extended thinking, command calls, and tool results each shown distinctly.",
    points: ['Thinking blocks, collapsible', 'Command cards with syntax', 'Truncated tool results'],
    accent: 'purple',
  },
];

export interface DocLink {
  icon: LucideIcon;
  title: string;
  blurb: string;
  file: string;
}

export const DOC_LINKS: DocLink[] = [
  {
    icon: Network,
    title: 'Architecture',
    blurb: 'The three Electron layers, the process model, and how data crosses the typed IPC bridge.',
    file: 'architecture.md',
  },
  {
    icon: GitBranch,
    title: 'IPC contract',
    blurb: 'All 14 namespaces on window.kraken, plus the exact recipe for adding a handler end to end.',
    file: 'ipc-contract.md',
  },
  {
    icon: FileText,
    title: 'Data model',
    blurb: 'On-disk spec shape, the six-table SQLite mirror, and the shared type contracts.',
    file: 'data-model.md',
  },
  {
    icon: Sparkles,
    title: 'Backends',
    blurb: 'CLI vs API streaming, the common claude:event protocol, and channel-tagged deltas (text · thinking · tool · result).',
    file: 'backends.md',
  },
  {
    icon: Bot,
    title: 'Renderer',
    blurb: 'Four Zustand stores, the component tree, content-aware agent routing, and skill injection.',
    file: 'renderer.md',
  },
  {
    icon: ShieldCheck,
    title: 'Subsystems',
    blurb: 'Hooks, steering, orchestration, agents/skills, and the Git/GitHub integration.',
    file: 'subsystems.md',
  },
];
