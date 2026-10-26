---
id: bugfix-spec
title: Start a bugfix spec instead of a feature
summary: Describe a bug on Home and Octo opens a bugfix spec — bugfix.md instead of requirements.md, with regression guards built in.
track: howto
order: 1
area: specs
minutes: 3
goto: spec:define
---

A bugfix spec runs the same three stages as a feature, but its first document is `bugfix.md`: a reproduction and a defect to pin down, not stories to gather. The stage is called **Bug analysis** instead of **Requirements**.

1. On **Home**, describe the bug in the composer. Octo picks the kind from the words you use: `bug`, `fix`, `crash`, `error`, `broken`, `regression`, `fail` (or `fails`, `failing`, `failed`), `doesn't work` and `not working` make it a bugfix. Anything else is a feature.
2. Look at the chip beside the input before you press anything. It reads **bugfix** with a bug icon, or **feature**. There is no toggle — if it guessed wrong, reword the text.
3. Press **Plan**. The spec opens on **Bug analysis** with `bugfix.md` as the first file tab, and nothing has run yet.
4. Press **Draft bug analysis with Claude**. The run goes to the bundled `bug-analyzer` agent when it is installed, carries the `sdd-bugfix` skill (reproduce, root cause, minimal fix) plus `spec-bugfix-format`, and writes five sections: Reproduction, Current Behavior, Expected Behavior, Unchanged Behavior and Environment.
5. Read **Unchanged Behavior** closely. Those `WHEN … THEN … SHALL CONTINUE TO` lines are the regression guards, and `sdd-bugfix` tells the plan to make them explicit under `## Verification`.
6. Press **Approve bug analysis**. From there it is the usual loop: Clarify, `plan.md`, Build.

## Tip

The Review view and the format check work on `bugfix.md` too. With no user stories to group by, Review groups criteria by the section they sit in, and still flags anything that is not EARS or uses untestable wording.
