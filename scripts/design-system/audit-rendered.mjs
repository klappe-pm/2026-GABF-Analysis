#!/usr/bin/env node
// Audit the built style guide (web/out) in a real browser, in the light theme at phone and desktop width.
// Fails on any element with a rounded corner (medal circles excepted), a shadow, a gradient, blur, or a
// banned font, on figures set in Archivo Narrow, and when the figures "1111" and "0000" differ in width
// in the face that sets numbers. Run npm run web:build first. Needs Playwright with a Chromium build:
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright PLAYWRIGHT_CHROMIUM=/path/to/chrome node scripts/design-system/audit-rendered.mjs

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { WEB } from './lib.mjs';

const OUT = resolve(WEB, 'out');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function serve() {
  const server = createServer((req, res) => {
    let file = join(OUT, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file.startsWith(OUT) || !existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// Runs in the page.
function inPage() {
  const bad = [];
  const note = (el, why) => bad.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').slice(0, 40)}: ${why}`);
  for (const el of document.querySelectorAll('body, body *')) {
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && cs.content === 'none') continue;
      const radii = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].map((k) => cs[k]);
      if (radii.some((r) => r !== '0px') && el.tagName.toLowerCase() !== 'circle') note(el, `radius ${radii.join(' ')}`);
      if (cs.boxShadow !== 'none') note(el, `box-shadow ${cs.boxShadow}`);
      if (cs.textShadow !== 'none') note(el, `text-shadow ${cs.textShadow}`);
      if (/drop-shadow|blur/.test(cs.filter) || (cs.backdropFilter && cs.backdropFilter !== 'none')) note(el, 'filter or backdrop blur');
      if (/gradient/.test(cs.backgroundImage)) note(el, 'gradient');
      if (!pseudo && /(^|,\s*)"?(system-ui|Inter|-apple-system|BlinkMacSystemFont|Roboto|Helvetica Neue|Segoe UI)"?(,|$)/i.test(cs.fontFamily)) note(el, `font ${cs.fontFamily}`);
    }
  }
  document.querySelectorAll('details').forEach((d) => { d.open = true; });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    const el = n.parentElement;
    if (!el || !/\d/.test(n.textContent) || ['SCRIPT', 'STYLE'].includes(el.tagName)) continue;
    if (/Archivo Narrow/.test(getComputedStyle(el).fontFamily.split(',')[0])) note(el, `figures in Archivo Narrow: "${n.textContent.trim().slice(0, 24)}"`);
  }
  const width = (text, family) => {
    const s = document.createElement('span');
    s.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:20px;font-family:${family};font-variant-numeric:tabular-nums`;
    s.textContent = text;
    document.body.appendChild(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
  };
  const sans = getComputedStyle(document.body).fontFamily;
  const [a, b] = [width('1111', sans), width('0000', sans)];
  if (Math.abs(a - b) > 0.01) bad.push(`figures are not tabular in the body face: "1111" ${a.toFixed(2)}px, "0000" ${b.toFixed(2)}px`);
  bad.push(...(document.documentElement.scrollWidth > document.documentElement.clientWidth ? ['horizontal overflow'] : []));
  return bad;
}

async function main() {
  if (!existsSync(resolve(OUT, 'design-system/index.html'))) { console.log('web/out is missing: run npm run web:build'); process.exit(1); }
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/design-system/`;
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
  let total = 0;
  for (const scheme of ['light']) {
    for (const width of [390, 1280]) {
      const page = await (await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme })).newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const bad = [...new Set(await page.evaluate(inPage))];
      for (const b of bad) console.log(`${width} ${scheme}: ${b}`);
      total += bad.length;
    }
  }
  await browser.close();
  server.close();
  console.log(`rendered audit: ${total} problem${total === 1 ? '' : 's'}`);
  process.exit(total ? 1 : 0);
}

main();
