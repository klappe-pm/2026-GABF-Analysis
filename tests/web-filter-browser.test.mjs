// The web global filter in a real browser, against the built export in web/out: the selection reaches the URL of the
// next page, a hash change is read from the hash alone, a moved address keeps the hash, the Filters dialog names the
// option for rows with no value in words, a bare F key opens nothing (Alt+Shift+F does), and a press before Material
// defines the dialog opens it once defined instead of throwing. Fails when web/out is
// older than its sources or not built (scripts/lib/web-out-fresh.mjs; in continuous integration a missing export
// skips), and skips when no Chrome or Playwright Chromium is available.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { chromiumPath, loadPlaywright } from '../scripts/lib/playwright.mjs';
import { webOutGate } from '../scripts/lib/web-out-fresh.mjs';

const OUT = resolve(ROOT, 'web/out');
let playwright = null;
try { playwright = await loadPlaywright({ root: ROOT }); } catch { playwright = null; }

async function launch() {
  const executablePath = chromiumPath();
  try { return await playwright.chromium.launch(executablePath ? { executablePath } : { channel: 'chrome' }); } catch { return null; }
}
// A stale or missing export fails every test below with its reason, before any browser is started.
let stale = null;
let gateSkip = false;
try { gateSkip = webOutGate(); } catch (e) { stale = e; }
const browser = playwright && !stale && !gateSkip ? await launch() : null;
const SKIP = stale ? false : gateSkip || (browser ? false : 'no Chrome or Playwright Chromium is available here');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.png': 'image/png' };
function serve() {
  const server = createServer((req, res) => {
    let path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    let file = join(OUT, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

test.after(async () => { await browser?.close(); });

// The waits below have no timeout of their own; the test's timeout bounds them. When it fires, its signal closes
// the page, so a pending wait rejects and the server closes instead of keeping the run open.
async function withPage(signal, fn) {
  if (stale) throw stale;
  const { server, base } = await serve();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  signal.addEventListener('abort', () => { context.close().catch(() => {}); }, { once: true });
  try {
    const page = await context.newPage();
    // WEB_TEST_CPU_THROTTLE=6 slows the page's CPU, as on a cold ci runner, to check for timing races.
    const rate = Number(process.env.WEB_TEST_CPU_THROTTLE || 0);
    if (rate > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
    await fn(page, base);
  } finally { await context.close(); server.close(); }
}

// The page has applied the filter: the global filter marks <html data-global-filter="ready"> once its load
// time effect has written the selection to storage and to the address (web/lib/global-filter.tsx). Network
// idle comes earlier than that on a slow machine (issue 156: a following navigation then carried nothing), so
// every step that depends on the filter waits on this mark, bounded by the test's own timeout.
const applied = (page) => page.waitForFunction(() => document.documentElement.dataset.globalFilter === 'ready', null, { timeout: 0 });

test('a filter set on one page is in the URL of the next page, which carries no hash of its own', { skip: SKIP, timeout: 60000 }, async (t) => {
  await withPage(t.signal, async (page, base) => {
    await page.goto(`${base}/breweries/#year=2024`);
    await applied(page);
    await page.goto(`${base}/categories/`);
    await applied(page);
    assert.match(new URL(page.url()).hash, /year=2024/);
  });
});

test('a hash change is read from the hash alone, not merged with the stored selection', { skip: SKIP, timeout: 60000 }, async (t) => {
  await withPage(t.signal, async (page, base) => {
    await page.goto(`${base}/categories/#year=2024`);
    await applied(page);
    await page.evaluate(() => { location.hash = '#medal=Gold'; });
    await page.waitForFunction(() => localStorage.getItem('gabf-filters') === JSON.stringify({ medal: 'Gold' }), null, { timeout: 0 });
    assert.equal(new URL(page.url()).hash, '#medal=Gold');
  });
});

test('a moved address forwards to its new address with the hash', { skip: SKIP, timeout: 60000 }, async (t) => {
  await withPage(t.signal, async (page, base) => {
    await page.goto(`${base}/reports/top-breweries/#year=2022`);
    await page.waitForURL(/\/analysis\/top-breweries\/#year=2022$/, { timeout: 0 });
  });
});

test('a bare F opens nothing, Alt+Shift+F opens Filters, and no option reads as a raw marker', { skip: SKIP, timeout: 60000 }, async (t) => {
  await withPage(t.signal, async (page, base) => {
    await page.goto(`${base}/breweries/`);
    await applied(page);
    // The dialog is a Material element registered after the app starts (web/design/runtime.tsx). The filter is ready
    // before it on a slow machine, and until it is defined the shortcut has no dialog to show.
    await page.evaluate(() => customElements.whenDefined('md-dialog'));
    const open = () => page.evaluate(() => [...document.querySelectorAll('[data-component="filters-dialog"]')].some((d) => d.open || d.hasAttribute('open')));
    await page.keyboard.press('f');
    assert.equal(await open(), false, 'a bare F opens nothing (WCAG 2.1.4)');
    await page.keyboard.press('Alt+Shift+KeyF');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-component="filters-dialog"]')].some((d) => d.open || d.hasAttribute('open')), null, { timeout: 0 });
    // The rows load on first open; wait for the brewery type options.
    await page.waitForFunction(() => [...document.querySelectorAll('[data-component="filters-dialog"] md-select-option, [data-component="filters-dialog"] option')].length > 20, null, { timeout: 0 });
    const texts = await page.evaluate(() => [...document.querySelectorAll('[data-component="filters-dialog"] md-select-option, [data-component="filters-dialog"] option')].map((o) => (o.textContent || '').trim()));
    assert.deepEqual(texts.filter((t) => t.startsWith('not-defined')), [], 'the option for rows with no value reads in words');
    assert.ok(texts.some((t) => /^Not Found \(\d+\)$/.test(t)), 'it reads Not Found with its count');
  });
});

test('Alt+Shift+F or the Filters button before Material defines the dialog opens it once defined, without an error', { skip: SKIP, timeout: 60000 }, async () => {
  await withPage(async (page, base) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Hold the md-dialog registration until the test releases it, as on a slow device where the press comes first.
    await page.addInitScript(() => {
      const define = customElements.define.bind(customElements);
      let held = null;
      window.releaseDialog = () => { if (held) define(...held); held = null; };
      customElements.define = (name, ...rest) => {
        if (name !== 'md-dialog') return define(name, ...rest);
        held = [name, ...rest];
        window.dialogHeld = true;
      };
    });
    await page.goto(`${base}/breweries/`);
    await applied(page);
    await page.waitForFunction(() => window.dialogHeld === true, null, { timeout: 0 });
    const state = () => page.evaluate(() => [...document.querySelectorAll('md-dialog[data-component="filters-dialog"]')].map((d) => ({ upgraded: typeof d.show === 'function', open: d.open === true || d.hasAttribute('open') })));
    assert.deepEqual(await state(), [{ upgraded: false, open: false }], 'the dialog is in the page but not yet defined');
    await page.keyboard.press('Alt+Shift+KeyF');
    await page.locator('[aria-haspopup="dialog"]').first().click();
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done))));
    assert.deepEqual(errors, [], 'an early press or click throws nothing');
    await page.evaluate(() => window.releaseDialog());
    await page.waitForFunction(() => [...document.querySelectorAll('md-dialog[data-component="filters-dialog"]')].some((d) => d.open), null, { timeout: 0 });
    assert.deepEqual(errors, [], 'opening once defined throws nothing');
  });
});
