// Runs the node test runner with the temporary folder pointed at one throwaway folder for the run,
// then removes that folder. Tests and the scripts they call create temporary folders through
// os.tmpdir(), and many never remove them; without this, every run left hundreds of folders behind.
//
//   node scripts/run-tests.mjs [node --test arguments]

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runTmp = mkdtempSync(join(tmpdir(), 'gabf-test-run-'));
let status = 1;
try {
  const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, TMPDIR: runTmp, TMP: runTmp, TEMP: runTmp },
  });
  if (result.error) throw result.error;
  status = result.status ?? 1;
} finally {
  rmSync(runTmp, { recursive: true, force: true });
}
process.exit(status);
