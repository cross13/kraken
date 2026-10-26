---
id: github-setup
title: Connect GitHub and open a PR
summary: GitHub goes through your local gh CLI, no token stored; from the Ship panel it is branch, Commit all, Create pull request.
track: howto
order: 3
area: ship
minutes: 4
goto: spec:build
---

Everything GitHub-side — pull requests, reviews, the repo lookup — runs as `gh api …` through your local GitHub CLI. Octo stores no GitHub token, and acts as whichever account `gh` is signed in to.

1. Install `gh` from cli.github.com and run `gh auth login` in a terminal.
2. Open **Library › Settings** and find the **GitHub** section. It should say **Connected through gh** with your login. If it doesn't, fix `gh` and press **Check again**.
3. The repo needs a github.com `origin` remote. Without one you can still commit locally, but there is no PR to open.
4. Finish a spec and open **Ship** inside Build. If you are on `main` or `master`, press **Create branch feat/…** first.
5. Press **Commit all** — it reads **Commit all & push** when there is an origin. It stages everything, with the message prefilled from the summary.
6. In the **Pull request** panel, **Write overview** has Claude draft the opening paragraphs from the branch's commits and diff. Edit the body if you like, then press **Create pull request**: it pushes the branch and opens the PR. **View pull request** opens it afterwards.

The branch, last commit and PR link are written back into the spec, so the board and the tracker sync know where it stands.

## Tip

For anything outside a spec — switching branches, partial commits, other PRs — open the repo panel: click the branch name in the command bar, use **Open repo panel →** in Ship, or pick **Repository** from ⌘K.
