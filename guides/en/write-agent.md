---
id: write-agent
title: Add an agent the router will pick
summary: Write an agent in .claude/agents whose description wins the tasks in its domain, and only those.
track: howto
order: 2
area: library
minutes: 5
goto: library:agents
---

An agent is a markdown file in `.claude/agents/`, in Claude Code's own format: front matter, then a body that becomes the system prompt. Routing reads exactly two fields to decide who runs a task: `name` and `description`.

1. Open **Library › Agents** and press **New agent**. Fill **Name** and **Description (when to use it)**, then **Create agent**. It writes `.claude/agents/<name>.md`:

   ```markdown
   ---
   name: api-expert
   description: Owns the backend API — REST endpoints, route handlers, middleware and auth.
   tools: Read, Write, Edit, Bash, Grep, Glob
   ---

   # api-expert
   ```

2. Write the body: what the agent owns, which files, which conventions. That is what it is told; it plays no part in getting picked.
3. Write the description in the router's vocabulary. A task's keywords come from a fixed list of domains — frontend, backend, database, test, devops, docs, security, data — and the words that signal them (`api`, `endpoint`, `schema`, `tailwind`, …). A word outside that list, like "Stripe", never scores. Each keyword found in `name + description` by substring is one point.
4. Keep generic words out of it. A set of implementation words (`build`, `code`, `feature`, `app`, `implement`, …) is added to every task's keywords. Two of those in your description and the agent clears the specialist threshold on every task, beating `spec-task-executor` outright. `app` also matches inside "approved" and "apply".
5. Project agents win. A workspace agent shadows a global one in `~/.claude/agents/` with the same name, and gets a small score bonus over global ones.
6. Check the result. The agent's page shows **Best for**: the steps it would be auto-selected for. Then open **Library › Routing**, pick **Task execution**, and type a task from your domain and one from outside it. Your agent should win the first and not appear on top for the second.

## Tip

If you know which agent a task needs, skip the scoring: write `- [ ] T4 @api-expert: …` on the task line. A per-task `@agent` beats everything else.
