import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abvBand, styleFamily } from '../scripts/lib/style-families.mjs';
import { bracketToRange, CASES_24X12_PER_BARREL, estimateBarrels, estimateRevenue, loadParameters, volumeBreakdown } from '../scripts/lib/estimate.mjs';

const params = loadParameters(new URL('../data/reference/estimation-parameters.json', import.meta.url));

test('styleFamily maps official category names', () => {
  assert.equal(styleFamily('Juicy or Hazy Imperial India Pale Ale'), 'IPA');
  assert.equal(styleFamily('Italian-Style Pilsener'), 'Pilsner');
  assert.equal(styleFamily('Baltic-Style Porter'), 'Stout and Porter');
  assert.equal(styleFamily('American-Style Black Ale or American-Style Stout'), 'Stout and Porter');
  assert.equal(styleFamily('Classic Saison'), 'Belgian and French');
  assert.equal(styleFamily('Australian-Style Pale Ale'), 'Pale Ale');
  assert.equal(styleFamily('Wood- and Barrel-Aged Strong Stout'), 'Smoke and Wood');
  assert.equal(styleFamily('Hop Water'), 'Gluten-Free and Non-Alcoholic');
  assert.equal(styleFamily('Cider'), 'Cider and Mead');
  assert.equal(styleFamily('Pro-Am'), 'Pro-Am and Collaboration');
  assert.equal(styleFamily('Something Unexpected'), 'Other');
});

test('abvBand places values into explorer bands', () => {
  assert.equal(abvBand(4.5), '4-to-5');
  assert.equal(abvBand(6.9), '6-to-7');
  assert.equal(abvBand(10), '10-plus');
  assert.equal(abvBand(''), '');
});

test('bracketToRange parses GABF award brackets', () => {
  assert.deepEqual(bracketToRange('5,001 - 15,000 Barrels'), { min: 5001, max: 15000 });
  assert.deepEqual(bracketToRange('Over 100,000 Barrels'), { min: 100001, max: null });
  assert.equal(bracketToRange('no bracket'), null);
});

test('estimateBarrels prefers reported, then bracket, then curated, then type heuristic', () => {
  assert.equal(estimateBarrels({ production: [{ basis: 'reported', barrels: '12000', year: '2024', source: 's' }] }, params).barrels, 12000);
  const bracket = estimateBarrels({ production: [{ basis: 'boty-bracket', notes: '501 - 1,000 Barrels', source: 's' }] }, params);
  assert.equal(bracket.barrels, 751);
  assert.equal(bracket.basis, 'boty-bracket');
  const curated = estimateBarrels({ production: [{ basis: 'estimate', barrels: '6500', confidence: 'low' }] }, params);
  assert.equal(curated.barrels, 6500);
  const heuristic = estimateBarrels({ production: [], breweryType: 'brewpub', locationsCount: 4 }, params);
  assert.equal(heuristic.barrels, 1200 + 3 * 600);
  assert.equal(heuristic.basis, 'type-heuristic');
});

test('volumeBreakdown and estimateRevenue produce consistent figures', () => {
  const vol = volumeBreakdown(1000, params, 'brewpub');
  assert.equal(vol.cases_24x12_equivalent, Math.round(1000 * CASES_24X12_PER_BARREL));
  assert.equal(vol.packaged_barrels + vol.draft_barrels, 1000);
  const rev = estimateRevenue(1000, params, 'brewpub', { locationsCount: 2, hasKitchen: true });
  assert.equal(rev.beer_revenue_usd, 1000 * params.revenue_per_barrel_by_brewery_type.brewpub);
  assert.equal(rev.food_revenue_usd, 2 * params.food_revenue_per_kitchen_location);
  assert.ok(rev.low_usd < rev.total_revenue_usd && rev.total_revenue_usd < rev.high_usd);
});
