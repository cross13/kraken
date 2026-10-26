---
id: reopen-phase
title: Reopen a finished spec, and see who runs each step
summary: Reopen tasks puts a done spec back in Build when the code has moved on; the briefing aside shows which agent and skills each step uses.
track: howto
order: 7
area: specs
minutes: 3
goto: spec:build
---

A spec that reached **done** is not frozen. When the code drifts from it, or a follow-up turns up, you can put it back in Build and run more tasks against the same documents.

## Reopen Build

1. Open the spec. Earlier documents stay reachable from their file tabs at any phase; their gate bar shows **Continue** instead of Approve, because that gate is already passed, and edits save as usual.
2. Decide what Build should do. Add task lines, or untick the ones to redo, in the **tasks.md** sub-tab under Build. Do this first: if every task is still ticked when you reopen, Build sees the last task complete and advances straight back to done.
3. Press **Reopen tasks** in **Ship**, or **Reopen tasks (re-sync)** from the **More actions** menu (`⋯`). The phase goes back to Build and you land on **Task list**.
4. Run the tasks. When the last one completes, the spec advances to done again and opens **Ship**. The old `summary.md` is kept; press **Regenerate** on it to cover the new work.

Only Build can be reopened from the app. To revisit requirements or the plan, edit them in place.

## See who runs this step

On any document, press the panel icon in the toolbar (**Show who writes this**). The briefing aside shows:

- **Who writes this** — the agent the router will pick for this step, and why: **Bundled default**, **Pinned**, **Chat override** or **Best specialist**. Click it to open the agent file.
- **Instructions it carries** — the skills injected into the run, labelled **Stages and gates**, **Document shape** or **Domain match**.
- **How it works** — what the run actually does, step by step.

It is the same decision **Library › Routing** explains, shown where it lands. The aside needs a window at least 1180px wide.
