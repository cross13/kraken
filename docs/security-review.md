# Security review — 2026-09-08

A read of the whole codebase for leaked credentials and for the ways untrusted input reaches
privileged code. Scope: `electron/`, `src/`, `scripts/`, `website/`, and everything tracked in git.
Not in scope: dependency CVEs (no audit run here) and the packaged-build signing chain.

**Headline:** no secret is committed anywhere in the repository. One high-severity issue was found
and **fixed in this change**; one more is high and **still open** because it needs a product
decision, not a patch. The rest are hardening and honesty items.

| # | Severity | Status | Issue |
|---|---|---|---|
| [H-1](#h-1) | High | **Fixed** | Untrusted markdown rendered as live HTML into a renderer that holds `window.octo` |
| [H-2](#h-2) | High | Open | A workspace can ship a hook that runs an arbitrary shell command, with no trust prompt |
| [M-1](#m-1) | Medium | Open | `fs:read` / `fs:write` accept any absolute path |
| [M-2](#m-2) | Medium | Open | The whole prompt is passed as an argv element to the CLI |
| [M-3](#m-3) | Medium | Open | Secrets silently fall back to base64 when the OS keychain is unavailable |
| [M-4](#m-4) | Medium | Open | `sandbox: false` on both windows |
| [L-1](#l-1) | Low | Open | Run history stores full prompts and responses unencrypted |

---

## Credential scan

Clean. Every hit for `sk-ant-`, `ghp_`, `github_pat_`, `AKIA…`, `xox…` and PEM private-key headers
is a placeholder or documentation:

- `src/components/sidebar/SettingsView.tsx` — input `placeholder` attributes.
- `src/components/sidebar/SourceControlView.tsx` — same.
- `docs/backends.md`, `website/src/pages/*` — prose describing the key format.

Secrets at rest are handled through one path: `encryptSecret` / `decryptSecret` in
`electron/main.ts`, over Electron `safeStorage`, persisted by `electron-store`. The Anthropic key,
the GitHub token and every MCP tracker credential go through it. Nothing writes a credential to a
log, and `updateRunCommand` deliberately redacts the `-p <prompt>` argument before recording the
invocation (`electron/main.ts`, the `redactedArgs` line).

---

## <a id="h-1"></a>H-1 — Untrusted markdown became live HTML · **High · Fixed**

**Where:** `src/lib/markdown.ts` → `src/components/Markdown.tsx:64`.

`renderMarkdown` called `marked` with no sanitizer. Since marked v5 there is no `sanitize` option
and raw inline/block HTML in a document is passed through verbatim; the result was injected with
`dangerouslySetInnerHTML`. `marked`'s `cleanUrl` also only `encodeURI`s an href — it does not
reject `javascript:`.

Every markdown surface in the app renders through that one component, and several of them carry
text the app did not author:

- `src/components/views/TicketDetailView.tsx:172, 200, 242` — a ticket's **description, plan and
  comments, fetched from a remote Jira / Linear / MCP server**.
- `RunViewer` / `ChatPanel` — model output.
- `SkillViewer` / `AgentViewer` / `SteeringStudio` — bodies read off disk from `.claude/`.

**Impact.** A Jira ticket description containing `<img src=x onerror=…>` executed script in the
renderer. That renderer is context-isolated but exposes `window.octo`: filesystem read and write
at arbitrary paths (see M-1), `claude.stream` (which spawns a subprocess in the workspace), the
whole `git:*` surface, and the ability to read tracker configuration. A ticket is data that anyone
with write access to the tracker can set, so this was a genuine remote → local-execution chain,
not a theoretical one.

**Fix applied.** `src/lib/markdown.ts` now overrides three renderer methods:

- `renderer.html` escapes its token — marked routes both block-level and inline `html` tokens
  through this one method, so raw HTML now renders as the text it is.
- `renderer.link` and `renderer.image` resolve the href through a scheme allowlist
  (`https:`, `http:`, `mailto:`, `tel:`, fragments and relative paths; images additionally accept
  `data:image/<png|jpe?g|gif|webp|avif>;base64,`), test it with whitespace and control characters
  stripped so `java\nscript:` cannot slip through, escape the href and title, and add
  `rel="noopener noreferrer"`. A rejected link still renders its text rather than vanishing.

`codespan` was already safe — marked's tokenizer escapes that token's text before the renderer
sees it (`node_modules/marked/lib/marked.cjs`, `codespan()`).

**Verified** against 15 cases — raw inline and block HTML, handlers on raw elements, `javascript:`
in a link and in an image, mixed-case and newline-obfuscated variants, `data:text/html`, title-
attribute breakout — plus five that must keep working (normal links, relative links, remote and
inline images, ordinary markdown). All inert, nothing legitimate lost.

**Residual risk.** Mermaid diagrams still render to SVG that is assigned with `innerHTML`
(`Markdown.tsx`). Mermaid is initialised with `securityLevel: 'strict'`, which is the right
setting, but it is now the only remaining path from document text to live markup — worth keeping
in mind when upgrading mermaid.

---

## <a id="h-2"></a>H-2 — A workspace can ship a hook that runs any shell command · **High · Open**

**Where:** `electron/main.ts` — `listHooks` and `fireHook`.

`listHooks(root)` reads hook definitions from **`<workspace>/.octo/hooks/*.json`** as well as the
global `~/.octo/hooks/`. A hook with `actionType: 'run-command'` is executed as:

```ts
const shellBin = isWin ? 'cmd' : process.env.SHELL || '/bin/sh';
const shellArgs = isWin ? ['/c', hook.command] : ['-c', hook.command];
spawn(shellBin, shellArgs, { cwd: root, env: { ...process.env, PATH: expandedPath() } });
```

`maybeFireHooks` skips only disabled hooks and a per-hook cooldown. There is no trust prompt, no
confirmation, and no distinction between a hook the user wrote and one that arrived with a
`git clone`.

**Impact.** Cloning or opening an unfamiliar repository that contains
`.octo/hooks/evil.json` with `{"enabled": true, "trigger": "file-save-in-app", "actionType":
"run-command", "command": "…"}` gives that repository arbitrary code execution as the user, on the
next ordinary action — saving a spec document, advancing a phase, or completing a task. The
command inherits the full environment.

This is the same class of risk as a repo-local build script, and it is not unreasonable for a
developer tool to have it — but the app currently gives no signal that it exists.

**Recommendation** (needs a product decision, hence not patched here):

1. A **workspace trust prompt**, the way VS Code does it: on first open of a workspace that
   contains any workspace-scoped `run-command` hook, show the commands and ask. Persist the answer
   per workspace path.
2. Or: restrict `actionType: 'run-command'` to **global scope only**, so a repository can ship
   `ask-claude` hooks but never a shell command.
3. At minimum: force `enabled: false` on workspace-scoped `run-command` hooks discovered for the
   first time, and surface them in Library › Hooks with the command visible.

`ask-claude` hooks are a much lower risk — they run Claude under the configured permission mode
rather than a raw shell — but they still let a repository steer an agent that has your tool
permissions, so the trust prompt should mention them.

---

## <a id="m-1"></a>M-1 — `fs:read` / `fs:write` accept any absolute path · **Medium · Open**

**Where:** `electron/main.ts`:

```ts
ipcMain.handle('fs:read', (_e, p: string) => fs.readFile(p, 'utf8'));
ipcMain.handle('fs:write', (_e, p: string, content: string) => writeFile(p, content));
```

No confinement to the workspace, `~/.claude` or `~/.octo`. In normal operation the renderer only
ever passes paths it got from `specs:*`, `agents:list` or `skills:list`, so nothing is wrong today
— but the handler is the boundary, and it currently isn't one. This is what turned H-1 from an
annoyance into a serious finding.

**Recommendation.** Resolve the requested path and require it to sit under one of the roots the
app legitimately touches (the open workspace, `~/.claude`, `~/.octo`), rejecting anything else.
`removeSpec` already does the equivalent check with `path.resolve` before deleting, so the pattern
exists in the file.

---

## <a id="m-2"></a>M-2 — The whole prompt is an argv element · **Medium · Open**

**Where:** `electron/main.ts`, `streamViaCli`:

```ts
const args = ['-p', prompt, '--output-format', 'stream-json', …];
child = spawn(detect.binary, args, { env, cwd });
```

The composed prompt is system instructions + steering documents + the conversation, which in
practice includes source excerpts, `CLAUDE.md`, and ticket content. As an argv element it is
visible in the process table for the lifetime of the run: on Linux `/proc/<pid>/cmdline` is
world-readable by default, and on any platform another process running as the same user can read
it.

The run log already redacts it (good), so this is specifically about the live process table.

**Recommendation.** Pass the prompt on **stdin** instead. The CLI accepts it, `activeStreams`
already owns the child, and it removes the exposure entirely.

---

## <a id="m-3"></a>M-3 — Secrets silently fall back to base64 · **Medium · Open**

**Where:** `electron/main.ts`, `setApiKey` and `encryptSecret`:

```ts
if (!safeStorage.isEncryptionAvailable()) {
  store.set('apiKeyEncrypted', Buffer.from(key).toString('base64'));
  return;
}
```

When the OS keychain is unavailable — a Linux box with no keyring service running is the common
case — the key is stored **base64-encoded, which is encoding, not encryption**, under a field
named `apiKeyEncrypted`, in a world-readable `config.json` in the app's userData directory. The
same branch exists in `encryptSecret`, so it covers the GitHub token and every tracker credential.

Nothing tells the user this happened, and the documentation asserted the opposite. (The README's
claim has been corrected in this change; the code has not.)

**Recommendation.** Either refuse to store the secret and say why, or store it and show a
persistent warning in Settings › Connection. Silently downgrading the protection the UI promises
is the part that needs fixing, more than the storage itself.

---

## <a id="m-4"></a>M-4 — `sandbox: false` on both windows · **Medium · Open**

**Where:** `electron/main.ts` — `createWindow` and `createWideWindow`.

`contextIsolation: true` and `nodeIntegration: false` are both correct, which is the important
part. The Chromium sandbox is the remaining layer, and it is off. Worth confirming whether
anything actually requires it — the preload uses only `ipcRenderer`, which works sandboxed — and
turning it on if not.

---

## <a id="l-1"></a>L-1 — Run history is unencrypted · **Low · Open**

`electron/db.ts` records every Claude invocation with its full prompt and response into
`<userData>/octo.db`. That is the intended design (it is the run log), but it means source
excerpts, steering content and ticket text accumulate in an unencrypted SQLite file with no
retention limit. Settings › Danger zone can wipe it.

Not a bug — but it belongs in the security notes so nobody is surprised, and a retention window
would be a reasonable feature.

---

## Verified as sound

Things that were checked and are right, recorded so the next review does not redo them:

- **OAuth 2.1 for MCP servers** (`electron/mcpAuth.ts`) — RFC 8414 discovery, dynamic registration
  as a public client with `token_endpoint_auth_method: 'none'`, PKCE with `S256`, an **ephemeral**
  loopback listener created per attempt and closed in `finally`, `state` compared with
  `timingSafeEqual`, refresh only within 60s of expiry. The reasoning for loopback over a custom
  scheme is documented in the file and is correct.
- **CSP** (`index.html`) — `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  font-src 'self' data:; img-src 'self' data:; connect-src 'self' https://api.anthropic.com`. No
  remote script origin, no `unsafe-eval`. This is why fonts and mermaid are bundled rather than
  CDN-loaded.
- **Navigation** — `setWindowOpenHandler` denies every in-app window open and hands the URL to
  `openUrlInChrome`, which parses it and honours only `http:` / `https:`.
- **Git** (`electron/git.ts`) — `spawnSync('git', args)` with an argument array and no shell.
  No injection path from a branch or commit message.
- **GitHub** (`electron/github.ts`) — dependency-free `fetch`; the token travels in a header,
  never in a URL or query string.
- **MCP stdio transport** (`electron/mcpClient.ts`) — the configured command is split on
  whitespace and spawned directly, without a shell. The command comes from the user's own tracker
  configuration.
- **Pinned Jira tool names** (`electron/shared/jira.ts`) — deliberately not discovered
  heuristically, so a write capability can never be repointed at a read tool. Good instinct.
- **Ticket writes** — every write is built as a `TicketAction` and shown before it is sent
  (`tickets:plan` then `tickets:apply`). A remote server cannot cause a silent write.

---

## Suggested order of work

1. **H-2** — decide the trust model for workspace hooks. Everything else is smaller than this.
2. **M-1** — confine `fs:read` / `fs:write`. Cheap, and it is the backstop for any future H-1.
3. **M-3** — stop promising encryption the code did not deliver.
4. **M-2**, **M-4** — both are small, mechanical changes.
5. **L-1** — a retention window when someone has time.
