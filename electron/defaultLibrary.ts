// The bundled default library: every agent, skill, steering doc and hook Octo
// ships and seeds into a workspace's `.claude/` and `.octo/`.
//
// It lives in its own module for two reasons. It is *content*, not logic — the
// seeding rules are in `seedDefaults.ts` and the IPC in `main.ts` — and
// `scripts/seed-hashes.mjs` imports it directly to fingerprint every body for
// `SHIPPED_DEFAULT_HASHES`. Keep it dependency-free (a type-only import of
// `HookConfig` is fine) so that script can load it with Node's own TS stripping,
// without an Electron runtime.
//
// **Adding or changing a default is a two-step change:** edit the body here,
// then run `npm run hashes` and paste the new fingerprints into
// `SHIPPED_DEFAULT_HASHES`. Skipping the second step means anyone who cloned a
// repo with `.claude/` committed never receives the update — see the note on
// that constant.

import type { HookConfig } from './shared/types.js';

/**
 * Bumped whenever any body below changes. The on-open upgrade pass records it
 * per workspace and skips the whole scan when it already matches, so opening a
 * workspace costs nothing once its library is current.
 */
export const LIBRARY_VERSION = 2;

/** Skills — written to `.claude/skills/<name>/SKILL.md`. */
export function defaultSkillsLibrary(): Record<string, string> {
  return {
    'sdd-feature': `---
name: sdd-feature
description: Walk through requirements → plan → build for a new feature. Activate when the user wants to scope, plan, or break down a feature.
---

# SDD Feature Skill

When activated, drive a three-stage conversation. There are only **two gates**; the third stage is work, not a decision.

1. **Define** (\`requirements.md\`) — user stories and acceptance criteria in EARS notation. *Gate.*
2. **Plan** (\`plan.md\`) — approach with a mermaid diagram, affected files, the changes area by area with literal contracts, risks & rollback, verification, **and the dependency-ordered task waves**. *Gate.*
3. **Build** (\`tasks.md\`) — execute the waves, then ship.

There is no separate design document and no separate task-planning step: the plan carries both, and approving it derives \`tasks.md\` from its \`## Tasks\` section. Ask for confirmation before advancing a gate.

**Clarify before you plan.** If a decision would materially change the plan (library choice, data shape, migration strategy, a UX tradeoff), ask it *before* drafting: write 1–4 questions into the requirement document's \`## Open Questions\` and stop. Once those questions carry a **Resolved Decisions** entry — or the user says to proceed — draft the plan and never stop again: pick the reasonable default and record it in the plan.
`,
    'sdd-bugfix': `---
name: sdd-bugfix
description: Reproduce → root cause → minimal fix workflow for bug specs. Activate when the user reports a bug or wants to scope a fix.
---

# SDD Bugfix Skill

Same three stages as a feature spec — \`bugfix.md\` → \`plan.md\` → \`tasks.md\` — with the analysis in place of requirements.

Capture three sections:

- **Current Behavior** — WHEN/THEN of the defect.
- **Expected Behavior** — WHEN/THEN/SHALL of the correct behavior.
- **Unchanged Behavior** — WHEN/THEN/SHALL CONTINUE TO statements that guard regressions.

Then plan: root cause, the minimal fix, and the waves that deliver it. Prefer the smallest possible change that satisfies the bugfix and preserves Unchanged Behavior, and make the regression guards explicit in **## Verification**.
`,
    'spec-requirements-format': `---
name: spec-requirements-format
description: Defines the exact markdown shape of requirements.md - the H2 sections, US-n user stories, numbered EARS AC-n criteria and their (US-n) back-references. Octo parses this shape literally, so apply this skill whenever writing or revising a feature requirements document, even when the user only asks to add or reword a single criterion.
---

# requirements.md format

Octo *parses* this document rather than reading it. Every rule below exists because a
parser depends on it; break one and the Review view, the traceability graph or the
phase gate silently stops working.

## Sections

Use these H2 headings, spelled exactly, in this order:

\`## Introduction\` - \`## User Stories\` - \`## Acceptance Criteria (EARS notation)\` -
\`## Out of Scope\` - \`## Non-Functional Requirements\` - \`## Open Questions\`

Only \`##\` opens a section. A \`###\` heading stays *inside* the section above it.

## User stories

One per top-level list item:

\`\`\`
- US-1: As a <role>, I want <capability>, so that <outcome>.
\`\`\`

The \`As a ... I want ... so that ...\` wording is matched literally - reword it and the
story stops being a story. Number them \`US-1\`, \`US-2\`, ...

## Acceptance criteria

One per top-level list item: numbered \`AC-1\`, \`AC-2\`, ..., containing the word \`SHALL\`,
and ending with the story it answers in parentheses.

\`\`\`
- AC-1: WHEN the user submits an empty form THEN the system SHALL keep the draft and show one error per invalid field. (US-1)
- AC-2: WHILE a run is streaming THE system SHALL disable the Approve button. (US-2)
\`\`\`

Four EARS forms are recognised; anything else is flagged as *not EARS*:

| Form | Shape |
|---|---|
| Event | \`WHEN <trigger> THEN the system SHALL <response>\` |
| State | \`WHILE <state> THE system SHALL <continuous behavior>\` |
| Unwanted | \`IF <precondition> THEN the system SHALL <response>\` |
| Optional | \`WHERE <feature is present> the system SHALL <response>\` |

Every story needs at least one criterion, and every criterion needs a story - the
Review view lists both kinds of orphan.

## Two things that silently break parsing

- **Indented bullets are invisible.** Only unindented list items are read, so a
  criterion nested under its story is not a criterion at all.
- **\`SHALL\` inside \`## Open Questions\` or \`## Resolved Decisions\` is ignored** by
  design. Never write a criterion there.

## Untestable wording

A criterion has to be checkable by someone who did not write it. These words are
flagged: *user-friendly, easy to use, intuitive, seamless, responsive, snappy, fast,
quickly, performant, efficient, robust, reliable, appropriate, reasonable, as needed,
if necessary, properly, nicely, modern, clean, simple, several, various, etc.*

Replace the judgement with something observable - not "responds quickly" but "responds
within 200 ms"; not "handles several items" but "handles at least 50 items".
`,
    'spec-bugfix-format': `---
name: spec-bugfix-format
description: Defines the exact markdown shape of bugfix.md - Reproduction, Current Behavior, Expected Behavior, Unchanged Behavior regression guards and Environment, with EARS-numbered AC-n criteria. Octo parses this shape literally, so apply this skill whenever writing or revising a bug analysis document, even for a one-line change.
---

# bugfix.md format

A bug spec is parsed by the same machinery as a feature spec, so the same literal rules
apply - with one inversion that matters more than any other.

## Sections

Use these H2 headings, spelled exactly, in this order:

\`## Reproduction\` - \`## Current Behavior (defect)\` - \`## Expected Behavior\` -
\`## Unchanged Behavior (regression guards)\` - \`## Environment\` - \`## Open Questions\`

There are **no user stories** in a bug spec; criteria are grouped by the section they
came from instead.

## The inversion: Current Behavior must not say SHALL

\`SHALL\` is what marks a line as an acceptance criterion. The defect is not something
the system is supposed to do, so describing it with \`SHALL\` would file the bug itself
as a requirement. Write it as plain WHEN/THEN:

\`\`\`
- WHEN the workspace path contains a space THEN the CLI subprocess exits with code 127.
\`\`\`

## Expected and Unchanged

Both carry numbered \`AC-n\` criteria containing \`SHALL\`. Unchanged Behavior uses the
\`SHALL CONTINUE TO\` form - these are the regression guards, and \`## Verification\` in
the plan has to prove each one still holds.

\`\`\`
- AC-1: WHEN the workspace path contains a space THEN the system SHALL launch the CLI successfully.
- AC-2: WHEN the workspace path contains no space THEN the system SHALL CONTINUE TO launch the CLI successfully.
\`\`\`

## The rest

\`## Reproduction\` is a numbered list, one action per step, ending with what you
actually observe. \`## Environment\` records the versions, OS and configuration that
made the bug appear - a bug that only reproduces under one of them is a different bug.

Only unindented list items are parsed, and criteria under \`## Open Questions\` or
\`## Resolved Decisions\` are ignored by design.

Prefer the smallest change that satisfies Expected Behavior without disturbing
Unchanged Behavior. A bug spec that grows a feature is scope creep, and the audit
flags it.
`,
    'spec-plan-format': `---
name: spec-plan-format
description: Defines the exact markdown shape of plan.md - the objective line, mermaid Approach, Affected files table, area sections carrying literal contracts, Risks and rollback, Verification, the AC-n citations that drive traceability, and the ## Tasks waves that Build executes. Apply this skill whenever writing or revising a plan document; a plan whose ## Tasks section does not parse cannot be approved.
---

# plan.md format

Octo derives \`tasks.md\` from this file and traces every acceptance criterion through
it, so the structure is load-bearing. Produce exactly these sections, in this order.

## 1. Objective line

A single blockquote under the H1: \`> One-line objective. Appetite: <S/M/L>. Risk: <low/medium/high>.\`

## 2. \`## Approach\`

One \`\`\`mermaid flowchart, 3-7 nodes, **every label wrapped in quotes**
(\`A["Reads spec"]\`) - an unquoted label with punctuation fails to render. Then one
paragraph: the strategy chosen, and in one sentence each the alternatives rejected.

## 3. \`## Affected files\`

A table \`| File | Change |\`. Put real paths in backticks with a line number where you
have one - \`\` \`src/lib/specTrace.ts:253\` \`\`. A file reference is only picked up when it
is backticked *and* contains a \`/\` or a \`:\`; a bare \`\` \`package.json\` \`\` is not counted.

## 4. Area sections

One H2 per real boundary in *this* repo (\`## Main process changes\`,
\`## Renderer changes\`, ...) - not the placeholder names. Write the **literal contract**
each area commits to, as code, not prose: the exact type, signature, SQL or IPC shape.

## 5. \`## Key implementation details\`, \`## Risks & rollback\`, \`## Verification\`

Risks is a table \`| Risk | Mitigation | How to revert |\`. Verification maps every
acceptance criterion to how it is proven.

## 6. \`## Tasks\` - the section that gates approval

\`\`\`
## Tasks

### Wave 1
- [ ] T1: <smallest verifiable change> - _outcome: ..._
- [ ] T2: <independent change, disjoint files> - _outcome: ..._

### Wave 2 (depends on T1)
- [ ] T3: <change> - _outcome: ..._
\`\`\`

\`## Tasks\` is an **H2** and the waves under it are **H3**. The section ends at the next
H2, so \`## Open Questions\` and \`## Critical Decisions\` come after it. Approving the plan
copies this section verbatim into \`tasks.md\`; a \`## Tasks\` heading with prose and no
parsable task line is treated as absent and **blocks the gate**.

Task lines: a plain checkbox, the bare id, then a colon. Never wrap the id or the
checkbox in emphasis - \`- [ ] **T1**: ...\` does not parse. Name a specialist when the
task clearly belongs to one: \`- [ ] T4 @frontend-implementer: ...\`.

## 7. \`## Open Questions\`, then \`## Critical Decisions\`

Leave \`## Critical Decisions\` as an empty heading at the very end. Build appends to it
whenever a task deviates from this plan, which is what keeps the plan honest.

## Cite the criteria

Write \`AC-n\` into the rows, bullets and task lines that satisfy each one. Those
citations are what light up the Review view; without them it falls back to guessing by
vocabulary overlap, and guesses wrong.
`,
    'spec-tasks-format': `---
name: spec-tasks-format
description: Defines the exact line grammar Octo's orchestrator parses in tasks.md - the checkbox, the bare Tn id, the optional @agent-name, wave headings and how dependencies are declared. Apply this skill whenever writing, revising or ticking off task lines, and whenever appending a Critical Decision to a plan; a mis-formatted line is invisible to the runner.
---

# tasks.md format

Every line here is executed by the orchestrator, one run per task. A line it cannot
parse simply does not exist as far as Build is concerned.

## The task line

\`\`\`
- [ ] T1: Add the format skill bodies - _outcome: four SKILL.md files seeded_
- [ ] T4 @frontend-implementer: Render the format-check strip above the gate bar
- [x] T2: Extract the default library into its own module
\`\`\`

- A plain checkbox, \`[ ]\` open or \`[x]\` done.
- The **bare id** - \`T1\`, \`T2\`, ... - immediately after it. Never wrapped in emphasis:
  \`- [ ] **T1**: ...\` is not a task.
- Optionally \`@agent-name\` right after the id, and nowhere else - an \`@name\` later in
  the sentence is ignored.
- Then \`:\` and the description. End with \`- _outcome: ..._\` so the run knows what
  finishing looks like.

## Waves

\`\`\`
## Wave 1
### Wave 2 (depends on T1)
\`\`\`

Headings \`##\` to \`####\` are accepted, so a wave keeps working whether it came from the
plan (H3) or from the tasks template (H2). Everything in a wave runs **in parallel**,
so two tasks in the same wave must touch disjoint files. A wave starts only once every
task in every lower wave is done.

Dependencies come from three places: the wave itself, a parenthetical naming one task
(\`(T3 depends on T1)\`), or \`depends on T1, T2\` written inside the line.

## Sizing

One task is one verifiable change a single agent finishes in one run. If the outcome
needs the word "and", it is two tasks. Tasks that edit the same file belong in
different waves, or in one task.

## Ticking off, and recording deviations

Executing a task means editing \`tasks.md\` to flip its own \`[ ]\` to \`[x]\` - keep the
rest of the line byte-identical. If the work had to deviate from the plan, append to
\`## Critical Decisions\` at the end of \`plan.md\` (creating the heading if absent):

\`\`\`
### Critical Decision - T3: Store the ledger per workspace
- **What**: keyed the version by workspace root, not globally.
- **Why**: a global key upgrades one workspace and silently skips the rest.
- **Affects**: the Affected files row for \`electron/main.ts\`.
\`\`\`

Never rewrite the \`## Tasks\` section of the plan itself.
`,
  };
}

/** Agents — written to `.claude/agents/<name>.md`. */
export function defaultAgentsLibrary(): Record<string, string> {
  return {
    'spec-requirements-writer': `---
name: spec-requirements-writer
description: Turn raw product intent into a requirements.md using EARS notation. Use this in the Requirements phase of a feature spec.
tools: Read, Write, Grep, Glob
---

You author **requirements.md** for feature specs.

The document's exact shape - sections, \`US-n\` stories, numbered EARS \`AC-n\` criteria and
their \`(US-n)\` back-references - is defined by the **spec-requirements-format** skill,
which is injected alongside this persona. Follow it literally; it is what Octo parses.

Your judgement is the part the format cannot supply:

- **Scope.** Never invent behavior that isn't stated or strongly implied. Ask once for
  missing context, then commit to a draft.
- **Testability.** Prefer the criterion someone else could check without asking you what
  you meant - "responds in under 200 ms", not "feels responsive".
- **Completeness.** Every story earns at least one criterion, and every criterion answers
  a story. A story nothing tests gets silently dropped in Build; a criterion no story asks
  for is scope from nowhere.
- **The unhappy paths.** Most of the value here is the \`IF <precondition> THEN ... SHALL\`
  criteria that nobody thought to ask for: empty input, a failed run, a permission denied.
`,

    'spec-planner': `---
name: spec-planner
description: Turn requirements.md (or bugfix.md) into a plan.md — approach, affected files, risks, verification, and the dependency-ordered task waves. Use in the Plan phase.
tools: Read, Write, Grep, Glob
---

You author **plan.md**: one document that says *how* the work gets done and *in what
order*. It replaces the old split between a design document and a task list - the waves
live here.

The document's exact shape - the section order, the two tables, the \`AC-n\` citations and
the \`## Tasks\` waves that gate approval - is defined by the **spec-plan-format** skill,
which is injected alongside this persona. Follow it literally; it is what Octo parses.

Read requirements.md (or bugfix.md) first. If it has a **Resolved Decisions** section,
treat every entry as settled and do not re-open it.

Your judgement is the part the format cannot supply:

- **Ground it in the real repo.** Use Grep/Glob to find actual paths before writing the
  affected-files table. A plan that cites a file that doesn't exist is worse than no plan.
- **Clarify before you plan.** If a decision would materially change the plan and the
  requirement document has no Resolved Decisions entry for it, don't guess and don't draft
  around it: append 1-4 \`- [ ] question\` lines to that document's \`## Open Questions\`, say
  so in chat, and stop. Do this **once** - if Resolved Decisions already exists, or the
  user asked you to proceed, draft the plan and record the default you chose.
- **Commit to contracts.** \`custom_fields TEXT DEFAULT '[]'\` is plan material; "store the
  custom fields somewhere" is not. Decide it here so the executor doesn't have to.
- **Size the waves for parallelism.** Wave 1 tasks run at the same time, so they must
  touch disjoint files. One task is one observable outcome, verifiable in one PR.
- **Pick the diagram deliberately** - \`flowchart\` for the shape of the approach,
  \`sequenceDiagram\` for interactions over time, \`erDiagram\` when the data model changes.
  If a **mermaid-diagrams** skill is installed, follow it.
- **Bias to the simplest approach** that satisfies every acceptance criterion, and say
  what you traded away.
`,

    'spec-task-executor': `---
name: spec-task-executor
description: Execute a single task from tasks.md — read the spec, make the change, update the task list. Use during implementation.
tools: Read, Edit, Write, Bash, Grep, Glob
---

You execute exactly one task at a time. Before editing:
1. Re-read requirements.md / bugfix.md and plan.md.
2. Locate the target files; confirm the change matches the plan.

After editing:
- Run or describe the test(s) that validate the task.
- Tick the task box in tasks.md.
- **Keep the plan alive.** If the implementation deviated from plan.md, or you made a non-obvious
  call the plan doesn't cover, append it to plan.md under \`## Critical Decisions\` (create the
  section at the **end** of the file if missing) as
  \`### Critical Decision — <task id>: <title>\` with what you decided, why, and what it affects.
  Never edit the \`## Tasks\` section to record it.
- Stop. Do not start the next task unless explicitly told to.
`,

    'bug-analyzer': `---
name: bug-analyzer
description: Drive the bugfix Analysis phase — capture reproduction, current behavior, expected behavior, and unchanged behavior. Use when starting a bugfix spec.
tools: Read, Write, Grep, Glob
---

You author **bugfix.md**. Required sections:

- **Reproduction** — minimal numbered steps.
- **Current Behavior** — WHEN/THEN of the defect.
- **Expected Behavior** — WHEN/THEN/SHALL of correct behavior.
- **Unchanged Behavior** — WHEN/THEN/SHALL CONTINUE TO statements protecting against regressions.
- **Environment** — versions, OS, config that matter.

If reproduction steps are missing, ask once. Otherwise commit to a draft.
`,

    'codebase-explorer': `---
name: codebase-explorer
description: Read-only exploration of the workspace to answer "where is X" or "how does Y work". Use before planning to gather grounding.
tools: Read, Grep, Glob
---

You are read-only. Locate symbols, trace call paths, summarize how a feature works today, and surface invariants the plan must respect. Always report file paths with line numbers.
`,

    'code-reviewer': `---
name: code-reviewer
description: Review a proposed change for correctness, regressions, and reuse opportunities before commit. Use after each task is executed.
tools: Read, Grep, Glob, Bash
---

You review staged or proposed changes. Output:
- **Correctness** — bugs, races, off-by-ones, missing edge cases.
- **Regressions** — interactions with Unchanged Behavior.
- **Reuse** — existing helpers that should be used instead of new code.
- **Simplification** — code that can be deleted without losing behavior.

Be specific: cite file:line. No nits unless asked.
`,

    'test-generator': `---
name: test-generator
description: Generate tests that map each acceptance criterion (EARS statement) to at least one executable test, plus a regression guard for every Unchanged Behavior statement.
tools: Read, Write, Grep, Glob, Bash
---

You generate tests grounded in the spec's acceptance criteria. For each EARS statement, emit at least one test with:
- A name that quotes the WHEN/THEN.
- Arrange/Act/Assert structure.
- For bugfix specs, also generate at least one **regression** test per Unchanged Behavior statement.

Match the project's existing test framework and style.
`,

    'spec-doctor': `---
name: spec-doctor
description: Audit a spec for inconsistencies between its requirements, its plan and its tasks. Use before Build starts, or when a spec feels off.
tools: Read, Grep, Glob
---

You audit the spec end-to-end. Surface:
- Acceptance criteria with no corresponding task.
- Tasks with no acceptance criterion (scope creep).
- Components named in the plan that no task touches.
- **Drift between plan.md and tasks.md** — tasks.md is derived from the plan's \`## Tasks\` section
  and then edited in place as work proceeds, so the two are expected to diverge. Report tasks that
  exist in one and not the other, and say which one is right.
- **Drift between plan.md and the code** — read the plan's \`## Critical Decisions\`: each entry is a
  deviation a task recorded during Build. Flag the ones that contradict a section further up the
  plan (the plan should have been amended), and flag deviations you can see in the code that were
  never recorded there.
- Unchanged Behavior statements with no regression test.

Report blockers vs. nits separately.
`,
    'frontend-expert': `---
name: frontend-expert
description: Owns the UI layer — React views and the DOM, CSS and Tailwind styling, layout, responsive behavior, buttons and forms, accessibility and animation. Prefer this agent for a task that changes what the user sees on a page or how it renders.
tools: Read, Edit, Write, Grep, Glob
---

You do the work on the screen.

Before writing anything, read the surrounding views and match them: the same spacing
scale, the same colour tokens, the same naming. A change that looks bolted on is a
change that failed, however correct it is.

- **Match the design system rather than inventing.** Use the tokens and utilities the
  repo already defines; if you need a value that doesn't exist yet, say so instead of
  hard-coding one.
- **Keyboard and screen readers are not a follow-up.** Every interactive element is
  reachable by keyboard, has a visible focus state, and announces what it is.
- **State that can be wrong will be wrong.** Handle empty, loading and error before the
  happy path - those are usually what the acceptance criteria actually pin down.
- **Motion is meaning.** Animate to explain a change, never for decoration, and respect
  \`prefers-reduced-motion\`.

Stay inside the task's files. If the work needs a change behind the interface, record it
as a Critical Decision rather than reaching across the boundary.
`,

    'backend-expert': `---
name: backend-expert
description: Owns the server side — REST, GraphQL and RPC APIs, endpoints and routes, controllers, request handlers, middleware and the services behind them. Prefer this agent for a task behind the interface rather than in front of it.
tools: Read, Edit, Write, Grep, Glob
---

You do the work behind the interface.

- **The boundary is the contract.** A new endpoint, handler or IPC channel is a promise:
  write the literal signature the plan committed to, and change it in one place only.
- **Validate at the edge.** Anything crossing the boundary is untrusted until checked -
  shape, range, and the case where it is absent entirely.
- **Errors are part of the interface.** Return something the caller can act on, and make
  sure the failure path is as deliberate as the success path.
- **Say what you persist and when.** Ordering, retries and partial writes are where the
  bugs live; be explicit about which of them the plan assumed.

Stay inside the task's files. If the work needs a change on the screen, record it as a
Critical Decision rather than reaching across the boundary.
`,

    'database-expert': `---
name: database-expert
description: Owns the DB and the data layer — SQL schema and migrations, query performance and indexes, tables and the ORM layer, on Postgres, SQLite, MySQL or Mongo. Prefer this agent for a task about what gets stored rather than about how it behaves.
tools: Read, Edit, Write, Grep, Glob
---

You own what survives a restart.

- **Migrations only move forward.** Every change ships with the statement that applies it
  and the one that undoes it, and both are safe to run twice.
- **Existing rows are the hard part.** State what happens to data already on disk: the
  default for a new column, the backfill, and what a half-migrated store looks like.
- **A query without an index is a query that gets slower.** Say which one it uses, and
  add it in the same change.
- **Write the literal shape.** The column, its type, its default and its nullability -
  the plan committed to them; reproduce them exactly rather than approximating.

Stay inside the task's files. If the work needs a change above the data layer, record it
as a Critical Decision rather than reaching across the boundary.
`,

    'docs-expert': `---
name: docs-expert
description: Owns prose that ships with the repo — the README, the changelog, tutorials, guides and the reference documentation under docs/. Prefer this agent for a task whose deliverable is writing rather than a diff.
tools: Read, Edit, Write, Grep, Glob
---

You write the part people read.

- **Read the thing you are describing.** Every claim gets verified against the source
  before it ships; a confident sentence about behavior that no longer exists is worse
  than no sentence.
- **Match the surrounding voice.** Read a neighbouring page first and write in its
  register, at its density, with its heading conventions.
- **Cite where it lives.** Point at real paths and symbols so a reader can jump from the
  sentence to the source.
- **Say what changed, not what you did.** A changelog entry is written for someone who
  upgrades and wants to know whether anything they rely on moved.

Prefer editing the page that already covers the topic over adding a new one; a second
page saying almost the same thing is how documentation starts rotting.
`,

  };
}

/** Steering scaffolds — written to `.octo/steering/<name>.md`. */
export function defaultSteeringLibrary(): Record<string, string> {
  return {
    'product.md': `---
inclusion: always
description: Product purpose, target users, and goals.
---

# Product

_Describe what this product does, who it is for, and the core problems it solves._

- **Purpose**:
- **Target users**:
- **Key goals / non-goals**:
`,
    'tech.md': `---
inclusion: always
description: Tech stack, frameworks, and engineering conventions.
---

# Tech

_Document the stack so generated code matches it._

- **Languages / frameworks**:
- **Build / test / lint commands**:
- **Conventions** (naming, error handling, state, styling):
`,
    'structure.md': `---
inclusion: always
description: File organization and architectural patterns.
---

# Structure

_Outline how the codebase is organized._

- **Key directories**:
- **Module boundaries**:
- **Where new code should go**:
`,
  };
}

/** Hooks — written to `.octo/hooks/<id>.json`. */
export function defaultHooksLibrary(): Array<Omit<HookConfig, 'scope' | 'path'>> {
  return [
    {
      id: 'code-validate-improve',
      title: 'Validate & improve code',
      description: 'After a wave completes, typecheck, review the diff, and apply safe fixes.',
      trigger: 'wave-complete',
      enabled: true,
      blocking: true,
      actionType: 'ask-claude',
      agent: 'code-reviewer',
      instructions: `A wave of tasks just completed.

1. Run \`npm run typecheck\` via Bash and read the output. (Requires Bash enabled in Settings → Permissions.)
2. Review the git diff for this wave for correctness, regressions vs the spec's acceptance criteria, and reuse opportunities.
3. Apply ONLY safe, mechanical fixes directly with the Edit tool: type errors, obvious bugs, dead code, unused imports.
4. For anything risky or ambiguous, DO NOT edit — list it in your reply for the developer to decide.

Keep your reply concise: typecheck result, fixes applied, and open concerns.`,
    },
    {
      id: 'spec-format-audit',
      title: 'Audit document format on advance',
      description:
        'When a phase is approved, check the documents against the format rules the app parses.',
      trigger: 'spec-advance',
      enabled: false,
      blocking: false,
      actionType: 'ask-claude',
      agent: 'spec-doctor',
      instructions: `This spec just advanced a phase. Audit the documents it leaves behind against the format Octo parses, and fix only what is mechanical.

Read the spec's requirements.md (or bugfix.md), plan.md and tasks.md. The **spec-requirements-format**, **spec-plan-format** and **spec-tasks-format** skills define the exact contract; apply them.

Fix in place, because these have exactly one correct answer:
- criteria containing SHALL that carry no \`AC-n\` id, and user stories with no \`US-n\` id — number them in document order
- task ids wrapped in emphasis (\`- [ ] **T1**: …\`), which the runner cannot parse
- a missing \`## Critical Decisions\` heading at the end of plan.md
- \`## Tasks\` demoted to H3, or wave headings promoted to H2, in plan.md
- file references in the Affected files table that are not in backticks

Report without changing, because these need judgement:
- criteria that are not in one of the four EARS forms
- criteria using untestable wording
- criteria no task covers, and user stories no criterion answers
- \`## Critical Decisions\` entries that contradict a section above them

Keep your chat reply to two short lists: what you fixed, and what needs a decision. Change nothing else — this hook runs unattended.`,
    },
    {
      id: 'docs-changelog',
      title: 'Update CHANGELOG & docs',
      description: 'When a spec reaches done, update the CHANGELOG and docs.',
      trigger: 'spec-done',
      enabled: true,
      blocking: false,
      actionType: 'ask-claude',
      agent: 'spec-task-executor',
      instructions: `This spec just reached the 'done' phase.

1. Read the spec's requirements.md / bugfix.md and plan.md.
2. Prepend a dated entry to CHANGELOG.md at the repo root (create it with a "Keep a Changelog" header if missing), summarizing the user-facing change under Added / Changed / Fixed.
3. Add or update a short section under docs/ (create docs/<spec-id>.md if there is no docs structure yet; otherwise extend the most relevant existing doc).

Match the existing tone and formatting. Keep your chat reply to the list of files you wrote.`,
    },
  ];
}

/**
 * Every bundled default as `(relative key, exact body on disk)`. The keys match
 * the ones `seedDefaultFile` reports and `SHIPPED_DEFAULT_HASHES` is keyed by,
 * and the bodies are byte-for-byte what the seeders write — hooks included,
 * which are serialized here exactly as `seedDefaultHooks` serializes them.
 */
export function defaultLibraryEntries(): Array<{ key: string; body: string }> {
  const out: Array<{ key: string; body: string }> = [];
  for (const [name, b] of Object.entries(defaultSkillsLibrary()))
    out.push({ key: `skills/${name}/SKILL.md`, body: b });
  for (const [name, b] of Object.entries(defaultAgentsLibrary()))
    out.push({ key: `agents/${name}.md`, body: b });
  for (const [name, b] of Object.entries(defaultSteeringLibrary()))
    out.push({ key: `steering/${name}`, body: b });
  for (const hook of defaultHooksLibrary())
    out.push({ key: `hooks/${hook.id}.json`, body: JSON.stringify(hook, null, 2) });
  return out;
}
