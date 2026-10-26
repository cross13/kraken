---
id: review-pr
title: Review a pull request
summary: Check out any open PR into a private worktree, let the code reviewer read it, and post findings back as a comment review you saw first.
track: howto
order: 2
area: ship
minutes: 5
goto: activity:reviews
---

Any open pull request in the workspace's repo, reviewed by Claude with the code on disk, without touching your own branch.

1. Make sure `gh` is installed and signed in: run `gh auth login` in a terminal. Octo stores no GitHub token; if `gh` is missing or signed out, the tab says so and offers **Check again**.
2. Open **Activity › Reviews**. The left pane lists **Open pull requests** with author and `head → base`. **Refresh** reloads it.
3. Pick one. It is checked out into a private worktree under the app's data folder, so the workspace's branch is never switched. If the checkout fails, the header says **GitHub patches (local checkout failed)** and the files come from GitHub instead.
4. Read **Files changed** like you would on GitHub. If someone pushes after you opened it, a warning offers **Check out again**.
5. Press **Review**. The reviewer runs inside that worktree with read-only tools — it never edits, runs commands or posts. Each PR keeps its own state, so you can switch PRs or tabs while one runs.
6. In the **Review** tab, **Show in diff** jumps to a finding's line in **Files changed**. **Fix with Claude** only appears when your current branch is the PR's head branch.
7. To post, press **Post to GitHub…**. You see the exact body and every inline comment under "This will be posted as a comment review". **Post review** sends it; **Cancel** sends nothing.

## Why it matters

Posting is a write to someone else's PR, so it is always a `COMMENT` review. Approving or requesting changes stays a decision for a person, made on GitHub.
