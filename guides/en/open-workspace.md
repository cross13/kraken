---
id: open-workspace
title: Open a repository and install the defaults
summary: Point Octo at your code, install the bundled agents, skills, steering and hooks, and say what the project is.
track: start
order: 2
area: setup
minutes: 5
goto: library:steering
check: library
---

You end up with a repository open, Octo's bundled library installed next to your own `.claude/` setup, and the three steering docs ready to fill in.

1. On Home, press **Open folder** and pick the repository you want to work in. Later you can switch from the project pill in the command bar, or **Change directory…** in **Library › Settings**. Claude runs with this folder as its working directory, so it sees your code and your `CLAUDE.md`. Agents and skills already in `.claude/` (and `~/.claude/`) load on their own.
2. On a workspace with no agents, Home shows a one-line notice. Press **Instalar defaults** on it, or **Seed defaults** in any of **Library › Agents**, **Skills**, **Steering** or **Hooks**. Every one of those buttons installs the whole set:
   - 12 agents and 7 skills into `.claude/agents/` and `.claude/skills/`
   - 3 steering scaffolds (`product.md`, `tech.md`, `structure.md`) into `.octo/steering/`
   - 3 hooks into `.octo/hooks/`; two are on, the format audit is off
3. In **Library › Agents**, the line next to **Seed defaults** says what happened: how many were installed, updated, and kept because you edited them.
4. Open **Library › Steering** and fill in the three docs. They are prepended to every run (chat, drafting, tasks and hooks), so this is where your stack, your commands and your conventions go.

## Why it matters

Seeding is an upgrade, not just a first install. Running it again rewrites a bundled file you never touched with the current version and leaves any file you edited alone. Opening a workspace also updates an existing library this way, and Home tells you once when it did; it never installs one you did not ask for. The format skills in that library are what keep Claude writing documents the app can parse.

**Next:** Your first spec
