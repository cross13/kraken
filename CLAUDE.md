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
npm run routes       # per-task agent routing table; `-- --check` fails on a wrong pick
npm run hashes       # SHIPPED_DEFAULT_HASHES for the current bundled bodies; `-- --check` in CI
npm run package:mac  # build + electron-builder --mac --dir
```

There is **no test runner and no linter** configured. `npm run typecheck` is the only
automated gate for the code; always run it after edits. Two invariants it cannot see have their
own scripts, and both should pass before declaring done: **`npm run routes -- --check`** (a stray
word in an agent's `description` silently hijacks every task run) and
**`npm run hashes -- --check`** (an unlisted default body never reaches a cloned workspace).

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
  walks the fixed order `requirements → plan → build → done` and lazily creates the next
  phase's file if missing. **Documents start empty** — a `<placeholder>` skeleton reads as
  content, hides whether anything has been authored, and is the first thing a draft has to
  delete; the shape lives in the drafting prompts and the `spec-*-format` skills instead. Only
  `tasksTemplate` survives, as the fallback when a spec is advanced without a usable `## Tasks`.
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
- **Default library** — the content lives in **`electron/defaultLibrary.ts`** (dependency-free,
  so `npm run hashes` can import it with Node's TS stripping); `seedDefaultAgents`/`Skills`/
  `Steering`/`Hooks` write it into `.claude/` and `.octo/` ("Seed defaults" in the UI). It ships
  12 agents, 6 skills, 3 steering scaffolds and 3 hooks. Seeding is an **upgrade**, not just a
  first install: `seedDefaultFile` (`electron/seedDefaults.ts`) rewrites a default the user never
  edited — recognised via the `seededDefaults` hash ledger plus the bundled
  `SHIPPED_DEFAULT_HASHES` — and leaves any edited file untouched, returning a `SeedReport`
  (`created`/`upgraded`/`kept`). **The hash constant is not optional bookkeeping:** the ledger is
  keyed by absolute path on one machine, so for a cloned repo that constant is the only thing that
  can tell a default from an edit. Run `npm run hashes` after changing any body;
  `npm run hashes -- --check` fails when one is missing. `workspace:seed-upgrade` runs the same
  seeders with `upgradeOnly` on workspace open — it updates an existing library but never installs
  one unasked — guarded by `LIBRARY_VERSION` / `seededLibraryVersion` so the usual open costs
  nothing.

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
  with four palettes (Signal [default, the brand], Abyss, Bioluminescent, Daylight) selected by `<html data-theme>`
  (see `docs/renderer.md` → Theming). `--accent-fg` is themeable; fonts are Hanken Grotesk (body) /
  Space Grotesk (`font-display`, headings only) / JetBrains Mono, **bundled** via
  `@fontsource-variable/*` (no CDN — the CSP allows no remote origin) with the stacks defined once
  as `--font-sans` / `--font-display` / `--font-mono`. Markdown code and the spec editor take their
  syntax colours from the theme tokens; only the file viewer uses the selectable `--syn-*` palette. The visual language is **frame + floating
  panels** (Kiro-style): `--rail` is the near-black app frame, surfaces float on it as rounded
  panels with a hairline ring; greys are neutral and the purple lives only in the accent.
- **The brand mark *is* the mascot.** There is one drawing in the app — the chibi octopus samurai
  (`wide/OctoMascot.tsx`) — at three levels of detail: `full` (≥64px), `simple` (40–64px) and
  `mark` (14–26px). **`components/OctoMark.tsx`** wraps the `mark` level and is the mark
  everywhere in the main window (nav rail, Assistant, spec flow, task runner, runs header, Home's
  hero, `OctoLoader`, the boot splash); it defaults to the colony's `work` face and takes
  `state` where it stands for a **run** rather than for the app, `animated={false}` (→ `.k-still`)
  where it should hold completely still. There is no separate logo component — the old `OctoLogo`
  was removed. Size it with a **width class only**. The app icon (`resources/icon.svg`, rasterised
  by `npm run icon`) is now the **same creature**, inverted onto a green Signal tile — at 32px in a
  dock a dark tile with a thin rim disappears, so the icon is the palette's primary-button
  treatment. Its rounded corner is the one exception to Signal's radius 0: that silhouette is
  imposed by macOS, not chosen. **`0ct0` is the wordmark** (the two zeros bracket the creature;
  the trailing zero's green bar is the kabuto's brim) while `octo` stays the identifier everywhere
  in code and on disk — `.octo/`, `window.octo`, `dev.octo.app` — so the relaunch moves no files.
  The sheet is in `design/brand/`. See `docs/renderer.md` → Brand.
- **Layout** is the **four-surface shell** (`App.tsx`): `CommandBar` (brand + ⌘K
  `CommandPalette` + the one live-runs pill + project/model status) → `SurfaceNav` (4 icons) →
  one of **Home · Spec · Activity · Library**, plus the **Assistant** chat drawer (⌘J,
  `AssistantDrawer`), the **Explorer** drawer (⌘⇧E), and a right slide-over **`OverlayPanel`**
  for detail views (file/agent/skill/run viewers, Open Questions, hook editor, the repo panel).
  There is **no global tab bar and no focus mode** — surfaces are singletons. **Quick Start**
  (`views/QuickStart.tsx`, ⌘K or the first-run card, auto-opened once on a new install) is a
  full-window mode like Zen: a setup checklist verified against real state, the loop explained, tips
  specific to how the app behaves, and a *Sharpen your own skills* section that points Claude at the
  user's installed skills and rewrites them in place. **Home** (`HomeView`) is
  **a board**: its composer **creates specs** (`lib/specActions.ts` — **Plan** creates the spec
  and opens it with **no run started**, keeping the composer text as `SpecMeta.brief` for the
  explicit *Draft … with Claude* action; **Quick Plan** drafts both docs with no stops;
  `?`-suffixed input goes to the Assistant), over **Entrada** (`TicketInbox` — the open tickets,
  **one lane per tracker** plus a *Ya con spec* lane pairing each covered ticket with its spec)
  beside **three phase columns** (Requirements · Plan · Build), with shipped work on a collapsed
  **Entregado shelf** — `done` is not a column. A column's rule is coloured by its *contents*
  (green = corriendo, violet = te espera), so the board says where you are needed before a card is
  read. Clicking a ticket **arms** it and only the two legitimate entry points light up:
  Requirements (`planSpecFromTicket`, gated) and Build (`quickPlanSpecFromTicket`, hands-off);
  `plan` is never a drop target because a spec cannot start in the middle. **Gestionar** is a
  switch over the board, not a screen — checkboxes on the cards and a bulk bar that **confirms the
  delete in place** (naming `.octo/specs/<id>` + the mirrored run history) instead of
  `window.confirm`, while each card's `⋯` deletes one without entering the mode. *Analíticas*
  deep-links to **Activity › Specs** — the board starts and deletes work, the run history is a
  question about *runs* and lives with them. The library-upgrade and one-time "Set up Octo
  defaults" notices are one-line strips. **Spec** (`SpecFlow`) is one continuous guided flow
  framed like an editor: file tabs (`requirements.md`/`plan.md`/`tasks.md`) +
  breadcrumb + the spec strip (numbered phase chips: Requirements → Plan → **Build**),
  doc stages as line-numbered **Source** (default) / section **Cards** / **Review** (the default on both
  authored docs: on plan.md the acceptance criteria beside the plan, selecting one lights the
  sections, tasks and files that satisfy it — `SpecReview` + `lib/specTrace.ts`, which reads `AC-n`
  citations and falls back to block-level vocabulary matching; on requirements.md/bugfix.md the
  criteria grouped under the user story they answer, with EARS-form and untestable-wording checks
  and the stories nothing covers — `RequirementsReview` + `lib/reqReview.ts`) / raw **Edit** — a labelled
  segmented control, plus ⌘E and double-click-to-edit, shown only while a document is on screen —
  beside it **Zen** (⌘⇧Z, `ZenReader` + `lib/zenDoc.ts`), the full-window reading mode: the flow's
  chrome gone, one column at a reading measure, an ambient contents spine that follows the scroll,
  a Focus dim, and **every id in an 84px left gutter** (`AC-3`, `T1`, the story a criterion
  answers) instead of as a chip inside the sentence — with the gate's Approve at the *end* of the
  document rather than in permanent chrome — and, beside the document itself, the **stage
  briefing** aside (`StageBriefing`, toggled from the toolbar, `ui.specAsideOpen`): the mascot in
  the colony's own states (`work` drafting / `think` with questions open / `sleep` idle), the agent
  the router *will* pick for this step with the reason it picked it, the skills that get injected
  and what each contributes, and the real mechanics of the step — the same `explainRoute` the
  Routing playground runs, shown where the decision actually lands —
  over a **gate bar** whose *Approve* advances the phase **and navigates** (*Revise with feedback*
  re-drafts inline; *Improve with Claude* runs a critical self-review that refines the doc in
  place — every step has one, incl. *Improve plan* on Tasks). Approving **Plan** derives
  `tasks.md` from the plan's `## Tasks` section, and refuses when there isn't one. The plan itself
  follows the Cursor Plan Mode shape (diagram → affected files → changes **by area** with literal
  contracts → waves) and **clarifies before drafting**: the Plan stage has two sub-tabs, **Clarify**
  and `plan.md`, and approving Requirements lands on Clarify (`QuestionsView variant="stage"`) —
  every question a card with **pre-loaded options** as one-click chips (1–9 from the keyboard),
  *Other…* for free text and *Ask Claude* to pick one; *Apply decisions* writes
  `## Resolved Decisions` and drafts the plan. A Plan run started elsewhere that hits an unsettled
  decision writes its questions into `## Open Questions` and stops instead of guessing (once only;
  Revise/Improve/Quick Plan pass `noStops`), which flips the stage back to Clarify. Tasks render as
  **inline task blocks**
  with Kiro-style Start-task actions
  (`TaskRunner` engine, Run all = autopilot as the primary CTA) under Build's own sub-tabs
  (`Task list` · `tasks.md` · `Ship`), and **Ship** (`ShipView`) as a panel *inside* Build — the automatic payoff:
  the spec auto-advances to `done` when the last task completes, `CompletionSummary`
  auto-generates into `summary.md`, and branch/Commit all/Create PR sit right there. **Activity**
  (`ActivitySurface`) is the single "what's running" center (Runs = `OrchestratorView`, History,
  **Specs** = `SpecsStudio`, the per-spec run analytics, Terminals, Graph). **Library** (`LibrarySurface`) consolidates config: Agents · Skills · Hooks ·
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
  playground. The bundled bench a task can land on is `frontend-expert` / `backend-expert` /
  `database-expert` / `docs-expert`, and **their front-matter `description` is load-bearing**:
  scoring reads only `name + description`, and `IMPLEMENTER_SIGNALS` is appended to *every* task's
  keywords, so one stray substring (`implement` inside "implementation", `app` inside "approved")
  makes an agent clear the threshold on every task and beat `spec-task-executor` outright. A
  specialist's description uses only its own `CAPABILITY_TAGS` vocabulary. **`npm run routes` is
  the guard** — nothing here type-checks, and this repo has no test runner.
- **Skills are injected, not just labelled.** `SkillMeta.body` carries the full `SKILL.md`
  text; `skillSystemBlock`/`skillSystemBlocks` build prompt blocks that are prepended to the
  system prompt. Three selectors, all in `agentRouter.ts` so the injection toggle and
  `disabledSkills` apply in one place: `routeSkill` picks the SDD skill (`sdd-feature`/
  `sdd-bugfix`, by spec kind — three stages, two gates) that frames the stage and its gates;
  **`routeFormatSkill` picks the document-format skill** (`spec-requirements-format`,
  `spec-bugfix-format`, `spec-plan-format`, `spec-tasks-format`) that carries the literal shape
  Octo's parsers demand — injected into every spec-drafting run and, as `tasks`, into task runs,
  which edit `tasks.md` and `plan.md`'s Critical Decisions; and `bestSkillByText` adds a confident
  domain match on task runs. Chat `/skill` injects that skill's body too. **The format skills are
  the source of truth for document shape** — the drafting prompts in `specActions.ts` keep only
  the minimum contract (injection can be switched off) and the bundled agents carry judgement, not
  format. The Running-Tasks **Library verification** panel resolves the chosen agent/skill back to
  the installed file (root `.claude/` vs global) so you can confirm what's actually in use.
- **Markdown is a trust boundary, not just a formatter.** `lib/markdown.ts` feeds
  `dangerouslySetInnerHTML`, and its sources include text the app did not author — a tracker
  ticket's description and comments, run transcripts, agent/skill bodies from an opened workspace.
  marked passes raw HTML through and does not reject `javascript:` hrefs, so the renderer overrides
  `html` (escape), `link` and `image` (scheme allowlist + escaped attributes). Don't remove those
  overrides, and don't build HTML from document text anywhere else. See `docs/renderer.md` → The
  renderer is a trust boundary, and `docs/security-review.md`.
- **`lib/formatCheck.ts`** turns those same parsers into a deterministic check, rendered as a strip
  above the gate bar, splitting findings into mechanical (one correct answer → *Fix with Claude*)
  and needing judgement. It is not a hook on purpose: `file-save-in-app` fires on the 400 ms editor
  autosave and never after a Claude draft. See `docs/renderer.md` → Format check.

### Persistence — `electron/db.ts` (better-sqlite3)
App-level history DB at `app.getPath('userData')/octo.db`. Tables: `specs`, `spec_events`
(phase-advance audit trail), `runs` (every Claude invocation with prompt/response/status/
duration), `errors`, `hook_runs` (hook-triggered run log). This is global telemetry, separate
from the per-workspace spec markdown — specs on disk are the source of truth; the DB is a
queryable mirror + run log.

### Tickets — trackers over MCP (`electron/mcpClient.ts` + `electron/tickets.ts`)
A small dependency-free **MCP client** (stdio + Streamable HTTP; credentials in `safeStorage`, as
either a manual `Authorization` value or an OAuth record — separate store slots, because the token
slot goes straight into the header) plus **OAuth 2.1** in `electron/mcpAuth.ts` (RFC 8414 discovery,
dynamic registration as a public client, PKCE S256, **ephemeral** loopback redirect created per
attempt, refresh within 60s of expiry). `tickets:sign-in` stays pending until the redirect lands, so
there is no push channel. Presets: `tracker`, `jira` (**pinned** tool names in
`electron/shared/jira.ts` — heuristic discovery would repoint a write capability at a read tool),
and `generic`
plus a translation layer from "a moment in a spec's life" to tool calls. Two rules: **every write
is a `TicketAction` (`{tool, args, summary}`) shown before it is sent** — `tickets:plan` builds,
`tickets:apply` sends — and **mappings are discovered, not hardcoded**: `discoverToolMap` matches
Octo's capabilities against the server's own `tools/list`, correctable in Library › Tickets. The
`tracker` preset is written against that server's real schema; anything else uses `generic`.
What's pending is derived from **spec state**, not from events firing (`lib/ticketSync.ts` reads
phase + `meta.branch` + `meta.prUrl` + `meta.ticket.applied[]`), so nothing is lost to a closed
app and no write happens twice. **Home's composer is not the only way in**: `TicketInbox` lists what is open across the
trackers under *What should we build?*, and picking one runs `planSpecFromTicket` — the ticket
becomes the spec's `brief` and the link is written at creation, so nothing has to be reconciled
later. `normalizeTicketList` is deliberately forgiving about response shape — it unwraps Jira's
`fields` envelope and flattens **ADF** rich text (`adfText`), without which a Jira row matches
nothing but `key` and its description never reaches the spec's brief — and fills `TicketSummary`'s
optional `status`/`statusLabel`/`priority`/`type`/`assignee`/`group`/`labels`/`updated`/`url` so a
card shows what the tracker actually sent and nothing more; "not done" is filtered
client-side because no two trackers agree on the status enum. Each tracker wears its own mark and
hue (`lib/trackerBrand.tsx`, **the one place colour escapes the theme** — a brand hue cannot be
themed without ceasing to identify the thing it names). **Reading a ticket costs nothing**: `tickets:detail` reads one through the `get` capability into a
`TicketDetail` (description, the plan it already carries + approval state, criteria, comments,
history) and `TicketDetailView` shows it in the right slide-over, so deciding whether a ticket is
the work you think it is no longer requires creating a spec to find out. UI: `TicketsStudio`
(Library › Tickets) + `TicketInbox` (Home) + `TicketPanel` (compact in the spec briefing aside,
full in Ship). See `docs/subsystems.md` → Tickets.

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
primary CTA) runs all waves autonomously, waiting for blocking hooks between waves. A task run
that deviates from the plan appends `### Critical Decision — T3: …` to `plan.md`'s
`## Critical Decisions`, so the plan never drifts from the code. When the last
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
`WideApp` instead of `App`. The window is **one colony**: every run in flight is an octopus — a
**chibi samurai** (`wide/OctoMascot.tsx` — the same drawing the app's brand mark is made of,
drawn entirely from theme variables so it re-skins with the app) — and everything the creature
does means something: the **zone** it lives in is its spec,
its **position** is whether it's moving (live work up top, blocked work sleeping lower-right), the
dashed violet **leash** is what it waits on (`dependsOn`), its **face** is the status (blinking /
violet-deciding / `zzz` queued / happy done / crossed-out failed), **its katana's pose is the
verb** (cutting · sheathed · resting · *chiburi* · driven into the ground), and its **speech
bubble** is the tool it's running right now (parsed back out of the live `tool` delta).
`detail="simple"` drops the armour's fine work below ~40px. A **reef** below keeps the last finished runs; the
header has the task-slot meter and a **quiet toggle** (`.k-quiet`, default-on under
`prefers-reduced-motion`) that freezes every colony animation. Clicking a creature opens its full
run detail on the left with the colony compressed beside it (*Esc* to go back).
State is **one-directional**: the main window is authoritative and pushes a serialized
`FleetSnapshot` (`{runs, maxConcurrency}` from the `orchestrator` store) via `fleet:push` →
forwarded over `fleet:sync`; the travel window is a **read-only mirror** that cancels through the existing
`claude:cancel`. Because the main window only pushes on *change*, the main process caches the last
snapshot and replays it into a freshly-opened travel window (on `did-finish-load`, and on the
renderer's own `fleet:request` pull — the two race). IPC:
`window:{toggle-wide,is-wide-open,wide-state,focus-main}` + `fleet:{push,request,sync}`. Teardown
is guarded (closing the main window or unplugging the display closes it).
See `docs/subsystems.md` → Travel Display.

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
