import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { loadDataset } from '../scripts/lib/data-model.mjs';
import { breweryInfo, enrichResults, explainEstimate, profileCard } from '../scripts/build-site.mjs';
import { breweryDetailHtml } from '../scripts/build-standalone.mjs';
import { valueLabel } from '../site/assets/filter-bar.mjs';

const params = JSON.parse(readFileSync(resolve(ROOT, 'data/reference/estimation-parameters.json'), 'utf8'));
const ds = loadDataset();
const untyped = ds.breweries.filter((b) => b.medals.length && !b.brewery_type);
const dataOf = (html) => JSON.parse(html.match(/<script type="application\/json" id="dataset">([\s\S]*?)<\/script>/)[1]);

test('some medal-winning breweries have no sourced type, and none is defaulted', () => {
  assert.ok(untyped.length > 0);
  for (const b of untyped) {
    assert.equal(b.brewery_type, null, b.key);
    assert.equal(b.brewery_type_assumed, true, b.key);
  }
});

test('a brewery with no sourced type reads Not defined on its page and never Microbrewery', () => {
  const b = untyped[0];
  const card = profileCard(b);
  assert.match(card, /<dt>Type<\/dt><dd>Not defined<\/dd>/);
  assert.equal(valueLabel('brewery_type', b.brewery_type), 'Not defined');
  const detail = breweryDetailHtml(b);
  assert.match(detail, /Not defined/);
  for (const html of [card, detail]) assert.ok(!/Microbrewery/.test(html), 'no default type text');
});

test('the dashboard data carries no type for a brewery without one', () => {
  const b = untyped[0];
  enrichResults(ds);
  const rows = ds.results.filter((r) => r.brewery_key === b.key);
  assert.ok(rows.length > 0);
  for (const r of rows) assert.equal(r.brewery_type, '', 'row type is blank, not micro');
  assert.equal(breweryInfo(ds)[b.key].brewery_type, null);
  assert.equal(valueLabel('brewery_type', rows[0].brewery_type), 'Not defined');
});

test('an estimate that depends on an unknown type says the type is assumed', () => {
  const b = untyped.find((x) => x.estimate.basis === 'type-heuristic') ?? untyped[0];
  const ex = explainEstimate(b, params);
  assert.match(ex.text.gross_margin, /assumed generic type/);
  assert.match(ex.text.ebitda, /assumed generic type/);
  assert.match(ex.text.arr + ex.text.barrels, /assumed generic type|researched|Reported|bracket/);
  assert.equal(ex.inputs.find(([k]) => k === 'Brewery type')[1], 'Not defined (estimate uses an assumed generic type)');
  assert.ok(!/microbrewery/i.test(JSON.stringify(ex)));
});
