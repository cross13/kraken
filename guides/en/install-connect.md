---
id: install-connect
title: Install and connect Claude
summary: Build the app from source and point it at Claude, through your local Claude CLI or an Anthropic API key.
track: start
order: 1
area: setup
minutes: 6
goto: library:settings
check: backend
---

You get a running copy of Octo that can talk to Claude. There are no signed installers yet, so it runs from the repository.

1. Install Node.js 20 or newer, then the Claude CLI, and log in once:
   `npm install -g @anthropic-ai/claude-code`, then `claude`.
2. Clone the repo and run `npm install`. The postinstall step rebuilds the two native modules (`better-sqlite3` and `node-pty`) for Electron.
3. Start it with `npm run dev`, or build an app bundle with `npm run package:mac` (`package:win` and `package:linux` also exist).
4. Open **Library › Settings**. Under **Backend**, pick one of the two cards:
   - **Local Claude** (the default, marked **Best**) runs your installed `claude` CLI with the open folder as its working directory. The panel below should say **Claude CLI detected**. If it says **Claude CLI not found**, install it and press **Re-detect**.
   - **Anthropic API** is pay-per-use. Paste your `sk-ant-…` key into **Anthropic API key** and press **Save**. It is encrypted with your OS keychain and only sent to `api.anthropic.com`.
5. On **Local Claude**, check **Permissions**: **Edit & write files** must be on for Claude to write spec documents. **Run shell commands** adds Bash and is off by default.

## Why it matters

The two backends are not equal. The API backend sends a plain message with no tools, so Claude cannot read your code or write files: it cannot save a spec document to disk and a task run cannot change anything. Use **Local Claude** unless you only want chat. A stored API key also lets the model list be verified against your account.

**Next:** Open a repository and install the defaults
