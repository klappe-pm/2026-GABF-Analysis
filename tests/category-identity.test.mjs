import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalCategoryNames, categoryFold, categoryIndex, loadDataset } from '../scripts/lib/data-model.mjs';
import { optionList } from '../site/assets/filter-bar.mjs';

test('spellings that differ only in hyphens, slashes, spacing or case fold to one key', () => {
  assert.equal(categoryFold('Mixed-Culture Brett Beer'), categoryFold('Mixed Culture Brett Beer'));
  assert.equal(categoryFold('No/Low-Tannin Cider'), categoryFold('No/Low Tannin Cider'));
  assert.notEqual(categoryFold('American-Style Pilsener'), categoryFold('American Pilsener'));
});

test('the newest year spelling is the display name', () => {
  const names = canonicalCategoryNames([
    { year: 2024, category_name: 'Mixed-Culture Brett Beer' },
    { year: 2026, category_name: 'Mixed Culture Brett Beer' },
    { year: 2025, category_name: 'Mixed-Culture Brett Beer' },
  ]);
  assert.equal(names.get(categoryFold('Mixed-Culture Brett Beer')), 'Mixed Culture Brett Beer');
});

test('each category has one name, one page address and one filter option across all years', () => {
  const ds = loadDataset();
  const bySlug = new Map();
  for (const r of ds.results) bySlug.set(r.category_slug, (bySlug.get(r.category_slug) ?? new Set()).add(r.category_name));
  assert.deepEqual([...bySlug].filter(([, names]) => names.size > 1).map(([slug]) => slug), []);
  const names = new Set(ds.results.map((r) => r.category_name));
  assert.ok(names.has('Mixed Culture Brett Beer') && !names.has('Mixed-Culture Brett Beer'));
  assert.ok(names.has('No/Low Tannin Cider') && !names.has('No/Low-Tannin Cider'));
  const options = optionList(ds.results, 'category_name', { years: 'all' }).map((o) => o.value);
  assert.equal(options.filter((v) => /brett|tannin/i.test(v) && /mixed|tannin/i.test(v)).length, 2);
  const brett = categoryIndex(ds).find((c) => c.slug === 'mixed-culture-brett-beer');
  assert.deepEqual(brett.years.map((y) => y.year), [2021, 2022, 2023, 2024, 2025, 2026]);
});
