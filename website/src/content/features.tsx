import {
  FileText,
  HelpCircle,
  Map,
  ListChecks,
  GitPullRequest,
  Terminal,
  Bot,
  Sparkles,
  Webhook,
  Compass,
  Ticket,
  MonitorSmartphone,
  ShieldCheck,
  Cpu,
  Boxes,
  SearchCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  tone?: 'accent' | 'agent';
}

export interface FeatureGroup {
  id: string;
  eyebrow: string;
  title: string;
  blurb: string;
  items: Feature[];
}

/** The short grid on the home page — the six things that decide whether you care. */
export const HIGHLIGHTS: Feature[] = [
  {
    icon: FileText,
    title: 'Specs are markdown on disk',
    body: 'A spec is a directory under .octo/specs/<id>/ holding spec.json and the phase files. Your editor, your git history, your review tools — the app is the loop around them, not a place they live.',
  },
  {
    icon: HelpCircle,
    title: 'It asks before it drafts',
    body: 'The Plan stage opens on Clarify: every open decision is a card with pre-loaded options you answer with one click. A plan run that hits an unsettled decision writes it down and stops, instead of guessing.',
    tone: 'agent',
  },
  {
    icon: SearchCheck,
    title: 'Review is the default view',
    body: 'Both authored documents open on Review: the acceptance criteria beside the plan, each one lighting up the sections, tasks and files that satisfy it — and the criteria nothing covers.',
  },
  {
    icon: Boxes,
    title: 'Tasks run in parallel',
    body: 'A wave of tasks runs as concurrent Claude subprocesses under one concurrency cap, with failure isolation. Autopilot runs every wave to the end and waits for blocking hooks in between.',
  },
  {
    icon: Bot,
    title: 'Your agents, not ours',
    body: 'Agents and skills load from the standard Claude Code locations. Routing scores your installed agents against the work, so a frontend task picks your frontend agent over the generic executor.',
  },
  {
    icon: GitPullRequest,
    title: 'It ends in a pull request',
    body: 'When the last task completes the spec advances on its own, a summary is generated, and branch → commit → PR sit right there in the Build stage.',
  },
];

export const GROUPS: FeatureGroup[] = [
  {
    id: 'loop',
    eyebrow: 'The loop',
    title: 'Three stages, two gates',
    blurb:
      'Requirements → Plan → Build → done. The order is fixed and load-bearing: each stage produces a document the next one reads, and the two gates are the only places a human is required.',
    items: [
      {
        icon: FileText,
        title: 'Requirements',
        body: 'User stories with EARS-form acceptance criteria. The Review stage groups each criterion under the story it answers, flags untestable wording, and shows the stories nothing covers.',
      },
      {
        icon: HelpCircle,
        title: 'Clarify',
        body: 'Approving Requirements lands on Clarify, not on a blank plan. Each question is a card with pre-loaded options — 1–9 from the keyboard, Other… for free text, Ask Claude to pick one. Applying writes ## Resolved Decisions and drafts the plan.',
        tone: 'agent',
      },
      {
        icon: Map,
        title: 'Plan',
        body: 'Diagram → affected files → changes by area with literal contracts → waves. Approving derives tasks.md from the plan’s ## Tasks section, and refuses when there isn’t one.',
      },
      {
        icon: ListChecks,
        title: 'Build',
        body: 'Tasks render as inline blocks with Start-task actions; Run all is the primary CTA. A task that deviates appends a Critical Decision back to the plan, so the plan never drifts from the code.',
      },
      {
        icon: GitPullRequest,
        title: 'Ship',
        body: 'A panel inside Build, not a separate screen. The spec auto-advances when the last task completes, the summary auto-generates, and branch / commit all / create PR are right there.',
      },
      {
        icon: SearchCheck,
        title: 'Format check',
        body: 'The same parsers the app relies on, run as a deterministic check above the gate bar — split into mechanical findings with one correct answer (Fix with Claude) and the ones that need your judgement.',
      },
    ],
  },
  {
    id: 'engine',
    eyebrow: 'The engine',
    title: 'Two interchangeable backends',
    blurb:
      'Pick one in Settings; everything user-visible flows through the same event stream either way, so nothing behaves differently because of which one is on.',
    items: [
      {
        icon: Terminal,
        title: 'Local Claude CLI — the default',
        body: 'Spawns claude -p --output-format stream-json in your workspace, so Claude sees your code and your CLAUDE.md. Free if you already pay for Claude Pro or Max. PATH is expanded because Electron’s inherited one is too narrow to find the binary.',
      },
      {
        icon: Cpu,
        title: 'Anthropic API',
        body: 'The @anthropic-ai/sdk streaming API with your own key, encrypted through Electron safeStorage into your OS keychain. Pay per token. A key also unlocks verified model discovery.',
      },
      {
        icon: Boxes,
        title: 'Models are discovered, not hardcoded',
        body: 'The model list merges the Anthropic Models API with the ids named in your local Claude Code config, falling back to a bundled catalog. Each entry shows where it came from, so the UI never implies availability it has not verified.',
      },
      {
        icon: Terminal,
        title: 'Real interactive terminals',
        body: 'Streaming runs are one-shot and cannot be answered. Terminals are a full PTY — the login shell or the real claude CLI — so permission prompts, AskUserQuestion answers and slash commands work as they do in your terminal.',
      },
    ],
  },
  {
    id: 'setup',
    eyebrow: 'Your setup',
    title: 'It reads the Claude Code you already have',
    blurb:
      'Agents and skills come from .claude/agents and .claude/skills, workspace and global, in Claude Code’s own format and precedence. Nothing to port.',
    items: [
      {
        icon: Bot,
        title: 'Content-aware agent routing',
        body: 'Per-task @agent beats a chat override beats the best-matching installed agent, scored on how well its name and description fit the work. Task execution is local-first: with nothing matching it still picks a project agent over the generic one.',
      },
      {
        icon: Sparkles,
        title: 'Skills are injected, not just labelled',
        body: 'The full SKILL.md body is prepended to the system prompt. Three selectors: the SDD skill that frames the stage, the document-format skill that carries the shape the parsers demand, and a confident domain match on task runs.',
      },
      {
        icon: Compass,
        title: 'Steering',
        body: 'Markdown in .octo/steering with inclusion modes — always, fileMatch, manual, auto — plus your root AGENTS.md and CLAUDE.md as implicit always. Composed into every run: chat, task and hook alike. Docs can be pinned per workspace.',
      },
      {
        icon: Webhook,
        title: 'Event-driven hooks',
        body: 'JSON in .octo/hooks fires a Claude run on app events: spec advanced, file saved, task or wave complete. Hook runs write through the CLI rather than the app’s own write path, so they cannot retrigger themselves.',
      },
      {
        icon: SearchCheck,
        title: 'A routing playground',
        body: 'Library › Routing shows the whole decision for a given step — the chosen agent, the reason, the injected skills, the ranked candidates. The same explanation appears in the spec’s briefing aside, where the decision actually lands.',
      },
      {
        icon: ShieldCheck,
        title: 'Library verification',
        body: 'The Running-Tasks panel resolves the chosen agent and skill back to the installed file — workspace .claude/ versus global — so you can confirm what is actually in use rather than what should be.',
      },
    ],
  },
  {
    id: 'scale',
    eyebrow: 'At scale',
    title: 'Many runs, one place to watch them',
    blurb:
      'Chat, spec drafting, audits and wave tasks all register in one global run registry, so the count in the top bar is the truth about what is in flight.',
    items: [
      {
        icon: Boxes,
        title: 'Waves and autopilot',
        body: 'Tasks in a wave run concurrently under one cap, mirrored on the tasks board and in Activity. Run all executes every wave autonomously, waiting for blocking hooks between them. Failures are isolated to their task.',
      },
      {
        icon: MonitorSmartphone,
        title: 'The Travel Display',
        body: 'An optional second window for an ultrawide bar display, where every run in flight is an octopus. Its zone is the spec, its position is whether it is moving, the dashed leash is what it waits on, its face is the status and its katana’s pose is the verb.',
      },
      {
        icon: Ticket,
        title: 'Ticket trackers over MCP',
        body: 'Jira, Linear or any MCP tracker. Every write is shown as a plain action before it is sent, mappings are discovered from the server’s own tools/list rather than hardcoded, and what is pending is derived from spec state — so nothing is lost to a closed app and no write happens twice.',
        tone: 'agent',
      },
      {
        icon: ShieldCheck,
        title: 'A queryable run log',
        body: 'Every Claude invocation is recorded with its prompt, response, status and duration in a local SQLite database, alongside the phase-advance audit trail and hook-run log. Specs on disk stay the source of truth; the database is the mirror.',
      },
    ],
  },
];
