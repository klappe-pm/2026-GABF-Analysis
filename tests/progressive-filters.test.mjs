import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, FILTERS, optionList, pruneState } from '../site/assets/filter-bar.mjs';

const medal = (year, medalName, state, city, brewery, category) => ({
  year, medal: medalName, state, city, brewery_key: brewery.toLowerCase(), brewery_name: brewery, category_name: category, style_family: category, partial: false, beer_name: `${brewery} ${category}`,
});

const rows = [
  medal(2024, 'Gold', 'CO', 'Denver', 'Alpha', 'Lager'),
  medal(2024, 'Silver', 'CO', 'Denver', 'Alpha', 'IPA'),
  medal(2025, 'Bronze', 'CO', 'Denver', 'Bravo', 'IPA'),
  medal(2025, 'Gold', 'CO', 'Boulder', 'The Charlie', 'Stout'),
  medal(2026, 'Gold', 'CA', 'San Diego', 'Delta', 'IPA'),
  medal(2026, 'Silver', 'CA', 'Portland', 'Echo', 'Lager'),
  medal(2026, 'Bronze', 'OR', 'Portland', 'Foxtrot', 'Stout'),
  medal(2025, 'Silver', 'OR', 'Bend', 'Golf', 'Sour'),
];

const values = (id, s) => optionList(rows, id, s).map((o) => o.value);
const counts = (id, s) => Object.fromEntries(optionList(rows, id, s).map((o) => [o.value, o.count]));

test('with nothing picked every option is offered with its count', () => {
  assert.deepEqual(counts('state', {}), { CO: 4, CA: 2, OR: 2 });
  assert.equal(optionList(rows, 'city', {}).length, 6);
});

test('picking a state limits cities, breweries, categories, years and medals to that state', () => {
  const s = { state: 'CO' };
  assert.deepEqual(optionList(rows, 'city', s).map((o) => [o.label, o.count]), [['Boulder', 1], ['Denver', 3]]);
  assert.deepEqual(optionList(rows, 'brewery_key', s).map((o) => o.label), ['Alpha', 'Bravo', 'The Charlie']);
  assert.deepEqual(values('category_name', s).sort(), ['IPA', 'Lager', 'Stout']);
  assert.deepEqual(values('year', s), ['2025', '2024']);
  assert.deepEqual(counts('medal', s), { Gold: 2, Silver: 1, Bronze: 1 });
});

test('picking a city then narrows every other filter to that city', () => {
  const s = { state: 'CO', city: 'Denver, CO' };
  assert.deepEqual(optionList(rows, 'brewery_key', s).map((o) => [o.label, o.count]), [['Alpha', 2], ['Bravo', 1]]);
  assert.deepEqual(counts('category_name', s), { IPA: 2, Lager: 1 });
  assert.deepEqual(counts('year', s), { 2025: 1, 2024: 2 });
  assert.deepEqual(counts('medal', s), { Gold: 1, Silver: 1, Bronze: 1 });
});

test('a filter shows its own alternatives, not only its picked value', () => {
  const s = { state: 'CO', city: 'Denver, CO' };
  assert.deepEqual(optionList(rows, 'city', s).map((o) => o.label), ['Boulder', 'Denver']);
  assert.deepEqual(optionList(rows, 'state', s).map((o) => o.value), ['CO']);
  assert.deepEqual(optionList(rows, 'state', { medal: 'Gold' }).map((o) => o.value).sort(), ['CA', 'CO']);
});

test('no option ever leads to zero results, for any single or paired selection', () => {
  const picks = [{}, { state: 'CO' }, { state: 'CA' }, { state: 'OR' }, { state: 'CO', city: 'Denver, CO' }, { medal: 'Gold' }, { year: '2026', category_name: 'IPA' }, { brewery_key: 'alpha' }];
  for (const s of picks) {
    for (const def of FILTERS) {
      for (const o of optionList(rows, def.id, s)) {
        assert.ok(o.count > 0, `${def.id}=${o.value} offered with a zero count under ${JSON.stringify(s)}`);
        assert.equal(applyFilters(rows, { ...s, [def.id]: o.value }).length, o.count, `${def.id}=${o.value} count matches its results under ${JSON.stringify(s)}`);
      }
    }
  }
});

test('a city name shared by two states keeps its state until one state is picked', () => {
  assert.deepEqual(optionList(rows, 'city', {}).filter((o) => /Portland/.test(o.label)).map((o) => o.label), ['Portland, CA', 'Portland, OR']);
  assert.deepEqual(optionList(rows, 'city', { state: 'OR' }).map((o) => o.label), ['Bend', 'Portland, OR']);
  assert.equal(applyFilters(rows, { city: 'Portland, OR' }).length, 1);
});

test('clearing a filter restores the options it had removed', () => {
  const picked = { state: 'CO', city: 'Denver, CO' };
  const { city, ...cleared } = picked;
  assert.equal(optionList(rows, 'brewery_key', picked).length, 2);
  assert.equal(optionList(rows, 'brewery_key', cleared).length, 3);
  assert.deepEqual(optionList(rows, 'state', {}).length, 3);
  assert.deepEqual(optionList(rows, 'brewery_key', {}).length, 7);
});

test('changing one filter drops another selection it leaves with no results, and keeps the one just changed', () => {
  const stale = { city: 'Denver, CO', state: 'CA' };
  assert.deepEqual(pruneState(rows, stale, 'state'), { state: 'CA' });
  assert.deepEqual(pruneState(rows, stale, 'city'), { city: 'Denver, CO' });
  assert.deepEqual(pruneState(rows, { state: 'CO', city: 'Denver, CO' }, 'state'), { state: 'CO', city: 'Denver, CO' });
});

test('option lists use the one sort order: numbers first, then letters ignoring The', () => {
  const data = [
    medal(2026, 'Gold', 'CO', 'Denver', 'The Bruery', 'IPA'),
    medal(2026, 'Gold', 'CO', 'Denver', '10 Barrel', 'IPA'),
    medal(2026, 'Gold', 'CO', 'Denver', '2 Towns', 'IPA'),
    medal(2026, 'Gold', 'CO', 'Denver', 'avery', 'IPA'),
  ];
  assert.deepEqual(optionList(data, 'brewery_key', {}).map((o) => o.label), ['2 Towns', '10 Barrel', 'avery', 'The Bruery']);
});

test('the year list runs newest first and offers partial years only through the year control', () => {
  const data = [{ ...medal(2018, 'Gold', 'CO', 'Denver', 'Alpha', 'Lager'), partial: true }, medal(2024, 'Gold', 'CO', 'Denver', 'Alpha', 'Lager')];
  assert.deepEqual(optionList(data, 'year', {}).map((o) => o.value), ['2024', '2018']);
  assert.deepEqual(optionList(data, 'medal', {}).map((o) => o.count), [1]);
  assert.deepEqual(optionList(data, 'medal', { year: '2018' }).map((o) => o.count), [1]);
});
