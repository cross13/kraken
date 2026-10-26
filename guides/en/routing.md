---
id: routing
title: See which agent will run a step, and why
summary: Library › Routing runs the real router on any step or task text, shows every candidate's score, and lets you pin an agent.
track: howto
order: 5
area: library
minutes: 4
goto: library:routing
---

Library › Routing is a preview of the routing decision, not a settings page. It runs the same logic a real run uses, with no side effects, so you can find out who would get a task before you spend a run on it.

1. Open **Library › Routing**. Under **Simulate a step**, pick a **Step**: **Requirements**, **Bug analysis**, **Plan**, **Task execution**, **Task refine**, **Polish**, **Audit** or **Code review**, and a **Spec kind**.
2. For **Task execution** and **Task refine**, type a real task line into **Task description**. The router scores agents against that text.
3. Read **Resolved routing**: the agent that would run, with a badge saying why (**Best specialist**, **Bundled default**, **Pinned**, **Generic Claude**, …), and the **skills injected**: the SDD skill, the format skill for that document, and a domain skill if one matched.
4. Read **Candidate scoring**: the keywords taken from the step, then every installed agent that matched any of them, with the words it hit, its `project` or `global` scope chip, and its score. Project agents carry a 0.5 bonus. If the wrong agent wins, its hit words tell you which word in its description to remove.
5. If scoring still picks wrong for a step, open **Advanced** and set an agent under **Agent pins** instead of **Auto-route**. A pin beats everything except a per-task `@agent` and an agent you picked for chat with **Use in chat**. You can also pin from an agent's own page, under **Pin to steps**.
6. **Auto-inject matching skills** in the same section turns all automatic skill injection on or off. Skills you switched off one by one are listed under it.

## Tip

**Reset** in **Advanced** puts the whole routing config back to defaults: pins, the injection switch and the per-skill list, not just the pins.
