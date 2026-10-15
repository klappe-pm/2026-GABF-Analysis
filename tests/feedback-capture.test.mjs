// Image capture for a registered ticket: the files and the frontmatter, with the browser stubbed, the
// local ticket links, and the move of tickets from the retired local folder, which must leave every
// original line in place.

import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { createReviewServer } from '../scripts/review-server.mjs';
import { captureImages, chromiumPath } from '../scripts/lib/feedback-capture.mjs';
import { findTicket, listTickets, migrateLegacyStore, parseTicket } from '../scripts/lib/review-store.mjs';

const sanitize = (text) => ({ text, redacted: [] });
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

// A browser that records what it was asked and writes a file where it was told to.
function fakePlaywright(log = []) {
  const shot = async ({ path }) => { writeFileSync(path, PNG); log.push(`shot ${path.split('/').pop()}`); };
  const page = {
    goto: async (url) => { log.push(`goto ${url}`); },
    locator: (sel) => ({ first: () => ({ screenshot: async (o) => { if (sel === '.missing') throw new Error('no element'); await shot(o); } }) }),
    screenshot: shot,
    evaluate: async (_fn, arg) => { log.push(`overlay ${arg.spots.length} pins, region ${arg.region}`); },
  };
  return { chromium: { launch: async () => ({ newPage: async (o) => { log.push(`viewport ${o.viewport.width}x${o.viewport.height}`); return page; }, close: async () => { log.push('closed'); } }) } };
}

test('a page image and one image per spot are written, and recorded relative to the ticket', async () => {
  const out = mkdtempSync(join(tmpdir(), 'gabf-capture-'));
  const log = [];
  const images = await captureImages({
    origin: 'http://127.0.0.1:4188',
    ticket: { served: 'web', route: '/', hash: '#year=2026', viewport: { width: 1280, height: 800 }, step: 'S-01', region: { selector: '.dash-grid', name: 'dashboard panels' }, spots: [{ n: 1, selector: 'h1', rect: { x: 1, y: 2, width: 30, height: 20 }, component: 'header' }, { n: 2, selector: '.missing', rect: { x: 5, y: 6, width: 40, height: 30 }, component: null }] },
    outDir: join(out, 'wi-001-x'), relDir: 'wi-001-x', playwright: fakePlaywright(log),
  });
  assert.deepEqual(images.map((i) => [i.path, i.kind, i.spot, i.component, i.url]), [
    ['wi-001-x/page.png', 'page', null, null, null],
    ['wi-001-x/spot-1.png', 'spot', 1, 'header', null],
    ['wi-001-x/spot-2.png', 'spot', 2, null, null],
  ]);
  for (const i of images) assert.ok(existsSync(join(out, i.path)), i.path);
  assert.ok(log.includes('goto http://127.0.0.1:4188/#year=2026'));
  assert.ok(log.includes('viewport 1280x800'));
  assert.ok(log.includes('overlay 2 pins, region .dash-grid'), 'the pins and the step marker are drawn before the page shot');
  assert.equal(log.at(-1), 'closed');
});

test('only the review site on this machine is ever opened', async () => {
  await assert.rejects(captureImages({ origin: 'https://example.com', ticket: { spots: [] }, outDir: tmpdir(), relDir: 'x', playwright: fakePlaywright() }), /only of the review site on this machine/);
});

test('the Chromium path comes from the environment first', () => {
  assert.equal(chromiumPath({ PLAYWRIGHT_CHROMIUM: '/x/chrome' }), '/x/chrome');
});

async function boot(capture) {
  const root = mkdtempSync(join(tmpdir(), 'gabf-capsrv-'));
  for (const f of ['docs/design/design-nodes.json', 'docs/design/feedback-categories.json', 'site/review/source-map.json']) {
    mkdirSync(resolve(root, f, '..'), { recursive: true });
    cpSync(resolve(ROOT, f), resolve(root, f));
  }
  cpSync(resolve(ROOT, 'docs/design/sketches/overview.html'), resolve(root, 'docs/design/sketches/overview.html'));
  const store = join(root, 'docs/feedback');
  const queued = [];
  const server = createReviewServer({ root, port: 0, sanitize, rebuild: () => {}, capture, pipeline: { enqueue: (id) => queued.push(id), kick: () => queued.push('kick') }, env: { GABF_FEEDBACK_DIR: store, GABF_CMS_DIR: join(root, 'cms'), GABF_QUEUE_DIR: join(root, 'queue') } });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body) => (await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  const get = async (path) => fetch(base + path);
  return { root, store, queued, post, get, close: () => server.close() };
}
const settle = () => new Promise((r) => setTimeout(r, 80));

test('registering a ticket captures its images, writes them next to it, records them, then queues the pipeline', async () => {
  const seen = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  const s = await boot(async (job) => {
    seen.push(job);
    await gate;
    mkdirSync(job.outDir, { recursive: true });
    writeFileSync(join(job.outDir, 'page.png'), PNG);
    return [{ path: `${job.relDir}/page.png`, kind: 'page', spot: null, component: null, url: null }];
  });
  try {
    const r = await s.post('/review/feedback', { screen: 'S-01', text: 'Heading is too small.', categories: ['Heading'], spots: [], viewport: { width: 1440, height: 900 } });
    assert.equal(r.status, 'ACCEPTED');
    assert.equal(findTicket(s.store, r.id).data.capture, 'pending', 'the response goes out before the capture finishes');
    assert.deepEqual(s.queued, [], 'the pipeline waits for the images');
    release();
    await settle();
    const t = findTicket(s.store, r.id);
    assert.equal(t.data.capture, 'done');
    assert.equal(t.data.images.length, 1);
    assert.equal(t.data.images[0].kind, 'page');
    assert.equal(t.data.images[0].url, null);
    const folder = t.rel.replace(/\.md$/, '');
    assert.equal(t.data.images[0].path, `${folder.split('/').pop()}/page.png`);
    assert.ok(existsSync(join(dirname(t.file), t.data.images[0].path)), 'the file sits in a folder named after the ticket');
    assert.match(t.body, /## captured-images\n\n- \[Page\]\(.+\/page\.png\)/, 'the local ticket links the image by a relative path');
    assert.equal(seen[0].origin.startsWith('http://127.0.0.1:'), true);
    assert.equal(seen[0].ticket.viewport.width, 1440);
    assert.deepEqual(s.queued, [r.id, 'kick']);
    const img = await s.get(`/review/feedback-image/${r.id}/page.png`);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.equal((await s.get(`/review/feedback-image/${r.id}/../../x.png`)).status, 404);
  } finally { s.close(); }
});

test('when the browser is missing the ticket is still queued, with capture marked unavailable', async () => {
  const s = await boot(async () => { throw new Error('Playwright was not found.'); });
  try {
    const r = await s.post('/review/feedback', { screen: 'S-01', text: 'A note.', categories: [], spots: [] });
    await settle();
    assert.equal(findTicket(s.store, r.id).data.capture, 'unavailable');
    assert.deepEqual(s.queued, [r.id, 'kick']);
  } finally { s.close(); }
});

test('with no capture and no pipeline, registering behaves as it always did', async () => {
  const s = await boot(null);
  try {
    const r = await s.post('/review/feedback', { screen: 'S-01', text: 'A note.', categories: [], spots: [] });
    await settle();
    assert.equal(findTicket(s.store, r.id).data.capture, undefined);
    assert.ok(Array.isArray(findTicket(s.store, r.id).data.images));
  } finally { s.close(); }
});

// ---------- moving the retired local tickets ----------

const original = `---
id: WI-004
status: ACCEPTED
title: Spacing is tight
page: brewery-detail
step: S-27
spots:
  - n: 1
    selector: '#main > h1'
    rect:
      x: 1
      y: 2
      width: 3
      height: 4
    text: X Brewing
components: []
content-keys: []
categories:
  - Layout
created: '2026-10-14T18:22:10.691Z'
revised: '2026-10-14T18:22:10.691Z'
---

Spacing is tight.   Keep the trailing spaces.

## components

- Header, no design system file yet
`;

test('a migrated ticket keeps every original line, gains only images and issue, and keeps its id', () => {
  const legacy = mkdtempSync(join(tmpdir(), 'gabf-legacy-'));
  const store = mkdtempSync(join(tmpdir(), 'gabf-newstore-'));
  mkdirSync(join(legacy, 'brewery-detail', 'wi-004-spacing'), { recursive: true });
  mkdirSync(join(legacy, '.queue'), { recursive: true });
  writeFileSync(join(legacy, 'brewery-detail', 'wi-004-spacing.md'), original);
  writeFileSync(join(legacy, 'brewery-detail', 'wi-004-spacing', 'page.png'), PNG);
  writeFileSync(join(legacy, '.queue', 'queue.json'), '{}');
  const moved = migrateLegacyStore(legacy, store);
  assert.equal(moved.length, 1);
  const text = readFileSync(join(store, 'brewery-detail', 'wi-004-spacing.md'), 'utf8');
  const lines = text.split('\n');
  const originalLines = original.split('\n');
  let at = 0;
  for (const line of originalLines) {
    const found = lines.indexOf(line, at);
    assert.notEqual(found, -1, `original line missing or reordered: ${JSON.stringify(line)}`);
    at = found + 1;
  }
  const added = lines.filter((l) => !originalLines.includes(l));
  assert.deepEqual(added, ['images: []', 'issue: null']);
  assert.equal(parseTicket(text).data.id, 'WI-004');
  assert.equal(parseTicket(text).body, parseTicket(original).body, 'the note body is byte for byte');
  assert.ok(existsSync(join(store, 'brewery-detail', 'wi-004-spacing', 'page.png')), 'the image folder moves with its ticket');
  assert.equal(existsSync(join(legacy, 'brewery-detail', 'wi-004-spacing.md')), false);
  assert.equal(existsSync(join(legacy, '.queue', 'queue.json')), true, 'the pipeline folders are left alone');
  assert.deepEqual(migrateLegacyStore(legacy, store), [], 'a second run moves nothing');
  assert.equal(listTickets(store).length, 1);
});

test('a ticket already at the new path is not overwritten', () => {
  const legacy = mkdtempSync(join(tmpdir(), 'gabf-legacy-'));
  const store = mkdtempSync(join(tmpdir(), 'gabf-newstore-'));
  mkdirSync(join(legacy, 'p'), { recursive: true });
  mkdirSync(join(store, 'p'), { recursive: true });
  writeFileSync(join(legacy, 'p', 'wi-001-a.md'), original);
  writeFileSync(join(store, 'p', 'wi-001-a.md'), 'kept');
  assert.deepEqual(migrateLegacyStore(legacy, store), []);
  assert.equal(readFileSync(join(store, 'p', 'wi-001-a.md'), 'utf8'), 'kept');
});
