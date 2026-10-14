#!/usr/bin/env node
// Builds the Federal Reserve district reference tables from primary sources:
//   data/reference/fed-districts.csv          one row per state, DC, and territory
//   data/reference/fed-district-counties.csv  every county of every split state, with its district
//   data/reference/medal-city-counties.csv    each medal city in a split state, with its county
// District definitions live in scripts/lib/fed-districts.mjs (transcribed, counted, and sourced);
// this script joins them to the Census county, place, and county subdivision files, picks each
// split state's majority district from Census population, and resolves medal cities to counties.
// Usage: node scripts/build-fed-districts.mjs [--refresh]

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCsvRecords, toCsv } from './lib/csv.mjs';
import { downloadText, pipeRecords } from './lib/download.mjs';
import { APPROXIMATED_STATES, assignSplitCounties, DISTRICT_NAME, SOURCES, SPLIT_LISTS, STATE_DISTRICTS } from './lib/fed-districts.mjs';
import { ENRICHED, parseArgs, REFERENCE, RESULTS } from './lib/paths.mjs';
import { breweryKey } from './lib/slug.mjs';

const CENSUS = {
  counties: 'https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt',
  places: 'https://www2.census.gov/geo/docs/reference/codes2020/national_place_by_county2020.txt',
  cousubs: 'https://www2.census.gov/geo/docs/reference/codes2020/national_cousub2020.txt',
  pop2020: 'https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/counties/totals/co-est2020-alldata.csv',
  geocoder: 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates',
};

// Comparison key for a city name. Census names carry a type word ("Jersey City city", "Ocean
// township") that is stripped once; medal city strings are printed bare and keep every word.
export function cityKey(name, { census = false } = {}) {
  let s = String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+\(balance\)$/, '');
  if (census) s = s.replace(/\s+(city|village|town|borough|cdp|charter township|township|municipality|plantation|grant|location|gore|purchase|unorganized territory)$/, '');
  return s.replace(/^saint\s+/, 'st ').replace(/^st\.\s*/, 'st ').replace(/^sainte\s+/, 'ste ').replace(/[^a-z0-9]/g, '');
}

function majorityDistrict(state, countyRows, popByFips) {
  const totals = {};
  for (const c of countyRows.filter((r) => r.state === state)) {
    totals[c.district_number] = (totals[c.district_number] ?? 0) + (popByFips.get(c.county_fips) ?? 0);
  }
  return Number(Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0]);
}

async function geocodeCounty(lat, lon) {
  const url = `${CENSUS.geocoder}?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json();
  const c = j?.result?.geographies?.Counties?.[0];
  return c ? { county_fips: `${c.STATE}${c.COUNTY}`, county_name: c.NAME } : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const refresh = Boolean(args.refresh);

  const counties = pipeRecords(await downloadText(CENSUS.counties, 'census-national-county2020.txt', { refresh }))
    .map((r) => ({ state: r.STATE, county_fips: `${r.STATEFP}${r.COUNTYFP}`, county_name: r.COUNTYNAME }));
  const { rows: countyRows, errors } = assignSplitCounties(counties);
  if (errors.length) {
    for (const e of errors) console.error(e);
    throw new Error(`${errors.length} district county list problems; nothing written`);
  }

  const popText = await downloadText(CENSUS.pop2020, 'census-co-est2020-alldata.csv', { refresh, encoding: 'latin1' });
  const popByFips = new Map(readCsvRecords(popText).filter((r) => r.SUMLEV === '050').map((r) => [`${r.STATE}${r.COUNTY}`, Number(r.POPESTIMATE2020)]));

  // fed-districts.csv
  const statesCsv = readCsvRecords(readFileSync(resolve(REFERENCE, 'states.csv'), 'utf8'));
  const codes = [...new Set([...statesCsv.map((s) => s.state), 'VI', 'GU', 'AS', 'MP'])];
  const stateRows = codes.map((state) => {
    const pair = STATE_DISTRICTS[state];
    if (!pair) throw new Error(`${state}: no district in lib/fed-districts.mjs`);
    if (APPROXIMATED_STATES[state]) {
      const a = APPROXIMATED_STATES[state];
      return { state, district_number: a.district, district_name: DISTRICT_NAME[a.district], split: 'yes', secondary_districts: String(a.other), source: `Approximation: whole state assigned to the ${DISTRICT_NAME[a.district]} district, which the Board and the Richmond Fed describe as covering most of ${state}; ${a.reason}. ${SOURCES.board.url}; ${SOURCES.cleveland.url}; ${SOURCES.richmond.url}`, verified: 'no' };
    }
    if (SPLIT_LISTS[state]) {
      const major = majorityDistrict(state, countyRows, popByFips);
      const other = pair.find((d) => d !== major);
      const spec = SPLIT_LISTS[state];
      return { state, district_number: major, district_name: DISTRICT_NAME[major], split: 'yes', secondary_districts: String(other), source: `Split by county; district_number holds the larger share of Census Vintage 2020 county population. County lists: ${SOURCES[spec.source].label} ${SOURCES[spec.source].url}`, verified: 'yes' };
    }
    const src = state === 'DC' ? SOURCES.richmond : SOURCES.board;
    return { state, district_number: pair[0], district_name: DISTRICT_NAME[pair[0]], split: 'no', secondary_districts: '', source: `${src.label} ${src.url}`, verified: 'yes' };
  });
  writeFileSync(resolve(REFERENCE, 'fed-districts.csv'), toCsv(stateRows, ['state', 'district_number', 'district_name', 'split', 'secondary_districts', 'source', 'verified']));

  // fed-district-counties.csv
  writeFileSync(resolve(REFERENCE, 'fed-district-counties.csv'), toCsv(countyRows, ['state', 'county_fips', 'county_name', 'district_number', 'basis', 'source']));

  // medal-city-counties.csv: every (state, city) printed on a GABF medal row in a split or
  // approximated state, keyed by the exact strings in the results.
  const splitStates = new Set([...Object.keys(SPLIT_LISTS), ...Object.keys(APPROXIMATED_STATES)]);
  const results = readdirSync(RESULTS).filter((f) => /^gabf-\d{4}\.csv$/.test(f)).flatMap((f) => readCsvRecords(readFileSync(resolve(RESULTS, f), 'utf8')));
  const pairs = new Map();
  for (const r of results) {
    if (!splitStates.has(r.state)) continue;
    const k = `${r.state}|${r.city}`;
    if (!pairs.has(k)) pairs.set(k, { state: r.state, city: r.city, breweries: new Set(), names: new Set() });
    pairs.get(k).breweries.add(breweryKey(r.brewery_name));
    pairs.get(k).names.add(r.brewery_name);
  }
  const places = pipeRecords(await downloadText(CENSUS.places, 'census-national-place-by-county2020.txt', { refresh, encoding: 'latin1' }));
  const cousubs = pipeRecords(await downloadText(CENSUS.cousubs, 'census-national-cousub2020.txt', { refresh, encoding: 'latin1' }));
  const districtByFips = new Map(countyRows.map((c) => [c.county_fips, c.district_number]));
  const countyName = new Map(counties.map((c) => [c.county_fips, c.county_name]));
  const enrichedPath = resolve(ENRICHED, 'breweries.json');
  const enriched = JSON.parse(readFileSync(enrichedPath, 'utf8')).breweries ?? {};

  const out = [];
  for (const p of [...pairs.values()].sort((a, b) => `${a.state}|${a.city}`.localeCompare(`${b.state}|${b.city}`))) {
    const key = cityKey(p.city);
    const placeHits = places.filter((x) => x.STATE === p.state && cityKey(x.PLACENAME, { census: true }) === key);
    const incorporated = placeHits.filter((x) => /incorporated/i.test(x.TYPE) && !/census designated/i.test(x.TYPE));
    let hits = (incorporated.length ? incorporated : placeHits).map((x) => ({ fips: `${x.STATEFP}${x.COUNTYFP}`, via: `Census 2020 place by county file (${x.PLACENAME}) ${CENSUS.places}` }));
    if (!hits.length) {
      hits = cousubs.filter((x) => x.STATE === p.state && cityKey(x.COUSUBNAME, { census: true }) === key)
        .map((x) => ({ fips: `${x.STATEFP}${x.COUNTYFP}`, via: `Census 2020 county subdivision file (${x.COUSUBNAME}) ${CENSUS.cousubs}` }));
    }
    const fipsSet = [...new Set(hits.map((h) => h.fips))];
    const districts = new Set(fipsSet.map((f) => (APPROXIMATED_STATES[p.state] ? APPROXIMATED_STATES[p.state].district : districtByFips.get(f))));
    let row;
    if (fipsSet.length === 1) {
      row = { county_fips: fipsSet[0], source: hits[0].via, verified: 'yes', note: '' };
    } else if (fipsSet.length > 1 && districts.size === 1) {
      row = { county_fips: fipsSet.join(';'), source: hits.map((h) => h.via).filter((v, i, a) => a.indexOf(v) === i).join('; '), verified: 'yes', note: 'spans several counties, all in one district' };
    } else {
      // Ambiguous or unmatched: geocode the brewery's Open Brewery DB coordinates.
      let geo = null;
      let who = '';
      for (const bk of p.breweries) {
        const locs = enriched[bk]?.locations ?? [];
        const loc = locs.find((l) => cityKey(l.city ?? '') === key && l.latitude && l.longitude) ?? (cityKey(enriched[bk]?.best?.city ?? '') === key ? enriched[bk]?.best : null);
        if (loc?.latitude && loc?.longitude) {
          geo = await geocodeCounty(Number(loc.latitude), Number(loc.longitude));
          who = `${bk} at ${loc.street ?? loc.address_1 ?? ''}`;
          if (geo) break;
        }
      }
      // Enrichment missed the brewery: ask Open Brewery DB directly, keeping only a candidate in
      // the same state whose city folds to the same key.
      for (const name of geo ? [] : p.names) {
        const res = await fetch(`https://api.openbrewerydb.org/v1/breweries/search?query=${encodeURIComponent(name.replace(/\b(co|company|brewing|brewery)\b\.?/gi, '').trim())}&per_page=20`);
        const list = res.ok ? await res.json() : [];
        const stateName = statesCsv.find((s) => s.state === p.state)?.name;
        const cand = list.find((b) => b.state_province === stateName && cityKey(b.city ?? '') === key && b.latitude && b.longitude);
        if (cand) {
          geo = await geocodeCounty(Number(cand.latitude), Number(cand.longitude));
          who = `${cand.name} at ${cand.address_1 ?? cand.street ?? ''} (Open Brewery DB id ${cand.id})`;
          if (geo) break;
        }
      }
      if (geo && geo.county_fips.slice(0, 2) === counties.find((c) => c.state === p.state)?.county_fips.slice(0, 2)) {
        row = { county_fips: geo.county_fips, source: `Census Geocoder (current benchmark) on Open Brewery DB coordinates for ${who} ${CENSUS.geocoder}`, verified: 'yes', note: fipsSet.length ? `name matches ${fipsSet.length} counties in different districts; resolved by brewery coordinates` : 'no Census place or subdivision by this name; resolved by brewery coordinates' };
      } else {
        row = { county_fips: '', source: fipsSet.length ? `Census name matches ${fipsSet.join(';')} in different districts` : 'no Census place or county subdivision by this name', verified: 'no', note: 'unresolved' };
      }
    }
    if (APPROXIMATED_STATES[p.state] && row.county_fips) row.note = [row.note, `district is the ${p.state} majority approximation, not a county assignment`].filter(Boolean).join('; ');
    const firstFips = row.county_fips.split(';')[0];
    out.push({ state: p.state, city: p.city, county_fips: row.county_fips, county_name: row.county_fips.split(';').filter(Boolean).map((f) => countyName.get(f) ?? '').join(';'), district_number: firstFips ? (APPROXIMATED_STATES[p.state]?.district ?? districtByFips.get(firstFips) ?? '') : '', source: row.source, verified: row.verified, note: row.note });
  }
  writeFileSync(resolve(REFERENCE, 'medal-city-counties.csv'), toCsv(out, ['state', 'city', 'county_fips', 'county_name', 'district_number', 'source', 'verified', 'note']));

  const unresolved = out.filter((r) => !r.county_fips);
  console.log(`fed-districts.csv: ${stateRows.length} rows; fed-district-counties.csv: ${countyRows.length} counties in ${Object.keys(SPLIT_LISTS).length} split states; medal-city-counties.csv: ${out.length} cities, ${unresolved.length} unresolved`);
  for (const u of unresolved) console.log(`  unresolved: ${u.city}, ${u.state} (${u.source})`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
