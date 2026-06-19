# Kraken website

The marketing/product site for Kraken — a standalone Vite + React app, fully
isolated from the desktop app (its own `package.json`, `tsconfig`, Tailwind).

**Stack:** Vite · React 18 · React Router · **React Flow** (`@xyflow/react`) ·
Framer Motion · Tailwind · lucide-react. Aesthetic: *abyssal / bioluminescent* —
deep-sea dark with the `#7c5cff` accent + cyan glow and the Kraken motif.

## Develop

```bash
cd website
npm install
npm run dev        # http://localhost:5990
npm run build      # tsc --noEmit + vite build → dist/
```

## Deploy

The public site is this `website/` directory only — the Electron renderer in the repo's
`src/` is desktop-only (it depends on the `window.kraken` IPC bridge) and is **not** web-hostable.

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
| `/` | Hero, SDD-loop React Flow, two backends, feature grid, orchestration, CTA |
| `/features` | Full capability breakdown + real app screenshots |
| `/workflow` | The SDD methodology + the interactive React Flow diagram |
| `/docs` | Getting started + links to the repo's `docs/*` |
| `/download` | Install / run steps + prerequisites |

React Flow lives in `src/components/flow/` (`SddFlow` mini-loop on Home,
`WorkflowFlow` interactive diagram on Workflow, shared themed `nodes`).

## Screenshots

Product shots in `public/screens/` are **real captures of the Electron app**,
produced by Playwright:

```bash
# from repo root: build the app first
npm run build
# then, from website/:
node scripts/shoot-app.mjs    # seeds a demo workspace, launches the app, captures public/screens/*.png
node scripts/shoot-site.mjs   # screenshots the website pages → preview/ (needs `npm run dev` running)
```

`scripts/shoot-app.mjs` seeds `demo/workspace/` (a sample feature + bugfix spec),
points the app's stored `lastWorkspace` at it, then drives the renderer and
captures each view. The demo markdown specs are committed; generated artifacts
(`.git/`, `spec.json`, scratch files) are gitignored.

> The site renders scroll-reveals statically when the URL carries `?shot` (see
> `STILL` in `src/components/site.ts`), so full-page screenshots capture every section.
