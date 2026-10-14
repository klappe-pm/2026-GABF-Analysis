import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { parseContent } from '../scripts/lib/content-md.mjs';
import { breweriesIndex, breweryRecord, firstTimeRecord, TREND_YEARS } from '../web/lib/models/breweries.mjs';
import { breweryParams } from '../web/lib/site-model.mjs';

// The breweries lane's build time data (web/lib/models/breweries.mjs) and the copy its pages read.
const slugs = breweryParams().map((p) => p.slug);
const copy = parseContent(readFileSync(resolve(ROOT, '.docs', 'content-management-system', 'pages', 'brewery-detail.md'), 'utf8'));

test('every brewery route has a record, and the index lists every brewery with medals', () => {
  for (const slug of slugs) assert.ok(breweryRecord(slug), slug);
  const { info, rows } = breweriesIndex();
  assert.ok(Object.keys(info).length > 0 && Object.keys(info).length <= slugs.length);
  assert.ok(rows.every((r) => info[r.brewery_key]));
});

test('a brewery type or kitchen the data does not hold stays empty and marks the estimate as assumed', () => {
  const records = slugs.map(breweryRecord);
  const untyped = records.filter((b) => b.type === null);
  assert.ok(untyped.length > 0, 'the record holds breweries without a stated type');
  for (const b of untyped) assert.equal(b.estimate.assumed, true, b.slug);
  for (const b of records.filter((x) => x.type !== null)) assert.equal(b.estimate.assumed, false, b.slug);
  for (const b of records) assert.ok(b.kitchen === null || typeof b.kitchen === 'boolean', b.slug);
});

test('the ten year trend is at most ten years and says when a brewery did not exist yet', () => {
  const records = slugs.map(breweryRecord);
  for (const b of records) assert.ok(b.trend.length > 0 && b.trend.length <= TREND_YEARS, b.slug);
  const young = records.find((b) => b.founded && b.trend.some((t) => t.year < b.founded));
  if (young) assert.ok(young.trend.some((t) => t.status === 'did-not-exist'), young.slug);
});

test('farms the brewery named and farms that grow its hops stay in separate lists', () => {
  const withBoth = slugs.map(breweryRecord).filter((b) => Object.keys(b.namedFarms).length && Object.keys(b.hopFarms).length);
  for (const b of withBoth) {
    for (const name of Object.keys(b.namedFarms)) assert.ok(b.farmSlugs[name], `${b.slug}: ${name}`);
    for (const farms of Object.values(b.hopFarms)) for (const f of farms) assert.ok(b.farmSlugs[f.name], `${b.slug}: ${f.name}`);
  }
});

test('first time medalists count the same breweries as the rows say', () => {
  const r = firstTimeRecord();
  assert.equal(r.newCount, new Set(r.rows.filter((x) => x.first_time === 'new').map((x) => x.brewery_key)).size);
  assert.equal(r.completeCount, new Set(r.rows.filter((x) => x.first_time === 'new-complete').map((x) => x.brewery_key)).size);
  for (const a of r.ambiguous) assert.ok(a.candidates.length > 0, a.name);
});

test('every estimate phrase the pages use exists in the brewery detail copy', () => {
  const source = readFileSync(resolve(ROOT, 'web', 'app', '(site)', 'breweries', 'estimate-text.ts'), 'utf8');
  const used = new Set([...source.matchAll(/\bt\.(\w+)/g)].map((m) => m[1]));
  for (const k of ['barrels_reported', 'barrels_typical', 'arr_computed', 'ebitda', 'inputs', 'mark_label']) used.add(k);
  for (const key of used) assert.equal(typeof copy.estimates[key], 'string', `estimates.${key}`);
  for (const m of ['barrels', 'arr', 'gross_margin', 'ebitda', 'per_barrel', 'per_location', 'per_employee']) assert.equal(typeof copy.estimates[`metric_${m}`], 'string', m);
  for (const key of ['channel_taproom', 'channel_self_distribution', 'channel_distributor', 'channel_default']) assert.equal(typeof copy.estimates[key], 'string', key);
});
