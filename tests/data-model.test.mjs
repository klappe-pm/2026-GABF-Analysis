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
  assert.equal(gc.trend.find((t) => t.year === 2026).status, 'medaled');
  assert.ok(gc.estimate.barrels > 0);
  assert.ok(gc.estimate.volume.cases_24x12_equivalent > 0);
  assert.equal(ds.coverage[2025], 'partial');
  assert.equal(ds.coverage[2026], 'partial');
  assert.equal(gc.trend.find((t) => t.year === 2026).gold, 1);
  assert.equal(gc.financials.arr_usd, 12000000);
  assert.equal(gc.distribution_channel, 'self-distribution');
  assert.equal(gc.employees, 100);
  assert.ok(gc.financials.revenue_per_employee_usd === 120000);
  const special = ds.results.find((r) => r.category_name === 'Specialty India Pale Ale');
  assert.equal(special.special, true);
  assert.equal(special.category_type, 'special');
  const row = ds.results.find((r) => r.beer_name === 'Zombi Shark Fight');
  assert.equal(row.style_family, 'Pilsner');
  assert.equal(row.region, 'West');
  assert.equal(row.abv_band, '5-to-6');
});

test('no loaded medal carries a placeholder category or a missing one', () => {
  const ds = loadDataset();
  for (const r of ds.results) {
    assert.ok(r.category_name && !/confirm/i.test(r.category_name), `${r.year} ${r.beer_name}: category "${r.category_name}" is not a real category`);
  }
  const gc2018 = ds.results.filter((r) => r.year === 2018 && r.brewery_key === 'green cheek' && r.competition === 'GABF');
  assert.equal(gc2018.length, 1, 'only the confirmed 2018 bronze is recorded');
  assert.equal(gc2018[0].beer_name, 'West Coast IPA Is Dead!');
  assert.equal(gc2018[0].category_name, 'American-Style India Pale Ale');
});

test('categoryIndex groups rows by category with yearly medals', () => {
  const ds = loadDataset();
  const cats = categoryIndex(ds);
  const pils = cats.find((c) => c.name === 'Italian-Style Pilsener');
  assert.ok(pils);
  assert.equal(pils.years[0].year, 2024);
  assert.equal(pils.ref.abv_max, '5.8');
});
