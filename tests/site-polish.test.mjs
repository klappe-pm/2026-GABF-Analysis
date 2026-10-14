import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gsbColumn, gsbText, humanize, humanizeHeadings, statTile, tableHtml } from '../site/assets/charts.mjs';
import { explainEstimate, foldCategory } from '../scripts/build-site.mjs';
import { estMark, explainHtml } from '../site/assets/estimates.mjs';

const PARAMS = { barrels_by_brewery_type: { brewpub: 1200, default: 1500 }, barrels_per_additional_location: 600, food_revenue_per_kitchen_location: 1200000, ebitda_margin_range_by_channel: { taproom: [0.08, 0.24], 'self-distribution': [0.05, 0.11], default: [0.02, 0.24] } };

test('estimate popovers explain the inputs and formula actually used', () => {
  const b = {
    key: 'x', name: 'X Brewing', brewery_type: 'brewpub', locations_count: 2, has_kitchen: true, distribution_channel: '', employees: null,
    estimate: { barrels: 1800, basis: 'type-heuristic', confidence: 'low', revenue: { total_revenue_usd: 4696800, low_usd: 3287760, high_usd: 6340680, revenue_per_barrel_usd: 1276, food_revenue_usd: 2400000, basis: 'estimate' } },
    financials: { arr_usd: 4696800, gross_margin: 0.62, gross_profit_usd: 2912016, ebitda_margin: 0.12, ebitda_usd: 563616, ebitda_margin_low: 0.08, ebitda_margin_high: 0.24 },
  };
  const ex = explainEstimate(b, PARAMS);
  assert.match(ex.text.barrels, /typical volume for a brewpub \(1,200 barrels\) plus 600 barrels for each of 1 more location: 1,800 barrels/);
  assert.match(ex.text.arr, /1,800 barrels times \$1,276 per barrel.*plus \$1,200,000 of food sales for each of 2 locations with a kitchen, gives \$4,696,800/);
  assert.match(ex.text.ebitda, /12 percent EBITDA margin.*8 percent to 24 percent, typical for taproom sales breweries/);
  assert.deepEqual(ex.inputs.map(([k]) => k), ['Barrels', 'Brewery type', 'Locations', 'Kitchen', 'Distribution', 'Employees']);
  const html = explainHtml(ex, 'arr', '../../about/#estimates');
  assert.match(html, /Estimate, not reported\./);
  assert.ok(!/\.json|\.mjs|scripts\/|data\//.test(html), 'no developer text in the popover');
  assert.match(estMark('x', 'arr'), /aria-expanded="false" aria-controls="est-popover"/);
});
import { loadWinnerProfiles, matchKey } from '../scripts/lib/winner-profiles.mjs';

test('kebab-case slugs become display headings', () => {
  assert.equal(humanize('ownership-and-investors'), 'Ownership and investors');
  assert.equal(humanize('gabf-and-world-beer-cup-record'), 'GABF and World Beer Cup record');
  assert.equal(humanize('movers-2025-to-2026'), 'Movers 2025 to 2026');
  assert.equal(humanizeHeadings('<h2 id="estimates">estimates</h2><h3>2026</h3><h1>dogfish</h1>'), '<h2 id="estimates">Estimates</h2><h3>2026</h3><h1>dogfish</h1>');
  assert.equal(humanizeHeadings('<h2>Already Titled</h2>'), '<h2>Already Titled</h2>');
});

test('category name variants fold to the same key without prefix matches', () => {
  assert.equal(foldCategory('American-Style Pilsener'), foldCategory('American Pilsener'));
  assert.equal(foldCategory('Fruit & Spice Beer'), foldCategory('Fruit and Spice'));
  assert.notEqual(foldCategory('Juicy or Hazy India Pale Ale'), foldCategory('Juicy or Hazy Imperial India Pale Ale'));
});

test('medal split tile and sortable headers', () => {
  const tile = statTile({ label: 'Gold, silver, bronze', medals: [634, 637, 636] });
  assert.match(tile, /stat-medals/);
  assert.match(tile, /<span class="gsb" aria-hidden="true">634-637-636<\/span><span class="visually-hidden">634 gold, 637 silver, 636 bronze<\/span>/);
  assert.equal(gsbText(4, 4, 4), '4-4-4');
  const col = gsbColumn((r) => r.split);
  assert.match(tableHtml([col], [{ split: [1, 2, 0] }]), /<th scope="col" class="num gsb-cell" tabindex="0"><span aria-hidden="true">G-S-B<\/span><span class="visually-hidden">Gold, silver, bronze<\/span><\/th>/);
  const order = [{ split: [3, 0, 0] }, { split: [1, 1, 2] }, { split: [2, 1, 1] }].sort((a, b) => col.sortValue(b) - col.sortValue(a)).map((r) => gsbText(...r.split));
  assert.deepEqual(order, ['2-1-1', '1-1-2', '3-0-0'], 'total medals first, then gold');
  assert.match(tableHtml([{ key: 'a', label: 'A' }], [{ a: 1 }]), /<th scope="col" tabindex="0">A<\/th>/);
  assert.match(tableHtml([{ key: 'a', label: 'A' }], [{ a: 1 }]), /<td data-label="A">1<\/td>/);
});

test('every 2026 winner profile loads with a unique match key', () => {
  const profiles = loadWinnerProfiles(2026);
  assert.equal(profiles.length, 336);
  assert.equal(new Set(profiles.map((p) => p.key)).size, 336);
  assert.equal(matchKey('Fuzztail', 'Silver', 'American Wheat Beer'), 'fuzztail|silver|americanwheatbeer');
});
