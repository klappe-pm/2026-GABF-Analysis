#!/usr/bin/env node
// Downloads state denominators and demographic controls from official sources and writes them in
// long format; nothing here is typed by hand.
//   data/reference/state-indicators.csv     state, year, indicator, value, unit, source, source_url, verified
//   data/reference/district-indicators.csv  Federal Reserve district population and GDP built from
//                                           whole states plus the county parts of split states
// Sources: Census population estimates (Vintage 2020 for 2018 and 2019, Vintage 2025 for 2020 to
// 2025), BEA SAGDP1 and CAGDP1, the ACS 2024 1-year table-based summary file, the 2020 Census
// urban and rural state table, NCES PIAAC state model-based estimates, and NCHS U.S. State Life
// Tables 2022. No API key is used, read, or stored.
// Usage: node scripts/fetch-state-indicators.mjs [--refresh]

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { readCsvRecords, toCsv } from './lib/csv.mjs';
import { download, downloadText, pipeRecords, unzipMember } from './lib/download.mjs';
import { APPROXIMATED_STATES, DISTRICT_NAME } from './lib/fed-districts.mjs';
import { parseArgs, REFERENCE, RESULTS, ROOT } from './lib/paths.mjs';

// Every year from the first loaded results file to the latest, so a new year's ingest gets
// denominators on the next run. POP_LAST is the last year in the Census vintage named in URL;
// when Census publishes the next vintage, update the two 2020-2025 URLs and POP_LAST together.
const resultYears = readdirSync(RESULTS).map((f) => f.match(/^gabf-(\d{4})\.csv$/)?.[1]).filter(Boolean).map(Number);
export const MEDAL_YEARS = Array.from({ length: Math.max(...resultYears) - 2018 + 1 }, (_, i) => 2018 + i);
const POP_LAST = 2025;
const ACS_YEAR = 2024;

const URL = {
  pepCounty2020: 'https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/counties/totals/co-est2020-alldata.csv',
  pepCounty2025: 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv',
  pepSubCT2025: 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/cities/totals/sub-est2025_9.csv',
  cousubs: 'https://www2.census.gov/geo/docs/reference/codes2020/national_cousub2020.txt',
  sagdp: 'https://apps.bea.gov/regional/zip/SAGDP.zip',
  cagdp: 'https://apps.bea.gov/regional/zip/CAGDP1.zip',
  acsBase: `https://www2.census.gov/programs-surveys/acs/summary_file/${ACS_YEAR}/table-based-SF`,
  urban: 'https://www2.census.gov/geo/docs/reference/ua/State_Urban_Rural_Pop_2020_2010.xlsx',
  piaacPage: 'https://nces.ed.gov/surveys/piaac/skillsmap/',
  nvsr: 'https://www.cdc.gov/nchs/data/nvsr/nvsr74/nvsr74-12.pdf',
};

const num = (v) => (v === '' || v === null || v === undefined || /\(NA\)|\(D\)|\(NM\)/.test(String(v)) ? null : Number(String(v).replace(/,/g, '')));
const round = (v, d = 2) => (v === null ? null : Number(v.toFixed(d)));

// ---------- population ----------
async function population(refresh, states) {
  const v2020 = readCsvRecords(await downloadText(URL.pepCounty2020, 'census-co-est2020-alldata.csv', { refresh, encoding: 'latin1' }));
  const v2025 = readCsvRecords(await downloadText(URL.pepCounty2025, 'census-co-est2025-alldata.csv', { refresh, encoding: 'latin1' }));
  const fipsToState = Object.fromEntries(states.map((s) => [s.fips, s.state]));
  const state = {}; // state -> year -> value
  const county = {}; // fips5 -> year -> value
  const put = (obj, k, y, v) => { (obj[k] ??= {})[y] = v; };
  for (const r of v2020) {
    for (const y of [2018, 2019]) {
      if (r.SUMLEV === '040' && fipsToState[r.STATE]) put(state, fipsToState[r.STATE], y, num(r[`POPESTIMATE${y}`]));
      if (r.SUMLEV === '050') put(county, `${r.STATE}${r.COUNTY}`, y, num(r[`POPESTIMATE${y}`]));
    }
  }
  for (const r of v2025) {
    for (let y = 2020; y <= POP_LAST; y += 1) {
      if (r.SUMLEV === '040' && fipsToState[r.STATE]) put(state, fipsToState[r.STATE], y, num(r[`POPESTIMATE${y}`]));
      if (r.SUMLEV === '050') put(county, `${r.STATE}${r.COUNTY}`, y, num(r[`POPESTIMATE${y}`]));
    }
  }
  // Connecticut publishes 2020 onward by planning region, so Fairfield County (09001) is rebuilt
  // as the sum of its 23 towns from the subcounty estimates, matched by county subdivision code.
  const fairfieldTowns = new Set(pipeRecords(await downloadText(URL.cousubs, 'census-national-cousub2020.txt', { refresh, encoding: 'latin1' })).filter((r) => r.STATEFP === '09' && r.COUNTYFP === '001' && r.COUSUBFP !== '00000').map((r) => r.COUSUBFP));
  const sub = readCsvRecords(await downloadText(URL.pepSubCT2025, 'census-sub-est2025-09.csv', { refresh, encoding: 'latin1' })).filter((r) => r.SUMLEV === '061' && fairfieldTowns.has(r.COUSUB));
  if (sub.length !== fairfieldTowns.size) throw new Error(`Fairfield towns: matched ${sub.length} of ${fairfieldTowns.size}`);
  for (let y = 2020; y <= POP_LAST; y += 1) put(county, '09001', y, sub.reduce((s, r) => s + num(r[`POPESTIMATE${y}`]), 0));
  return { state, county, fairfieldTowns: sub.length };
}

// ---------- GDP ----------
function beaRows(text) {
  return readCsvRecords(text).filter((r) => r.GeoFIPS).map((r) => ({ ...r, GeoFIPS: r.GeoFIPS.replace(/"/g, '').trim() }));
}
async function gdp(refresh) {
  const sag = await download(URL.sagdp, 'bea-SAGDP.zip', { refresh });
  const cag = await download(URL.cagdp, 'bea-CAGDP1.zip', { refresh });
  const member = (zip, re) => execFileSync('unzip', ['-Z1', zip]).toString().split('\n').find((n) => re.test(n));
  const sagName = member(sag, /^SAGDP1__ALL_AREAS_\d{4}_\d{4}\.csv$/);
  const cagName = member(cag, /^CAGDP1__ALL_AREAS_\d{4}_\d{4}\.csv$/);
  const pick = (rows, line) => rows.filter((r) => r.LineCode === String(line));
  const sRows = beaRows(unzipMember(sag, sagName, 'latin1'));
  const cRows = beaRows(unzipMember(cag, cagName, 'latin1'));
  const realLabel = pick(sRows, 1)[0].Description;
  if (!/Real GDP/i.test(realLabel) || !/chained 2017/i.test(realLabel)) throw new Error(`SAGDP1 line 1 is "${realLabel}"`);
  if (!/Current-dollar GDP/i.test(pick(sRows, 3)[0].Description)) throw new Error('SAGDP1 line 3 is not current-dollar GDP');
  const byFips = (rows, line) => Object.fromEntries(pick(rows, line).map((r) => [r.GeoFIPS, r]));
  return { real: byFips(sRows, 1), nominal: byFips(sRows, 3), countyReal: byFips(cRows, 1), countyNominal: byFips(cRows, 3), sagName, cagName, lastStateYear: Math.max(...Object.keys(sRows[0]).filter((k) => /^\d{4}$/.test(k)).map(Number)), lastCountyYear: Math.max(...Object.keys(cRows[0]).filter((k) => /^\d{4}$/.test(k)).map(Number)) };
}

// ---------- ACS ----------
async function acs(refresh) {
  const shells = pipeRecords(await downloadText(`${URL.acsBase}/documentation/ACS${ACS_YEAR}1YR_Table_Shells.txt`, `acs-${ACS_YEAR}-1yr-shells.txt`, { refresh, encoding: 'latin1' }));
  const label = Object.fromEntries(shells.map((s) => [s['Unique ID'], s.Label]));
  const title = Object.fromEntries(shells.map((s) => [s['Unique ID'], s.Title]));
  const expect = (id, re) => { if (!re.test(label[id] ?? '') && !re.test(title[id] ?? '')) throw new Error(`ACS ${id} label is "${label[id]}" (${title[id]}), expected ${re}`); };
  const table = async (t) => {
    const recs = pipeRecords(await downloadText(`${URL.acsBase}/data/1YRData/acsdt1y${ACS_YEAR}-${t.toLowerCase()}.dat`, `acs-${ACS_YEAR}-1yr-${t.toLowerCase()}.dat`, { refresh }));
    return Object.fromEntries(recs.filter((r) => /^0400000US\d\d$/.test(r.GEO_ID)).map((r) => [r.GEO_ID.slice(-2), r]));
  };
  const e = (row, id) => num(row[`${id.split('_')[0]}_E${id.split('_')[1]}`]);
  expect('B01002_001', /^Median age/i);
  expect('B01001_009', /^21 years$/); expect('B01001_033', /^21 years$/); expect('B01001_025', /85 years and over/); expect('B01001_049', /85 years and over/);
  for (const [id, re] of [['B03002_003', /White alone/], ['B03002_004', /Black/], ['B03002_005', /American Indian/], ['B03002_006', /Asian alone/], ['B03002_007', /Native Hawaiian/], ['B03002_008', /Some other race alone/], ['B03002_009', /Two or more races/], ['B03002_012', /^Hispanic or Latino/]]) expect(id, re);
  expect('B15003_017', /Regular high school diploma/); expect('B15003_022', /Bachelor/); expect('B15003_025', /Doctorate/);
  expect('B17001_002', /below poverty level/i);
  expect('B19013_001', /Median household income/i);
  const [b01002, b01001, b03002, b15003, b17001, b19013] = await Promise.all(['B01002', 'B01001', 'B03002', 'B15003', 'B17001', 'B19013'].map(table));
  const out = {};
  for (const fips of Object.keys(b01001)) {
    const pct = (a, b) => (a === null || !b ? null : round((a / b) * 100, 2));
    const sum = (row, t, from, to) => { let s = 0; for (let i = from; i <= to; i += 1) s += e(row, `${t}_${String(i).padStart(3, '0')}`) ?? 0; return s; };
    const a = b01001[fips]; const r = b03002[fips]; const ed = b15003[fips];
    const totalPop = e(a, 'B01001_001');
    const p25 = e(ed, 'B15003_001');
    out[fips] = {
      median_age: e(b01002[fips], 'B01002_001'),
      share_21_plus: pct(sum(a, 'B01001', 9, 25) + sum(a, 'B01001', 33, 49), totalPop),
      share_hispanic: pct(e(r, 'B03002_012'), e(r, 'B03002_001')),
      share_nh_white: pct(e(r, 'B03002_003'), e(r, 'B03002_001')),
      share_nh_black: pct(e(r, 'B03002_004'), e(r, 'B03002_001')),
      share_nh_aian: pct(e(r, 'B03002_005'), e(r, 'B03002_001')),
      share_nh_asian: pct(e(r, 'B03002_006'), e(r, 'B03002_001')),
      share_nh_nhpi: pct(e(r, 'B03002_007'), e(r, 'B03002_001')),
      share_nh_other: pct(e(r, 'B03002_008'), e(r, 'B03002_001')),
      share_nh_two_or_more: pct(e(r, 'B03002_009'), e(r, 'B03002_001')),
      share_hs_or_higher: pct(sum(ed, 'B15003', 17, 25), p25),
      share_bachelors_or_higher: pct(sum(ed, 'B15003', 22, 25), p25),
      median_household_income: e(b19013[fips], 'B19013_001'),
      poverty_rate: pct(e(b17001[fips], 'B17001_002'), e(b17001[fips], 'B17001_001')),
    };
  }
  return out;
}

// ---------- 2020 urban share (xlsx read through unzip; no spreadsheet dependency) ----------
async function urban(refresh) {
  const path = await download(URL.urban, 'census-state-urban-rural-2020.xlsx', { refresh });
  const strings = [...unzipMember(path, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''));
  const rows = [...unzipMember(path, 'xl/worksheets/sheet1.xml').matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map((m) => {
    const cells = {};
    for (const c of m[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = (c[3] ?? '').match(/<v>([\s\S]*?)<\/v>/)?.[1];
      cells[c[1]] = v === undefined ? '' : /t="s"/.test(c[2]) ? strings[Number(v)] : v;
    }
    return cells;
  });
  const header = rows[0];
  const col = (re) => Object.entries(header).find(([, h]) => re.test(h))?.[0];
  const popCol = col(/^\s*2020\s+TOTAL\s+POP\s*$/i);
  const urbCol = col(/^\s*2020\s+URBAN\s+POP\s*$/i);
  if (!popCol || !urbCol) throw new Error(`urban workbook headers not recognized: ${JSON.stringify(header)}`);
  const out = {};
  for (const r of rows.slice(1)) if (/^\d\d$/.test(r.A ?? '') && num(r[popCol])) out[r.A] = round((num(r[urbCol]) / num(r[popCol])) * 100, 2);
  return { out, header: `${header[popCol]} / ${header[urbCol]}` };
}

// ---------- PIAAC ----------
async function piaac(refresh) {
  const page = await downloadText(URL.piaacPage, 'nces-piaac-skillsmap.html', { refresh });
  const bundle = page.match(/static\/js\/main\.[a-f0-9]+\.js/)?.[0];
  if (!bundle) throw new Error('PIAAC Skills Map bundle not found');
  const js = await downloadText(`${URL.piaacPage}${bundle}`, 'nces-piaac-main.js', { refresh });
  const file = js.match(/static\/media\/LandingPageEstimates_[^"']+\.csv/)?.[0];
  if (!file) throw new Error('PIAAC estimates file not found in the bundle');
  const csvUrl = `${URL.piaacPage}${file}`;
  const recs = readCsvRecords(await downloadText(csvUrl, 'nces-piaac-landing-estimates.csv', { refresh, encoding: 'latin1' }));
  const out = {};
  for (const r of recs) if (r.Type === 'All' && /^[A-Z]{2}$/.test(r.ID) && r.ID === r.County) out[r.ID] = { level1: round(num(r.L1) * 100, 1), score: num(r.LA) };
  return { out, url: csvUrl };
}

// ---------- life expectancy ----------
async function lifeExpectancy(refresh, states) {
  const require = createRequire(resolve(ROOT, 'package.json'));
  const { extractText, getDocumentProxy } = await import(require.resolve('unpdf'));
  const path = await download(URL.nvsr, 'nchs-nvsr74-12.pdf', { refresh });
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(path)));
  const { text } = await extractText(pdf, { mergePages: false });
  const page = text.find((t) => /Table A\. Life expectancy at birth/.test(t));
  if (!page || !/2022/.test(page.slice(0, 300))) throw new Error('NVSR Table A for 2022 not found');
  const out = {};
  const byName = Object.fromEntries(states.map((s) => [s.name.toLowerCase(), s.state]));
  for (const m of page.matchAll(/^([A-Z][A-Za-z .]+?)[ .]*\s(\d{1,2}) (\d{2}\.\d) \d\.\d{2,3}\b/gm)) {
    const code = byName[m[1].replace(/[ .]+$/, '').trim().toLowerCase()];
    if (code) out[code] = Number(m[3]);
  }
  return out;
}

// ---------- assemble ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const refresh = Boolean(args.refresh);
  const statesCsv = readCsvRecords(readFileSync(resolve(REFERENCE, 'states.csv'), 'utf8'));
  const counties = pipeRecords(await downloadText('https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt', 'census-national-county2020.txt', { refresh }));
  const stateFips = Object.fromEntries(counties.map((c) => [c.STATE, c.STATEFP]));
  const states = statesCsv.map((s) => ({ ...s, fips: stateFips[s.state] })).filter((s) => s.fips);

  const pop = await population(refresh, states);
  const g = await gdp(refresh);
  const acsData = await acs(refresh);
  const urb = await urban(refresh);
  const lit = await piaac(refresh);
  const le = await lifeExpectancy(refresh, states);

  const rows = [];
  const add = (state, year, indicator, value, unit, source, source_url, verified = 'yes') => { if (value !== null && value !== undefined && !Number.isNaN(value)) rows.push({ state, year, indicator, value, unit, source, source_url, verified }); };
  const pepSrc = (y) => (y <= 2019 ? 'Census Bureau Vintage 2020 county and state population estimates (co-est2020-alldata), July 1' : 'Census Bureau Vintage 2025 county and state population estimates (co-est2025-alldata), July 1');
  for (const s of states) {
    for (const y of MEDAL_YEARS) {
      const yUse = Math.min(y, POP_LAST);
      const note = y !== yUse ? `; ${yUse} value used for ${y}, which is not yet published` : '';
      add(s.state, y, 'population', pop.state[s.state]?.[yUse], 'persons', `${pepSrc(yUse)}${note}`, yUse <= 2019 ? URL.pepCounty2020 : URL.pepCounty2025);
      const gUse = Math.min(y, g.lastStateYear);
      const gNote = y !== gUse ? `; ${gUse} value used for ${y}, which is not yet published` : '';
      const real = num(g.real[`${s.fips}000`]?.[gUse]);
      const nominal = num(g.nominal[`${s.fips}000`]?.[gUse]);
      add(s.state, y, 'gdp_real', real, 'millions of chained 2017 dollars', `BEA SAGDP1 line 1, real GDP (${g.sagName})${gNote}`, URL.sagdp);
      add(s.state, y, 'gdp_nominal', nominal, 'millions of current dollars', `BEA SAGDP1 line 3, current-dollar GDP (${g.sagName})${gNote}`, URL.sagdp);
      const p = pop.state[s.state]?.[yUse];
      if (real !== null && p) add(s.state, y, 'gdp_per_capita_real', Math.round((real * 1e6) / num(p)), 'chained 2017 dollars per resident', `Derived: BEA real GDP for ${gUse} divided by Census population for ${yUse}`, URL.sagdp, 'derived');
    }
    const a = acsData[s.fips];
    if (a) {
      const acsSrc = (t) => `Census Bureau ACS ${ACS_YEAR} 1-year estimates, table ${t} (table-based summary file); latest 1-year release available keyless`;
      const acsUrl = (t) => `${URL.acsBase}/data/1YRData/acsdt1y${ACS_YEAR}-${t.toLowerCase()}.dat`;
      add(s.state, ACS_YEAR, 'median_age', a.median_age, 'years', acsSrc('B01002'), acsUrl('B01002'));
      add(s.state, ACS_YEAR, 'share_21_plus', a.share_21_plus, 'percent of total population', `${acsSrc('B01001')}; ages 21 and over summed from sex by age`, acsUrl('B01001'));
      for (const k of ['share_hispanic', 'share_nh_white', 'share_nh_black', 'share_nh_aian', 'share_nh_asian', 'share_nh_nhpi', 'share_nh_other', 'share_nh_two_or_more']) add(s.state, ACS_YEAR, k, a[k], 'percent of total population', `${acsSrc('B03002')}; nh means not Hispanic or Latino, race alone`, acsUrl('B03002'));
      add(s.state, ACS_YEAR, 'share_hs_or_higher', a.share_hs_or_higher, 'percent of population 25 and over', `${acsSrc('B15003')}; regular diploma, GED, or more`, acsUrl('B15003'));
      add(s.state, ACS_YEAR, 'share_bachelors_or_higher', a.share_bachelors_or_higher, 'percent of population 25 and over', acsSrc('B15003'), acsUrl('B15003'));
      add(s.state, ACS_YEAR, 'median_household_income', a.median_household_income, `${ACS_YEAR} inflation-adjusted dollars`, acsSrc('B19013'), acsUrl('B19013'));
      add(s.state, ACS_YEAR, 'poverty_rate', a.poverty_rate, 'percent of population for whom poverty status is determined', acsSrc('B17001'), acsUrl('B17001'));
    }
    add(s.state, 2020, 'urban_share', urb.out[s.fips], 'percent of population', `2020 Census urban and rural, state table (${urb.header})`, URL.urban);
    if (lit.out[s.state]) {
      add(s.state, 2017, 'literacy_level1_or_below', lit.out[s.state].level1, 'percent of adults 16 to 74', 'NCES PIAAC state model-based (small area) estimates from pooled 2012, 2014, and 2017 survey data; modeled, not measured; Census does not measure literacy', lit.url);
      add(s.state, 2017, 'literacy_mean_score', lit.out[s.state].score, 'PIAAC literacy scale score (0 to 500)', 'NCES PIAAC state model-based (small area) estimates from pooled 2012, 2014, and 2017 survey data; modeled, not measured', lit.url);
    }
    add(s.state, 2022, 'life_expectancy', le[s.state], 'years at birth', 'NCHS U.S. State Life Tables, 2022 (NVSR vol. 74 no. 12), Table A; latest state tables published', URL.nvsr);
  }
  rows.sort((a, b) => a.state.localeCompare(b.state) || a.indicator.localeCompare(b.indicator) || a.year - b.year);
  writeFileSync(resolve(REFERENCE, 'state-indicators.csv'), toCsv(rows, ['state', 'year', 'indicator', 'value', 'unit', 'source', 'source_url', 'verified']));

  // ---------- districts ----------
  const fed = readCsvRecords(readFileSync(resolve(REFERENCE, 'fed-districts.csv'), 'utf8'));
  const fedCounties = readCsvRecords(readFileSync(resolve(REFERENCE, 'fed-district-counties.csv'), 'utf8'));
  const dRows = [];
  const fipsByState = Object.fromEntries(states.map((s) => [s.state, s.fips]));
  for (let d = 1; d <= 12; d += 1) {
    const whole = fed.filter((f) => f.split === 'no' && Number(f.district_number) === d && fipsByState[f.state]);
    const approx = fed.filter((f) => APPROXIMATED_STATES[f.state] && (Number(f.district_number) === d || Number(f.secondary_districts) === d));
    const approxIn = approx.filter((f) => Number(f.district_number) === d);
    const parts = fedCounties.filter((c) => Number(c.district_number) === d);
    const partStates = [...new Set(parts.map((c) => c.state))];
    const verified = approx.length ? 'approximation' : 'yes';
    const flags = [];
    if (approx.length) flags.push(`${approx.map((f) => f.state).join(', ')} assigned whole to district ${approx.map((f) => f.district_number).join(', ')} (approximation; no primary county list)`);
    for (const y of MEDAL_YEARS) {
      const yUse = Math.min(y, POP_LAST);
      let p = 0;
      for (const f of [...whole, ...approxIn]) p += num(pop.state[f.state]?.[yUse]) ?? 0;
      const popNotes = [];
      for (const st of partStates) {
        const mine = parts.filter((c) => c.state === st);
        const theirs = fedCounties.filter((c) => c.state === st && Number(c.district_number) !== d);
        const val = (c) => num(pop.county[c.county_fips]?.[yUse]);
        if (mine.every((c) => val(c) !== null)) p += mine.reduce((s, c) => s + val(c), 0);
        else if (theirs.every((c) => val(c) !== null)) {
          // Connecticut 2020 on: the old counties other than the rebuilt Fairfield are not
          // published, so this side is the state total less the other side.
          p += num(pop.state[st][yUse]) - theirs.reduce((s, c) => s + val(c), 0);
          popNotes.push(`${st} part is the state estimate less ${theirs.map((c) => c.county_name).join(', ')}`);
        } else throw new Error(`district ${d}, ${st}, ${yUse}: county population incomplete on both sides`);
      }
      if (partStates.includes('CT') && yUse >= 2020) popNotes.push('Fairfield County CT rebuilt from its 23 town estimates (sub-est2025)');
      const popNote = [y !== yUse ? `${yUse} value used for ${y}` : '', ...popNotes].filter(Boolean).join('; ');
      dRows.push({ district_number: d, district_name: DISTRICT_NAME[d], year: y, indicator: 'population', value: p, unit: 'persons', source: `Sum of whole-state estimates and split-state county estimates: ${pepSrc(yUse)}${popNote ? `; ${popNote}` : ''}${flags.length ? `; ${flags.join('; ')}` : ''}`, source_url: yUse <= 2019 ? URL.pepCounty2020 : URL.pepCounty2025, verified });

      // GDP: whole states from SAGDP1; a split state's part is its SAGDP1 total times the part's
      // share of the state's county GDP (CAGDP1) in the latest county year at or before y.
      const gUse = Math.min(y, g.lastStateYear);
      for (const [indicator, stateTbl, countyTbl, unit] of [['gdp_real', g.real, g.countyReal, 'millions of chained 2017 dollars'], ['gdp_nominal', g.nominal, g.countyNominal, 'millions of current dollars']]) {
        let total = 0;
        let estimated = false;
        const notes = [];
        for (const f of [...whole, ...approxIn]) total += num(stateTbl[`${fipsByState[f.state]}000`]?.[gUse]) ?? 0;
        for (const st of partStates) {
          const all = fedCounties.filter((c) => c.state === st);
          const mine = new Set(parts.filter((c) => c.state === st).map((c) => c.county_fips));
          let cy = Math.min(gUse, g.lastCountyYear);
          const share = (yy) => {
            let a = 0; let b = 0;
            for (const c of all) { const v = num(countyTbl[c.county_fips]?.[yy]); if (v === null) return null; b += v; if (mine.has(c.county_fips)) a += v; }
            return b ? a / b : null;
          };
          let sh = share(cy);
          while (sh === null && cy > 2001) { cy -= 1; sh = share(cy); }
          if (sh === null) throw new Error(`${st}: no county GDP year with complete coverage`);
          total += (num(stateTbl[`${fipsByState[st]}000`]?.[gUse]) ?? 0) * sh;
          estimated = true;
          if (cy !== gUse) notes.push(`${st} share from ${cy} county GDP`);
        }
        dRows.push({ district_number: d, district_name: DISTRICT_NAME[d], year: y, indicator, value: Math.round(total * 10) / 10, unit, source: `BEA SAGDP1 (${g.sagName}) for whole states${partStates.length ? `; split states ${partStates.join(', ')} apportioned by county GDP shares from BEA CAGDP1 (${g.cagName}), county GDP lagging state GDP` : ''}${gUse !== y ? `; ${gUse} value used for ${y}` : ''}${notes.length ? `; ${notes.join('; ')}` : ''}${flags.length ? `; ${flags.join('; ')}` : ''}`, source_url: partStates.length ? `${URL.sagdp} ${URL.cagdp}` : URL.sagdp, verified: estimated ? (approx.length ? 'estimate (E); approximation' : 'estimate (E)') : verified });
      }
      const real = dRows.find((r) => r.district_number === d && r.year === y && r.indicator === 'gdp_real').value;
      dRows.push({ district_number: d, district_name: DISTRICT_NAME[d], year: y, indicator: 'gdp_per_capita_real', value: Math.round((real * 1e6) / p), unit: 'chained 2017 dollars per resident', source: 'Derived: district real GDP divided by district population', source_url: URL.sagdp, verified: 'derived' });
    }
  }
  writeFileSync(resolve(REFERENCE, 'district-indicators.csv'), toCsv(dRows, ['district_number', 'district_name', 'year', 'indicator', 'value', 'unit', 'source', 'source_url', 'verified']));

  const missing = states.filter((s) => !le[s.state] || !lit.out[s.state] || !acsData[s.fips] || urb.out[s.fips] === undefined).map((s) => s.state);
  console.log(`state-indicators.csv: ${rows.length} rows for ${states.length} states; district-indicators.csv: ${dRows.length} rows; Fairfield towns ${pop.fairfieldTowns}; BEA state GDP through ${g.lastStateYear}, county GDP through ${g.lastCountyYear}`);
  if (missing.length) console.log(`  incomplete controls for: ${missing.join(', ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
