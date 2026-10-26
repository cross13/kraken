---
id: danger-zone
title: Start clean with the Danger zone
summary: Delete every spec on disk and the run history in one go, while keeping your settings, keys and library intact.
track: howto
order: 2
area: setup
minutes: 2
goto: library:settings
---

You wipe what the SDD loop has produced so far and keep your setup. Nothing here can be undone. To delete a single spec, use the `⋯` menu on its card on Home instead.

1. Open **Library › Settings** with the project open and scroll to **Danger zone** at the bottom. It only appears when a project is open.
2. Choose what goes. Both toggles start on, and each shows the real counts for this project:
   - **Spec files** — every spec folder under `.octo/specs/`, deleted from disk. Folders left in an old `.kraken/specs/` are included and counted separately.
   - **History database** — runs, phase events, hook runs, file touches and errors. Choose **This project** or **Every project**; the second clears the history of every workspace, not just this one.
3. Stop anything that is running first. While a run is active the panel says so and points you to **Activity › Runs**, and the app refuses the reset anyway.
4. Type `RESET` in the box and press **Delete permanently**. A line confirms how many spec folders and history rows were removed.

## What it never touches

Your settings, your API key, agents, skills, hooks and steering all stay exactly where they are, because losing those is losing your setup, not your clutter. Your code is not touched either: only the spec folders themselves are removed, so anything a task already changed in the repository stays, committed or not.
