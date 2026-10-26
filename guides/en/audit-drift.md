---
id: audit-drift
title: Audit a spec for drift against the code
summary: Audit for drift has spec-doctor compare requirements, plan, tasks and the actual code, and report what no longer lines up.
track: howto
order: 4
area: build
minutes: 3
goto: spec:build
---

Specs and code drift: a task does a little more than it said, a criterion never got a task, the plan says one thing and `main.ts` does another. **Audit for drift** asks an agent to find those gaps and tell you which phase to reopen.

1. Open the spec, at any stage.
2. Open the **More actions** menu (`⋯`, top right of the spec) and choose **Audit for drift**. Its hint reads `spec-doctor, read-only`.
3. The Assistant opens (`⌘J`) and the run streams there. It also shows up in **Activity › Runs** as `Audit` plus the spec's name.
4. Read the report. It covers:
   - acceptance criteria with no corresponding task or implementation;
   - tasks or code with no backing requirement — scope creep;
   - places where the code contradicts the spec, citing `file:line`;
   - a recommendation of which phase to reopen, if any, and what to change.

   With the bundled `spec-doctor` it also compares `plan.md` against `tasks.md`, checks the plan's `## Critical Decisions` against the sections above them, and lists Unchanged Behavior statements with no regression test. Blockers and nits come separately.
5. Act on it. Fix a document by hand or with **Revise with feedback…**; if the code needs more work, add the tasks to `tasks.md` — and if the spec is already done, use **Reopen tasks (re-sync)**.

## Good to know

The audit changes nothing. The prompt tells it not to edit, and the bundled `spec-doctor` only has `Read`, `Grep` and `Glob`. If you picked an agent in the chat with `@`, that override applies here too; without one, routing prefers `spec-doctor`, then `code-reviewer`. Install the defaults from **Library › Agents** if neither is there.
