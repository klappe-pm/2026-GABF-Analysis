// The Pages artifact keeps every old URL while the web/ app takes over: old pages stay where they were,
// the old overview moves to /overview/ with its links rewritten, and web/ routes win where they overlap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { assemble, relocateOverview } from '../scripts/assemble-pages.mjs';

const put = (root, rel, text) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

test('the old overview links resolve from one level down', () => {
  const html = '<link href="./assets/styles.css"><script>window.GABF_BASE = "./";</script><a href="./">home</a><a href="./breweries/">b</a><script src="assets/dashboards.js"></script><a href="#main">skip</a><a href="https://catalog.beer">c</a><link rel="icon" href="data:,"><a href="/x/">root</a>';
  assert.equal(relocateOverview(html), '<link href="../assets/styles.css"><script>window.GABF_BASE = "../";</script><a href="../">home</a><a href="../breweries/">b</a><script src="../assets/dashboards.js"></script><a href="#main">skip</a><a href="https://catalog.beer">c</a><link rel="icon" href="data:,"><a href="/x/">root</a>');
});

test('assemble lays web/ over dist/ and keeps every old path', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'pages-'));
  const dist = join(tmp, 'dist');
  const web = join(tmp, 'web');
  put(dist, 'index.html', '<a href="./explorer/">old home</a>');
  put(dist, '.nojekyll', '');
  put(dist, 'explorer/index.html', 'old explorer');
  put(dist, 'breweries/x/index.html', 'old brewery');
  put(web, 'index.html', 'web home');
  put(web, 'design-system/index.html', 'style guide');
  put(web, 'explorer/index.html', 'web explorer');
  put(tmp, 'gabf-dashboard.html', 'single file');
  const out = join(tmp, 'site');
  const r = assemble({ dist, web, standalone: join(tmp, 'gabf-dashboard.html'), out, domain: 'example.test' });
  const read = (p) => readFileSync(join(out, p), 'utf8');
  assert.equal(read('index.html'), 'web home');
  assert.equal(read('overview/index.html'), '<a href="../explorer/">old home</a>');
  assert.equal(read('breweries/x/index.html'), 'old brewery');
  assert.equal(read('explorer/index.html'), 'web explorer');
  assert.equal(read('design-system/index.html'), 'style guide');
  assert.equal(read('gabf-dashboard.html'), 'single file');
  assert.equal(read('CNAME'), 'example.test\n');
  assert.ok(existsSync(join(out, '.nojekyll')));
  assert.deepEqual(r.replaced, ['explorer/index.html']);
});
