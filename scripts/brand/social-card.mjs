#!/usr/bin/env node
// Render the repository's social card, docs/assets/social-preview.png (1280 by 640), from
// scripts/brand/social-card.html. The template takes every color from site/assets/brand.css, so run
// npm run brand first when the settings change. Needs Playwright with Chromium (or a local Chrome);
// the fonts are the self hosted ones in site/assets/fonts. Not part of verify: rendering differs by machine.
//
//   node scripts/brand/social-card.mjs [--playwright path/to/playwright]

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, parseArgs } from '../lib/paths.mjs';

const args = parseArgs(process.argv.slice(2));
const require = createRequire(import.meta.url);

function loadPlaywright() {
  for (const id of [args.playwright, 'playwright', process.env.PLAYWRIGHT_PATH].filter(Boolean)) {
    try { return require(id); } catch { /* try the next one */ }
  }
  throw new Error('Playwright is not installed; pass --playwright with the path to its package');
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve(ROOT, 'scripts/brand/social-card.html')).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const out = resolve(ROOT, 'docs/assets/social-preview.png');
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1280, height: 640 } });
  console.log(`wrote ${out.replace(`${ROOT}/`, '')}`);
} finally {
  await browser.close();
}
