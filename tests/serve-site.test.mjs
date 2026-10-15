// The local site server answers addresses the way the CloudFront distribution does (docs/deployment.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createSiteServer, objectKey } from '../scripts/serve-site.mjs';

test('a folder address with or without its slash reads the folder index; a file address is itself', () => {
  assert.equal(objectKey('/'), '/index.html');
  assert.equal(objectKey('/beers/2026/'), '/beers/2026/index.html');
  assert.equal(objectKey('/beers/2026'), '/beers/2026/index.html');
  assert.equal(objectKey('/data/results.json'), '/data/results.json');
  assert.equal(objectKey('/assets/app.mjs'), '/assets/app.mjs');
});

test('a missing address answers with the 404 page and status 404', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'site-serve-'));
  const put = (rel, text) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); };
  put('index.html', 'home');
  put('404.html', 'not found');
  put('beers/2026/index.html', 'winners');
  const server = createSiteServer(dir);
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const get = async (p) => { const r = await fetch(base + p); return [r.status, await r.text()]; };
    assert.deepEqual(await get('/beers/2026'), [200, 'winners']);
    assert.deepEqual(await get('/beers/2026/'), [200, 'winners']);
    assert.deepEqual(await get('/no/such/page/'), [404, 'not found']);
    assert.deepEqual(await get('/missing.json'), [404, 'not found']);
  } finally { server.close(); }
});
