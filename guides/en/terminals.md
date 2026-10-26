---
id: terminals
title: Talk back to Claude in a terminal
summary: Open a shell or a live Claude CLI session inside the app — the one place you can answer Claude's questions and permission prompts.
track: howto
order: 2
area: activity
minutes: 3
goto: activity:terminals
---

Every other run in Octo is one-shot: the prompt goes in, the answer streams out, and nothing you type can reach it. Terminals are the exception — a real, two-way PTY in the workspace folder.

1. Open **Activity › Terminals**, or use ⌘K → **New terminal** or **New Claude session**.
2. Press **Terminal** for your login shell, or **Claude session** for the interactive `claude` CLI. Both start in the workspace with the same expanded PATH the app uses to find `claude`. If the CLI cannot be found, a Claude session drops you into a shell instead, so you can start it yourself.
3. In a Claude session, answer things the one-shot runs cannot: `AskUserQuestion` prompts, permission requests, and real slash commands, exactly as in your own terminal.
4. Links Claude prints are clickable and open in Google Chrome, falling back to your default browser if Chrome is not installed.
5. Switch between sessions with the tabs along the top. They keep running while you move around the app.
6. Hover a tab and press **×** to close it. Closing kills that process.

## Tip

Reach for a Claude session when a run needs a decision only you can make — approving a command, choosing between options, running a slash command. For everything else, specs and the Assistant are faster, because their output lands in the app instead of in scrollback.
