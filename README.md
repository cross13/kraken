# Kraken

**Spec-Driven Development workbench, powered by Claude.**

Kraken is an Electron desktop app for running the SDD loop end-to-end: capture requirements → design the system → break it into trackable tasks → execute with Claude. Built around your **local Claude CLI** (default) or the Anthropic API.

## Why

Most AI coding tools collapse the spec into the chat. Kraken keeps the spec a first-class artifact — versioned markdown that lives next to your code — and uses Claude as the engine that drafts, refines, and executes it. By talking to your *installed* Claude CLI, your existing subagents, skills, and authentication just work.

## What's in the box

- **Two backends, one app**:
  - **Local Claude CLI** (default) — spawns `claude -p --output-format stream-json`. Free if you already pay for Claude Pro/Max.
  - **Anthropic API** — falls back to the SDK with your `sk-ant-…` key (encrypted via OS keychain).
- **Feature specs**: `requirements.md` → `design.md` → `tasks.md` with EARS-formatted acceptance criteria.
- **Bugfix specs**: `bugfix.md` → `design.md` → `tasks.md` with explicit *Unchanged Behavior* regression guards.
- **Claude Code-compatible agents and skills**: reads from the standard `.claude/agents/` and `.claude/skills/` locations (workspace + `~/.claude/`). Your existing subagents and skills load automatically.
- **Modern UI**: VS Code-inspired activity bar, sidebar views, tabbed markdown editor with preview, dockable streaming chat, status bar. Dark by default.

## Quick start

```bash
npm install
npm run dev
```

On first launch:

1. Click **Open folder** and pick any folder. Kraken creates `.kraken/specs/` and `.claude/{agents,skills}/` inside it.
2. Make sure the **Local Claude** backend is active in Settings — it should be by default. If the CLI isn't found:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude       # log in interactively (one-time)
   ```
   Then click **Re-detect** in Settings.
3. From the Welcome screen or the Specs sidebar, click **+ New spec** and choose Feature or Bugfix.
4. Edit the markdown directly, or click **Ask Claude** to draft the current section. The CLI runs in your workspace root, so it can read your code.
5. When the section is ready, click **Advance phase** to move Requirements → Design → Tasks.

### Don't want to install the CLI?

Switch the backend to **Anthropic API** in Settings and add a key:

1. Open <https://console.anthropic.com/settings/keys>.
2. Sign in (or create an account).
3. Click **Create Key**, copy the `sk-ant-…` value.
4. Paste it into Settings. It's encrypted with your OS keychain and only sent to `api.anthropic.com`.

Pricing is pay-per-token. The local CLI is cheaper for most users.

## SDD loop

```
Idea → Requirements/Bug analysis (EARS) → Design → Tasks (waves) → Implementation
                       ↑                                              │
                       └──────────────────────────────────────────────┘
                          (re-sync when reality contradicts the spec)
```

## Agent library

Click **Seed defaults** in the Agents or Skills view to install the SDD library into `.claude/agents/`:

| Agent | When to use |
|---|---|
| `spec-requirements-writer` | Drafts `requirements.md` from raw intent. Strict EARS. |
| `spec-design-architect` | Turns requirements into `design.md` with components, data, sequences, testing. |
| `spec-task-planner` | Breaks design into dependency waves with verifiable outcomes. |
| `spec-task-executor` | Executes one task at a time. Reads spec, edits files, ticks the box. |
| `bug-analyzer` | Drives the bugfix Analysis phase. Reproduction, Current, Expected, *Unchanged*. |
| `codebase-explorer` | Read-only grounding before planning. Reports file:line. |
| `code-reviewer` | Reviews staged changes for correctness, regressions, reuse, simplification. |
| `test-generator` | Maps each EARS statement (and Unchanged Behavior statement) to a test. |
| `spec-doctor` | Audits a spec for inconsistencies between requirements, design, and tasks. |

Each agent is a markdown file with YAML frontmatter (`name`, `description`, optional `tools`, optional `model`) — the exact format Claude Code uses. Drop your own into:

- `<workspace>/.claude/agents/` (project-scoped)
- `~/.claude/agents/` (global, across all projects)

Workspace agents take priority on name conflicts. Same precedence rules as Claude Code.

In chat, type `@` to pick an agent; the picked agent's prompt is injected as the system message.

## Skills

Skills follow the open Agent Skills standard: a folder with `SKILL.md`, plus optional `scripts/`, `references/`, `assets/`.

```
.claude/skills/sdd-feature/
└── SKILL.md
```

```yaml
---
name: sdd-feature
description: Walk through requirements → design → tasks for a new feature.
---
```

Type `/` in chat to invoke a skill for the next message. Skills are read from the same workspace/global precedence as agents.

## Architecture

- **Electron main** (`electron/main.ts`) — IPC handlers for FS, specs, skills, agents, settings; CLI process management; Anthropic SDK streaming.
- **CLI integration** — spawns `claude -p --output-format stream-json --verbose` and parses JSONL events. The subprocess inherits the workspace as its working directory, so Claude can read your code and respect your `CLAUDE.md`. PATH is expanded to include `~/.claude/local/`, `/opt/homebrew/bin`, `/usr/local/bin`, and `/usr/bin` for reliable detection inside Electron.
- **API integration** — `@anthropic-ai/sdk`'s `messages.stream()` runs in the main process; deltas forwarded over IPC.
- **Preload** (`electron/preload.ts`) — typed bridge exposed on `window.kraken`. Context-isolated, no nodeIntegration.
- **Renderer** (`src/`) — React 18 + Tailwind + Zustand.
- **Secrets** — Anthropic API key encrypted with Electron `safeStorage` (OS keychain on macOS/Windows/Linux).
- **Specs on disk** — plain markdown in `.kraken/specs/`. No proprietary format. Commit them with your code.

## File layout in a workspace

```
your-project/
├── .kraken/
│   └── specs/                       # SDD specs (Kraken-owned)
│       └── user-authentication/
│           ├── spec.json            # phase + metadata
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
├── .claude/                         # standard Claude Code dirs
│   ├── agents/                      # subagents (workspace scope)
│   │   └── spec-requirements-writer.md
│   └── skills/
│       └── sdd-feature/
│           └── SKILL.md
└── ... your source code ...
```

Plus the global locations Claude Code already uses: `~/.claude/agents/` and `~/.claude/skills/`.

## Scripts

```bash
npm run dev          # dev server + electron with HMR
npm run build        # production build (out/)
npm run start        # preview the production build
npm run typecheck    # tsc --noEmit for node + web tsconfigs
npm run package:mac  # build a directory bundle for macOS
```

## Website

The marketing/product site lives in [`website/`](./website) — a standalone Vite + React app
(React Flow, Framer Motion, Tailwind) with real screenshots of the desktop app. See
[`website/README.md`](./website/README.md). Run it with `cd website && npm install && npm run dev`.

## License

MIT.
