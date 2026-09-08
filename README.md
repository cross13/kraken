<div align="center">

# 0ct0

**Spec-Driven Development workbench, powered by Claude.**

</div>

0ct0 (spoken *Octo*) is an Electron desktop app for running the SDD loop end-to-end: write the
requirements → settle the open decisions → let Claude draft the plan → run the tasks as parallel
waves → open the pull request. It drives your **local Claude CLI** (default) or the **Anthropic
API**, and reads your existing Claude Code agents and skills so your setup works as-is.

> **On the name.** `0ct0` is the wordmark — the two zeros bracket the creature. On disk and in
> code the identifier stays `octo` (`.octo/`, `window.octo`, `dev.octo.app`), so nothing about the
> relaunch moves a file or breaks a workspace.

---

## Why

Most AI coding tools collapse the spec into the chat. 0ct0 keeps the spec a first-class artifact —
versioned markdown that lives next to your code — and uses Claude as the engine that drafts,
refines, and executes it. Because it talks to your *installed* Claude CLI, your existing subagents,
skills, and authentication just work.

Three things follow from that, and they are the whole product:

1. **It asks before it drafts.** Approving requirements does not open a blank plan, it opens
   *Clarify* — every unsettled decision as a card with pre-loaded options. A plan run that hits an
   open decision writes it down and stops instead of guessing.
2. **Review is the default view.** Both authored documents open on *Review*, where each acceptance
   criterion lights the sections, tasks and files that satisfy it — and the ones nothing covers are
   the point.
3. **It ends in a pull request.** When the last task lands, the spec advances on its own, a summary
   is generated, and branch → commit → PR are right there.

---

## Requirements

### To run the app

| | Requirement | Notes |
|---|---|---|
| **OS** | macOS, Windows, or Linux | Developed and packaged primarily on macOS (Apple Silicon). Windows/Linux builds exist but get less testing. |
| **Node.js** | **20.x or newer** (22.x recommended) | Needed for `npm run dev` / `npm run build`. Not needed to run a packaged binary. |
| **npm** | 10.x or newer | |
| **Claude access** | *One of* the two backends below | 0ct0 cannot talk to Claude without one. |

### Backend — pick one (switchable at runtime in Settings)

**A. Local Claude CLI — the default, and the cheaper option**

```bash
npm install -g @anthropic-ai/claude-code
claude          # log in interactively, one time
```

0ct0 spawns `claude -p --output-format stream-json` in your workspace. Free if you already pay
for Claude Pro/Max. It expands `PATH` (`~/.claude/local/`, `~/.local/bin`, `/opt/homebrew/bin`,
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

- **GitHub token** (Settings › Repository) — enables Create PR / list / merge from the Ship panel.
  Stored with the same `safeStorage` mechanism as the API key.
- **A ticket tracker** (Library › Tickets) — Jira, Linear, or any MCP server. Credentials go in
  the keychain, via a token or an OAuth 2.1 sign-in.
- **A second display** — the optional **Travel Display** targets an ultrawide bar monitor
  (e.g. ~2560×720). Falls back to a compact bar on the primary display.

---

## Quick start

```bash
npm install
npm run dev        # renderer on port 5847 (strict) + Electron with HMR
```

1. Click **Open folder** and pick any project. 0ct0 creates `.octo/` and reads `.claude/`.
2. On first run, accept the **Set up 0ct0 defaults** strip on Home — it seeds the bundled SDD
   agents, skills, steering docs, and hooks into the workspace. Everything is editable afterwards
   under **Library**. **Quick Start** (⌘K, or the first-run card) walks you through the rest
   against real state, not a checklist of promises.
3. Describe what you want to build in the Home composer:
   - **Plan** — creates the spec and opens it with **no run started**, keeping your text as the
     brief for an explicit *Draft … with Claude*.
   - **Quick Plan** — drafts both documents with no stops.
   - End your text with `?` to send it to the Assistant instead of creating a spec.
   - Or click a ticket in **Entrada** to arm it, and start from there.
4. Walk the loop: approve Requirements → answer the Clarify cards → approve the Plan →
   **Run all** on Build turns on autopilot, and tasks execute as parallel waves.
5. When the last task completes the spec auto-advances to `done` and the **Ship** panel opens
   inside Build: a generated summary plus branch / Commit all / Create PR.

---

## The loop

Three stages, a fixed order, and a human required in exactly two places.

```
requirements ──▶ [approve] ──▶ clarify ──▶ plan ──▶ [approve] ──▶ build ──▶ done
```

| Stage | Document | What ends it |
|---|---|---|
| **Requirements** | `requirements.md` (or `bugfix.md`) | You approve. *Review* groups each criterion under the story it answers, flags untestable wording, and lists the stories nothing covers. |
| **Plan** | `plan.md` | You approve — which **derives `tasks.md`** from the plan's `## Tasks` section, and refuses when there isn't one. The stage opens on **Clarify**, not on the document. |
| **Build** | `tasks.md` | Nothing — it's automatic. The spec advances when the last task completes and the Ship panel opens. |

Every step also offers *Revise with feedback* (re-draft inline) and *Improve with Claude* (a
critical self-review that refines the document in place). A task run that deviates from the plan
appends a `### Critical Decision` back into `plan.md`, so the plan never drifts from the code.

---

## The four surfaces

There is no tab bar and no focus mode — the app is four singleton surfaces plus two drawers and a
slide-over panel.

| Surface | What lives there |
|---|---|
| **Home** | A **board**. The composer creates specs, over **Entrada** (open tickets, one lane per tracker) beside three phase columns (Requirements · Plan · Build), with shipped work on a collapsed *Entregado* shelf. A column's rule is coloured by its contents — green = running, violet = waiting on you — so the board says where you are needed before a card is read. |
| **Spec** | One continuous guided flow for the active spec: file tabs, the phase strip, each document as **Source / Cards / Review / Edit** over a gate bar, the **Zen** reading mode (⌘⇧Z), the stage briefing aside, inline task blocks, and Ship. |
| **Activity** | The single "what's running" centre: live **Runs** with cancel + the concurrency control, run **History**, **Specs** (per-spec run analytics), **Terminals** (PTYs stay mounted), and the agent **Graph**. |
| **Library** | Everything that configures the loop: Agents · Skills · Hooks · Steering · **Tickets** · Routing · Appearance · Settings. |

Plus: the **Assistant** chat drawer (⌘J, drag-resizable), the **Explorer** file drawer (⌘⇧E), a
right slide-over **overlay** for detail views (file / agent / skill / run / hook / ticket / repo),
and the **⌘K** command palette.

---

## Features

- **Two interchangeable backends.** CLI and API emit the identical `claude:event` stream, so
  nothing user-visible is special-cased per backend.
- **Feature specs** — `requirements.md` → `plan.md` → `tasks.md` with EARS acceptance criteria.
- **Bugfix specs** — `bugfix.md` → `plan.md` → `tasks.md` with explicit *Unchanged Behavior*
  regression guards.
- **Clarify before drafting** — questions as one-click option cards; *Apply decisions* writes
  `## Resolved Decisions` and drafts the plan.
- **Traceability** — on `plan.md`, selecting an acceptance criterion lights the sections, tasks and
  files that satisfy it, from explicit `AC-n` citations with a vocabulary-matching fallback.
- **Format check** — the app's own parsers run as a deterministic check above the gate bar, split
  into mechanical findings (one correct answer → *Fix with Claude*) and ones needing judgement.
- **Claude Code-compatible agents & skills** — read from `.claude/agents/` and `.claude/skills/`
  (workspace + `~/.claude/`), exact same format and precedence. Skills are **injected**, not just
  labelled: `SKILL.md` bodies are prepended to the system prompt.
- **Content-aware agent routing** — per-task `@agent` > chat override > best-matching *installed*
  agent for the action. `explainRoute` exposes the whole decision in Library › Routing, and again
  in the spec's briefing aside where the decision actually lands.
- **Multi-agent orchestration** — tasks in a wave run as parallel Claude subprocesses capped by a
  single concurrency control, with failure isolation and autopilot across waves.
- **Ticket trackers over MCP** — Jira, Linear or any MCP server. Every write is shown as a plain
  action before it is sent; tool mappings are discovered from the server's own `tools/list` rather
  than hardcoded; what's pending is derived from spec state, so nothing is lost to a closed app and
  no write happens twice.
- **Event-driven hooks** — JSON in `.octo/hooks/` fire Claude runs on app events
  (spec-advance, spec-done, file-save, task-complete, wave-complete), with a loop-guard and
  per-hook cooldown.
- **Steering** — markdown in `.octo/steering/` (plus root `AGENTS.md` / `CLAUDE.md`) injected
  into *every* run, with always / fileMatch / manual / auto inclusion modes and pinning.
- **Interactive terminals** — real PTYs via `node-pty` + xterm.js. Where `claude:stream` is
  one-shot and can't be answered, a terminal running the real CLI handles AskUserQuestion,
  permission prompts, and slash commands natively.
- **Git & GitHub** — status, branch, commit, push, and PR create/list/merge, driven from the Ship
  panel and the global repo panel.
- **Travel Display** — an optional read-only fleet monitor on a second, ultrawide display, where
  every run in flight is an octopus and everything the creature does means something.
- **Theming** — four palettes (**Signal** — the default and the brand, Abyss, Bioluminescent,
  Daylight), variable-driven, plus a syntax-theme picker.

---

## Models

0ct0 does **not** hardcode a model menu. Settings › Models lists what this machine can actually
reach, and labels every entry with how it was learned:

| Badge | Source | Meaning |
|---|---|---|
| `your account` | Anthropic **Models API** (`GET /v1/models`) | Verified against your stored API key. Real context windows and output caps. |
| `local config` | `~/.claude/settings.json`, `<workspace>/.claude/settings.json`, `settings.local.json`, `$ANTHROPIC_MODEL` | The id your installed Claude Code CLI is configured to use — including aliases that no catalog contains. |
| `not verified` | 0ct0's bundled catalog | A known-good model id. 0ct0 has **not** confirmed you can reach it. |

Hit the refresh icon to re-detect. Discovery also re-runs when you change workspace or save an
API key.

**Why there's no per-model probe on the CLI backend:** the Claude CLI only validates `--model` by
starting a real run — a valid id costs a live, billable request. 0ct0 will not silently spend your
credits to populate a dropdown, so CLI-only setups get the config + catalog list and an honest
"not verified" badge. Add an API key to get the verified list.

Two knobs, not a matrix: a **default model** for everything, and an optional **planning model**
used only for the thinking-heavy steps (requirements, plan, tasks, audit).

---

## Layout & space

Surfaces are built to **use** the window. Content sits in one of three fluid containers rather
than a fixed centred column:

- `.k-wide` — dashboards, lists, settings, tables. Fills up to `--k-wide-max` with a fluid gutter.
- `.k-read` — long-form markdown, bounded by reading measure (~78ch), not by pixels.
- `.k-full` — code / source / diff views, edge-to-edge.

Card lists use `.k-cards`, an auto-fitting grid that adds columns as the window grows, and the
Library master/detail panes use `.k-listpane`, which scales with the viewport. Wide content
(tables, code) scrolls inside its own container so a surface never scrolls horizontally. All of
these are defined at the top of [`src/styles.css`](./src/styles.css).

**Signal**, the default palette and the brand, is deliberately austere: three base colours
(green `#76B900`, brand grey `#1E1E1E`, white), **radius 0**, **no shadows**, hierarchy from a
lighter grey plus a 1px border, and two accents with one role each — green executes, violet waits
on you. Never both on the same control.

---

## Brand

There is **one drawing** in the app: the chibi octopus samurai
([`src/components/wide/OctoMascot.tsx`](./src/components/wide/OctoMascot.tsx)), at three levels of
detail — `full` (≥64px), `simple` (40–64px), `mark` (14–26px).
[`src/components/OctoMark.tsx`](./src/components/OctoMark.tsx) wraps the `mark` level and is the
mark everywhere in the main window. The app icon
([`resources/icon.svg`](./resources/icon.svg), rasterised with `npm run icon`) is the same creature
inverted onto a green tile, because at 32px in a dock a dark tile with a thin rim disappears.

The `0ct0` wordmark pairs that mark with `ct` in Space Grotesk and a bar-zero whose green rule is
the kabuto's brim. Below ~96px of height it degrades to the mark plus `ct0` — never the creature
squeezed against display type it can no longer hold its own against. The full sheet lives in
[`design/brand/`](./design/brand).

---

## Workspace layout

```
your-project/
├── .octo/
│   ├── specs/
│   │   └── user-authentication/
│   │       ├── spec.json            # phase + metadata
│   │       ├── requirements.md      # or bugfix.md
│   │       ├── plan.md
│   │       ├── tasks.md
│   │       └── summary.md           # generated when the last task lands
│   ├── hooks/*.json                 # event-driven agent hooks
│   └── steering/*.md                # project context injected into every run
├── .claude/                         # standard Claude Code dirs
│   ├── agents/*.md
│   └── skills/<name>/SKILL.md
└── ... your source code ...
```

Global equivalents Claude Code already uses are also read: `~/.claude/agents/`,
`~/.claude/skills/`, `~/.octo/hooks/`. **Workspace wins on name conflicts.**

Run history lives outside the workspace, in a SQLite database at
`<userData>/octo.db` — specs on disk are the source of truth; the DB is a queryable mirror.

> Workspaces created before the rename are migrated automatically: a `.kraken/` directory is moved
> to `.octo/`, `kraken.*` renderer preferences are re-keyed to `octo.*`, and the legacy history DB
> is picked up from the old userData folder.

---

## Scripts

```bash
npm run dev          # electron-vite dev + Electron with HMR (renderer on port 5847, strict)
npm run build        # production build into out/
npm run start        # preview the production build
npm run typecheck    # BOTH typecheck:node and typecheck:web — the only automated gate
npm run routes       # per-task agent routing table; `-- --check` fails on a wrong pick
npm run hashes       # SHIPPED_DEFAULT_HASHES for the bundled bodies; `-- --check` in CI
npm run package:mac  # build + electron-builder --mac --dir
npm run package:win  # …--win --dir
npm run package:linux
npm run icon         # re-render resources/icon.png from icon.svg
```

> There is **no test runner and no linter configured**. `npm run typecheck` is the only automated
> gate on the code, and two invariants it cannot see have their own scripts — `npm run routes --
> --check` (a stray word in an agent's `description` silently hijacks every task run) and
> `npm run hashes -- --check` (an unlisted default body never reaches a cloned workspace). All
> three should pass before declaring work done. See
> [`PRODUCTION-CHECKLIST.md`](./PRODUCTION-CHECKLIST.md), where closing the test gap is the top
> blocker.

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
| [`docs/subsystems.md`](./docs/subsystems.md) | Hooks, steering, orchestration, git/GitHub, tickets, terminals, Travel Display |
| [`docs/adding-a-feature.md`](./docs/adding-a-feature.md) | Step-by-step recipe for a new module |
| [`docs/ux-redesign-proposal.md`](./docs/ux-redesign-proposal.md) | The *why* behind the four-surface shell |
| [`PRODUCTION-CHECKLIST.md`](./PRODUCTION-CHECKLIST.md) | What still has to be true before a public release |

**Docs are part of "done."** Any change to architecture, the IPC contract, the data model, or a
subsystem must update the matching doc in the same change.

---

## Security

0ct0 runs locally and drives Claude through your own CLI or API key. Secrets (the Anthropic key,
the GitHub token, tracker credentials) are encrypted with Electron `safeStorage` into the OS
keychain. The renderer is context-isolated with Node integration off, and the CSP admits no remote
origin but `api.anthropic.com`.

Two things to know before you point it at something you don't trust:

- **A workspace can ship hooks that run shell commands.** `.octo/hooks/*.json` with
  `actionType: "run-command"` executes on ordinary app events, and there is no trust prompt yet.
  Treat opening an unfamiliar repository the way you would treat running its build scripts.
- **`safeStorage` can fall back.** Where the OS keychain is unavailable (a Linux box with no
  keyring running, typically), secrets are stored base64-encoded rather than encrypted, and
  nothing currently tells you so.

Both are tracked in [`docs/security-review.md`](./docs/security-review.md), along with everything
else the last audit found. See [`.github/SECURITY.md`](./.github/SECURITY.md) for the threat model
and how to report a vulnerability.

---

## Contributing

The one hard rule: **data crosses Electron layers only through the typed IPC bridge.** A feature
touching the backend is always a three-part change:

```
electron/main.ts (registerIpc)  →  electron/preload.ts (window.octo)  →  src/ (store/component)
```

Shared types go in `electron/shared/types.ts` — keep that file dependency-free. Run
`npm run typecheck`, `npm run routes -- --check` and `npm run hashes -- --check` before declaring
anything done. See [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md).

---

## Website

The public site lives in [`website/`](./website) — a standalone Vite + React app. See
[`website/README.md`](./website/README.md). Run it with
`cd website && npm install && npm run dev`.

---

## License

MIT — see [`LICENSE`](./LICENSE).
