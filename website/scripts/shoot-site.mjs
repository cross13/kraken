// Screenshot the built website pages (to preview the result).
// Uses the system Chrome via Playwright. Scrolls each page first so
// scroll-triggered (whileInView) reveals have fired before the full-page shot.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'preview');
fs.mkdirSync(outDir, { recursive: true });

const base = process.env.SITE_URL || 'http://localhost:5990';
const routes = [
  { path: '/', name: 'home' },
  { path: '/features', name: 'features' },
  { path: '/workflow', name: 'workflow' },
  { path: '/docs', name: 'docs' },
  { path: '/download', name: 'download' },
];

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

async function autoScroll() {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = 500;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        y += step;
        if (y >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve(null);
        }
      }, 120);
    });
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

console.log('Capturing site screenshots…');
for (const r of routes) {
  const sep = r.path.includes('?') ? '&' : '?';
  await page.goto(`${base}${r.path}${sep}shot=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200); // fonts + hero animation
  // Above-the-fold viewport shot
  await page.screenshot({ path: path.join(outDir, `${r.name}-top.png`) });
  // Full page (reveals render statically with ?shot)
  await autoScroll();
  await page.screenshot({ path: path.join(outDir, `${r.name}-full.png`), fullPage: true });
  console.log(`  ✓ ${r.name}`);
}

await browser.close();
console.log('Done →', outDir);
