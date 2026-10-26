---
id: approve-and-clarify
title: Review requirements and clarify the plan
summary: Read the requirements, fix what the format check finds, approve, answer the plan's questions and approve the plan.
track: start
order: 4
area: specs
minutes: 8
goto: spec:plan
check: spec
---

You go from a drafted `requirements.md` to an approved `plan.md` and a `tasks.md` derived from it, deciding the open questions yourself instead of letting Claude guess.

1. Read the requirements. The control in the toolbar switches between **Source** (line-numbered markdown), **Cards** (one card per section), **Review** and **Edit**; `⌘E` toggles editing. **Review** groups each criterion under the user story it answers and flags criteria that are not in EARS form or cannot be tested.
2. If a strip above the gate bar says **formatting issues Octo can't parse**, open it. Items marked `fixable` have one correct answer, and **Fix with Claude** hands them over as a revision; `judgement` items are yours.
3. Use the gate bar. **Revise with feedback…** takes a sentence and redrafts; **Improve with Claude** runs a critical review that refines the document in place; **Approve requirements → Plan** advances the phase.
4. You land on the Plan stage's **Clarify** tab. If it is empty, press **Find open decisions**. Each question is a card with options: click one, press `1`–`9` to answer the first unanswered question, use **Other…** for your own answer, or **Ask Claude** for a recommendation.
5. Press **Apply N decisions → Plan** (N is how many you answered). The answers are written into the requirements as `## Resolved Decisions`, and the plan is drafted if `plan.md` is still empty. **Skip to plan** goes straight to the document instead.
6. Check `plan.md` in **Review**: each acceptance criterion sits beside the parts of the plan that satisfy it. Then press **Approve plan → Build**.

## Why it matters

Approving the plan writes `tasks.md` from its `## Tasks` section. A plan without one cannot be approved, and the gate says so; **Improve with Claude** adds the waves. A plan drafted from elsewhere that hits an unsettled decision writes its questions and stops, which sends you back to **Clarify**.

**Next:** Run the tasks and ship
