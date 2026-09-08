# Octo Developer Documentation

This folder is the **developer reference** for working on Octo — read it before
changing an existing module or adding a new one. It complements the high-level
`CLAUDE.md` at the repo root (which is the quick orientation map); the files here go
deeper into *how to build*.

> **Keep these docs current.** Any change to architecture, the IPC contract, the data
> model, or a subsystem **must** update the matching doc in the same change. See the
> "Documentation" rule in `CLAUDE.md`. Out-of-date docs are worse than none.

## Map of the docs

| Doc | What it covers | Read it when… |
| --- | --- | --- |
| [`architecture.md`](./architecture.md) | The three Electron layers, process model, and end-to-end data flow | You need the big picture or are touching cross-layer behavior |
| [`ipc-contract.md`](./ipc-contract.md) | Every IPC namespace + the exact recipe to add/change a handler | You're adding or modifying anything that crosses main ↔ renderer |
| [`data-model.md`](./data-model.md) | Shared types, on-disk spec shape, and the SQLite schema | You're changing what gets stored or persisted |
| [`backends.md`](./backends.md) | The CLI vs API Claude-streaming backends and the common event stream | You're touching how Claude is invoked or streamed |
| [`renderer.md`](./renderer.md) | Zustand stores, component tree, layout, agent routing, skill injection | You're building UI or changing client-side state |
| [`subsystems.md`](./subsystems.md) | Hooks, steering, orchestration, agents/skills, git/GitHub, terminals, Travel Display | You're working on one of those features |
| [`adding-a-feature.md`](./adding-a-feature.md) | A step-by-step recipe for shipping a new module end-to-end | You're creating a new module/view/feature from scratch |
| [`security-review.md`](./security-review.md) | The last full audit: what was found, what was fixed, what is still open, and what was verified sound | You're touching secrets, IPC handlers, subprocess spawning, or anything that renders content the app didn't author |
| [`refactor-metodologia-y-rebranding.md`](./refactor-metodologia-y-rebranding.md) | The move from four SDD phases to **Definir · Plan · Construir**, plus the Signal rebranding — phased plan with a master checklist | You want the *why* behind the current three-stage flow, or you're picking up a remaining phase |
| [`ux-redesign-proposal.md`](./ux-redesign-proposal.md) | The "Spec Is the App" UX redesign (implemented) — design rationale for the 4-surface IA and the gated spec flow. **Its stage list is superseded** by the refactor above | You want the *why* behind the current shell |
| [`../PRODUCTION-CHECKLIST.md`](../PRODUCTION-CHECKLIST.md) | Audited list of what must be true before a public release, prioritised P0/P1/P2 | You're planning a release or picking up hardening work |

## The one rule that matters most

Data crosses between Electron layers **only** through the typed IPC bridge. A feature that
touches the backend is always a three-part change:

```
electron/main.ts (registerIpc handler)  →  electron/preload.ts (window.octo method)  →  src/ (store/component)
```

Shared types live in `electron/shared/types.ts` and are imported by both sides — keep that
file dependency-free. See [`ipc-contract.md`](./ipc-contract.md) for the full recipe.

## Project gates

There is **no test runner and no linter**. The only automated gate on the code is:

```bash
npm run typecheck   # runs typecheck:node (electron/**) AND typecheck:web (src/**)
```

Two invariants it cannot see have their own scripts, and both should pass before declaring done:

```bash
npm run routes -- --check   # a stray word in an agent's `description` hijacks every task run
npm run hashes -- --check   # an unlisted default body never reaches a cloned workspace
```

Run all three after every change. See `CLAUDE.md` → Commands for the rest.
