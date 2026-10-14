// A static server for web/out on a free port, for the scripts that drive a browser against the build.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { WEB } from './lib.mjs';

export const OUT = resolve(WEB, 'out');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.txt': 'text/plain' };

export function serveOut() {
  const server = createServer((req, res) => {
    let file = join(OUT, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file.startsWith(OUT) || !existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// Playwright from PLAYWRIGHT_MODULE (a path to its package) or from node_modules. Chromium is Playwright's
// own build, or the installed Chrome when PLAYWRIGHT_CHANNEL=chrome, or PLAYWRIGHT_CHROMIUM (a path).
export async function launch() {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
  if (process.env.PLAYWRIGHT_CHROMIUM) return chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  if (process.env.PLAYWRIGHT_CHANNEL) return chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: 'chrome' });
  }
}

// Open the style guide and wait until the settings files have loaded and been applied.
export async function openStyleGuide(context, origin) {
  const page = await context.newPage();
  await page.goto(`${origin}/design-system/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('html[data-settings-applied="true"]', { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}
