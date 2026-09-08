# Security Policy

## Supported versions

0ct0 is pre-1.0 software under active development. Security fixes are applied to the
latest `main` and the most recent release only.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, use one of the following private channels:

- Open a [private security advisory](https://github.com/cross13/kraken/security/advisories/new)
  on GitHub (preferred), or
- Email **blackbox.software@gmail.com** with the details.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce, or a proof of concept.
- The affected version / commit, and your environment (OS, Node/Electron version).

We will acknowledge your report within a few business days and keep you updated as we work
on a fix. Please give us a reasonable window to release a patch before any public
disclosure.

## Threat model

0ct0 is a **local developer tool that runs code on your behalf.** It has no server, no
account, and uploads nothing: it spawns your installed Claude CLI, or calls
`api.anthropic.com` with your own key. The interesting boundaries are therefore local ones.

**What we defend.**

- **Secrets at rest.** The Anthropic API key, the GitHub token and every MCP tracker
  credential go through one path — Electron `safeStorage` (the OS keychain), persisted by
  `electron-store`. Nothing writes a credential to a log; the CLI invocation recorded in the
  run history has its prompt redacted. *Known gap:* where `safeStorage` reports encryption
  unavailable, the value falls back to base64, which is encoding and not encryption — see
  M-3 in [`docs/security-review.md`](../docs/security-review.md).
- **The renderer.** Context-isolated, `nodeIntegration: false`, everything crossing the
  process boundary goes through the typed preload bridge. A CSP with `script-src 'self'` and
  `connect-src 'self' https://api.anthropic.com` — which is why fonts and mermaid are bundled
  rather than loaded from a CDN. Markdown from any source is escaped and its link schemes
  allowlisted before it is rendered.
- **Outbound navigation.** Every in-app window open is denied and the URL is handed to the
  browser, `http(s)` only.
- **Ticket writes.** Every write to a tracker is built as a `TicketAction` and shown to you
  before it is sent. A remote MCP server cannot cause a silent write.

**What we do not defend, by design.**

- **A workspace you open is trusted code.** `.octo/hooks/*.json` can define a hook that runs
  a shell command on ordinary app events, and `.claude/agents` and `.claude/skills` steer
  runs that hold your tool permissions. There is **no trust prompt for this yet** (H-2 in the
  review). Opening an unfamiliar repository should be treated like running its build scripts.
- **Claude's own actions.** The CLI backend runs under the permission mode you configure;
  0ct0 does not add a second sandbox around it.
- **Local attackers with your user account.** The run-history database
  (`<userData>/octo.db`) holds full prompts and responses unencrypted, and the composed
  prompt is currently visible in the process table while a run is live (M-2).

## Especially relevant to a report

- Anything that turns content the app **did not author** — a ticket description or comment
  from a tracker, model output, a file in an opened workspace — into code execution, a file
  write outside the workspace, or a credential read.
- Anything that causes a credential to leave the machine, or to reach a destination other
  than the one it belongs to.
- Anything that bypasses the confirmation on a ticket write, a git push, or a PR creation.

The current known-issue list, with severities and status, lives in
[`docs/security-review.md`](../docs/security-review.md). A report that matches an entry there
is still welcome — it helps us prioritise — but check it first.

Thank you for helping keep 0ct0 and its users safe.
