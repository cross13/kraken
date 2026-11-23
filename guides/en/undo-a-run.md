---
id: undo-a-run
title: Undo what a run did
summary: Every run that can write files takes a checkpoint first. Restore it to put those files back the way they were.
track: howto
order: 5
area: build
minutes: 3
goto: side:changes
---

Before any run that can write — a task, a draft, an Assistant answer — Octo takes a **checkpoint**: a snapshot of the working tree as it is at that moment. Nothing you can see moves when it does; the snapshot is kept inside git, off to the side.

1. Find the run. In the **Assistant**, the checkpoint is the line under each answer. Anywhere else, open the run: **Run** on a group in **Changes**, **View run** in a diff, or a row in the **History** tab of the panel under the editor.
2. The line says how many files runs have written since that checkpoint. If it says nothing was written, there is nothing to undo.
3. Press **Restore**. The box lists exactly the files it will touch.
4. Read the list, then press **Restore** again. Each file goes back to what it held before the run. A file a run created is deleted.
5. The result line says what was restored, what was removed, and what was left alone and why.

## What it does and does not touch

- It undoes this run **and every run after it** for those files, including edits you made to them by hand since.
- It only touches files a run wrote. Anything else you changed stays exactly as it is.
- A git-ignored file such as `.env` is never in a checkpoint, so it is left alone and reported.
- It needs a git repository and the local Claude CLI. Read-only runs, such as a code review, take no checkpoint.
- It cannot be undone. To undo a single block instead, use **Revert hunk** in the file's diff.
