---
id: revise-improve
title: Revise, improve, or edit a spec document by hand
summary: Three ways to change a draft — tell Claude what to change, ask it to critique itself, or type the fix yourself — and when each one fits.
track: howto
order: 5
area: specs
minutes: 3
goto: spec:define
---

Once a document has a draft, the gate bar under it offers two Claude actions beside Approve, and the view switcher above it has a third way in: your own keyboard.

## Revise with feedback

1. Press **Revise with feedback…**. The gate bar turns into an input.
2. Say what should change, specifically: "split the export flow into its own story", "drop the offline mode".
3. Press `Enter` or **Revise**. Claude applies targeted changes and is told to keep everything else intact.

Use it when you know what is wrong.

## Improve with Claude

Press **Improve with Claude**. It is a self-review pass: Claude reads the document as a critical reviewer — untestable criteria, stories with no criteria, contradictions, missing edge cases; on the plan, uncited `AC-n` ids, wave ordering and invented file paths — and edits in place. Anything only you can decide goes into `## Open Questions` instead of being guessed. Its chat reply lists what it changed, or says the document is already solid.

Use it when you suspect something is off but can't name it. On the Build stage the same idea is **Improve plan**, which reviews `tasks.md`.

Neither run stops to ask clarifying questions; both always come back with the document changed or confirmed.

## Edit by hand

Pick **Edit** in the view switcher, press `⌘E`, or double-click the text in **Source** view. `⌘E` again takes you back to **Source**. Changes save automatically as you type.

Use it for anything you could fix faster than you could describe: a number, a name, a sentence. It costs no run.
