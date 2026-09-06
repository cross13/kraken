# Data Model

Octo has **two sources of data**, kept deliberately separate:

1. **Specs on disk** (per-workspace markdown) — the **source of truth** for SDD content.
2. **SQLite** (`octo.db`, app-level) — a global, queryable **mirror + telemetry log** of
   specs, phase events, and every Claude run. Never the source of truth.

Shared TypeScript shapes live in **`electron/shared/types.ts`** (imported by both main and
renderer; keep dependency-free).

## Specs on disk

A spec is a **directory** under the workspace at `.octo/specs/<id>/`:

```
.octo/specs/<id>/
  spec.json        # SpecMeta-ish: phase + metadata (load-bearing shape)
  requirements.md  # feature specs   (or bugfix.md for bugfix specs)
  plan.md          # the technical plan, incl. its `## Tasks` waves
  tasks.md         # DERIVED from plan.md at the Plan gate — the live, tickable copy
```

- **Phase order is fixed and load-bearing:** `requirements → plan → build → done`
  (`SpecPhase`). `plan` and `build` were called `design` and `tasks` before the methodology
  refactor; a spec written by an older version is migrated in place on first read
  (`migrateSpecDir` in main.ts renames `design.md` → `plan.md` and rewrites `spec.json`), and the
  DB mirror is migrated once at startup (`migrateSpecPhases` in db.ts, guarded by
  `PRAGMA user_version = 2`, which rebuilds `specs` because its `phase` CHECK cannot be altered
  in place). `advanceSpec` walks this order and **lazily creates the next phase's document
  file** if missing. `requirements.md` / `bugfix.md` / `plan.md` are created **empty**; only
  `tasks.md` has a template, and only as a fallback for a spec advanced without a usable
  `## Tasks` (the Plan gate blocks that in the UI, but hooks and Quick Plan advance too).
- **`tasks.md` is derived, not authored.** Approving the Plan gate copies `plan.md`'s `## Tasks`
  section into `tasks.md` verbatim (`tasksDocFromPlan` in `electron/shared/planTasks.ts`, shared
  with the renderer so the gate can refuse a plan that has no usable task list). From then on the
  two are allowed to diverge: **the plan is the intent, `tasks.md` is the state** the runner ticks.
  Nothing syncs backwards — the **Audit** action (`spec-doctor`) is what surfaces the drift.
  `tasksTemplate` remains only as the fallback for a spec advanced without a task list (hooks and
  Quick Plan advance without passing through the gate).
- **User stories** carry `US-n` ids by the same convention as the criteria's `AC-n`, and a
  criterion that names its story (`US-2`) links to it exactly instead of by wording — see
  [`renderer.md`](./renderer.md) → Review, the requirements side.
- **Kind** is `'feature' | 'bugfix'` (`SpecKind`). Feature specs start at `requirements.md`;
  bugfix specs at `bugfix.md` (with explicit *Unchanged Behavior* regression guards).
- Changing the phase order or the `{spec.json, *.md}` shape affects `createSpec`, `advanceSpec`,
  `readSpec`, and `listSpecs` **together** — touch them as a set.

`SpecMeta` (the in-memory + IPC shape) also carries `brief` — the user's original one-liner from
the Home composer, passed to `specs:create`. Creating a spec starts no Claude run, so the brief
has to be persisted: it is quoted at the top of the seeded `requirements.md`/`bugfix.md` and
re-sent as grounding when the user later presses *Draft … with Claude*. Plus optional git/GitHub
workflow state written back by the Source Control panel: `branch`, `committedAt`,
`lastCommitHash`, `lastCommitPushed`, `prNumber`, `prUrl`, `prState`.

## Starting clean

Library › Settings › **Danger zone** (`DangerZone` in `SettingsView`, IPC `data:reset`) wipes the
data the SDD loop produces so a workspace can restart on the current methodology: the spec folders
under `.octo/specs` (plus anything stranded in a pre-rename `.kraken/specs`) and the mirrored
history rows — scoped to this workspace or to every workspace. Deletion order matters: `errors`
and `run_files` go before `runs` (they are matched by `workspace_path` **or** `run_id`, so rows
written before `workspace_path` existed don't survive as orphans), all inside one transaction,
followed by `VACUUM`.

What it deliberately leaves alone: settings and secrets (`electron-store` + `safeStorage`), and
everything under `.claude/` and `.octo/{hooks,steering}`. Losing those is losing your setup.

## Tasks format

`tasks.md` uses GitHub-style checklists. A task can specify a per-task agent:

```
- [ ] T1 @frontend-dev: Build the settings panel
- [ ] T2: Wire it to the IPC handler
```

Parsing lives in `src/lib/tasks.ts`; agent precedence (per-task `@agent` > chat override >
action default) is in `src/lib/agentRouter.ts`. See [`subsystems.md`](./subsystems.md).

The line parser tolerates markdown emphasis the model sometimes adds around the id
(`- [ ] **T1**: …`, `__T1__`, fully-bold lines) — the markers are stripped so the id, `@agent`,
and description still resolve. The drafting prompt and `spec-planner` agent also instruct the
plain `- [ ] T1: …` form, so new task lists come out clean without manual cleanup.

## `plan.md` anatomy (Cursor-style)

The plan is the document the user actually reads, so its shape is fixed. It is now asserted in
**two** places, not three, and **neither of them is a template**. Specs now start with empty
documents: a skeleton of `<placeholder>` tokens reads as content the moment it is on screen, hides
whether anything has been written, and is the first thing a draft has to delete. The shape is
stated by the Plan drafting prompt in `src/lib/specActions.ts` (which has to state the minimum,
because skill injection can be switched off) and in full by the **`spec-plan-format` skill**. The
`spec-planner` agent no longer restates any of it — it carries judgement and points at the skill.
New rules go in the skill.

| Section | What it holds |
|---|---|
| `> objective` blockquote | one line + appetite (S/M/L) + risk |
| `## Approach` | one mermaid diagram, then the strategy and the alternatives rejected |
| `## Affected files` | `\| File \| Change \|` with real `path:line` references |
| area sections (`## Backend changes` / `## Frontend changes`, renamed to the repo's real boundaries) | the changes grouped **by area of the codebase**, with contracts written as literal code (exact type, SQL with its default, IPC signature) rather than prose |
| `## Key implementation details` | defaults, formats, ordering, edge cases, error states |
| `## Risks & rollback` | `\| Risk \| Mitigation \| How to revert \|` |
| `## Verification` | every acceptance criterion → how it is proven |
| `## Tasks` | the dependency-ordered waves — **load-bearing**, see above |
| `AC-n` citations | not a section: the requirement ids written **into** the rows, bullets and task lines that satisfy them |
| `## Open Questions` | decisions only the user can make |
| `## Critical Decisions` | **appended during Build**, not authored |

Only `## Tasks` is parsed (`extractTasksSection`); the rest is prose contract between the
drafting prompt and the reader — with one soft convention on top: acceptance criteria are numbered
`AC-1`, `AC-2`, … in the requirements, and a plan that writes those ids into the section or task
that satisfies them gets **confirmed** coverage in the Review view instead of coverage inferred
from wording (`lib/specTrace.ts`, [`renderer.md`](./renderer.md) → Review). Nothing breaks without
them; the trace just falls back to guessing. Extraction stops at the next H2, so sections may be appended
after `## Tasks` freely.

**`## Critical Decisions` keeps the plan alive.** A task run that deviates from the plan — a
different data shape, an extra file, a rejected approach — appends
`### Critical Decision — T3: <title>` (what / why / what it affects) to the end of `plan.md`
instead of silently drifting; the executor and refine prompts in `TaskRunner.tsx` carry that
rule, and `spec-doctor` audits the section against the rest of the plan. Task runs never touch
the plan's `## Tasks` section.

**The Plan step clarifies before it drafts.** If a decision would materially change the plan and
`## Resolved Decisions` doesn't answer it, the drafting run appends 1–4 questions to the
requirement file's `## Open Questions` and stops **without writing `plan.md`** — the user answers
them in the Open Questions overlay, presses *Apply to requirements*, and re-runs the draft. It
asks once: with a `Resolved Decisions` section present it drafts and records its own defaults.
Revise, Improve and Quick Plan runs pass `noStops`, which disarms the round entirely.

## Open Questions format

Spec files (requirements/bugfix and plan) carry a `## Open Questions` section. The
`QuestionsView` module manages it; markdown stays the source of truth. Convention (parsed by
`src/lib/openQuestions.ts`):

```
## Open Questions
- [ ] How should we handle rate limiting?
  - Token bucket in main — no dependency, resets on restart
  - Redis-backed — survives restarts, adds a service
- [x] What is the default concurrency? — **Resolved:** Default 2, max 8.
```

An unchecked item is **open**; a checked item is **resolved**, with its answer after a
`— **Resolved:**` marker on the same line. Resolving a question rewrites its line in place;
adding one appends a `- [ ]` item (creating the section if absent).

**Indented items under a question are its answer options** — the pre-loaded choices the Clarify
step turns into one-click chips. They are plain list items (any `**A.**` / `A)` / `1.` label the
model adds is stripped on parse), they survive resolve/reopen so a decision can be revisited, and
deleting a question deletes them with it. A question with no options still works: the UI falls
back to free text.

The `QuestionsView` module is anchored to the **requirement file** (`requirements.md` /
`bugfix.md`) — questions are read from and written to that doc so they feed the plan phase.
Once answered, **Apply to requirements** folds the resolved Q&A into a `## Resolved Decisions`
section (idempotent replace, via `writeDecisionsSection`):

```
## Resolved Decisions
<!-- Generated from Open Questions — settled answers that inform the design. -->
- **What is the default concurrency?** — Default 2, configurable up to 8.
```

The plan-generation prompt reads `requirements.md` and treats `Resolved Decisions` as settled
inputs, so question answers flow forward into the plan. The presence of that section is also what
the Spec flow uses to decide whether approving Requirements lands on **Clarify** or straight on
`plan.md` (see [`renderer.md`](./renderer.md) → Clarify).

## SQLite schema (`electron/db.ts`)

App-level DB at `app.getPath('userData')/octo.db` (better-sqlite3). Tables use
`CREATE TABLE IF NOT EXISTS`, so schema changes to existing tables need a migration, not just
an edited `CREATE`. Tables:

| Table | Purpose | Key columns |
| --- | --- | --- |
| `specs` | Mirror of on-disk specs | PK `(workspace_path, id)`; `name`, `kind`, `phase`, `fs_path`, `created_at`, `updated_at` |
| `spec_events` | Phase-advance audit trail | PK `id`; `workspace_path`, `spec_id`, `event_type`, `from_phase`, `to_phase`, `file`, `metadata`, `created_at` |
| `runs` | Every Claude invocation | PK `id`; workspace context (`workspace_path`, `spec_id`), timing (`started_at`, `ended_at`, `duration_ms`), invocation (`backend`, `model`, `agent`, `source`, `status`, `prompt`, `system`, `response`, `error`), routing/audit cols (`skill`, `skill_scope`, `route_reason`, `agent_scope`, `kind`, `task_id`, `wave`, `depends_on`), execution cols (`command`, `tools`, `permission_mode`, `model_source`, `resolved_model`) |
| `errors` | Categorized error log | PK `id`; `run_id`, `workspace_path`, `category`, `message`, `details`, `created_at` |
| `run_files` | Files a run touched | PK `id`; `run_id`, `workspace_path`, `path`, `tool`, `op`, `count`, `first_at`, `last_at`; UNIQUE `(run_id, path, tool)` |
| `hook_runs` | Hook-triggered run log | PK `id`; `workspace_path`, `hook_id`, `trigger`, `run_id`, `spec_id`, `status`, `created_at` |

Rows are surfaced to the renderer as typed `*Row` interfaces in `shared/types.ts`
(`RunRow`, `ErrorRow`, `RunFileRow`, `RunFileCount`, `SpecEventRow`, `HookRunRow`, …), read via
the `history` IPC namespace. `specRunStats(root)` returns a `SpecRunStat[]` aggregate (one row per
`spec_id`: `runs`, `errors`, `cancelled`, `total_duration_ms`, `last_run_at`) for the Spec Manager.

**Deleting a spec** (`deleteSpec`, exposed via `specs:delete`) is a single transaction that clears
every table for that `spec_id` — `errors`/`run_files` for its runs, then `runs`, `spec_events`,
`hook_runs`, and finally the `specs` row — since there are no FK cascades between these tables.

`beginRun` inserts a row as `running`; `finishRun` settles it to `done`/`error`/`cancelled`. If
the app closes mid-run that row never settles, so `initDb` runs a **startup reconciliation** that
flips any leftover `running` row to `cancelled` (no run can be in flight at startup). Without it,
the agent graph would treat the stale row as live and spin a finished task forever.

### Adding a column / table

1. Add the `CREATE`/`ALTER` to the `SCHEMA` array (or a migration step) in `db.ts`.
2. Add/extend the writer + reader helpers in `db.ts` (e.g. `beginRun`, `appendRunResponse`,
   `listRuns`).
3. Update the matching `*Row` type in `shared/types.ts`.
4. Surface it via a `history:*` (or relevant) IPC handler + preload method if the renderer needs it.
5. `npm run typecheck`.

## Other shared types worth knowing

- `ClaudeStreamEvent` — `{ requestId, type: 'delta'|'done'|'error', text?, error?, channel? }`, the
  unit of the streaming protocol. `channel` (`StreamChannel` = `'text' | 'thinking' | 'tool' |
  'tool_result'`) tags delta events so the renderer can render thinking/tool output distinctly;
  it defaults to `'text'`.
- `RunKind` — `'task' | 'refine' | 'polish' | 'chat' | 'spec' | 'audit' | 'hook'`; tags every run
  in the orchestrator registry and the DB.
- `ActiveRun` / `FinishedRun` — the in-flight and recent-activity shapes used by the orchestrator
  store. See [`renderer.md`](./renderer.md).
- `HookConfig`, `HookTrigger`, `HookFireContext`, `HookFireEvent`, `HookRunRow` — hooks.
- `SteeringFile` (incl. `editable`), `SteeringInclusion`, `SteeringWriteInput` — steering. Pinned
  doc names are persisted per workspace in `electron-store` under `steeringPins`
  (`Record<workspacePath, string[]>`) — force-included in every run.
- `SeedReport` — what one `*:create-default` or `workspace:seed-upgrade` run did (`created` /
  `upgraded` / `kept`, keys like `agents/spec-planner.md`). The hash of the default Octo last
  wrote to each path is persisted in `electron-store` under `seededDefaults`
  (`Record<absolutePath, hash>`) — that ledger, plus the bundled `SHIPPED_DEFAULT_HASHES`, is what
  lets seeding tell an untouched default (safe to upgrade) from the user's own file (never
  touched). Because the ledger is per-machine, the constant is the only signal that survives a
  clone, so it must list every shipped body (`npm run hashes`). `seededLibraryVersion`
  (`Record<workspacePath, number>`) records `LIBRARY_VERSION` at the last on-open upgrade pass and
  lets it skip entirely. See [`subsystems.md`](./subsystems.md) → Agents & Skills.
- `GitHubRepoInfo`, `GitHubTokenStatus`, `PullRequestMeta`, `GitHubOpResult<T>` — GitHub.
- `ModelInfo`, `ModelDiscovery`, `ModelOrigin` — model discovery. `ModelOrigin`
  (`'api' | 'cli-config' | 'catalog'`) records **how Octo learned about a model**, and is
  distinct from `ModelSource` (`explicit | settings-default | cli-default | api-default`), which
  records **how a given run resolved its model**. Don't conflate them. Nothing is persisted —
  discovery is recomputed on demand.
