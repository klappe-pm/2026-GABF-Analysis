// The site artifact is the web/ app's static export with the single file dashboard beside it. Nothing of the
// retired static page build is published, and no GitHub Pages marker file reaches the bucket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { assemble } from '../scripts/assemble-site.mjs';

const put = (root, rel, text) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

test('assemble publishes the web export and the single file dashboard', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'site-'));
  const web = join(tmp, 'web');
  put(web, 'index.html', 'web home');
  put(web, '404.html', 'not found');
  put(web, 'overview/index.html', 'web overview');
  put(web, 'design-system/index.html', 'style guide');
  put(web, 'data/results.json', '[]');
  put(web, '_next/static/app.js', 'app');
  put(tmp, 'gabf-dashboard.html', 'single file');
  const out = join(tmp, 'site');
  const r = assemble({ web, standalone: join(tmp, 'gabf-dashboard.html'), out });
  const read = (p) => readFileSync(join(out, p), 'utf8');
  assert.equal(read('index.html'), 'web home');
  assert.equal(read('overview/index.html'), 'web overview');
  assert.equal(read('design-system/index.html'), 'style guide');
  assert.equal(read('data/results.json'), '[]');
  assert.equal(read('_next/static/app.js'), 'app');
  assert.equal(read('gabf-dashboard.html'), 'single file');
  assert.equal(r.files, 7);
  assert.ok(!existsSync(join(out, 'assets')), 'the old static assets are not published');
  assert.ok(!existsSync(join(out, 'CNAME')) && !existsSync(join(out, '.nojekyll')));
});

test('assemble refuses to publish without the web export or the dashboard', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'site-'));
  put(tmp, 'gabf-dashboard.html', 'single file');
  assert.throws(() => assemble({ web: join(tmp, 'missing'), standalone: join(tmp, 'gabf-dashboard.html'), out: join(tmp, 'site') }), /web export not found/);
  put(join(tmp, 'web'), 'index.html', 'web home');
  assert.throws(() => assemble({ web: join(tmp, 'web'), standalone: join(tmp, 'missing.html'), out: join(tmp, 'site') }), /single file dashboard not found/);
});

test('assemble refuses an artifact without the home page or the 404 page', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'site-'));
  put(join(tmp, 'web'), 'index.html', 'web home');
  put(tmp, 'gabf-dashboard.html', 'single file');
  assert.throws(() => assemble({ web: join(tmp, 'web'), standalone: join(tmp, 'gabf-dashboard.html'), out: join(tmp, 'site') }), /no 404\.html/);
});
