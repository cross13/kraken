# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Octo is an Electron desktop app for running the Spec-Driven Development (SDD) loop:
requirements → plan → build (tasks + execution). It drives Claude through one of two
interchangeable backends — the user's **local Claude CLI** (default) or the **Anthropic
API SDK** — selected at runtime in Settings. Specs are plain markdown on disk; agents and
skills are read from the standard Claude Code locations (`.claude/agents`, `.claude/skills`,
plus `~/.claude/`), so the user's existing Claude Code setup loads automatically.

## Documentation — ALWAYS keep it updated

Developer docs live in **`docs/`** (`docs/README.md` is the index). They are the reference for
updating an existing module or creating a new one. **This is a hard rule, not a suggestion:**

> Whenever you change architecture, the IPC contract, the data model, a subsystem's behavior, or
> add/remove a module, **update the matching `docs/*.md` file in the same change** — before
> declaring the work done. Treat the docs as part of the definition of "done", exactly like
> `npm run typecheck`. An out-of-date doc is a bug.

Which doc maps to what (full table in `docs/adding-a-feature.md` → "Update the docs"):
`architecture.md` (layers/flow), `ipc-contract.md` (handlers/namespaces),
`data-model.md` (persisted shapes), `backends.md` (Claude invocation),
`renderer.md` (stores/components/routing/skills), `subsystems.md` (hooks/steering/orchestration/
git/agents-skills). New subsystem → add a section to `subsystems.md` and a row to `docs/README.md`.
Keep this `CLAUDE.md` in sync too when the high-level picture changes.

## Commands

```bash
npm run dev          # electron-vite dev server + Electron with HMR (renderer on port 5847, strict)
npm run build        # production build into out/
npm run start        # preview the production build
npm run typecheck    # runs BOTH typecheck:node and typecheck:web — use this before declaring done
npm run package:mac  # build + electron-builder --mac --dir
```

There is **no test runner and no linter** configured. `npm run typecheck` is the only
automated gate; always run it after edits. There is also no `.git` repo here.

Two separate TypeScript projects compile independently:
- `tsconfig.node.json` → `electron/**` (main + preload + shared), Node types only.
- `tsconfig.web.json` → `src/**` plus `electron/preload.ts` and `electron/shared/**`, DOM types.
- Path alias `@/*` → `src/*` (renderer only).

## Architecture

Three Electron layers; data crosses between them **only** through the typed IPC bridge.

### Main process — `electron/main.ts` (~1300 lines, the core)
Owns all filesystem, spec, agent/skill, settings, git, history, and Claude-streaming logic.
Everything is registered in `registerIpc()`. Key responsibilities living here:
- **Spec lifecycle** — `createSpec`/`readSpec`/`writeSpecFile`/`advanceSpec` plus the
  markdown `*Template` functions. A spec is a directory under `.octo/specs/<id>/`
  containing `spec.json` (phase + metadata) and the phase markdown files. `advanceSpec`
  walks the fixed order `requirements → plan → build → done` and lazily writes the next
  phase's template file if missing.
- **Backend dispatch** — `streamClaude` records a run row, then forks to `streamViaCli`
  or `streamViaApi` based on the `backend` setting. Both emit identical `claude:event`
  IPC messages (`delta` / `done` / `error`) via the shared `emit()`, which also mirrors
  output into SQLite.
- **CLI integration** — `streamViaCli` flattens system + message history into one prompt
  and spawns `claude -p --output-format stream-json --verbose --permission-mode ... --allowedTools ...`.
  The subprocess `cwd` is the workspace so Claude sees the user's code and `CLAUDE.md`.
  `expandedPath()` augments PATH (`~/.claude/local/`, `/opt/homebrew/bin`, etc.) because
  Electron's inherited PATH is too narrow to find the binary. Active children are tracked
  in `activeStreams` for cancellation.
- **API integration** — `streamViaApi` uses `@anthropic-ai/sdk` `messages.stream()`.
- **Secrets** — the API key is encrypted with Electron `safeStorage` (OS keychain) and
  persisted via `electron-store`; never stored in plaintext.
- **Default library** — `seedDefaultAgents`/`seedDefaultSkills` write the bundled SDD agent
  and skill markdown into the workspace's `.claude/` dirs ("Seed defaults" in the UI).

### Preload — `electron/preload.ts`
Context-isolated bridge. Exposes a single typed object on `window.octo` (namespaced:
`workspace`, `specs`, `data`, `skills`, `agents`, `fs`, `settings`, `cli`, `git`, `history`,
`claude`).
`OctoApi` (its `typeof`) is the contract the renderer types against. **When you add or
change an IPC handler in `main.ts`, you must update the matching method here**, or the
renderer can't reach it. Streaming is fire-and-forget: `claude.stream(payload)` sends, and
results arrive through `claude.onEvent(handler)`.

### Renderer — `src/` (React 18 + Tailwind + Zustand)
- **State** lives in Zustand stores (`src/stores/`): `workspace` (root path, specs,
  agents, skills), `chat` (message list, streaming state, selected agent, `pendingPrompt`
  handoff), `ui` (surface + drawers + overlay + terminals), `orchestrator` (global run
  registry), `models` (planning model + **discovered** model list), `moduleConfig` (routing
  pins/skill toggles), `syntax`, and `theme` (active palette). Components subscribe to these —
  there is no other global state.
- **Models are discovered, not hardcoded.** `models:list` merges the Anthropic Models API (only
  when an API key is stored; called over raw `fetch` because the pinned SDK predates
  `client.models`) with the ids named in the local Claude Code config, falling back to a bundled
  catalog. Each entry carries a `ModelOrigin` (`api` / `cli-config` / `catalog`) and Settings
  shows it, so the UI never implies availability it hasn't verified. There is deliberately **no
  per-model CLI probe** — the CLI only validates `--model` by starting a real billable run. See
  `docs/backends.md` → Model discovery.
- **Space is a design constraint.** Surfaces use the window instead of parking content in a fixed
  centred column. Three fluid containers in `styles.css` — `.k-wide` (dashboards/lists/settings,
  ≤ `--k-wide-max`), `.k-read` (long-form markdown, bounded by 78ch reading measure), `.k-full`
  (code/diff, edge-to-edge) — plus `.k-cards` (auto-fitting card grid), `.k-split`
  (primary + collapsing aside), and `.k-listpane` (viewport-scaled master pane). **Never add a new
  `max-w-[NNNpx] mx-auto`;** pick a container. Wide content scrolls inside its own container so a
  surface never scrolls horizontally. See `docs/renderer.md` → Layout & space.
- **Theming** is variable-driven: every Tailwind colour is `rgb(var(--x) / <alpha-value>)`,
  with three palettes (Abyss [default], Bioluminescent, Daylight) selected by `<html data-theme>`
  (see `docs/renderer.md` → Theming). `--accent-fg` is themeable; fonts are Hanken Grotesk (body) /
  Space Grotesk (`font-display`) / JetBrains Mono. The visual language is **frame + floating
  panels** (Kiro-style): `--rail` is the near-black app frame, surfaces float on it as rounded
  panels with a hairline ring; greys are neutral and the purple lives only in the accent.
- **Layout** is the **four-surface shell** (`App.tsx`): `CommandBar` (brand + ⌘K
  `CommandPalette` + the one live-runs pill + project/model status) → `SurfaceNav` (4 icons) →
  one of **Home · Spec · Activity · Library**, plus the **Assistant** chat drawer (⌘J,
  `AssistantDrawer`), the **Explorer** drawer (⌘⇧E), and a right slide-over **`OverlayPanel`**
  for detail views (file/agent/skill/run viewers, Open Questions, hook editor, the repo panel).
  There is **no global tab bar and no focus mode** — surfaces are singletons. **Home** (`HomeView`) is
  the launchpad: its composer **creates specs** (`lib/specActions.ts` — **Plan** creates the spec
  and opens it with **no run started**, keeping the composer text as `SpecMeta.brief` for the
  explicit *Draft … with Claude* action; **Quick Plan** drafts both docs with no stops;
  `?`-suffixed input goes to the Assistant), plus in-flight spec cards, Shipped recents, a
  Manage mode embedding `SpecsStudio` (analytics + `specs:delete`), and a one-time
  "Set up Octo defaults" seeding card. **Spec** (`SpecFlow`) is one continuous guided flow
  framed like an editor: file tabs (`requirements.md`/`plan.md`/`tasks.md`) +
  breadcrumb + the spec strip (numbered phase chips: Requirements → Plan → **Build**),
  doc stages as line-numbered **Source** (default) / section **Cards** / raw **Edit** over a
  **gate bar** whose *Approve* advances the phase **and navigates** (*Revise with feedback*
  re-drafts inline; *Improve with Claude* runs a critical self-review that refines the doc in
  place — every step has one, incl. *Improve plan* on Tasks). Approving **Plan** derives
  `tasks.md` from the plan's `## Tasks` section, and refuses when there isn't one. Tasks render as
  **inline task blocks**
  with Kiro-style Start-task actions
  (`TaskRunner` engine, Run all = autopilot as the primary CTA), and **Ship** (`ShipView`) as a
  panel *inside* Build — the automatic payoff:
  the spec auto-advances to `done` when the last task completes, `CompletionSummary`
  auto-generates into `summary.md`, and branch/Commit all/Create PR sit right there. **Activity**
  (`ActivitySurface`) is the single "what's running" center (Runs = `OrchestratorView`, History,
  Terminals, Graph). **Library** (`LibrarySurface`) consolidates config: Agents · Skills · Hooks ·
  Steering · Routing (`RouterStudio`, now a read-only routing explainer + Advanced pins) ·
  Appearance (`SyntaxStudio`) · Settings (regrouped: Connection / Models incl. the **planning
  model** / Repository / Advanced / **Danger zone** — the `data:reset` wipe of specs on disk +
  the history DB, which never touches settings, secrets, agents, skills, hooks or steering). Module config lives in the `moduleConfig` store and is pushed
  into the router via `setRouterConfig`; the old routing-weight knobs are invisible defaults.
- **Agent routing** (`src/lib/agentRouter.ts`) is content-aware. Precedence: per-task
  `@agent` > chat `@agent` override > best-matching **installed** agent for the action.
  "Best match" tries the bundled default by name, then scores every agent in `.claude/agents`
  (workspace + global) by how well its name/description fits the work — so a frontend task
  picks your frontend agent over the generic `spec-task-executor` (a strong specialist match,
  score ≥ 2, wins for task execution). Scoring adds broad implementation signals
  (`IMPLEMENTER_SIGNALS`) plus a **workspace-scope bonus**, and task execution is **local-first**:
  if nothing matches it still picks the first project-local agent rather than going generic.
  Generic is reached only when the project has no installed agents at all. `routeAgent` returns
  a `RouteReason` for transparency. Per-step agent **pins** (reason `'pinned'`) and one
  skill-injection toggle live under Library › Routing › Advanced; the scoring weights are
  invisible defaults in `moduleConfig.ts`. `explainRoute` / `scoreAgents` expose the full
  decision (chosen agent + injected skills + ranked candidates) that drives the Routing
  playground.
- **Skills are injected, not just labelled.** `SkillMeta.body` carries the full `SKILL.md`
  text; `skillSystemBlock`/`skillSystemBlocks` build prompt blocks that are prepended to the
  system prompt. The SDD skill (`sdd-feature`/`sdd-bugfix`, by spec kind — three stages, two
  gates) governs spec drafting
  and task runs; `bestSkillByText` additionally injects a confident domain skill match
  (e.g. a frontend skill for UI tasks). Chat `/skill` injects that skill's body too. The
  Running-Tasks **Library verification** panel resolves the chosen agent/skill back to the
  installed file (root `.claude/` vs global) so you can confirm what's actually in use.

### Persistence — `electron/db.ts` (better-sqlite3)
App-level history DB at `app.getPath('userData')/octo.db`. Tables: `specs`, `spec_events`
(phase-advance audit trail), `runs` (every Claude invocation with prompt/response/status/
duration), `errors`, `hook_runs` (hook-triggered run log). This is global telemetry, separate
from the per-workspace spec markdown — specs on disk are the source of truth; the DB is a
queryable mirror + run log.

### Hooks — event-driven agent hooks (`electron/main.ts` hooks section)
JSON files in `.octo/hooks/*.json` (+ global `~/.octo/hooks/`), shape = `HookConfig`.
A Octo-native engine fires Claude runs on app-level events — `maybeFireHooks(trigger, ctx)`
is called at trigger points (`advanceSpec` → spec-advance/spec-done; `writeSpecFile` →
file-save-in-app; TaskRunner → task-complete/wave-complete; manual). `fireHook` reuses
`streamClaude` (so hook runs appear in History) via `getMainSender()`. **Loop-guard:** hook
runs write through the CLI, not the `fs:write` IPC, so they can't retrigger file-save hooks;
plus a per-hook cooldown (`hookCooldown`). `seedDefaultHooks` ships `code-validate-improve`
(wave-complete) and `docs-changelog` (spec-done). Hooks UI: Library › Hooks (`HooksStudio`) + the overlay `HookEditor`.

### Steering — project context injection (`electron/main.ts` steering section)
Markdown in `.octo/steering/*.md` (+ global, + root AGENTS.md/CLAUDE.md as implicit
`always`). `composeSteeringSystem` resolves inclusion modes (always / fileMatch / manual /
auto) and is prepended to `payload.system` **inside `streamClaude`**, so every run (chat,
task, hook) gets steering uniformly. Docs can be **pinned** (persisted per workspace in
`electron-store` as `steeringPins`, merged into `manualRefs` inside `streamClaude`) to
force-include them in every run regardless of mode. The primary UI is the full-page
**`SteeringStudio`** (`views/SteeringStudio.tsx`, mounted at Library › Steering) — full CRUD,
inclusion-mode + fileMatch + scope editing, pinning, and a live injection preview; backed by
`steering:{list,write,delete,preview,get-pins,set-pins}` IPC.

### Multi-agent orchestration (`src/stores/orchestrator.ts` + `TaskRunner.tsx` + Activity)
Tasks in a wave run as parallel concurrent Claude subprocesses (one `requestId` each), capped
by `maxConcurrency` (one control, mirrored on the tasks board and Activity › Runs). The `orchestrator`
store is the **global registry of every in-flight run** — chat, spec drafting, audits, and wave
tasks all `startRun`/`finishRun` here (each tagged with a `RunKind` + human `title`), decoupled
from the chat store's single `busy`. It keeps a recent-activity `log` (finished runs) and exposes
`taskRunningCount()` (task/refine/polish only) so chat/spec runs don't throttle wave scheduling.
**Activity › Runs** (`OrchestratorView`) shows live agents with elapsed time + per-run/stop-all
cancel, the concurrency control, and the activity log; the top bar and `SurfaceNav` show a live
running-count badge. Per-task agent specialization via `- [ ] T1 @agent-name: ...` (parsed in
`tasks.ts`, precedence in `agentRouter.ts`: per-task > chat override > action default).
`runWave`/`pump` schedule with failure isolation; **Autopilot** ("Run all", the tasks stage's
primary CTA) runs all waves autonomously, waiting for blocking hooks between waves. When the last
task completes the spec **auto-advances to `done` and the Ship panel opens inside Build** (auto-generated
summary + commit/PR). `specs:set-phase` allows reopening a phase (Re-sync); the **Audit** action
routes to `spec-doctor` for drift detection.

### Layout & resizing (`App.tsx` + `ResizeHandle` + `ui` store)
The Assistant drawer is drag-resizable via `ResizeHandle` (`assistantWidth`, clamped + persisted
to `localStorage`). Navigation state is `ui.surface` plus per-surface fields (`activeSpecId` +
`specStage`, `activityTab`, `librarySection`) and the `overlay` slide-over — all surfaced in the
`SurfaceNav` and the `CommandPalette`.

### Git & GitHub — `electron/git.ts`, `electron/github.ts`
Per-workspace git helpers (status, current-branch, create-branch, commit-push, push-current)
surfaced through `git:*` IPC. `github.ts` is a dependency-free GitHub REST client (token via
`safeStorage`, same pattern as the API key) exposed through `github:*` IPC — repo resolution
from the `origin` remote, token validation, and PR list/create/merge. Both are driven from the
spec's **Ship panel** (`ShipView`: branch → Commit all → Create PR, prefilled from the
auto-generated summary) and from the global **repo panel** (`SourceControlView variant="page"`,
opened as an overlay from the command-bar project pill / ⌘K). Both are spec-aware (`ui.activeSpecId`
resolves "the spec you're working on") and write branch/commit/PR state back into `SpecMeta`.

### Terminals — interactive PTY sessions (`electron/terminal.ts` + `TerminalView`/`TerminalsView`)
Where `claude:stream` is one-shot and fire-and-forget (`-p`, no stdin), terminals are a **fully
bidirectional** channel — the only way to *answer* Claude. A `TerminalManager` owns `node-pty`
processes keyed by `termId`; `createTerminal` in `main.ts` resolves the spawn policy
(`profile: 'shell'` = login shell; `profile: 'claude'` = the real `claude` CLI via `detectCli()`),
always with `expandedPath()` + workspace cwd. This gives **AskUserQuestion answers, permission
prompts, and real CLI slash commands** natively, "as in the cli". IPC: `terminal:create` (invoke)
+ `terminal:write`/`terminal:resize`/`terminal:kill` (send) + `terminal:data`/`terminal:exit`
events. The renderer uses **xterm.js** (`TerminalView`, panes kept mounted under Activity › Terminals so
the PTY survives navigation) with the web-links addon routing URL clicks to `shell:openUrl`, which **opens URLs Claude
emits in Google Chrome** (default-browser fallback). node-pty ships an N-API prebuilt binary (no
from-source rebuild; `asarUnpack`-ed for packaging). Sidebar: **Terminals** panel (`TerminalsView`).

### Travel Display — a wide second window (`main.ts` window section + `src/components/wide/WideApp.tsx`)
An optional **compact fleet monitor** for a secondary ultrawide bar display (e.g. a Corsair Xeneon
Edge, ~2560×720), toggled from the CommandBar (`MonitorSmartphone` icon) or ⌘K *Open Travel
Display*. `createWideWindow()` opens a single `frame:false` second `BrowserWindow` (`wideWindow`),
placed via the `screen` module on a non-primary display (`pickTravelDisplay()`; compact-bar
fallback on the primary), loading the same bundle with a `#wide` hash so `src/main.tsx` renders
`WideApp` instead of `App`. State is **one-directional**: the main window is authoritative and
pushes a serialized `FleetSnapshot` (`ActiveRun[]` from the `orchestrator` store) via `fleet:push`
→ forwarded over `fleet:sync`; the travel window is a **read-only mirror** that cancels through the
existing `claude:cancel`. IPC: `window:{toggle-wide,is-wide-open,wide-state,focus-main}` +
`fleet:{push,sync}`. Teardown is guarded (closing the main window or unplugging the display closes
it). See `docs/subsystems.md` → Travel Display.

## Conventions worth knowing

- **The IPC boundary is the contract.** A new feature touching the backend means: handler
  in `main.ts` `registerIpc()` → method in `preload.ts` → store/component in `src/`. Shared
  types go in `electron/shared/types.ts` (imported by both sides — keep it dependency-free).
- Both backends must stay behaviorally interchangeable: anything user-visible should flow
  through the common `claude:event` stream, not be special-cased per backend.
- Spec phase order and the `.octo/specs/<id>/{spec.json,*.md}` on-disk shape are load-bearing;
  changing them affects `createSpec`, `advanceSpec`, `readSpec`, and `listSpecs` together.
- Agents/skills follow Claude Code's exact format and precedence (workspace overrides global
  on name conflict) — don't invent a parallel format.
- **Docs are part of "done".** Any change to architecture, the IPC contract, the data model, or a
  subsystem must update the matching `docs/*.md` in the same change (see the Documentation rule
  above and `docs/README.md`).
