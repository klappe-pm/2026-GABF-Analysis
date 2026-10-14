import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { ROOT } from '../scripts/lib/paths.mjs';
import { BREWERY_ATTRIBUTES, breweryAttributeLookup, loadDataset } from '../scripts/lib/data-model.mjs';
import { attributeFields } from '../scripts/build-explorer.mjs';
import { enrichResults } from '../scripts/build-site.mjs';
import { applyFilters, FILTERS, NOT_DEFINED, optionList, pruneState, valueLabel } from '../site/assets/filter-bar.mjs';

const read = (f) => readFileSync(resolve(ROOT, f), 'utf8');
const dataOf = (html) => JSON.parse(html.match(/<script type="application\/json" id="dataset">([\s\S]*?)<\/script>/)[1]);
const FILES = ['gabf-explorer.html', 'site/explorer/gabf-explorer-prototype.html'];
const datasets = FILES.map((f) => ({ file: f, html: read(f), data: dataOf(read(f)) }));
// The same data the committed files are built from: no git-ignored local deep dives.
const ds = loadDataset({ localProfiles: false });
const lookup = breweryAttributeLookup(ds);
const expected = (record) => attributeFields(lookup({ brewery_name: record.brewery, state: record.state }));

test('no explorer record carries a brewery type that the data model does not', () => {
  const modelTypes = new Set(ds.breweries.map((b) => b.brewery_type).filter(Boolean));
  for (const { file, data } of datasets) {
    for (const r of data.records) {
      const model = expected(r).brewery_type;
      assert.equal(r.brewery_type, model, `${file}: ${r.award_id} ${r.brewery}`);
      if (r.brewery_type) assert.ok(modelTypes.has(r.brewery_type), `${file}: ${r.brewery_type} is not a data model type`);
    }
    // A brewery with no sourced type is blank, never a default.
    const blank = data.records.filter((r) => !r.brewery_type);
    assert.ok(blank.length > 0, `${file}: some records have no sourced type`);
    for (const r of blank) assert.equal(lookup({ brewery_name: r.brewery, state: r.state }).brewery_type, null, r.brewery);
  }
});

test('the explorer and the data model agree on every brewery attribute of every record', () => {
  assert.deepEqual(BREWERY_ATTRIBUTES, ['brewery_type', 'ownership_type', 'investors', 'distribution_channel', 'has_kitchen', 'region']);
  for (const { file, data } of datasets) {
    for (const r of data.records) {
      const model = expected(r);
      for (const [k, v] of Object.entries(model)) assert.equal(r[k], v, `${file}: ${r.award_id} ${k}`);
    }
  }
});

test('the explorer and the site read the same brewery attributes for every medal row', () => {
  enrichResults(ds);
  const { data } = datasets[0];
  const byAward = new Map(data.records.map((r) => [`${r.year}|${r.brewery}|${r.beer}|${r.medal}`, r]));
  let compared = 0;
  for (const row of ds.results) {
    const rec = byAward.get(`${row.year}|${row.brewery_name}|${row.beer_name}|${row.medal}`);
    if (!rec) continue;
    compared += 1;
    assert.equal(rec.brewery_type, row.brewery_type, `${row.brewery_name} type`);
    assert.equal(rec.ownership_type || 'unlisted', row.ownership_type, `${row.brewery_name} ownership`);
    assert.equal(rec.distribution_channel || 'unknown', row.distribution_channel, `${row.brewery_name} distribution`);
    assert.equal(rec.region, row.region, `${row.brewery_name} region`);
  }
  assert.ok(compared > 1800, `compared ${compared} rows`);
});

test('a kitchen is stated only where a source says so', () => {
  for (const b of ds.breweries) if (b.has_kitchen !== null) assert.ok(b.has_kitchen === true || b.has_kitchen === false);
  const facts = read('data/reference/brewery-facts.csv');
  assert.ok(ds.breweries.filter((b) => b.has_kitchen === true).length <= (facts.match(/,yes,/g) ?? []).length + 1);
});

// The explorer's own script, run on its own embedded rows: normalize, the filter match, and the option bucket.
function explorerScript(html) {
  const start = html.indexOf('<script>const UNKNOWN') + '<script>'.length;
  const end = html.indexOf('let db=JSON.parse', start);
  const ctx = vm.createContext({ document: { querySelector: () => null, querySelectorAll: () => [] }, localStorage: {}, history: {}, location: { hash: '' } });
  vm.runInContext(`${html.slice(start, end)}\nvar db=null;`, ctx);
  return ctx;
}

test('the explorer lists Not Found as an option on every filter, with the rows that hold no value', () => {
  for (const { file, html, data } of datasets) {
    const ctx = explorerScript(html);
    ctx.db = data;
    const rows = vm.runInContext('normalize(db.records)', ctx);
    assert.equal(vm.runInContext('UNKNOWN', ctx), 'Not Found', file);
    const filters = ['year', 'medal', 'state', 'style_family', 'official_category', 'brewery', 'city', 'competition_section', 'beverage', 'fermentation', 'fed_district_name', 'metro_area', 'region', 'ownership', 'investors', 'brewery_type', 'distribution', 'kitchen', 'association', 'hops', 'hop_clues'];
    const built = html.match(/function buildFilters\(\)\{const primary=\[(.*?)\];const advanced=\[(.*?)\];/);
    const listed = [...built[1].matchAll(/'(\w+)'/g), ...built[2].matchAll(/'(\w+)'/g)].map((m) => m[1]);
    assert.deepEqual(listed, filters, `${file}: the filter list`);
    for (const f of filters) {
      const blank = rows.filter((r) => !String(r[f] ?? '').trim()).length;
      const chosen = rows.filter((r) => vm.runInContext('matches', ctx)(r, { [f]: ['Not Found'] }, '', '')).length;
      assert.equal(chosen, blank, `${file}: ${f} Not Found count`);
    }
    // The type, ownership, distribution and kitchen buckets are never empty for this data, so the owner can find the gaps.
    for (const f of ['brewery_type', 'ownership', 'distribution', 'kitchen']) {
      assert.ok(rows.some((r) => !r[f]) && rows.some((r) => r[f]), `${file}: ${f} has both defined and Not Found rows`);
    }
    // Progressive: the count of an option follows the other selections.
    const matches = vm.runInContext('matches', ctx);
    const within = rows.filter((r) => matches(r, { year: ['2026'] }, '', ''));
    const typed = within.filter((r) => matches(r, { year: ['2026'], brewery_type: ['Not Found'] }, '', ''));
    assert.equal(typed.length, within.filter((r) => !r.brewery_type).length, `${file}: Not Found under a year`);
    for (const fn of ['filterControl', 'syncFilters', 'matches', 'aggregate']) assert.match(html, new RegExp(`function ${fn}\\([\\s\\S]*?\\|\\|UNKNOWN`), `${file}: ${fn} buckets blanks as Not Found`);
  }
});

test('the site lists Not Found on every filter with the right count, and it filters to those rows', () => {
  enrichResults(ds);
  const rows = ds.results;
  const state = { years: 'all' };
  for (const def of FILTERS) {
    const blank = applyFilters(rows, state).filter((r) => (def.multi ? !(r[def.field] ?? []).length : !String(r[def.id] ?? '').trim() || r[def.id] === { ownership_type: 'unlisted', distribution_channel: 'unknown' }[def.id])).length;
    const opt = optionList(rows, def.id, state).find((o) => o.value === NOT_DEFINED);
    if (!blank) { assert.equal(opt, undefined, `${def.id}: no option when nothing is missing`); continue; }
    assert.ok(opt, `${def.id}: Not Found option`);
    assert.equal(opt.label, 'Not Found');
    assert.equal(opt.count, blank, `${def.id}: count`);
    assert.equal(applyFilters(rows, { ...state, [def.id]: NOT_DEFINED }).length, blank, `${def.id}: rows it selects`);
  }
  for (const id of ['brewery_type', 'ownership_type', 'distribution_channel', 'hop_variety']) {
    assert.ok(optionList(rows, id, state).some((o) => o.value === NOT_DEFINED), `${id} lists Not Found`);
  }
});

test('Not Found follows the progressive rules and the one sort order, and the older gap tokens fold into it', () => {
  enrichResults(ds);
  const rows = ds.results;
  const all = optionList(rows, 'ownership_type', { years: 'all' });
  assert.equal(all.filter((o) => o.label === 'Not Found').length, 1, 'one Not Found option, not two');
  const labels = all.map((o) => o.label);
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })), 'sorted with the others');
  const picked = { years: 'all', brewery_type: 'micro' };
  const n = applyFilters(rows, { ...picked, ownership_type: NOT_DEFINED }).length;
  assert.equal(optionList(rows, 'ownership_type', picked).find((o) => o.value === NOT_DEFINED)?.count ?? 0, n, 'count under another selection');
  for (const o of optionList(rows, 'ownership_type', picked)) assert.ok(o.count > 0);
  assert.equal(applyFilters(rows, { years: 'all', ownership_type: 'unlisted' }).length, applyFilters(rows, { years: 'all', ownership_type: NOT_DEFINED }).length, 'a saved link with the older token still works');
  assert.deepEqual(pruneState(rows, { years: 'all', ownership_type: 'unlisted' }), { years: 'all', ownership_type: 'unlisted' });
  assert.equal(valueLabel('city', NOT_DEFINED), 'Not Found');
});
