# Renderer (`src/`)

React 18 + Tailwind + Zustand. The renderer talks to the backend **only** through
`window.octo.*` (see [`ipc-contract.md`](./ipc-contract.md)). There is no global state outside
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
instead — a read-only fleet monitor mirroring the `orchestrator` registry as a **colony**: one
octopus (`wide/OctoMascot.tsx`) per run in flight, grouped into a zone per spec, leashed to
whatever it is waiting on, its face carrying its status and its speech bubble the tool it is
running; clicking one opens its full run detail beside the compressed colony. The CommandBar
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
`refreshAll`, `createSpec`, `deleteSpec`, `seedDefaults` (resolves with the merged `SeedReport`
of the four `*:create-default` handlers — seeding upgrades untouched defaults, so the Agents and
Hooks studios print `seedSummary(report)` beside the button). This is the entry point — most views read
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
- **Zen**: `zenOpen` + `setZen`/`toggleZen` — the full-window reading mode (`views/ZenReader`).
  It is *not* an overlay (it takes the whole viewport instead of sliding in beside a surface), so
  it lives on its own flag. It belongs to the document on screen: `setSurface` away from `spec`,
  `closeSpec` and `setSpecStage` all clear it, and `SpecFlow` clears it when `docKey` goes null.
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

Octo is a desktop window that ranges from ~1100px to ultrawide, so **surfaces are expected to
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
`overflow-x: auto` container so a surface never scrolls horizontally; long-form prose keeps a
reading measure because unbounded line length is a regression, not a win — but the *measure* is
what's bounded, not the surface. The spec document views are the worked example: **Source** and
**Edit** are `.k-full` (markdown source is code — it uses the whole window), and **Cards** is
`.k-wide` + `.k-cards` at `--k-card: 540px`, so a wide display gets two or three section cards
side by side, each still at a comfortable measure, instead of one narrow column in a sea of
gutter.

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
Animations include `flow` (progress shimmer), `pulse-dot`, and `slide-in` (the overlay panel).
When adding a colour, add a channel var to **all four** theme blocks and a token in the Tailwind
config.

### Type

Three families, **bundled with the app** (`@fontsource-variable/*`, imported in `src/main.tsx`):
body **Hanken Grotesk**, display **Space Grotesk** (`font-display`, headings and figures only —
never body text), mono **JetBrains Mono**. They used to be `<link>`ed from Google Fonts, which
meant a packaged or offline Octo silently fell back to the system UI font; the CSP now allows no
remote origin at all.

The stacks live in `styles.css` as `--font-sans` / `--font-display` / `--font-mono`, and
`tailwind.config.cjs` maps `font-sans` / `font-display` / `font-mono` onto those variables — so a
raw CSS rule and a utility class cannot drift apart, and the "Variable" family name (what
Fontsource registers) is stated once.

### Contrast

The ink ladder must stay **monotonic and legible on every surface it lands on**
(`ink-50 → ink-100 → ink-200 → dim → ink-400 → faint → ink-600`): body ink well past 7:1,
secondary text (`faint`, which carries most hints and metadata) ≥ 4.5:1, and the dimmest
(`ink-600`, decoration and disabled) ≥ 3:1 — measured against `bg`, `panel`, `card` **and**
`elev`, since a token that passes on the panel can still fail on a raised card. Light themes fail
the opposite way from dark ones: Daylight's `faint`, `good` and `warn` were 3:1 greys, greens and
ambers on white and had to be darkened to the 700 weights. Re-check the ladder after touching any
channel — a "more muted" token that ends up *darker* than the one above it is a bug.

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
  `--ink-600` (disabled, decoration) is `#848484` — the palette's `#6E6E6E` measured 2.5:1 on a
  raised card, which is invisible rather than quiet.
- **Radius 0, no shadows.** Hierarchy is a lighter grey plus a 1px accent border.
- **Fonts**: Space Grotesk is the **display** face only. It used to be set as the body font for the
  whole theme, which made every 11–13px label harder to read than it had to be; UI text is Hanken
  Grotesk like the other themes, JetBrains Mono for labels, metadata and timers.

Two token families exist for this: `accent-text` / `accent-num` alongside `accent`, and the whole
`agent` family (`agent`, `agent-2`, `agent-text`, `agent-tint`, `agent-fg`) plus `raised` and
`danger-text`. The legacy themes were built around a single accent, so there `agent-*` aliases the
accent — semantics only separate under Signal.

**Shape and elevation are themed too**, so a flat brand needs no per-component sweep:

- `borderRadius` maps to `--radius-*` — `rounded-lg` is 8px on Abyss, 0 on Signal. **`rounded-full`
  included** (`--radius-full`): 9999px on the legacy themes, 0 on Signal, which squares the ~40
  status dots, badges, pills and avatars in one move. The palette's own status marker is a 6px
  square, so this is the system, not a compromise.
- `boxShadow` maps to `--shadow-*`. Signal sets `panel` and `card` to `none` — hierarchy there is a
  lighter grey plus a 1px border — and turns `glow` into the one halo the palette allows, a 50%
  accent hairline.
- `styles.css` has no hardcoded radii left: the scrollbar thumb and the two Prism chips read
  `var(--radius-lg)` / `var(--radius)`.

**Motion is themed too.** `transition` reads `--dur` (150ms legacy, **120ms** on Signal) and
`duration-bar` reads `--dur-bar` (300ms / **250ms**) for progress fills; `animate-pulse-dot` runs at
1.8s. Reach for `transition` and `duration-bar` rather than a literal `duration-150`.

**Density.** Signal specifies a 4px scale with 26px padding on the active card, 14–15px on panels
and a 16px column gap. Those numbers describe the source design's task board, not Octo's surfaces,
so they were **not** retrofitted across existing components — a blind sweep would have been
guesswork dressed as a system. Treat them as the rule for **new** Signal-native surfaces, and as
the reference when a specific screen is reworked with the app in front of you.

**When adding a shadow or a radius, add the variable to all four theme blocks** — a literal px or
rgba value in a component is what this indirection exists to prevent.

**Which accent, and when.** Under Signal the two accents carry meaning, so pick by role, not by
looks:

| Use | Token |
| --- | --- |
| Primary button, progress bar, running dot, check, focus ring | `accent` (green) |
| Agent identity — its chip, avatar, banner, tool-call marker | `agent` / `agent-text` (violet) |
| Waiting on the user — open questions, "Awaiting approval", a blocked gate | `agent-text`, or `warn` |
| Success, a file added | `good` · **Caution** `warn` · **Error** `danger` / `danger-text` |
| Metadata that isn't either accent — the skill chip, a run kind, a modified file | `dim` on a neutral tint |

**There are no hardcoded Tailwind palette colours in `src/`** — no `amber-500`, `emerald-400`,
`sky-300`, `purple-300`. They were a third and fourth accent that never responded to the theme;
they now map onto `warn` / `good` / `dim` / `agent`. A `bg-<colour>-500` in a component is a bug.

One deliberate deferral: `text-accent` is still used at ~190 sites for both icons and small text.
Green measures 6.5:1 on `--panel`, so it is legible — but the system reserves `--accent-text`
(`#A6E62E`) for *text* and keeps `--accent` for fill. Telling icon from text at those call sites
needs eyes on the running app.

## Brand — one creature, not a logo and a mascot

**The brand mark *is* the colony's octopus samurai.** There is a single drawing in the app,
`OctoMascot` (`components/wide/OctoMascot.tsx`), rendered at three levels of detail; the Travel
Display uses the big two, and the main window's mark is the small one. The old `OctoLogo` (the
visored octopus from the Octopus Brand Kit) is gone — the app no longer wears two creatures.

| `detail` | Size | Where |
| --- | --- | --- |
| `full` | ≥ 64px | boot splash, `OctoLoader` md/lg, the colony's open run |
| `simple` | 40–64px | the reef, the compressed colony, Home's welcome hero, `OctoLoader` sm |
| `mark` | 14–26px | every mark in the main window (see `OctoMark` below) |

`mark` keeps arms, head, eyes and the kabuto silhouette, and drops the katana, mouth, chin guard,
neck guard, cel shade, blush, rivets and mon — at 16px those stop being detail and become a
smudge, and a blade sticking out of the nav rail's brand tile reads as an artefact rather than a
sword. Strokes are thickened (head 3.5 → 4.6, kabuto 2 → 2.8) so the silhouette survives the
downscale. Verified legible down to 14px.

**The mark is theme-driven**, not a fixed colourway: it takes `OctoMascot`'s `work` palette — rim
`--accent2`, body `--card`, eyes `--accent-num`, lacquer `--rail` — so it is green on Signal,
violet on Abyss, teal on Bioluminescent, and the app is never wearing two palettes at once. CSS
variables only resolve through `style`, never through SVG presentation attributes, which is why
every fill and stroke in the drawing is an inline style. `.octo-tile` behind it reads the accent
too and swaps to a white tile on Daylight, so no light variant of the mark is needed.

- **`OctoMark`** (`components/OctoMark.tsx`) — the mark everywhere in the main window. Props:
  `state` (defaults to `work`, the brand's resting expression; pass `done`/`fail`/`think`/`sleep`
  where the mark stands for a **run** rather than for the app), `animated`, `glow`, `detail`
  (default `mark`), `seed`. It supplies the `k-mascot-<state>` wrapper the colony's CSS keys off
  and the `k-mascot-bob` squash; `animated={false}` adds **`.k-still`**, which freezes that one
  instance, eyes included — the rail's mark is furniture and should not breathe at you all day.
  Size it with a **width class only** (`w-[18px]`, `w-11`); the drawing is square-ish
  (`MASCOT_ASPECT`) and sets its own height.
- **`OctoLoader`** (`components/OctoLoader.tsx`) — the "reading code" loader: the animated mark
  over a scrolling code shimmer + three pulsing dots. Props: `size sm|md|lg`, `label`, `showCode`.
  `sm` is 44px and takes `simple`; `md`/`lg` get the whole armour. Used for blocking states (e.g.
  Ship's summary generation); tiny inline button spinners stay `Loader2`.
- **Keyframes** — the mark's motion is the colony's motion, so `octo-squash`, `octo-tent-sway`,
  `octo-blink`, `octo-lag`, `octo-cut` &c. all live in `styles.css` under "Travel Display: the
  colony", together with `.k-quiet` (mode-wide freeze) and `.k-still` (per-instance freeze). Only
  `octo-tent-sway`, `octo-code-scroll`, `octo-dot-pulse` and `octo-glow-pulse` are declared in the
  "Brand" block, alongside **`.octo-tile`** — the app-tile background behind the mark (nav rail,
  welcome hero).
- **Boot splash** — `index.html` ships a static `#boot-splash` overlay: the same creature in the
  `work` state at full detail, hand-inlined as plain HTML/CSS with an inline copy of the keyframes
  it needs, because it paints before the bundle (and therefore before `styles.css`) exists.
  `App.tsx` fades and removes it once `restoreLast()` settles (min ~900 ms so it doesn't flash).
  **Keep the two keyframe copies in sync.** Its colours are Signal's literals — the CSP forbids
  the inline script that would read the persisted theme — so a non-default theme costs one
  brand-coloured frame.
- **App icon** — `resources/icon.svg` is still the **old visored mark** and is deliberately
  **inverted** versus the in-app creature: at 32px in a dock a dark tile with a thin rim
  disappears, so it uses the palette's primary-button treatment (brand green fill, `#0F1400` ink,
  `--accent-num` visor). Bringing the samurai to the icon needs a dedicated silhouette, not the
  same SVG scaled down. `npm run icon` rasterizes it to `resources/icon.png` with Electron itself
  (`scripts/render-icon.mjs`, no external SVG tooling); electron-builder converts the PNG per
  platform (`buildResources: resources`), and `main.ts` sets the dev dock icon (macOS) and the
  win/linux window icon from the same PNG.
- Live-state touchpoints use the animated mark instead of a spinner: the Assistant "Working…" bar
  and streaming avatar (`ChatPanel`), the spec drafting banner (`SpecFlow`), "Task in progress"
  (`TaskRunner`), the Runs header (`OrchestratorView`) and the Travel Display header (`WideApp`).

## Home (`views/HomeView.tsx`)

The launchpad. Its **composer creates specs** (the old Welcome bar only forwarded to chat):

- **Plan** (`lib/specActions.ts` → `planSpec`) — creates the spec (name via `specNameFromText`,
  kind via `specKindFromText` feature/bugfix detection) and opens the Spec flow at the first
  stage. It deliberately **starts no Claude run**: the composer text is persisted as
  `SpecMeta.brief` and quoted at the top of the seeded document, and drafting happens when the
  user presses *Draft … with Claude* at the gate bar. Gated flow.
- **Quick Plan** (`quickPlanSpec`) — the no-gates escape hatch: drafts requirements → plan (two
  documents, not three — the plan carries its own task waves and advancing derives `tasks.md`) →
  tasks back-to-back (advancing between), landing on Tasks ready to run. It passes `noStops: true`,
  so the Plan step never pauses to ask: it picks defaults and records them.
- Input ending in `?` routes to the Assistant instead (`chat.pendingPrompt`); `/` and `@`
  popovers still pick skills/agents.

Below: **In flight** spec cards (kind stripe, live run count from the orchestrator, phase
progress, Resume → `openSpec(id, stageForPhase(phase))`), **Shipped** recents (open the Build
stage), a **Manage** toggle that embeds `SpecsStudio` (analytics + per-spec runs/timeline +
delete), and a one-time **"Set up Octo defaults"** card that calls `workspace.seedDefaults()`
(replaces the per-module Seed buttons; dismissal persisted in `localStorage`).

## The spec flow (`views/SpecFlow.tsx`)

One continuous guided surface per spec — the whole lifecycle on one screen, framed like an
editor (Kiro-style): **file tabs** (`requirements.md` / `plan.md` / `tasks.md`, accent-underlined,
locked stages dimmed) over a single **spec strip** — `Spec: <name>`, the mono breadcrumb
(`› <id> › <file>.md`, showing `summary.md` under Ship and `requirements.md · open questions`
under Clarify) and, pushed right, the numbered phase chips (① Requirements ② Plan ③ Build). The
breadcrumb and the chips share one row on purpose: vertical space belongs to the document. The tab
row also carries save status, the doc **view switcher** and **one overflow menu** (Audit · Find
open decisions · Reopen tasks/Re-sync · Delete spec).

The **view switcher** (`ViewSwitcher`) is a labelled segmented control — `Source` · `Cards` ·
`Review` · `Edit`, icon **and** word, the active one a pressed pill (Edit in accent, because it is
a mode). Beside it sits the **Zen** button (⌘⇧Z), which is not a fifth view: it leaves the flow
entirely for the reading mode below. `Review` appears on **both authored documents** — the plan and the requirements/bugfix —
and not on `tasks.md`, whose review is the task board (see below). The group renders only while a document is actually on screen (`onDocument`/`docKey`:
the define stage, the Plan stage's `plan.md` tab, the Build stage's `tasks.md` tab) — not over
Clarify, the task board or Ship. **Each document remembers its own view** (`views`, keyed by
`SpecDocFile`): the plan and the requirements open on Review, `tasks.md` on Source, and switching
files no longer drags Edit mode along. Two other ways into editing back it up: **⌘E** toggles Edit ↔ Source from anywhere on a
document (⌘⇧E is the Explorer, hence no shift), and **double-clicking the source** opens the
editor, because clicking into text to type is the reflex. Stage bodies:

- The **Plan stage has two sub-tabs**, `Clarify` (with a badge counting open questions) and
  `plan.md` — Clarify is where the pre-plan question round happens (see below). Clicking `plan.md`
  in the *file* tab row always opens the document, since a file tab names a file.
- The **Build stage has its own sub-tabs**: `Task list` (the runner), `tasks.md` (the same three
  document views over the derived task file — it used to be the one stage whose markdown could
  neither be read nor hand-edited) and `Ship`, which appears once the spec is `done`.
- **Doc stages** (requirements/bugfix, plan) default to **Source** — the document as
  line-numbered, markdown-highlighted source (`SourceDoc`, `.k-full`) — with `SpecDocument` section cards
  and raw `MarkdownEditor` as the other views, above a pinned **gate bar** (the flow has **two
  gates**, Requirements and Plan — Build is work, not a decision):
  `[✎ Revise with feedback…] [✦ Improve with Claude] [Approve <stage> → <next>]`. **Approve
  advances the phase AND navigates** to the next doc (`specs.advance` + `setSpecStage`). A doc
  that is still the **untouched template** shows **Draft &lt;stage&gt; with Claude** as the primary
  action instead (`isStubDoc` in `lib/specDoc.ts` — the seeded templates keep their literal
  `<placeholder>` tokens until something writes over them), with *Approve as written* kept
  alongside it so a false positive can never block the gate; the first stage's draft passes
  `meta.brief` so the composer text still grounds it. Already-approved stages show **Continue →**. Revise
  runs `draftSpecDoc({feedback})`; **Improve** runs `draftSpecDoc({improve: true})` — a critical
  self-review pass (per-doc checklist in `IMPROVE_FOCUS`) that refines the file in place and
  reports its improvements in the Assistant. **Drafting the plan clarifies first** (Cursor's Plan
  Mode behavior): when a decision would materially change the plan and `## Resolved Decisions`
  doesn't cover it, the run writes 1–4 questions into the requirement file's `## Open Questions`
  and stops without writing `plan.md` — answer them in the Open Questions overlay, *Apply to
  requirements*, then draft again. It only ever stops once, and Revise / Improve / Quick Plan
  (`noStops`) never stop at all. The plan's own shape (areas + literal contracts +
  `## Critical Decisions`) is documented in [`data-model.md`](./data-model.md#planmd-anatomy-cursor-style). Neither needs a trip to chat. A "Claude is drafting…" banner appears whenever an
  orchestrator run with `source: 'spec:<file>'` is live for this spec (covers drafts started from
  Home / Quick Plan too). The **Plan gate has a hard precondition**: approving it derives
  `tasks.md` from the plan's `## Tasks` section, so a plan without one disables Approve and says
  why (`extractTasksSection` from `electron/shared/planTasks.ts`) rather than dropping the user
  into an empty Build stage.
- **Tasks** renders `TaskRunner` — waves **inline in the document** as mono task blocks along an
  indent guide, each with a Kiro-style inline action line (**Start task** / *Task in progress* /
  ✓ Completed · Refine / Blocked-by) above the literal `[ ] T1: …` line. The header is a progress
  line (`7/12 tasks · wave 2/4 · n running` + bar), the **single concurrency stepper**, and the
  primary CTA **Run all** (autopilot) with **Improve plan** (the tasks.md self-review pass) /
  Run next / Run wave / Stop / Unblock alongside. Clicking a block opens `TaskInspector`.
- **Ship** (`views/ShipView.tsx`) — the automatic payoff, and **a panel inside the Build stage,
  not a stage of its own**. Until the spec is `done` there is nothing to ship, so nothing shows;
  once the last task completes `TaskRunner` auto-advances the spec to `done` and a `Ship` sub-tab
  joins `Task list` / `tasks.md` at the top of Build, already selected (autopilot's own advance lands
  here too via a phase-transition watcher). Reopening tasks (Re-sync) sends the switcher back to
  the task list. `CompletionSummary` **auto-generates** the recap on
  arrival (`auto` prop; persisted to `<spec>/summary.md`) and reports its text up; below it, the
  ship actions: create branch (`feat/<specId>` when on main/master) → **Commit all** (message
  prefilled from the summary, pushes when an origin exists) → **Create PR** (title/body prefilled;
  needs a GitHub token) → View PR. Plus **Polish** (`polishSpec` in `specActions.ts`) and Reopen
  tasks. All existing `git:*` / `github:*` IPC; branch/commit/PR state still writes back into
  `SpecMeta`.

`lib/specActions.ts` is the shared drafting layer (extracted from the old SpecEditor hooks):
`draftSpecDoc({meta, files, file, brief?, feedback?, improve?, noStops?})` returns a promise that
resolves when the run finishes, so `quickPlanSpec` can chain phases; `noStops` (implied by
`feedback` / `improve`, passed explicitly by Quick Plan) disarms the Plan step's
clarifying-question round — see below; `planSpec`, `polishSpec`,
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
  token), Advanced (permissions + MCP servers), and a **Danger zone** (`DangerZone`) that wipes
  the specs on disk and the history DB — two toggles with live counts from `data:usage`, a
  this-project / every-project scope for the history, a typed `RESET` confirmation, and a hard
  block while any run is in flight. On success it calls `ui.closeSpec()`, `orchestrator.clearLog()`
  and `workspace.refreshAll()` so nothing in the UI points at deleted data. The Orchestration
  section (concurrency) and model-per-step grid were removed.

## Agent routing — `src/lib/agentRouter.ts`

Content-aware selection of which installed agent runs a piece of work. **Precedence:** per-task
`@agent` → chat override → **user pin** → best-matching installed specialist (workspace-scope
bonus; task execution is local-first) → bundled default → generic. `routeAgent` returns a
`RouteReason`. The scoring weights come from `useModuleConfig` via `setRouterConfig` — they are
constants by default with no UI. `scoreAgents` / `explainRoute` expose the full decision and power
Library › Routing's playground and the task-row "why" popovers.

## Skill injection — not just labels

`SkillMeta.body` carries the full `SKILL.md` text. `skillSystemBlock` / `skillSystemBlocks`
build prompt blocks prepended to the system prompt. **Three skills, three jobs**, and a run can
carry all of them (de-duplicated by name):

| Selector | What it contributes | Where it is injected |
|---|---|---|
| `routeSkill(specKind)` | the stage-and-gate framing for the whole spec (`sdd-feature` / `sdd-bugfix`) | spec drafting, task runs |
| `routeFormatSkill(file)` | the literal document shape Octo's parsers expect (`spec-{requirements,bugfix,plan,tasks}-format`) | spec drafting, and task runs as `tasks` — a task edits `tasks.md` and `plan.md`'s Critical Decisions |
| `bestSkillByText(taskText)` | a confident domain match, if any | task runs only |
| `matchingSkills(text)` | **every** domain match above the threshold, ranked | the plan stage's skills bar, on request |

`matchingSkills` exists because drafting a plan is a different question from running a task: a
feature can be a frontend *and* a database change at once, and the plan has to be right about
both, whereas `bestSkillByText` answers "which single skill fits". Same scoring and threshold, so
a skill that would win a task is exactly one that shows up here; the bundled SDD and format skills
are excluded, since listing them as a "detected match" would misrepresent why they are injected.

**`PlanSkillsBar`** (in `SpecFlow`, plan document only) shows the base skills and the detected ones
*before* the run and drafts with them — a plan written with a skill you did not expect is worse
than one written without it. Detection is substring-based and will occasionally offer a skill that
matched a word rather than the work (a "file table" scores as a database one), so each detected
chip can be clicked to drop it from that run. `draftSpecDoc` takes `domainSkills` as explicit
**names**, not a flag, for the same reason.

All three live in `agentRouter.ts` rather than at the call sites, so the one visible injection
toggle and the per-skill `disabledSkills` list from the Skills section apply uniformly.
`explainRoute` reports all three, and the Routing playground shows one chip each — a selector that
skipped `RouteExplanation` would make that playground lie. Chat `/skill` injects too. `src/lib/verifyLibrary.ts` resolves a chosen agent/skill back to
the installed file for the `LibBadge` chips (which open the overlay viewers).

## Pull requests (`views/PrComposer.tsx` + `lib/prBody.ts`)

`ShipView` always had branch → commit → PR. What it lacked was a description of what the branch
*contains*: the body was the completion summary, which is generated from `run_files` plus the spec
documents, **before** the commit exists — so a branch carrying earlier commits, hand edits, or work
from more than one spec got a PR body that described the spec instead of the diff.

`PrComposer` builds the body from `git.branchSummary` instead:

- **Deterministic scaffold, one AI paragraph.** `lib/prBody.ts` assembles the commit list, the
  file table with `+`/`−` counts, and the spec's acceptance criteria as an **unticked** checklist
  (unticked on purpose — Octo knows the tasks ran, not that the behavior is right). Only the
  opening overview costs a run, and `branchDigest` grounds it in the real commits and churn so
  "do not invent changes" is an instruction the model can follow.
- **Everything is editable before it is sent.** Touching the body stops it re-deriving.
- It warns when `origin/HEAD` is unset (the base is a guess, so the file list may be wrong) and
  when the working tree is dirty (those changes are *not* in the description).
- Rendered inside Ship, only once there is an origin remote and a GitHub token.

## Text selection

`user-select: none` used to sit on `<body>`, which made the app feel native and also meant **no
error message, file path, run transcript or spec document could be copied** — in a tool whose whole
output is text. The default is now the web's, and `styles.css` puts `user-select: none` back on the
things you click rather than read: `nav`, `button`, `[role="button"]`, `.titlebar-drag`, `.k-chrome`.

Anywhere the app reports a failure worth reporting onward, prefer a **Copy** button over expecting
the user to select: `window.octo.shell.copy` uses Electron's clipboard, which works regardless of
secure-context rules.

## Quick Start (`views/QuickStart.tsx` + `lib/quickStart.ts`)

The guided first hour. A **full-window mode**, like Zen, rather than a fifth surface: the four are
singletons you live in, and this is one you finish and leave. Opened from the Home first-run card,
from ⌘K, and **once, unasked, on a genuinely new install** (`localStorage['octo.quickStartSeen']`
— an onboarding screen that reappears is one people learn to dismiss without reading).

Because it covers the whole window, **its header strip *is* the title bar** — `titlebar-drag`,
52px, with a `w-16` spacer for the traffic lights and `titlebar-nodrag` on every button, exactly as
Zen does it. This is not decoration: `titleBarStyle: 'hiddenInset'` leaves the top of the window a
native drag region, so a close button merely floated over that area looks clickable and does
nothing — macOS swallows the click as a window drag. Escape is handled here on the **capture**
phase, so leaving does not also close whatever sits behind it.

There are three ways out — *I know Octo — skip this* in the header, the `×`, and *Start building*
at the end of the page — because reaching the bottom of a guide and having to hunt back up for the
exit is its own small insult.

Four sections:

- **Set up** — `buildSteps` reads the same state the rest of the app reads: workspace root, the
  backend and whether it is actually usable (CLI detected, or an API key stored), agent/skill
  counts, filled steering docs, specs, enabled trackers. Every step is **verified, never asserted**,
  because a checklist that tells someone to open a workspace they already have open is one they
  stop reading. Each unfinished step carries the action that finishes it.
  `steeringFilled` is the subtle one: the bundled steering docs are seeded as scaffolds, so it
  strips headings, italic prompts and empty `- **Label**:` bullets and asks whether anything is
  left — counting a scaffold as done would tick the highest-leverage step for a workspace where
  nobody has written a word.
- **How the loop works** — three cards, the SDD stages.
- **Tips** — deliberately specific to how *this app* behaves (steering is prepended to every run;
  waves are parallel so their files must be disjoint; a criterion without `SHALL` is invisible).
  Rendered through `<Markdown>` because they name files and task lines.
- **Sharpen your own skills** — points Claude at the user's installed skills with
  `SKILL_REVIEW_SYSTEM` (Anthropic's skill-authoring rules, plus the two constraints specific to
  Octo: the body is injected verbatim so length is a real cost, and the front-matter `description`
  is what routing scores against). It reads the repo, judges whether the advice is true *here*, and
  rewrites the file in place. Octo's own bundled skills are excluded — the next library upgrade
  rewrites any default the user never edited, so improving them would just be undone.

## Stage briefing (`views/StageBriefing.tsx`)

The aside beside each spec document: **who is about to write it, and how they go about it.**
Routing is decided long before a run starts, but the only place that showed it was Library ›
Routing — a different surface entirely. This runs the same `explainRoute` call the playground
makes and renders it where the decision lands.

- It passes the chat's `@agent` override, because `draftSpecDoc` does. A briefing that ignored it
  would be wrong exactly when it matters most.
- **The creature is the Travel Display's**, deliberately — one vocabulary for "what is this agent
  doing" across both windows. `work` while a draft is streaming, `think` while the document still
  carries unresolved `## Open Questions`, `sleep` otherwise. `.k-still` freezes it when idle.
- Sections: the routed agent (its own front-matter `description`, the `RouteReason` via the shared
  `REASON_LABEL`, scope, click to open the file), the skills that get injected with the role each
  one plays, and a per-document `HOW` map whose every line is a real mechanic — the clarify-once
  stop, the `## Tasks` derivation, the `@agent-name` pin.
- Rendered by `DocStage` beside `DocBody`, so it covers requirements/bugfix, plan and tasks alike.
  Toggled from the document toolbar (`specAsideOpen` in the `ui` store, persisted to
  `localStorage`), and hidden under 1180px — the same breakpoint `.k-split` uses to decide a window
  is wide enough for a primary column plus an aside. Width comes from `.k-listpane`.

## Which view a document opens on (`defaultViewFor` in `SpecFlow`)

Resolved **once per document**, the first time it is shown, and latched into the `views` map:

| Document | Opens on | Why |
|---|---|---|
| empty | `edit` | specs no longer start from a template, so a new one has nothing to read — landing on a reading view means looking at an empty-state card and then hunting for the way to type |
| has `SHALL` criteria | `review` | the question these documents exist to answer: is every criterion covered / can this be planned |
| has content, no `SHALL` | `source` | Review groups acceptance criteria, and with none to group it is an empty panel — a document imported from a ticket is exactly this case |
| `tasks.md` | `source` | a list to execute, not a document to review |

It has to be latched rather than derived: the default for an empty document is Edit, and a derived
one would stop being empty at the first keystroke and close the editor under the user's hands.

## Format check (`lib/formatCheck.ts`)

Octo parses the spec documents rather than just displaying them, so a mis-formatted line is not
cosmetic: an emphasised task id is a task the runner never sees, a `## Tasks` section with no
parsable line makes Build land empty, an un-numbered criterion drops out of traceability.

`checkDocument(file, md, ctx)` composes the parsers the rest of the app already runs on that text
— `extractTasksSection`, `parseTasks`, `reviewRequirements`, `extractCriteria`, `parseSpecDoc` —
and returns findings split by `fixable`: violations with exactly one correct answer (un-numbered
`AC-n` / `US-n`, an emphasised task id, a missing `## Critical Decisions`, a bare path in the
affected-files table, duplicate task ids) versus the ones needing judgement (a criterion that
isn't EARS, untestable wording, an orphan story, a dependency on a task nobody defines).

`FormatStrip` in `SpecFlow` renders it above the gate bar, hidden while the document is still an
untouched template. **Fix with Claude** feeds `fixInstructions(report)` — the concrete list — into
a normal `draftSpecDoc({ feedback })` revision.

This is deliberately not a hook. `file-save-in-app` fires from `writeSpecFile`, i.e. after the
400 ms editor autosave and **never** after a Claude draft (hook runs write through the CLI
precisely so they cannot retrigger file-save hooks), so a hook here would burn a run every few
seconds while someone types and stay silent when it matters. The bundled `spec-format-audit` hook
exists for people who want the automatic version, on `spec-advance` and disabled by default.

## File viewer & syntax highlighting (`views/FileViewer.tsx`)

Opens in the **overlay** (from the Explorer drawer, steering docs, LibBadge, etc.). Resolves the
language via `detectLanguage` and highlights with `prism.ts` (lazy `ensureLanguage` for installed
extras; one-click **Install `<lang>`** banner otherwise). Toolbar: theme picker, line-numbers +
wrap, and a link to Library › Appearance. Colors are scoped as `--syn-*` vars on `.code-view`.

## Markdown & mermaid (`components/Markdown.tsx` + `lib/markdown.ts`)

**Every markdown surface renders through `<Markdown source={…} className={…} />`** — spec
documents, the Assistant, run transcripts, agent/skill/steering viewers, the completion summary.
Don't reach for `renderMarkdown` + `dangerouslySetInnerHTML` directly; a call site that does misses
the mermaid pass.

`lib/markdown.ts` is `marked` with a custom renderer: fenced code goes through Prism, **except
```mermaid**, which becomes an inert `<div class="md-mermaid" data-mermaid="…">` holding the source
(with a `<pre>` inside as the fallback). `<Markdown>` then replaces those placeholders with SVG:

- **mermaid is imported dynamically** (`await import('mermaid')`) so its ~1.2 MB chunk only loads
  for documents that actually contain a diagram, and it is **bundled, never CDN-loaded** — the CSP
  in `index.html` is `script-src 'self'`.
- Diagram colours come from the active theme's CSS variables (`mermaidTheme()` maps `--bg`,
  `--card`, `--line`, `--ink-100`, `--accent` onto mermaid's `themeVariables`), and the effect
  depends on the theme so SVGs re-render when the palette changes.
- A diagram that fails to parse falls back to its source in a `<pre>` — a bad diagram never takes
  the document with it.

This is what makes the Cursor-style `plan.md` (a flowchart of the approach above the affected-files
table) readable inside the app rather than showing as coloured code.

## Other `src/lib` helpers

- `tasks.ts` — parse `tasks.md` checklists, per-task `@agent`, waves/dependencies. Wave headings
  match H2–H4, because a derived `tasks.md` keeps the plan's `### Wave 1`.
- `specSections.ts` — parse a requirements/plan doc into section cards (consumed by `SpecDocument`).
- `specTrace.ts` — derive which part of the plan satisfies which acceptance criterion (see Review).
- `reqReview.ts` — the same question one step earlier: user stories, EARS form, untestable wording.
- `specActions.ts` — the shared drafting/plan/polish layer (see "The spec flow").
- `markdown.ts` / `prism.ts` / `fileLang.ts` / `syntaxThemes.ts` — rendering + highlighting.
  Two syntax palettes, deliberately: the **file viewer** (`.code-view`) uses the theme the user
  picks in Appearance (`--syn-*` from `themeToCssVars`), while **markdown code blocks and the spec
  editor / Source view** (`.md-code`, `.octo-editor`) are painted from the app's own theme tokens.
  Those were a hardcoded Material palette — a rainbow belonging to no theme, and light-on-light in
  Daylight; markdown source now marks *structure* (headings and bold as strong ink, emphasis dim,
  list markers and links/code in accent) in whatever palette is active.
- `graphModel.ts` — the agent-graph data layer (`indexRuns`/`verifyRun`, run-grouping taxonomy).
- `library.ts` — module-studio helpers (slug/paths, scaffolds, `buildAction`, `actionsRoutingTo`).
- `openQuestions.ts` — parse/mutate the `## Open Questions` section, including each question's
  **indented answer options**, plus the `## Resolved Decisions` fold.
- `specQuestions.ts` — the Clarify run: asks Claude which decisions must be settled before the
  plan and writes them back as questions **with options** (`parseGeneratedQuestions`).
- `cn.ts` — `clsx` class-name helper.

## Agent Graph

`AgentGraphView` (Activity › Graph) is a `@xyflow/react` flow chart of every run for the selected
spec, grouped by kind: wave columns for task execution plus one labeled swimlane per `RunGroup`
(spec/hook/audit/chat) with toggle chips. Clicking a node opens its `DetailDrawer`.

## Zen — the reading mode (`views/ZenReader.tsx` + `lib/zenDoc.ts`)

Source, Cards and Review each answer a question *about* a document. **Zen answers none**: it is
the document, for a human who has to read it and decide. So it is a `fixed inset-0 z-[60]` layer
that takes the whole window — the spec flow stays mounted underneath and comes back exactly as it
was on **Esc** — and it drops every piece of chrome the reading does not need: file tabs, the spec
strip, the phase chips, the view switcher, the gate bar.

Reached from the **Zen button** in the doc tools row, **⌘⇧Z** (not bound while the view is `edit`,
where the same chord is the textarea's redo) and ⌘K → *Read in Zen*. State is `ui.zenOpen`.

What is left, and why each piece earns it:

- **One column at a reading measure** — 17.5px on 1.72 leading, 752px (`Comfortable`) or 940px
  (`Wide`), toggled in the top strip and persisted to `localStorage` (`octo.zen.measure`). The
  ramp lives in `styles.css` → "Zen reading" as `.zen-prose .md …` rules, so it overrides the
  compact `.md` chat/preview ramp without touching it. Tables become hairlines + a mono header,
  code fences lose their border and go one step off the ground.
- **The gutter.** The one structural idea: every id the app knows — the section number, `AC-3`,
  `T1`, the user story a criterion answers — sits in an 84px margin to the **left** of the prose,
  never as a chip inside it. `lib/zenDoc.ts` is what makes that possible: it flattens each `##`
  section into **rows** (`{kind:'md'}` runs rendered by `<Markdown>`, so mermaid/tables/fences
  keep working, and `{kind:'ids'}` runs for consecutive `AC-1:` / `- [ ] T2 @agent: …` lines), so
  the id and its text are siblings in the layout. `.zen-row` / `.zen-gutter` / `.zen-col` carry
  the geometry. The spine hides at `xl` (1280px) but the gutter holds much longer — 84px + a
  28px gap stays affordable — and only folds *above* its block below 900px.
- **The second accent in the gutter means what it means everywhere in Octo:** this needs your
  decision. Sections whose title reads Open Questions / Critical Decisions carry it, and on
  `requirements.md` `ZenReader` feeds `parseZenDoc` a `markFor` built from `reviewRequirements` —
  the same source as the Review view — so a criterion shows the story it answers, or `vague` /
  `no story` in agent violet. Zen *reports* those; Review is where they are argued.
- **The spine** — an ambient contents list that follows the scroll (the active section is the last
  heading past the reading line) and jumps on click. Below `xl` it folds into one Contents control
  in the top strip. **Focus** (persisted, on by default) dims every section but the active one.
- **The gate at the end.** Approve is not permanent chrome: it sits after the last section, so you
  read the plan and *then* approve it. `SpecFlow` passes it only at the stage's own gate
  (`stageIdx === phaseIdx`, define/plan), with the same `blocked` reason the gate bar uses.

Zen covers the title bar too, so its top strip *is* the title bar: `titlebar-drag` with a 64px
left spacer for the macOS traffic lights, `titlebar-nodrag` on the controls.

## Review — the plan against the criteria (`views/SpecReview.tsx`)

The third document view, and the default one for `plan.md`. Source and Cards each show **one**
document, which is the wrong shape for the question a reviewer actually has: *is every criterion
handled, and by what?* Review puts the acceptance criteria on the left and the plan on the right,
and selecting a criterion pulls its part of the plan forward — matching sections keep an accent
ring and scroll into view, everything else drops to 40%, and the criterion opens the chain it
reaches: **section → task → file** (a file chip opens the file in the overlay viewer). Section
headers carry `AC-n` chips that select in the other direction. A **coverage strip** across the top
is the headline: a segment per criterion, `confirmed · inferred · uncovered`, and filters for the
last two.

`lib/specTrace.ts` derives the links, two ways, and the difference is surfaced rather than
flattened:

- **Explicit** — the plan (a section body, a table row, a task line) names `AC-3`. When a
  criterion is cited, only the cited links are used: an author who wrote the reference meant it.
- **Inferred** — shared distinctive vocabulary. The plan is split into **blocks** (paragraph, list
  item, table row) rather than scored whole — a long section, and the task list especially, shares
  words with every criterion and would win them all. Words are weighted by how rare they are in
  *this* plan (a word in a third of the blocks is worth 0.3, one used twice is worth 1.4), shared
  code-ish terms (`openQuestions.ts`, camelCase, backticked) are worth 3, and a crude stemmer makes
  "clicks"/"clicking"/"click" one word. The cut is **relative to the criterion's own best match**,
  never an absolute score, because absolute scores scale with how wordy the plan is.

Inference is a reading aid, never a verdict: an inferred criterion reads *inferred*, its footnote
says which half of the chain was authored (`citedIn`), and "no task covers this" is reported as a
gap to check. The drafting prompts close the loop from the other side — requirements number their
criteria `AC-1`, `AC-2`, … (`EARS` in `specActions.ts`, the templates in `main.ts`) and the plan
prompt asks for those ids on the rows and task lines that satisfy them, which turns inferred
coverage into confirmed.

### The requirements side (`views/RequirementsReview.tsx` + `lib/reqReview.ts`)

Same segment, one question earlier: **can this be planned?** Stories on the left, criteria on the
right **grouped under the story they answer** — the connection the document only implies becomes
the layout. Selecting a story narrows the list; selecting a criterion opens its checks:

- **form** — which EARS shape it is (`WHEN / THEN`, `WHILE / SHALL`, `IF / THEN`,
  `WHERE / SHALL`), or `not EARS`.
- **story** — the story it answers, and whether the line *names* it (`US-2`, exact) or we matched
  it by wording (`bestMatches`, exported from `specTrace.ts` — the same matcher as the plan trace).
- **vague** — the untestable words it leans on, quoted back (`VAGUE` in `reqReview.ts`, kept
  deliberately short: a list that flags honest prose gets ignored).
- **plan** — where it lands, from `buildTrace`, and only once a plan exists.

The readiness strip counts `n/m answer a story · k need a look`, and the left column also carries
the sections that bound the work (Out of Scope, Non-Functional) plus the open-question count with
a button into Clarify. Two findings have no equivalent in the raw markdown and are the reason the
view exists: **a story no criterion answers** (nothing will be built for it) and **a criterion no
story asks for** (scope from nowhere).

Findings read **violet**, not red — the palette's "needs your decision". Neither is broken;
both need the author.

**Bug specs have no user stories**, so the lens becomes the section a criterion came from
(Expected Behavior, Unchanged Behavior): same interaction, same checks, and "no story asks for
this" stops being a finding (`storyMode` in `ReqReview`).

## Clarify — the interactive question round (`views/QuestionsView.tsx`)

The step between the requirements and the plan, modelled on Cursor's plan mode: **ask before you
draft**. `QuestionsView` renders in two variants —

- **`variant="stage"`** — a panel inside the **Plan stage**, reached by its `Clarify` sub-tab (the
  same pattern as Ship inside Build). Approving the Requirements gate lands here rather than on
  `plan.md`, unless `## Resolved Decisions` already exists. Its footer is the flow: *Skip to plan*
  or **Apply N decisions → Plan**, which writes the decisions and, if `plan.md` is still a stub,
  starts the plan draft (with `noStops`, since the user just had their round).
- **`variant="overlay"`** — the slide-over (`kind: 'questions'`), still reachable from the spec
  menu when the spec is on the Requirements phase.

Both render every question as a card with **pre-loaded options** as one-click chips (`1`–`9`
answer the first open question from the keyboard), plus *Other…* for free text and *Ask Claude*,
which — when options exist — must pick one of them and say why. **Find open decisions**
(`surfaceQuestions` in `lib/specQuestions.ts`) generates the questions; a plan run that came back
with questions instead of a plan flips the Plan stage to Clarify on its own.

`QuestionsView` manages the requirement file's `## Open Questions`
— stream a suggested answer, edit, resolve, reopen, delete; **Apply to requirements** folds the
Q&A into `## Resolved Decisions` (see [`data-model.md`](./data-model.md#open-questions-format)).
The Spec flow's overflow menu has **Find open decisions**, which runs the same generation pass from
either doc stage and then routes the user to whichever surface fits — the overlay while the spec is
still on Requirements, the Plan stage's Clarify tab afterwards.

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
