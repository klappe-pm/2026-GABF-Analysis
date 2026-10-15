// The copy folder tests write copies of the copy folder into the system temp directory. They must remove
// them: thousands of leftover scratch folders once filled the disk. This runs those tests with a private
// temp directory and checks that no gabf-copy-* folder survives.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';

test('the copy folder tests leave no gabf-copy folder in the temp directory', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'gabf-leakcheck-'));
  try {
    const r = spawnSync(process.execPath, [
      '--test',
      '--test-name-pattern=a missing copy folder stops the build|a changed copy entry',
      resolve(ROOT, 'tests/inline-edit.test.mjs'),
    ], { cwd: ROOT, env: { ...process.env, TMPDIR: scratch, TEMP: scratch, TMP: scratch }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const left = readdirSync(scratch).filter((name) => name.startsWith('gabf-copy-'));
    assert.deepEqual(left, []);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
