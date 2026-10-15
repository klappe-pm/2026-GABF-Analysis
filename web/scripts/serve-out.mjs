#!/usr/bin/env node
// Serve the static export for a local look: node web/scripts/serve-out.mjs [port] [--live] [--review]
//   --live    requests for /design-settings/ read the source files in .design/design-system/ instead of
//             the copies in the export, so an edit to a settings file shows on the next reload.
//   --review  review mode: serves the review build (web/out-review, built by npm run design-system:review),
//             reads the settings live, and accepts edits from the style guide's in place editors at
//             POST /__design/check and POST /__design/edit, and from the review settings panel on any
//             page. Bound to 127.0.0.1 only. A save writes its ticket and picture to docs/feedback/<page>/
//             (design-system for the style guide; GABF_DESIGN_FEEDBACK_DIR moves the store).
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const SOURCE = resolve(ROOT, '.design/design-system');
const args = process.argv.slice(2);
const review = args.includes('--review');
const live = review || args.includes('--live');
const OUT = resolve(import.meta.dirname, review ? '../out-review' : '../out');
const PORT = Number(args.find((a) => /^\d+$/.test(a)) ?? process.env.PORT ?? (review ? 4175 : 4174));
const HOST = '127.0.0.1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png' };

let edits = null;
let sanitize = null;
if (review) {
  edits = await import('../../scripts/design-system/edit.mjs');
  // The repository's token shaped value scan (scripts/lib/redact.mjs), the same rule product-feedback applies.
  const { redact } = await import('../../scripts/lib/redact.mjs');
  sanitize = (text) => { const r = redact(text); return { text: r.text, redacted: [...new Set(r.kinds)] }; };
}

// The picture a ticket carries, drawn in a browser from the saved files. On the style guide: the edited
// component's states, or the settings row for a site wide setting. On any other page (an edit from the
// review settings panel): the first instance of the edited component on that page, or the window for a
// site wide setting. Playwright comes from PLAYWRIGHT_MODULE or node_modules; without it the ticket says
// no image was captured.
let browser = null;
async function capture({ target, key, path, route }) {
  const { createRequire } = await import('node:module');
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
  browser ??= await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}).catch(() => chromium.launch({ channel: 'chrome' }));
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const guide = !route || route === '/design-system/';
  try {
    await page.goto(`http://${HOST}:${PORT}${guide ? '/design-system/' : route}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('html[data-settings-applied="true"]', { timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    if (!guide && target === 'settings') {
      await page.waitForTimeout(500);
      await page.screenshot({ path, animations: 'disabled' });
      return true;
    }
    const el = guide
      ? (target === 'settings' ? page.locator(`tr:has([data-setting=${JSON.stringify(`settings:${key}`)}])`) : page.locator(`#component-${target}-sample`))
      : page.locator(`[data-component=${JSON.stringify(target)}]:not([data-review-panel] *)`);
    if (!(await el.count())) return false;
    await el.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await el.first().screenshot({ path, animations: 'disabled' });
    return true;
  } finally {
    await page.close();
  }
}

const readBody = (req) => new Promise((ok, fail) => {
  let data = '';
  req.on('data', (c) => { data += c; if (data.length > 1e5) req.destroy(); });
  req.on('end', () => { try { ok(JSON.parse(data || '{}')); } catch (e) { fail(e); } });
  req.on('error', fail);
});

const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };

createServer(async (req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  if (review && req.method === 'POST' && (url === '/__design/check' || url === '/__design/edit')) {
    // Only this machine's own pages may write.
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) return json(res, 403, { problems: ['Edits are accepted from this machine only.'] });
    try {
      const body = await readBody(req);
      if (url === '/__design/check') return json(res, 200, await edits.checkDesignEdit(body));
      const feedbackDir = process.env.GABF_DESIGN_FEEDBACK_DIR || resolve(ROOT, edits.FEEDBACK_DIR);
      return json(res, 200, await edits.applyDesignEdit({ ...body, feedbackDir, sanitize, capture }));
    } catch (e) {
      return json(res, 422, { problems: e.problems ?? [e.message] });
    }
  }
  const path = normalize(decodeURIComponent(url)).replace(/^(\.\.[/\\])+/, '');
  const fromSource = live && path.startsWith('/design-settings/');
  const root = fromSource ? SOURCE : OUT;
  let file = join(root, fromSource ? path.slice('/design-settings'.length) : path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file) || (fromSource && extname(file) !== '.md')) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
}).listen(PORT, HOST, () => console.log(`serving ${review ? 'the review build' : 'web/out'} on http://${HOST}:${PORT}/${live ? ' (settings read live from .design/design-system)' : ''}${review ? '; edits are saved to the settings files' : ''}`));
