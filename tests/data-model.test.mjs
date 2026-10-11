import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryIndex, loadDataset } from '../scripts/lib/data-model.mjs';

test('loadDataset joins results, reference tables, and profiles', () => {
  const ds = loadDataset();
  assert.ok(ds.results.length >= 10, 'seeded Green Cheek rows load');
  const gc = ds.breweries.find((b) => b.key === 'green cheek');
  assert.ok(gc, 'Green Cheek brewery entity exists');
  assert.equal(gc.ownership.ownership_type, 'independent');
  assert.equal(gc.founded, 2017);
  assert.ok(gc.trend.find((t) => t.year === 2024).gold === 2);
  assert.equal(gc.trend.find((t) => t.year === 2026).status, 'not-yet-reported');
  assert.ok(gc.estimate.barrels > 0);
  assert.ok(gc.estimate.volume.cases_24x12_equivalent > 0);
  assert.equal(ds.coverage[2025], 'partial');
  assert.equal(ds.coverage[2026], 'pending');
  const row = ds.results.find((r) => r.beer_name === 'Zombi Shark Fight');
  assert.equal(row.style_family, 'Pilsner');
  assert.equal(row.region, 'West');
  assert.equal(row.abv_band, '5-to-6');
});

test('categoryIndex groups rows by category with yearly medals', () => {
  const ds = loadDataset();
  const cats = categoryIndex(ds);
  const pils = cats.find((c) => c.name === 'Italian-Style Pilsener');
  assert.ok(pils);
  assert.equal(pils.years[0].year, 2024);
  assert.equal(pils.ref.abv_max, '5.8');
});
