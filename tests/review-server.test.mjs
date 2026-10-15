// The review server end to end, on a temporary source tree, ticket store, and copy folder, with the
// secret scan and the site rebuild stubbed. A ticket registered with a copy edit must record the
// key, the file, the old and new values, and every instance it changed, and be ACCEPTED.

import test from 'node:test';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { createReviewServer } from '../scripts/review-server.mjs';
import { findTicket, listTickets } from '../scripts/lib/review-store.mjs';

const sanitize = (text) => (text.includes('SECRETVALUE') ? { text: text.replace(/SECRETVALUE/g, '[REDACTED:test_shape]'), redacted: ['test_shape'] } : { text, redacted: [] });

async function boot() {
  const root = mkdtempSync(join(tmpdir(), 'gabf-server-'));
  for (const f of ['docs/design/design-nodes.json', 'docs/design/feedback-categories.json', 'site/review/source-map.json']) {
    mkdirSync(resolve(root, f, '..'), { recursive: true });
    cpSync(resolve(ROOT, f), resolve(root, f));
  }
  cpSync(resolve(ROOT, 'docs/design/sketches/overview.html'), resolve(root, 'docs/design/sketches/overview.html'), { recursive: true });
  const cms = join(root, 'cms');
  mkdirSync(join(cms, 'global'), { recursive: true });
  writeFileSync(join(cms, 'global/filters.md'), '# Filters\n\n## `panel`\n\n- `title`: Filter medals\n- `reset`: Reset\n');
  mkdirSync(join(root, 'site/assets'), { recursive: true });
  writeFileSync(join(root, 'site/assets/filter-bar.mjs'), "dialog.innerHTML = `<h2 id=\"gf-title\">Filter medals</h2>`;\n");
  const store = join(root, 'tickets');
  let rebuilt = 0;
  const server = createReviewServer({ root, port: 0, sanitize, rebuild: () => { rebuilt += 1; }, env: { GABF_FEEDBACK_DIR: store, GABF_CMS_DIR: cms } });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() };
  };
  return { root, cms, store, port: server.address().port, call, close: () => server.close(), rebuilds: () => rebuilt };
}

const spot = (extra = {}) => ({ n: 1, selector: 'dialog.filter-panel h2', rect: { x: 5, y: 6, width: 100, height: 20 }, text: 'Filter medals', matches: [{ via: 'dialog.filter-panel', instance: 'dialog.filter-panel' }], ...extra });

test('categories come back alphabetized and regions come from the manifest', async () => {
  const s = await boot();
  try {
    const cats = (await s.call('GET', '/review/categories')).body.categories;
    assert.deepEqual(cats, [...cats].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
    const regions = (await s.call('GET', '/review/regions')).body;
    assert.equal(regions.screens['S-01'].selector, 'dl:has(> [data-component="stat-card"])');
    assert.equal(regions.screens['S-07'], null, 'a whole page screen has no region');
    assert.match(regions.controls['open Filters'].selector, /filters-dialog/, 'the Filters button is found beside its dialog');
  } finally { s.close(); }
});

test('derive links a picked spot to its component and its copy entry, and a whole page to its screen', async () => {
  const s = await boot();
  try {
    const d = (await s.call('POST', '/review/derive', { screen: 'S-46', spots: [spot()] })).body;
    assert.deepEqual(d.components.map((c) => c.name), ['filters-sheet']);
    assert.equal(d.components[0].instance, 'dialog.filter-panel');
    assert.deepEqual(d.content.map((c) => c.key), ['global.filters.panel.title']);
    assert.equal(d.screen.page, 'filters-panel');
    const whole = (await s.call('POST', '/review/derive', { screen: 'S-46', spots: [] })).body;
    assert.ok(whole.components.some((c) => c.name === 'filters-sheet'));
    assert.equal((await s.call('POST', '/review/derive', { screen: 'S-99', spots: [] })).status, 400);
  } finally { s.close(); }
});

test('a ticket records the job, step, state, route, spots, components, and keys, and is ACCEPTED', async () => {
  const s = await boot();
  try {
    const r = await s.call('POST', '/review/feedback', {
      screen: 'S-01', text: 'Look at the panels. SECRETVALUE', categories: ['Layout', 'Bug'],
      spots: [spot({ n: 1 }), spot({ n: 2, selector: '#stats', text: 'Medals in view' })],
      components: [{ name: 'chart-frame', instance: '#medals-by-year' }, 'form-field'], contentKeys: [],
      viewport: { width: 1440, height: 900 }, device: 'desktop',
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.id, 'WI-001');
    assert.equal(r.body.status, 'ACCEPTED');
    assert.equal(r.body.page, 'overview-dashboard');
    assert.deepEqual(r.body.redacted, ['test_shape']);
    const t = findTicket(s.store, 'WI-001');
    assert.equal(t.page, 'overview-dashboard');
    assert.equal(t.data.job, 'JOB-1');
    assert.equal(t.data.step, 'S-01');
    assert.equal(t.data.state, 'overview-default');
    assert.equal(t.data.route, '/overview/');
    assert.equal(t.data.spots.length, 2);
    assert.deepEqual(t.data.categories, ['Bug', 'Layout']);
    assert.deepEqual(t.data.components[0], { name: 'chart-frame', spec: null, instance: '#medals-by-year' });
    assert.ok(!readFileSync(t.file, 'utf8').includes('SECRETVALUE'));
    const listed = (await s.call('GET', '/review/feedback?step=S-01')).body;
    assert.equal(listed[0].id, 'WI-001');
    const edited = (await s.call('POST', '/review/feedback/WI-001', { text: 'Edited note.' })).body;
    assert.equal(edited.status, 'ACCEPTED');
    assert.equal((await s.call('POST', '/review/feedback', { screen: 'nowhere', text: 'x' })).status, 400);
  } finally { s.close(); }
});

test('a copy edit changes the key, its checked instances, and the framed page, and the ticket records all of it', async () => {
  const s = await boot();
  try {
    const preview = (await s.call('POST', '/review/content', { key: 'global.filters.panel.title', newValue: 'Filter the medals' })).body;
    assert.equal(preview.old, 'Filter medals');
    assert.deepEqual(preview.problems, []);
    assert.equal(preview.instances.length, 1);
    assert.equal(preview.instances[0].file, 'site/assets/filter-bar.mjs');
    const r = await s.call('POST', '/review/feedback', {
      screen: 'S-46', text: 'Say it as a request.',
      spots: [spot()], components: ['filters-sheet'],
      contentEdits: [{ key: 'global.filters.panel.title', newValue: 'Filter the medals', take: preview.instances.map((i) => i.id) }],
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.edited, true);
    assert.equal(r.body.rebuilt, true);
    assert.equal(s.rebuilds(), 1);
    assert.ok(readFileSync(join(s.cms, 'global/filters.md'), 'utf8').includes('- `title`: Filter the medals\n- `reset`: Reset\n'));
    assert.ok(readFileSync(join(s.root, 'site/assets/filter-bar.mjs'), 'utf8').includes('<h2 id="gf-title">Filter the medals</h2>'));
    const t = findTicket(s.store, 'WI-001');
    assert.equal(t.data.status, 'ACCEPTED');
    assert.deepEqual(t.data['content-keys'], ['global.filters.panel.title']);
    const edit = t.data['content-edits'][0];
    assert.equal(edit.key, 'global.filters.panel.title');
    assert.equal(edit.file, '.docs/content-management-system/global/filters.md');
    assert.equal(edit.old, 'Filter medals');
    assert.equal(edit.new, 'Filter the medals');
    assert.deepEqual(edit.instances.map((i) => i.file), ['site/assets/filter-bar.mjs']);
    assert.match(t.body, /content-edit/);
  } finally { s.close(); }
});

test('copy that breaks a rule is refused with the reason and writes no file and no ticket', async () => {
  const s = await boot();
  try {
    const before = readFileSync(join(s.cms, 'global/filters.md'), 'utf8');
    const em = String.fromCharCode(0x2014);
    const r = await s.call('POST', '/review/feedback', { screen: 'S-46', text: 'x', spots: [spot()], contentEdits: [{ key: 'global.filters.panel.title', newValue: `Filter ${em} medals`, take: [] }] });
    assert.equal(r.status, 422);
    assert.match(r.body.problems[0], /dash/);
    assert.equal(readFileSync(join(s.cms, 'global/filters.md'), 'utf8'), before);
    assert.deepEqual(listTickets(s.store), []);
    assert.equal(s.rebuilds(), 0);
    const preview = (await s.call('POST', '/review/content', { key: 'global.filters.panel.title', newValue: 'Filter SECRETVALUE' })).body;
    assert.match(preview.problems.join(' '), /secret/);
  } finally { s.close(); }
});

test('a page on another origin cannot register a ticket', async () => {
  const s = await boot();
  try {
    const status = await new Promise((done, fail) => {
      const req = request({ host: '127.0.0.1', port: s.port, path: '/review/feedback', method: 'POST', headers: { origin: 'http://elsewhere.example', 'content-type': 'application/json' } }, (res) => { res.resume(); done(res.statusCode); });
      req.on('error', fail);
      req.end(JSON.stringify({ screen: 'S-01', text: 'x' }));
    });
    assert.equal(status, 403);
    assert.deepEqual(listTickets(s.store), []);
  } finally { s.close(); }
});
