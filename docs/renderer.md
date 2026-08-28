# Renderer (`src/`)

React 18 + Tailwind + Zustand. The renderer talks to the backend **only** through
`window.kraken.*` (see [`ipc-contract.md`](./ipc-contract.md)). There is no global state outside
the Zustand stores.

## The four-surface shell

The app is **four singleton surfaces** — Home, Spec, Activity, Library — selected by a slim
4-icon left nav (`SurfaceNav`). There is **no tab bar and no focus mode**. Everything else renders
as a drawer or a slide-over on top of the active surface:

- the **Assistant** (chat) — right drawer, ⌘J (`AssistantDrawer` → `ChatPanel`)
- the **Explorer** (file tree) — left slide-over, ⌘⇧E (`ExplorerDrawer` → `ExplorerView`)
- the **overlay** — right slide-over for detail views (`OverlayPanel`): file / agent / skill /
  run viewers, Open Questions, the hook editor, and the global **repo panel**
  (`SourceControlView variant="page"`), opened from the top bar's project·branch pill.

Home, Activity, and Library stay mounted (display-toggled) so terminals keep their PTYs and lists
keep scroll position; the Spec flow mounts per spec (`key={activeSpecId}`).

**Second entry point — the Travel Display.** `src/main.tsx` branches on `win.isWideRenderer()`
(`location.hash === '#wide'`): the main window renders `App`, but the optional wide second window
(opened by the main process onto a secondary display) renders `src/components/wide/WideApp.tsx`
instead — a compact, read-only fleet monitor mirroring the `orchestrator` registry. The CommandBar
carries the toggle (a `MonitorSmartphone` icon reflecting open state) and ⌘K has an *Open Travel
Display* command. See [`subsystems.md`](./subsystems.md) → Travel Display.

```
App                      (the dark FRAME: title bar + icon rail + canvas; panels float on it)
├─ CommandBar          title bar: centered project pill (opens the ⌘K palette), then compact
│   └─ CommandPalette    status controls — live-runs pill (→ Activity), branch (→ repo overlay),
│                        model·backend (→ Library › Settings), theme + Assistant toggles.
├─ SurfaceNav          brand tile + 4 icons: Home · Spec · Activity · Library (running badge).
├─ main
│   ├─ HomeView        launchpad: composer that CREATES specs (Plan / Quick Plan), in-flight
│   │                  spec cards, Shipped list, Manage mode (embeds SpecsStudio), first-run
│   │                  "Set up defaults" card.
│   ├─ SpecFlow        one continuous guided flow per spec (stepper → gate bars → inline tasks
│   │                  → Build). See "The spec flow" below.
│   ├─ ActivitySurface the single "what's running" center: Runs (OrchestratorView) · History
│   │                  (HistoryView) · Terminals (panes stay mounted) · Graph (AgentGraphView).
│   └─ LibrarySurface  left sub-nav → Agents / Skills / Hooks / Steering / Routing / Appearance
│                      (SyntaxStudio) / Settings — the consolidated config shell.
├─ AssistantDrawer     (⌘J, resizable via ResizeHandle; width persisted)
├─ ExplorerDrawer      (⌘⇧E)
└─ OverlayPanel        (esc closes)
```

## Stores (`src/stores/`)

### `workspace.ts` — `useWorkspace`
The loaded project. Holds `root`, `tree` (file `DirEntry[]`), and the lists `specs`, `skills`,
`agents`, `steering`, `hooks`. Actions: `openWorkspace`, `pickWorkspace`, `restoreLast`,
`refreshAll`, `createSpec`, `deleteSpec`, `seedDefaults`. This is the entry point — most views read
from here and call `refreshAll()` after a mutation.

### `chat.ts` — `useChat`
The Assistant session's single conversation: `messages`, `busy`, `currentRequestId`, `selectedAgent`,
and `pendingPrompt`. Actions: `push`, `appendDelta(id, text, channel?)`, `finish(id)`,
`fail(id, error)`, `clear`, `setBusy(b, requestId?)`, `setSelectedAgent`, `setPendingPrompt`.
`pendingPrompt` is a **cross-component handoff**: Home's composer routes question-shaped input
(ends with `?`) here (and opens the Assistant); `ChatPanel` watches it and, once idle, sends it.
`appendDelta` is **channel-aware**: it keeps a flat `content` string *and* builds
`segments: MessageSegment[]` — consecutive same-channel deltas merge, while `tool`/`tool_result`
chunks each become their own segment. `ChatPanel` renders assistant messages from `segments`
(see [`backends.md`](./backends.md) → Delta channels).

### `ui.ts` — `useUi`
The shell state. `surface: 'home' | 'spec' | 'activity' | 'library'` plus per-surface state:

- **Spec**: `activeSpecId` + `specStage` (`'define' | 'plan' | 'build'`, mapped from the
  spec's phase by `stageForPhase`);
  `openSpec(specId, stage?)` navigates (use `stageForPhase(phase)` to land on the right stage).
- **Activity**: `activityTab` (`'runs' | 'history' | 'terminals' | 'graph'`), `openActivity(tab?)`.
- **Library**: `librarySection` (`'agents' | 'skills' | 'hooks' | 'steering' | 'routing' |
  'appearance' | 'settings'`), `openLibrary(section?)`.
- **Drawers**: `assistantOpen`/`toggleAssistant` (+ persisted `assistantWidth`), `explorerOpen`.
- **Overlay**: `overlay: Overlay | null` with `openOverlay`/`closeOverlay` — the discriminated
  union `{kind: 'file'|'agent'|'skill', path}` / `{kind: 'run', runId}` /
  `{kind: 'questions', specId}` / `{kind: 'hook', hookId?}` / `{kind: 'repo'}`.
- **Terminals**: `terminals: TerminalSession[]` + `activeTerminalId` with
  `addTerminal(profile)` / `closeTerminal` / `setActiveTerminal` — sessions are store-level so the
  PTY-hosting panes can stay mounted app-wide (the session id doubles as the PTY id).
- `composerNonce`/`focusComposer()` — ⌘K "New spec…" jumps to Home and focuses the composer.

### `orchestrator.ts` — `useOrchestrator`
**The global registry of every in-flight run** — chat, spec drafting, audits, and wave tasks all
`startRun` / `finishRun` here, each tagged with a `RunKind` + human `title`. Decoupled from
`chat.busy`. Holds `runs: Record<requestId, ActiveRun>`, a recent-activity `log: FinishedRun[]`,
and `maxConcurrency` (1–8). Selectors: `runningCount()`, `taskRunningCount()` (task/refine/polish
only — so chat/spec runs don't throttle wave scheduling), `activeForTask(taskId)`.
It has exactly **one full rendering** — Activity › Runs — plus lightweight indicators (the top-bar
pill, SurfaceNav badge, in-situ task-row chips). **Concurrency has one control**, shown in two
mirrors of the same store field: the tasks-board header and Activity › Runs.

### `models.ts` — `useModels`
Model routing collapsed to two knobs: the global default model (Settings, persisted in the main
process) and an optional **`planningModel`** for the thinking-heavy steps (requirements / plan /
tasks / audit). `modelFor(step)` returns the planning model for those steps when set, else
`undefined` (inherit the global default). Persisted to `localStorage`.

The *selectable* list is **discovered, not hardcoded**: `refresh(workspacePath)` calls
`models:list` and stores the result in `available` (sorted `api` → `cli-config` → `catalog`) plus
the raw `discovery` for the UI's provenance note. `SettingsView` re-runs it on workspace change
and after the API key changes, and renders a per-entry source chip. See
[`backends.md`](./backends.md) → Model discovery for why there's no CLI probe.

### `moduleConfig.ts` — `useModuleConfig`
Routing/skill config, persisted to `localStorage` and pushed into the pure agent router via
`setRouterConfig` on every change — so chat, task, and hook runs all pick it up with **no IPC
change**. The scoring weights (`workspaceBonus`, `specialistThreshold`, `localFirst`,
`domainSkillThreshold`) are **invisible defaults** now — they live in `DEFAULTS` with no UI. What
the UI exposes (Library › Routing › Advanced): per-action agent **pins** (`pinnedAgents`) and one
"auto-inject matching skills" toggle (sets `skillInjection` + `domainSkillInjection` together;
`disabledSkills` is managed from the Skills section). `ROUTABLE_ACTIONS` is the canonical list of
pinnable steps.

### `syntax.ts` — `useSyntax`
Configuration for **file-viewer syntax highlighting** (localStorage-persisted): the active color
`theme`, installed extra **languages**, and `lineNumbers` / `wrap` prefs. Surfaced by
Library › **Appearance** (`SyntaxStudio`). See **File viewer & syntax** below.

### `theme.ts` — `useTheme`
The active visual palette (`signal` [default] | `abyss` | `bioluminescent` | `daylight`); persists
to `localStorage` and writes `document.documentElement.dataset.theme`. The `CommandBar`'s contrast
button cycles it.

## Layout & space (`styles.css` → "Layout primitives")

Kraken is a desktop window that ranges from ~1100px to ultrawide, so **surfaces are expected to
use the width they're given**. Content picks one of three fluid containers by content type — never
a hardcoded `max-w-[720px] mx-auto`:

| Class | For | Behaviour |
| --- | --- | --- |
| `.k-wide` | Dashboards, lists, settings, tables | Fills up to `--k-wide-max` (1680px), fluid `--k-gutter` |
| `.k-read` | Long-form markdown | Bounded by **reading measure** (`--k-read-max`, 78ch), not pixels |
| `.k-full` | Code / source / diff views | Edge-to-edge, padding only |

Plus three helpers:

- **`.k-cards`** — auto-fitting grid (`repeat(auto-fill, minmax(min(100%, var(--k-card,320px)), 1fr))`).
  This is the main space win: columns are *added* as the window grows instead of one column
  stretching. Override the minimum per call site with `style={{ '--k-card': '340px' }}`.
- **`.k-split`** — primary + aside, collapsing to one column below 1180px (`--k-aside` sets the
  rail width). Used by Activity › Runs (running grid + activity log).
- **`.k-listpane`** — master pane in the Library studios, `clamp(240px, 22vw, 380px)` instead of a
  fixed 300px on every display.

`.k-scroll` marks the scroller. **Rules:** wide content (tables, code) scrolls inside its own
`overflow-x: auto` container so a surface never scrolls horizontally; long-form prose stays on
`.k-read` because unbounded line length is a regression, not a win.

When adding a surface, reach for these rather than inventing a width. Sidebar-era components
reused as surfaces must be re-laid-out, not wrapped in a fixed centred box — that mistake is what
`OrchestratorView` and `HistoryView` were fixed for.

## Theming (`styles.css` + `tailwind.config.cjs`)

The whole app re-skins by swapping one attribute. Every Tailwind colour token is defined as
`rgb(var(--x) / <alpha-value>)`, where `--x` is a **space-separated RGB channel triple**. The
channel values live in `styles.css` under the four `data-theme` blocks. The visual language is
**frame + floating panels** (Kiro-style): `--rail` is the near-black app FRAME (title bar, icon
rail, canvas), `--bg` (`ink-950`) is the interior of a floating panel, and panels are separated
from the frame by rounded corners + a hairline `ring-ink-50/[0.07]` rather than borders. The
legacy `ink-*` scale is remapped onto the surfaces (`--bg`→`ink-950`, `--panel`→`ink-900`,
`--card`→`ink-850`, `--elev`→`ink-800`, `--line`→`ink-700`, …); semantic tokens (`card`, `elev`,
`rail`, `panel`, `dim`, `faint`, `good`, `warn`, `danger`, `accent`/`accent-2`) sit alongside, and
`--accent-fg` is themeable. Surfaces stay neutral grey — the purple lives only in the accent.
Fonts: body **Hanken Grotesk**, display **Space Grotesk** (`font-display`), mono **JetBrains
Mono**. Animations include `flow` (progress shimmer), `pulse-dot`, and `slide-in` (the overlay
panel). When adding a colour, add a channel var to **all four** theme blocks and a token in the
Tailwind config.

### Signal — the brand palette (default)

`signal` comes from the Claude Design system *"Paleta y Tokens"* and is the theme the rebranding
targets. Its rules differ from the Kiro-style themes above and are load-bearing:

- **Two accents, one role each.** Green `#76B900` = *execute & progress* (primary buttons,
  progress bars, the running dot, checks). Violet `#9B6BFF` = *agent, wait & decide* (the "it's
  waiting on you" banner, agent chips, medium priority). **Never both on the same control**, and
  violet never on a button that executes work.
- **Green is fill-only.** It measures 2.41:1 on white, so as text it is forbidden — use
  `text-accent-text` (`#A6E62E`) on grey, `text-accent-num` (`#C4F06A`) for the running timer, and
  `--accent-fg` (`#0F1400`) as the only ink on a green fill.
- **Brand grey, never black.** `--rail` `#1A1A1A` → `--bg` `#1E1E1E` → `--panel` `#232323` →
  `--card` `#2A2A2A`, plus `--raised` `#262626` for the active task / "up next".
- **Contrast floor `#A8A8A8`** (`--faint`): no interface text goes darker; mono labels ≥ 11px.
- **Radius 0, no shadows.** Hierarchy is a lighter grey plus a 1px accent border.
- **Fonts**: Space Grotesk for UI *and* display (set on `:root[data-theme='signal']`), JetBrains
  Mono for labels, metadata and timers.

Two token families exist for this: `accent-text` / `accent-num` alongside `accent`, and the whole
`agent` family (`agent`, `agent-2`, `agent-text`, `agent-tint`, `agent-fg`) plus `raised` and
`danger-text`. The legacy themes were built around a single accent, so there `agent-*` aliases the
accent — semantics only separate under Signal.

**Shape is themed too.** `borderRadius` in `tailwind.config.cjs` maps to `--radius-*`, so
`rounded-lg` is 8px on Abyss and 0 on Signal. `rounded-full` is deliberately *not* tokenised (dots,
avatars, circular pills stay circular); flattening those is a per-component pass. Shadows
(`shadow-panel` / `shadow-glow` / `shadow-card`) are **not** themed yet — see
`docs/refactor-metodologia-y-rebranding.md` § B1.

## Brand (Octopus Brand Kit)

The brand mark is the octopus from the **Octopus Brand Kit** (claude.ai/design project
"Octopus logo animation"). It carries fixed brand colors independent of the theme palettes:
cyan rim gradient `#00BBDD→#003973`, deep-sea body `#001A33→#000A14`, visor eyes `#7DF3FF`;
the light colorway (flat `#003973`, `#00BBDD` eyes) is auto-selected on the Daylight theme.

- **`KrakenLogo`** (`components/KrakenLogo.tsx`) — the mark. Props: `animated` (bobbing body +
  staggered tentacle sway + eye scan), `glow` (pulsing cyan drop-shadow, dark colorway only),
  `variant: 'auto' | 'dark' | 'light'` (`auto` follows `useTheme`). Gradient ids are
  instance-unique via `useId`. The natural aspect is 4:5 (viewBox `40 24 120 150`) — size
  containers accordingly (e.g. `w-4 h-5`).
- **`KrakenLoader`** (`components/KrakenLoader.tsx`) — the kit's "reading code" loader: animated
  mark over a scrolling code shimmer + three pulsing dots. Props: `size sm|md|lg`, `label`,
  `showCode`. Used for blocking states (e.g. Ship's summary generation); tiny inline button
  spinners stay `Loader2`.
- **Keyframes** (`octo-bob`, `octo-tent-sway`, `octo-eye-scan`, `octo-code-scroll`,
  `octo-dot-pulse`, `octo-glow-pulse`) live in `styles.css` under "Brand", alongside
  **`.octo-tile`** — the app-tile background behind the mark (nav rail, welcome hero), which
  swaps to the kit's white tile on Daylight.
- **Boot splash** — `index.html` ships a static `#boot-splash` overlay (inline copy of the
  keyframes so it animates before the bundle loads); `App.tsx` fades and removes it once
  `restoreLast()` settles (min ~900 ms so it doesn't flash). Keep the two keyframe copies in sync.
- **App icon** — `resources/icon.svg` is the master; `npm run icon` rasterizes it to
  `resources/icon.png` with Electron itself (`scripts/render-icon.mjs`, no external SVG tooling).
  electron-builder converts the PNG per platform (`buildResources: resources`); `main.ts` sets the
  dev dock icon (macOS) and the win/linux window icon from the same PNG.
- Live-state touchpoints use the animated mark instead of a spinner: the Assistant "Working…"
  bar and streaming avatar (`ChatPanel`), the spec drafting banner (`SpecFlow`), "Task in
  progress" (`TaskRunner`), and the Runs header (`OrchestratorView`).

## Home (`views/HomeView.tsx`)

The launchpad. Its **composer creates specs** (the old Welcome bar only forwarded to chat):

- **Plan** (`lib/specActions.ts` → `planSpec`) — creates the spec (name via `specNameFromText`,
  kind via `specKindFromText` feature/bugfix detection), opens the Spec flow, and streams the
  requirements draft while the user watches. Gated flow.
- **Quick Plan** (`quickPlanSpec`) — the no-gates escape hatch: drafts requirements → plan →
  tasks back-to-back (advancing between), landing on Tasks ready to run.
- Input ending in `?` routes to the Assistant instead (`chat.pendingPrompt`); `/` and `@`
  popovers still pick skills/agents.

Below: **In flight** spec cards (kind stripe, live run count from the orchestrator, phase
progress, Resume → `openSpec(id, stageForPhase(phase))`), **Shipped** recents (open the Build
stage), a **Manage** toggle that embeds `SpecsStudio` (analytics + per-spec runs/timeline +
delete), and a one-time **"Set up Kraken defaults"** card that calls `workspace.seedDefaults()`
(replaces the per-module Seed buttons; dismissal persisted in `localStorage`).

## The spec flow (`views/SpecFlow.tsx`)

One continuous guided surface per spec — the whole lifecycle on one screen, framed like an
editor (Kiro-style): **file tabs** (`requirements.md` / `plan.md` / `tasks.md`, accent-underlined,
locked stages dimmed), a mono **breadcrumb** (`.kraken › specs › <id> › <file>.md`, which shows
`summary.md` while the Ship panel is open), and the **spec strip** (`Spec: <name>` + numbered
phase chips: ① Requirements ② Plan ③ Build). The tab row also carries save status, the
doc **view switcher** (Source · Cards · Edit), and **one overflow menu** (Audit · Surface open
questions · Reopen tasks/Re-sync · Delete spec). Stage bodies:

- **Doc stages** (requirements/bugfix, plan) default to **Source** — the document as
  line-numbered, markdown-highlighted source (`SourceDoc`) — with `SpecDocument` section cards
  and raw `MarkdownEditor` as the other views, above a pinned **gate bar**:
  `[✎ Revise with feedback…] [✦ Improve with Claude] [Approve <stage> → <next>]`. **Approve
  advances the phase AND navigates** to the next doc (`specs.advance` + `setSpecStage`). An empty
  doc shows **Draft with Claude** instead; already-approved stages show **Continue →**. Revise
  runs `draftSpecDoc({feedback})`; **Improve** runs `draftSpecDoc({improve: true})` — a critical
  self-review pass (per-doc checklist in `IMPROVE_FOCUS`) that refines the file in place and
  reports its improvements in the Assistant. Neither needs a trip to chat. A "Claude is drafting…" banner appears whenever an
  orchestrator run with `source: 'spec:<file>'` is live for this spec (covers drafts started from
  Home / Quick Plan too).
- **Tasks** renders `TaskRunner` — waves **inline in the document** as mono task blocks along an
  indent guide, each with a Kiro-style inline action line (**Start task** / *Task in progress* /
  ✓ Completed · Refine / Blocked-by) above the literal `[ ] T1: …` line. The header is a progress
  line (`7/12 tasks · wave 2/4 · n running` + bar), the **single concurrency stepper**, and the
  primary CTA **Run all** (autopilot) with **Improve plan** (the tasks.md self-review pass) /
  Run next / Run wave / Stop / Unblock alongside. Clicking a block opens `TaskInspector`.
- **Ship** (`views/ShipView.tsx`) — the automatic payoff, and **a panel inside the Build stage,
  not a stage of its own**. Until the spec is `done` there is nothing to ship, so nothing shows;
  once the last task completes `TaskRunner` auto-advances the spec to `done` and a `Task list` /
  `Ship` switcher appears at the top of Build, already on Ship (autopilot's own advance lands
  here too via a phase-transition watcher). Reopening tasks (Re-sync) sends the switcher back to
  the task list. `CompletionSummary` **auto-generates** the recap on
  arrival (`auto` prop; persisted to `<spec>/summary.md`) and reports its text up; below it, the
  ship actions: create branch (`feat/<specId>` when on main/master) → **Commit all** (message
  prefilled from the summary, pushes when an origin exists) → **Create PR** (title/body prefilled;
  needs a GitHub token) → View PR. Plus **Polish** (`polishSpec` in `specActions.ts`) and Reopen
  tasks. All existing `git:*` / `github:*` IPC; branch/commit/PR state still writes back into
  `SpecMeta`.

`lib/specActions.ts` is the shared drafting layer (extracted from the old SpecEditor hooks):
`draftSpecDoc({meta, files, file, brief?, feedback?, improve?})` returns a promise that resolves when the
run finishes, so `quickPlanSpec` can chain phases; `planSpec`, `polishSpec`,
`specNameFromText`, `specKindFromText`, `firstStageFile` round it out. All of it streams through
the same chat/orchestrator registration as before.

## Activity (`views/ActivitySurface.tsx`)

The single command center for "what's running". Tabs: **Runs** (`OrchestratorView`: a full-width
status strip with Stop all + the concurrency control, live runs as a `.k-cards` grid, and the
recent-activity log in a `.k-split` side rail), **History** (`HistoryView`: stat tiles plus a
**table** of runs — prompt / agent / backend / duration / when — scrolling inside its own
container; rows open the run viewer in the overlay), **Terminals** (session chips + panes;
`TerminalView` instances stay mounted app-wide via the `ui.terminals` store so PTYs survive
navigation), and **Graph** (`AgentGraphView`).

## Library (`views/LibrarySurface.tsx`)

The consolidated background-config surface: a left sub-nav mounting one studio per section.
The old dual rail-panel/studio split is gone — only the full-page studios exist. Shared chrome
stays in `ModuleShell.tsx`; helpers in `lib/library.ts`.

- **Agents** (`AgentsStudio`) / **Skills** (`SkillsStudio`) — unchanged studios; "Open file"
  buttons now open the overlay viewers.
- **Hooks** (`HooksStudio`) — hook cards; edit/new opens `HookEditor` in the overlay.
- **Steering** (`SteeringStudio`) — unchanged.
- **Routing** (`RouterStudio`) — the **read-only "why was this agent chosen" explainer**: the
  routing playground (real `explainRoute` + ranked candidate scoring) plus a collapsed
  **Advanced** disclosure with the per-step agent pins and the single skill-injection toggle. The
  old tuning steppers, concurrency duplicate, and embedded live panel are gone.
- **Appearance** (`SyntaxStudio`) — file-viewer color themes + installable languages.
- **Settings** (`SettingsView variant="page"`) — regrouped: Connection (backend + API key + CLI
  status), Models (global model + **planning model**), Repository (project directory + GitHub
  token), Advanced (permissions + MCP servers). The Orchestration section (concurrency) and
  model-per-step grid were removed.

## Agent routing — `src/lib/agentRouter.ts`

Content-aware selection of which installed agent runs a piece of work. **Precedence:** per-task
`@agent` → chat override → **user pin** → best-matching installed specialist (workspace-scope
bonus; task execution is local-first) → bundled default → generic. `routeAgent` returns a
`RouteReason`. The scoring weights come from `useModuleConfig` via `setRouterConfig` — they are
constants by default with no UI. `scoreAgents` / `explainRoute` expose the full decision and power
Library › Routing's playground and the task-row "why" popovers.

## Skill injection — not just labels

`SkillMeta.body` carries the full `SKILL.md` text. `skillSystemBlock` / `skillSystemBlocks`
build prompt blocks prepended to the system prompt. The SDD skill (`sdd-feature` / `sdd-bugfix`)
governs spec drafting and task runs; `bestSkillByText` additionally injects a confident
domain-skill match. Chat `/skill` injects too. Injection is gated by `useModuleConfig`
(one visible toggle + per-skill `disabledSkills` from the Skills section); enforcement lives in
`routeSkill` / `bestSkillByText`. `src/lib/verifyLibrary.ts` resolves a chosen agent/skill back to
the installed file for the `LibBadge` chips (which open the overlay viewers).

## File viewer & syntax highlighting (`views/FileViewer.tsx`)

Opens in the **overlay** (from the Explorer drawer, steering docs, LibBadge, etc.). Resolves the
language via `detectLanguage` and highlights with `prism.ts` (lazy `ensureLanguage` for installed
extras; one-click **Install `<lang>`** banner otherwise). Toolbar: theme picker, line-numbers +
wrap, and a link to Library › Appearance. Colors are scoped as `--syn-*` vars on `.code-view`.

## Other `src/lib` helpers

- `tasks.ts` — parse `tasks.md` checklists, per-task `@agent`, waves/dependencies.
- `specSections.ts` — parse a requirements/plan doc into section cards (consumed by `SpecDocument`).
- `specActions.ts` — the shared drafting/plan/polish layer (see "The spec flow").
- `markdown.ts` / `prism.ts` / `fileLang.ts` / `syntaxThemes.ts` — rendering + highlighting.
- `graphModel.ts` — the agent-graph data layer (`indexRuns`/`verifyRun`, run-grouping taxonomy).
- `library.ts` — module-studio helpers (slug/paths, scaffolds, `buildAction`, `actionsRoutingTo`).
- `openQuestions.ts` — parse/mutate the `## Open Questions` section.
- `cn.ts` — `clsx` class-name helper.

## Agent Graph

`AgentGraphView` (Activity › Graph) is a `@xyflow/react` flow chart of every run for the selected
spec, grouped by kind: wave columns for task execution plus one labeled swimlane per `RunGroup`
(spec/hook/audit/chat) with toggle chips. Clicking a node opens its `DetailDrawer`.

## Open Questions module

`QuestionsView` (overlay `kind: 'questions'`) manages the requirement file's `## Open Questions`
— stream a suggested answer, edit, resolve, reopen, delete; **Apply to requirements** folds the
Q&A into `## Resolved Decisions` (see [`data-model.md`](./data-model.md#open-questions-format)).
The Spec flow's overflow menu has **Surface open questions**, which extracts questions from the
requirements prose (deduped) and opens this overlay.

## Keeping open editors in sync with agent writes

Agents edit files on disk from many places — the Assistant, a hook, the orchestrator — not just a
view's own action. The fix pattern, used by `SpecFlow`: subscribe to `claude.onEvent` and reload
the file from disk on **any** run's `done`/`error`, guarded by a `dirtyRef` so an in-flight local
edit is never clobbered. Apply the same pattern to any new viewer that shows an agent-writable file.

## Conventions

- After a backend mutation, refresh the relevant store list (`refreshAll()` or a targeted reload)
  rather than mutating local state optimistically — disk is the source of truth.
- A viewer that displays an agent-writable file should reload it on Claude run completion.
- New detail views = a new `Overlay` kind (in `ui.ts`) + a case in `OverlayPanel`.
- New config surfaces = a new `LibrarySection` + a section in `LibrarySurface` (+ a
  `CommandPalette` entry so ⌘K can reach it). Think twice before adding a fifth surface.
- Run indicators outside Activity must stay *views* (a pill, a badge, a chip that deep-links),
  never a second list of runs.
