# Renderer (`src/`)

React 18 + Tailwind + Zustand. The renderer talks to the backend **only** through
`window.kraken.*` (see [`ipc-contract.md`](./ipc-contract.md)). There is no global state outside
the Zustand stores.

## Stores (`src/stores/`)

Five stores, each a `create<…>()` from Zustand. Components subscribe directly.

### `workspace.ts` — `useWorkspace`
The loaded project. Holds `root`, `tree` (file `DirEntry[]`), and the lists `specs`, `skills`,
`agents`, `steering`, `hooks`. Actions: `openWorkspace`, `pickWorkspace`, `restoreLast`,
`refreshAll`, `createSpec`, `seedDefaults`. This is the entry point — most views read from here
and call `refreshAll()` after a mutation.

### `chat.ts` — `useChat`
The chat panel's single conversation: `messages`, `busy`, `currentRequestId`, `selectedAgent`,
and `pendingPrompt`. Actions: `push`, `appendDelta(id, text, channel?)`, `finish(id)`,
`fail(id, error)`, `clear`, `setBusy(b, requestId?)`, `setSelectedAgent`, `setPendingPrompt`.
`pendingPrompt` is a **cross-component handoff**: the Welcome command bar calls `setPendingPrompt`
(and opens the chat panel); `ChatPanel` watches it and, once idle, sends it via `send(text?)` then
clears it. `ChatPanel.send` accepts an optional explicit text so the same path serves typed input
and handed-off prompts. The `claude.onEvent` handler routes streaming
deltas here by `requestId` for chat-kind runs. `appendDelta` is **channel-aware**: it keeps a flat
`content` string (history/persistence) *and* builds `segments: MessageSegment[]` — consecutive
same-channel deltas merge, while `tool`/`tool_result` chunks each become their own segment.
`ChatPanel` renders assistant messages from `segments`: prose as markdown, `thinking`/`tool_result`
as collapsible blocks, `tool` as a "Command" card (see [`backends.md`](./backends.md) → Delta
channels).

### `ui.ts` — `useUi`
Layout + tabs. `activity` (`ActivityTab` — the rail destination), `sidebarOpen`/`chatOpen` toggles,
`sidebarWidth`/`chatWidth` (clamped + persisted to `localStorage`), **`focusMode`** (+ `toggleFocus`
/ `setFocus`), and the editor **tab model**: `tabs: OpenTab[]`, `activeTabId`, with
`openTab`/`closeTab`/`setActiveTab`. **Focus mode** collapses the `SpecRail` + `ActivityStream` so a
step fills the screen; `openTab`/`setActiveTab`/`closeTab` auto-set it to `tab.kind === 'spec'` (a
spec step focuses; anything else restores the full shell), and the `CommandBar` / `SpecEditor` header
each expose a manual toggle. An
`OpenTab.kind` is one of `'spec' | 'summary' | 'source-control' | 'questions' | 'file' | 'agent' |
'skill' | 'welcome' | 'settings' | 'run' | 'hook' | 'graph' | 'terminal'` — this is what the
`EditorArea` switches on to pick a viewer (`'summary'` → the spec's completion/changed-files recap;
`'source-control'` → the full-page Source Control view; `'settings'` → the full-page Settings view).
Both Source Control and Settings open as full-page tabs (rail nav / command bar / ⌘K), not rail panels.
**Per-step model routing** lives in `stores/models.ts` (`useModels`, persisted): Settings → *Model per step*
maps each SDD step (requirements/design/tasks/task/refine/polish/audit/chat) to a Claude model id (or
Default), which the renderer passes as `payload.model` on the stream (CLI `--model` / API model) to
optimize spend. `lastSpecId` tracks the most recent spec tab
so spec-less surfaces (the Source Control page) can still resolve "the spec you're working on".
(`terminal` tabs also carry `termProfile: 'shell' | 'claude'`; the tab id doubles as the PTY id.)

### `orchestrator.ts` — `useOrchestrator`
**The global registry of every in-flight run** — chat, spec drafting, audits, and wave tasks all
`startRun` / `finishRun` here, each tagged with a `RunKind` + human `title`. Decoupled from
`chat.busy`. Holds `runs: Record<requestId, ActiveRun>`, a recent-activity `log: FinishedRun[]`,
and `maxConcurrency` (1–8). Selectors: `runningCount()`, `taskRunningCount()` (task/refine/polish
only — so chat/spec runs don't throttle wave scheduling), `activeForTask(taskId)`.

### `models.ts` — `useModels`
Per-step model routing (`StepKey` → model id), persisted to `localStorage`; the resolved id is
passed as `payload.model` on the stream. Backs Settings → "Model per step".

### `moduleConfig.ts` — `useModuleConfig`
**User-tunable configuration for the Agents / Skills / Orchestration modules**, persisted to
`localStorage` (same pattern as `models.ts`) and, crucially, pushed into the pure agent router via
`setRouterConfig` on every change (and on init) — so chat, task, and hook runs all pick it up with
**no IPC change**. Holds the routing knobs (`workspaceBonus`, `specialistThreshold`, `localFirst`),
per-action agent **pins** (`pinnedAgents`: action key → agent name), and skill-injection prefs
(`skillInjection`, `domainSkillInjection`, `domainSkillThreshold`, `disabledSkills`). Actions:
`set` (single key), `pinAgent`, `toggleSkill`, `reset`. `ROUTABLE_ACTIONS` is the canonical list of
pinnable steps. This is the single source of module configuration; the studios are just its UI.

### `syntax.ts` — `useSyntax`
Configuration for **file-viewer syntax highlighting** (localStorage-persisted): the active color
`theme` (a built-in id or a user-installed **custom** theme), installed extra **languages**, and
`lineNumbers` / `wrap` prefs. Actions: `setTheme`, `installTheme`/`removeTheme` (custom themes as a
flat 10-slot color map), `installLanguage`/`removeLanguage`, `setLineNumbers`/`setWrap`; selectors
`activeTheme()` (resolved colors) and `isInstalled(langId)`. See **File viewer & syntax** below.

### `theme.ts` — `useTheme`
The active visual palette. Holds `theme: 'abyss' | 'bioluminescent' | 'daylight'` (`abyss` default);
actions `setTheme` / `cycleTheme`. Persists to `localStorage` and writes
`document.documentElement.dataset.theme`, which swaps the CSS variables that back every colour token
(see **Theming** below). Applied once on store init so first paint matches the persisted choice. The
`CommandBar`'s contrast button cycles it.

## Theming (`styles.css` + `tailwind.config.cjs`)

The whole app re-skins by swapping one attribute. Every Tailwind colour token is defined as
`rgb(var(--x) / <alpha-value>)`, where `--x` is a **space-separated RGB channel triple**
(e.g. `--accent: 124 92 255`). This keeps Tailwind's `/opacity` modifiers working *and* makes
colour themeable. The channel values live in `styles.css` under `:root[data-theme='abyss']`
(default), `[data-theme='bioluminescent']`, and `[data-theme='daylight']`. The legacy `ink-*` scale
is remapped onto the design's surfaces (`--bg`→`ink-950`, `--panel`→`ink-900`, `--card`→`ink-850`,
`--elev`→`ink-800`, `--line`→`ink-700`, …) so existing components re-theme automatically; new
semantic tokens (`card`, `elev`, `rail`, `panel`, `dim`, `faint`, `good`, `warn`, `danger`,
`accent`/`accent-2`) are added alongside. **`--accent-fg` is themeable** so accent buttons stay
legible per theme. Fonts: body **Hanken Grotesk**, display **Space Grotesk** (`font-display`, used for
spec/wave headings), mono **JetBrains Mono**; plus `flow` (shimmering progress fill) and `pulse-dot`
animations used by the wave runner / activity stream. The shell is **mostly borderless** — panels and
cards are separated by background-shade steps (`bg` → `rail` → `panel` → `card` → `elev`) rather than
borders, with only the faintest hairlines where a split is essential. When adding a colour, add a
channel var to **all three** theme blocks and a token in the Tailwind config — never hardcode a hex
that won't follow the theme.

## Welcome view (`views/WelcomeView.tsx`)

The data-driven home screen (editor tab `kind: 'welcome'`). Greeting + live agents-running pill, a
**command bar** (`/` skills + `@` agents popovers, model chip, Start → hands the text to chat via
`chat.pendingPrompt`), quick chips that open `NewSpecDialog` with a preset `kind`, a **Continue
working** grid of spec cards (phase → 3 progress steps, running-agent avatars from the orchestrator,
Resume/Review), a **Your Kraken** agent-fleet grid (real `agents`, live running state), and an
SDD-loop + Browse agents/skills footer. With no workspace it collapses to an Open-folder hero.

## Spec rail (`SpecRail.tsx`)

The Mission Control left rail. A 52px **destination nav** (icons for all 13 `ActivityTab`s, with
live running-count badges on `orchestrator`/`graph`/`tasks`) drives `ui.activity`; the body shows
the selected destination. For `specs` it renders `SpecRailBody`: a `SPECS · N` header + New-spec
button, the **ACTIVE SPEC** hero card (display-font name, kind·updated meta, a 4-segment
`Req·Design·Tasks·Done` phase spine whose segments deep-link to that phase file, a pulsing accent dot
when a run is live), then an **OTHER SPECS** list (status dot + name + relative `updatedAt`, opens the
spec's current-phase file). The "active spec" is the spec of the currently-open tab, falling back to
the most-recently-updated spec. Every other destination re-homes its existing `sidebar/*View`
component into the rail body. (The old `SpecsView` / `Sidebar` / `ActivityBar` are superseded by this
file.)

## Layout / component tree

**Mission Control shell**, composed in `src/App.tsx` — a command-bar-driven frame that replaced the
old VS Code-style shell (the former `TitleBar` / `ActivityBar` / `Sidebar` / `ChatPanel` / `StatusBar`
components were removed):

```
App
├─ CommandBar            top spine: brand, ⌘K command-palette trigger, live-agents indicator,
│                        project·branch·model·backend, theme/activity toggles. Opens CommandPalette.
│   └─ CommandPalette    ⌘K overlay — fuzzy-jump to any spec / destination / quick command.
├─ SpecRail              unified left rail (replaces ActivityBar + Sidebar): a 52px destination nav
│   │                    (all 13 `ActivityTab`s, with running-count badges) + a body.
│   ├─ SpecRailBody      the `specs` destination — ACTIVE SPEC hero card (4-segment phase spine,
│   │                    clickable) + OTHER SPECS list. The active spec = the open tab's spec.
│   └─ (other dests)     re-home the existing sidebar/*View components: Explorer, Steering, Graph,
│                        Tasks, Terminals, History. **Agents, Skills, Hooks, Orchestrator, Source
│                        Control, and Settings open as full-page EditorArea *studio* tabs** (via the
│                        `FULL_PAGE_TABS` map in `SpecRail`/`CommandPalette`), not rail panels — the
│                        compact `AgentsView`/`SkillsView`/`HooksView`/`OrchestratorView` panels remain
│                        as a fallback if their `activity` is set directly.
├─ EditorArea            tabbed main stage; renders a views/*Viewer by active tab kind
│   ├─ WelcomeView  SpecEditor  SpecDocument  SpecSummaryView  QuestionsView  FileViewer
│   ├─ AgentViewer  SkillViewer  RunViewer  HookEditor  AgentGraphView  TerminalView
│   ├─ AgentsStudio  SkillsStudio  RouterStudio  HooksStudio  SyntaxStudio  ← full-page module studios
│       (SpecEditor's `SpecPhaseStrip` is a clickable **pipeline spine** — each step opens that
│        phase's file (requirements/bugfix → design → tasks), with the current view ringed, completed
│        phases checked, and the Advance/Re-sync workflow action on the right. View modes are
│        file-aware: **documents** (requirements/bugfix/design) default to **Read** — a spacious
│        column of structured section cards (`SpecDocument`, parsed by `lib/specSections.ts`, with
│        EARS acceptance criteria + checkboxes rendered as checklists) — plus raw **Edit**; the
│        **tasks** file defaults to **Board**, a full-height TaskRunner rendered as a **kanban
│        dashboard**: a header with stat tiles (Done / Running / Remaining / Progress) + actions, then
│        a row of **bounded wave lanes** — each lane groups its wave's task cards under a colored
│        header (accent while running, green when done) with a per-wave count + progress bar. Cards
│        show a pulse dot, `flow` progress bar and `@agent` while running; done cards dim/strike,
│        queued recess. **Clicking any task card opens a full-screen `TaskInspector` modal** — the
│        resolved agent + its persona, skill, model/backend, invocation, files written and the full
│        transcript (response/prompt/system/error), reusing `graphModel`'s `indexRuns`/`verifyRun`
│        over live orchestrator runs + persisted history (the same data as the Agent Graph drawer).
│        The completion recap (changed files + AI summary, `CompletionSummary`) now
│        lives in its **own `summary` tab** (`SpecSummaryView`), opened from the board's Summary
│        button. Terminal tabs stay mounted across switches — display-toggled — so the PTY survives.)
└─ ActivityStream        right panel (replaces ChatPanel): an ActivityFeed (live orchestrator runs as
                         glowing cards with elapsed timers + recent finished log) stacked over the
                         ChatPanel thread + input. Toggled by the CommandBar activity button.
```

Resizing: `ResizeHandle` (pointer-capture divider) writes the rail/activity widths into the `ui`
store (`sidebarWidth` = SpecRail, `chatWidth` = ActivityStream).

## Agent routing — `src/lib/agentRouter.ts`

Content-aware selection of which installed agent runs a piece of work. **Precedence:**

1. per-task `@agent` (from `tasks.md`, parsed by `src/lib/tasks.ts`)
2. chat `@agent` override (`chat.selectedAgent`)
3. best-matching **installed** agent for the action

"Best match" tries the bundled default by name, then scores every agent in `.claude/agents`
(workspace + global) by how well its name/description fits the work, adding broad implementation
signals (`IMPLEMENTER_SIGNALS`) plus a **workspace-scope bonus**. Task execution is
**local-first**: if nothing scores, it still picks the first project-local agent rather than going
generic; generic is reached only when the project has no installed agents at all. `routeAgent`
returns a `RouteReason` for transparency (shown in the UI and stored on the run).

**Configurable + inspectable.** The precedence is actually per-task `@agent` → chat override →
**user pin** → best specialist → bundled default → generic; the pin step and the scoring weights
(`workspaceBonus`, `specialistThreshold`, `localFirst`) come from `useModuleConfig` via
`setRouterConfig`, so the module is the single source of truth and every run honours it. Extra exports
make the logic previewable: `scoreAgents` (full ranked breakdown with per-agent keyword hits),
`explainRoute` (resolved agent + injected skills + candidates for a hypothetical action),
`actionKey`, and `keywordsFromText` / `actionProfile`. `RouteReason` gained a `'pinned'` member.
These power the **Orchestration studio's routing playground** (see Module studios).

## Skill injection — not just labels

`SkillMeta.body` carries the full `SKILL.md` text. `skillSystemBlock` / `skillSystemBlocks`
build prompt blocks that are **prepended to the system prompt** (inside `streamClaude`). The SDD
skill (`sdd-feature` / `sdd-bugfix`, by spec kind) governs spec drafting and task runs;
`bestSkillByText` additionally injects a confident domain-skill match (e.g. a frontend skill for
UI tasks). Chat `/skill` injects that skill's body too. `src/lib/verifyLibrary.ts` resolves the
chosen agent/skill back to the installed file (root `.claude/` vs global) for the Running-Tasks
**Library verification** panel.

Injection is **configurable** through `useModuleConfig` (surfaced by the Skills + Orchestration
studios): `skillInjection` gates the governing SDD skill, `domainSkillInjection` +
`domainSkillThreshold` gate the domain match, and `disabledSkills` excludes named skills. These are
enforced inside `routeSkill` / `bestSkillByText`, so a disabled skill never reaches the prompt.

## Module studios — full-page Agents / Skills / Orchestration / Hooks

Each library is a first-class **full-page module** (editor tab kinds `agents-studio`, `skills-studio`,
`router-studio`, `hooks-studio`), opened from the rail nav / ⌘K via the `FULL_PAGE_TABS` map. They
share chrome from **`src/components/ModuleShell.tsx`** (`ModuleHeader`, `ModuleTabs`, `ModuleSection`,
a collapsible `Explainer` teaching panel, `Callout`, `ScopeChip`) and helpers from
**`src/lib/library.ts`** (`slugify`, `agentPath`/`skillPath`, `agentScaffold`/`skillScaffold`,
`buildAction`, `actionsRoutingTo`). Every studio teaches how the subsystem works, shows which
option is best for a task, lets you **create** new items, and exposes the module's config.

- **`AgentsStudio`** — searchable list (Project/Global groups) + detail: metadata (model/tools/scope),
  the rendered system prompt, **"Best for"** (which SDD steps auto-route here, via `actionsRoutingTo`),
  "Use in chat", per-step **pins**, and **New agent** (writes a scaffolded `.claude/agents/<slug>.md`
  through `fs:write`, then `refreshAll`).
- **`SkillsStudio`** — list + detail with the injected SKILL.md body, a "when it's injected"
  explanation, an **injection on/off** toggle (`disabledSkills`), and **New skill** (scaffolds
  `.claude/skills/<slug>/SKILL.md`).
- **`RouterStudio`** (Orchestration) — three sub-tabs: **Routing playground** (runs the real
  `explainRoute` on any step/task text → resolved agent + reason, injected skills, and the ranked
  candidate scoring), **Configuration** (agent pins, routing weights, skill-injection toggles, wave
  concurrency, reset), and **Live agents** (embeds `OrchestratorView`).
- **`HooksStudio`** — explainer + trigger reference + hook cards (enable/run/edit, opens the existing
  `HookEditor` tab) + NL **Generate** and **Seed defaults**.
- **`SyntaxStudio`** (`syntax-studio` tab) — the file-explorer syntax config: a live preview, a
  **color-theme** grid (built-ins + **Install custom** — name + 10 color pickers) with per-theme
  mini previews, **line-numbers/wrap** prefs, and an **installable-languages** list (core = locked-on,
  extras = one-click install → lazy `ensureLanguage`). Opened from the Explorer rail's palette button,
  the FileViewer toolbar, or ⌘K.

### File viewer & syntax highlighting (`views/FileViewer.tsx`)

The `file` tab now highlights code (was raw `<pre>`). It resolves the language via `detectLanguage`,
and — for a **core** grammar or an **installed** extra — highlights with `prism.ts`'s `highlight`
(loading installed grammars through `ensureLanguage`); otherwise it shows plain text with a one-click
**Install `<lang>`** banner (writes to `useSyntax.languages`, the just-in-time install path). A
toolbar exposes a quick theme picker, line-numbers + wrap toggles, and a link to `SyntaxStudio`.
Theming is **scoped**: colors are applied as `--syn-*` CSS variables on the `.code-view` container
(see `styles.css`), so file-viewer themes never touch markdown/spec-editor token colors. Line numbers
render as a parallel gutter column (hidden while wrapping); files over ~400 kB skip highlighting.

## Other `src/lib` helpers

- `tasks.ts` — parse `tasks.md` checklists, per-task `@agent`, waves/dependencies.
- `specSections.ts` — parse a requirements/design doc into title + H2 section cards, with
  list/checkbox/EARS-criteria extraction (consumed by `SpecDocument`).
- `markdown.ts` / `prism.ts` — render + syntax-highlight code. `prism.ts` also owns the
  **installable-language registry**: `CORE_LANGUAGES` (always bundled) + `INSTALLABLE_LANGUAGES`
  (each a lazy Vite chunk), with `ensureLanguage(id)` (loads a grammar + its deps on demand,
  de-duped), `isLanguageReady`, `isInstallable`.
- `fileLang.ts` — maps a filename/extension to a Prism language id + label (`detectLanguage`).
- `syntaxThemes.ts` — the `SyntaxTheme` shape (10 token slots), `BUILTIN_THEMES`, `THEME_SLOTS`
  (custom-theme editor fields), and `themeToCssVars` (theme → `--syn-*` CSS custom properties).
- `graphModel.ts` — builds the agent-graph node/edge model (`@xyflow/react`).
- `library.ts` — module-studio helpers: slug/paths, agent/skill scaffolds, `buildAction`,
  `actionsRoutingTo` (which SDD steps route to a given agent).
- `cn.ts` — `clsx` class-name helper.

## Open Questions module

`QuestionsView` (editor tab `kind: 'questions'`, opened from `SpecsView`) is a dedicated per-spec
view, anchored to the **requirement file** (`requirements.md` / `bugfix.md`), that manages its
`## Open Questions`. It parses them with `src/lib/openQuestions.ts` (a `tasks.ts`-style markdown
parser — the markdown stays the source of truth), and per question lets you: stream a
Claude-suggested answer (`source: 'open-questions'`, registered in the orchestrator), edit it,
**Resolve** (writes `- [x] … — **Resolved:** …` inline), reopen, or delete. Adding a question writes
a `- [ ]` item, creating the section if absent. When questions are answered, **Apply to
requirements** folds the Q&A into a `## Resolved Decisions` section the design phase consumes (see
[`data-model.md`](./data-model.md#open-questions-format)).

The requirements editor (`SpecEditor`, requirements/bugfix files) has a **Surface questions**
button (`useSurfaceQuestions`) that asks Claude to extract open questions from the requirements
prose, appends the new ones (deduped) to the `## Open Questions` section, and opens the
`QuestionsView` so they're ready to answer.

## Keeping open editors in sync with agent writes

Agents edit files on disk from many places — the chat panel, a hook, the orchestrator — not
just a view's own "Ask Claude" button. Those runs carry a different `requestId`, so a view that
only reloads on *its own* run's `done` will show stale content until it remounts (e.g. the user
switches tabs). The fix pattern, used by `SpecEditor`: subscribe to `claude.onEvent` and reload
the file from disk on **any** run's `done`/`error`, guarded by a `dirtyRef` so an in-flight local
edit is never clobbered. The CLI emits `done` only on process close, so the write is fully
flushed by then — a re-read is safe. Apply the same pattern to any new viewer that shows a file
an agent can modify.

## Conventions

- After a backend mutation, refresh the relevant store list (`refreshAll()` or a targeted reload)
  rather than mutating local state optimistically — disk is the source of truth.
- A viewer that displays an agent-writable file should reload it on Claude run completion (see
  "Keeping open editors in sync with agent writes" above), not only on its own action's `done`.
- New editor surfaces = a new `OpenTab.kind` + a `views/*Viewer` + an `EditorArea` case.
- New rail destinations = a new `ActivityTab` (in `ui.ts`) + a `sidebar/*View` + a `NAV` entry and
  body case in `SpecRail.tsx` (and an entry in `CommandPalette`'s `DEST` list so ⌘K can reach it).
