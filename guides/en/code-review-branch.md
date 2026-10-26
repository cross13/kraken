---
id: code-review-branch
title: Review your spec's branch
summary: Have the code reviewer read the branch diff before the PR exists, check it against the spec's criteria, and fix findings one at a time.
track: howto
order: 1
area: ship
minutes: 4
goto: spec:build
---

A read-only review of everything committed on the spec's branch, checked against its requirements and plan, before anyone else sees the pull request.

1. Finish the tasks. The **Ship** tab inside Build only appears once the spec is `done`, which happens on its own when the last task completes.
2. Commit first. The review reads the branch's committed diff against its base — the same range the PR will show — so uncommitted edits are not in it. With nothing committed you get "Nothing committed on this branch yet".
3. In the **Code review** panel, press **Review changes**. The run goes to the `code-reviewer` agent and shows up in Activity like any other. Press **Reviewing… stop** to cancel it.
4. Read the summary and the findings, sorted **Blocker**, **Major**, **Minor**, **Nit**. Each one names the file and line.
5. Use **Open file** to read the code, or **Fix with Claude** to send that one finding to the Assistant. The prompt tells Claude to read the code first and say so if the finding is wrong.
6. Commit again and the panel marks the review **stale — new commits since**. Press **Re-review** for a fresh one.

The result is saved to `.octo/specs/<id>/review.md`, so it survives a restart and travels with the spec.

## Tip

The review is advisory. It never blocks **Create pull request**; the PR composer only tells you **Not reviewed yet** or how many blockers the last review found. The reviewer runs with read-only tools (Read, Glob, Grep), so fixing anything is always a separate, explicit step.
