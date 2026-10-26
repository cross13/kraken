---
id: skills
title: Use skills, and keep them worth their cost
summary: Skills are pasted into the system prompt whole. Know when each one gets in, and how to cut the ones that don't help.
track: howto
order: 3
area: library
minutes: 5
goto: library:skills
---

A skill is a `SKILL.md` in `.claude/skills/<name>/` (or `~/.claude/skills/` for every workspace). When one is selected, its entire body is prepended to the system prompt. It is not a label on the run; it is part of what Claude reads.

1. Open **Library › Skills**. **Seed defaults** installs the bundled ones; **New skill** scaffolds your own with a **Name** and a **Description (when it applies)**.
2. Know how each one gets in:
   - **SDD skill** — `sdd-feature` or `sdd-bugfix`, by spec kind. Injected into every spec-drafting and task run of that kind.
   - **Format skills** — `spec-requirements-format`, `spec-plan-format`, `spec-tasks-format`, `spec-bugfix-format`. They carry the exact document shape the app parses, and ride along whenever that document is written. Task runs get the tasks one.
   - **Domain match** — on a task run, the skill whose name and description best match the task text, but only if it matches at least two keywords. When drafting a plan, matched skills appear as chips next to the draft button; click one to leave it out of that draft.
   - **Chat** — in the Assistant (`⌘J`), start a message with `/skill-name` and that skill's body is injected for that message.
3. Treat the body as a cost. It is sent on every run it matches. Cut what Claude already knows and keep what is specific to this project.
4. To stop a skill being auto-injected, open it and click **Injection on** so it reads **Injection off**. It is then skipped unless a run names it explicitly.
5. To switch all automatic injection off, go to **Library › Routing › Advanced** and turn off **Auto-inject matching skills**. Leave it on unless you know why: without the format skills, drafts drift from the shape the app can read.

## Tip

Open **Quick start guide** from `⌘K` and scroll to **Sharpen your own skills**. Each of your own skills (not the bundled `sdd-` and `spec-` ones) has a **Review & improve** button: Claude checks it against this repository and rewrites it in place, and says so if it thinks the skill should be deleted instead.
