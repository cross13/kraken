---
id: format-check
title: Read the format check before you approve
summary: The strip above the gate bar lists what Octo can't parse in the document, splits it into fixable and judgement, and costs nothing.
track: howto
order: 6
area: specs
minutes: 2
goto: spec:define
---

Octo parses spec documents, it doesn't just display them. A task id in bold is a task the runner never sees; a criterion without `SHALL` never reaches the Review view. The format check catches those as you work.

1. Open a spec document. If anything is off, a strip appears just above the gate bar: **N formatting issues Octo can't parse**. No strip means nothing to report.
2. Click it to show the list. Each finding is tagged:
   - **fixable** — there is exactly one correct answer. A criterion with no `AC-n` id, a story with no `US-n`, a task line like `- [ ] **T1**: …`, a plan with no `## Tasks` or no `## Critical Decisions` heading, a file path in a table outside backticks, a plan that cites no `AC-n` at all.
   - **judgement** — you have to decide. A criterion that isn't in EARS form, untestable wording like "fast" or "intuitive", a story nothing tests, a criterion that answers no story, a task that depends on an id no task defines.
3. Press **Fix with Claude** to hand the list to Claude as a targeted revision. The fixable items go in as instructions to apply in place; the judgement ones go along too, flagged as needing judgement. The button only shows up when at least one finding is fixable.
4. Or fix it yourself in **Edit** (`⌘E`). The strip updates as you type.

## Why it matters

It costs nothing. Every finding comes from the same parsers the rest of the app reads your documents with, computed in the window — no run, no tokens, and it can't invent a violation. One finding blocks the gate: a plan with no usable `## Tasks` section, because approving it would leave Build empty.
