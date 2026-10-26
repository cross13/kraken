---
id: runs-history
title: Watch, stop and look back at runs
summary: Activity shows every run in flight with a cancel button, the one concurrency control, and the history of everything that already ran.
track: howto
order: 1
area: activity
minutes: 3
goto: activity:runs
---

One place for "what is Claude doing right now" and "what did it do". Every run lands here — chat, spec drafting, tasks, reviews, audits and hooks.

1. Open **Activity › Runs**, or click the live-runs pill in the command bar when something is running. The strip at the top says **Idle** or how many agents are running, and how many slots are in use.
2. Each card under **Running** shows the kind (**Task**, **Spec**, **Review**…), the task id, the agent, the spec and the elapsed time. The **×** on a card cancels that run; **Stop all** cancels every one.
3. **Max parallel agents** (1 to 8) caps how many tasks of a wave run at once. Chat and spec drafting do not count against it. It is the same control as the one on the tasks board.
4. **Recent activity** lists runs that finished this session, with status and duration. The trash icon clears it.
5. **Activity › History** is the permanent record from the history database: totals, errors, cancelled runs and average duration, filterable by **all**, **done**, **error** or **cancelled**. Click a row to open the run with its full prompt and response.
6. **Activity › Specs** is the same data per spec: runs, error rate and time spent, a pipeline of where specs sit, and for each spec its recent runs and a timeline of phase advances.

## Tip

If a wave seems stuck, look at Runs before anything else. A task waiting for a slot is not a failed task, and raising **Max parallel agents** is a one-click answer when the work really is independent.
