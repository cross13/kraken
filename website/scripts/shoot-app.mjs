// Capture real screenshots of the Kraken Electron app for the website.
// Strategy: seed a demo workspace on disk, point the app's stored lastWorkspace
// at it (two-phase launch), then drive the renderer and screenshot each view.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const websiteDir = path.resolve(here, '..');
const rootDir = path.resolve(websiteDir, '..');
const demo = path.join(websiteDir, 'demo', 'workspace');
const outDir = path.join(websiteDir, 'public', 'screens');
const mainJs = path.join(rootDir, 'out', 'main', 'index.js');

const require = createRequire(path.join(rootDir, 'package.json'));
const electronPath = require('electron');

fs.mkdirSync(outDir, { recursive: true });

// ---- 1. Seed spec.json (absolute path) for each demo spec --------------------
// updatedAt set so the richer feature spec sorts first (updated_at DESC).
const specs = [
  { id: 'passwordless-auth', name: 'Passwordless Auth', kind: 'feature', phase: 'design', updatedAt: '2026-06-14T11:00:00.000Z' },
  { id: 'thumbnail-cache-miss', name: 'Thumbnail Cache Miss', kind: 'bugfix', phase: 'requirements', updatedAt: '2026-06-12T15:00:00.000Z' },
];
for (const s of specs) {
  const dir = path.join(demo, '.kraken', 'specs', s.id);
  fs.mkdirSync(dir, { recursive: true });
  const meta = { id: s.id, name: s.name, kind: s.kind, phase: s.phase, path: dir, createdAt: '2026-06-09T09:00:00.000Z', updatedAt: s.updatedAt };
  fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(meta, null, 2));
}

// ---- 2. Make the workspace a git repo so Source Control has something to show -
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: demo, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return '';
  }
};
if (!fs.existsSync(path.join(demo, '.git'))) {
  git('init', '-q');
  git('config', 'user.email', 'demo@kraken.dev');
  git('config', 'user.name', 'Kraken Demo');
  git('remote', 'add', 'origin', 'git@github.com:cross13/kraken.git');
  fs.writeFileSync(path.join(demo, 'README.md'), '# Demo workspace\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'chore: demo workspace');
  git('checkout', '-q', '-b', 'feat/passwordless-auth');
  fs.writeFileSync(path.join(demo, 'src.txt'), 'work in progress\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'feat: scaffold passwordless auth');
}

// ---- 3. Phase A: discover userData, then seed lastWorkspace ------------------
async function setBounds(app) {
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { w.setBounds({ x: 0, y: 0, width: 1480, height: 920 }); w.show(); w.focus(); }
  });
}

const launch = () =>
  electron.launch({ executablePath: electronPath, args: [mainJs], cwd: rootDir });

let app = await launch();
const userData = await app.evaluate(({ app }) => app.getPath('userData'));
await app.close();

const cfgPath = path.join(userData, 'config.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
cfg.lastWorkspace = demo;
cfg.recentWorkspaces = [demo, ...(cfg.recentWorkspaces || []).filter((p) => p !== demo)].slice(0, 8);
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

// ---- 4. Phase B: relaunch, drive the UI, screenshot -------------------------
app = await launch();
const win = await app.firstWindow();
await setBounds(app);
await win.waitForLoadState('domcontentloaded');
await win.waitForTimeout(2500); // restoreLast + fonts

const shot = async (name, label) => {
  await win.waitForTimeout(700);
  await win.screenshot({ path: path.join(outDir, name) });
  console.log(`  ✓ ${name}${label ? ` (${label})` : ''}`);
};

const click = async (selector, timeout = 6000) => {
  try {
    await win.locator(selector).first().click({ timeout });
    await win.waitForTimeout(900);
    return true;
  } catch (e) {
    console.log(`  · could not click ${selector}: ${String(e).split('\n')[0]}`);
    return false;
  }
};

console.log('Capturing app screenshots…');
try {
  // Specs view is default. Open the feature spec's requirements file.
  await click('text=requirements.md');
  await shot('hero.png', 'spec editor');
  await shot('spec-editor.png', 'spec editor');

  // Open Questions module for that spec.
  await click('button:has-text("Open Questions")');
  await shot('questions.png', 'open questions');

  // Tasks view (wave-based task runner) — the orchestration story.
  await click('text=tasks.md');
  await shot('tasks.png', 'task waves');

  // Orchestrator panel.
  await click('button[title="Orchestrator"]');
  await shot('orchestrator.png', 'orchestrator');

  // Source Control panel.
  await click('button[title="Source Control"]');
  await shot('source-control.png', 'source control');

  // Back to specs + a tasks view as a bonus / chat panel visible.
  await click('button[title="Specs"]');
  await shot('chat.png', 'workspace + chat');
} catch (e) {
  console.error('capture error:', e);
} finally {
  await app.close();
}
console.log('Done →', outDir);
