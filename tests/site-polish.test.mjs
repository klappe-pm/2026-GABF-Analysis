import { test } from 'node:test';
import assert from 'node:assert/strict';
import { humanize, humanizeHeadings, statTile, tableHtml } from '../site/assets/charts.mjs';
import { foldCategory } from '../scripts/build-site.mjs';
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
  assert.equal((tile.match(/badge-medal/g) ?? []).length, 3);
  assert.match(tableHtml([{ key: 'a', label: 'A' }], [{ a: 1 }]), /<th scope="col" tabindex="0">A<\/th>/);
  assert.match(tableHtml([{ key: 'a', label: 'A' }], [{ a: 1 }]), /<td data-label="A">1<\/td>/);
});

test('every 2026 winner profile loads with a unique match key', () => {
  const profiles = loadWinnerProfiles(2026);
  assert.equal(profiles.length, 336);
  assert.equal(new Set(profiles.map((p) => p.key)).size, 336);
  assert.equal(matchKey('Fuzztail', 'Silver', 'American Wheat Beer'), 'fuzztail|silver|americanwheatbeer');
});
