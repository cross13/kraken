# Security Policy

## Supported versions

Kraken is pre-1.0 software under active development. Security fixes are applied to the
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

## Scope notes

Kraken runs locally and drives Claude through the user's local CLI or the Anthropic API.
A few areas are especially relevant to security reports:

- **Secrets handling** — the Anthropic API key and GitHub token are encrypted with
  Electron `safeStorage` (OS keychain) and never written to disk in plaintext.
- **IPC boundary** — all data crosses between processes only through the typed,
  context-isolated preload bridge.
- **Subprocess execution** — the CLI backend spawns the `claude` binary in the user's
  workspace directory.

Thank you for helping keep Kraken and its users safe.
