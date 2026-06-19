# Claude Backends

Kraken drives Claude through **two interchangeable backends**, chosen at runtime in
Settings (`settings.getBackend()` → `'cli' | 'api'`):

- **Local Claude CLI** (default) — spawns the user's `claude` binary. Free if they already pay
  for Claude Pro/Max, and their existing agents/skills/auth load automatically.
- **Anthropic API SDK** — `@anthropic-ai/sdk`, using an `sk-ant-…` key encrypted via OS keychain.

**Golden rule:** the two backends must stay **behaviorally interchangeable**. Anything
user-visible flows through the common `claude:event` stream — never special-case one backend in
a way the other can't match.

## Dispatch: `streamClaude`

All runs go through `streamClaude` in `electron/main.ts`. It:

1. **Records a run row** in SQLite (`beginRun` in `db.ts`) tagged with source/kind/agent/etc.
2. **Composes the system prompt** — prepends resolved **steering** (`composeSteeringSystem`) and
   any injected **skill** blocks to `payload.system`, so every run (chat, task, hook) gets project
   context + skill instructions uniformly. See [`subsystems.md`](./subsystems.md).
3. **Forks** to `streamViaCli` or `streamViaApi` based on the `backend` setting.
4. Both paths emit identical IPC via the shared **`emit()`**, which also **mirrors output into
   SQLite** (`appendRunResponse`, `finishRun`, `recordRunFile`).

Active child processes are tracked in **`activeStreams`** (keyed by `requestId`) for cancellation
(`claude:cancel`).

> **Not a backend: interactive terminals.** `streamClaude` (both backends) is **one-shot and
> fire-and-forget** — a prompt goes in via `-p`/`messages`, output streams back, and there is no
> stdin to answer a follow-up. When the user needs to *answer* Claude (AskUserQuestion, permission
> prompts) or run CLI slash commands, that runs through the separate **Terminals** subsystem
> (`electron/terminal.ts`, a node-pty PTY running the real `claude` CLI) — a fully bidirectional
> channel. See [`subsystems.md`](./subsystems.md) → Terminals. Keep the two paths distinct: the
> backends stay one-shot; interactivity lives in terminals.

## `streamViaCli`

- Flattens system + message history into a **single prompt**.
- Spawns:
  ```
  claude -p --output-format stream-json --verbose --permission-mode <mode> --allowedTools <…>
  ```
- The subprocess **`cwd` is the workspace**, so Claude sees the user's code and `CLAUDE.md`.
- **`expandedPath()`** augments `PATH` (`~/.claude/local/`, `/opt/homebrew/bin`, etc.) because
  Electron's inherited PATH is too narrow to find the binary.
- Parses the `stream-json` lines and turns them into `delta` / `done` / `error` events, plus
  file-touch records for the `run_files` table.

## `streamViaApi`

- Uses `@anthropic-ai/sdk` `messages.stream()` with the configured model and the composed system.
- Emits the same `delta` / `done` / `error` events through `emit()`.

## The event protocol

Renderer side is fire-and-forget + subscription:

```ts
window.kraken.claude.stream(payload)            // ipcRenderer.send('claude:stream', …)
const off = window.kraken.claude.onEvent(ev => { // subscribes to 'claude:event'
  // ev = { requestId, type: 'delta'|'done'|'error', text?, error?, channel? }
})
window.kraken.claude.cancel(requestId)          // stops the tracked child / stream
```

The renderer correlates events back to the originating run by **`requestId`** and updates the
`chat` / `orchestrator` stores accordingly.

### Delta channels (rich rendering)

Each `delta` carries a **`channel`** (`StreamChannel` = `text | thinking | tool | tool_result`,
default `text`) so the UI can render Claude's output distinctly instead of as one flat blob:

- `text` — assistant prose (markdown).
- `thinking` — extended-thinking blocks (assistant `thinking` blocks / `thinking_delta`).
- `tool` — a tool/command call; the text is the human-readable `summarizeToolUse` markdown
  (a fenced bash block for `Bash`, a `path` for `Edit`/`Write`).
- `tool_result` — a truncated preview of a tool's result (CLI `user` events).

`emit(…, channel)` sets it; `forwardCliEvent` (CLI) and `streamViaApi` (API) classify blocks
into channels. The **text stays human-readable** — the channel is only a styling hint, so the
SQLite run log (`appendRunResponse`) stays readable too (non-`text` channels are set off with
blank lines). The chat store groups consecutive same-channel deltas into `MessageSegment`s
(`{ kind, text }`), and `ChatPanel` renders each: prose as markdown, thinking/result as
collapsible blocks, tool as a "Command" card. See [`renderer.md`](./renderer.md).

### The `stream` payload

Beyond `messages` / `system` / `model` / `maxTokens` / `cwd`, the payload carries
routing/audit metadata that ends up on the run row and the agent graph: `source`, `specId`,
`agent`, `fileHints`, `manualRefs`, `skill`, `skillScope`, `routeReason`, `agentScope`, `kind`,
`taskId`, `wave`, `dependsOn`. Populate these when starting a run so History/Orchestrator/Graph
stay accurate. See the exact shape in `electron/preload.ts` → `claude.stream`.

## Permissions & model

- `settings.getPermissions()` → `{ allowedTools, permissionMode, allowBash }` feeds the CLI flags
  and constrains the API tool set.
- Model resolution is surfaced for transparency via `ModelSource`
  (`explicit | settings-default | cli-default | api-default`) and `resolved_model` on the run row.
