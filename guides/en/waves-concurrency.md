---
id: waves-concurrency
title: Run waves in parallel without collisions
summary: Tasks in a wave run at the same time as separate agents — keep them disjoint, set how many run at once, and know what a failure stops.
track: howto
order: 2
area: build
minutes: 4
goto: activity:runs
---

A wave is a group of tasks under one `## Wave n` or `### Wave n` heading. Its tasks run at the same time, up to the parallel limit below, each as its own Claude run, and a wave only becomes runnable once every task in the waves before it is done.

1. Before you run anything, read the waves in **Build › Task list**. Two tasks in the same wave that touch the same file will overwrite each other. Move one into the next wave, or merge them into one task. A single task can also wait on another with `(depends on T2)` on its line.
2. Set how many tasks run at once: the **parallel** − / + control in the Build header, or **Max parallel agents** in **Activity › Runs**. They are the same setting, from 1 to 8, and it is saved. Only task runs count against it; chat and spec drafting don't take a slot.
3. Press **Run wave** on one wave, or **Run all** to run every remaining wave in order.
4. Watch **Activity › Runs**: each run with its elapsed time, **N / M slots in use**, a per-run cancel and **Stop all**.

## When a task fails

The rest of its wave keeps running. But the next wave stays locked, because the failed task isn't ticked, and the wave's `wave-complete` hooks don't fire. **Run all** stops after the batch that failed. Fix it, then run again; ticked tasks are skipped.

## Blocking hooks

Between waves, **Run all** fires `wave-complete` hooks. If one is marked **Blocking (autopilot waits for it)** in its hook editor — the bundled `code-validate-improve` is — the next wave waits for it. A banner says so, with **Unblock** to cancel the hook and carry on, and **Stop autopilot** to halt.
