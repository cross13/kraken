# Contributing to 0ct0

Thanks for your interest in improving 0ct0! This document explains how to get set up
and what we expect in a contribution.

## Development setup

0ct0 is an Electron + React + TypeScript app.

```bash
npm install          # install dependencies
npm run dev          # electron-vite dev server + Electron with HMR
npm run build        # production build into out/
npm run typecheck    # runs BOTH typecheck:node and typecheck:web
```

There is **no test runner and no linter** configured — `npm run typecheck` is the only
automated gate on the code. Two invariants it cannot see have their own scripts:

```bash
npm run routes -- --check   # a stray word in an agent's `description` hijacks every task run
npm run hashes -- --check   # an unlisted default body never reaches a cloned workspace
```

**Always run all three before opening a pull request.** CI runs the same checks and PRs
that fail them will not be merged.

## Project layout

- `electron/` — main process, preload bridge, shared types (`tsconfig.node.json`).
- `src/` — React renderer (`tsconfig.web.json`, path alias `@/*` → `src/*`).
- `docs/` — developer docs; `docs/README.md` is the index.
- `website/` — the marketing site (separate sub-project).

See `CLAUDE.md` and `docs/` for the architecture, the IPC contract, and the data model.

## Pull request guidelines

1. Branch off `main` (`git checkout -b feat/short-description`).
2. Keep changes focused; one logical change per PR.
3. **Update the docs in the same change.** Any change to architecture, the IPC contract,
   the data model, or a subsystem must update the matching `docs/*.md` file — this is part
   of the definition of "done", exactly like `npm run typecheck`.
4. Run `npm run typecheck`, `npm run routes -- --check` and `npm run hashes -- --check`,
   and make sure all three pass.
5. Fill in the PR template and link any related issue.
6. `main` is protected: changes land via reviewed pull requests, not direct pushes.

## Commit messages

Write clear, imperative-mood commit subjects (e.g. "Add API backend retry handling").
Group related work into coherent commits.

## Reporting bugs / requesting features

Use the issue templates. For security vulnerabilities, **do not open a public issue** —
follow [`SECURITY.md`](./SECURITY.md) instead.
