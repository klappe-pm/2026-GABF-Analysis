// This repository's side of product-feedback, the design review tooling it opts into: the config and the
// review hooks it hands the tool, and, where the tool is installed, the checks that need it. Continuous
// integration has no product-feedback checkout, so those tests skip there; the config tests always run.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { SKIP, productFeedback } from '../scripts/lib/product-feedback.mjs';
import { parseTicket, renderTicket } from '../scripts/lib/ticket-format.mjs';
import * as edits from '../scripts/design-system/edit.mjs';

const config = JSON.parse(readFileSync(resolve(ROOT, 'product-feedback.config.json'), 'utf8'));

test('the config enables the tool and names files that exist', () => {
  assert.equal(config.enabled, true);
  assert.equal(config.repo, 'klappe-pm/GABF-Analysis');
  for (const rel of [config.paths.design, config.paths.designSystem, config.paths.sourceMap, config.tokens.css, ...config.tokens.prepend, config.controlPlane.drives, config.review.hooks]) {
    assert.ok(existsSync(resolve(ROOT, rel)), `${rel} exists`);
  }
});

test('the review hooks give the web review build, a rebuild, and the design system edits', async () => {
  const { default: hooks, WEB_DIR } = await import('../scripts/review-hooks.mjs');
  const h = await hooks({ root: ROOT, port: 4173, origin: 'http://127.0.0.1:4173', loadPlaywright: async () => null, chromiumPath: () => undefined });
  assert.equal(h.webDir, WEB_DIR);
  assert.equal(typeof h.rebuild, 'function');
  assert.equal(typeof h.design.edits.checkDesignEdit, 'function');
  assert.equal(typeof h.design.edits.applyDesignEdit, 'function');
  assert.equal(typeof h.design.capture, 'function');
});

test('the drives file is one object literal of drive functions', () => {
  const text = readFileSync(resolve(ROOT, config.controlPlane.drives), 'utf8').replace(/^(\s*\/\/[^\n]*\n)+/, '');
  // eslint-disable-next-line no-new-func
  const drives = new Function('waitFor', 'visible', 'say', `return (${text});`)(() => Promise.resolve(null), () => false, () => {});
  for (const name of ['filters-open', 'estimate-open']) assert.equal(typeof drives[name], 'function', name);
});

test('the design control plane on disk is what product-feedback generates, and every ticket is well formed', { skip: SKIP }, async () => {
  const { issues } = await productFeedback('control-plane/generate.mjs');
  assert.deepEqual(await issues(ROOT), []);
});

test('a feedback ticket and a settings ticket share one folder without an id collision', { skip: SKIP }, async () => {
  const { createReviewServer } = await productFeedback('review/server.mjs');
  const store = mkdtempSync(join(tmpdir(), 'gabf-shared-ids-'));
  const server = createReviewServer({ root: ROOT, port: 0, sanitize: (text) => ({ text, redacted: [] }), rebuild: () => {}, webDir: 'web/out-web-review', env: { PRODUCT_FEEDBACK_FEEDBACK_DIR: store } });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (body) => (await fetch(`${base}/review/feedback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  try {
    assert.equal((await post({ screen: 'S-27', route: '/breweries/x/', served: 'web', text: 'First.' })).id, 'WI-001');
    const plan = edits.ticketFor({ target: 'settings', key: 'Primary color', file: '.design/design-system/settings.md', old: '#111111', next: '#123456', shown: String, feedbackDir: store, page: 'brewery-detail' });
    assert.equal(plan.data.id, 'WI-002', 'the settings ticket takes the next id of the shared store');
    mkdirSync(resolve(plan.ticketFile, '..'), { recursive: true });
    writeFileSync(plan.ticketFile, renderTicket(plan.data, plan.body));
    assert.equal((await post({ screen: 'S-27', route: '/breweries/x/', served: 'web', text: 'Second.' })).id, 'WI-003');
    assert.equal(parseTicket(readFileSync(plan.ticketFile, 'utf8')).data.page, 'brewery-detail');
    const { ticketIssues } = await productFeedback('review/review-store.mjs');
    assert.deepEqual(ticketIssues(store), [], 'the settings ticket written here passes the tool\'s own ticket check');
  } finally {
    server.close();
    rmSync(store, { recursive: true, force: true });
  }
});
