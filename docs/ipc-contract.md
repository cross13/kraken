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
2. **`electron/preload.ts`** — expose a typed method under the right namespace on `window.kraken`:
   ```ts
   specs: {
     // …
     rename: (root: string, id: string, name: string) =>
       ipcRenderer.invoke('specs:rename', root, id, name) as Promise<SpecMeta>,
   }
   ```
3. **`src/`** — call it from a store or component: `await window.kraken.specs.rename(root, id, name)`.

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
workspace root and its file tree.

### `specs`
`list(root)`, `create(root, name, kind)`, `read(root, id)`, `writeFile(root, id, file, content)`,
`advance(root, id)`, `setPhase(root, id, phase)`, `delete(root, id)` — the SDD spec lifecycle.
`advance` walks `requirements → design → tasks → done`; `setPhase` can reopen a phase (Re-sync).
`delete` permanently removes the on-disk spec folder **and** cascades every mirrored DB row
(`spec_events`, `runs` + their `run_files`/`errors`, `hook_runs`). See
[`data-model.md`](./data-model.md) for the on-disk shape.

### `skills` / `agents`
`list(root)`, `read(path)`, `seedDefaults(root)` each. Read from `.claude/skills` and
`.claude/agents` (workspace + `~/.claude/`). `seedDefaults` writes the bundled SDD library.

### `steering`
`list(root)`, `seedDefaults(root)` — project-context markdown in `.kraken/steering/`.
`write(root, input: SteeringWriteInput)` — create/update a doc (frontmatter `.md`; renames via
`input.prevPath`). `remove(root, path)` — delete a doc (rejects paths outside `.kraken/steering`).
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
`list(root?)` — discovered MCP servers.

### `settings`
`getModel`/`setModel`, `hasApiKey`/`setApiKey`/`clearApiKey`, `getBackend`/`setBackend`
(`'cli' | 'api'`), `getMaxConcurrency`/`setMaxConcurrency`, `getPermissions`/`setPermissions`
(`allowedTools`, `permissionMode`, `allowBash`).

### `cli`
`detect()` — locate and version-check the local `claude` binary.

### `git`
`status`, `listChanges`, `stage`, `unstage`, `stageAll`, `unstageAll`, `fetch`, `pull`, `push`,
`listBranches`, `checkout`, `createBranch`, `commitPush`. Backed by `electron/git.ts`. All return
`{ ok, error?, output, … }` result objects.

### `github`
`hasToken`, `setToken`, `clearToken`, `tokenStatus`, `repoInfo(cwd)`,
`listBranches(cwd)` (remote branches — the valid PR base targets, used by the create-PR base
typeahead), `listPrs(args)`, `createPr(args)`, `mergePr(args)`. Backed by `electron/github.ts`
(dependency-free REST client). PR/repo methods return `GitHubOpResult<T>`.

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

## Gotchas

- A handler with no matching preload method is unreachable from the renderer (and vice-versa) —
  the typecheck won't catch a missing channel string, only a missing TS method.
- The `requestId` is how the renderer correlates streamed events back to the run that started
  them — always thread it through.
- `electron/shared/types.ts` must remain importable by the DOM-typed web project, so no Node/DOM
  globals in it.
