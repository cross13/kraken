# Subsystems

Feature-specific subsystems that layer on top of the core. Each follows the same IPC pattern;
this doc explains the behavior and where the code lives.

## Agents & Skills

Octo reads agents and skills in **Claude Code's exact format and precedence** — don't invent a
parallel format.

- **Locations:** agents are flat markdown in `.claude/agents/*.md`; skills are a directory per
  skill at `.claude/skills/<name>/SKILL.md` — both in the workspace plus `~/.claude/` (global).
- **Symlinks count.** Skill managers (`npx skills add …`) install into `~/.agents/skills/<name>`
  and drop a **symlink** in `~/.claude/skills/`, and `readdir(withFileTypes)` reports a symlink as
  neither a directory nor a file. `listSkills` therefore accepts `isDirectory() || isSymbolicLink()`
  and lets the `SKILL.md` probe (which follows the link) decide. `listAgents` needs no equivalent:
  it filters on the `.md` suffix and `readFile` follows links on its own.
- **Precedence:** workspace overrides global on a name conflict.
- **Seeding:** `seedDefaultAgents` / `seedDefaultSkills` (main) write the bundled SDD agent/skill
  markdown into the workspace's `.claude/` dirs ("Seed defaults" in the UI; `*:create-default`
  IPC).
- **Skills are injected, not just labelled** — `SkillMeta.body` (the `SKILL.md` text) is prepended
  to the system prompt. See [`renderer.md`](./renderer.md) → Skill injection.
- The bundled SDD skill is `sdd-feature` / `sdd-bugfix` (by spec kind). `spec-task-executor` is
  the bundled task agent; `spec-doctor` is routed by the **Audit** action for drift detection.
- **`spec-planner` replaced `spec-design-architect` + `spec-task-planner`** when the design and
  task documents merged into `plan.md`. The old two are **not re-seeded**, but they are kept in the
  router's preference list after `spec-planner`, so a workspace that seeded them before keeps
  working — `seedDefaultAgents` never overwrites an existing file either.

## Hooks — event-driven agent hooks

Fire Claude runs automatically on app-level events.

- **Config:** JSON files in `.octo/hooks/*.json` (+ global `~/.octo/hooks/`), shape =
  `HookConfig`. Action types: `'ask-claude' | 'run-command'`.
- **Triggers** (`HookTrigger`): spec-advance, spec-done, file-save-in-app, task-complete,
  wave-complete, manual.
- **Engine:** `maybeFireHooks(trigger, ctx)` is called at trigger points — `advanceSpec` →
  spec-advance/spec-done; `writeSpecFile` → file-save-in-app; the TaskRunner → task-complete /
  wave-complete; plus manual. `fireHook` reuses `streamClaude` (so hook runs appear in History)
  via `getMainSender()`.
- **Loop guard:** hook runs write through the **CLI, not the `fs:write` IPC**, so they can't
  retrigger file-save hooks; plus a per-hook **cooldown** (`hookCooldown`).
- **Defaults:** `seedDefaultHooks` ships `code-validate-improve` (wave-complete) and
  `docs-changelog` (spec-done).
- **NL authoring:** `hooks.generateFromNl(root, description)` asks Claude to draft a hook config.
- **UI:** `HooksView` (sidebar) + `HookEditor` (tab). Run log in the `hook_runs` table; live
  events on the `hook:event` channel (`hooks.onEvent`).

## Steering — project context injection

- **Source:** markdown in `.octo/steering/*.md` (+ global), **plus** root `AGENTS.md` /
  `CLAUDE.md` as implicit `always` context.
- **Inclusion modes** (`SteeringInclusion`): `always | fileMatch | manual | auto`.
- **`composeSteeringSystem`** resolves which files apply and is prepended to `payload.system`
  **inside `streamClaude`** — so every run (chat, task, hook) gets steering uniformly. A doc whose
  name is in `manualRefs` (i.e. **pinned**) is force-included regardless of its mode.
- **Pins** — the user can pin any doc to force-include it in every run. Pins are persisted per
  workspace via `electron-store` (`steeringPins`) and merged into `manualRefs` inside
  `streamClaude`, so **no per-call-site change** is needed for pins to apply everywhere.
- **CRUD + preview IPC:** `steering:list`, `steering:create-default`, `steering:write`
  (create/update a frontmatter `.md`, handles rename via `prevPath`), `steering:delete` (guarded to
  `.octo/steering` only — root `CLAUDE.md`/`AGENTS.md` are read-only), `steering:preview`
  (returns the exact injected block for given file hints + pins), `steering:get-pins` /
  `steering:set-pins`. `SteeringFile.editable` flags whether a doc can be edited/deleted.
- **UI:** the full-page **`SteeringStudio`** (`views/SteeringStudio.tsx`) — Library tab (list +
  editor: name, description, inclusion mode, fileMatch glob, scope, body, pin) and an Injection
  Preview tab. Mounted at Library › Steering (also reachable via ⌘K).

## Multi-agent orchestration

- **Stores/UI:** `src/stores/orchestrator.ts` + `views/TaskRunner.tsx` (waves inline in the
  Spec flow's Tasks stage) + `OrchestratorView` (Activity › Runs).
- Tasks in a wave run as **parallel concurrent Claude subprocesses** (one `requestId` each),
  capped by `maxConcurrency` — one control, shown on the tasks board and Activity › Runs.
- The `orchestrator` store is the global run registry; `taskRunningCount()` (task/refine/polish
  only) governs wave scheduling so chat/spec runs don't throttle it.
- **Per-task agents:** `- [ ] T1 @agent-name: …` (parsed in `tasks.ts`; precedence in
  `agentRouter.ts`).
- `runWave` / `pump` schedule with **failure isolation**. **Autopilot** ("Run all") runs all
  waves autonomously, waiting for blocking hooks between waves and advancing to `done` at the end.
- When the last task completes the spec **auto-advances to `done`** and the flow lands on the
  **Ship** stage (auto-generated summary + commit/PR). `specs:set-phase` reopens a phase
  (Re-sync). The **Audit** action routes to `spec-doctor`.
- The top bar and SurfaceNav show a live running-count badge; Activity › Runs shows live agents
  with elapsed time + per-run / stop-all cancel and the activity log.

## Git & GitHub

- **`electron/git.ts`** — per-workspace git helpers (status, branches, checkout, create-branch,
  commit/push, pull/fetch, stage/unstage) surfaced through `git:*` IPC. All return
  `{ ok, error?, output, … }` result objects.
- **`electron/github.ts`** — a **dependency-free** GitHub REST client. Token via `safeStorage`
  (same pattern as the API key). Exposed through `github:*` IPC: repo resolution from the `origin`
  remote, token validation, remote-branch listing (the valid PR base targets), and PR
  list/create/merge. Returns `GitHubOpResult<T>`.
- **UI:** the **Source Control** sidebar panel (`SourceControlView`) drives both. It is
  **spec-aware** — it reads the active editor tab's spec for branch/commit/PR defaults and writes
  branch/commit/PR state back into `SpecMeta` (`branch`, `lastCommitHash`, `prNumber`, …). Current
  project + branch also show in `TitleBar` / `StatusBar`, which deep-link into this panel. The
  New-PR dialog's base-branch field is a searchable typeahead (`BranchCombobox`) backed by
  `github.listBranches(cwd)`, defaulting to the repo's actual default branch. The dialog also has a
  **Generate with Claude** button that streams a PR description from the spec's content
  (`source: 'pr-description'`, registered in the orchestrator) straight into the body field.

## Terminals — interactive PTY sessions

Unlike `claude:stream` (one-shot `-p`, fire-and-forget, no stdin), terminals are a **fully
bidirectional** channel. This is what lets the user answer Claude's `AskUserQuestion`, respond to
permission prompts, and run real CLI slash commands — exactly as in a normal terminal.

- **`electron/terminal.ts`** — `TerminalManager` owns the live `node-pty` processes keyed by
  `termId`. It only manages lifecycle (`create`/`write`/`resize`/`kill`/`killAll`); the main
  process owns the policy. node-pty loads from its **N-API prebuilt binary** (ABI-stable across
  Node and Electron — no from-source rebuild), and the module restores the `spawn-helper`
  executable bit on load (a common prebuild gotcha that otherwise fails every spawn with
  `posix_spawnp failed`). Packaged builds unpack it via `asarUnpack` (see `package.json` build
  config) so the binary + helper are spawnable.
- **`createTerminal()` in `main.ts`** resolves the spawn policy: `profile: 'shell'` runs the
  user's login shell; `profile: 'claude'` runs the real `claude` binary (resolved via
  `detectCli()`, falling back to a shell if not found). Env always uses `expandedPath()` + `TERM`,
  cwd defaults to the workspace root. Wires `onData`/`onExit` to the renderer over `terminal:data`
  / `terminal:exit`. `mainWindow` `'closed'` → `terminals.killAll()`.
- **IPC:** `terminal:create` (invoke), `terminal:write` / `terminal:resize` / `terminal:kill`
  (send), data/exit event channels. See [`ipc-contract.md`](./ipc-contract.md) → `terminal`.
- **UI:** `TerminalView` (xterm.js + fit + web-links addons) renders each terminal; sessions
  live in the `ui` store and render under **Activity › Terminals** (session chips + *Terminal* /
  *Claude session* buttons; also creatable from ⌘K). Panes are **kept mounted (display-toggled)**
  so the PTY survives navigation — unmounting kills the shell. See [`renderer.md`](./renderer.md).
- **Open in Chrome:** the web-links addon routes URL clicks to `shell.openUrl`, and the window
  open-handler does the same, so any http(s) URL a session emits opens in Google Chrome (falling
  back to the default browser).

## Travel Display — a wide second window (`main.ts` window section + `WideApp`)

A compact, height-frugal **fleet monitor** for a secondary ultrawide bar display (e.g. a Corsair
Xeneon Edge, ~2560×720). It shows what's running at a glance while the main window keeps its full
layout on the primary screen — handy when travelling with a second display.

- **Window lifecycle (`main.ts`):** `createWideWindow()` creates a single `frame: false` second
  `BrowserWindow` (`wideWindow`), loading the same renderer bundle with a `#wide` hash
  (`…#wide` in dev, `loadFile(…, { hash: 'wide' })` packaged). `pickTravelDisplay()` uses the
  `screen` module to choose a **non-primary** display (favouring a very-wide one, `aspect > 3`)
  and fills its `workArea`; with no secondary display it falls back to a compact wide bar on the
  primary so the mode is still usable/testable. `toggleWideWindow()` opens or closes it.
  `notifyWideState()` broadcasts `window:wide-state` (`{ open }`) to the **main** window so the
  CommandBar toggle stays in sync. Teardown is guarded: closing the main window destroys the
  travel window (no orphan), and `screen`'s `display-removed` closes it if its display is unplugged.
- **State sync is one-directional.** A separate window is a separate renderer with its own
  Zustand stores, so they can't share memory. The **main window is authoritative**: an effect in
  `App.tsx` subscribes to the `orchestrator` store and pushes a serialized `FleetSnapshot`
  (`ActiveRun[]`) via `fleet.push` (throttled ~250 ms, plus once on mount); the main process
  forwards it to the travel window over `fleet:sync`. The travel window is a **read-only mirror** —
  it never runs its own `startRun`/`finishRun`.
- **Live log mirror.** Beyond the registry snapshot, `emit()` also forwards each `claude:event`
  (delta/done/error, all channels) to the travel window when one is open, so its detail column can
  show what each agent is actually doing in real time. This is additive — the main window still
  receives the same events; the travel window just accumulates them per `requestId`. As a
  **fallback**, `WideApp` also polls `history.getRun(requestId)` for the selected run: the DB
  mirrors every run's streamed `response` (and the exact `command`/`tools`/`permission_mode`), so
  the log fills in even for runs that started before the window opened or already finished — the
  travel window works whether or not the live forward is reaching it.
- **UI (`src/components/wide/WideApp.tsx`):** the renderer entry (`src/main.tsx`) branches on
  `win.isWideRenderer()` to render `WideApp` instead of `App`. It's self-contained (no sidebar
  deps): a draggable status strip (brand + project/model + theme toggle + close) over a
  **master-detail** body — the run list on the left (in-flight + recent, kind badge, live elapsed,
  per-run ✕ cancel, *Stop all*), and the selected run's **agent parameters** (agent, model, kind,
  skill, source, spec, route reason, scope, wave, deps, requestId) plus its **live streamed log**
  (channel-styled text/thinking/tool/tool_result, auto-scrolling) on the right. Theme carries over
  automatically because `data-theme` is persisted in per-origin `localStorage` shared by both
  windows.
- **Crisp zoom.** A dense panel rendered ~1:1 (2560×720, `devicePixelRatio ≈ 1`) makes the compact
  UI hard to read. The header carries a zoom control (−/%/+, persisted to `octo.wideZoom`,
  defaulting off `devicePixelRatio`) wired to `win.setZoom`, which calls `webFrame.setZoomFactor`
  **directly in the preload** (zoom is a renderer concern — no main-process handler). `setZoomFactor`
  **re-rasterizes** the page at the new scale, so text stays sharp (unlike a bitmap upscale) while
  the layout still fits the window.
- **Cancellation** reuses the existing `claude:cancel` IPC directly (any renderer can call it) —
  there's no separate cancel channel. Cancelled runs finish in the main window, which pushes a
  fresh snapshot; the travel window also drops them optimistically for snappiness.
- **Entry points:** the CommandBar icon button (next to the theme toggle, reflecting open state)
  and the ⌘K command *Open Travel Display*, both calling `win.toggleWide()`.
- **IPC:** `window:toggle-wide` / `window:is-wide-open` / `window:wide-state` / `window:focus-main`
  and `fleet:push` / `fleet:sync`. See [`ipc-contract.md`](./ipc-contract.md) → `win` / `fleet`.
