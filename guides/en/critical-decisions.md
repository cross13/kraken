---
id: critical-decisions
title: Read the Critical Decisions a build leaves in the plan
summary: When a task has to deviate from the plan, it records the decision in plan.md. Where to find those entries and what to do with them.
track: howto
order: 3
area: build
minutes: 3
goto: spec:plan
---

The plan is written before the code, and the code always learns something the plan didn't know. Instead of letting the two drift apart silently, every task run is told: if you deviated from `plan.md`, or made a call the plan doesn't cover, write it down there.

## What a task writes

At the end of `plan.md`, under `## Critical Decisions`, it appends an entry like:

```
### Critical Decision — T3: Store the ledger per workspace
- **What**: keyed the version by workspace root, not globally.
- **Why**: a global key upgrades one workspace and silently skips the rest.
- **Affects**: the Affected files row for electron/main.ts.
```

What it decided, why, and which files or later tasks it touches. A task that matched the plan appends nothing, and no task ever rewrites the plan's `## Tasks` section. Refining a finished task with feedback follows the same rule.

## How to read them

1. Open the spec's `plan.md` tab and scroll to the end, or use the **CONTENTS** spine in Zen (`⌘⇧Z`) to jump to **Critical Decisions**.
2. For each entry, read the section of the plan it contradicts. If the plan is now wrong, fix that section — by hand (`⌘E`) or with **Revise with feedback…** — so the next reader doesn't have to reconcile the two.
3. Check **Affects**. A decision that changes a later task is the one to catch before that task runs.
4. Run **Audit for drift** from the **More actions** menu (`⋯`): `spec-doctor` flags entries that contradict the plan above them, and deviations it can see in the code that were never recorded.

## Tip

Keep the `## Critical Decisions` heading at the end of the plan even when it's empty. The format check flags a plan without it, and fixing that is one of the things **Fix with Claude** does.
