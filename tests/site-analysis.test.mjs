import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryIndex, loadDataset } from '../scripts/lib/data-model.mjs';
import { groupIndicators as staticGroups, oddsItems as staticOdds } from '../site/assets/page-views.mjs';
import { applyFilters } from '../web/lib/filter-model.mjs';
import { about, awardsTable, category, categoryCount, categoryRows, info, legacyCategories, legacyCategory, ownershipTable, reportKey, reportMeta, reportParams, reportRows, scaleTable, streaks } from '../web/lib/models/analysis.mjs';
import { aggregateBreweries, categoryRollup, familySeries, groupIndicators, groupRollup, medalSplit, movers, oddsItems, ownershipRollup, stateRollup, TREND_FAMILIES, yearsInView } from '../web/lib/models/analysis-calc.mjs';
import { estimateFacts, estimateSlugs } from '../web/lib/models/estimates.mjs';
import { categoryParams } from '../web/lib/site-model.mjs';

// The category, report, and About data of the Material app against the dataset and the static site's own views.
const ds = loadDataset();
const cats = categoryIndex(ds);
const view = (rows) => applyFilters(rows, {});

test('every report slug has a copy key and the eight reports are listed once', () => {
  const slugs = reportParams().map((p) => p.slug);
  assert.equal(slugs.length, 8);
  assert.equal(new Set(slugs).size, 8);
  for (const s of slugs) assert.match(reportKey(s), /^[a-z_]+$/);
  assert.equal(reportKey('no-such-report'), null);
});

test('the category index and the category pages cover every category', () => {
  const c = categoryCount();
  assert.equal(c.total, cats.length);
  assert.equal(c.special + c.classic, c.total);
  assert.equal(categoryParams().length, cats.length);
  const rolled = categoryRollup(view(categoryRows()));
  assert.ok(rolled.length > 100 && rolled.length <= cats.length);
  const one = category(cats[0].slug);
  assert.equal(one.name, cats[0].name);
  assert.equal(one.rows.length, cats[0].rows.length);
  assert.equal(category('no-such-category'), null);
});

test('a category without its own description borrows the one filed under the same folded name', () => {
  const described = cats.filter((c) => category(c.slug).description);
  const own = cats.filter((c) => c.ref?.description).length;
  assert.ok(described.length >= own && described.length > 0, `${described.length} described, ${own} with their own description`);
  for (const c of cats) {
    const rec = category(c.slug);
    if (rec.variant) assert.notEqual(rec.variant, rec.name);
    if (rec.abv) assert.ok(Number(rec.abv.min) <= Number(rec.abv.max), rec.name);
  }
});

test('every style reference row keeps its columns: numeric ranges and a family from the site list', () => {
  for (const c of ds.categories) {
    for (const k of ['abv_min', 'abv_max', 'ibu_min', 'ibu_max', 'srm_min', 'srm_max']) assert.ok(c[k] === '' || Number.isFinite(Number(c[k])), `${c.category_name}: ${k} is ${c[k]}`);
    assert.ok(!/^(Brown|Fruit|Amber| and Red|Spice)$/.test(c.style_family), `${c.category_name}: family ${c.style_family}`);
  }
  const brown = category(cats.find((c) => /Brown Ale/.test(c.name) && /American/.test(c.name)).slug);
  assert.deepEqual([brown.abv, brown.ibu, brown.srm].map((r) => `${r.min} to ${r.max}`), ['4.2 to 6.3', '25 to 45', '15 to 26']);
  assert.match(brown.description, /^Brown ale with more hop character/);
});

test('entries per medal and group indicators match the static site', () => {
  const rows = view(reportRows(['category_slug', 'category_number', 'entries', 'category_medals']));
  const mine = oddsItems(rows);
  const theirs = staticOdds(rows, { limit: 1000 });
  assert.deepEqual(mine.list.map((x) => [x.label, x.value, x.entries, x.medals]), theirs.list.map((x) => [x.label, x.value, x.entries, x.medals]));
  const meta = reportMeta();
  const full = { states: meta.states, indicators: { state: meta.indicators } };
  assert.deepEqual(groupIndicators(meta.states, meta.indicators, 'region'), staticGroups(full, 'region'));
  assert.deepEqual(groupIndicators(meta.states, meta.indicators, 'division'), staticGroups(full, 'division'));
});

test('brewery, state, and region totals add up to the medals in view', () => {
  const rows = view(reportRows(['brewery_slug', 'points']));
  const meta = reportMeta();
  const breweries = aggregateBreweries(rows);
  assert.equal(breweries.reduce((n, b) => n + b.medals, 0), rows.length);
  assert.equal(breweries.reduce((n, b) => n + b.points, 0), rows.reduce((n, r) => n + r.points, 0));
  const states = stateRollup(rows, meta.states, meta.indicators, meta.latestComplete);
  assert.equal(states.reduce((n, s) => n + s.medals, 0), rows.length);
  for (const s of states) assert.deepEqual(s.split.reduce((a, b) => a + b, 0), s.medals);
  const regions = groupRollup(rows, 'region', meta.states, meta.indicators, 'unknown');
  assert.equal(regions.reduce((n, r) => n + r.medals, 0), rows.length);
  assert.deepEqual(medalSplit(rows).reduce((a, b) => a + b, 0), rows.length);
});

test('the latest published indicator year is the year before a repeated one', () => {
  const meta = reportMeta();
  assert.ok(meta.dataYear && meta.dataYear <= meta.latestYear);
  assert.equal(meta.dataYear, 2025, 'the reference tables carry 2025 figures for 2026');
});

test('partial years stay out of the years in view unless they are included', () => {
  const meta = reportMeta();
  const partial = meta.years.filter((y) => meta.coverage[y] === 'partial');
  assert.ok(partial.length > 0);
  for (const y of partial) {
    assert.ok(!yearsInView(meta, {}).includes(y));
    assert.ok(yearsInView(meta, { include_partial: 'yes' }).includes(y) || yearsInView(meta, { year: String(y) }).includes(y));
  }
});

test('trends draw the number of families the copy names, plus Other', () => {
  const rows = view(reportRows([]));
  const meta = reportMeta();
  const years = yearsInView(meta, {});
  const series = familySeries(rows, years);
  assert.equal(TREND_FAMILIES, 7);
  assert.equal(series.length, TREND_FAMILIES + 1);
  assert.equal(series.at(-1).family, null);
  assert.equal(series.flatMap((s) => s.data).reduce((a, b) => a + b, 0), rows.filter((r) => years.includes(r.year)).length);
  const m = movers(rows, years, meta.coverage);
  assert.ok(m && m.year > m.previous);
});

test('ownership, awards, and the competition scale come from the dataset', () => {
  const meta = reportMeta();
  const rows = view(reportRows(['parent']));
  const o = ownershipRollup(rows, meta.ownershipKeys);
  assert.ok(o.independent <= rows.length && o.listed >= 0);
  assert.equal(ownershipTable().length, ds.ownership.length);
  assert.equal(awardsTable().rows.length, ds.awards.length);
  assert.ok(scaleTable().length > 0 && scaleTable().every((s) => s.year >= 2000));
  assert.ok(streaks().every((s) => s.streak > 1));
  assert.ok(Object.keys(info()).length > 0);
});

test('About carries one coverage row per loaded year and the estimate figures from the parameters', () => {
  const a = about();
  assert.deepEqual(a.coverage.map((c) => c.year), ds.years);
  assert.equal(a.coverage.reduce((n, c) => n + c.rows, 0), ds.results.length);
  assert.match(a.completeRange, /^\d{4} to \d{4}$/);
  assert.match(a.estimates.taproom, /^\d+ to \d+ percent$/);
});

test('every old category address redirects to a current category and no old address is a current one', () => {
  const { redirects, names } = legacyCategories();
  const current = new Set(cats.map((c) => c.slug));
  assert.equal(redirects.length, 56);
  for (const r of redirects) {
    assert.ok(!current.has(r.oldSlug), r.oldSlug);
    assert.equal(category(r.slug)?.name, r.name);
    assert.equal(legacyCategory(r.oldSlug)?.slug, r.slug);
  }
  assert.equal(legacyCategory('german-style-pilsener')?.name, 'German Pilsener');
  assert.equal(names['German-Style Pilsener'], 'German Pilsener');
  assert.equal(names['Mixed-Culture Brett Beer'], 'Mixed Culture Brett Beer');
});

test('a category lists the beer profiles of its latest medalists in medal order', () => {
  const withCards = cats.map((c) => category(c.slug)).filter((c) => c.cardStems.length > 1);
  assert.ok(withCards.length > 0);
  for (const c of withCards) {
    const medals = c.cardStems.map((stem) => c.rows.find((r) => r.stem === stem).medal);
    const rank = { Gold: 0, Silver: 1, Bronze: 2 };
    assert.deepEqual(medals, [...medals].sort((a, b) => rank[a] - rank[b]), c.name);
    assert.ok(c.rows.filter((r) => r.stem && r.year === 2026).length >= c.cardStems.length);
  }
});

test('every brewery with medals has the facts behind its estimated figures, found by slug', () => {
  const slugs = estimateSlugs();
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(slugs.length, ds.breweries.filter((b) => b.medals.length).length);
  const one = estimateFacts(slugs[0]);
  assert.equal(one.slug, slugs[0]);
  for (const k of ['basis', 'barrels', 'perType', 'locations', 'channel', 'fin', 'revenue']) assert.ok(k in one.facts, k);
  assert.equal(estimateFacts('no-such-brewery'), null);
});
