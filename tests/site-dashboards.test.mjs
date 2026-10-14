import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { REFERENCE, RESULTS } from '../scripts/lib/paths.mjs';
import { filterData } from '../web/lib/site-model.mjs';
import { breweriesFile, breweryInfoFile, categoriesFile, csvFile, csvNames, defaultBrewery, estimatesFile, homeData, rateYears, searchIndex, tileCheck, TILES } from '../web/lib/models/dashboards.mjs';
import { categoryLines, scoresheet, searchIndexMatches } from '../web/lib/models/home.mjs';

// The dashboards lane's build time data: the files the dashboards read, the tile grid, and the home page.
const { results, meta } = filterData();

test('the data files have the content the current site publishes', () => {
  const breweries = breweriesFile();
  assert.ok(breweries.length >= 947);
  assert.ok(breweries.every((b) => !('explain' in b) && b.trend && b.financials && b.estimate));
  assert.equal(Object.keys(breweryInfoFile()).length, breweries.filter((b) => b.medals > 0).length);
  assert.deepEqual(Object.keys(estimatesFile()).sort(), breweries.map((b) => b.key).sort());
  assert.ok(categoriesFile().every((c) => c.slug && c.years.length));
  assert.ok(breweries.some((b) => b.key === defaultBrewery()));
});

test('every CSV and JSON table is published once, flattened, with its content', () => {
  const files = [...readdirSync(RESULTS), ...readdirSync(REFERENCE)].filter((f) => f.endsWith('.csv') || f.endsWith('.json'));
  assert.deepEqual(csvNames(), [...new Set(files)].sort());
  assert.ok(csvFile('gabf-2026.csv').startsWith('year,'));
  assert.equal(csvFile('missing.csv'), null);
});

test('every state that holds medals has a tile on the grid', () => {
  const holding = new Set(results.map((r) => r.state));
  for (const code of holding) assert.ok(TILES[code], `${code} has no tile`);
  assert.deepEqual(tileCheck().extra, []);
  const spots = Object.values(TILES).map((t) => t.join(','));
  assert.equal(new Set(spots).size, spots.length, 'two states share a tile');
});

test('the rate years say which year the latest rate borrows', () => {
  const y = rateYears();
  assert.equal(y.latest, Math.max(...meta.years));
  assert.ok(y.data <= y.latest);
});

test('the home page counts the latest complete year', () => {
  const h = homeData();
  const rows = results.filter((r) => r.year === meta.latest_complete);
  assert.equal(h.year, meta.latest_complete);
  assert.equal(h.scoresheet.medals, rows.length);
  assert.equal(h.categories.length, h.scoresheet.categories);
  assert.equal(h.categories.reduce((s, c) => s + c.gold.length + c.silver.length + c.bronze.length, 0), rows.length);
  for (const k of ['year_range', 'brewery_count', 'medal_count', 'top_decile_share', 'single_medal_share', 'top_brewery', 'top_brewery_medals']) assert.ok(h.finding[k], k);
});

test('entries per medal is the category field divided by its medals', () => {
  const rows = [
    { category_slug: 'a', category_name: 'A', category_number: 2, entries: 30, medal: 'Gold', brewery_name: 'X', brewery_slug: 'x' },
    { category_slug: 'a', category_name: 'A', category_number: 2, entries: 30, medal: 'Silver', brewery_name: 'Y', brewery_slug: 'y' },
    { category_slug: 'b', category_name: 'B', category_number: 1, entries: null, medal: 'Gold', brewery_name: 'X', brewery_slug: 'x' },
  ];
  const lines = categoryLines(rows);
  assert.deepEqual(lines.map((l) => l.slug), ['b', 'a']);
  assert.equal(lines[1].odds, 15);
  assert.equal(lines[0].odds, null);
  assert.equal(scoresheet(rows, 500).entries, 500);
  assert.equal(scoresheet(rows).entries, 30);
});

test('search needs every word and finds breweries, categories, and beers', () => {
  const index = searchIndex();
  assert.ok(['brewery', 'category', 'beer'].every((k) => index.some((e) => e.kind === k)));
  const hit = searchIndexMatches(index, 'green cheek');
  assert.ok(hit.length && hit.every((e) => e.text.includes('green') && e.text.includes('cheek')));
  assert.deepEqual(searchIndexMatches(index, 'zzzz qqqq'), []);
  assert.deepEqual(searchIndexMatches(index, '  '), []);
});
