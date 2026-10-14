// Hop variety normalization: varieties and the hops list follow the alias map, published names never change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeHops } from '../scripts/normalize-hop-varieties.mjs';
import { loadHopLookup } from '../scripts/lib/hop-aliases.mjs';
import { splitDoc } from '../scripts/winner-deep-dive.mjs';
import { ROOT } from '../scripts/lib/paths.mjs';

const lookup = loadHopLookup();
const doc = (fm) => `---\ndomain: beer\n${fm}---\n\n# x\n`;

test('a published name with a product form resolves to its variety and fills the form', () => {
  const text = doc('hop-profile:\n  - published: "Citra Cryo"\n    variety: "Citra Cryo"\n    form: null\n    use: "dry hop"\n    lot-or-farm: null\n    source: "https://example.com/"\nhops:\n  - "Citra Cryo"\n');
  const r = normalizeHops(text, lookup);
  const d = splitDoc(r.text).data;
  assert.equal(d['hop-profile'][0].published, 'Citra Cryo');
  assert.equal(d['hop-profile'][0].variety, 'Citra');
  assert.equal(d['hop-profile'][0].form, 'Cryo');
  assert.equal(d['hop-profile'][0].use, 'dry hop');
  assert.deepEqual(d.hops, ['Citra']);
  assert.deepEqual(r.unresolved, []);
});

test('a name the map cannot resolve is kept and reported', () => {
  const r = normalizeHops(doc('hop-profile:\n  - published: "Zzz Unknown"\n    variety: "Zzz Unknown"\n    form: null\n    use: null\n    lot-or-farm: null\n    source: "https://example.com/"\nhops:\n  - "Zzz Unknown"\n'), lookup);
  assert.equal(r.changed, false);
  assert.deepEqual(r.unresolved, ['Zzz Unknown']);
});

test('every committed profile is already normalized', () => {
  const dir = resolve(ROOT, 'docs/2026/winner');
  const stale = readdirSync(dir).filter((f) => /^\d{3}-.+\.md$/.test(f)).filter((f) => normalizeHops(readFileSync(resolve(dir, f), 'utf8'), lookup).changed);
  assert.deepEqual(stale, [], 'run node scripts/normalize-hop-varieties.mjs 2026');
});
