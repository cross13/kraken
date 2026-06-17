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
