import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { readCsvRecords } from '../scripts/lib/csv.mjs';
import { beerDetailsHtml } from '../scripts/lib/catalog-attribution.mjs';
import { buildDataset, loadResultRows } from '../scripts/build-explorer.mjs';

const RESULTS = resolve(ROOT, 'data', 'results');
const LINE = 'Some beer details are from Catalog.beer, licensed CC BY 4.0 and adapted.';
const dataOf = (html) => JSON.parse(html.match(/<script type="application\/json" id="dataset">([\s\S]*?)<\/script>/)[1]);
const explorer = readFileSync(resolve(ROOT, 'gabf-explorer.html'), 'utf8');
const prototype = readFileSync(resolve(ROOT, 'site/explorer/gabf-explorer-prototype.html'), 'utf8');

const csvYears = readdirSync(RESULTS).filter((f) => /^gabf-\d{4}\.csv$/.test(f)).map((f) => ({
  year: f.slice(5, 9),
  rows: readCsvRecords(readFileSync(resolve(RESULTS, f), 'utf8')),
}));

test('the explorer data holds every year in data/results, row for row', () => {
  assert.ok(csvYears.length >= 8);
  for (const html of [explorer, prototype]) {
    const data = dataOf(html);
    for (const { year, rows } of csvYears) {
      assert.equal(data.records.filter((r) => r.year === year).length, rows.length, `${year} row count`);
      assert.ok(data.target_years.includes(Number(year)), `${year} is a target year`);
    }
    assert.equal(new Set(data.records.map((r) => r.award_id)).size, data.records.length, 'award ids are unique');
  }
});

test('partial years are labeled partial and complete years are not', () => {
  const { year_status: status } = dataOf(explorer);
  for (const { year, rows } of csvYears) {
    const partial = rows.some((r) => /partial seed|transcript draft/i.test(r.notes ?? ''));
    assert.equal(status[year].status, partial ? 'partial' : 'complete', year);
  }
  assert.equal(status[2018].status, 'partial');
  assert.equal(status[2019].status, 'partial');
});

test('only the research year carries specs; earlier years are medal rows', () => {
  const data = dataOf(explorer);
  assert.deepEqual(data.spec_years, [2026]);
  assert.ok(data.records.some((r) => r.year === '2026' && r.abv), '2026 keeps its profile detail');
  assert.ok(data.records.filter((r) => r.year !== '2026').every((r) => !r.abv && !r.ibu), 'no specs before 2026');
});

test('the dataset builder is deterministic and keeps known award ids', () => {
  const rows = loadResultRows();
  const first = buildDataset(rows, []);
  const again = buildDataset(rows, first.records);
  assert.deepEqual(again.records, first.records);
});

test('the explorer footer carries the Catalog.beer line with both links', () => {
  for (const html of [explorer, prototype]) {
    const footer = html.match(/<footer class="main-footer">[\s\S]*?<\/footer>/)[0];
    assert.equal(footer.replace(/<[^>]+>/g, '').includes(LINE), true, 'exact wording');
    assert.ok(footer.includes('<a href="https://catalog.beer"'), 'Catalog.beer link');
    assert.ok(footer.includes('<a href="https://creativecommons.org/licenses/by/4.0/"'), 'license link');
  }
  assert.equal(beerDetailsHtml().replace(/<[^>]+>/g, ''), LINE);
});

test('the explorer page states that earlier years have no specs', () => {
  assert.match(prototype, /carry medal rows only, without specs/);
  assert.match(prototype, /partial: only the rows found so far/);
});

test('the chart gallery footer draws the same Catalog.beer line', () => {
  const gallery = readFileSync(resolve(ROOT, 'docs/design/chart-gallery/index.html'), 'utf8');
  assert.ok(gallery.includes('D.beerDetailsHtml'));
  assert.ok(gallery.includes('Some beer details are from'));
  assert.ok(gallery.includes('https://catalog.beer'));
  assert.ok(gallery.includes('https://creativecommons.org/licenses/by/4.0/'));
});
