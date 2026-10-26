---
id: zen-reading
title: Read a spec properly in Zen
summary: Zen takes the whole window for one document — one column, a contents spine, a Focus dim, ids in the margin, and Approve at the end.
track: howto
order: 4
area: specs
minutes: 2
goto: spec:define
---

Zen is the reading mode for the document on screen. The file tabs, the phase strip, the view switcher and the gate bar all go away; what's left is the document in one column at a reading measure.

1. Open a spec document and press `⌘⇧Z`, the expand icon in the toolbar, or **Read in Zen** from `⌘K`. The shortcut does nothing while you are in **Edit**, where `⌘⇧Z` is redo.
2. Use the **CONTENTS** spine on the left to jump between sections. It follows your scroll, so it always shows where you are and how much is left. On a narrower window it folds into a dropdown in the top bar.
3. Toggle **Focus on** / **Focus off** in the top bar. With Focus on, every section except the one you're reading is dimmed. **MEASURE** switches between **Comfortable** and **Wide** columns. Both choices are remembered.
4. Read the ids in the left gutter. `AC-3`, `T1`, the story a criterion answers and the section number sit in the margin instead of as chips inside the sentence, so the prose reads like prose.
5. At the end you get a line like `End of plan.md` with the section, criteria and task counts, and two buttons: **Back to editor**, and the gate's own Approve (**Approve requirements**, **Approve plan**). Approving there advances the phase exactly like the gate bar and closes Zen.
6. Press `Esc` to leave. The flow underneath comes back as you left it.

## Tip

The Approve button only appears when the document is the one at the current gate. Reading an earlier, already-approved document in Zen gives you **Back to editor** only.
