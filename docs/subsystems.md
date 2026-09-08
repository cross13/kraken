# Subsystems

Feature-specific subsystems that layer on top of the core. Each follows the same IPC pattern;
this doc explains the behavior and where the code lives.

## Agents & Skills

Octo reads agents and skills in **Claude Code's exact format and precedence** — don't invent a
parallel format.

- **Locations:** agents are flat markdown in `.claude/agents/*.md`; skills are a directory per
  skill at `.claude/skills/<name>/SKILL.md` — both in the workspace plus `~/.claude/` (global).
- **Symlinks count.** Skill managers (`npx skills add …`) install into `~/.agents/skills/<name>`
  and drop a **symlink** in `~/.claude/skills/`, and `readdir(withFileTypes)` reports a symlink as
  neither a directory nor a file. `listSkills` therefore accepts `isDirectory() || isSymbolicLink()`
  and lets the `SKILL.md` probe (which follows the link) decide. `listAgents` needs no equivalent:
  it filters on the `.md` suffix and `readFile` follows links on its own.
- **Precedence:** workspace overrides global on a name conflict.
- **The library's content lives in `electron/defaultLibrary.ts`**, separate from the seeding
  rules (`seedDefaults.ts`) and the IPC (`main.ts`). It is dependency-free on purpose: the
  `npm run hashes` script imports it directly with Node's TS stripping, no build and no Electron.
  `defaultLibraryEntries()` is the single list of `(relative key, exact body on disk)` — hooks
  included, serialized exactly as the seeder writes them.
- **Seeding is an upgrade, not just a first install** (`electron/seedDefaults.ts`).
  `seedDefaultAgents` / `seedDefaultSkills` / `seedDefaultSteering` / `seedDefaultHooks` (main)
  write the bundled library into `.claude/` and `.octo/` ("Seed defaults" in the UI;
  `*:create-default` IPC), and each file goes through `seedDefaultFile`, which decides whether the
  copy on disk is **the user's or ours**:
  - missing → written (`created`);
  - identical to the current default → nothing;
  - **recognised as a default nobody edited** → rewritten with the new version (`upgraded`);
  - anything else → left exactly as it is (`kept`).

  "Recognised" has two sources: the **ledger** (`seededDefaults` in electron-store — the hash of
  what Octo last wrote to that absolute path) and **`SHIPPED_DEFAULT_HASHES`** (every body Octo
  has ever shipped). The second is not a legacy bootstrap: the ledger is keyed by absolute path
  *on one machine*, so a teammate who clones a repo with `.claude/` committed has no entry, and
  that constant is the only thing that can tell their copy from an edit. **Every body you ship
  must be listed** — `npm run hashes` prints the merged constant, `npm run hashes -- --check`
  fails when something current is missing. A file whose hash matches neither is the user's and is
  never touched; seeding cannot destroy work. Each handler returns a `SeedReport` (`created` /
  `upgraded` / `kept`); the `workspace` store merges the four and the Agents and Hooks studios
  print it next to the button (`seedSummary` in `lib/library.ts`).
- **Upgrades also arrive on their own.** `workspace:seed-upgrade` runs the four seeders with
  `{ upgradeOnly: true }` — which returns early instead of creating a missing file — and the
  renderer calls it from `useWorkspace.openWorkspace` right after `workspace:open`. It brings an
  existing library up to date without ever installing one into a tracked tree behind the user's
  back; *that* decision stays with the first-run card. A per-root `seededLibraryVersion` in
  electron-store, compared against `LIBRARY_VERSION`, makes the usual case one map lookup rather
  than ~24 file reads on every boot. When it does rewrite something, `HomeView` says so once.
- **Skills are injected, not just labelled** — `SkillMeta.body` (the `SKILL.md` text) is prepended
  to the system prompt. See [`renderer.md`](./renderer.md) → Skill injection.
- The bundled SDD skill is `sdd-feature` / `sdd-bugfix` (by spec kind). `spec-task-executor` is
  the bundled task agent; `spec-doctor` is routed by the **Audit** action for drift detection.
- **Four format skills carry the document contracts** — `spec-requirements-format`,
  `spec-bugfix-format`, `spec-plan-format`, `spec-tasks-format`. `routeFormatSkill(file)` picks
  one by document and injects it next to the governing SDD skill, so the rules Octo's parsers
  enforce reach the model that writes the document. See [`renderer.md`](./renderer.md) → Skill
  injection.
- **Four specialists give per-task routing something to choose from** — `frontend-expert`,
  `backend-expert`, `database-expert`, `docs-expert`. Their front-matter `description` is written
  under a hard constraint: task routing appends `IMPLEMENTER_SIGNALS` to *every* task's keyword
  set, so a description containing one of those substrings (`implement` inside "implementation",
  `app` inside "approved" or "mapping") clears the specialist threshold on **every** task and
  beats `spec-task-executor` outright. A specialist's description therefore uses only its own
  `CAPABILITY_TAGS` vocabulary and none of the implementer signals. `npm run routes` proves the
  whole table still resolves as intended; it is the only guard, since nothing here type-checks.
- **`spec-planner` replaced `spec-design-architect` + `spec-task-planner`** when the design and
  task documents merged into `plan.md`. The old two are **not re-seeded**, but they are kept in the
  router's preference list after `spec-planner`, so a workspace that seeded them before keeps
  working. Their hashes stay in `SHIPPED_DEFAULT_HASHES` so a retired default is still
  distinguishable from a user's own agent; nothing deletes them.

## Tickets — trackers over MCP (`electron/mcpClient.ts` + `electron/tickets.ts`)

MCP servers are discovered from `<root>/.mcp.json`, from `projects[<root>].mcpServers` in
`~/.claude.json` (workspace tier — this is where `claude mcp add` inside a repo puts them, and
reading only the top level meant Octo could not see servers the user had been using in that very
directory), and from the two global files. A server declaring the legacy `sse` transport keeps that
declaration rather than being collapsed into `http`, so the UI can point at the modern endpoint
instead of surfacing a bare 404.

Octo used to *list* MCP servers and nothing more. It now has a small, dependency-free **MCP
client** — the same call `github.ts` makes, since a protocol this size is cheaper to own than to
depend on:

- **Transports**: `stdio` (spawn, newline-delimited JSON-RPC) and `http` (Streamable HTTP — POST
  the request, read back either a JSON body or an SSE stream). A connection is made per call and
  closed; Octo talks to a tracker a handful of times per spec, and a pool of long-lived children
  would be a lifecycle problem for no gain.
- **Sessions are re-established, not assumed.** `HttpSession.open()` does the handshake and keeps
  two things from it: the `Mcp-Session-Id`, and **the protocol version the server negotiated** —
  later requests must advertise what was agreed, not what was asked for, or a perfectly good
  session starts getting rejected. `request()` then retries **once** on a 404 carrying a session
  id, which the spec defines as "your session is gone, start a new one". That is not an edge case:
  sessions expire, and a remote server behind several nodes can route a follow-up to one that never
  saw the handshake — which is exactly what Atlassian's edge does.
- **Auth**: two paths, resolved by `mcpCredential`. `mcpTokensEncrypted` holds a manually entered
  **`Authorization` header value** — a bare token is sent as `Bearer`, one that names its own scheme
  is sent as-is, which is what makes Atlassian's `Basic base64(email:token)` work through the same
  field. `mcpOAuthEncrypted` holds OAuth records, deliberately in a *separate* slot: the token slot
  is handed straight to the header, so JSON in it would be sent as a bearer token. A 401 throws a
  typed `McpAuthRequired`, and every ticket IPC returns `authRequired` so the UI offers *Sign in*
  rather than pattern-matching on error text.
- **OAuth 2.1** (`electron/mcpAuth.ts`): RFC 8414 discovery → dynamic client registration as a
  *public* client (`token_endpoint_auth_method: 'none'` — a desktop app cannot keep a secret; PKCE
  is what protects the exchange) → authorization code with PKCE S256 → refresh. The redirect is an
  **ephemeral loopback port** (`listen(0, '127.0.0.1')`), created per attempt and closed in
  `finally`: RFC 8252 §7.3 requires servers to accept any port precisely so a native app can take
  one from the OS, and a fixed port is a local code-injection surface. Registration sends **both**
  `127.0.0.1` and `localhost` redirect URIs — the RFC prefers the literal, but there are reports of
  Atlassian's allowlist rejecting it. `scope` is omitted by default: this server publishes no
  `scopes_supported`, and a wrong scope fails inside the browser where Octo cannot see it.
  `tickets:sign-in` **stays pending until the redirect lands**, so the renderer just awaits it —
  no push channel. Refresh happens only within 60s of expiry, because `ticketConnection` runs in a
  loop from `tickets:list-open`.

On top of it, `tickets.ts` translates a moment in a spec's life into tool calls. Two rules shape
it:

1. **Every write is a `TicketAction` first** — `{tool, args, summary}`. `tickets:plan` builds them,
   the UI renders the literal call, and only `tickets:apply` sends it. Writing into a board the
   team shares has to be inspectable *before* it happens.
2. **`structuredContent` is optional, so the text block is parsed too.** `mcpCallTool` returns
   `structured` as the server's `structuredContent` *or* the JSON its text block is carrying —
   Atlassian answers the second way. Every normaliser here prefers structured data and falls back
   to scraping prose, so without that step the JSON was being scraped as if it were English and
   yielded nothing: a call that plainly succeeded reported "no sites". When a normaliser still
   comes up empty, the raw answer is handed to the UI rather than swallowed, because "the account
   has none" and "Octo cannot read this shape" need different fixes.
3. **Jira is a preset, and its tool names are pinned** (`electron/shared/jira.ts`). Discovery is
   actively unsafe there: the `['transition']` heuristic matches both `transitionJiraIssue` (a
   write) and `getTransitionsForJiraIssue` (a read), `['get','issue']` matches three tools, and the
   matcher takes the first in `tools/list` order — a server-side reordering would repoint a write
   capability at a read tool with nothing to notice it. Everything is **Markdown**: the Rovo server
   converts to and from ADF at its own boundary. Nothing writes the issue description, because
   `editJiraIssue` silently drops the media nodes Markdown cannot represent and would destroy
   attachments; the approved plan goes in as a comment. Jira transitions are addressed by **id**,
   so `planTicketSync` resolves them with a read-only `getTransitionsForJiraIssue` **while building
   the preview** — the panel shows the id that will be sent, which is the whole point.
4. **Adapters are per-tracker, mappings are discovered.** `discoverToolMap` matches capabilities
   (`create`, `set-plan`, `approve-plan`, `link-branch`, `link-pr`, `transition`, …) to tool names
   by heuristic against the server's own `tools/list`, and Library › Tickets lets the user correct
   it. The `tracker` preset is written against that server's real schema; everything else goes
   through `generic`. Octo cannot invent an API it has never seen.

**What is pending is derived from spec state, not from events firing** (`src/lib/ticketSync.ts`).
`pendingEvents(meta, files)` reads the phase, `meta.branch`, `meta.prUrl` and
`meta.ticket.applied[]`. Nothing is lost because the app was closed at the wrong moment, reopening
a phase cannot double-post, and a spec linked halfway through catches up all at once.
`SpecMeta.ticket` holds the link; `applied[]` is what makes every write idempotent.

**Starting from a ticket instead of a blank prompt.** `TicketInbox` is Home's **Entrada** pane —
the board's left column. It lists what is open across the enabled trackers as **one lane per
provider**, plus a separate *Ya con spec* lane pairing each covered ticket with the spec that
covers it (they used to be filtered out, which answered "did we already start this?" by hiding the
answer). Clicking a ticket **arms** it and the board offers its two legitimate entry points:
Requirements runs `planSpecFromTicket`, Build runs `quickPlanSpecFromTicket` — the same seeding
followed by the hands-off drafting chain. Both read the **ticket itself** through the `get`
capability — not just the row that was clicked — and `ticketSeed` shapes it into the documents:
`requirements.md` (or `bugfix.md`) gets the description and the ticket's own validation criteria
numbered `AC-n`, and `plan.md` is written too **when the ticket already carries a plan**. The text
is *copied*, never paraphrased: whoever wrote the ticket wrote the requirement, and running it
through a model would only lose detail. The link is written at creation and `spec-created` marked
applied.

**Reading a ticket costs nothing.** Until `tickets:detail` existed, the only thing you could do
with a ticket was arm it and drop it on a column — so the only way to find out whether it was the
work you thought it was, big enough to split, or already carrying a plan, was to create a spec and
look at what came out. That leaves litter on disk for a question that should be free. The handler
calls the `get` capability and returns a **`TicketDetail`**: the row re-read from the fuller
response, the description, a plan the ticket already carries and whether it is signed off, the
criteria, the comments, the history, reporter/created, and estimate/logged minutes. Every field is
optional, because the two servers answer with different halves of it — Jira sends comments and no
plan, the tracker sends a plan, its criteria and its history and no comments. `raw` is always kept:
for a tracker whose shape nothing recognises, the server's own prose is the difference between a
panel that looks broken and one that shows the ticket in the tracker's own words. Nothing here
writes. `ticketReadArgs` is separate from `ticketRefArgs` because `getJiraIssue` declares `fields`
and `getTransitionsForJiraIssue` does not — and `comment` has to be named in `fields` or Jira's
comments never come back at all.

**Two readers that were quietly wrong**, both found by probing the live servers:

- **`plan` is a state sentence, not a plan.** The tracker's `plan` field says `"plan aprobado"` /
  `"plan sin aprobar"`; the document lives at `plan_document.plan`. Reading it by name wrote a
  `plan.md` whose entire body was the words *plan sin aprobar*. `planOf` takes the sub-document
  first and believes a bare `plan` string only when it looks like a document at all — more than one
  line. A one-line plan is not a plan.
- **Criteria were never imported.** `criteriaOf` looked for an array called `criteria`; the tracker
  uses that name for a *tally* (`"0 de 9 verificados"`) and keeps the list at
  `plan_document.criteria` as `{position, statement, state, state_label}`. It now searches the plan
  sub-document too and reads `statement`, so a spec seeded from a tracker ticket arrives with its
  real `AC-n` list — ten of them on the ticket this was found with, previously all dropped in
  silence.

Imported criteria are almost never in EARS form, and are deliberately left as they were. The
format check's `criteria-without-shall` finding is what closes that loop — a bullet under an
acceptance-criteria heading that does not say `SHALL` is invisible to `extractCriteria`, so it
never reaches Review and is never traced to a task. That was silent data loss for hand-written
documents too; now *Fix with Claude* rewrites them.

**Reading a ticket takes reading the tracker's own envelope.** Because `tools/call` responses vary
per tracker, `normalizeTicketList` is deliberately forgiving — it finds the first array anywhere in
the structured content, then the field names trackers agree on, and falls back to scanning prose for
`KEY-123 — title` lines. Three shapes have to be unwrapped before those names match anything:

- **`fields`.** Jira answers `{id, key, self, fields: {summary, status, priority, issuetype,
  assignee, updated, labels, parent}}`, so every name lives one level down. `rowScopes` reads a row
  and its `fields` as one flat namespace. Without it a Jira row matched nothing but `key`, and the
  Entrada card was a bare ticket number.
- **ADF.** Jira never stores rich text as a string; a description is `{type: 'doc', content: […]}`,
  which every `typeof v === 'string'` test skips. `adfText` flattens it, including the `mention`,
  `emoji` and `inlineCard` nodes that keep their whole rendering in `attrs` and have no children.
  This is why a Jira spec's brief and its seeded `requirements.md` now carry the ticket's words.
- **`fields` as a *request*.** `searchJiraIssuesUsingJql` declares an optional `fields`, and left
  out it defaults to a generous set (summary, description, status, issuetype, priority, labels,
  components, assignee, reporter, created, updated, resolution, project). `searchArgs` names
  `JIRA_LIST_FIELDS` anyway: it drops the five nobody reads and adds **`parent`**, which the
  default omits and which is the only field that can name a ticket's epic. Verified against the
  live server's `tools/list`, not assumed — an earlier version of this note claimed the endpoint
  returns bare ids without it (true of the raw REST endpoint, not of this tool) and carried a
  retry-without-`fields` fallback that the schema made unnecessary.

Past `key` and `title`, `TicketSummary` carries `status` + `statusLabel`, `priority`, `type`,
`assignee`, `group` (mission/sprint/epic/parent), `labels`, `updated` and `url`. Every one is
optional and simply absent when the tracker sent nothing — the card renders what it actually got,
because padding a line with `—` makes an empty field look like an answer. `status` stays the API's
own word (`in_progress`, `done`) so `isDoneStatus` keeps working on a tracker that localises its
labels; `statusLabel` is what that tracker's UI writes (`Hecha`). The tracker's `plan` field
(`"plan sin aprobar"`) is folded in as a label — it is prose about the ticket, but it answers *can
this start?*, which is the question Entrada exists to answer. `browseUrl` builds a `…/browse/KEY`
link from the provider's configured site when the server sends none: Jira rows carry only `self`,
an API endpoint, and that URL is what ends up in the seeded doc's *From TICKET-1* line — previously
a literal `#`. "Not done" is filtered client-side by `isDoneStatus`, because no two trackers agree
on the status enum.

**A provider is checked before it is called.** `missingConfig` turns "this cannot work yet" into a
sentence naming what to set — an unmapped `search` tool, or a `tracker` with no client. The
tracker scopes tasks per client, and an early `searchArgs` sent `mission: "active"` *without* one,
which the server cannot resolve; the list came back as the server's own complaint about an
argument the user had never seen. The `scopes` capability (`list_clients`, `list_projects`, …)
exists so the client is picked from a list rather than typed from memory.

A failed connection produces a **copyable report** — the endpoint that answered, the declared
transport, the auth mode, whether a session had been established, the JSON-RPC method, and the
server's own words. `sessionEstablished: false` on an `initialize` is the tell for a wrong URL,
which reads nothing like the "missing session" the server reports. Copy goes through Electron's
clipboard (`shell:copy`), not the DOM's.

UI: **Library › Tickets** (`TicketsStudio`) is **one tab per tracker**, with a status dot on each.
Inside a tab, two things carry the design. A **single status line** answers the only question
anyone has — can this list my tickets, and if not what is missing — with the button that fixes it
right there; it is derived, not stored, from auth mode, whether the tool list has been read, and
whether a scope is set. The rest is **three numbered steps in dependency order** (Connect → Scope →
Sync), because you cannot pick a project before signing in and presenting those as equals is what
made the previous flat panel unusable. The eleven-row tool mapping is real but advanced, so it
collapses, `TicketInbox` as Home's Entrada pane, and `TicketPanel`, which renders compact in the spec flow's briefing
aside and full inside Ship. All three render nothing at all when no tracker is configured. The
fourth is **`TicketDetailView`**, the read-first slide-over (`Overlay` kind `ticket`) — reached
from the eye on any Entrada row and from the ticket key in `TicketPanel`.

## Hooks — event-driven agent hooks

Fire Claude runs automatically on app-level events.

- **Config:** JSON files in `.octo/hooks/*.json` (+ global `~/.octo/hooks/`), shape =
  `HookConfig`. Action types: `'ask-claude' | 'run-command'`.
- **Triggers** (`HookTrigger`): spec-advance, spec-done, file-save-in-app, task-complete,
  wave-complete, manual.
- **Engine:** `maybeFireHooks(trigger, ctx)` is called at trigger points — `advanceSpec` →
  spec-advance/spec-done; `writeSpecFile` → file-save-in-app; the TaskRunner → task-complete /
  wave-complete; plus manual. `fireHook` reuses `streamClaude` (so hook runs appear in History)
  via `getMainSender()`.
- **Loop guard:** hook runs write through the **CLI, not the `fs:write` IPC**, so they can't
  retrigger file-save hooks; plus a per-hook **cooldown** (`hookCooldown`).
- **Defaults:** `seedDefaultHooks` ships `code-validate-improve` (wave-complete) and
  `docs-changelog` (spec-done).
- **NL authoring:** `hooks.generateFromNl(root, description)` asks Claude to draft a hook config.
- **UI:** `HooksView` (sidebar) + `HookEditor` (tab). Run log in the `hook_runs` table; live
  events on the `hook:event` channel (`hooks.onEvent`).

## Steering — project context injection

- **Source:** markdown in `.octo/steering/*.md` (+ global), **plus** root `AGENTS.md` /
  `CLAUDE.md` as implicit `always` context.
- **Inclusion modes** (`SteeringInclusion`): `always | fileMatch | manual | auto`.
- **`composeSteeringSystem`** resolves which files apply and is prepended to `payload.system`
  **inside `streamClaude`** — so every run (chat, task, hook) gets steering uniformly. A doc whose
  name is in `manualRefs` (i.e. **pinned**) is force-included regardless of its mode.
- **Pins** — the user can pin any doc to force-include it in every run. Pins are persisted per
  workspace via `electron-store` (`steeringPins`) and merged into `manualRefs` inside
  `streamClaude`, so **no per-call-site change** is needed for pins to apply everywhere.
- **CRUD + preview IPC:** `steering:list`, `steering:create-default`, `steering:write`
  (create/update a frontmatter `.md`, handles rename via `prevPath`), `steering:delete` (guarded to
  `.octo/steering` only — root `CLAUDE.md`/`AGENTS.md` are read-only), `steering:preview`
  (returns the exact injected block for given file hints + pins), `steering:get-pins` /
  `steering:set-pins`. `SteeringFile.editable` flags whether a doc can be edited/deleted.
- **UI:** the full-page **`SteeringStudio`** (`views/SteeringStudio.tsx`) — Library tab (list +
  editor: name, description, inclusion mode, fileMatch glob, scope, body, pin) and an Injection
  Preview tab. Mounted at Library › Steering (also reachable via ⌘K).

## Multi-agent orchestration

- **Stores/UI:** `src/stores/orchestrator.ts` + `views/TaskRunner.tsx` (waves inline in the
  Spec flow's Tasks stage) + `OrchestratorView` (Activity › Runs).
- Tasks in a wave run as **parallel concurrent Claude subprocesses** (one `requestId` each),
  capped by `maxConcurrency` — one control, shown on the tasks board and Activity › Runs.
- The `orchestrator` store is the global run registry; `taskRunningCount()` (task/refine/polish
  only) governs wave scheduling so chat/spec runs don't throttle it.
- **Per-task agents:** `- [ ] T1 @agent-name: …` (parsed in `tasks.ts`; precedence in
  `agentRouter.ts`).
- **The plan stays alive:** the executor and refine system prompts (`buildExecutorSystem` /
  `buildRefineSystem` in `TaskRunner.tsx`) require a run that deviated from `plan.md` to append
  `### Critical Decision — T3: <title>` (what / why / what it affects) under the plan's
  `## Critical Decisions` section — never touching its `## Tasks` section, which `tasks.md` was
  derived from. `spec-doctor` audits those entries against the rest of the plan.
- `runWave` / `pump` schedule with **failure isolation**. **Autopilot** ("Run all") runs all
  waves autonomously, waiting for blocking hooks between waves and advancing to `done` at the end.
- When the last task completes the spec **auto-advances to `done`** and the flow lands on the
  **Ship** stage (auto-generated summary + commit/PR). `specs:set-phase` reopens a phase
  (Re-sync). The **Audit** action routes to `spec-doctor`.
- The top bar and SurfaceNav show a live running-count badge; Activity › Runs shows live agents
  with elapsed time + per-run / stop-all cancel and the activity log.

## Git & GitHub

- **`electron/git.ts`** — per-workspace git helpers (status, branches, checkout, create-branch,
  commit/push, pull/fetch, stage/unstage) surfaced through `git:*` IPC. All return
  `{ ok, error?, output, … }` result objects.
- **`electron/github.ts`** — a **dependency-free** GitHub REST client. Token via `safeStorage`
  (same pattern as the API key). Exposed through `github:*` IPC: repo resolution from the `origin`
  remote, token validation, remote-branch listing (the valid PR base targets), and PR
  list/create/merge. Returns `GitHubOpResult<T>`.
- **UI:** the **Source Control** sidebar panel (`SourceControlView`) drives both. It is
  **spec-aware** — it reads the active editor tab's spec for branch/commit/PR defaults and writes
  branch/commit/PR state back into `SpecMeta` (`branch`, `lastCommitHash`, `prNumber`, …). Current
  project + branch also show in `TitleBar` / `StatusBar`, which deep-link into this panel. The
  New-PR dialog's base-branch field is a searchable typeahead (`BranchCombobox`) backed by
  `github.listBranches(cwd)`, defaulting to the repo's actual default branch. The dialog also has a
  **Generate with Claude** button that streams a PR description from the spec's content
  (`source: 'pr-description'`, registered in the orchestrator) straight into the body field.

## Terminals — interactive PTY sessions

Unlike `claude:stream` (one-shot `-p`, fire-and-forget, no stdin), terminals are a **fully
bidirectional** channel. This is what lets the user answer Claude's `AskUserQuestion`, respond to
permission prompts, and run real CLI slash commands — exactly as in a normal terminal.

- **`electron/terminal.ts`** — `TerminalManager` owns the live `node-pty` processes keyed by
  `termId`. It only manages lifecycle (`create`/`write`/`resize`/`kill`/`killAll`); the main
  process owns the policy. node-pty loads from its **N-API prebuilt binary** (ABI-stable across
  Node and Electron — no from-source rebuild), and the module restores the `spawn-helper`
  executable bit on load (a common prebuild gotcha that otherwise fails every spawn with
  `posix_spawnp failed`). Packaged builds unpack it via `asarUnpack` (see `package.json` build
  config) so the binary + helper are spawnable.
- **`createTerminal()` in `main.ts`** resolves the spawn policy: `profile: 'shell'` runs the
  user's login shell; `profile: 'claude'` runs the real `claude` binary (resolved via
  `detectCli()`, falling back to a shell if not found). Env always uses `expandedPath()` + `TERM`,
  cwd defaults to the workspace root. Wires `onData`/`onExit` to the renderer over `terminal:data`
  / `terminal:exit`. `mainWindow` `'closed'` → `terminals.killAll()`.
- **IPC:** `terminal:create` (invoke), `terminal:write` / `terminal:resize` / `terminal:kill`
  (send), data/exit event channels. See [`ipc-contract.md`](./ipc-contract.md) → `terminal`.
- **UI:** `TerminalView` (xterm.js + fit + web-links addons) renders each terminal; sessions
  live in the `ui` store and render under **Activity › Terminals** (session chips + *Terminal* /
  *Claude session* buttons; also creatable from ⌘K). Panes are **kept mounted (display-toggled)**
  so the PTY survives navigation — unmounting kills the shell. See [`renderer.md`](./renderer.md).
- **Open in Chrome:** the web-links addon routes URL clicks to `shell.openUrl`, and the window
  open-handler does the same, so any http(s) URL a session emits opens in Google Chrome (falling
  back to the default browser).

## Travel Display — a wide second window (`main.ts` window section + `WideApp`)

A compact, height-frugal **fleet monitor** for a secondary ultrawide bar display (e.g. a Corsair
Xeneon Edge, ~2560×720). It shows what's running at a glance while the main window keeps its full
layout on the primary screen — handy when travelling with a second display.

- **Window lifecycle (`main.ts`):** `createWideWindow()` creates a single `frame: false` second
  `BrowserWindow` (`wideWindow`), loading the same renderer bundle with a `#wide` hash
  (`…#wide` in dev, `loadFile(…, { hash: 'wide' })` packaged). `pickTravelDisplay()` uses the
  `screen` module to choose a **non-primary** display (favouring a very-wide one, `aspect > 3`)
  and fills its `workArea`; with no secondary display it falls back to a compact wide bar on the
  primary so the mode is still usable/testable. `toggleWideWindow()` opens or closes it.
  `notifyWideState()` broadcasts `window:wide-state` (`{ open }`) to the **main** window so the
  CommandBar toggle stays in sync. Teardown is guarded: closing the main window destroys the
  travel window (no orphan), and `screen`'s `display-removed` closes it if its display is unplugged.
- **State sync is one-directional.** A separate window is a separate renderer with its own
  Zustand stores, so they can't share memory. The **main window is authoritative**: an effect in
  `App.tsx` subscribes to the `orchestrator` store and pushes a serialized `FleetSnapshot`
  (`{ runs: ActiveRun[]; maxConcurrency }` — the cap rides along because the travel window draws a
  task-slot meter and the control lives in the main window's store) via `fleet.push` (throttled
  ~250 ms, plus once on mount); the main process forwards it to the travel window over
  `fleet:sync`. The travel window is a **read-only mirror** — it never runs its own
  `startRun`/`finishRun`.
- **Opening mid-run: the snapshot handshake.** The main window only pushes when its registry
  *changes*, and its "once on mount" push happens at app start — long before the travel display is
  usually opened. So the main process **caches the last snapshot** (`lastFleet`, updated on every
  `fleet:push`) and replays it into a freshly-opened travel window. The replay has two halves
  because they race: the main process sends it on the wide window's `did-finish-load`, and the
  travel renderer **pulls** it with `fleet.request()` the moment its `fleet:sync` subscription is
  live (`fleet:request` → the main process echoes `lastFleet` back to that sender). Without this a
  display opened while a long run was in flight sat on "No agents in flight" until something
  started or finished.
- **Live log mirror.** Beyond the registry snapshot, `emit()` also forwards each `claude:event`
  (delta/done/error, all channels) to the travel window when one is open, so its detail column can
  show what each agent is actually doing in real time. This is additive — the main window still
  receives the same events; the travel window just accumulates them per `requestId`. As a
  **fallback**, `WideApp` also polls `history.getRun(requestId)` for the selected run: the DB
  mirrors every run's streamed `response` (and the exact `command`/`tools`/`permission_mode`), so
  the log fills in even for runs that started before the window opened or already finished — the
  travel window works whether or not the live forward is reaching it.
- **UI — the colony (`src/components/wide/WideApp.tsx` + `OctoMascot.tsx`):** the renderer entry
  (`src/main.tsx`) branches on `win.isWideRenderer()` to render `WideApp` instead of `App`. It is
  self-contained (no sidebar deps) and the whole window is **one colony**: every run in flight is
  an octopus (`OctoMascot` — **the same drawing the app's brand mark is made of**: `OctoMark`
  renders it at `detail="mark"`, so the main window and the travel window show one creature, not
  a logo and a mascot that merely rhyme. Coloured entirely from theme variables so it re-skins
  with the app; see `docs/renderer.md` → Brand), and **everything the creature does carries
  meaning**:
  - **Which zone it lives in = which spec it belongs to.** Runs are grouped by `specId` into
    dashed-bordered zones (runs with no spec — chat, hooks, stray audits — share a trailing
    "Assistant & system" zone). Zones are sized by member count (`Nfr` grid columns), and each
    carries the spec name, its wave, and a segmented progress row built from every run this window
    has seen for that spec.
  - **Where it sits inside the zone = whether it is moving.** `place()` puts live work along the
    upper band and blocked work in the lower right, from a stable per-`requestId` hash — so a
    creature never jumps between renders, and no two neighbours share an animation delay.
  - **The dashed violet leash = what it waits on.** Each queued run's `dependsOn` is drawn as an
    animated curve to the run holding it up (an SVG overlay in zone percentages, with
    `vector-effect: non-scaling-stroke` so the dashes stay uniform under the non-uniform viewBox).
  - **The face = the status.** Five `MascotState`s: big blinking eyes while working (green),
    violet while *deciding* (`spec`/`audit` runs — the brand's second accent), shut with floating
    `zzz` while queued, happy arcs when done, crossed out and shaking when it failed.
  - **The katana's pose = the verb.** The creature is a chibi *samurai* — a kabuto bowl with a
    `kuwagata` crest, fukigaeshi, a lacquered `shikoro` neck guard and a chin plate that
    deliberately leaves the mouth free to emote — and its sword carries the run's activity at a
    distance the face can't: drawn and **cutting** (with a slash arc) while working, **sheathed**
    with a hand on the hilt while deciding, **resting** while queued, flicked clean (*chiburi*,
    with drifting petals) on a win, and **driven into the ground** on a failure. Armour animates a
    beat behind the head (`octo-lag`), which is the follow-through that makes it read as armour.
    `detail="simple"` drops the rivets, lacing, mon and cel shade for anything under ~40px — the
    reef and the compressed colony use it, exactly as a sprite sheet would carry a second drawing.
  - **The speech bubble = the tool it is running right now**, parsed back out of the live `tool`
    delta (`toolHeadline` unwraps the markdown `summarizeToolUse` emits into "Edit
    src/lib/session.ts" / "Bash npm run typecheck") with the newest output line beneath it.
  Below the zones a **reef** keeps the last 8 finished runs as small, dimmed creatures with their
  duration. The header carries the running/queued count, the project and model, a **task-slot
  meter** (filled = running, violet = queued, against `maxConcurrency`), the leash legend, *Stop
  all*, zoom, theme and close.
- **Opening a run.** Clicking (or ↵ on) a creature pulls it forward: the left ~46% becomes a
  focus panel with its mascot, title, live elapsed, the full parameter grid (agent, model,
  backend, kind, skill, source, spec, task, wave, route reason, scopes, permission mode, tools,
  deps, requestId) and its **live streamed log** (channel-styled, auto-scrolling, sticky-bottom,
  falling back to the DB-recorded `response`); the colony compresses into a 2×2 grid on the right
  rather than disappearing, so the rest of the fleet stays in view — the opened creature keeps an
  accent ring and its dependents still hang off it. *Esc* or *Back to the colony* returns.
- **Quiet mode.** A colony that drifts all day competes with reading, so the header has a
  **quiet toggle** (persisted to `octo.wideQuiet`, defaulting on when `prefers-reduced-motion` is
  set) that adds `.k-quiet` and freezes every colony animation — drift, bob, sway, eye scan, zzz,
  leash dashes and bubble dots — at once. The same rules apply under a
  `prefers-reduced-motion: reduce` media query regardless of the toggle. Keyframes and the
  `.k-mascot*` / `.k-bubble` / `.k-leash` classes live in `styles.css` under "Travel Display: the
  colony", reusing `octo-bob`/`octo-tent-sway`/`octo-eye-scan` from Brand. Theme carries over
  automatically because `data-theme` is persisted in per-origin `localStorage` shared by both
  windows.
- **Crisp zoom.** A dense panel rendered ~1:1 (2560×720, `devicePixelRatio ≈ 1`) makes the compact
  UI hard to read. The header carries a zoom control (−/%/+, persisted to `octo.wideZoom`,
  defaulting off `devicePixelRatio`) wired to `win.setZoom`, which calls `webFrame.setZoomFactor`
  **directly in the preload** (zoom is a renderer concern — no main-process handler). `setZoomFactor`
  **re-rasterizes** the page at the new scale, so text stays sharp (unlike a bitmap upscale) while
  the layout still fits the window.
- **Cancellation** reuses the existing `claude:cancel` IPC directly (any renderer can call it) —
  there's no separate cancel channel. Cancelled runs finish in the main window, which pushes a
  fresh snapshot; the travel window also drops them optimistically for snappiness.
- **Entry points:** the CommandBar icon button (next to the theme toggle, reflecting open state)
  and the ⌘K command *Open Travel Display*, both calling `win.toggleWide()`.
- **IPC:** `window:toggle-wide` / `window:is-wide-open` / `window:wide-state` / `window:focus-main`
  and `fleet:push` / `fleet:request` / `fleet:sync`.
  See [`ipc-contract.md`](./ipc-contract.md) → `win` / `fleet`.
