# UX Redesign Proposal — "The Spec Is the App"

> **Status: IMPLEMENTED** (July 2026). All five migration phases shipped: the four-surface
> shell, the gated spec flow with inline task waves, the automatic Ship stage, the single
> Activity center, and the consolidated Library with knob triage. This document is kept as the
> design rationale; the current-state reference is [`renderer.md`](./renderer.md).
>
> **Superseded in part (August 2026).** The spec flow described here has four stages
> (Requirements · Design · Tasks · Ship); it now has three, with Ship as a panel inside Build —
> see [`refactor-metodologia-y-rebranding.md`](./refactor-metodologia-y-rebranding.md). The
> four-surface shell, the Activity center and the Library are unchanged. Read this for the *why*
> behind the shell, not for the current stage list.

---

## 1. Why

Kraken's SDD pipeline (spec → requirements → design → tasks → parallel execution) is
coherent, but it is wrapped in an IDE-shaped shell that buries it: **14 rail
destinations, 20 center-tab kinds, ~40+ configuration controls, and six overlapping
"what's running" surfaces**. A happy-path feature takes 10–14 deliberate clicks across
three different center surfaces, and the two most important moments of the workflow are
the weakest:

- **The front door is a dead end.** The Welcome screen's natural-language command bar —
  the most prominent input in the app — forwards text to *chat* instead of creating a
  spec (`WelcomeView.tsx`, `submitCmd` → `setPendingPrompt`).
- **There is no payoff.** When the last task finishes, the spec silently flips to `done`.
  The recap is opt-in behind two clicks ("Summary" → "Generate summary",
  `CompletionSummary.tsx`) and has **no path onward to commit or PR**. Done-state and
  ship-state are disconnected.

This proposal inverts the app's identity: Kraken today reads as *an IDE with a spec
feature*; the redesign makes it *a spec pipeline with an IDE-grade engine behind it*.
Reference for several patterns: [Kiro](https://kiro.dev) (gated three-doc specs, Quick
Plan escape hatch, task execution inline in the tasks doc, diff-centric review,
background steering).

---

## 2. Current-state audit

### 2.1 Inventory: 14 destinations, 20 tab kinds

Rail destinations (`ActivityTab` union, `src/stores/ui.ts:3-17`, rendered in
`SpecRail.tsx:45-60`):

| # | Destination | Opens as | Purpose | Verdict |
|---|---|---|---|---|
| 1 | Specs | rail panel | active-spec hero + spec list — the SDD home | **Essential** |
| 2 | Spec Manager | full page (`SpecsStudio`) | analytics / history / delete | Peripheral |
| 3 | Explorer | rail panel | file tree | Peripheral |
| 4 | Agents | full page (`AgentsStudio`) | browse/create/pin agents | Config |
| 5 | Skills | full page (`SkillsStudio`) | browse/create/toggle skills | Config |
| 6 | Steering | full page (`SteeringStudio`) | context docs injected into runs | Peripheral |
| 7 | Hooks | full page (`HooksStudio`) | event automation | Peripheral |
| 8 | Source Control | full page | git + GitHub PRs | Ship-time only |
| 9 | Running Tasks | rail panel (`TasksView`) | live task list | Redundant (⊂ #11) |
| 10 | Terminals | rail panel | PTY shells | Peripheral |
| 11 | Orchestrator | rail panel | live runs + log + concurrency | Redundant |
| 12 | Agent Graph | rail panel + tab | run/route visualization | Peripheral |
| 13 | History | rail panel | past runs | Peripheral |
| 14 | Settings | full page | app config | Config |

On top of these, `OpenTab.kind` (`src/stores/ui.ts:51-71`) defines **20 center-tab
kinds** dispatched in `EditorArea.tsx:77-114`, including a `SyntaxStudio` reachable only
through ⌘K.

### 2.2 The journey today: 10–14 clicks, 3 surfaces, no ending

1. **Create** — Welcome chip or SpecRail "+" → NewSpecDialog (kind, name, Create). ~3 clicks.
2. **Requirements** — Ask Claude to draft, then **Advance** — which changes the phase but
   does **not navigate**; the user must separately click the next phase pill
   (`SpecEditor.tsx:235`). Six optional buttons compete for attention.
3. **Design** — same again: click phase pill, Ask Claude, Advance.
4. **Tasks** — open the Board, Ask Claude to draft tasks, then choose among Run task /
   Run wave / Run next / Run all waves (Autopilot).
5. **Completion** — board turns green; a banner offers "Summary" — which opens a view
   where the recap **still isn't generated** until another click. No commit/PR link.
6. **Ship** — a separate destination (Source Control), not linked from completion at all.

### 2.3 The ten pain points (verified in code)

1. **No completion payoff** — silent `done`, two-click opt-in summary, no ship bridge
   (`TaskRunner.tsx:601-676`, `CompletionSummary.tsx:150`).
2. **Dual UIs for the same concept** — Agents/Skills/Orchestrator each have a rail-panel
   version *and* a full-page studio, reached from different entry points
   (`SpecRail.tsx:63-72` vs `WelcomeView.tsx:417`, `CommandBar.tsx:120`).
3. **"What's running" is shown in ~6 places** — ActivityStream, OrchestratorView,
   RouterStudio "Live agents", CommandBar chip, Welcome count, SpecRail badges (+ Graph).
4. **Wave concurrency is configurable in 3 places** — RouterStudio, Settings →
   Orchestration, Orchestrator panel (`RouterStudio.tsx:466` admits it).
5. **Config overload** — `moduleConfig` has 7 routing knobs + 8 per-action agent pins;
   model-per-step × 8 actions; 9 Settings sections; RouterStudio ≈ 14 controls.
6. **Button density** — spec header ~11 controls; the tasks board adds ~10 more; three
   overlapping AI-summary affordances (Summarize / Audit / completion Summary).
7. **Advance ≠ navigate** — advancing a phase strands the user on the old doc.
8. **⌘K dead ends** — "New spec…" doesn't open the dialog (`CommandPalette.tsx:101-107`);
   the palette can't drive draft/advance/run.
9. **Tab accumulation** — every file/run/agent/skill/studio/terminal opens a flat,
   unbounded tab (`EditorArea.tsx:35-62`); one feature spawns five tabs.
10. **Focus mode is triple-sourced** — CommandBar, SpecEditor, and auto-engage in
    `ui.ts:150,167,177` — so it flips unexpectedly.

**Underused gems** worth promoting rather than inventing: Autopilot (buried in the tasks
header), the Welcome NL command bar, the ⌘K palette, and per-module "Seed defaults".

---

## 3. The redesign

### 3.1 Vocabulary (all of it)

- **Surfaces:** Home · Spec · Activity · Library. That's the whole app.
- **Phases:** Requirements → Design → Tasks → **Ship** ("Ship" replaces the invisible
  `done` — completion becomes a destination, not an absence).
- **Verbs:** Plan · Quick Plan · Approve & continue · Start / Run all · Ship.
- **Chat becomes the Assistant** — a drawer, not a surface.

### 3.2 New information architecture: 4 surfaces

A slim 4-icon left nav replaces the 14-destination rail. Persistent chrome: a top bar
(⌘K palette, project/branch pill, **one** live-runs pill) and the Assistant drawer (⌘J),
available on every surface. **The global tab bar and focus mode are retired** — surfaces
are singletons, files open in a slide-over viewer, the phase stepper is the navigation.

| Surface | Contents |
|---|---|
| **Home** | The launchpad. The NL command bar **actually creates specs**. "In flight" spec cards (live phase + run status, Resume), "Shipped" recents linking to their Ship summaries, all-specs list with Spec Manager analytics/delete behind a "Manage" toggle. A first-run "Set up Kraken defaults" card seeds agents + skills + hooks once. |
| **Spec** | One continuous guided surface per spec — the entire lifecycle on one screen with a phase stepper (§3.3). A spec switcher (dropdown + ⌘K) changes which spec it shows. |
| **Activity** | The single command center for "what's running": live runs grouped by spec → wave (cancel / Stop all), the **one** concurrency control, tabs for History and Terminals, optional list ⇄ graph toggle (absorbs Agent Graph). Everywhere else shows only indicators (top-bar pill, in-situ task chips). |
| **Library** | Consolidated background config: Agents · Skills · Hooks · Steering · Routing · Appearance · Settings (§3.5). |

**Where every current destination goes:**

| Current | Fate |
|---|---|
| Specs (rail) | → Home (cards + list) |
| Spec Manager | → Home "Manage" mode; per-spec stats in the Spec header overflow |
| Explorer | → slide-over file drawer (⌘⇧E) on any surface; `FileViewer` becomes an overlay |
| Agents / Skills / Steering / Hooks | → Library (studio versions survive; rail-panel twins deleted) |
| Source Control | → split: spec-scoped commit/PR moves **into the Spec Ship phase**; a global repo drawer opens from the top-bar branch pill |
| Running Tasks | → Activity (merged into the run feed) |
| Terminals | → Activity › Terminals tab (PTYs stay mounted) |
| Orchestrator | → Activity *is* this, expanded |
| Agent Graph | → Activity view-mode toggle (or deferred to v2) |
| History | → Activity › History tab |
| Settings | → Library › Settings |
| SyntaxStudio (⌘K-only) | → Library › Appearance |

The 20 tab kinds collapse to: surface routing + `file` overlay + `terminal` and `run`
detail inside Activity.

### 3.3 The Spec surface — one continuous guided flow

**Entry: the command bar creates the spec.**

```
[ Describe a feature or paste a bug…                    ] (Plan) (Quick Plan)
```

- **Plan** → creates the spec and immediately streams a requirements draft (existing
  `streamClaude` + SDD skill), navigating straight into Spec › Requirements *while the
  draft streams in*. Gated flow.
- **Quick Plan** (Kiro's escape hatch) → drafts requirements, design, and tasks
  back-to-back with no approval stops, landing on Tasks ready to run. Gates can be
  re-armed per spec.
- Plain questions still route to the Assistant; feature/bug-shaped text defaults to Plan
  with a one-keystroke override. ⌘K "New spec" opens this same input (fixes pain point 8).

**Gates that navigate.** The header shrinks from ~11 controls to: spec name/kind, the
clickable phase stepper, Assistant toggle, and one overflow menu (Audit · Re-sync ·
Edit markdown · Delete). Per-doc "Summarize" is cut — the doc *is* the summary; the
three overlapping AI-summary affordances collapse to one (Audit in overflow; the
completion summary becomes the automatic Ship phase). Each phase doc keeps the existing
`SpecDocument` section cards, with a persistent gate bar pinned at the bottom:

```
[ ✎ Revise with feedback… ]            [ Approve requirements → Design ]
```

- **Approve & continue** advances the phase **and navigates to the next doc** — one CTA
  replaces "Advance phase" (fixes pain point 7).
- **Revise with feedback** re-runs the drafting agent on this doc inline — no trip to chat.
- Markdown editing stays one click away (overflow → Edit), reusing the existing editor mode.

**Tasks execute inline in the document** (the kanban board is replaced). The tasks doc
renders as dependency waves, reusing `TaskRunner`'s wave/`pump` engine and `tasks.ts`
parsing:

- Each task row: checkbox state, title, routed-agent chip (with a "why" popover from
  `explainRoute`), **Start** button, live status chip, elapsed time. Expanding a running
  task shows its live output inline (embedded `TaskInspector`).
- Wave headers: "Wave 2 · 3 tasks · blocked by W1" with **Run wave**.
- The primary CTA is **Run all** (Autopilot, promoted from its buried spot) with a live
  progress bar: `▰▰▰▱▱ 7/12 tasks · wave 2/4 · 2 running`.
- Concurrency appears here as a small stepper — the **same single store field** mirrored
  in Activity; nowhere else.

**Ship: the automatic payoff.** When the last task completes, the spec auto-advances to
Ship and the summary **auto-generates** on arrival (the existing
`CompletionSummary.generate()` flow, fired on phase entry — no opt-in clicks). The Ship
screen is the "feature shipped" moment:

1. **Summary** — the AI recap, persisted to `summary.md`, regenerable and editable —
   it becomes the PR body.
2. **Changed files** — the `SpecFileChange` list merged with live `git status`; each row
   opens a diff in the slide-over viewer, with "Approve all / step through" review
   (Kiro's diff-centric pattern).
3. **Ship actions** — the spec-aware blocks from `SourceControlView`: create branch (if
   needed) → **Commit all** (message prefilled from the summary) → **Create PR**
   (title/body prefilled) → link to the opened PR. All existing `git:*` / `github:*` IPC;
   branch/commit/PR state already writes back into `SpecMeta`.

From "last task green" to "PR open": **two clicks, one screen.**

### 3.4 One activity model + the Assistant

The `orchestrator` store stays the single source of truth and gets exactly **one full
rendering** (the Activity surface). The only other run indicators allowed are *views*,
never lists: the top-bar runs pill (count + spinner → click through to Activity) and
in-situ status chips on the task rows they describe. This retires the six scattered
displays.

**The chat becomes the Assistant**: a right drawer (⌘J) on every surface, context-scoped
to the active spec (it knows the phase and docs). It is conversation only — the live-feed
half of today's `ActivityStream` moves to Activity. When an Assistant message spawns a
run, the message shows a run chip deep-linking to Activity. `@agent` and `/skill`
affordances survive. The Assistant is the free-form escape valve, no longer a
load-bearing pillar of the layout.

### 3.5 Library: consolidation and knob triage (~40 → ~12 visible)

One `ModuleShell`-style surface with a left sub-nav: **Agents · Skills · Hooks ·
Steering · Routing · Appearance · Settings**. Only the full-page studios survive; the
rail-panel twins (`sidebar/AgentsView`, `SkillsView`, `HooksView`) are deleted — the
dual-UI problem dies here. One first-run **"Set up Kraken defaults"** action (a Home
card until dismissed) replaces the three per-module "Seed defaults" buttons.

| Tier | Knobs |
|---|---|
| **Survive (visible)** | Backend CLI/API + API key; GitHub token; theme; **one** max-concurrency; agent/skill/hook/steering CRUD + enable/disable + steering pins; one global model + optional "planning model" pair (replaces model-per-step × 8); per-spec approval-gates toggle (the Quick Plan flag). |
| **Become invisible defaults** | Router tuning — `workspaceBonus`, `specialistThreshold`, `localFirst`, `domainSkillThreshold` — the current `DEFAULTS` in `moduleConfig.ts` become constants; the two skill-injection toggles collapse into one "auto-inject matching skills"; focus mode (gone); per-module seeding (first-run). |
| **Demoted** | Per-action agent pins → a collapsed "Advanced" disclosure under Library › Routing; the RouterStudio playground shrinks to a read-only "why was this agent chosen" explainer (the same popover the task rows use); SyntaxStudio becomes Appearance; 9 Settings sections regroup into 4 (Connection · Models · Repo · Appearance). |

---

## 4. Wireframes

**Home**

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🐙 kraken   ⌘K Search/actions        my-app ⎇ main    ◉ 2 running   │
├───┬──────────────────────────────────────────────────────────────────┤
│ ⌂ │                                                                  │
│ ▤ │   ┌────────────────────────────────────────────────────────┐    │
│ ⚡│   │ Describe a feature or paste a bug…                     │    │
│ ⛭ │   │                              [ Plan ]  [ Quick Plan ]  │    │
│   │   └────────────────────────────────────────────────────────┘    │
│   │   IN FLIGHT                                                     │
│   │   ┌ dark-mode-toggle ────────┐ ┌ fix-login-crash ─────────┐    │
│   │   │ Tasks · wave 2/4 ◉ 2 run │ │ Design · awaiting approve │    │
│   │   │ ▰▰▰▱▱ 7/12   [Resume →] │ │              [Resume →]  │    │
│   │   └──────────────────────────┘ └───────────────────────────┘    │
│   │   SHIPPED                              ALL SPECS      [Manage]  │
│   │   ✓ csv-export · PR #41 merged        12 specs · 3 done …      │
└───┴──────────────────────────────────────────────────────────────────┘
```

**Spec — Requirements (gated)**

```
┌──────────────────────────────────────────────────────────────────────┐
│ dark-mode-toggle · feature     ●Requirements ○Design ○Tasks ○Ship  ⋯ │
├───┬──────────────────────────────────────────────────────────┬───────┤
│ ⌂ │  ┌ R1 · Toggle in settings ───────────────────────────┐ │ ASSIS │
│ ▤●│  │ WHEN the user opens Settings THE SYSTEM SHALL…     │ │ TANT  │
│ ⚡│  └────────────────────────────────────────────────────┘ │ (⌘J)  │
│ ⛭ │  ┌ R2 · Persistence ──────────────────────────────────┐ │       │
│   │  │ …                                                  │ │  …    │
│   │  └────────────────────────────────────────────────────┘ │       │
│   ├──────────────────────────────────────────────────────────┤       │
│   │ [ ✎ Revise with feedback… ]  [ Approve requirements → Design ]  │
└───┴──────────────────────────────────────────────────────────────────┘
```

**Spec — Tasks (executing inline)**

```
│ dark-mode-toggle     ✓Requirements ✓Design ●Tasks ○Ship            ⋯ │
├───┬──────────────────────────────────────────────────────────────────┤
│   │  ▰▰▰▱▱ 7/12 tasks · wave 2/4          concurrency [2] [■ Stop]  │
│   │                                        [ ▶ Run all (Autopilot) ] │
│   │  WAVE 1 ✓ complete · 4 tasks                                    │
│   │  WAVE 2 ◉ running                                               │
│   │   ✓ T5 Add theme store            @frontend-dev   1m 42s        │
│   │   ◉ T6 Toggle component           @frontend-dev   0m 58s  [▾]   │
│   │   │  └─ live output: "Writing ThemeToggle.tsx…"                 │
│   │   ○ T7 Persist preference         @spec-task-executor  [Start]  │
│   │  WAVE 3 · blocked by W2 · 3 tasks                               │
```

**Spec — Ship (automatic)**

```
│ dark-mode-toggle     ✓Requirements ✓Design ✓Tasks ●Ship            ⋯ │
├───┬──────────────────────────────────────────────────────────────────┤
│   │  🎉 All 12 tasks complete                    12 files · +480 −62 │
│   │  SUMMARY (auto-generated → summary.md)              [↻] [Edit]  │
│   │  Adds a dark-mode toggle: theme store, Settings UI, persisted…  │
│   │  CHANGED FILES                        [Review diffs: step thru] │
│   │   + src/stores/theme.ts        new    T5      [diff]            │
│   │   ± src/components/Settings…   edit   T6,T7   [diff]            │
│   │  SHIP                                                           │
│   │  ⎇ feat/dark-mode-toggle ✓   [ Commit all ]  [ Create PR ]     │
└───┴──────────────────────────────────────────────────────────────────┘
```

**Library**

```
│ ⛭ Library                                                            │
├───┬────────────┬─────────────────────────────────────────────────────┤
│   │ Agents   ● │  AGENTS (workspace ▸ .claude/agents, +global)       │
│   │ Skills     │  ┌ frontend-dev ─────┐ ┌ spec-task-executor ┐       │
│   │ Hooks      │  │ used 14× · edit   │ │ default · edit     │       │
│   │ Steering   │  └───────────────────┘ └────────────────────┘       │
│   │ Routing    │  ▸ Why agents get picked (read-only explainer)      │
│   │ Appearance │                                                     │
│   │ Settings   │                             [ Set up defaults ]     │
```

---

## 5. Migration roadmap

Five phases, each shippable. Roughly **70% of the code is reused** (all stores, IPC,
studios, and the wave/routing/streaming engines); the shell plus the SpecEditor and
TaskRunner *chrome* are rewritten; ~8 files are deleted.

| Phase | Scope | Key files |
|---|---|---|
| **1 — Shell swap** | 4-icon nav replaces the 14-destination rail; shrink `ActivityTab` to `home \| spec \| activity \| library` (+ drawer booleans); retire the flat tab bar and focus mode; delete the dual rail panels (`sidebar/AgentsView.tsx`, `SkillsView.tsx`, `HooksView.tsx`, `GraphView.tsx`, `SpecsView.tsx`); `WelcomeView` becomes Home. `CommandBar`/`CommandPalette` kept, targets rewired. | `src/stores/ui.ts`, `App.tsx`, `SpecRail.tsx`, `EditorArea.tsx`, `WelcomeView.tsx` |
| **2 — Spec flow** | Home/⌘K command bar wired to `specs.create` + streaming requirements draft (no IPC change); `SpecEditor` rebuilt as the continuous flow (stepper header, gate bar = advance **+ navigate**, Quick Plan chain); tasks rendered inline by embedding `TaskRunner`'s wave/`pump`/autopilot engine (kanban chrome rewritten), `TaskInspector` inlined. | `SpecEditor.tsx`, `TaskRunner.tsx`, `chat.ts`/workspace store |
| **3 — Ship** | Auto-advance + auto-generate on phase entry (`CompletionSummary` reused); Ship view built from the spec-aware branch/commit/PR blocks extracted from `SourceControlView.tsx`; `SpecSummaryView` deleted. Existing `git:*`/`github:*` IPC unchanged. | `CompletionSummary.tsx`, `SourceControlView.tsx` |
| **4 — Activity** | Merge `OrchestratorView` + `TasksView` + `HistoryView` + `TerminalsView` (+ optional graph toggle) into one surface over the untouched `orchestrator` store; `ActivityStream` slims to the Assistant drawer (chat only); single concurrency control; top-bar runs pill. | `OrchestratorView.tsx`, `ActivityStream.tsx` |
| **5 — Library + knob triage** | Studios mount under one Library shell; `moduleConfig` router tuning becomes constants (store kept for pins/skill toggles); Settings regrouped 9 → 4; model-per-step collapses in `models.ts`; one first-run seeding action over the three existing `seedDefault*` IPCs; `RouterStudio` shrinks to the explainer; `SyntaxStudio` re-homed as Appearance. | `moduleConfig.ts`, `SettingsView.tsx`, `RouterStudio.tsx`, `SyntaxStudio.tsx` |

---

## 6. Open questions

1. **Agent Graph** — keep as an Activity view-mode toggle in v1, or defer to v2?
2. **Bugfix flavor** — should Quick Plan be the *default* for `bugfix` specs (bugs
   rarely need a gated design phase)?
3. **Ship without GitHub** — for workspaces with no `origin`/token, Ship degrades to
   Commit-only; is a "copy summary" affordance enough?
4. **Assistant scope** — per-spec conversation history vs one global thread?
5. **Naming** — "Ship" vs "Done" vs "Review" for the fourth phase.
