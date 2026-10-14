// Screenshots for a feedback ticket, taken with the local Playwright when the ticket is registered:
// one of the framed page at the reviewer's viewport with the numbered pins and the step marker
// drawn over it, and one cropped to each picked spot's element. Only the review site on this
// machine is ever opened, so nothing outside the framed site is captured. The files go next to the
// ticket, in a folder named after it, and the frontmatter records each as
// { path (relative to the ticket), kind, spot, component, url }.

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const FALLBACK_MODULE = resolve(homedir(), '.npm/_npx/9833c18b2d85bc59/node_modules/playwright');

// PLAYWRIGHT_MODULE first, then the repository, then the global npm root, then the npx copy.
export async function loadPlaywright({ root, env = process.env, globalRoot = null } = {}) {
  const require = createRequire(import.meta.url);
  const candidates = [env.PLAYWRIGHT_MODULE, root ? resolve(root, 'node_modules', 'playwright') : null, globalRoot ? resolve(globalRoot, 'playwright') : null, FALLBACK_MODULE].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return require(c);
  throw new Error('Playwright was not found. Set PLAYWRIGHT_MODULE to its folder.');
}

// The Chromium to launch: PLAYWRIGHT_CHROMIUM, else the newest headless shell Playwright cached.
export function chromiumPath(env = process.env, cache = resolve(homedir(), 'Library/Caches/ms-playwright')) {
  if (env.PLAYWRIGHT_CHROMIUM) return env.PLAYWRIGHT_CHROMIUM;
  if (!existsSync(cache)) return undefined;
  const shells = readdirSync(cache).filter((n) => n.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const dir of shells) {
    const base = resolve(cache, dir);
    for (const sub of readdirSync(base)) {
      const exe = resolve(base, sub, 'chrome-headless-shell');
      if (existsSync(exe)) return exe;
    }
  }
  return undefined;
}

// Pins and the step marker, drawn into the page just before the shot. Squares, as in the panel.
function overlay({ spots, region, label }) {
  const style = document.createElement('style');
  style.textContent = '.fbc-pin{position:absolute;z-index:2147483647;background:#c62828;color:#fff;font:700 12px/18px system-ui,sans-serif;min-width:18px;height:18px;text-align:center;padding:0 3px;box-sizing:border-box}.fbc-box{position:absolute;z-index:2147483646;outline:2px solid #c62828;pointer-events:none}.fbc-step{position:absolute;z-index:2147483646;outline:2px solid #1565c0;pointer-events:none}.fbc-step b{position:absolute;left:0;top:-20px;background:#1565c0;color:#fff;font:600 11px/18px system-ui,sans-serif;padding:0 5px;white-space:nowrap}';
  document.head.appendChild(style);
  const add = (cls, r, text) => {
    const n = document.createElement('div');
    n.className = cls;
    n.style.left = `${r.x}px`; n.style.top = `${r.y}px`;
    if (cls !== 'fbc-pin') { n.style.width = `${r.width}px`; n.style.height = `${r.height}px`; }
    if (text) { const b = cls === 'fbc-step' ? document.createElement('b') : n; b.textContent = text; if (b !== n) n.appendChild(b); }
    document.body.appendChild(n);
  };
  if (region) {
    const el = document.querySelector(region);
    if (el) { const r = el.getBoundingClientRect(); add('fbc-step', { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }, label); }
  }
  for (const s of spots) {
    const r = s.rect || { x: 0, y: 0, width: 0, height: 0 };
    add('fbc-box', r);
    add('fbc-pin', { x: r.x, y: Math.max(0, r.y - 18) }, String(s.n));
  }
}

// Take the images for one ticket. `ticket` carries what the register call knows: the served path,
// route, hash, viewport, spots (with selector, rect, n, component), the step id and its region.
// Returns the image records; throws when the browser cannot be started, and the caller records
// that the capture was unavailable.
export async function captureImages({ origin, ticket, outDir, relDir, playwright, executablePath }) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error('Screenshots are taken only of the review site on this machine.');
  mkdirSync(outDir, { recursive: true });
  const browser = await playwright.chromium.launch({ executablePath });
  const images = [];
  try {
    const page = await browser.newPage({ viewport: { width: ticket.viewport?.width || 1440, height: ticket.viewport?.height || 900 } });
    // The static review build lives under /site/; the web review build is the root of the origin.
    const served = ticket.served || 'site';
    const prefix = served === 'web' ? '' : `/${served}`;
    await page.goto(`${origin}${prefix}${ticket.route || '/'}${ticket.hash || ''}`, { waitUntil: 'networkidle' });
    const spots = ticket.spots ?? [];
    // Spot crops come first, on the clean page, so a pin never covers the element.
    for (const s of spots) {
      const file = `spot-${s.n}.png`;
      let ok = false;
      try {
        await page.locator(s.selector).first().screenshot({ path: resolve(outDir, file), timeout: 4000 });
        ok = true;
      } catch {
        const r = s.rect;
        if (r && r.width > 0 && r.height > 0) { await page.screenshot({ path: resolve(outDir, file), fullPage: true, clip: { x: r.x, y: r.y, width: r.width, height: r.height } }); ok = true; }
      }
      if (ok) images.push({ path: `${relDir}/${file}`, kind: 'spot', spot: s.n, component: s.component ?? null, url: null });
    }
    await page.evaluate(overlay, { spots: spots.map((s) => ({ n: s.n, rect: s.rect })), region: ticket.region?.selector ?? null, label: ticket.region ? `${ticket.step} ${ticket.region.name ?? ''}`.trim() : '' });
    await page.screenshot({ path: resolve(outDir, 'page.png') });
    images.unshift({ path: `${relDir}/page.png`, kind: 'page', spot: null, component: null, url: null });
  } finally {
    await browser.close();
  }
  return images;
}
