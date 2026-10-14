import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { categoryIndex, loadDataset } from '../scripts/lib/data-model.mjs';
import {
  beer, beerParams, breweryParams, categoryParams, counts, filterData, hopFarmParams, hopParams, medalRows, notesHtml, winners, WINNER_YEAR,
} from '../web/lib/site-model.mjs';

// The Material app's build time data (web/lib/site-model.mjs) against the dataset the Node pipeline loads.
const ds = loadDataset();
const cats = categoryIndex(ds);
const profiles = readdirSync(resolve(ROOT, 'docs', String(WINNER_YEAR), 'winner')).filter((f) => /^\d{3}-.*\.md$/.test(f));

const unique = (list) => new Set(list).size === list.length;
const slugShape = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

test('generateStaticParams emits one page per record in the dataset', () => {
  assert.equal(breweryParams().length, ds.breweries.length);
  assert.equal(categoryParams().length, cats.length);
  assert.equal(beerParams().length, profiles.length);
  assert.equal(hopParams().length, ds.hops.varieties.length);
  assert.equal(hopFarmParams().length, ds.hops.farms.length);
  const c = counts();
  assert.deepEqual([c.breweries, c.categories, c.beers, c.hops, c.hopFarms, c.results], [ds.breweries.length, cats.length, profiles.length, ds.hops.varieties.length, ds.hops.farms.length, ds.results.length]);
  // The record the site is built from today; a new year of results changes these on purpose.
  assert.ok(c.breweries >= 947, `${c.breweries} breweries`);
  assert.ok(c.beers >= 336, `${c.beers} beers`);
  assert.ok(c.categories >= 175, `${c.categories} categories`);
});

test('every dynamic route param is unique and URL safe', () => {
  for (const [name, list] of Object.entries({ breweries: breweryParams().map((p) => p.slug), categories: categoryParams().map((p) => p.slug), hops: hopParams().map((p) => p.slug), farms: hopFarmParams().map((p) => p.slug), beers: beerParams().map((p) => p.stem) })) {
    assert.ok(unique(list), `${name}: duplicate params`);
    for (const s of list) assert.match(s, slugShape, `${name}: ${s}`);
  }
  assert.ok(beerParams().every((p) => p.year === String(WINNER_YEAR)));
});

test('params match the paths the current site publishes', () => {
  const stems = new Set(beerParams().map((p) => p.stem));
  for (const f of profiles) assert.ok(stems.has(f.replace(/\.md$/, '')), f);
  const slugs = new Set(breweryParams().map((p) => p.slug));
  for (const r of ds.results) assert.ok(slugs.has(r.brewery_slug) || ds.breweries.some((b) => b.key === r.brewery_key && slugs.has(b.slug)), r.brewery_name);
});

test('the winners list carries every medal of the year with its specs and hop links', () => {
  const rows = winners();
  assert.equal(rows.length, ds.results.filter((r) => r.year === WINNER_YEAR).length);
  const withProfile = rows.filter((r) => r.stem);
  assert.equal(withProfile.length, profiles.length, 'every 2026 profile matches a medal row');
  const hopSlugs = new Set(hopParams().map((p) => p.slug));
  for (const r of rows) for (const h of r.hops) assert.ok(hopSlugs.has(h.slug), `${r.beer_name}: hop ${h.name} links to a hop page that is not built`);
  assert.ok(rows.some((r) => r.hops.length), 'some winners name hops');
  // Filter fields stay on each row.
  for (const k of ['medal', 'category_type', 'style_family', 'state', 'brewery_key', 'ownership_type', 'partial']) assert.ok(k in rows[0], k);
});

test('a beer record holds its specs, its links, and its notes as HTML', () => {
  const stem = beerParams()[0].stem;
  const b = beer(stem);
  assert.ok(b);
  assert.equal(b.stem, stem);
  assert.ok(['Gold', 'Silver', 'Bronze'].includes(b.medal));
  assert.ok(b.brewerySlug && breweryParams().some((p) => p.slug === b.brewerySlug), 'brewery page exists');
  assert.ok(b.categorySlug && categoryParams().some((p) => p.slug === b.categorySlug), 'category page exists');
  assert.ok(b.notesHtml.includes('<h3'), 'notes render, one level under the page section');
  assert.ok(!/<h[2-6][^>]*>[a-z0-9]+(?:-[a-z0-9]+)+<\/h/.test(b.notesHtml), 'no kebab headings');
  assert.equal(beer('no-such-beer'), null);
});

test('research note tables scroll in their own box', () => {
  const html = notesHtml('# t\n\n## specs\n\n| a | b |\n|---|---|\n| 1 | 2 |\n');
  assert.match(html, /data-table-scroll=""/);
  assert.match(html, /<h3>Specs<\/h3>/);
});

test('scoped medal rows and the filter payload come from the same rows', () => {
  const all = filterData().results;
  assert.equal(all.length, ds.results.length);
  assert.equal(medalRows({ year: String(WINNER_YEAR) }).length, all.filter((r) => r.year === WINNER_YEAR).length);
  const key = ds.breweries[0].key;
  assert.equal(medalRows({ brewery_key: key }).length, ds.breweries[0].medals.length);
});
