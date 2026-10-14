// The site build tests write full copies of the site into the system temp directory. They must remove
// them: thousands of leftover gabf-build-* folders once filled the disk. This runs the tests that
// build the site with a private temp directory and checks that no gabf-build-* folder survives.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';

test('the build tests leave no gabf-build folder in the temp directory', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'gabf-leakcheck-'));
  try {
    const r = spawnSync(process.execPath, [
      '--test',
      '--test-name-pattern=a missing copy folder stops the build|the build with the unchanged copy|the public build contains no part',
      resolve(ROOT, 'tests/inline-edit.test.mjs'),
      resolve(ROOT, 'tests/review-build.test.mjs'),
    ], { cwd: ROOT, env: { ...process.env, TMPDIR: scratch, TEMP: scratch, TMP: scratch }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const left = readdirSync(scratch).filter((name) => name.startsWith('gabf-build-'));
    assert.deepEqual(left, []);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
