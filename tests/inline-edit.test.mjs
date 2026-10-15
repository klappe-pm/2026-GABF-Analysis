// The copy lookup the site builds read. Every test runs against a temporary copy of the copy folder; the
// real .docs/content-management-system/ is never written. Editing copy in place is product-feedback's,
// and is tested there.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { createSiteCopy, loadSiteCopy } from '../scripts/lib/site-copy.mjs';

const scratch = [];

after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

function tempCms(edits) {
  const work = mkdtempSync(join(tmpdir(), 'gabf-copy-'));
  scratch.push(work);
  const cms = join(work, 'cms');
  cpSync(resolve(ROOT, '.docs/content-management-system'), cms, { recursive: true });
  for (const [file, from, to] of edits) {
    const path = join(cms, file);
    const text = readFileSync(path, 'utf8');
    assert.ok(text.includes(from), `${file} has ${from}`);
    writeFileSync(path, text.replace(from, to));
  }
  return { work, cms };
}

test('the site copy lookup records the keys the build reads', () => {
  const copy = createSiteCopy([{ key: 'a.b', value: 'x' }, { key: 'a.c', value: 'y' }]);
  copy('a.b');
  assert.deepEqual([...copy.used], ['a.b']);
});

test('a changed copy entry is the value the lookup returns', () => {
  const plain = loadSiteCopy({ env: { GABF_CMS_DIR: tempCms([]).cms } });
  assert.equal(plain('global.site.header.skip_link'), 'Skip to content');
  const t = tempCms([['global/site.md', '- `skip_link`: Skip to content\n', '- `skip_link`: Jump to the content\n']]);
  assert.equal(loadSiteCopy({ env: { GABF_CMS_DIR: t.cms } })('global.site.header.skip_link'), 'Jump to the content');
});

test('a copy key a build needs but the copy folder lacks stops the build and names the key', () => {
  const t = tempCms([['global/site.md', '- `skip_link`: Skip to content\n', '']]);
  const copy = loadSiteCopy({ env: { GABF_CMS_DIR: t.cms } });
  assert.throws(() => copy('global.site.header.skip_link'), /needs the copy entry global\.site\.header\.skip_link/);
});

test('a missing copy folder stops the build and says where the folder is tracked', () => {
  const t = tempCms([]);
  assert.throws(() => loadSiteCopy({ env: { GABF_CMS_DIR: join(t.work, 'absent') } }), /site copy folder is missing/);
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
