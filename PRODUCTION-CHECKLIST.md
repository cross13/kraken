# Kraken — Production Readiness Checklist

Status of this file: **audit performed against `main` at commit `14ae7ec`** (Kraken `0.1.0`).
Every item below was verified against the actual source, not assumed. Boxes are unchecked unless
the work is genuinely done today.

Legend: **P0** = blocks a public release · **P1** = blocks a *confident* release ·
**P2** = should land soon after.

---

## 1. Correctness & automated gates — **P0**

The single biggest gap. `npm run typecheck` is currently the *only* automated gate; there is no
test runner and no linter configured (`package.json` has neither).

- [ ] **P0 — Add a test runner** (Vitest fits the existing Vite toolchain). Start with the pure
      logic that already has no UI coupling and the highest blast radius:
  - `src/lib/agentRouter.ts` — `routeAgent` / `scoreAgents` / `explainRoute` precedence.
  - `src/lib/tasks.ts` — task parsing, `@agent` extraction, wave grouping, `isTaskRunnable`.
  - `src/lib/specSections.ts`, `src/lib/openQuestions.ts`, `src/lib/markdown.ts`.
  - `electron/main.ts` spec lifecycle: `advanceSpec` phase order, template lazy-write.
  - `electron/main.ts` steering: `composeSteeringSystem` inclusion-mode resolution.
- [ ] **P0 — Add a linter** (ESLint + `@typescript-eslint`, plus `eslint-plugin-react-hooks`).
      Several `useEffect` bodies call async IPC without cleanup; a hooks lint would surface them.
- [ ] **P0 — Wire both into CI.** `.github/` currently has only `CONTRIBUTING.md` and
      `SECURITY.md` — **there is no workflow file at all**. Add
      `.github/workflows/ci.yml` running `typecheck` → `lint` → `test` → `build` on push and PR.
- [ ] **P1 — Integration test for the IPC contract.** The main↔preload↔renderer boundary is the
      load-bearing invariant; a test that asserts every `ipcMain.handle` channel has a matching
      `window.kraken` method (and vice versa) would catch the most common breakage in this repo.
- [ ] **P2 — Smoke test the packaged app** (Playwright + Electron) for: launch, open folder,
      create spec, stream a mocked response.

## 2. Distribution & packaging — **P0**

- [ ] **P0 — Code signing.** `package.json` → `build.mac` sets only `category`. There is no
      `hardenedRuntime`, no `entitlements`, no `notarize` config. Unsigned macOS builds are
      blocked by Gatekeeper on any machine but the one that built them. Same story for Windows
      (no Authenticode config).
- [ ] **P0 — Real installers.** All three package scripts pass `--dir`, which produces an
      unpacked directory, not a distributable. Add `dmg` (macOS), `nsis` (Windows), and
      `AppImage`/`deb` (Linux) targets.
- [ ] **P1 — Auto-update.** No `electron-updater` integration exists. A desktop tool that shells
      out to a fast-moving CLI needs an update path.
- [ ] **P1 — Verify native modules in the packaged app on a clean machine.** `better-sqlite3` and
      `node-pty` are rebuilt by the `postinstall` hook; `node-pty` is `asarUnpack`-ed. Confirm
      both load in a signed, packaged build on hardware that never ran `npm install`.
- [ ] **P2 — Pin the Electron major and schedule updates.** Currently `electron ^33.2.0`; track
      the security-supported window.

## 3. Security & privacy — **P1** (posture is decent, gaps are specific)

Verified as **already correct** — do not regress these:

- `contextIsolation: true`, `nodeIntegration: false` on both windows (`electron/main.ts`).
- A restrictive CSP in `index.html` (`default-src 'self'`, `script-src 'self'`).
- `setWindowOpenHandler` returns `{ action: 'deny' }` on both windows.
- `openUrlInChrome` validates `URL` parsing and rejects anything that isn't `http:`/`https:`.
- Secrets (Anthropic key, GitHub token) encrypted via `safeStorage` and never written in plaintext.
- `allowBash` defaults to **false**.

Open items:

- [ ] **P1 — No `will-navigate` handler.** `setWindowOpenHandler` covers *new* windows but nothing
      prevents the renderer itself from navigating away from the app (e.g. a crafted link in
      rendered markdown or streamed model output). Add a `will-navigate` guard on both
      `webContents` that cancels any navigation outside the app origin.
- [ ] **P1 — Fonts are fetched from Google at runtime.** `index.html` links
      `fonts.googleapis.com` / `fonts.gstatic.com`, and the CSP allows them. That means every
      launch makes a third-party network request, and the app renders with fallback fonts when
      offline. Self-host the six families in `resources/` and tighten CSP to `'self'` for both
      `style-src` and `font-src`.
- [ ] **P2 — `sandbox: false` on both windows.** The preload only imports from `electron`
      (`contextBridge`, `ipcRenderer`, `webFrame`), so `sandbox: true` looks reachable. Try it;
      if a dependency blocks it, record *why* in `docs/architecture.md`.
- [ ] **P1 — Document the `permissionMode: 'acceptEdits'` default.** Claude can write files in the
      workspace without a prompt out of the box. That is a deliberate product decision for an SDD
      tool, but it must be stated plainly in first-run UI, not just in Settings.
- [ ] **P2 — Dependency audit in CI** (`npm audit --production`) plus a Dependabot/Renovate config.
- [ ] **P2 — Third-party license notices** bundled in the app (About panel or `NOTICE` file).

## 4. Dependencies — **P1**

- [ ] **P1 — `@anthropic-ai/sdk` is pinned at `^0.32.1`, which is far behind.** It predates the
      `client.models` resource entirely — model discovery had to call `GET /v1/models` over raw
      `fetch` to work around it (`fetchApiModels` in `electron/main.ts`). Upgrading unlocks the
      current API surface, but `streamViaApi` uses `messages.stream()` and must be re-verified
      against the new version. Treat as a scoped migration, not a bump.
- [ ] **P1 — Audit model ids against the current lineup.** The default in `StoreSchema` is
      `claude-opus-4-7`; the bundled `MODEL_CATALOG` now carries Opus 5 / Sonnet 5 / Fable 5 /
      Opus 4.8 / Haiku 4.5. Decide the shipping default deliberately and keep
      `docs/backends.md` in sync.
- [ ] **P2 — Bundle size.** The renderer builds to a single ~1.9 MB JS chunk. Route-split the
      Prism language packs and `@xyflow/react` (used only by the Graph tab).

## 5. Reliability & observability — **P1**

- [ ] **P1 — No crash reporting and no global error traps.** `electron/main.ts` registers neither
      `crashReporter` nor `process.on('uncaughtException' | 'unhandledRejection')`. An
      unhandled rejection in a stream handler currently dies silently.
- [ ] **P1 — No renderer error boundary.** A render error in any surface blanks the whole window.
      Add an error boundary per surface that keeps the shell alive and offers a reload.
- [ ] **P1 — Orphaned child processes.** `activeStreams` tracks CLI children and
      `terminals.killAll()` runs on window close — verify the *quit* and *crash* paths too, and
      that a hard kill of Electron doesn't leave `claude` processes behind.
- [ ] **P2 — DB growth policy.** `kraken.db` accumulates every run's full prompt and response with
      no retention limit. Add a size/age cap and a "clear history" action.
- [ ] **P2 — Structured logging** with a user-accessible log file and a "Reveal logs" action.

## 6. Data & migrations — **P1**

- [ ] **P1 — Adopt `PRAGMA user_version` for schema migrations.** `electron/db.ts` uses
      `CREATE TABLE IF NOT EXISTS` plus an ad-hoc `migrateRuns()` that swallows
      `ALTER TABLE ... ADD COLUMN` failures. That pattern works but is unauditable — you can't
      tell which schema version a given database is on. Version the schema explicitly before the
      first public release, while the install base is still zero.
- [ ] **P1 — Spec-format forward compatibility.** `.kraken/specs/<id>/spec.json` has no version
      field. Add one now so a future format change can migrate rather than guess.
- [ ] **P2 — Handle a corrupt/locked `kraken.db`** by rebuilding rather than failing to launch.

## 7. UX & accessibility — **P1**

Layout/space work landed in this change (fluid `.k-wide` / `.k-read` / `.k-full` containers,
auto-fitting `.k-cards` grids, `.k-listpane` master panes, Activity rebuilt as a real surface,
Settings as a multi-column grid). Remaining:

- [ ] **P1 — Keyboard accessibility.** Several interactive rows are `<div onClick>` (e.g. the
      terminal tab strip in `ActivitySurface.tsx`) with no `role`, `tabIndex`, or key handler.
- [ ] **P1 — Focus management for the overlay and drawers.** The slide-over closes on Escape but
      does not trap focus or restore it to the trigger.
- [ ] **P1 — Verify all three themes** (Abyss, Bioluminescent, **Daylight**) after the layout
      change. Daylight is the least-exercised palette and several new surfaces use
      `bg-elev/30`-style alphas that read differently on a light background.
- [ ] **P2 — Contrast audit.** A lot of UI text sits at `text-[10px]`/`text-faint`; check against
      WCAG AA on all three palettes.
- [ ] **P2 — Reduced-motion support.** The brand animations (`octo-*` keyframes) ignore
      `prefers-reduced-motion`.
- [ ] **P2 — Window state persistence** (size/position/maximized) across launches.

## 8. First-run & failure states — **P1**

- [ ] **P1 — CLI-missing path.** Confirm the whole app degrades gracefully — not just the Settings
      badge — when `claude` isn't installed: Home composer, task runs, and hooks should all say
      something useful rather than failing mid-stream.
- [ ] **P1 — Offline / API-down.** Verify the streaming error path surfaces to the user in every
      entry point (chat, spec drafting, task waves, hooks).
- [ ] **P1 — Empty/invalid workspace.** Opening a folder without write permission, or one already
      containing a malformed `.kraken/specs/<id>/spec.json`, must not crash the surface.
- [ ] **P2 — Cancellation.** Confirm `claude:cancel` reliably kills the child on all three
      platforms, including mid-wave with several runs in flight.

## 9. Documentation — **P2** (largely in place)

- [x] `README.md` — rewritten for the four-surface shell, with explicit requirements, model
      discovery, the layout system, and links into `docs/`.
- [x] `docs/` developer reference exists and is indexed.
- [x] `CLAUDE.md` orientation map.
- [ ] **P2 — CHANGELOG.md** with a release history.
- [ ] **P2 — Screenshots/GIFs in the README** reflecting the current shell (the ones on the
      website are the old UI in places).
- [ ] **P2 — Troubleshooting guide**: CLI not found, native module ABI mismatch, port 5847 in use,
      keychain unavailable.

## 10. Release mechanics — **P1**

- [ ] **P1 — Versioning policy.** Still `0.1.0`; adopt semver and tag releases.
- [ ] **P1 — Release workflow** that builds, signs, notarizes, and publishes all three platforms
      from CI.
- [ ] **P2 — Telemetry decision.** Ship with none, or ship opt-in with a clear disclosure. Do not
      leave it ambiguous.
- [ ] **P2 — Support channels** in `SECURITY.md` / `CONTRIBUTING.md` — confirm the vulnerability
      contact is real and monitored.

---

## Suggested order

1. **CI + typecheck/lint/test** (§1) — everything else is safer once this exists.
2. **Signing + installers** (§2) — without it there is no distributable artifact.
3. **`will-navigate` guard + self-hosted fonts** (§3) — small, bounded, real.
4. **Crash traps + error boundaries** (§5) — makes field reports actionable.
5. **DB + spec-format versioning** (§6) — cheapest to do while the install base is zero.
6. **SDK upgrade** (§4) — scoped migration, needs its own verification pass.
