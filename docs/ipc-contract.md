# The IPC Contract

**The IPC boundary is the contract.** Every interaction between renderer and main goes
through it. This doc is the reference for the existing surface and the recipe for changing it.

## The three-part change

Adding or changing anything that touches the backend means editing **three places**, in order:

1. **`electron/main.ts` → `registerIpc()`** — register the handler:
   ```ts
   ipcMain.handle('specs:rename', (_e, root: string, id: string, name: string) =>
     renameSpec(root, id, name)
   );
   ```
2. **`electron/preload.ts`** — expose a typed method under the right namespace on `window.octo`:
   ```ts
   specs: {
     // …
     rename: (root: string, id: string, name: string) =>
       ipcRenderer.invoke('specs:rename', root, id, name) as Promise<SpecMeta>,
   }
   ```
3. **`src/`** — call it from a store or component: `await window.octo.specs.rename(root, id, name)`.

If a new shared shape is involved, add it to **`electron/shared/types.ts`** first and import it
on both sides. Then run `npm run typecheck`.

### Conventions

- **Channel names** are `'<namespace>:<kebab-action>'` (e.g. `'git:commit-push'`). The preload
  method is usually camelCase (`commitPush`).
- **Request/response** uses `ipcMain.handle` ↔ `ipcRenderer.invoke` (returns a Promise).
- **Streaming / fire-and-forget** uses `ipcRenderer.send` + an `ipcMain.on` (or equivalent) and
  pushes results back on a separate event channel the renderer subscribes to with `.on()`.
  Today only `claude:stream` (events on `claude:event`) and the hook event channel (`hook:event`)
  use this pattern — see their `onEvent` subscribers in preload.
- **Keep both backends interchangeable.** Anything user-visible should flow through the common
  `claude:event` stream, not be special-cased per backend.

## Namespace reference

The full surface, as defined in `electron/preload.ts` (the source of truth — check there for exact
argument and return shapes). Grouped by namespace:

### `workspace`
`pick()`, `getLast()`, `getRecents()`, `open(path)`, `listTree(path)` — choosing and reading the
workspace root and its file tree. `seedUpgrade(root)` → `SeedReport` runs the four seeders in
**upgrade-only** mode (rewrites a default nobody edited, creates nothing) and is called from
`useWorkspace.openWorkspace` right after `open`; a per-root `seededLibraryVersion` makes it a
no-op once the workspace is current.

### `specs`
`list(root)`, `create(root, name, kind, brief?)`, `read(root, id)`, `writeFile(root, id, file, content)`,
`advance(root, id)`, `setPhase(root, id, phase)`, `delete(root, id)` — the SDD spec lifecycle.
`advance` walks `requirements → plan → build → done`; `setPhase` can reopen a phase (Re-sync).
`create`'s optional `brief` is the Home composer's text: it is stored on `SpecMeta` and quoted at
the top of the seeded first document — creating a spec never starts a Claude run.
`delete` permanently removes the on-disk spec folder **and** cascades every mirrored DB row
(`spec_events`, `runs` + their `run_files`/`errors`, `hook_runs`). See
[`data-model.md`](./data-model.md) for the on-disk shape.

### `skills` / `agents`
`list(root)`, `read(path)`, `seedDefaults(root)` each. Read from `.claude/skills` and
`.claude/agents` (workspace + `~/.claude/`). `seedDefaults` writes the bundled SDD library and
resolves with a **`SeedReport`** (`created` / `upgraded` / `kept`): it installs what's missing and
**rewrites a default the user never edited** with the current version, while any file carrying
edits is reported as `kept` and left alone. Same return shape for `steering.seedDefaults` and
`hooks.seedDefaults`. See [`subsystems.md`](./subsystems.md) → Agents & Skills for how "never
edited" is decided.

### `steering`
`list(root)`, `seedDefaults(root)` — project-context markdown in `.octo/steering/`.
`write(root, input: SteeringWriteInput)` — create/update a doc (frontmatter `.md`; renames via
`input.prevPath`). `remove(root, path)` — delete a doc (rejects paths outside `.octo/steering`).
`preview(root, { files?, manualRefs? })` — returns the exact steering block that would be injected
(pins merged in). `getPins(root)` / `setPins(root, names)` — pinned doc names (force-included in
every run), persisted per workspace in `electron-store`.

### `hooks`
`list`, `read`, `write`, `delete`, `toggle`, `fire(trigger, ctx)`, `fireOne(root, id, ctx)`,
`seedDefaults`, `generateFromNl(root, description)`, `listRuns(opts)`, and `onEvent(handler)`
(subscribes to `hook:event`). See [`subsystems.md`](./subsystems.md).

### `fs`
`read(path)`, `write(path, content)` — raw file IO for the editor. (Hook runs deliberately do
**not** write through `fs:write`, to avoid retriggering file-save hooks.)

### `mcp`
`list(root?)` — discovered MCP servers (read from `.mcp.json` / `~/.claude.json`).
`listTools({root, server})` — actually **connects**: `initialize` → `tools/list`, returning the
tools plus a suggested capability map. Backed by `electron/mcpClient.ts`.

### `tickets`
`listProviders(root)`, `saveProvider`, `deleteProvider` — per-workspace tracker configs
(`ticketProviders` in electron-store). `hasToken(server)` / `setToken` — bearer tokens for remote
MCP servers, encrypted with `safeStorage` like the API key. `plan({root, specId, event})` resolves
an event into the exact `TicketAction[]` it would send, **without sending anything**;
`apply({…, actions, eventId})` sends them in order, stops at the first failure, records the ticket
key on `SpecMeta.ticket` after a create, and marks the event applied only when every call landed.
`call({root, providerId, tool, args})` is the escape hatch for one-off tool calls.
`listOpen({root, limit})` calls each enabled tracker's mapped `search` tool and returns the
not-done tickets **per provider**, so one unreachable tracker never hides the others.
`link({root, specId, ticket})` attaches an existing ticket to a spec and marks `spec-created`
already applied — the ticket is what the spec came from, so proposing to create another would be
backwards. `listScopes({root, providerId})` reads the clients / projects a tracker scopes tickets
by, so the picker offers them instead of asking for an identifier typed from memory.
`authStatus(server)` → `{mode: 'none'|'manual'|'oauth', account?, expiresAt?}`.
`signIn({root, server, scope?})` runs the whole OAuth flow and **resolves only when the browser
redirect lands** — the pending promise is the completion signal, so there is nothing to subscribe
to. `signOut(server)` drops the stored record.
`seed({root, providerId, ticket, kind})` fetches the ticket through the `get` capability and
returns `{brief, requirements, plan}` — the markdown a spec starts from, with `plan` null unless
the ticket carries one.

### `settings`
`getModel`/`setModel`, `hasApiKey`/`setApiKey`/`clearApiKey`, `getBackend`/`setBackend`
(`'cli' | 'api'`), `getMaxConcurrency`/`setMaxConcurrency`, `getPermissions`/`setPermissions`
(`allowedTools`, `permissionMode`, `allowBash`).

### `cli`
`detect()` — locate and version-check the local `claude` binary.

### `models`
`list(workspacePath?)` → `ModelDiscovery`. Answers "what models can this machine reach?" by
merging the Anthropic **Models API** (`GET /v1/models`, only when an API key is stored) with the
model ids named in the user's local Claude Code config, falling back to a bundled catalog. Every
entry carries a `source` (`'api' | 'cli-config' | 'catalog'`) so the UI states how it knows.
See [`backends.md`](./backends.md) → Model discovery.

### `git`
`branchSummary({cwd, base?})` → `BranchSummary` reports what the current branch adds on top of its
base: the commits (`git log base..HEAD`) and the per-file line counts (`git diff --numstat
base...HEAD`, three dots — the changes *this branch introduced*, not what happened on the base
meanwhile). The base is `origin/HEAD` when the remote sets it, else a guess flagged as
`baseGuessed`. Backs the PR composer.
`status`, `listChanges`, `stage`, `unstage`, `stageAll`, `unstageAll`, `fetch`, `pull`, `push`,
`listBranches`, `checkout`, `createBranch`, `commitPush`. Backed by `electron/git.ts`. All return
`{ ok, error?, output, … }` result objects.

### `github`
`hasToken`, `setToken`, `clearToken`, `tokenStatus`, `repoInfo(cwd)`,
`listBranches(cwd)` (remote branches — the valid PR base targets, used by the create-PR base
typeahead), `listPrs(args)`, `createPr(args)`, `mergePr(args)`. Backed by `electron/github.ts`
(dependency-free REST client). PR/repo methods return `GitHubOpResult<T>`.

### `data`
`usage(root)` → `DataUsage` (spec folders on disk, incl. any left in a pre-rename
`.kraken/specs`, plus history-row counts for this workspace and for every workspace).
`reset(root, opts: DataResetOptions)` → `DataResetReport` — the **Danger zone** wipe behind
Library › Settings: deletes spec folders on disk and/or history rows (`historyScope:
'workspace' | 'all'`, `clearHistory` in `db.ts`, one transaction + `VACUUM`). It never touches
settings, secrets, agents, skills, hooks or steering, refuses a path outside the specs
directory, and **throws while any run is active** so nothing writes a spec back mid-delete.

### `history`
`listRuns`, `getRun`, `listRunFiles`, `runFileCounts`, `listSpecFiles`, `listErrors`, `stats`,
`specRunStats`, `listSpecEvents`. Read-only queries over the SQLite mirror (`electron/db.ts`).
`specRunStats(root)` returns per-spec run aggregates (`runs`, `errors`, `cancelled`,
`total_duration_ms`, `last_run_at`) powering the Spec Manager analytics. See
[`data-model.md`](./data-model.md).

### `claude`
`stream(payload)` (fire-and-forget `send` on `claude:stream`), `cancel(requestId)`, and
`onEvent(handler)` (subscribes to `claude:event`). The `payload` carries messages, system,
model, cwd, plus routing/audit metadata (`agent`, `skill`, `routeReason`, `kind`, `taskId`,
`wave`, `dependsOn`, …). See [`backends.md`](./backends.md).

### `terminal`
Interactive PTY terminals (node-pty). `create(opts)` (`invoke` on `terminal:create`, returns
`TerminalCreateResult`) spawns a shell or the real `claude` CLI (`opts.profile`); `write(termId,
data)` and `resize(termId, cols, rows)` are fire-and-forget `send`s; `kill(termId)` stops it;
`onData(handler)` / `onExit(handler)` subscribe to `terminal:data` / `terminal:exit`. The
`termId` (the editor tab id) correlates every message — same role as `requestId` for `claude`.
This is the only bidirectional input path to a Claude process; `claude:stream` stays one-shot.
See [`subsystems.md`](./subsystems.md) → Terminals.

### `shell`
`openUrl(url)` (`invoke` on `shell:open-url`) — opens an http(s) URL in Google Chrome (falls back
to the OS default browser). Used by the terminal's web-links addon and the window-open handler so
URLs Claude emits land in Chrome.

### `win` — the Travel Display (wide second window)
`isWideRenderer()` is a **pure renderer check** (no IPC — reads `location.hash === '#wide'`), used
by the renderer entry to decide whether to render `WideApp` instead of `App`. `toggleWide()`
(`invoke` on `window:toggle-wide`) opens the travel window on a detected secondary display (or a
compact wide bar on the primary as a fallback) and closes it if already open. `isWideOpen()`
(`invoke` on `window:is-wide-open`) returns the current open state; `onWideState(handler)`
subscribes to `window:wide-state` (`{ open }`), broadcast to the **main** window whenever the
travel window opens/closes so the toggle stays in sync. `focusMain()` (`send` on
`window:focus-main`) pulls focus back to the main window. `setZoom(z)` is **not IPC** — it calls
`webFrame.setZoomFactor(z)` directly in the preload to crisply scale the current frame (used by the
travel window's zoom control). See [`subsystems.md`](./subsystems.md) → Travel Display.

### `fleet` — live-run mirror to the Travel Display
`push(snapshot)` (`send` on `fleet:push`) is called by the **main** window with a serialized
`FleetSnapshot` — `{ runs: ActiveRun[]; maxConcurrency }`, its orchestrator registry plus the wave
concurrency cap (the travel window draws a task-slot meter and cannot otherwise know the ceiling);
the main process caches it as `lastFleet` and forwards it to the travel window via `fleet:sync`. `onSync(handler)` (subscribes to
`fleet:sync`) is used by `WideApp` to mirror the registry, and `request()` (`send` on
`fleet:request`) asks the main process to echo `lastFleet` back to that sender — the travel window
calls it on mount so a display opened *between* registry changes still sees what is already
running. The travel window is read-only and issues cancellation through
the existing `claude:cancel` — there is no separate cancel channel. Separately, `emit()` mirrors
each `claude:event` to the travel window (when open) so its run detail can stream the live agent
log; the main window still receives the same events unchanged.

## Gotchas

- A handler with no matching preload method is unreachable from the renderer (and vice-versa) —
  the typecheck won't catch a missing channel string, only a missing TS method.
- The `requestId` is how the renderer correlates streamed events back to the run that started
  them — always thread it through.
- `electron/shared/types.ts` must remain importable by the DOM-typed web project, so no Node/DOM
  globals in it.
