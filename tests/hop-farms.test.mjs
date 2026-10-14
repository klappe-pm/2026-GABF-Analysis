import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCsv, readCsvRecords } from '../scripts/lib/csv.mjs';
import { ROOT } from '../scripts/lib/paths.mjs';

const REF = resolve(ROOT, 'data/reference');
const load = (name) => readFileSync(resolve(REF, name), 'utf8');

const FARM_COLUMNS = ['slug', 'name', 'state', 'city', 'county', 'family_ownership', 'founded', 'generation', 'acreage', 'certifications', 'merchant_affiliation', 'sells_direct', 'variety_source_role', 'notes', 'source_url', 'other_sources', 'county_source', 'verified', 'verification'];
const VARIETY_COLUMNS = ['farm', 'variety_as_published', 'year', 'source_url', 'notes', 'verified', 'verification'];
const MERCHANT_COLUMNS = ['slug', 'name', 'type', 'location', 'ownership', 'processing', 'farms_sourced', 'proprietary_varieties', 'source_url', 'notes', 'verified', 'verification'];
const GAP_COLUMNS = ['topic', 'kind', 'finding', 'sources_checked'];

const farms = readCsvRecords(load('hop-farms.csv'));
const varieties = readCsvRecords(load('hop-farm-varieties.csv'));
const merchants = readCsvRecords(load('hop-merchants.csv'));
const gaps = readCsvRecords(load('hop-farm-gaps.csv'));
const slugs = new Set(farms.map((f) => f.slug));

test('every hop csv has the documented columns and rectangular rows', () => {
  const expected = { 'hop-farms.csv': FARM_COLUMNS, 'hop-farm-varieties.csv': VARIETY_COLUMNS, 'hop-merchants.csv': MERCHANT_COLUMNS, 'hop-farm-gaps.csv': GAP_COLUMNS };
  for (const [file, columns] of Object.entries(expected)) {
    const rows = parseCsv(load(file)).filter((r) => r.length > 1 || r[0] !== '');
    assert.deepEqual(rows[0], columns, `${file} header`);
    for (const row of rows) assert.equal(row.length, columns.length, `${file} row ${row[0]} has ${row.length} cells`);
  }
});

test('farm slugs are unique kebab-case and every farm has a source url', () => {
  assert.equal(slugs.size, farms.length, 'duplicate farm slug');
  for (const farm of farms) {
    assert.match(farm.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, farm.slug);
    assert.ok(farm.name, `${farm.slug} name`);
    assert.match(farm.state, /^([A-Z]{2}|unstated)$/, `${farm.slug} state`);
    assert.match(farm.source_url, /^https?:\/\//, `${farm.slug} source_url`);
  }
});

test('every farm variety row references an existing farm and carries a source', () => {
  assert.ok(varieties.length > 0);
  for (const row of varieties) {
    assert.ok(slugs.has(row.farm), `unknown farm ${row.farm}`);
    assert.ok(row.variety_as_published, `${row.farm} variety`);
    assert.match(row.year, /^(current|\d{4})$/, `${row.farm} ${row.variety_as_published} year`);
    assert.match(row.source_url, /^https?:\/\//, `${row.farm} ${row.variety_as_published} source_url`);
  }
});

test('merchants carry a source and reference existing farms', () => {
  const merchantSlugs = new Set(merchants.map((m) => m.slug));
  assert.equal(merchantSlugs.size, merchants.length);
  for (const merchant of merchants) {
    assert.match(merchant.source_url, /^https?:\/\//, `${merchant.slug} source_url`);
    for (const farm of merchant.farms_sourced.split(';').map((s) => s.trim()).filter(Boolean)) {
      assert.ok(slugs.has(farm), `${merchant.slug} sources unknown farm ${farm}`);
    }
  }
});

test('every farm, variety and merchant row sets verified to yes or no and gives a reason', () => {
  for (const [file, rows] of [['hop-farms.csv', farms], ['hop-farm-varieties.csv', varieties], ['hop-merchants.csv', merchants]]) {
    for (const row of rows) {
      const id = row.slug ?? `${row.farm} ${row.variety_as_published}`;
      assert.match(row.verified, /^(yes|no)$/, `${file} ${id} verified`);
      assert.ok(row.verification, `${file} ${id} verification`);
    }
  }
});

test('a county is marked as derived or stated', () => {
  for (const farm of farms) {
    if (farm.county) assert.match(farm.county_source, /^(looked up from city|stated by source)$/, `${farm.slug} county_source`);
    else assert.equal(farm.county_source, '', `${farm.slug} county_source without a county`);
  }
});

test('gap rows name the sources that were checked', () => {
  assert.ok(gaps.length > 0);
  for (const gap of gaps) {
    assert.ok(gap.finding, gap.topic);
    assert.ok(gap.sources_checked, `${gap.topic} sources_checked`);
  }
});

test('each farm has a page and the farm overview exists', () => {
  assert.ok(existsSync(resolve(ROOT, 'docs/hops/farms/README.md')));
  for (const farm of farms) assert.ok(existsSync(resolve(ROOT, 'docs/hops/farms', `${farm.slug}.md`)), `${farm.slug}.md`);
});

test('no dash used as punctuation in hop csv text', () => {
  const dash = new RegExp('[\\u2013\\u2014]| - |--');
  for (const file of ['hop-farms.csv', 'hop-farm-varieties.csv', 'hop-merchants.csv', 'hop-farm-gaps.csv']) {
    const text = load(file).replace(/https?:\/\/\S+/g, '');
    assert.doesNotMatch(text, dash, file);
  }
});
