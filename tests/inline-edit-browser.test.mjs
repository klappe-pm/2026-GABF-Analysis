// Editing page copy in place. The first test checks that resolving a page of texts is one quick lookup.
// The second serves the web review build with the review server and double clicks page copy through the
// control plane, the way a reviewer does, in a real browser. Every test works on temporary copies of the copy
// folder and the ticket store; the real ones are never written. A machine without Playwright or a Chromium
// skips the browser test.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createSocket } from 'node:net';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
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

// The control plane frames the web review build (web/out-web-review, npm run web:review builds it): a screen marks its
// step, its Feedback opens the widget in the frame on that step, and page copy found by its text edits in place.
const WEB_REVIEW_OUT = resolve(ROOT, 'web/out-web-review');
test('in a control plane screen, Feedback opens the framed widget on its step, and a double click on page copy edits it and adds no pin', { skip: SKIP || (!existsSync(join(WEB_REVIEW_OUT, 'index.html')) && 'the web review build is not built here'), timeout: 120000 }, async () => {
  const work = mkdtempSync(join(tmpdir(), 'gabf-inline-e2e-'));
  const cms = join(work, 'cms');
  const store = join(work, 'tickets');
  cpSync(resolve(ROOT, '.docs/content-management-system'), cms, { recursive: true });
  mkdirSync(store, { recursive: true });
  const sanitize = (text) => ({ text, redacted: [] });
  // The review server checks the Origin of a write against its port, so it needs a real one.
  const port = await new Promise((done) => { const probe = createSocket(); probe.listen(0, '127.0.0.1', () => { const n = probe.address().port; probe.close(() => done(n)); }); });
  const review = createReviewServer({ root: ROOT, port, sanitize, rebuild: () => {}, webDir: 'web/out-web-review', env: { ...process.env, GABF_CMS_DIR: cms, GABF_FEEDBACK_DIR: store } });
  await new Promise((done) => review.listen(port, '127.0.0.1', done));
  try {
    // A wide window: the shell's frame must stay wider than the phone breakpoint, where the widget takes no feedback.
    const browser = await playwright.chromium.launch({ executablePath });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(`http://127.0.0.1:${port}/control-plane/#S-27`);
      const live = await (async () => { for (let i = 0; i < 100; i++) { const f = page.frames().find((x) => x.parentFrame() && x.parentFrame().url().includes('/control-plane/screens/')); if (f && await f.$('.gfw-root')) return f; await page.waitForTimeout(200); } return null; })();
      assert.ok(live, 'the screen framed its page with the review widget');
      await live.waitForSelector('.gfw-step', { timeout: 15000 });
      assert.match(await live.locator('.gfw-step').textContent(), /^S-27 /, 'the step region is marked');
      await page.click('#feedback');
      await live.waitForSelector('#gfw-panel', { timeout: 10000 });
      assert.equal(await live.locator('#gfw-step').inputValue(), 'S-27', 'the ticket is for the step this screen is');
      await live.waitForSelector('main [data-gfw-key]', { timeout: 20000 });
      const copy = live.locator('main nav[data-component="breadcrumb"] [data-gfw-key]').first();
      await copy.dblclick();
      await live.waitForSelector('.gfw-editor-input', { timeout: 5000 });
      await page.waitForTimeout(700);
      assert.equal(await live.locator('.gfw-pin').count(), 0, 'the double click added no pin');
      assert.ok((await live.locator('.gfw-editor-input').inputValue()).length > 0, 'the editor holds the current words');
    } finally { await browser.close(); }
  } finally {
    review.close();
    rmSync(work, { recursive: true, force: true });
  }
});
