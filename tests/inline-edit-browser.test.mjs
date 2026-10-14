// Editing page copy in place, driven in a real browser. The first group loads the real page picker
// into a small framed harness with a stubbed server, to check the scan and marking path and that a
// failure is said in plain words. The second builds the review site, serves it with the review
// server and double clicks the page heading through the control plane, the way a reviewer does.
// Every test works on temporary copies of the copy folder and the ticket store; the real ones are
// never written. A machine without Playwright or a Chromium skips these tests.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createSocket } from 'node:net';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { chromiumPath, loadPlaywright } from '../scripts/lib/feedback-capture.mjs';
import { createReviewServer } from '../scripts/review-server.mjs';
import { loadCopy, loadInventory, matchContent } from '../scripts/lib/review-content.mjs';

let playwright = null;
try { playwright = await loadPlaywright({ root: ROOT }); } catch { playwright = null; }
const executablePath = chromiumPath();
const SKIP = !playwright || !executablePath ? 'Playwright or its Chromium is not available here' : false;

const WIDGET = readFileSync(resolve(ROOT, 'site/review/feedback-widget.mjs'), 'utf8');

// A top page that stands for the screen frame (it carries data-screen and records what the picker
// posts) holding a framed page that loads the real picker.
function harness({ resolveBody }) {
  const server = createServer((req, res) => {
    const path = req.url.split('?')[0];
    const send = (type, body, code = 200) => { res.writeHead(code, { 'content-type': type }); res.end(body); };
    if (path === '/top.html') return send('text/html', '<!doctype html><body data-screen="S-01"><iframe id="f" src="/inner.html" style="width:900px;height:600px"></iframe><script>window.msgs=[];addEventListener("message",function(e){if(e.data&&e.data.source==="gabf-review")window.msgs.push(e.data)})</script></body>');
    if (path === '/inner.html') return send('text/html', '<!doctype html><body><main><h1>Page heading</h1><p>Plain words for the reader.</p><p>Data driven 1,234 figure</p></main><script type="module" src="/widget.mjs"></script></body>');
    if (path === '/widget.mjs') return send('text/javascript', WIDGET);
    if (path === '/source-map.json') return send('application/json', '[]');
    if (path === '/review/regions') return send('application/json', '{"screens":{},"controls":{}}');
    if (path === '/review/inline/resolve') {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => { const out = resolveBody(JSON.parse(raw || '{}')); send('application/json', JSON.stringify(out.body), out.status ?? 200); });
      return undefined;
    }
    return send('text/plain', 'none', 404);
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

async function withPage(fn) {
  const browser = await playwright.chromium.launch({ executablePath });
  try { const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); await fn(page); } finally { await browser.close(); }
}

const KEYED = { 'Page heading': { key: 'pages.x.title', value: 'Page heading', file: 'pages/x.md', others: 0 }, 'Plain words for the reader.': { key: 'pages.x.lede', value: 'Plain words for the reader.', file: 'pages/x.md', others: 0 } };

test('the scan marks the texts the server calls page copy and no others', { skip: SKIP, timeout: 60000 }, async () => {
  const asked = [];
  const { server, base } = await harness({ resolveBody: (b) => { asked.push(...b.texts); return { body: Object.fromEntries(b.texts.map((t) => [t, KEYED[t] ?? null])) }; } });
  try {
    await withPage(async (page) => {
      await page.goto(`${base}/top.html`);
      const frame = page.frame({ url: /inner\.html/ });
      await frame.waitForSelector('.gfw-layer', { state: 'attached' });
      await page.evaluate(() => document.getElementById('f').contentWindow.postMessage({ source: 'gabf-control-plane', kind: 'state', picking: true, pins: [] }, location.origin));
      await frame.waitForSelector('h1.gfw-editable', { timeout: 10000 });
      assert.equal(await frame.locator('p.gfw-editable').count(), 1, 'the lede is copy');
      assert.equal(await frame.locator('p:not(.gfw-editable)').count(), 1, 'the data driven figure is not');
      assert.ok(asked.includes('Data driven 1,234 figure') && asked.includes('Page heading'), 'every text leaf was put to the server');
      assert.equal(await frame.locator('h1').getAttribute('tabindex'), '0', 'copy can be reached from the keyboard');
      await page.evaluate(() => document.getElementById('f').contentWindow.postMessage({ source: 'gabf-control-plane', kind: 'state', picking: false, pins: [] }, location.origin));
      await frame.waitForFunction(() => document.querySelectorAll('.gfw-editable').length === 0);
    });
  } finally { server.close(); }
});

test('a double click on marked copy opens the editor and adds no pin, however long the second click takes', { skip: SKIP, timeout: 60000 }, async () => {
  const { server, base } = await harness({ resolveBody: (b) => ({ body: Object.fromEntries(b.texts.map((t) => [t, KEYED[t] ?? null])) }) });
  try {
    await withPage(async (page) => {
      await page.goto(`${base}/top.html`);
      const frame = page.frame({ url: /inner\.html/ });
      await frame.waitForSelector('.gfw-layer', { state: 'attached' });
      await page.evaluate(() => document.getElementById('f').contentWindow.postMessage({ source: 'gabf-control-plane', kind: 'state', picking: true, pins: [] }, location.origin));
      await frame.waitForSelector('h1.gfw-editable', { timeout: 10000 });
      await frame.locator('h1').dblclick({ delay: 120 });
      await frame.waitForSelector('.gfw-editor-input', { timeout: 5000 });
      await page.waitForTimeout(500);
      const spots = await page.evaluate(() => window.msgs.filter((m) => m.kind === 'spot').length);
      assert.equal(spots, 0, 'no spot was posted for the double click');
      // A single click on copy still pins, after the wait that rules out a double click.
      await frame.locator('p.gfw-editable').click({ force: true });
      await page.waitForFunction(() => window.msgs.some((m) => m.kind === 'spot'), null, { timeout: 3000 });
    });
  } finally { server.close(); }
});

test('a double click before the scan has answered still adds no pin', { skip: SKIP, timeout: 60000 }, async () => {
  const { server, base } = await harness({ resolveBody: (b) => ({ body: Object.fromEntries(b.texts.map((t) => [t, KEYED[t] ?? null])) }) });
  try {
    await withPage(async (page) => {
      await page.goto(`${base}/top.html`);
      const frame = page.frame({ url: /inner\.html/ });
      await frame.waitForSelector('.gfw-layer', { state: 'attached' });
      await page.evaluate(() => document.getElementById('f').contentWindow.postMessage({ source: 'gabf-control-plane', kind: 'state', picking: true, pins: [] }, location.origin));
      await frame.locator('h1').dblclick();
      await page.waitForTimeout(600);
      assert.equal(await page.evaluate(() => window.msgs.filter((m) => m.kind === 'spot').length), 0);
    });
  } finally { server.close(); }
});

test('when the server cannot answer, the panel is told in plain words and the page stays unmarked', { skip: SKIP, timeout: 60000 }, async () => {
  const { server, base } = await harness({ resolveBody: () => ({ status: 500, body: { error: 'The copy folder could not be read.' } }) });
  try {
    await withPage(async (page) => {
      await page.goto(`${base}/top.html`);
      const frame = page.frame({ url: /inner\.html/ });
      await frame.waitForSelector('.gfw-layer', { state: 'attached' });
      await page.evaluate(() => document.getElementById('f').contentWindow.postMessage({ source: 'gabf-control-plane', kind: 'state', picking: true, pins: [] }, location.origin));
      await page.waitForFunction(() => window.msgs.some((m) => m.kind === 'inline-problem' && m.message), null, { timeout: 10000 });
      const message = await page.evaluate(() => window.msgs.find((m) => m.kind === 'inline-problem').message);
      assert.match(message, /not available/);
      assert.match(message, /The copy folder could not be read\./);
      assert.equal(await frame.locator('.gfw-editable').count(), 0);
    });
  } finally { server.close(); }
});

test('resolving a whole page of texts is one quick call, and a lookup finds what a pattern test would', () => {
  const cms = mkdtempSync(join(tmpdir(), 'gabf-cms-'));
  try {
    cpSync(resolve(ROOT, '.docs/content-management-system'), cms, { recursive: true });
    const copy = loadCopy(cms);
    const inventory = loadInventory(cms);
    const texts = copy.map((e) => e.value).filter((v) => v && !/\{\{/.test(v)).slice(0, 400);
    const started = performance.now();
    const hits = texts.map((t) => matchContent(t, copy, inventory));
    assert.ok(performance.now() - started < 2000, 'four hundred texts take well under two seconds');
    texts.forEach((t, i) => assert.ok(hits[i].some((h) => h.match === 'exact'), `"${t}" finds an entry with exactly its words`));
    assert.equal(matchContent('Nothing in the copy says this at all, anywhere', copy, inventory).length, 0);
  } finally { rmSync(cms, { recursive: true, force: true }); }
});

test('on the review build, a double click on the page heading in the control plane opens the editor and adds no pin', { skip: SKIP, timeout: 300000 }, async () => {
  const work = mkdtempSync(join(tmpdir(), 'gabf-inline-e2e-'));
  const cms = join(work, 'cms');
  const dist = join(work, 'dist-review');
  const store = join(work, 'tickets');
  cpSync(resolve(ROOT, '.docs/content-management-system'), cms, { recursive: true });
  mkdirSync(store, { recursive: true });
  const env = { ...process.env, GABF_CMS_DIR: cms, GABF_FEEDBACK: '1', GABF_DIST: dist };
  delete env.CI;
  delete env.GITHUB_ACTIONS;
  const built = spawnSync(process.execPath, [resolve(ROOT, 'scripts/build-site.mjs')], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  const sanitize = (text) => ({ text, redacted: [] });
  // The review server checks the Origin of a write against its port, so it needs a real one.
  const port = await new Promise((done) => { const probe = createSocket(); probe.listen(0, '127.0.0.1', () => { const n = probe.address().port; probe.close(() => done(n)); }); });
  const review = createReviewServer({ root: ROOT, port, sanitize, rebuild: () => {}, env: { ...process.env, GABF_CMS_DIR: cms, GABF_FEEDBACK_DIR: store, GABF_REVIEW_DIST: dist } });
  await new Promise((done) => review.listen(port, '127.0.0.1', done));
  try {
    await withPage(async (page) => {
      await page.goto(`http://127.0.0.1:${port}/#S-01`);
      await page.waitForSelector('#feedback');
      await page.click('#feedback');
      const site = await (async () => { for (let i = 0; i < 50; i++) { const f = page.frames().find((x) => x.url().includes('/site/')); if (f) return f; await page.waitForTimeout(100); } return null; })();
      assert.ok(site, 'the framed site loaded');
      await site.waitForSelector('h1.gfw-editable', { timeout: 20000 });
      await site.locator('h1').first().dblclick();
      await site.waitForSelector('.gfw-editor-input', { timeout: 5000 });
      await page.waitForTimeout(700);
      assert.equal(await page.locator('li[id^="fbp-spot-"]').count(), 0, 'the double click added no pin');
      assert.equal(await site.locator('.gfw-editor-input').inputValue().then((v) => v.length > 0), true, 'the editor holds the current words');
    });
  } finally {
    review.close();
    rmSync(work, { recursive: true, force: true });
  }
});
