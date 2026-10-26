---
id: run-and-ship
title: Run the tasks and ship
summary: Run the plan's tasks wave by wave, or all at once with autopilot, then commit and open a PR from the Ship panel.
track: start
order: 5
area: build
minutes: 10
goto: spec:build
---

You turn `tasks.md` into code, then commit it and open a pull request without leaving the spec.

1. Open the Build stage on **Task list**. Tasks are grouped into waves; the header shows how many are done and which wave you are on. **tasks.md** next to it is the same list as a document you can edit.
2. Run one task with **Start task** on its card, a whole wave with **Run wave**, or the next runnable task with **Run next**. Every task in a wave runs at the same time as its own Claude run, up to the **parallel** count in the header (1 to 8).
3. Or press **Run all**. Autopilot runs every remaining wave in order and waits for blocking hooks between waves; the bundled code-review hook is one. **Unblock** cancels a hook that is holding you up, **Stop autopilot** halts the whole thing.
4. When the last task completes, the spec advances to `done` on its own and the **Ship** tab opens. It writes a summary of the work into `summary.md` the first time you arrive; **Regenerate** rewrites it.
5. If you are on `main` or `master`, press **Create branch …** first. Then **Commit all** stages everything and commits with a message taken from the summary. With an `origin` remote the button reads **Commit all & push**.
6. With an `origin` and the GitHub CLI signed in, the pull request section drafts a title and body from the branch. Edit it and press **Create pull request**. Octo calls your local `gh`, so the PR is opened as whoever `gh auth login` signed in, and no GitHub token is stored in the app.

## Tip

Keep the tasks in one wave on different files. They run at the same time, and two agents editing the same file will undo each other. Move one to the next wave before you press **Run all**. If the code drifts from the spec later, **Reopen tasks** on Ship puts the spec back in Build.
