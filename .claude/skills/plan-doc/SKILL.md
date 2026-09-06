---
name: plan-doc
description: Write an implementation or refactor plan that people actually read — a mermaid diagram of the approach, a file table with real path:line references, and stable task IDs. Use whenever you are asked for a plan, a refactor plan, a phased migration, an RFC, or a technical design document.
---

# Plan documents

A plan nobody reads is a plan that doesn't work. Optimise for a reviewer who will
scan it in 30 seconds and then read the part they own.

## Shape

1. **Header** — objective in one line, appetite (S/M/L), risk. A TL;DR table of
   *before → after* when the plan changes an existing system.
2. **Master checklist** near the top when the plan has phases: one flat list of
   every phase with `- [ ]`, so progress is visible without scrolling. This list
   is the single source of truth for status — tick it as work lands.
3. **A mermaid diagram of the approach**, before the prose. Pick the type
   deliberately: `flowchart` for the shape of the change, `sequenceDiagram` for
   interactions over time, `erDiagram` when the data model moves. Quote every
   node label. Follow the `mermaid-diagrams` skill if it is installed.
4. **Affected files** as a table `| File | Change |`. Ground every path with
   Grep/Glob and cite `path:line`. Never invent a path.
5. **Per phase**: objective, the file table, `- [ ]` tasks with stable ids
   (`T1`, `T2`), an **acceptance** line, and a **rollback** line.
6. **Risks & open decisions** last, as a table. Mark decisions that block a
   phase, and say which one.

## Rules

- **No identifier zoo.** `T1` is the only prefix. `REQ-001`, `SEC-002`,
  `CON-003` make a document machine-parseable and human-hostile.
- **Summary above detail**, always. Tables over prose. Emoji status (✅ ⬜) in
  checklists — they scan faster than words.
- **State what you verified and what you didn't.** "typecheck and build green;
  the migration is untested against a real database" is worth more than a claim.
- **Record deviations.** When execution departs from the plan, edit the plan and
  say why in one line. A stale plan is worse than no plan.
- Keep prose short. If a paragraph explains a table, delete the paragraph.
