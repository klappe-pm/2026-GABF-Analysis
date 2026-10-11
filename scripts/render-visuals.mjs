#!/usr/bin/env node
// Render PNG visuals from the built site with Playwright and Chromium.
//
//   node scripts/render-visuals.mjs --brewery green-cheek-beer-co [--dark] [--out reports]
//
// Screenshots every chart figure on the brewery page plus the whole page. Playwright is
// resolved from the local node_modules first, then from the global npm root; install it
// with: npm install --no-save playwright@1.56.1 && npx playwright install chromium

import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { DIST, REPORTS, ROOT, parseArgs } from './lib/paths.mjs';

async function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [resolve(ROOT, 'node_modules', 'playwright')];
  try { candidates.push(resolve(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); } catch { /* no global npm root */ }
  for (const c of candidates) {
    if (existsSync(c)) return require(c);
  }
  throw new Error('Playwright not found. Install with: npm install --no-save playwright@1.56.1 && npx playwright install chromium');
}

function startServer(port) {
  const child = spawn(process.execPath, [resolve(ROOT, 'scripts/serve-dist.mjs'), '--port', String(port)], { stdio: 'ignore' });
  return child;
}

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`server did not start at ${url}`);
}

export async function renderVisuals({ brewery, dark = false, out = REPORTS, port = 8765, width = 1100 }) {
  if (!existsSync(resolve(DIST, 'index.html'))) throw new Error('dist/ not built. Run npm run build first.');
  const pw = await loadPlaywright();
  const server = startServer(port);
  const base = `http://localhost:${port}/`;
  const written = [];
  try {
    await waitFor(base);
    const browser = await pw.chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
    const page = await context.newPage();
    mkdirSync(out, { recursive: true });
    const suffix = dark ? '-dark' : '';
    const targets = brewery ? [{ url: `${base}breweries/${brewery}/`, prefix: brewery }] : [{ url: base, prefix: 'explorer' }];
    for (const t of targets) {
      await page.goto(t.url, { waitUntil: 'networkidle' });
      if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.waitForTimeout(1200);
      const figures = await page.$$('figure[data-figure]');
      for (const fig of figures) {
        const id = await fig.getAttribute('data-figure');
        const path = resolve(out, `${t.prefix}-${id}${suffix}.png`);
        await fig.screenshot({ path });
        written.push(path);
      }
      const statsEl = await page.$('.stats');
      if (statsEl) {
        const path = resolve(out, `${t.prefix}-stats${suffix}.png`);
        await statsEl.screenshot({ path });
        written.push(path);
      }
      const full = resolve(out, `${t.prefix}-page${suffix}.png`);
      await page.screenshot({ path: full, fullPage: true });
      written.push(full);
    }
    await browser.close();
  } finally {
    server.kill();
  }
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  renderVisuals({ brewery: args.brewery, dark: Boolean(args.dark), out: args.out ? resolve(args.out) : REPORTS })
    .then((files) => { for (const f of files) console.log(f); })
    .catch((err) => { console.error(err.message); process.exit(1); });
}
