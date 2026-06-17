# Subsystems

Feature-specific subsystems that layer on top of the core. Each follows the same IPC pattern;
this doc explains the behavior and where the code lives.

## Agents & Skills

Kraken reads agents and skills in **Claude Code's exact format and precedence** — don't invent a
parallel format.

- **Locations:** agents are flat markdown in `.claude/agents/*.md`; skills are a directory per
  skill at `.claude/skills/<name>/SKILL.md` — both in the workspace plus `~/.claude/` (global).
- **Precedence:** workspace overrides global on a name conflict.
- **Seeding:** `seedDefaultAgents` / `seedDefaultSkills` (main) write the bundled SDD agent/skill
  markdown into the workspace's `.claude/` dirs ("Seed defaults" in the UI; `*:create-default`
  IPC).
- **Skills are injected, not just labelled** — `SkillMeta.body` (the `SKILL.md` text) is prepended
  to the system prompt. See [`renderer.md`](./renderer.md) → Skill injection.
- The bundled SDD skill is `sdd-feature` / `sdd-bugfix` (by spec kind). `spec-task-executor` is
  the bundled task agent; `spec-doctor` is routed by the **Audit** action for drift detection.

## Hooks — event-driven agent hooks

Fire Claude runs automatically on app-level events.

- **Config:** JSON files in `.kraken/hooks/*.json` (+ global `~/.kraken/hooks/`), shape =
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

- **Source:** markdown in `.kraken/steering/*.md` (+ global), **plus** root `AGENTS.md` /
  `CLAUDE.md` as implicit `always` context.
- **Inclusion modes** (`SteeringInclusion`): `always | fileMatch | manual | auto`.
- **`composeSteeringSystem`** resolves which files apply and is prepended to `payload.system`
  **inside `streamClaude`** — so every run (chat, task, hook) gets steering uniformly.
- **UI:** `SteeringView`.

## Multi-agent orchestration

- **Stores/UI:** `src/stores/orchestrator.ts` + `views/TaskRunner.tsx` + sidebar
  `OrchestratorView`.
- Tasks in a wave run as **parallel concurrent Claude subprocesses** (one `requestId` each),
  capped by `maxConcurrency` (Settings → Orchestration, or the Orchestrator panel).
- The `orchestrator` store is the global run registry; `taskRunningCount()` (task/refine/polish
  only) governs wave scheduling so chat/spec runs don't throttle it.
- **Per-task agents:** `- [ ] T1 @agent-name: …` (parsed in `tasks.ts`; precedence in
  `agentRouter.ts`).
- `runWave` / `pump` schedule with **failure isolation**. **Autopilot** runs all waves
  autonomously, waiting for blocking hooks between waves and advancing to `done` at the end.
- `specs:set-phase` reopens a phase (Re-sync). The **Audit** action routes to `spec-doctor`.
- The ActivityBar and StatusBar show a live running-count badge; `OrchestratorView` shows live
  agents with elapsed time + per-run / stop-all cancel and the activity log.

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
