---
id: connect-tracker
title: Connect a ticket tracker
summary: Point Octo at an MCP server you already have, sign in, pick the project, and check which tool each step will call.
track: howto
order: 1
area: tickets
minutes: 6
goto: library:tickets
check: tracker
---

A tracker linked to this workspace, so Home lists its open tickets and each spec can keep its ticket in step. Trackers are MCP servers: Octo reads them from `.mcp.json` and `~/.claude.json`, including the per-project entries `claude mcp add` writes.

1. Open **Library › Tickets**. Each configured server shows as a tab with a **+**; click one to add it as a tracker.
2. Under **Connect**, set **What kind of tracker**: **Jira** (Atlassian's MCP, with pinned tool names), **Tracker** (tasks with a plan and validation criteria) or **Generic** (discovered tools, best-effort argument names). **Endpoint** comes from your MCP config; editing it here overrides it only in Octo.
3. Authenticate one of two ways. **Sign in** opens your browser for OAuth and comes back on its own; tokens renew automatically. Or paste a value into **Token, if you have one instead** and press **Save** — `Bearer …`, `Basic …` or a bare token, encrypted with the OS keychain.
4. Press **Connect & read tools**. Octo reads the server's own tool list and matches each step to a tool. If it fails, **Copy report** gives you the whole exchange to paste somewhere useful.
5. Under **Scope**, press **Read list** and pick the **Atlassian site** or **Client / project**. Nothing can be listed without it. Jira also takes a **Project key**, needed only to create issues.
6. Under **Sync**, tick **Keep tickets in step with specs**.
7. Open **Tool mapping** to see each step — **Create ticket**, **Write plan**, **Link pull request**, **Search** and the rest — and the tool it will call. Change any that are wrong, or set **— not mapped —**.

## Tip

Discovery only fills blanks: a mapping you corrected stays corrected the next time you connect. The banner at the top says **Ready** once everything is in place.
