# Renderer (`src/`)

React 18 + Tailwind + Zustand. The renderer talks to the backend **only** through
`window.kraken.*` (see [`ipc-contract.md`](./ipc-contract.md)). There is no global state outside
the Zustand stores.

## Stores (`src/stores/`)

Four stores, each a `create<…>()` from Zustand. Components subscribe directly.

### `workspace.ts` — `useWorkspace`
The loaded project. Holds `root`, `tree` (file `DirEntry[]`), and the lists `specs`, `skills`,
`agents`, `steering`, `hooks`. Actions: `openWorkspace`, `pickWorkspace`, `restoreLast`,
`refreshAll`, `createSpec`, `seedDefaults`. This is the entry point — most views read from here
and call `refreshAll()` after a mutation.

### `chat.ts` — `useChat`
The chat panel's single conversation: `messages`, `busy`, `currentRequestId`, `selectedAgent`.
Actions: `push`, `appendDelta(id, text, channel?)`, `finish(id)`, `fail(id, error)`, `clear`,
`setBusy(b, requestId?)`, `setSelectedAgent`. The `claude.onEvent` handler routes streaming
deltas here by `requestId` for chat-kind runs. `appendDelta` is **channel-aware**: it keeps a flat
`content` string (history/persistence) *and* builds `segments: MessageSegment[]` — consecutive
same-channel deltas merge, while `tool`/`tool_result` chunks each become their own segment.
`ChatPanel` renders assistant messages from `segments`: prose as markdown, `thinking`/`tool_result`
as collapsible blocks, `tool` as a "Command" card (see [`backends.md`](./backends.md) → Delta
channels).

### `ui.ts` — `useUi`
Layout + tabs. `activity` (`ActivityTab` — the activity-bar selection), `sidebarOpen`/`chatOpen`
toggles, `sidebarWidth`/`chatWidth` (clamped + persisted to `localStorage`), and the editor
**tab model**: `tabs: OpenTab[]`, `activeTabId`, with `openTab`/`closeTab`/`setActiveTab`. An
`OpenTab.kind` is one of `'spec' | 'questions' | 'file' | 'agent' | 'skill' | 'welcome' | 'settings' | 'run' |
'hook' | 'graph' | 'terminal'` — this is what the `EditorArea` switches on to pick a viewer.
(`terminal` tabs also carry `termProfile: 'shell' | 'claude'`; the tab id doubles as the PTY id.)

### `orchestrator.ts` — `useOrchestrator`
**The global registry of every in-flight run** — chat, spec drafting, audits, and wave tasks all
`startRun` / `finishRun` here, each tagged with a `RunKind` + human `title`. Decoupled from
`chat.busy`. Holds `runs: Record<requestId, ActiveRun>`, a recent-activity `log: FinishedRun[]`,
and `maxConcurrency` (1–8). Selectors: `runningCount()`, `taskRunningCount()` (task/refine/polish
only — so chat/spec runs don't throttle wave scheduling), `activeForTask(taskId)`.

## Layout / component tree

VS Code-style shell, composed in `src/App.tsx`:

```
App
├─ TitleBar               project + branch, deep-links to Source Control
├─ ActivityBar            left rail; selects the sidebar view + running-count badge
├─ Sidebar               switches (in `Sidebar.tsx`) to one of the sidebar/*View components
│   ├─ ExplorerView  SpecsView  AgentsView  SkillsView  SteeringView  TasksView
│   ├─ HooksView  HistoryView  OrchestratorView  SourceControlView  GraphView
│   ├─ TerminalsView  SettingsView
├─ EditorArea            tabbed; renders a views/*Viewer by active tab kind
│   ├─ WelcomeView  SpecEditor  QuestionsView  FileViewer  AgentViewer
│   ├─ SkillViewer  RunViewer  HookEditor  AgentGraphView  TerminalView
│       (SpecEditor toggles Board / Edit / Preview; the tasks file defaults to Board,
│        a full-height TaskRunner. TaskRunner + CompletionSummary are nested, not tabs.
│        Terminal tabs stay mounted across switches — display-toggled — so the PTY survives.)
├─ ChatPanel             dockable streaming chat
└─ StatusBar             project/branch, running-count, deep-links
```

Resizing: `ResizeHandle` (pointer-capture divider) writes widths into the `ui` store.

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

## Skill injection — not just labels

`SkillMeta.body` carries the full `SKILL.md` text. `skillSystemBlock` / `skillSystemBlocks`
build prompt blocks that are **prepended to the system prompt** (inside `streamClaude`). The SDD
skill (`sdd-feature` / `sdd-bugfix`, by spec kind) governs spec drafting and task runs;
`bestSkillByText` additionally injects a confident domain-skill match (e.g. a frontend skill for
UI tasks). Chat `/skill` injects that skill's body too. `src/lib/verifyLibrary.ts` resolves the
chosen agent/skill back to the installed file (root `.claude/` vs global) for the Running-Tasks
**Library verification** panel.

## Other `src/lib` helpers

- `tasks.ts` — parse `tasks.md` checklists, per-task `@agent`, waves/dependencies.
- `markdown.ts` / `prism.ts` — render + syntax-highlight markdown in viewers.
- `graphModel.ts` — builds the agent-graph node/edge model (`@xyflow/react`).
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
- New sidebar surfaces = a new `ActivityTab` (in `ui.ts`) + a `sidebar/*View` + `ActivityBar`
  entry + `SidebarShell` case.
