// Winner deep dives: the committed profiles are what the generator produces, every empty field
// names what was checked, hops match the hop profile, and awards history comes from the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { awardsFor, CANONICAL, deepDive, loadContext, missingFields, orderKeys, splitDoc } from '../scripts/winner-deep-dive.mjs';
import { ROOT } from '../scripts/lib/paths.mjs';

const dir = resolve(ROOT, 'docs/2026/winner');
const files = readdirSync(dir).filter((f) => /^\d{3}-.+\.md$/.test(f)).sort();
const ctx = loadContext();

test('every profile is up to date with the deep dive generator', () => {
  const stale = files.filter((f) => { const t = readFileSync(resolve(dir, f), 'utf8'); return deepDive(t, ctx) !== t; });
  assert.deepEqual(stale, [], 'run node scripts/winner-deep-dive.mjs 2026');
});

test('deep dive keys exist, keys are ordered, and every empty field has a gaps entry', () => {
  for (const f of files) {
    const { data, blocks } = splitDoc(readFileSync(resolve(dir, f), 'utf8'));
    for (const k of ['description', 'fg', 'gaps', 'hop-profile', 'og', 'process', 'srm', 'tasting-notes', 'water']) assert.ok(k in data, `${f}: ${k}`);
    assert.deepEqual([...blocks.keys()], orderKeys([...blocks.keys()]), `${f}: key order`);
    assert.deepEqual([...blocks.keys()].slice(0, CANONICAL.length), CANONICAL, `${f}: canonical keys first`);
    const gapFields = data.gaps.map((g) => g.field);
    assert.deepEqual(gapFields, missingFields(data), `${f}: gaps match the empty fields`);
    for (const g of data.gaps) assert.ok(g['sources-checked'].length > 0, `${f}: ${g.field} names what was checked`);
    for (const k of ['srm', 'og', 'fg', 'water', 'process', 'description', 'tasting-notes']) {
      const v = data[k];
      if (v !== null) assert.ok(v.source && /^https?:\/\//.test(v.source) && (v.value ?? v.text) !== undefined, `${f}: ${k} carries a value and a source`);
    }
    const hops = new Set((data.hops ?? []).map((h) => h.toLowerCase()));
    const varieties = new Set(data['hop-profile'].map((h) => String(h.variety).toLowerCase()));
    assert.deepEqual(varieties, hops, `${f}: hops list the hop profile varieties`);
    for (const h of data['hop-profile']) assert.ok(h.published && h.source, `${f}: ${h.published} has a published name and source`);
  }
});

test('awards history is generated from the results by brewery and beer name', () => {
  const rows = awardsFor(ctx, 'Kansas City Bier Co.', 'Winterbock');
  assert.ok(rows.some((r) => r.year === '2026' && r.medal === 'Gold'));
  assert.ok(rows.every((r) => r.beer_name.toLowerCase() === 'winterbock'));
  const text = readFileSync(resolve(dir, files.find((f) => f.includes('winterbock'))), 'utf8');
  assert.match(text, /## awards-history\n\n\| Year \| Competition \| Category \| Medal \|/);
  assert.match(text, /\| 2026 \| Great American Beer Festival \| German-Style Strong Beer \| Gold \|/);
});
