# 0ct0 website

The public site for **0ct0** — a standalone Vite + React app, fully isolated from the
desktop app (its own `package.json`, `tsconfig`, Tailwind).

**Stack:** Vite · React 18 · React Router · **React Flow** (`@xyflow/react`) ·
Framer Motion · Tailwind · lucide-react.

**Aesthetic: Signal** — the desktop app's own palette, mirrored from
`src/styles.css` (`:root[data-theme='signal']`) into `tailwind.config.cjs`. Brand
green `#76B900` on brand grey `#1E1E1E`, violet `#9B6BFF` for anything that waits
on a human, **radius 0**, **no shadows**, hierarchy from a lighter grey plus a 1px
line. Space Grotesk (display) / Hanken Grotesk (body) / JetBrains Mono.

> Two accents, one role each: green = execute & progress, violet = agent, wait &
> decide. Never both on the same control. That rule is the reason the site reads
> as the app rather than as marketing for it.

The mark is `src/components/Octo.tsx` — the octopus samurai, mirrored path-for-path
from the app's `src/components/wide/OctoMascot.tsx`, so the site and the app show
the same creature. `detail="mark"` is the 14–26px silhouette; `detail="full"` is
what you need from ~64px up, because at `mark` the kabuto's brim cuts the eyes into
slits and the kuwagata read as antennae.

## Develop

```bash
cd website
npm install
npm run dev        # http://localhost:5990
npm run build      # tsc --noEmit + vite build → dist/
```

## Deploy

The public site is this `website/` directory only — the Electron renderer in the
repo's `src/` is desktop-only (it depends on the `window.octo` IPC bridge) and is
**not** web-hostable.

We ship a **Docker + nginx** image and a **DigitalOcean App Platform** spec:

| File | What |
| --- | --- |
| `website/Dockerfile` | Multi-stage build: `node:22-alpine` runs `npm ci && npm run build`, then `nginx:alpine` serves `dist/`. |
| `website/nginx.conf` | Listens on **80**, SPA fallback (`try_files ... /index.html`) for `BrowserRouter` deep links, gzip, immutable cache for hashed `/assets/`. |
| `website/.dockerignore` | Keeps the build context lean (deps installed fresh in the image). |
| `.do/app.yaml` (repo root) | App Platform spec — `source_dir: website` (build context), `dockerfile_path: website/Dockerfile` (repo-root relative), `http_port: 80`, deploy-on-push from `main`. |

```bash
# Build + run the production image locally (parity with DigitalOcean):
cd website
npm run docker:build
npm run docker:run        # -> http://localhost:80  (may need sudo to bind :80)

# Or via DigitalOcean (from repo root, with doctl authenticated):
doctl apps create --spec .do/app.yaml
```

Sanity check after deploy: reload directly on `/docs` — it must render, not 404 (proves the
SPA fallback). The Docker build sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` so the `playwright`
devDependency doesn't pull browsers into the image.

## Pages

| Route | What |
| --- | --- |
| `/` | Hero + the spec's on-disk shape, the SDD loop as React Flow, the two backends, six differentiators, orchestration, CTA |
| `/features` | Every capability, grouped the way the app is: the loop · the engine · your setup · at scale |
| `/workflow` | The methodology, the interactive React Flow diagram, and what ends each stage |
| `/docs` | First run + an index of the repo's `docs/*` |
| `/download` | Requirements and the three install steps |

React Flow lives in `src/components/flow/` (`SddFlow` linear loop on Home,
`WorkflowFlow` interactive diagram on Workflow, shared themed `nodes`).

## Product imagery

There are **no product screenshots on the site right now, on purpose.** The ones
that used to live in `public/screens/` were captured in June 2026, before the
rename and before the four-surface shell landed — they showed an app that no
longer exists, which is worse than showing none. They were deleted rather than
shipped stale.

`scripts/shoot-app.mjs` still exists and still seeds `demo/workspace/` (a sample
feature + bugfix spec), points the app's stored `lastWorkspace` at it, then drives
the renderer and captures each view:

```bash
# from repo root: build the app first
npm run build
# then, from website/:
node scripts/shoot-app.mjs    # → public/screens/*.png
node scripts/shoot-site.mjs   # screenshots the website pages → preview/ (needs `npm run dev` running)
```

> **Before trusting it:** its view selectors were written against the pre-redesign
> UI and have not been re-verified against the current four-surface shell. Expect
> to fix the selectors. Once the captures are real again, wire them back into the
> pages — until then the site uses honest diagrams built from the same tokens as
> the app, never mock screenshots dressed up as real ones.

> The site renders scroll-reveals statically when the URL carries `?shot` (see
> `STILL` in `src/components/site.ts`), so full-page screenshots capture every section.
