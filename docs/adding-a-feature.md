# Recipe: Adding a New Module / Feature

A concrete, end-to-end checklist for shipping a new feature. Most features touch all three
layers; skip steps that don't apply. **Update the relevant doc in this folder as part of the
change** (see the Documentation rule in `CLAUDE.md`).

## 0. Before you start

- Read [`architecture.md`](./architecture.md) and [`ipc-contract.md`](./ipc-contract.md).
- Decide what crosses the IPC boundary and what stays in one layer.
- If you persist anything, decide: on-disk (per-workspace, source of truth) vs SQLite (telemetry
  mirror)? See [`data-model.md`](./data-model.md).

## 1. Shared types — `electron/shared/types.ts`

Add any new shape both sides need. Keep it dependency-free (no Node, no DOM, no imports). This is
the contract; define it first so both projects typecheck against it.

## 2. Main process — `electron/main.ts`

- Implement the logic (a function, e.g. `doTheThing(root, …)`). For sizeable, self-contained
  concerns, consider a new helper module like `db.ts` / `git.ts` rather than growing `main.ts`.
- Register the handler in **`registerIpc()`**:
  ```ts
  ipcMain.handle('mything:do', (_e, root: string, arg: string) => doTheThing(root, arg));
  ```
- If it persists telemetry, add writer/reader helpers in `db.ts` and a `CREATE`/migration step
  (see [`data-model.md`](./data-model.md)).
- If it invokes Claude, go through **`streamClaude`** so steering/skills/History all apply — don't
  call a backend directly. See [`backends.md`](./backends.md).

## 3. Preload — `electron/preload.ts`

Expose a typed method under the right namespace on `window.kraken` (or add a new namespace):
```ts
mything: {
  do: (root: string, arg: string) =>
    ipcRenderer.invoke('mything:do', root, arg) as Promise<MyResult>,
},
```
For streaming features, follow the `claude` / `hooks` pattern: a `send` method + an
`onEvent(handler)` that subscribes to a dedicated event channel and returns an unsubscribe fn.

## 4. Renderer — `src/`

Pick the surfaces you need:

- **State:** add to an existing store (`workspace` / `chat` / `ui` / `orchestrator`) or create a
  new `src/stores/<name>.ts`. After a backend mutation, refresh from disk — don't trust optimistic
  local state.
- **A sidebar view:** new `ActivityTab` in `ui.ts` → `src/components/sidebar/<Name>View.tsx` →
  add to `ActivityBar` and the switch in `Sidebar.tsx`.
- **An editor surface:** new `OpenTab.kind` in `ui.ts` → `src/components/views/<Name>Viewer.tsx`
  → add a case in `EditorArea`.
- **Reusable logic:** `src/lib/<name>.ts`.

Call the backend via `window.kraken.mything.do(...)`. See [`renderer.md`](./renderer.md).

## 5. If it runs Claude

- Build the `claude.stream` payload with full metadata (`source`, `kind`, `agent`, `specId`,
  `routeReason`, `taskId`, `wave`, `dependsOn`, …) so History / Orchestrator / Graph stay accurate.
- Register the run in the `orchestrator` store (`startRun` / `finishRun`) so it shows in the live
  registry and respects concurrency.
- Route the agent via `routeAgent` and inject skills via `skillSystemBlocks` rather than
  hand-picking. See [`renderer.md`](./renderer.md) and [`subsystems.md`](./subsystems.md).

## 6. Verify

```bash
npm run typecheck     # the only automated gate — runs node + web projects
npm run dev           # exercise it by hand (renderer on port 5847)
```

There is no test runner or linter — typecheck + manual verification is the bar.

## 7. Update the docs

Update the doc(s) that describe what you changed:

| You changed… | Update… |
| --- | --- |
| Cross-layer flow / process model | `architecture.md` |
| An IPC handler / namespace | `ipc-contract.md` |
| Persisted shape (disk or SQLite) | `data-model.md` |
| How Claude is invoked/streamed | `backends.md` |
| Stores / components / routing / skills | `renderer.md` |
| Hooks / steering / orchestration / git / agents-skills | `subsystems.md` |
| A new build/setup step | root `README.md` |

If you added a whole new subsystem, add a section to `subsystems.md` and a row to the table in
`docs/README.md`.
