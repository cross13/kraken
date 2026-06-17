# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kraken is an Electron desktop app for running the Spec-Driven Development (SDD) loop:
requirements → design → tasks → execution. It drives Claude through one of two
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
  markdown `*Template` functions. A spec is a directory under `.kraken/specs/<id>/`
  containing `spec.json` (phase + metadata) and the phase markdown files. `advanceSpec`
  walks the fixed order `requirements → design → tasks → done` and lazily writes the next
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
Context-isolated bridge. Exposes a single typed object on `window.kraken` (namespaced:
`workspace`, `specs`, `skills`, `agents`, `fs`, `settings`, `cli`, `git`, `history`, `claude`).
`KrakenApi` (its `typeof`) is the contract the renderer types against. **When you add or
change an IPC handler in `main.ts`, you must update the matching method here**, or the
renderer can't reach it. Streaming is fire-and-forget: `claude.stream(payload)` sends, and
results arrive through `claude.onEvent(handler)`.

### Renderer — `src/` (React 18 + Tailwind + Zustand)
- **State** lives in three Zustand stores (`src/stores/`): `workspace` (root path, specs,
  agents, skills), `chat` (message list, streaming state, selected agent), `ui` (active
  view, panel layout). Components subscribe to these — there is no other global state.
- **Layout** is a VS Code-style shell: `ActivityBar` → `Sidebar` (Explorer, Specs,
  Agents, Skills, History, Settings views) → `EditorArea` (tabbed viewers) → dockable
  `ChatPanel` → `StatusBar`.
- **Agent routing** (`src/lib/agentRouter.ts`) is content-aware. Precedence: per-task
  `@agent` > chat `@agent` override > best-matching **installed** agent for the action.
  "Best match" tries the bundled default by name, then scores every agent in `.claude/agents`
  (workspace + global) by how well its name/description fits the work — so a frontend task
  picks your frontend agent over the generic `spec-task-executor` (a strong specialist match,
  score ≥ 2, wins for task execution). Scoring adds broad implementation signals
  (`IMPLEMENTER_SIGNALS`) plus a **workspace-scope bonus**, and task execution is **local-first**:
  if nothing matches it still picks the first project-local agent rather than going generic.
  Generic is reached only when the project has no installed agents at all. `routeAgent` returns
  a `RouteReason` for transparency.
- **Skills are injected, not just labelled.** `SkillMeta.body` carries the full `SKILL.md`
  text; `skillSystemBlock`/`skillSystemBlocks` build prompt blocks that are prepended to the
  system prompt. The SDD skill (`sdd-feature`/`sdd-bugfix`, by spec kind) governs spec drafting
  and task runs; `bestSkillByText` additionally injects a confident domain skill match
  (e.g. a frontend skill for UI tasks). Chat `/skill` injects that skill's body too. The
  Running-Tasks **Library verification** panel resolves the chosen agent/skill back to the
  installed file (root `.claude/` vs global) so you can confirm what's actually in use.

### Persistence — `electron/db.ts` (better-sqlite3)
App-level history DB at `app.getPath('userData')/kraken.db`. Tables: `specs`, `spec_events`
(phase-advance audit trail), `runs` (every Claude invocation with prompt/response/status/
duration), `errors`, `hook_runs` (hook-triggered run log). This is global telemetry, separate
from the per-workspace spec markdown — specs on disk are the source of truth; the DB is a
queryable mirror + run log.

### Hooks — event-driven agent hooks (`electron/main.ts` hooks section)
JSON files in `.kraken/hooks/*.json` (+ global `~/.kraken/hooks/`), shape = `HookConfig`.
A Kraken-native engine fires Claude runs on app-level events — `maybeFireHooks(trigger, ctx)`
is called at trigger points (`advanceSpec` → spec-advance/spec-done; `writeSpecFile` →
file-save-in-app; TaskRunner → task-complete/wave-complete; manual). `fireHook` reuses
`streamClaude` (so hook runs appear in History) via `getMainSender()`. **Loop-guard:** hook
runs write through the CLI, not the `fs:write` IPC, so they can't retrigger file-save hooks;
plus a per-hook cooldown (`hookCooldown`). `seedDefaultHooks` ships `code-validate-improve`
(wave-complete) and `docs-changelog` (spec-done). Hooks UI: `HooksView` + `HookEditor`.

### Steering — project context injection (`electron/main.ts` steering section)
Markdown in `.kraken/steering/*.md` (+ global, + root AGENTS.md/CLAUDE.md as implicit
`always`). `composeSteeringSystem` resolves inclusion modes (always / fileMatch / manual /
auto) and is prepended to `payload.system` **inside `streamClaude`**, so every run (chat,
task, hook) gets steering uniformly. UI: `SteeringView`.

### Multi-agent orchestration (`src/stores/orchestrator.ts` + `TaskRunner.tsx` + `OrchestratorView`)
Tasks in a wave run as parallel concurrent Claude subprocesses (one `requestId` each), capped
by `maxConcurrency` (Settings → Orchestration, or the Orchestrator panel). The `orchestrator`
store is the **global registry of every in-flight run** — chat, spec drafting, audits, and wave
tasks all `startRun`/`finishRun` here (each tagged with a `RunKind` + human `title`), decoupled
from the chat store's single `busy`. It keeps a recent-activity `log` (finished runs) and exposes
`taskRunningCount()` (task/refine/polish only) so chat/spec runs don't throttle wave scheduling.
The **Orchestrator** sidebar panel (`OrchestratorView`) shows live agents with elapsed time +
per-run/stop-all cancel, the concurrency control, and the activity log; the ActivityBar and
StatusBar show a live running-count badge. Per-task agent specialization via
`- [ ] T1 @agent-name: ...` (parsed in `tasks.ts`, precedence in `agentRouter.ts`: per-task >
chat override > action default). `runWave`/`pump` schedule with failure isolation; **Autopilot**
runs all waves autonomously, waiting for blocking hooks between waves and advancing to `done`
at the end. `specs:set-phase` allows reopening a phase (Re-sync); the **Audit** action routes
to `spec-doctor` for drift detection.

### Layout & resizing (`App.tsx` + `ResizeHandle` + `ui` store)
The sidebar and chat panels are drag-resizable via `ResizeHandle` (pointer-capture divider);
widths live in the `ui` store (`sidebarWidth`/`chatWidth`, clamped + persisted to `localStorage`).
`sidebarOpen`/`chatOpen` toggle visibility; the ActivityBar tab set (incl. Source Control,
Orchestrator) is the `ActivityTab` union in `ui.ts`.

### Git & GitHub — `electron/git.ts`, `electron/github.ts`
Per-workspace git helpers (status, current-branch, create-branch, commit-push, push-current)
surfaced through `git:*` IPC. `github.ts` is a dependency-free GitHub REST client (token via
`safeStorage`, same pattern as the API key) exposed through `github:*` IPC — repo resolution
from the `origin` remote, token validation, and PR list/create/merge. Both are driven from the
dedicated **Source Control** sidebar panel (`SourceControlView`), which is spec-aware (it reads
the active editor tab's spec for branch/commit/PR defaults and writes branch/commit/PR state
back into `SpecMeta`). The current project + branch are also shown in the `TitleBar` and
`StatusBar`, which deep-link into this panel.

## Conventions worth knowing

- **The IPC boundary is the contract.** A new feature touching the backend means: handler
  in `main.ts` `registerIpc()` → method in `preload.ts` → store/component in `src/`. Shared
  types go in `electron/shared/types.ts` (imported by both sides — keep it dependency-free).
- Both backends must stay behaviorally interchangeable: anything user-visible should flow
  through the common `claude:event` stream, not be special-cased per backend.
- Spec phase order and the `.kraken/specs/<id>/{spec.json,*.md}` on-disk shape are load-bearing;
  changing them affects `createSpec`, `advanceSpec`, `readSpec`, and `listSpecs` together.
- Agents/skills follow Claude Code's exact format and precedence (workspace overrides global
  on name conflict) — don't invent a parallel format.
- **Docs are part of "done".** Any change to architecture, the IPC contract, the data model, or a
  subsystem must update the matching `docs/*.md` in the same change (see the Documentation rule
  above and `docs/README.md`).
