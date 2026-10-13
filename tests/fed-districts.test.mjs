import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { readCsvRecords } from '../scripts/lib/csv.mjs';
import { countyKey, SPLIT_LISTS } from '../scripts/lib/fed-districts.mjs';
import { districtAssigner, indicatorFor, indexIndicators, loadDataset } from '../scripts/lib/data-model.mjs';
import { addReferenceTables, SCHEMA } from '../scripts/build-winner-db.mjs';
import { medalRates, valueFor } from '../site/assets/rates.mjs';

const ref = (f) => readCsvRecords(readFileSync(new URL(`../data/reference/${f}`, import.meta.url), 'utf8'));
const fed = ref('fed-districts.csv');
const counties = ref('fed-district-counties.csv');
const cities = ref('medal-city-counties.csv');
const stateInd = ref('state-indicators.csv');
const districtInd = ref('district-indicators.csv');

test('county names fold across source spellings', () => {
  assert.equal(countyKey('E. Carroll'), countyKey('East Carroll Parish'));
  assert.equal(countyKey('Dona Ana'), countyKey('Doña Ana County'));
  assert.equal(countyKey('De Soto'), countyKey('DeSoto County'));
  assert.equal(countyKey('La Salle'), countyKey('LaSalle Parish'));
  assert.notEqual(countyKey('St. Louis city'), countyKey('St. Louis County'));
});

test('every state, DC, and Puerto Rico has exactly one district row', () => {
  const states = ref('states.csv').map((s) => s.state);
  for (const s of states) assert.equal(fed.filter((f) => f.state === s).length, 1, s);
  for (const f of fed) {
    assert.ok(Number(f.district_number) >= 1 && Number(f.district_number) <= 12, f.state);
    assert.match(f.source, /https:\/\//, `${f.state} carries a source URL`);
  }
  assert.equal(fed.find((f) => f.state === 'DC').district_number, '5');
  assert.equal(fed.find((f) => f.state === 'PR').district_number, '2');
});

test('split state county lists match the counts the Reserve Banks publish', () => {
  for (const [state, spec] of Object.entries(SPLIT_LISTS)) {
    const named = counties.filter((c) => c.state === state && c.basis === 'named');
    assert.equal(named.length, spec.expected, `${state} named`);
    assert.ok(named.every((c) => Number(c.district_number) === spec.district), `${state} named district`);
    const rest = counties.filter((c) => c.state === state && c.basis === 'complement');
    if (spec.complement !== undefined) assert.equal(rest.length, spec.complement, `${state} complement`);
    assert.ok(rest.every((c) => Number(c.district_number) === spec.other), `${state} complement district`);
  }
  const fips = counties.map((c) => c.county_fips);
  assert.equal(new Set(fips).size, fips.length, 'no county twice');
  // Spot checks against the named lists: Pittsburgh's county is western, Wayne IL is in the Eighth.
  assert.equal(counties.find((c) => c.county_fips === '42003').district_number, '4');
  assert.equal(counties.find((c) => c.county_fips === '17191').district_number, '8');
  assert.equal(counties.find((c) => c.county_fips === '09001').district_number, '2');
});

test('West Virginia is the only state assigned by approximation, and it is labeled', () => {
  const approx = fed.filter((f) => f.verified !== 'yes');
  assert.deepEqual(approx.map((f) => f.state), ['WV']);
  assert.match(approx[0].source, /Approximation/);
});

test('district assignment by state, county, and approximation', () => {
  const assign = districtAssigner(fed, cities);
  assert.deepEqual(assign('CA', 'Orange'), { district: 12, name: 'San Francisco', method: 'state' });
  assert.equal(assign('PA', 'Pittsburgh').district, 4);
  assert.equal(assign('PA', 'Philadelphia').district, 3);
  assert.equal(assign('WI', 'Somerset').district, 9);
  assert.equal(assign('WI', 'Madison').district, 7);
  assert.equal(assign('MO', 'Kansas City').district, 10);
  assert.equal(assign('MO', 'Saint Louis').district, 8);
  assert.equal(assign('NJ', 'Ocean').district, 2);
  assert.deepEqual(assign('WV', 'Elkins'), { district: 5, name: 'Richmond', method: 'approximation' });
  assert.equal(assign('PA', 'Nowhere Township').method, 'approximation (city not resolved)');
  assert.deepEqual(assign('BE', 'Brussels'), { district: null, name: '', method: '' });
});

test('every GABF medal in a US state carries a district; split states resolve by county', () => {
  const ds = loadDataset();
  const us = ds.results.filter((r) => ds.stateByCode[r.state]);
  assert.ok(us.length > 1000);
  for (const r of us) assert.ok(r.fed_district >= 1 && r.fed_district <= 12, `${r.year} ${r.brewery_name} ${r.state}`);
  // A city added by a later ingest may be unresolved until build-fed-districts reruns; it must
  // then carry the approximation label rather than a silent district.
  const split = new Set(fed.filter((f) => f.split === 'yes' && f.verified === 'yes').map((f) => f.state));
  for (const r of us.filter((x) => split.has(x.state))) assert.ok(['county', 'approximation (city not resolved)'].includes(r.fed_district_method), `${r.city}, ${r.state}`);
  for (const r of us.filter((x) => !split.has(x.state) && x.state !== 'WV')) assert.equal(r.fed_district_method, 'state');
  assert.ok(us.filter((r) => r.state === 'WV').every((r) => r.fed_district_method === 'approximation'));
  // Every city in the committed table resolved when it was built.
  assert.deepEqual(cities.filter((c) => !c.county_fips).map((c) => `${c.city}, ${c.state}`), []);
});

test('indicators cover every medal year for every medal state, and districts sum to the states', () => {
  const ds = loadDataset();
  // Exact year or the nearest published year (a newly ingested year resolves to the latest one).
  for (const r of ds.results.filter((x) => ds.stateByCode[x.state] && x.state !== 'PR')) {
    assert.ok(indicatorFor(ds.stateIndicators, r.state, 'population', r.year), `${r.state} population ${r.year}`);
    assert.ok(indicatorFor(ds.stateIndicators, r.state, 'gdp_real', r.year), `${r.state} real GDP ${r.year}`);
  }
  for (const year of ['2018', '2024', '2026']) {
    const states = stateInd.filter((r) => r.year === year && r.indicator === 'population').reduce((s, r) => s + Number(r.value), 0);
    const districts = districtInd.filter((r) => r.year === year && r.indicator === 'population').reduce((s, r) => s + Number(r.value), 0);
    assert.equal(districts, states, `population ${year}`);
    const sg = stateInd.filter((r) => r.year === year && r.indicator === 'gdp_real').reduce((s, r) => s + Number(r.value), 0);
    const dg = districtInd.filter((r) => r.year === year && r.indicator === 'gdp_real').reduce((s, r) => s + Number(r.value), 0);
    assert.ok(dg / sg > 0.99999 && dg / sg < 1.00001, `real GDP ${year}`);
  }
  const pop2026 = stateInd.find((r) => r.state === 'CO' && r.year === '2026' && r.indicator === 'population');
  assert.match(pop2026.source, /2025 value used for 2026/);
  for (const r of stateInd) {
    assert.ok(r.source && r.source_url && r.unit, `${r.state} ${r.indicator} is sourced`);
    assert.ok(Number.isFinite(Number(r.value)), `${r.state} ${r.indicator} ${r.year} is numeric`);
  }
  const controls = ['median_age', 'share_21_plus', 'share_bachelors_or_higher', 'share_hs_or_higher', 'median_household_income', 'poverty_rate', 'urban_share', 'literacy_level1_or_below', 'life_expectancy'];
  for (const s of ['CA', 'CO', 'DC', 'WV', 'VT']) for (const c of controls) assert.ok(ds.stateIndicators[s][c], `${s} ${c}`);
  assert.ok(districtInd.filter((r) => /gdp_(real|nominal)/.test(r.indicator) && r.district_number === '2').every((r) => /estimate \(E\)/.test(r.verified)), 'split state GDP is marked (E)');
});

test('nearest year lookup and per medal year rates', () => {
  const idx = indexIndicators([{ state: 'ZZ', year: '2024', indicator: 'population', value: '1000000', unit: 'persons', source: 's', verified: 'yes' }, { state: 'ZZ', year: '2018', indicator: 'population', value: '500000', unit: 'persons', source: 's', verified: 'yes' }], 'state');
  assert.deepEqual(indicatorFor(idx, 'ZZ', 'population', 2026), { value: 1000000, year: 2024 });
  assert.deepEqual(indicatorFor(idx, 'ZZ', 'population', 2019), { value: 500000, year: 2018 });
  assert.equal(valueFor({ 2020: 5, 2025: 9 }, 2026), 9);
  const rates = medalRates([{ year: 2018, s: 'ZZ' }, { year: 2024, s: 'ZZ' }], (r) => r.s, { ZZ: { population: { 2018: 500000, 2024: 1000000 }, gdp_real: { 2018: 50000, 2024: 100000 } } });
  const z = rates.get('ZZ');
  assert.equal(z.medals, 2);
  assert.equal(z.per_million, 3);
  assert.equal(Number(z.per_100b_gdp.toFixed(6)), 3);
});

test('winner database reference tables load and join beers to districts', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  const counts = addReferenceTables(db);
  assert.ok(counts.fed_districts >= 52 && counts.state_indicators > 1000 && counts.district_indicators > 100);
  db.prepare('INSERT INTO breweries VALUES (?, ?, ?, ?)').run('Test Brewing', 'Pittsburgh', 'PA', null);
  db.prepare('INSERT INTO breweries VALUES (?, ?, ?, ?)').run('Coast Brewing', 'Orange', 'CA', null);
  db.prepare('INSERT INTO categories VALUES (?, ?, ?)').run(1, 'Test', 10);
  db.prepare('INSERT INTO beers (id, year, category_number, medal, beer, brewery) VALUES (?, ?, ?, ?, ?, ?)').run('a', 2026, 1, 'Gold', 'A', 'Test Brewing');
  db.prepare('INSERT INTO beers (id, year, category_number, medal, beer, brewery) VALUES (?, ?, ?, ?, ?, ?)').run('b', 2026, 1, 'Silver', 'B', 'Coast Brewing');
  const rows = db.prepare('SELECT beer_id, district_number, district_name, district_method FROM v_beer_district ORDER BY beer_id').all();
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { beer_id: 'a', district_number: 4, district_name: 'Cleveland', district_method: 'county' },
    { beer_id: 'b', district_number: 12, district_name: 'San Francisco', district_method: 'state' },
  ]);
  const rate = db.prepare('SELECT medals, population, medals_per_million FROM v_district_medal_rates WHERE district_number = 4').get();
  assert.equal(rate.medals, 1);
  assert.ok(rate.population > 1e7 && rate.medals_per_million > 0);
  db.close();
});
