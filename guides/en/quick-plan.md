---
id: quick-plan
title: Draft a whole spec in one go with Quick Plan
summary: Quick Plan drafts the first document and the plan back to back, with no gates and no questions, and lands you on Build.
track: howto
order: 2
area: specs
minutes: 2
goto: home
---

Quick Plan turns one sentence into a spec that is ready to run: it drafts `requirements.md` (or `bugfix.md`), approves it, drafts `plan.md`, approves that, and leaves you on **Build** with `tasks.md` derived from the plan.

1. On **Home**, type what you want in the composer.
2. Press **Plan rápido**, or `⌘Enter` in the input. Plain `Enter` is the normal **Plan**, which creates the spec and runs nothing.
3. Watch it go in the Assistant (`⌘J`) or **Activity › Runs**. Each document is its own run; if one fails, the chain stops there and the spec stays on that stage.
4. When it lands on **Build**, read the plan before you press **Run all**. Nobody else did.

## What you give up

- **The gates.** Each document is approved the moment its draft finishes. The Plan gate's check for a usable `## Tasks` section is skipped too: if the plan came out without one, `tasks.md` falls back to a template of placeholder tasks.
- **Clarify.** A normal plan run that hits a decision it can't make — a library, a data shape, a migration — writes questions into Open Questions and stops so you can answer them. Quick Plan runs with no stops: it picks a reasonable default, records it in the plan, and lists what you should revisit under `## Open Questions`.

## When to use it

When you already know the answers: a small change, a well-understood bug, or a ticket that already carries a plan. On Home's board, dropping an armed ticket on the **Build** column does the same thing from the ticket. When the work has a real decision in it, use **Plan** and let Clarify ask.
