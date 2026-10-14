import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDataset } from '../scripts/lib/data-model.mjs';
import { hopFarmParams, hopParams, WINNER_YEAR } from '../web/lib/site-model.mjs';
import { beerHopProfile, hop, hopFarm, hopFarmsIndex, hopsIndex, winnerRows } from '../web/lib/models/hops.mjs';

// The hops lane's build time data (web/lib/models/hops.mjs) against the hop model the Node pipeline builds.
const ds = loadDataset();
const model = ds.hops;

test('the hops index lists every variety once, with counts that match the model', () => {
  const index = hopsIndex();
  assert.equal(index.year, WINNER_YEAR);
  assert.equal(index.varieties.length, model.varieties.length);
  assert.equal(new Set(index.varieties.map((v) => v.slug)).size, index.varieties.length);
  assert.equal(index.farmCount, model.farms.length);
  assert.equal(index.used, model.varieties.filter((v) => v.counts.medals > 0).length);
  const medals = index.varieties.map((v) => v.medals);
  assert.deepEqual(medals, [...medals].sort((a, b) => b - a), 'most medals first');
  for (const v of index.varieties) assert.equal(v.gold + v.silver + v.bronze, v.medals, v.name);
});

test('every hop page address has a record, and no other address does', () => {
  for (const { slug } of hopParams()) assert.ok(hop(slug), slug);
  assert.equal(hop('no-such-hop'), null);
  for (const { slug } of hopFarmParams()) assert.ok(hopFarm(slug), slug);
  assert.equal(hopFarm('no-such-farm'), null);
});

test('a variety record carries its card, data, acreage trend, beers, and farms', () => {
  const v = hop('citra');
  assert.equal(v.name, 'Citra');
  assert.ok(v.aroma.descriptors.length, 'aroma descriptors');
  assert.ok(v.alpha && v.alpha.min <= v.alpha.max, 'alpha range');
  assert.ok(v.data.length, 'variety data rows');
  assert.ok(!v.data.some((d) => d.key === 'slug' || /_(min|max)$/.test(d.key) && v.data.some((x) => x.key === d.key.replace(/_(min|max)$/, ''))), 'a range is one row and the slug is not shown');
  assert.ok(v.data.some((d) => d.max !== undefined), 'a minimum and maximum read as one range');
  assert.equal(v.beerRows.length, v.counts.medals);
  assert.ok(v.acreageByState.trend.years.length >= 2, 'acreage trend has years');
  assert.ok(v.acreageByState.trend.series.length >= 2, 'one line per state');
  for (const line of v.acreageByState.trend.series) assert.equal(line.values.length, v.acreageByState.trend.years.length, line.state);
  assert.deepEqual(v.acreageByState.trend.years, [...v.acreageByState.trend.years].sort((a, b) => a - b));
  assert.equal(v.farmRows.length, v.counts.farms);
  assert.ok(v.notesHtml, 'the research notes render');
});

test('the medal beers of a variety list gold first, and a farm shows only when the brewery named it', () => {
  const rank = { Gold: 1, Silver: 2, Bronze: 3 };
  for (const { slug } of hopParams()) {
    const { beerRows: beers } = hop(slug);
    const ranks = beers.map((b) => rank[b.medal]);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), slug);
  }
  const named = hopParams().flatMap(({ slug }) => hop(slug).beerRows).filter((b) => b.farms.length);
  for (const b of named) {
    const f = hopFarm(b.farms[0].slug);
    assert.ok(f.named.some((x) => x.stem === b.stem), `${b.beer}: a named farm lists the beer as named`);
  }
});

test('named and grown farm links stay apart', () => {
  for (const { slug } of hopFarmParams()) {
    const f = hopFarm(slug);
    const model = ds.hops.farmBySlug.get(slug);
    assert.equal(f.named.length, model.named.size, `${slug} named`);
    assert.equal(f.grown.length, model.grown.size, `${slug} grown`);
    for (const g of f.grown) assert.ok(g.hops.length, `${slug}: a grown beer names the hop that links it`);
    for (const n of f.named) assert.ok(n.published.length, `${slug}: a named beer shows what the brewery published`);
  }
});

test('the farms index groups every farm under one state, states first and the unstated last', () => {
  const index = hopFarmsIndex();
  assert.equal(index.states.reduce((n, s) => n + s.farms.length, 0), model.farms.length);
  const unstated = index.states.findIndex((s) => !s.code);
  if (unstated >= 0) assert.equal(unstated, index.states.length - 1);
  const names = index.states.filter((s) => s.name).map((s) => s.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.ok(index.merchants && index.merchants.columns.length && index.merchants.rows.length, 'merchants table');
  assert.ok(index.gaps && index.gaps.rows.length, 'gaps table');
  for (const col of index.merchants.columns) assert.ok(!col.label.includes('_'), `column label ${col.label}`);
});

test('a multi link source cell becomes one source per link', () => {
  const f = hopFarm('perrault-farms');
  const row = f.sourceRows.find((r) => r.sources.length > 1);
  assert.ok(row, 'a source cell with several links');
  for (const r of f.sourceRows) for (const s of r.sources) assert.ok(!s.url || !s.url.includes('|'), s.url);
});

test('a beer hop profile lists its hops, the farms that grow them, and its brewing details', () => {
  const stem = [...model.beers.values()].find((b) => b.usage.length > 1 && b.details.length)?.stem;
  assert.ok(stem);
  const p = beerHopProfile(stem);
  const slugs = new Set(hopParams().map((x) => x.slug));
  assert.ok(p.usage.length > 1);
  for (const u of p.usage) assert.ok(slugs.has(u.hop.slug), u.hop.name);
  assert.equal(p.cards.length, new Set(p.usage.map((u) => u.hop.slug)).size, 'one card per hop');
  for (const g of p.grown) assert.ok(g.farms.length, g.hop.name);
  assert.ok(p.details.length);
  for (const d of p.details) assert.match(d.key, /^[a-z_]+$/);
  assert.equal(beerHopProfile('no-such-beer'), null);
});

test('the winners list adds whether the brewery publishes a page for each beer', () => {
  const rows = winnerRows();
  assert.equal(rows.length, ds.results.filter((r) => r.year === WINNER_YEAR).length);
  const withPage = rows.filter((r) => r.beerPage);
  assert.ok(withPage.length > 0 && withPage.length < rows.length);
  assert.ok(withPage.every((r) => r.stem), 'only a profiled beer can have a brewery page on record');
  assert.ok(rows.some((r) => r.ibu !== null) && rows.some((r) => r.hops.length));
});

test('a variety record is also a hop card: the card fields keep the card shape', () => {
  for (const { slug } of hopParams()) {
    const h = hop(slug);
    assert.equal(typeof h.beers, 'number', `${slug} beers`);
    assert.ok(h.acreage === null || typeof h.acreage.acres === 'number', `${slug} acreage`);
    assert.ok(Array.isArray(h.farms), `${slug} farms`);
  }
});

test('a beer listed on a hop page carries its filter fields and its profile card record', () => {
  for (const { slug } of hopParams()) {
    for (const b of hop(slug).beerRows) {
      assert.equal(b.filter.stem, b.stem, `${slug}: ${b.beer} filter row`);
      assert.equal(b.filter.medal, b.medal);
      assert.ok(b.card.beer && !('notesHtml' in b.card), `${slug}: ${b.beer} card`);
    }
  }
  for (const { slug } of hopFarmParams()) {
    const f = hopFarm(slug);
    for (const b of [...f.named, ...f.grown]) assert.ok(b.filter && b.card, `${slug}: ${b.beer}`);
  }
});
