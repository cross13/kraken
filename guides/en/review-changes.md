---
id: review-changes
title: See what changed, task by task
summary: Changes lists every file that differs from the last commit under the task that wrote it, and opens each one as a green-and-red diff.
track: howto
order: 4
area: ship
minutes: 4
goto: side:changes
---

After a build run, the question is always the same: what did it actually touch? **Changes** answers it without leaving the app.

1. Press the **Changes** icon in the dark bar on the left — the one with the number on it. The number is how many files differ from the last commit.
2. The files are grouped **By task**: each group is the run that last wrote those files — `T3` with the task's own sentence and the agent that ran it, a plan draft, the Assistant. Files no run wrote sit at the bottom under **Edited by hand**. Switch to **By folder** for plain tree order.
3. Press **Run** on a group to read the run that produced it: prompt, output and the files it touched.
4. Click a file to open its **diff** against the last commit, as a tab. Added lines are green, removed lines are red, and inside a changed line the part that moved is a shade stronger. The numbers beside each file are lines added and removed.
5. Choose **Split** to see the last commit on the left and your working copy on the right, or **Unified** to see them stacked. The arrows step from one change to the next.
6. The strip under the toolbar names the run that last wrote the file, with **Open spec** and **View run**. **Open file** shows the whole file.
7. If the branch has a code review, its findings for this file appear in the diff, under the line each one is about. They come from the last review, so they can be older than the code beside them. **Fix with Claude** on a finding sends that one finding to the Assistant, which opens beside the diff; it starts a run straight away, and Claude is told to say so if the finding is wrong rather than change anything.
8. To undo one block of changes, press **Revert hunk** on its grey header row, then **Revert**. Only that block goes back to the last commit; the rest of the file stays. This cannot be undone.
9. To commit, tick the files you want — the checkbox stages them — write a message, and press **Commit**. With nothing ticked it commits everything. The commit is local; push and open the pull request from the spec's **Ship** panel or the repository panel.

## Tip

The grouping tells you which run touched a file most recently, not who wrote each line. If you edit a file after a task did, it still shows under that task until you commit — the diff itself is always the truth.
