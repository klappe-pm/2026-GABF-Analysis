import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webOutGate, webOutState } from '../scripts/lib/web-out-fresh.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'gabf-web-out-'));
  const file = (rel, at) => { const p = join(root, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, 'x'); utimesSync(p, at, at); return p; };
  return { root, file, done: () => rmSync(root, { recursive: true, force: true }) };
}

test('an export newer than every source is fresh; a newer source makes it stale and names the file and the rebuild', () => {
  const f = fixture();
  try {
    f.file('web/app/page.tsx', 1000);
    f.file('web/out/index.html', 2000);
    assert.deepEqual(webOutState({ root: f.root }), { status: 'fresh' });
    assert.equal(webOutGate({ root: f.root, env: {} }), false);
    f.file('.docs/content-management-system/global/filters.md', 3000);
    const s = webOutState({ root: f.root });
    assert.equal(s.status, 'stale');
    assert.match(s.reason, /older than \.docs\/content-management-system\/global\/filters\.md/);
    assert.match(s.reason, /npm run web:build/);
    assert.throws(() => webOutGate({ root: f.root, env: { CI: 'true' } }), /older than/);
  } finally { f.done(); }
});

test('generated files never make the export stale, and a missing export fails locally but skips in CI', () => {
  const f = fixture();
  try {
    f.file('web/out/index.html', 2000);
    f.file('web/node_modules/x/index.js', 5000);
    f.file('web/.next/cache.json', 5000);
    f.file('data/enriched/winners-2026.sqlite', 5000);
    assert.equal(webOutState({ root: f.root }).status, 'fresh');
    rmSync(join(f.root, 'web/out'), { recursive: true });
    assert.throws(() => webOutGate({ root: f.root, env: {} }), /web\/out is not built\. Rebuild it: cd .* && npm run web:build/);
    assert.match(webOutGate({ root: f.root, env: { CI: 'true' } }), /continuous integration builds it after the tests/);
  } finally { f.done(); }
});
