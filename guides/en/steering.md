---
id: steering
title: Tell Claude what this project is
summary: Write steering docs once and every run — chat, drafting, tasks, hooks — starts knowing your stack and conventions.
track: howto
order: 1
area: library
minutes: 6
goto: library:steering
check: steering
---

Steering docs are markdown files in `.octo/steering/` that get prepended to the system prompt of every run: chat, spec drafting, task execution and hooks. Write your stack, commands and conventions there once, instead of in every prompt.

1. Open **Library › Steering**. With no docs yet, press **Seed defaults**: it writes `product.md`, `tech.md` and `structure.md`, all set to **Always**.
2. Fill them in. The scaffolds are headings and empty `- **Label**:` bullets, and Quick Start only counts a doc as done once it says something beyond that.
3. For anything else, press **New doc**, give it a **Name**, a one-line **Description**, and pick **When it's injected**:
   - **Always** — in every run. Keep these short; they cost tokens on every call.
   - **On matching files** — needs a **File glob** like `src/**/*.tsx`. It only fires when a run is handed matching file paths, which today means hooks fired by a file save.
   - **Manual** — only when pinned.
   - **Auto (menu)** — only the name and description go into the prompt, as a menu line. The body does not.
4. Choose **Project** or **Global** scope. Global docs live in `~/.octo/steering/` and apply to every workspace.
5. To force a non-Always doc into every run for a while, open it and press **Pin to runs**. Pins are saved per workspace; **Unpin** when you're done.
6. Open the **Injection preview** tab to see the exact block a run would get. If you have an **On matching files** doc, type a path into the simulate field to test the glob.

Your root `CLAUDE.md` and `AGENTS.md` show up in the list as read-only, always-injected docs. Edit them with **Open file**, not here.

## Why it matters

Nothing else reaches every run. A good agent or skill only applies when it is picked; steering is there whether or not routing guessed right, so it is the cheapest way to stop Claude guessing your test command.
