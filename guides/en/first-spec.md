---
id: first-spec
title: Your first spec
summary: Describe the work on Home and get a spec with requirements you can review before any code is written.
track: start
order: 3
area: specs
minutes: 4
goto: home
check: spec
---

You type one sentence on Home and get a spec folder under `.octo/specs/<id>/` with a first document you can read and approve before anything touches your code.

1. Go to Home (or ⌘K → **New spec…**, which focuses the composer) and describe the work in the composer at the top. Be concrete about the behaviour you want, not the files.
2. Watch the chip that appears inside the composer. It reads `feature` or `bugfix`, guessed from your words: "bug", "fix", "crash", "error", "broken", "not working" and the like make it a bugfix. A feature starts with `requirements.md`; a bugfix starts with `bugfix.md` and its first stage is **Bug analysis** instead of **Requirements**.
3. Pick how far to go:
   - **Plan** (or `Enter`) creates the spec and opens it on its first stage. No Claude run starts. Your text is kept as the spec's brief, and the gate bar offers **Draft requirements with Claude** when you are ready to spend a run.
   - **Plan rápido** (or `⌘Enter`) drafts the requirements and then the plan back to back, with no approval stops, and leaves you in Build with `tasks.md` already derived. Use it when you already know the answers.
4. If what you typed ends with `?`, no spec is created. The text goes to the Assistant drawer (⌘J) as a question instead.
5. While a draft runs, a strip above the document says Claude is drafting it. The document reloads from disk when the run finishes; you can follow the run itself in the Assistant.

## Tip

Prefer **Plan** for your first few specs. It lets the Plan stage stop and ask you questions, which **Plan rápido** skips on purpose, and it shows you each gate the loop is built around.

**Next:** Review requirements and clarify the plan
