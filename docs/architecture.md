# Architecture

Kraken is an Electron desktop app for the Spec-Driven Development (SDD) loop:
**requirements → design → tasks → execution**. It drives Claude through one of two
interchangeable backends — the user's local Claude CLI (default) or the Anthropic API
SDK — selected at runtime in Settings.

## The three layers

Electron splits into three processes/contexts. **Data crosses between them only through the
typed IPC bridge.** Never reach across a layer any other way.

```
┌─────────────────────────────────────────────────────────────────┐
│  Renderer (src/)  —  React 18 + Tailwind + Zustand                │
│  UI, client state. Talks to the backend ONLY via window.kraken.*  │
└──────────────────────────────┬────────────────────────────────────┘
                               │  window.kraken.<ns>.<method>()
┌──────────────────────────────┴────────────────────────────────────┐
│  Preload (electron/preload.ts)  —  context-isolated bridge          │
│  Exposes one typed object `window.kraken`. KrakenApi = its typeof.  │
│  invoke() for request/response, send()+on() for streaming.          │
└──────────────────────────────┬────────────────────────────────────┘
                               │  ipcRenderer.invoke / send  ↔  ipcMain.handle / on
┌──────────────────────────────┴────────────────────────────────────┐
│  Main (electron/main.ts, ~2300 lines)  —  the core                  │
│  All filesystem, spec, agent/skill, settings, git, history, hooks,  │
│  steering, orchestration, and Claude-streaming logic.               │
│  Helpers split out: db.ts, git.ts, github.ts. Types: shared/types.ts│
└─────────────────────────────────────────────────────────────────────┘
```

### Main process — `electron/main.ts`

Owns everything privileged. Handlers are registered in **`registerIpc()`** via
`ipcMain.handle('<namespace>:<action>', …)`. Key responsibilities:

- **Spec lifecycle** — `createSpec` / `readSpec` / `writeSpecFile` / `advanceSpec`, plus the
  markdown `*Template` functions. A spec is a directory under `.kraken/specs/<id>/` holding
  `spec.json` (phase + metadata) and the phase markdown files.
- **Backend dispatch** — `streamClaude` records a run row, prepends steering, then forks to
  `streamViaCli` or `streamViaApi` based on the `backend` setting. Both emit identical
  `claude:event` messages. See [`backends.md`](./backends.md).
- **Secrets** — API key and GitHub token are encrypted with Electron `safeStorage` (OS
  keychain) and persisted via `electron-store`. Never stored in plaintext.
- **Subsystems** — hooks, steering, agents/skills seeding. See [`subsystems.md`](./subsystems.md).

> **Note:** `electron/main.ts` currently contains a stray NUL byte, so plain `grep`/`rg`
> treat it as binary. Use `grep -a` (or read it with the editor/Read tool) when searching it.

### Preload — `electron/preload.ts`

Context-isolated bridge. Exposes a single typed object on `window.kraken`, namespaced:
`workspace`, `specs`, `skills`, `agents`, `steering`, `hooks`, `fs`, `mcp`, `settings`,
`cli`, `git`, `github`, `history`, `claude`. The exported `KrakenApi` type (`typeof api`) is
the contract the renderer types against.

**Rule:** when you add or change an IPC handler in `main.ts`, you must add/update the matching
method here, or the renderer can't reach it. See [`ipc-contract.md`](./ipc-contract.md).

### Renderer — `src/`

React 18 + Tailwind + Zustand. Four stores (`src/stores/`): `workspace`, `chat`, `ui`, and the
`orchestrator` registry of in-flight runs. VS Code-style shell: `ActivityBar` → `Sidebar` →
`EditorArea` (tabbed viewers) → dockable `ChatPanel` → `StatusBar`. See [`renderer.md`](./renderer.md).

## Two TypeScript projects

They compile independently — `npm run typecheck` runs both:

- `tsconfig.node.json` → `electron/**` (main + preload + shared), Node types only.
- `tsconfig.web.json` → `src/**` plus `electron/preload.ts` and `electron/shared/**`, DOM types.
- Path alias `@/*` → `src/*` (renderer only).

`electron/shared/types.ts` is compiled by **both**, so it must stay dependency-free (no Node,
no DOM, no third-party imports).

## End-to-end data flow (a chat/stream example)

1. Renderer calls `window.kraken.claude.stream(payload)` (fire-and-forget `ipcRenderer.send`).
2. Preload forwards on channel `claude:stream`.
3. Main's handler → `streamClaude` → records a run (`db.ts`), composes steering + system,
   forks to `streamViaCli` / `streamViaApi`.
4. The backend emits `claude:event` messages (`delta` / `done` / `error`) via the shared
   `emit()`, which also mirrors output into SQLite.
5. Renderer's `claude.onEvent(handler)` (registered once) receives them and updates the
   `chat` / `orchestrator` stores by `requestId`.

Request/response calls (everything else) use `invoke()` and return a Promise directly.
