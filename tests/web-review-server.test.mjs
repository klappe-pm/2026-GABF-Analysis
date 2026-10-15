// The review server with the web review build at its root: it serves the export, finds a page's journey
// steps from its route, and writes a ticket that carries the route the reviewer was on (served: web).

import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { createReviewServer } from '../scripts/review-server.mjs';
import { findTicket, renderTicket } from '../scripts/lib/review-store.mjs';
import * as edits from '../scripts/design-system/edit.mjs';

async function boot() {
  const root = mkdtempSync(join(tmpdir(), 'gabf-web-review-'));
  for (const f of ['docs/design/design-nodes.json', 'docs/design/feedback-categories.json', 'site/review/source-map.json']) {
    mkdirSync(resolve(root, f, '..'), { recursive: true });
    cpSync(resolve(ROOT, f), resolve(root, f));
  }
  cpSync(resolve(ROOT, 'docs/design/sketches'), resolve(root, 'docs/design/sketches'), { recursive: true });
  mkdirSync(resolve(root, 'docs/design/prototype/screens'), { recursive: true });
  writeFileSync(resolve(root, 'docs/design/prototype/index.html'), '<h1>control plane</h1>');
  writeFileSync(resolve(root, 'docs/design/prototype/screens/S-01.html'), '<h1>S-01</h1>');
  const web = join(root, 'web/out-web-review');
  mkdirSync(join(web, 'beers/2026'), { recursive: true });
  writeFileSync(join(web, 'index.html'), '<h1>home</h1>');
  writeFileSync(join(web, 'beers/2026/index.html'), '<h1>winners</h1>');
  writeFileSync(join(web, '404.html'), '<h1>missing</h1>');
  mkdirSync(join(web, 'data'), { recursive: true });
  writeFileSync(join(web, 'data/results.json'), '[]');
  const store = join(root, 'tickets');
  const captured = [];
  const capture = async (job) => { captured.push(job); return []; };
  const sanitize = (text) => ({ text, redacted: [] });
  mkdirSync(resolve(root, '.design/design-system'), { recursive: true });
  cpSync(resolve(ROOT, '.design/design-system/settings.md'), resolve(root, '.design/design-system/settings.md'));
  const saved = [];
  const design = { edits: { checkDesignEdit: async (b) => ({ problems: [], echoed: b }), applyDesignEdit: async (b) => { saved.push(b); return { ok: true }; } }, capture: null };
  const server = createReviewServer({ root, port: 0, sanitize, capture, design, webDir: 'web/out-web-review', rebuild: () => {}, env: { GABF_FEEDBACK_DIR: store, GABF_CMS_DIR: join(root, 'cms') } });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (path) => { const r = await fetch(base + path); return { status: r.status, text: await r.text() }; };
  const post = async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  return { store, get, post, captured, saved, base, close: () => server.close() };
}

test('the web build is served at the root, with 404.html and a 404 status for an address with no page', async () => {
  const s = await boot();
  try {
    assert.equal((await s.get('/')).text, '<h1>home</h1>');
    assert.equal((await s.get('/beers/2026/')).text, '<h1>winners</h1>');
    const missing = await s.get('/nowhere/');
    assert.equal(missing.status, 404);
    assert.equal(missing.text, '<h1>missing</h1>');
    assert.ok([403, 404].includes((await s.get('/..%2f..%2fetc/passwd')).status), 'an address outside the build is refused');
  } finally { s.close(); }
});

test('a route finds the steps of its page, an address of the same shape finds the detail page, and a stranger finds none', async () => {
  const s = await boot();
  try {
    const overview = JSON.parse((await s.get('/review/web/screens?route=/overview/')).text);
    assert.deepEqual(overview.matched.slice(0, 2), ['S-01', 'S-02']);
    assert.ok(overview.screens.length > 40);
    const brewery = JSON.parse((await s.get('/review/web/screens?route=/breweries/some-other-brewery/')).text);
    assert.ok(brewery.matched.includes('S-27'), 'a brewery page has the brewery detail steps');
    const stranger = JSON.parse((await s.get('/review/web/screens?route=/design-system/')).text);
    assert.deepEqual(stranger.matched, []);
  } finally { s.close(); }
});

test('a web ticket records the route the reviewer was on, many pins, and starts the screenshots', async () => {
  const s = await boot();
  try {
    const r = await s.post('/review/feedback', {
      screen: 'S-27', route: '/breweries/some-other-brewery/', hash: '#medal=Gold', served: 'web',
      text: 'Two things on this page.', categories: ['Layout'],
      spots: [
        { n: 1, selector: '#main > h1', rect: { x: 1, y: 2, width: 3, height: 4 }, text: 'Some Other Brewery' },
        { n: 2, selector: 'table', rect: { x: 5, y: 6, width: 7, height: 8 }, text: 'Medals' },
      ],
      components: [{ name: 'data-table' }], contentKeys: [], viewport: { width: 1440, height: 900 }, device: 'desktop',
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const t = findTicket(s.store, r.body.id);
    assert.equal(t.data.served, 'web');
    assert.equal(t.data.route, '/breweries/some-other-brewery/');
    assert.equal(t.data.hash, '#medal=Gold');
    assert.equal(t.data.step, 'S-27');
    assert.equal(t.data.spots.length, 2);
    assert.match(t.file, /docs|tickets/);
    await new Promise((done) => setTimeout(done, 100));
    assert.equal(s.captured.length, 1, 'the screenshots are taken when the ticket is saved');
    assert.equal(s.captured[0].ticket.served, 'web');
    assert.equal(s.captured[0].ticket.route, '/breweries/some-other-brewery/');
    assert.equal(s.captured[0].ticket.spots.length, 2);
  } finally { s.close(); }
});

test('an address that is not a path is refused, and no ticket is written', async () => {
  const s = await boot();
  try {
    const bad = await s.post('/review/feedback', { screen: 'S-27', route: 'https://elsewhere.example/', served: 'web', text: 'x' });
    assert.equal(bad.status, 400);
  } finally { s.close(); }
});

test('the settings panel saves through the same server, and the settings files are served live', async () => {
  const s = await boot();
  try {
    const checked = await s.post('/__design/check', { target: 'settings', key: 'Primary color', value: '#123456' });
    assert.equal(checked.status, 200);
    const edit = await s.post('/__design/edit', { target: 'settings', key: 'Primary color', value: '#123456', page: 'brewery-detail' });
    assert.equal(edit.status, 200);
    assert.equal(s.saved[0].page, 'brewery-detail');
    assert.equal(s.saved[0].feedbackDir, s.store, 'settings tickets go to the store the feedback tickets use');
    const settings = await s.get('/design-settings/settings.md');
    assert.equal(settings.status, 200);
    assert.equal((await s.get('/design-settings/../../package.json')).status, 404);
    const foreign = await fetch(`${s.base}/__design/edit`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://elsewhere.example' }, body: '{}' });
    assert.equal(foreign.status, 403, 'a page on another origin cannot write');
  } finally { s.close(); }
});

test('a feedback ticket and a settings ticket share one folder without an id collision', async () => {
  const s = await boot();
  try {
    const a = await s.post('/review/feedback', { screen: 'S-27', route: '/breweries/x/', served: 'web', text: 'First.' });
    assert.equal(a.body.id, 'WI-001');
    const plan = edits.ticketFor({ target: 'settings', key: 'Primary color', file: '.design/design-system/settings.md', old: '#111111', next: '#123456', shown: String, feedbackDir: s.store, page: 'brewery-detail' });
    assert.equal(plan.data.id, 'WI-002', 'the settings ticket takes the next id of the shared store');
    mkdirSync(resolve(plan.ticketFile, '..'), { recursive: true });
    writeFileSync(plan.ticketFile, renderTicket(plan.data, plan.body));
    const b = await s.post('/review/feedback', { screen: 'S-27', route: '/breweries/x/', served: 'web', text: 'Second.' });
    assert.equal(b.body.id, 'WI-003');
    assert.equal(findTicket(s.store, 'WI-002').data.page, 'brewery-detail');
    assert.equal(findTicket(s.store, 'WI-001').data.page, findTicket(s.store, 'WI-003').data.page);
  } finally { s.close(); }
});

// The design control plane sits beside the web build on the same origin, and frames its pages: a page opened with
// ?review-state=slow or fail has its data held back or failed, read from the Referer of the data request.
test('the control plane is served at /control-plane/ beside the web build', async () => {
  const s = await boot();
  try {
    assert.equal((await s.get('/control-plane/')).text, '<h1>control plane</h1>');
    assert.equal((await s.get('/control-plane/screens/S-01.html')).text, '<h1>S-01</h1>');
    const bare = await fetch(`${s.base}/control-plane`, { redirect: 'manual' });
    assert.equal(bare.status, 302);
    assert.equal(bare.headers.get('location'), '/control-plane/');
    assert.equal((await s.get('/')).text, '<h1>home</h1>', 'the site keeps the root');
  } finally { s.close(); }
});

test('a page opened with a review state has its data held back or failed', async () => {
  const s = await boot();
  const data = (referer, signal) => fetch(`${s.base}/data/results.json`, { headers: { referer }, signal });
  try {
    assert.equal((await data(`${s.base}/overview/`)).status, 200);
    assert.equal((await data(`${s.base}/overview/?review-state=fail`)).status, 503);
    const held = await Promise.race([
      data(`${s.base}/overview/?review-state=slow`, AbortSignal.timeout(400)).then(() => 'answered', () => 'held'),
      new Promise((done) => setTimeout(() => done('held'), 600)),
    ]);
    assert.equal(held, 'held');
  } finally { s.close(); }
});
