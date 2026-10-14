// Editing page copy in place, and the site build reading that copy. Every test runs against a
// temporary copy of the copy folder (and a temporary ticket store and source tree); the real
// .docs/content-management-system/ is never written.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { createReviewServer } from '../scripts/review-server.mjs';
import { createSiteCopy, loadSiteCopy } from '../scripts/lib/site-copy.mjs';
import { listTickets } from '../scripts/lib/review-store.mjs';

const sanitize = (text) => (text.includes('SECRETVALUE') ? { text: text.replace(/SECRETVALUE/g, '[REDACTED:test_shape]'), redacted: ['test_shape'] } : { text, redacted: [] });

const FILTERS_MD = '---\nnote: frontmatter stays\n---\r\n# Filters\r\n\r\nProse for the reader.\r\n\r\n## `panel`\r\n\r\n- `title`: Filter medals\r\n- `reset`: Reset all\r\n- `apply`: Apply\r\n';
const PAGE_MD = '# Filters panel\n\n## `sheet`\n\n- `heading`: Filter medals\n';

async function boot() {
  const root = mkdtempSync(join(tmpdir(), 'gabf-inline-'));
  for (const f of ['docs/design/design-nodes.json', 'docs/design/feedback-categories.json', 'site/review/source-map.json']) {
    mkdirSync(resolve(root, f, '..'), { recursive: true });
    cpSync(resolve(ROOT, f), resolve(root, f));
  }
  const cms = join(root, 'cms');
  mkdirSync(join(cms, 'global'), { recursive: true });
  mkdirSync(join(cms, 'pages'), { recursive: true });
  writeFileSync(join(cms, 'global/filters.md'), FILTERS_MD);
  writeFileSync(join(cms, 'pages/filters-panel.md'), PAGE_MD);
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
  return { root, cms, store, call, close: () => server.close(), rebuilds: () => rebuilt };
}

const SPOT = { selector: 'dialog.filter-panel h2', rect: { x: 5, y: 6, width: 100, height: 20 }, text: 'Filter medals' };

test('the page asks which of its texts are page copy: whole values only, the reviewed page first', async () => {
  const s = await boot();
  try {
    const r = (await s.call('POST', '/review/inline/resolve', { screen: 'S-46', texts: ['Filter medals', 'Reset all', 'Apply', 'Brewery of the Year', 'A longer paragraph that contains Reset all inside it, so it is not one line of copy'] })).body;
    assert.equal(r['Filter medals'].key, 'pages.filters-panel.sheet.heading', 'the entry of the page under review comes first');
    assert.equal(r['Filter medals'].others, 1, 'the shared entry with the same words is a related instance');
    assert.equal(r['Reset all'].key, 'global.filters.panel.reset');
    assert.equal(r['Reset all'].value, 'Reset all');
    assert.equal(r['Brewery of the Year'], null, 'text with no copy entry is not editable');
    const long = Object.entries(r).find(([t]) => t.startsWith('A longer'))[1];
    assert.equal(long, null, 'text that only contains a value is not editable as one line');
  } finally { s.close(); }
});

test('an inline edit lands on the key the build reads, whether or not the other entries with the same words are checked', async () => {
  const s = await boot();
  try {
    mkdirSync(join(s.root, 'dist-review'), { recursive: true });
    writeFileSync(join(s.root, 'dist-review/review-copy-keys.json'), JSON.stringify(['global.filters.panel.title']));
    const r = (await s.call('POST', '/review/inline/resolve', { screen: 'S-46', texts: ['Filter medals'] })).body;
    assert.equal(r['Filter medals'].key, 'global.filters.panel.title', 'the build read key outranks the reviewed page entry and the text match order');
    assert.equal(r['Filter medals'].others, 1);
    const saved = await s.call('POST', '/review/inline/save', { screen: 'S-46', key: r['Filter medals'].key, newValue: 'Narrow the medals', take: [], spot: SPOT });
    assert.equal(saved.status, 200);
    assert.match(readFileSync(join(s.cms, 'global/filters.md'), 'utf8'), /- `title`: Narrow the medals\r\n/);
    assert.match(readFileSync(join(s.cms, 'pages/filters-panel.md'), 'utf8'), /- `heading`: Filter medals\n/, 'the unchecked related entry is untouched');
  } finally { s.close(); }
});

test('the site copy lookup records the keys the build reads', () => {
  const copy = createSiteCopy([{ key: 'a.b', value: 'x' }, { key: 'a.c', value: 'y' }]);
  copy('a.b');
  assert.deepEqual([...copy.used], ['a.b']);
});

test('the review build records the footer link key it reads and the public build writes no such list', () => {
  const t = tempCms([]);
  const pub = build(t);
  assert.equal(pub.status, 0, pub.stderr);
  assert.ok(!existsSync(join(t.dist, 'review-copy-keys.json')));
  const env = { ...process.env, GABF_CMS_DIR: t.cms, GABF_DIST: join(t.work, 'dist-review'), GABF_FEEDBACK: '1' };
  delete env.CI;
  delete env.GITHUB_ACTIONS;
  const rev = spawnSync(process.execPath, [resolve(ROOT, 'scripts/build-site.mjs')], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(rev.status, 0, rev.stderr);
  const keys = JSON.parse(readFileSync(join(t.work, 'dist-review/review-copy-keys.json'), 'utf8'));
  assert.ok(keys.includes('global.site.footer.source_link'));
  assert.ok(!keys.includes('global.navigation.footer.source'), 'an entry the build does not read is not listed');
});

test('saving an inline edit writes the value, rebuilds once, and records an ACCEPTED ticket with the old and new values', async () => {
  const s = await boot();
  try {
    const preview = (await s.call('POST', '/review/content', { key: 'global.filters.panel.title' })).body;
    const take = preview.instances.map((i) => i.id);
    assert.ok(take.length >= 2, 'the page copy entry and the hard coded string are listed as related instances');
    const r = await s.call('POST', '/review/inline/save', { screen: 'S-46', key: 'global.filters.panel.title', newValue: 'Narrow the medals', take, spot: SPOT, viewport: { width: 1440, height: 900 } });
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ACCEPTED');
    assert.equal(r.body.rebuilt, true);
    assert.equal(r.body.edited, true);
    assert.equal(s.rebuilds(), 1);
    assert.match(readFileSync(join(s.cms, 'global/filters.md'), 'utf8'), /- `title`: Narrow the medals\r\n/);
    assert.match(readFileSync(join(s.cms, 'pages/filters-panel.md'), 'utf8'), /- `heading`: Narrow the medals\n/);
    assert.match(readFileSync(join(s.root, 'site/assets/filter-bar.mjs'), 'utf8'), /<h2 id="gf-title">Narrow the medals<\/h2>/);
    const [ticket] = listTickets(s.store);
    assert.equal(ticket.data.status, 'ACCEPTED');
    assert.equal(ticket.page, 'filters-panel');
    assert.equal(ticket.data['content-edits'][0].old, 'Filter medals');
    assert.equal(ticket.data['content-edits'][0].new, 'Narrow the medals');
    assert.deepEqual(ticket.data['content-keys'], ['global.filters.panel.title']);
    assert.equal(ticket.data.spots[0].selector, SPOT.selector);
    assert.match(ticket.body, /- old: Filter medals\n- new: Narrow the medals/);
  } finally { s.close(); }
});

test('an unchecked related instance is left as it was', async () => {
  const s = await boot();
  try {
    await s.call('POST', '/review/inline/save', { screen: 'S-46', key: 'global.filters.panel.title', newValue: 'Narrow the medals', take: [], spot: SPOT });
    assert.match(readFileSync(join(s.cms, 'pages/filters-panel.md'), 'utf8'), /- `heading`: Filter medals\n/);
    assert.match(readFileSync(join(s.root, 'site/assets/filter-bar.mjs'), 'utf8'), /Filter medals/);
  } finally { s.close(); }
});

test('the write is byte for byte: only the value text of one line changes, line endings and frontmatter included', async () => {
  const s = await boot();
  try {
    const before = readFileSync(join(s.cms, 'global/filters.md'), 'utf8');
    const r = await s.call('POST', '/review/inline/save', { screen: 'S-46', key: 'global.filters.panel.reset', newValue: 'Clear all', take: [], spot: SPOT });
    assert.equal(r.status, 200);
    const after = readFileSync(join(s.cms, 'global/filters.md'), 'utf8');
    assert.equal(after, before.replace('- `reset`: Reset all\r\n', '- `reset`: Clear all\r\n'));
    assert.equal(after.length - before.length, 'Clear all'.length - 'Reset all'.length);
  } finally { s.close(); }
});

test('rule breaking text is refused with the reason and nothing is written, rebuilt or recorded', async () => {
  const s = await boot();
  try {
    const before = readFileSync(join(s.cms, 'global/filters.md'), 'utf8');
    const bad = {
      dash: 'Reset \u2014 everything',
      kebab: 'Use the reset-all-filters control',
      lines: 'First line\nSecond line',
      secret: 'Reset SECRETVALUE',
    };
    for (const [name, newValue] of Object.entries(bad)) {
      const r = await s.call('POST', '/review/inline/save', { screen: 'S-46', key: 'global.filters.panel.reset', newValue, take: [], spot: SPOT });
      assert.equal(r.status, 422, name);
      assert.ok(r.body.problems.length > 0, name);
    }
    assert.equal(readFileSync(join(s.cms, 'global/filters.md'), 'utf8'), before);
    assert.equal(s.rebuilds(), 0);
    assert.equal(listTickets(s.store).length, 0);
    assert.equal((await s.call('POST', '/review/inline/save', { screen: 'S-46', key: 'global.filters.panel.nope', newValue: 'x', take: [] })).status, 422, 'a key with no entry is refused');
    assert.equal((await s.call('POST', '/review/inline/save', { screen: 'S-46', key: 'global.filters.panel.reset', newValue: 'Reset all', take: [] })).status, 422, 'an unchanged value is refused');
  } finally { s.close(); }
});

// ---------- the site build reads the copy ----------

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
};

function tempCms(edits) {
  const work = mkdtempSync(join(tmpdir(), 'gabf-build-'));
  const cms = join(work, 'cms');
  cpSync(resolve(ROOT, '.docs/content-management-system'), cms, { recursive: true });
  for (const [file, from, to] of edits) {
    const path = join(cms, file);
    const text = readFileSync(path, 'utf8');
    assert.ok(text.includes(from), `${file} has ${from}`);
    writeFileSync(path, text.replace(from, to));
  }
  return { work, cms, dist: join(work, 'dist') };
}

function build({ cms, dist }) {
  const env = { ...process.env, GABF_CMS_DIR: cms, GABF_DIST: dist };
  delete env.GABF_FEEDBACK;
  return spawnSync(process.execPath, [resolve(ROOT, 'scripts/build-site.mjs')], { cwd: ROOT, env, encoding: 'utf8' });
}

test('the build renders a changed copy key on every page that uses it', () => {
  const t = tempCms([
    ['global/site.md', '- `menu_button`: Menu', '- `menu_button`: Open the menu'],
    ['pages/beer-detail.md', '- `title`: Published specs', '- `title`: What the brewery published'],
  ]);
  const r = build(t);
  assert.equal(r.status, 0, r.stderr);
  const pages = walk(t.dist).filter((f) => f.endsWith('.html'));
  const withMenu = pages.filter((f) => readFileSync(f, 'utf8').includes('class="nav-toggle"'));
  assert.ok(withMenu.length > 1000, 'the header is on every page');
  for (const f of withMenu) {
    const html = readFileSync(f, 'utf8');
    assert.ok(html.includes('aria-controls="site-nav">Open the menu</button>'), `${f} shows the changed key`);
    assert.ok(!html.includes('aria-controls="site-nav">Menu</button>'), `${f} no longer shows the old words`);
  }
  const beers = pages.filter((f) => readFileSync(f, 'utf8').includes('id="spec-title"'));
  assert.ok(beers.length > 100, 'beer pages carry the specs card');
  for (const f of beers) assert.match(readFileSync(f, 'utf8'), /<h2 id="spec-title">What the brewery published<\/h2>/);
});

test('the build with the unchanged copy matches the words the pages always showed', () => {
  const t = tempCms([]);
  const r = build(t);
  assert.equal(r.status, 0, r.stderr);
  const home = readFileSync(join(t.dist, 'index.html'), 'utf8');
  assert.ok(home.includes('<a class="skip-link" href="#main">Skip to content</a>'));
  assert.ok(home.includes('aria-controls="site-nav">Menu</button>'));
  assert.ok(home.includes('>Filters</button>'));
  assert.ok(home.includes('>Source and data</a>. Some beer details are from <a href="https://catalog.beer">Catalog.beer</a>'));
});

test('a copy key the build needs but the copy folder lacks stops the build and names the key', () => {
  const t = tempCms([['global/site.md', '- `skip_link`: Skip to content\n', '']]);
  const r = build(t);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /needs the copy entry global\.site\.header\.skip_link/);
});

test('a missing copy folder stops the build and says where the folder is tracked', () => {
  const t = tempCms([]);
  const r = build({ ...t, cms: join(t.work, 'absent') });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /site copy folder is missing/);
});

test('site copy fills placeholders and refuses a value it was not given', () => {
  const copy = createSiteCopy([{ key: 'a.b', value: 'Results for {{year}}' }, { key: 'a.c', value: 'Plain' }], 'a test folder');
  assert.equal(copy('a.b', { year: 2026 }), 'Results for 2026');
  assert.equal(copy('a.c'), 'Plain');
  assert.throws(() => copy('a.b'), /placeholder \{\{year\}\}/);
  assert.throws(() => copy('a.missing'), /a test folder does not have it/);
});

test('the copy folder is in the checkout, so a clean clone and continuous integration have it', () => {
  assert.ok(existsSync(resolve(ROOT, '.docs/content-management-system/global/site.md')));
  assert.ok(loadSiteCopy().size > 500);
});
