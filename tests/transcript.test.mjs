import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTranscript, similarity, stripCaptions } from '../scripts/lib/transcript-lib.mjs';
import { isSpecialCategory } from '../scripts/lib/style-families.mjs';
import { estimateFinancials, loadParameters } from '../scripts/lib/estimate.mjs';

const vtt = readFileSync(new URL('./fixtures/ceremony-sample.vtt', import.meta.url), 'utf8');

test('stripCaptions drops timing lines and repeated cues', () => {
  const text = stripCaptions(vtt);
  assert.ok(!/-->/.test(text));
  assert.equal((text.match(/category one american wheat beer/g) ?? []).length, 1);
});

test('similarity and parseTranscript produce reviewed draft rows', () => {
  assert.ok(similarity('juicy or hazy imperial india pale ale', 'Juicy or Hazy Imperial India Pale Ale') > 0.9);
  const knownCategories = ['American Wheat Beer', 'Juicy or Hazy Imperial India Pale Ale', 'Italian-Style Pilsener'];
  const knownBreweries = ['Green Cheek Beer Co.', 'Wormtown Brewery', 'Sunriver Brewing Co.'];
  const { rows, categories, problems } = parseTranscript(vtt, { year: 2026, knownCategories, knownBreweries });
  assert.equal(problems.length, 0, JSON.stringify(problems));
  assert.equal(categories.length, 2);
  assert.equal(categories[0].entries, 35);
  assert.equal(categories[1].number, 12);
  assert.equal(categories[1].name, 'Juicy or Hazy Imperial India Pale Ale');
  assert.equal(rows.length, 6);
  const gold = rows.find((r) => r.medal === 'Gold' && r.category_number === '1');
  assert.equal(gold.beer_name, 'summer ale');
  assert.equal(gold.brewery_name, 'Wormtown Brewery');
  assert.equal(gold.city, 'worcester');
  assert.equal(gold.state, 'MA');
  assert.equal(gold.confidence, 3);
  const gc = rows.find((r) => r.medal === 'Bronze' && r.category_number === '12');
  assert.equal(gc.brewery_name, 'Green Cheek Beer Co.');
  assert.equal(gc.state, 'CA');
  const unmatched = rows.find((r) => r.beer_name === 'double vision');
  assert.equal(unmatched.brewery_name, 'vision ales');
  assert.match(unmatched.notes, /brewery unmatched/);
});

test('isSpecialCategory separates classic styles from special categories', () => {
  assert.equal(isSpecialCategory('Specialty India Pale Ale'), true);
  assert.equal(isSpecialCategory('American Fruit Beer'), true);
  assert.equal(isSpecialCategory('Pro-Am'), true);
  assert.equal(isSpecialCategory('Hop Water'), true);
  assert.equal(isSpecialCategory('Italian-Style Pilsener'), false);
  assert.equal(isSpecialCategory('Juicy or Hazy Imperial India Pale Ale'), false);
  assert.equal(isSpecialCategory('Rice Lager'), false);
});

test('estimateFinancials derives ARR, gross profit, and EBITDA ranges', () => {
  const params = loadParameters(new URL('../data/reference/estimation-parameters.json', import.meta.url));
  const f = estimateFinancials({ revenue: { total_revenue_usd: 12000000, low_usd: 9000000, high_usd: 16000000 }, barrels: 6500, breweryType: 'brewpub', employees: 100, locationsCount: 4, distributionChannel: 'self-distribution' }, params);
  assert.equal(f.arr_usd, 12000000);
  assert.equal(f.gross_profit_usd, Math.round(12000000 * params.gross_margin_by_brewery_type.brewpub));
  assert.equal(f.ebitda_margin_low, 0.05);
  assert.equal(f.ebitda_margin_high, 0.11);
  assert.ok(f.ebitda_low_usd < f.ebitda_usd || f.ebitda_usd <= f.ebitda_high_usd);
  assert.equal(f.revenue_per_employee_usd, 120000);
  assert.equal(f.revenue_per_location_usd, 3000000);
  assert.equal(f.revenue_per_barrel_usd, Math.round(12000000 / 6500));
});
