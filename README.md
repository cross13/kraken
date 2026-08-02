# Kraken

**Spec-Driven Development workbench, powered by Claude.**

Kraken is an Electron desktop app for running the SDD loop end-to-end: capture requirements →
design the system → break it into trackable tasks → execute them with Claude. It drives your
**local Claude CLI** (default) or the **Anthropic API**, and reads your existing Claude Code
agents and skills so your setup works as-is.

---

## Why

Most AI coding tools collapse the spec into the chat. Kraken keeps the spec a first-class
artifact — versioned markdown that lives next to your code — and uses Claude as the engine that
drafts, refines, and executes it. Because it talks to your *installed* Claude CLI, your existing
subagents, skills, and authentication just work.

---

## Requirements

### To run the app

| | Requirement | Notes |
|---|---|---|
| **OS** | macOS, Windows, or Linux | Developed and packaged primarily on macOS (Apple Silicon). Windows/Linux builds exist but get less testing. |
| **Node.js** | **20.x or newer** (22.x recommended) | Needed for `npm run dev` / `npm run build`. Not needed to run a packaged binary. |
| **npm** | 10.x or newer | |
| **Claude access** | *One of* the two backends below | Kraken cannot talk to Claude without one. |

### Backend — pick one (switchable at runtime in Settings)

**A. Local Claude CLI — the default, and the cheaper option**

```bash
npm install -g @anthropic-ai/claude-code
claude          # log in interactively, one time
```

Kraken spawns `claude -p --output-format stream-json` in your workspace. Free if you already pay
for Claude Pro/Max. Kraken expands `PATH` (`~/.claude/local/`, `~/.local/bin`, `/opt/homebrew/bin`,
`/usr/local/bin`, `/usr/bin`) because Electron's inherited `PATH` is too narrow to find the binary
— if detection still fails, hit **Re-detect** in Settings › Connection.

**B. Anthropic API key**

Create a key at <https://console.anthropic.com/settings/keys> and paste it into
Settings › Connection. It's encrypted with Electron `safeStorage` (your OS keychain) and only
ever sent to `api.anthropic.com`. Pay-per-token.

> An API key also unlocks **verified model discovery** — see [Models](#models) below.

### Native modules

Two dependencies ship native binaries and are rebuilt for Electron by the `postinstall` hook
(`electron-builder install-app-deps`):

- **`better-sqlite3`** — the run-history database.
- **`node-pty`** — interactive terminals. Ships an N-API prebuilt (no from-source rebuild) and is
  `asarUnpack`-ed for packaging.

If `npm install` leaves you with an ABI error on first launch, re-run
`npx electron-builder install-app-deps`.

### Optional

- **GitHub token** (Settings › Repository) — enables Create PR / list / merge from the Ship stage.
  Stored with the same `safeStorage` mechanism as the API key.
- **A second display** — the optional **Travel Display** targets an ultrawide bar monitor
  (e.g. ~2560×720). Falls back to a compact bar on the primary display.

---

## Quick start

```bash
npm install
npm run dev        # renderer on port 5847 (strict) + Electron with HMR
```

1. Click **Open folder** and pick any project. Kraken creates `.kraken/` and reads `.claude/`.
2. On first run, accept the **Set up Kraken defaults** card on Home — it seeds the bundled SDD
   agents, skills, steering docs, and hooks into the workspace. Everything is editable afterwards
   under **Library**.
3. Describe what you want to build in the Home composer:
   - **Plan** — creates the spec and drafts requirements, then walks Requirements → Design → Tasks
     with an approval gate at each step.
   - **Quick Plan** — drafts all three documents with no stops and lands you on Tasks.
   - End your text with `?` to send it to the Assistant instead of creating a spec.
4. On the **Tasks** stage, **Run all** turns on autopilot — tasks execute as parallel waves.
5. When the last task completes the spec auto-advances to **Ship**: a generated summary plus
   branch / Commit all / Create PR.

---

## The four surfaces

There is no tab bar and no focus mode — the app is four singleton surfaces plus two drawers and a
slide-over panel.

| Surface | What lives there |
|---|---|
| **Home** | The launchpad. Composer that creates specs, in-flight spec cards, Shipped recents, and a Manage mode with spec analytics. |
| **Spec** | One continuous guided flow for the active spec: file tabs, the phase strip (Requirements → Design → Task List → Ship), each document as Source / Cards / Edit over a gate bar, inline task blocks, and the Ship stage. |
| **Activity** | The single "what's running" centre: live **Runs** with cancel + the concurrency control, run **History**, **Terminals** (PTYs stay mounted), and the agent **Graph**. |
| **Library** | Everything that configures the loop: Agents · Skills · Hooks · Steering · Routing · Appearance · Settings. |

Plus: the **Assistant** chat drawer (⌘J, drag-resizable), the **Explorer** file drawer (⌘⇧E), a
right slide-over **overlay** for detail views (file / agent / skill / run / hook / repo), and the
**⌘K** command palette.

---

## Features

- **Two interchangeable backends.** CLI and API emit the identical `claude:event` stream, so
  nothing user-visible is special-cased per backend.
- **Feature specs** — `requirements.md` → `design.md` → `tasks.md` with EARS acceptance criteria.
- **Bugfix specs** — `bugfix.md` → `design.md` → `tasks.md` with explicit *Unchanged Behavior*
  regression guards.
- **Claude Code-compatible agents & skills** — read from `.claude/agents/` and `.claude/skills/`
  (workspace + `~/.claude/`), exact same format and precedence. Skills are **injected**, not just
  labelled: `SKILL.md` bodies are prepended to the system prompt.
- **Content-aware agent routing** — per-task `@agent` > chat override > best-matching *installed*
  agent for the action. `explainRoute` exposes the whole decision in Library › Routing.
- **Multi-agent orchestration** — tasks in a wave run as parallel Claude subprocesses capped by a
  single concurrency control, with failure isolation and autopilot across waves.
- **Event-driven hooks** — JSON in `.kraken/hooks/` fire Claude runs on app events
  (spec-advance, spec-done, file-save, task-complete, wave-complete), with a loop-guard and
  per-hook cooldown.
- **Steering** — markdown in `.kraken/steering/` (plus root `AGENTS.md` / `CLAUDE.md`) injected
  into *every* run, with always / fileMatch / manual / auto inclusion modes and pinning.
- **Interactive terminals** — real PTYs via `node-pty` + xterm.js. Where `claude:stream` is
  one-shot and can't be answered, a terminal running the real CLI handles AskUserQuestion,
  permission prompts, and slash commands natively.
- **Git & GitHub** — status, branch, commit, push, and PR create/list/merge, driven from the Ship
  stage and the global repo panel.
- **Travel Display** — an optional read-only fleet monitor on a second, ultrawide display.
- **Theming** — three palettes (Abyss, Bioluminescent, Daylight), variable-driven, plus a
  syntax-theme picker.

---

## Models

Kraken does **not** hardcode a model menu. Settings › Models lists what this machine can actually
reach, and labels every entry with how it was learned:

| Badge | Source | Meaning |
|---|---|---|
| `your account` | Anthropic **Models API** (`GET /v1/models`) | Verified against your stored API key. Real context windows and output caps. |
| `local config` | `~/.claude/settings.json`, `<workspace>/.claude/settings.json`, `settings.local.json`, `$ANTHROPIC_MODEL` | The id your installed Claude Code CLI is configured to use — including aliases like `opus[1m]` that no catalog contains. |
| `not verified` | Kraken's bundled catalog | A known-good model id. Kraken has **not** confirmed you can reach it. |

Hit the refresh icon to re-detect. Discovery also re-runs when you change workspace or save an
API key.

**Why there's no per-model probe on the CLI backend:** the Claude CLI only validates `--model` by
starting a real run — a valid id costs a live, billable request (~$0.03 and several seconds each).
Kraken will not silently spend your credits to populate a dropdown, so CLI-only setups get the
config + catalog list and an honest "not verified" badge. Add an API key to get the verified list.

Two knobs, not a matrix: a **default model** for everything, and an optional **planning model**
used only for the thinking-heavy steps (requirements, design, tasks, audit).

---

## Layout & space

Surfaces are built to **use** the window. Content sits in one of three fluid containers rather
than a fixed centred column:

- `.k-wide` — dashboards, lists, settings, tables. Fills up to `--k-wide-max` (1680px) with a
  fluid gutter.
- `.k-read` — long-form markdown, bounded by reading measure (~78ch), not by pixels.
- `.k-full` — code / source / diff views, edge-to-edge.

Card lists use `.k-cards`, an auto-fitting grid that adds columns as the window grows, and the
Library master/detail panes use `.k-listpane`, which scales with the viewport. Wide content
(tables, code) scrolls inside its own container so a surface never scrolls horizontally. All of
these are defined at the top of [`src/styles.css`](./src/styles.css).

---

## Workspace layout

```
your-project/
├── .kraken/
│   ├── specs/
│   │   └── user-authentication/
│   │       ├── spec.json            # phase + metadata
│   │       ├── requirements.md
│   │       ├── design.md
│   │       ├── tasks.md
│   │       └── summary.md           # generated on Ship
│   ├── hooks/*.json                 # event-driven agent hooks
│   └── steering/*.md                # project context injected into every run
├── .claude/                         # standard Claude Code dirs
│   ├── agents/*.md
│   └── skills/<name>/SKILL.md
└── ... your source code ...
```

Global equivalents Claude Code already uses are also read: `~/.claude/agents/`,
`~/.claude/skills/`, `~/.kraken/hooks/`. **Workspace wins on name conflicts.**

Run history lives outside the workspace, in a SQLite database at
`<userData>/kraken.db` — specs on disk are the source of truth; the DB is a queryable mirror.

---

## Scripts

```bash
npm run dev          # electron-vite dev + Electron with HMR (renderer on port 5847, strict)
npm run build        # production build into out/
npm run start        # preview the production build
npm run typecheck    # BOTH typecheck:node and typecheck:web — the only automated gate
npm run package:mac  # build + electron-builder --mac --dir
npm run package:win  # …--win --dir
npm run package:linux
npm run icon         # re-render resources/icon.png from icon.svg
```

> There is **no test runner and no linter configured**. `npm run typecheck` is the only automated
> gate today — see [`PRODUCTION-CHECKLIST.md`](./PRODUCTION-CHECKLIST.md), where closing that gap
> is the top blocker.

---

## Developer documentation

Full developer reference lives in [`docs/`](./docs) — read it before changing a module or adding
one. [`CLAUDE.md`](./CLAUDE.md) is the quick orientation map; the docs go deeper.

| Doc | Covers |
|---|---|
| [`docs/README.md`](./docs/README.md) | Index + the one rule that matters (the IPC boundary) |
| [`docs/architecture.md`](./docs/architecture.md) | The three Electron layers, process model, end-to-end data flow |
| [`docs/ipc-contract.md`](./docs/ipc-contract.md) | Every IPC namespace + the recipe to add a handler |
| [`docs/data-model.md`](./docs/data-model.md) | Shared types, on-disk spec shape, SQLite schema |
| [`docs/backends.md`](./docs/backends.md) | CLI vs API streaming, the common event stream, model discovery |
| [`docs/renderer.md`](./docs/renderer.md) | Stores, component tree, layout system, routing, skill injection |
| [`docs/subsystems.md`](./docs/subsystems.md) | Hooks, steering, orchestration, git/GitHub, terminals, Travel Display |
| [`docs/adding-a-feature.md`](./docs/adding-a-feature.md) | Step-by-step recipe for a new module |
| [`docs/ux-redesign-proposal.md`](./docs/ux-redesign-proposal.md) | The *why* behind the four-surface shell |
| [`PRODUCTION-CHECKLIST.md`](./PRODUCTION-CHECKLIST.md) | What still has to be true before a public release |

**Docs are part of "done."** Any change to architecture, the IPC contract, the data model, or a
subsystem must update the matching doc in the same change.

---

## Contributing

The one hard rule: **data crosses Electron layers only through the typed IPC bridge.** A feature
touching the backend is always a three-part change:

```
electron/main.ts (registerIpc)  →  electron/preload.ts (window.kraken)  →  src/ (store/component)
```

Shared types go in `electron/shared/types.ts` — keep that file dependency-free. Run
`npm run typecheck` before declaring anything done.

---

## Website

The marketing site lives in [`website/`](./website) — a standalone Vite + React app. See
[`website/README.md`](./website/README.md). Run it with
`cd website && npm install && npm run dev`.

---

## License

MIT — see [`LICENSE`](./LICENSE).
