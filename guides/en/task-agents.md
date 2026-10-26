---
id: task-agents
title: Choose which agent runs a task
summary: Pin a task to an agent with @agent-name on its line, see how routing picks when you don't, and check what actually ran.
track: howto
order: 1
area: build
minutes: 3
goto: spec:build
---

Every task runs as its own agent. You can name that agent on the task line, or let routing pick from the task's text — and either way, check afterwards what really ran.

1. Open **Build** and the **tasks.md** sub-tab, and press `⌘E` to edit.
2. Put the agent's name right after the task id: `- [ ] T4 @frontend-expert: add the empty state to the export dialog`. Use the exact `name` of an agent in `.claude/agents/` (workspace or `~/.claude/agents/`).
3. Go back to **Task list** and press **Start task**, **Run wave** or **Run all**. A per-task `@agent` beats every other rule.

## When you don't pin one

Routing goes in this order: per-task `@agent`, then an `@agent` you picked in the chat, then a pin set in **Library › Routing › Advanced**. Failing those, it scores every installed agent's name and description against the task text. A strong specialist match wins; otherwise the bundled `spec-task-executor` runs it; otherwise any agent that matched at all; otherwise the first project-local agent. Generic Claude only runs when nothing is installed. To test a sentence before it runs, type it into **Library › Routing**.

## Check what ran

Click a task to open its inspector. The **Agent** section shows **Name**, **Scope** (`root` for the workspace's `.claude/`, `global`, or `not installed`) and **Routing** (why it was picked). **Declared** under **Task** shows the `@agent` you wrote. A warning at the top tells you when the agent isn't installed — `it won't load` — or when routing fell back to generic.

## Tip

A typo in `@agent-name` still wins routing; the run just gets none of that agent's instructions. The inspector's warning is the place that catches it.
