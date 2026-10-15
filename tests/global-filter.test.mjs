import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeChips, applyFilters, dimensionLabel, FILTER_COPY_KEYS, FILTERS, groupLabel, hashFor, isDefaultState, optionList, parseHash, pickState, readStored, resolveState, scopeRows, STORAGE_KEY, unslugText, valueLabel, viewRows, writeStored } from '../site/assets/filter-bar.mjs';
import { loadSiteCopy } from '../scripts/lib/site-copy.mjs';
import { ambiguousFirstTimers, firstTimeStatus } from '../scripts/lib/first-time.mjs';
import { oddsItems } from '../site/assets/page-views.mjs';

const rows = [
  { year: 2018, medal: 'Gold', state: 'CO', brewery_key: 'a', category_name: 'Lager', style_family: 'Lager', partial: true, beer_name: 'A1', brewery_name: 'Alpha', city: 'Denver' },
  { year: 2024, medal: 'Silver', state: 'CO', brewery_key: 'a', category_name: 'Lager', style_family: 'Lager', partial: false, beer_name: 'A2', brewery_name: 'Alpha', city: 'Denver' },
  { year: 2026, medal: 'Gold', state: 'CA', brewery_key: 'b', category_name: 'IPA', style_family: 'IPA', partial: false, beer_name: 'Hop Thing', brewery_name: 'Beta', city: 'San Diego', search_extra: 'Citra Mosaic' },
  { year: 2026, medal: 'Bronze', state: 'CO', brewery_key: 'a', category_name: 'IPA', style_family: 'IPA', partial: false, beer_name: 'A3', brewery_name: 'Alpha', city: 'Denver' },
];

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

test('the URL wins over storage when it carries a filter key', () => {
  assert.deepEqual(resolveState({ state: 'CO' }, { medal: 'Gold' }), { state: 'CO' });
});

test('a hash with only page keys (tab, brewery) keeps the stored selection', () => {
  assert.deepEqual(resolveState({ tab: 'geography', brewery: 'a' }, { medal: 'Gold' }), { medal: 'Gold' });
  assert.deepEqual(pickState({ tab: 'x', brewery: 'a', year: 2024, years: 'nope' }), { year: '2024' });
});

test('state round trips through storage and the hash; a throwing storage falls back to the hash', () => {
  const s = memoryStorage();
  writeStored(s, { medal: 'Gold', tab: 'overview', q: 'hazy' });
  assert.deepEqual(JSON.parse(s.data[STORAGE_KEY]), { medal: 'Gold', q: 'hazy' });
  assert.deepEqual(readStored(s), { medal: 'Gold', q: 'hazy' });
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(readStored(broken), null);
  assert.doesNotThrow(() => writeStored(broken, { medal: 'Gold' }));
  assert.deepEqual(resolveState(parseHash('#state=CO'), readStored(broken)), { state: 'CO' });
  assert.deepEqual(parseHash(hashFor({ tab: 'data', category_name: 'Fruit & Spice' })), { tab: 'data', category_name: 'Fruit & Spice' });
});

test('complete years are the default; partial years need a picked year or years=all', () => {
  assert.equal(isDefaultState({ tab: 'x' }), true);
  assert.deepEqual(applyFilters(rows, {}).map((r) => r.beer_name), ['A2', 'Hop Thing', 'A3']);
  assert.deepEqual(applyFilters(rows, { year: '2018' }).map((r) => r.beer_name), ['A1']);
  assert.equal(applyFilters(rows, { years: 'all' }).length, 4);
});

test('page scope is applied first and combined with the global filter', () => {
  assert.equal(scopeRows(rows, { brewery_key: 'a' }).length, 3);
  assert.deepEqual(viewRows(rows, { brewery_key: 'a' }, { medal: 'Bronze' }).map((r) => r.beer_name), ['A3']);
  assert.deepEqual(viewRows(rows, { year: '2026' }, { state: 'CO' }).map((r) => r.beer_name), ['A3']);
  assert.deepEqual(applyFilters(rows, { q: 'mosaic' }).map((r) => r.beer_name), ['Hop Thing']);
});

test('option counts follow the page scope and the partial year rule', () => {
  const scope = scopeRows(rows, { brewery_key: 'a' });
  assert.deepEqual(optionList(scope, 'year', {}).map((o) => [o.value, o.count]), [['2026', 1], ['2024', 1], ['2018', 1]]);
  assert.deepEqual(optionList(scope, 'medal', {}).map((o) => [o.value, o.count]), [['Bronze', 1], ['Silver', 1]]);
});

test('chips and option labels read as words, never slugs', () => {
  assert.equal(valueLabel('ownership_type', 'beverage-conglomerate-owned'), 'Beverage Conglomerate Owned');
  assert.equal(valueLabel('distribution_channel', 'self-distribution'), 'Self Distributed');
  assert.equal(valueLabel('abv_band', '6-to-7'), '6 to 7%');
  assert.equal(valueLabel('brewery_type', 'some-new-type'), 'Some New Type');
  assert.deepEqual(activeChips({ ownership_type: 'unlisted', years: 'all' }).map((c) => c.text), ['Ownership: Not Found', 'Partial Years Included']);
  assert.equal(unslugText('<p>a did-not-exist year</p><code>did-not-exist</code><a href="/x/did-not-exist">link</a>', ['did-not-exist']), '<p>a did not exist year</p><code>did-not-exist</code><a href="/x/did-not-exist">link</a>');
});

test('first time medalists are keyed by brewery and separate partial year history', () => {
  const results = [
    { year: 2018, brewery_key: 'old partial', brewery_name: 'Old Partial', city: 'X', state: 'CO' },
    { year: 2024, brewery_key: 'veteran', brewery_name: 'Veteran', city: 'Y', state: 'CA' },
    { year: 2026, brewery_key: 'old partial', brewery_name: 'Old Partial', city: 'X', state: 'CO' },
    { year: 2026, brewery_key: 'veteran', brewery_name: 'Veteran (Costa Mesa)', city: 'Y', state: 'CA' },
    { year: 2026, brewery_key: 'brand new', brewery_name: 'Brand New', city: 'Z', state: 'TX' },
    { year: 2026, brewery_key: 'veteran annex', brewery_name: 'Veteran Annex', city: 'Y', state: 'CA' },
    { year: 2022, brewery_key: 'wbc only', brewery_name: 'WBC Only', city: 'Q', state: 'OR', competition: 'World Beer Cup' },
    { year: 2026, brewery_key: 'wbc only', brewery_name: 'WBC Only', city: 'Q', state: 'OR' },
  ];
  const status = firstTimeStatus(results, { year: 2026, partialYears: [2018, 2019] });
  assert.equal(status.get('brand new'), 'new');
  assert.equal(status.get('old partial'), 'new-complete');
  assert.equal(status.has('veteran'), false);
  assert.equal(status.get('wbc only'), 'new', 'other competitions do not count as an earlier GABF medal');
  const ambiguous = ambiguousFirstTimers(results, status, 2026);
  assert.deepEqual(ambiguous.map((a) => [a.key, a.candidates.map((c) => c.key)]), [['veteran annex', ['veteran']]]);
});

test('entries per medal pools years and leaves out rows without entry counts', () => {
  const odds = oddsItems([
    { year: 2025, category_name: 'IPA', entries: 300, category_medals: 3 },
    { year: 2025, category_name: 'IPA', entries: 300, category_medals: 3 },
    { year: 2026, category_name: 'IPA', entries: 150, category_medals: 3 },
    { year: 2026, category_name: 'Lager', entries: 30, category_medals: 3 },
    { year: 2026, category_name: 'Mystery', entries: null, category_medals: 3 },
  ]);
  assert.deepEqual(odds.list.map((o) => [o.label, o.value]), [['IPA', 75], ['Lager', 10]]);
  assert.match(odds.note, /1 medal in view has no published entry count/);
});

test('the filter labels come from the copy documents, so an edit reaches both sites', () => {
  const copy = loadSiteCopy();
  // Every dimension and group the filter draws has a copy entry (the build stops on a missing one).
  for (const [section, keys] of Object.entries(FILTER_COPY_KEYS)) for (const k of keys) assert.ok(copy.has(`global.filters.${section}.${k}`), `global.filters.${section}.${k}`);
  const words = { dimensions: { hop_farm_named: 'Farm the Brewery Named' }, groups: { what: 'Beer' } };
  const def = FILTERS.find((d) => d.id === 'hop_farm_named');
  assert.equal(dimensionLabel(def, words), 'Farm the Brewery Named');
  assert.equal(groupLabel('What', words), 'Beer');
  assert.deepEqual(activeChips({ hop_farm_named: 'Yakima Chief' }, { copy: { filters: words } }).map((c) => c.text), ['Farm the Brewery Named: Yakima Chief']);
  // With no copy shipped, the labels in the code stand in.
  assert.equal(dimensionLabel(def), def.label);
  assert.equal(groupLabel('What'), 'What');
});
