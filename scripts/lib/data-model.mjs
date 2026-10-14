// Load every CSV, markdown profile, and enrichment file into one dataset that the
// site builder, the scaffolder, and the report generators share.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { readCsvRecords } from './csv.mjs';
import { breweryKey, slugify } from './slug.mjs';
import { abvBand, isSpecialCategory, styleFamily } from './style-families.mjs';
import { parseFrontmatter } from './frontmatter.mjs';
import { estimateBarrels, estimateFinancials, estimateRevenue, loadParameters, volumeBreakdown } from './estimate.mjs';
import { attachWinnerSpecs } from './winner-specs.mjs';
import { BREWERIES, ENRICHED, REFERENCE, RESULTS } from './paths.mjs';

const MEDAL_ORDER = { Gold: 0, Silver: 1, Bronze: 2, 'Honorable Mention': 3 };
export const MEDAL_POINTS = { Gold: 3, Silver: 2, Bronze: 1, 'Honorable Mention': 0 };

function readCsvIfExists(path) {
  return existsSync(path) ? readCsvRecords(readFileSync(path, 'utf8')) : [];
}

export function loadProfiles(dir = BREWERIES) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('template'))
    .map((f) => {
      const text = readFileSync(resolve(dir, f), 'utf8');
      const { data, body } = parseFrontmatter(text);
      const name = data.brewery ?? basename(f, '.md');
      return { file: f, slug: basename(f, '.md'), key: breweryKey(name), name, data, body };
    });
}

// Map a brewery-facts.csv row onto the profile frontmatter keys the dataset already reads.
function factsAsProfile(f) {
  if (!f) return {};
  const out = {};
  const put = (key, value) => { if (value !== undefined && value !== '') out[key] = value; };
  put('employees', f.employees);
  if (f.has_kitchen) out['has-kitchen'] = f.has_kitchen === 'yes';
  put('locations-count', f.locations_count);
  if (f.known_for) out['known-for'] = f.known_for.split(';').map((s) => s.trim()).filter(Boolean);
  put('barrels-estimate', f.barrels_estimate);
  put('revenue-estimate-usd', f.revenue_estimate_usd);
  put('revenue-low-usd', f.revenue_low_usd);
  put('revenue-high-usd', f.revenue_high_usd);
  return out;
}

function indexBy(records, pick) {
  const map = new Map();
  for (const r of records) {
    const k = pick(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

function aliasKeys(record) {
  const keys = [breweryKey(record.brewery_name)];
  for (const alias of String(record.aliases ?? '').split(';')) {
    if (alias.trim()) keys.push(breweryKey(alias));
  }
  return keys;
}

// A category keeps one identity across years. Spellings that differ only in hyphens, slashes,
// spacing or case ("Mixed-Culture Brett Beer", "Mixed Culture Brett Beer") fold to one key.
export const categoryFold = (name) => String(name ?? '').toLowerCase().replace(/[\s\-\/]+/g, ' ').trim();

// Display name per folded key: the spelling used in the newest year, so the official current
// spelling wins. Rows are any records with a year and a category_name.
export function canonicalCategoryNames(rows) {
  const newest = new Map();
  for (const r of rows) {
    const k = categoryFold(r.category_name);
    const year = Number(r.year);
    if (!k) continue;
    const cur = newest.get(k);
    if (!cur || year > cur.year) newest.set(k, { year, name: String(r.category_name).trim() });
  }
  return new Map([...newest].map(([k, v]) => [k, v.name]));
}

export function loadDataset({ root } = {}) {
  const referenceDir = root ? resolve(root, 'data/reference') : REFERENCE;
  const resultsDir = root ? resolve(root, 'data/results') : RESULTS;
  const enrichedDir = root ? resolve(root, 'data/enriched') : ENRICHED;
  const breweriesDir = root ? resolve(root, 'breweries') : BREWERIES;

  const states = readCsvIfExists(resolve(referenceDir, 'states.csv'));
  const stateByCode = Object.fromEntries(states.map((s) => [s.state, s]));
  const fedDistricts = readCsvIfExists(resolve(referenceDir, 'fed-districts.csv'));
  const medalCityCounties = readCsvIfExists(resolve(referenceDir, 'medal-city-counties.csv'));
  const assignDistrict = districtAssigner(fedDistricts, medalCityCounties);
  const stateIndicators = indexIndicators(readCsvIfExists(resolve(referenceDir, 'state-indicators.csv')), 'state');
  const districtIndicators = indexIndicators(readCsvIfExists(resolve(referenceDir, 'district-indicators.csv')), 'district_number');
  const categories = readCsvIfExists(resolve(referenceDir, 'categories.csv'));
  const categoryByName = new Map(categories.map((c) => [categoryFold(c.category_name), c]));
  const ownership = readCsvIfExists(resolve(referenceDir, 'ownership.csv'));
  const ownershipByKey = new Map();
  for (const o of ownership) for (const k of aliasKeys(o)) ownershipByKey.set(k, o);
  const production = readCsvIfExists(resolve(referenceDir, 'production.csv'));
  const productionByKey = indexBy(production, (p) => breweryKey(p.brewery_name));
  const distributors = readCsvIfExists(resolve(referenceDir, 'distributors.csv'));
  const distributorsByKey = indexBy(distributors, (d) => breweryKey(d.brewery_name));
  const abvOverrides = readCsvIfExists(resolve(referenceDir, 'beer-abv-overrides.csv'));
  const abvByBeer = new Map(abvOverrides.map((a) => [`${a.competition}|${a.year}|${breweryKey(a.brewery_name)}|${a.beer_name.toLowerCase()}`, a]));
  const overrides = readCsvIfExists(resolve(referenceDir, 'brewery-overrides.csv'));
  const facts = readCsvIfExists(resolve(referenceDir, 'brewery-facts.csv'));
  const factsByKey = new Map(facts.map((f) => [breweryKey(f.brewery_name), f]));
  const params = loadParameters(resolve(referenceDir, 'estimation-parameters.json'));
  const summary = readCsvIfExists(resolve(resultsDir, 'year-summary.csv'));
  const awards = readCsvIfExists(resolve(resultsDir, 'brewery-of-the-year.csv'));
  const enrichedPath = resolve(enrichedDir, 'breweries.json');
  const enriched = existsSync(enrichedPath) ? JSON.parse(readFileSync(enrichedPath, 'utf8')) : { breweries: {} };
  const profiles = loadProfiles(breweriesDir);
  const profileByKey = new Map(profiles.map((p) => [p.key, p]));

  const resultFiles = readdirSync(resultsDir).filter((f) => /^gabf-\d{4}\.csv$/.test(f)).map((f) => resolve(resultsDir, f)).sort();
  const gabfRows = resultFiles.flatMap((f) => readCsvRecords(readFileSync(f, 'utf8')));
  const otherRows = readCsvIfExists(resolve(resultsDir, 'world-beer-cup.csv'));

  const canonicalCategory = canonicalCategoryNames(gabfRows);
  const decorate = (rawRow) => {
    const r = { ...rawRow, category_name: canonicalCategory.get(categoryFold(rawRow.category_name)) ?? rawRow.category_name };
    const key = breweryKey(r.brewery_name);
    const cat = categoryByName.get(categoryFold(r.category_name));
    const abvRow = abvByBeer.get(`${r.competition}|${r.year}|${key}|${String(r.beer_name).toLowerCase()}`);
    const abv = abvRow ? Number(abvRow.abv) : null;
    const abvMid = cat && cat.abv_min && cat.abv_max ? (Number(cat.abv_min) + Number(cat.abv_max)) / 2 : null;
    const st = stateByCode[r.state] ?? {};
    const special = cat?.special ? cat.special === 'yes' : isSpecialCategory(r.category_name);
    const fed = assignDistrict(r.state, r.city);
    return {
      ...r,
      year: Number(r.year),
      entries: r.entries ? Number(r.entries) : null,
      brewery_key: key,
      brewery_slug: slugify(r.brewery_name),
      category_slug: slugify(r.category_name),
      style_family: cat?.style_family || styleFamily(r.category_name),
      category_type: special ? 'special' : 'classic',
      special,
      abv_min: cat?.abv_min ? Number(cat.abv_min) : null,
      abv_max: cat?.abv_max ? Number(cat.abv_max) : null,
      abv,
      abv_band: abvBand(abv ?? abvMid),
      region: st.region ?? '',
      division: st.division ?? '',
      state_name: st.name ?? r.state,
      fed_district: fed.district,
      fed_district_name: fed.name,
      fed_district_method: fed.method,
      medal_rank: MEDAL_ORDER[r.medal] ?? 9,
      points: MEDAL_POINTS[r.medal] ?? 0,
      partial: /partial seed|transcript draft/i.test(r.notes ?? ''),
      draft: /transcript draft/i.test(r.notes ?? ''),
    };
  };

  const results = gabfRows.map(decorate).sort((a, b) => a.year - b.year || Number(a.category_number) - Number(b.category_number) || a.medal_rank - b.medal_rank);
  const otherResults = otherRows.map(decorate);
  attachWinnerSpecs(results, { dir: root ? resolve(root, 'docs/2026/winner') : undefined });
  for (const r of results) if (r.spec && r.spec.abv.value !== null) r.abv_band = abvBand(r.abv);

  // Year coverage: complete, partial, draft (transcript), pending (competition held but no rows yet).
  const years = new Set([...results.map((r) => r.year), ...summary.filter((s) => s.competition === 'GABF').map((s) => Number(s.year))]);
  const coverage = {};
  for (const y of years) {
    const rows = results.filter((r) => r.year === y);
    if (rows.length === 0) coverage[y] = 'pending';
    else if (rows.some((r) => r.draft)) coverage[y] = 'draft';
    else if (rows.some((r) => r.partial)) coverage[y] = 'partial';
    else coverage[y] = 'complete';
  }

  // Breweries.
  const breweries = new Map();
  const touch = (row) => {
    if (!breweries.has(row.brewery_key)) {
      breweries.set(row.brewery_key, { key: row.brewery_key, slug: row.brewery_slug, name: row.brewery_name, names: new Map(), locations: new Map(), medals: [], other_medals: [], awards: [] });
    }
    const b = breweries.get(row.brewery_key);
    b.names.set(row.brewery_name, (b.names.get(row.brewery_name) ?? 0) + 1);
    const locKey = `${row.brewery_location}|${row.city}|${row.state}`;
    if (!b.locations.has(locKey)) b.locations.set(locKey, { label: row.brewery_location, city: row.city, state: row.state, medals: 0 });
    b.locations.get(locKey).medals += 1;
    return b;
  };
  for (const r of results) touch(r).medals.push(r);
  for (const r of otherResults) touch(r).other_medals.push(r);
  for (const a of awards) {
    const key = breweryKey(a.brewery_name);
    if (breweries.has(key)) breweries.get(key).awards.push(a);
  }
  for (const p of profiles) {
    if (!breweries.has(p.key)) breweries.set(p.key, { key: p.key, slug: p.slug, name: p.name, names: new Map([[p.name, 1]]), locations: new Map(), medals: [], other_medals: [], awards: [] });
  }

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const loadedYears = Object.entries(coverage).filter(([, v]) => v !== 'pending').map(([y]) => Number(y));
  const latestComplete = loadedYears.length ? Math.max(...loadedYears) : maxYear;

  for (const b of breweries.values()) {
    b.name = [...b.names.entries()].sort((x, y) => y[1] - x[1])[0][0];
    b.slug = profileByKey.get(b.key)?.slug ?? slugify(b.name);
    b.profile = profileByKey.get(b.key) ?? null;
    b.facts = factsByKey.get(b.key) ?? null;
    b.ownership = ownershipByKey.get(b.key) ?? null;
    b.production = productionByKey.get(b.key) ?? [];
    b.distributors = distributorsByKey.get(b.key) ?? [];
    b.enriched = enriched.breweries?.[b.key] ?? null;
    b.overrides = overrides.filter((o) => breweryKey(o.brewery_name) === b.key);
    // Tracked facts in data/reference/brewery-facts.csv; a local deep dive in breweries/ wins when present.
    const pd = { ...factsAsProfile(factsByKey.get(b.key)), ...(b.profile?.data ?? {}) };
    b.founded = Number(pd.founded ?? b.ownership?.founded ?? '') || null;
    b.defunct = Number(pd.defunct ?? '') || null;
    b.employees = Number(pd.employees ?? '') || null;
    b.brewery_type = pd['brewery-type'] ?? b.overrides.find((o) => !o.brewery_location)?.brewery_type ?? b.enriched?.best?.brewery_type ?? 'micro';
    b.website = pd.website ?? b.overrides.find((o) => o.website)?.website ?? b.enriched?.best?.website_url ?? '';
    b.known_for = pd['known-for'] ?? [];
    b.hq = { city: pd['hq-city'] ?? b.enriched?.best?.city ?? [...b.locations.values()][0]?.city ?? '', state: pd['hq-state'] ?? b.enriched?.best?.state ?? [...b.locations.values()][0]?.state ?? '' };
    b.location_list = Array.isArray(pd.locations) ? pd.locations : [];
    b.locations_count = b.location_list.length || Number(pd['locations-count'] ?? '') || Math.max(1, new Set([...b.locations.values()].map((l) => `${l.city}|${l.state}`)).size);
    b.has_kitchen = Boolean(pd['has-kitchen'] ?? b.location_list.some((l) => l.kitchen));
    b.distribution_channel = pd['distribution-channel'] ?? b.distributors[0]?.channel ?? '';
    const barrels = pd['barrels-estimate'] ? { barrels: Number(pd['barrels-estimate']), basis: 'estimate', confidence: 'low', source: 'brewery profile' } : estimateBarrels({ production: b.production, breweryType: b.brewery_type, locationsCount: b.locations_count, botyBracket: b.awards[0]?.bracket ?? '' }, params);
    const revenue = pd['revenue-estimate-usd']
      ? { total_revenue_usd: Number(pd['revenue-estimate-usd']), low_usd: Number(pd['revenue-low-usd'] ?? Math.round(Number(pd['revenue-estimate-usd']) * 0.7)), high_usd: Number(pd['revenue-high-usd'] ?? Math.round(Number(pd['revenue-estimate-usd']) * 1.35)), basis: 'profile estimate' }
      : estimateRevenue(barrels.barrels, params, b.brewery_type, { locationsCount: b.locations_count, hasKitchen: b.has_kitchen });
    b.estimate = { ...barrels, volume: volumeBreakdown(barrels.barrels, params, b.brewery_type), revenue };
    b.financials = estimateFinancials({ revenue, barrels: barrels.barrels, breweryType: b.brewery_type, employees: b.employees, locationsCount: b.locations_count, distributionChannel: b.distribution_channel }, params);
    b.first_year = b.medals.length ? Math.min(...b.medals.map((m) => m.year)) : null;
    b.last_year = b.medals.length ? Math.max(...b.medals.map((m) => m.year)) : null;
    b.total_points = b.medals.reduce((s, m) => s + m.points, 0);
    b.by_medal = { Gold: 0, Silver: 0, Bronze: 0 };
    for (const m of b.medals) if (b.by_medal[m.medal] !== undefined) b.by_medal[m.medal] += 1;
    b.trend = [];
    // The trend starts at the first loaded year; earlier years would only read as "not loaded".
    const trendStart = minYear;
    for (let y = trendStart; y <= maxYear; y += 1) {
      const rows = b.medals.filter((m) => m.year === y);
      let status;
      if (b.founded && y < b.founded) status = 'did-not-exist';
      else if (b.defunct && y > b.defunct) status = 'closed';
      else if (coverage[y] === undefined) status = 'no-results';
      else if (coverage[y] === 'pending') status = 'not-yet-reported';
      else if (rows.length > 0) status = 'medaled';
      else if (coverage[y] === 'partial' || coverage[y] === 'draft') status = 'no-data';
      else status = 'no-medal';
      b.trend.push({ year: y, status, gold: rows.filter((r) => r.medal === 'Gold').length, silver: rows.filter((r) => r.medal === 'Silver').length, bronze: rows.filter((r) => r.medal === 'Bronze').length, total: rows.length });
    }
    b.streak = computeStreak(b.trend, latestComplete);
    b.names = [...b.names.keys()];
    b.locations = [...b.locations.values()];
  }

  return {
    results, otherResults, states, stateByCode, fedDistricts, medalCityCounties, stateIndicators, districtIndicators, categories, categoryByName, ownership, production, distributors, params,
    summary, awards, coverage, years: [...years].sort(), minYear, maxYear, latestComplete,
    breweries: [...breweries.values()].sort((a, b) => b.total_points - a.total_points || b.medals.length - a.medals.length || a.name.localeCompare(b.name)),
    profiles,
  };
}

// Federal Reserve district for a medal row. Whole states map directly; a split state uses the
// medal city's county (data/reference/medal-city-counties.csv); a state without a primary county
// list, or a city not resolved, falls back to the state's majority district and says so in
// `method`. Codes outside the table (World Beer Cup countries) get an empty district.
export function districtAssigner(fedDistricts, medalCityCounties) {
  const byState = new Map(fedDistricts.map((f) => [f.state, f]));
  const byCity = new Map(medalCityCounties.map((c) => [`${c.state}|${c.city}`, c]));
  return (state, city) => {
    const f = byState.get(state);
    if (!f) return { district: null, name: '', method: '' };
    const majority = { district: Number(f.district_number), name: f.district_name };
    if (f.split !== 'yes') return { ...majority, method: 'state' };
    if (f.verified !== 'yes') return { ...majority, method: 'approximation' };
    const c = byCity.get(`${state}|${city}`);
    if (c && c.district_number) {
      const d = Number(c.district_number);
      const name = fedDistricts.find((x) => Number(x.district_number) === d)?.district_name ?? '';
      return { district: d, name, method: 'county' };
    }
    return { ...majority, method: 'approximation (city not resolved)' };
  };
}

// Long indicator rows to key -> indicator -> year -> { value, unit, source, verified }.
export function indexIndicators(rows, keyField) {
  const out = {};
  for (const r of rows) {
    const k = String(r[keyField]);
    ((out[k] ??= {})[r.indicator] ??= {})[Number(r.year)] = { value: Number(r.value), unit: r.unit, source: r.source, verified: r.verified };
  }
  return out;
}

// Value for a year, or the nearest published year (earlier preferred on a tie) when that year is
// missing; returns { value, year } or null.
export function indicatorFor(index, key, indicator, year) {
  const series = index?.[String(key)]?.[indicator];
  if (!series) return null;
  if (series[year]) return { value: series[year].value, year };
  const years = Object.keys(series).map(Number).sort((a, b) => Math.abs(a - year) - Math.abs(b - year) || a - b);
  return years.length ? { value: series[years[0]].value, year: years[0] } : null;
}

function computeStreak(trend, latestComplete) {
  let streak = 0;
  for (let i = trend.length - 1; i >= 0; i -= 1) {
    const t = trend[i];
    if (t.year > latestComplete) continue;
    if (t.status === 'medaled') streak += 1;
    else if (t.status === 'no-data' || t.status === 'no-results') continue;
    else break;
  }
  return streak;
}

export function categoryIndex(dataset) {
  const map = new Map();
  for (const r of dataset.results) {
    const k = r.category_name;
    if (!map.has(k)) map.set(k, { name: k, slug: r.category_slug, style_family: r.style_family, special: r.special, years: new Map(), rows: [], ref: dataset.categoryByName.get(categoryFold(k)) ?? null });
    const c = map.get(k);
    c.rows.push(r);
    if (!c.years.has(r.year)) c.years.set(r.year, { year: r.year, entries: r.entries, number: r.category_number, medals: [] });
    c.years.get(r.year).medals.push(r);
  }
  for (const c of map.values()) {
    c.years = [...c.years.values()].sort((a, b) => a.year - b.year);
    c.latest_entries = [...c.years].reverse().find((y) => y.entries)?.entries ?? null;
    c.latest_entries_year = [...c.years].reverse().find((y) => y.entries)?.year ?? null;
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
