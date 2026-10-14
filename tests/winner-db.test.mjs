// The 2026 winners database is a build output (npm run generate, which npm test runs first), not a file
// in git. It must be rebuilt from the profiles alone: one beer row per profile, every row matched by id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ROOT } from '../scripts/lib/paths.mjs';

test('the winners database holds exactly one beer per 2026 profile', () => {
  const ids = readdirSync(resolve(ROOT, 'docs/2026/winner')).filter((f) => /^\d{3}-.+\.md$/.test(f)).map((f) => f.slice(0, -3)).sort();
  const db = new DatabaseSync(resolve(ROOT, 'data/enriched/winners-2026.sqlite'), { readOnly: true });
  const rows = db.prepare('SELECT id FROM beers ORDER BY id').all().map((r) => r.id);
  db.close();
  assert.ok(ids.length > 300, `expected the 2026 profiles, found ${ids.length}`);
  assert.deepEqual(rows, ids, 'run npm run explorer to rebuild data/enriched/winners-2026.sqlite from the profiles');
});
