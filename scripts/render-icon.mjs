// Rasterizes resources/icon.svg → resources/icon.png (1024×1024, transparent)
// using Electron's own renderer, so no external SVG tooling is needed.
// Run with: npm run icon   (electron-builder converts the PNG to .icns/.ico)
import { app, BrowserWindow } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'resources', 'icon.svg'), 'utf8');

const html = `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden}
  svg{display:block;width:1024px;height:1024px}
</style></head><body>${svg}</body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1024,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true },
  });
  win.webContents.setBackgroundThrottling(false);

  await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
  // Give the offscreen compositor a beat to paint before capturing.
  await new Promise((r) => setTimeout(r, 600));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  const out = join(root, 'resources', 'icon.png');
  writeFileSync(out, image.toPNG());
  console.log(`wrote ${out} (${image.getSize().width}×${image.getSize().height})`);
  app.quit();
});
