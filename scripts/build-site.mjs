#!/usr/bin/env node
// Build the static site into dist/. Pure Node, no framework: every page is a
// template function. Charts are Apache ECharts figures whose options are embedded as
// JSON and rendered by site/assets/echarts-init.js; dashboards filter data/results.json
// in the browser. Every chart carries a table view.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { marked } from 'marked';
import { DIST, REFERENCE, RESULTS, ROOT, SITE, parseArgs } from './lib/paths.mjs';
import { categoryIndex, loadDataset } from './lib/data-model.mjs';
import { ABV_BANDS } from './lib/style-families.mjs';
import { buildGeo } from './build-geo.mjs';
import { compact, countBy, esc, figure, humanizeHeadings, statTile, STATUS_LABELS, STATUS_SHORT, tableHtml } from '../site/assets/charts.mjs';
import { barsHOption, lineOption, mapOption, MEDAL_COLORS, SERIES_COLORS, stackedColumnsOption } from '../site/assets/chart-options.mjs';
import { medalRates } from '../site/assets/rates.mjs';
import { loadWinnerProfiles, matchKey } from './lib/winner-profiles.mjs';

const require = createRequire(import.meta.url);
const SITE_TITLE = 'GABF Analysis';
const REPO_URL = 'https://github.com/klappe-pm/GABF-Analysis';
const WINNER_YEAR = 2026;
const fmt = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-US'));
const usd = (n) => `$${compact(n)}`;
const pct = (num, den) => (den ? `${((100 * num) / den).toFixed(1)}%` : '');
const pctOf = (x) => `${Math.round(Number(x) * 100)}%`;

// Winner research profiles keyed by year plus matchKey; filled in build() and read by medal tables.
const PROFILES = new Map();
const profileKey = (year, beer, medal, category) => `${year}|${matchKey(beer, medal, category)}`;
const profileFor = (row) => PROFILES.get(profileKey(row.year, row.beer_name, row.medal, row.category_name)) ?? null;

// Markdown sources keep kebab-case headings; every rendered page shows them as display text.
function write(relPath, html) {
  const full = resolve(DIST, relPath);
  mkdirSync(resolve(full, '..'), { recursive: true });
  writeFileSync(full, relPath.endsWith('.html') ? humanizeHeadings(html) : html);
}

const DASHBOARDS = [
  ['', 'Overview', 'Medals by year, state, style family, and brewery with every filter.'],
  ['dashboards/geography/', 'Geography', 'US map, Census regions and divisions, Federal Reserve districts, medals per million residents and per real GDP, demographic controls.'],
  ['dashboards/categories/', 'Categories', 'Entrants by category, classic versus special categories, category size versus medal spread.'],
  ['dashboards/breweries/', 'Breweries', 'Pick a brewery: medals by year, by category, and by location.'],
  ['dashboards/economics/', 'Ownership and economics', 'Ownership share, parents, estimated revenue, ARR, margins, distribution.'],
];

function layout({ title, description = '', body, depth = 0, active = '', scripts = '', bodyAttrs = '' }) {
  const r = depth === 0 ? './' : '../'.repeat(depth);
  const nav = [['', 'Dashboards'], [`beers/${WINNER_YEAR}/`, `${WINNER_YEAR} winners`], ['breweries/', 'Breweries'], ['categories/', 'Categories'], ['reports/', 'Reports'], ['explorer/', 'Explorer'], ['about/', 'About']]
    .map(([href, label]) => `<a href="${r}${href}"${active === label ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${SITE_TITLE}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="${r}assets/styles.css">
<link rel="icon" href="data:,">
<script>window.GABF_BASE = ${JSON.stringify(r)};</script>
</head>
<body${bodyAttrs}>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header collapsible"><div class="inner"><a class="brand" href="${r}">${SITE_TITLE}</a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="site-nav" id="site-nav" aria-label="Site">${nav}</nav><button class="theme-toggle" type="button">Dark mode</button></div></header>
<main id="main" tabindex="-1">
${body}
</main>
<footer class="site-footer"><div class="inner">Results from the Brewers Association's official Great American Beer Festival winners lists. Brewery locations from Open Brewery DB and curated overrides. Charts by Apache ECharts. Estimates are marked (E). <a href="${REPO_URL}">Source and data</a>.</div></footer>
<script src="${r}assets/vendor/echarts.min.js"></script>
<script src="${r}assets/page.js" defer></script>
<script src="${r}assets/echarts-init.js" defer></script>
${scripts}
</body>
</html>
`;
}

function dashNav(activeHref, r) {
  return `<nav class="dash-nav">${DASHBOARDS.map(([href, label]) => `<a href="${r}${href}"${href === activeHref ? ' class="active"' : ''}>${esc(label)}</a>`).join('')}</nav>`;
}

function coveragePills(ds, r = './') {
  return `<div class="coverage">${ds.years.map((y) => `<a class="pill ${ds.coverage[y]}" href="${r}#year=${y}" title="${esc(ds.coverage[y])}">${y} · ${ds.coverage[y]}</a>`).join('')}</div>`;
}

function medalDot(m) {
  return `<span class="badge-medal ${String(m).toLowerCase()}"></span>${esc(m)}`;
}

function mapLink(loc) {
  if (loc.latitude && loc.longitude) return `https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=15/${loc.latitude}/${loc.longitude}`;
  const q = [loc.address_1 ?? loc.address, loc.city, loc.state].filter(Boolean).join(', ');
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`;
}

function beerCell(x, r) {
  const p = x.competition && x.competition !== 'GABF' ? null : profileFor(x);
  return p ? `<a href="${r}beers/${p.year}/${esc(p.stem)}/">${esc(x.beer_name)}</a>` : esc(x.beer_name);
}

// compact: drop columns whose value is the same on every row (the page already says it) and
// columns that are empty on every row. The Notes column is dropped whenever it is empty.
function medalTable(rows, { depth, showYear = true, showBrewery = false, showCompetition = false, compact: compactCols = false } = {}) {
  const r = '../'.repeat(depth);
  let cols = [];
  if (showYear) cols.push({ key: 'year', label: 'Year', numeric: true });
  if (showCompetition) cols.push({ key: 'competition', label: 'Competition' });
  cols.push({ key: 'medal', label: 'Medal', render: (x) => medalDot(x.medal) });
  cols.push({ key: 'beer_name', label: 'Beer', render: (x) => beerCell(x, r) });
  if (showBrewery) cols.push({ key: 'brewery_name', label: 'Brewery', render: (x) => `<a href="${r}breweries/${esc(x.brewery_slug)}/">${esc(x.brewery_name)}</a>${x.brewery_location ? ` <span class="muted small">(${esc(x.brewery_location)})</span>` : ''}` });
  else cols.push({ key: 'brewery_location', label: 'Location credited', render: (x) => esc(x.brewery_location || x.city) });
  cols.push({ key: 'city', label: 'City', render: (x) => `${esc(x.city)}, ${esc(x.state)}` });
  cols.push({ key: 'category_name', label: 'Category', droppable: true, render: (x) => `<a href="${r}categories/${esc(x.category_slug)}/">${esc(x.category_name)}</a>${x.special ? ' <span class="pill">special</span>' : ''}` });
  cols.push({ key: 'entries', label: 'Entrants', numeric: true, droppable: true, render: (x) => (x.entries ? fmt(x.entries) : '') });
  cols.push({ key: 'style_family', label: 'Style family', droppable: true });
  cols.push({ key: 'notes', label: 'Notes', render: (x) => `<span class="small muted">${esc(x.notes ?? '')}</span>` });
  const values = (c) => new Set(rows.map((x) => String(x[c.key] ?? '').trim()));
  cols = cols.filter((c) => {
    const v = values(c);
    if (v.size === 1 && v.has('') && (c.key === 'notes' || compactCols)) return false;
    return !(compactCols && c.droppable && v.size === 1);
  });
  return `<div class="table-wrap stack">${tableHtml(cols, rows)}</div>`;
}

// ---------- data exports ----------
const RESULT_FIELDS = ['year', 'competition', 'section', 'category_number', 'category_name', 'category_slug', 'category_type', 'special', 'entries', 'medal', 'beer_name', 'brewery_name', 'brewery_key', 'brewery_slug', 'brewery_location', 'city', 'state', 'state_name', 'region', 'division', 'fed_district', 'fed_district_name', 'fed_district_method', 'style_family', 'abv_min', 'abv_max', 'abv', 'abv_band', 'points', 'partial', 'draft', 'beer_profile'];

// Indicator tables trimmed for the browser: { state: { CA: { population: { 2024: n } } }, district: {...}, units }.
export function compactIndicators(ds) {
  const trim = (idx) => Object.fromEntries(Object.entries(idx).map(([k, inds]) => [k, Object.fromEntries(Object.entries(inds).map(([ind, years]) => [ind, Object.fromEntries(Object.entries(years).map(([y, v]) => [y, v.value]))]))]));
  const units = {};
  for (const idx of [ds.stateIndicators, ds.districtIndicators]) for (const inds of Object.values(idx)) for (const [ind, years] of Object.entries(inds)) units[ind] ??= Object.values(years)[0]?.unit ?? '';
  return { state: trim(ds.stateIndicators), district: trim(ds.districtIndicators), units };
}

// Population series for a group of states (Census region or division), summed per year.
function groupIndicators(ds, key) {
  const out = {};
  for (const s of ds.states) {
    const g = s[key];
    const series = ds.stateIndicators[s.state] ?? {};
    for (const ind of ['population', 'gdp_real']) {
      for (const [y, v] of Object.entries(series[ind] ?? {})) {
        const target = ((out[g] ??= {})[ind] ??= {});
        target[y] = (target[y] ?? 0) + v.value;
      }
    }
  }
  return out;
}

// The data every dashboard reads: decorated results, meta (years, coverage, states, lookups),
// and per-brewery summaries. Shared by the multi-page site (written as JSON files) and the
// single-file build (embedded in the HTML), so the two can never drift apart.
export function buildPayload(ds, cats) {
  const results = ds.results.map((r) => Object.fromEntries(RESULT_FIELDS.map((f) => [f, r[f] ?? null])));
  const meta = {
    years: ds.years,
    coverage: ds.coverage,
    latest_complete: ds.latestComplete,
    summary: ds.summary,
    states: ds.states.map((s) => ({ state: s.state, name: s.name, region: s.region, division: s.division, population_2020: Number(s.population_2020) })),
    fed_districts: ds.fedDistricts.map((f) => ({ state: f.state, district: Number(f.district_number), name: f.district_name, split: f.split === 'yes', secondary: f.secondary_districts, approximation: f.verified !== 'yes' })),
    indicators: compactIndicators(ds),
    abv_bands: ABV_BANDS,
    brewery_types: Object.fromEntries(ds.breweries.map((b) => [b.key, b.brewery_type])),
    ownership: Object.fromEntries(ds.breweries.filter((b) => b.ownership).map((b) => [b.key, { ownership_type: b.ownership.ownership_type, parent: b.ownership.parent }])),
    distribution: Object.fromEntries(ds.breweries.filter((b) => b.distribution_channel).map((b) => [b.key, b.distribution_channel])),
    categories: cats.map((c) => ({ name: c.name, slug: c.slug, style_family: c.style_family, special: c.special })),
  };
  const breweries = ds.breweries.map((b) => ({
    key: b.key, slug: b.slug, name: b.name, hq: b.hq, brewery_type: b.brewery_type, founded: b.founded, employees: b.employees, medals: b.medals.length, by_medal: b.by_medal, points: b.total_points, first_year: b.first_year, last_year: b.last_year, streak: b.streak, trend: b.trend,
    ownership: b.ownership ? { type: b.ownership.ownership_type, parent: b.ownership.parent, investor: b.ownership.investor } : null,
    distribution_channel: b.distribution_channel, distributors: b.distributors.map((d) => ({ channel: d.channel, distributor: d.distributor, territory: d.territory })),
    estimate: { barrels: b.estimate.barrels, basis: b.estimate.basis, revenue_usd: b.estimate.revenue.total_revenue_usd },
    financials: b.financials, has_profile: Boolean(b.profile), locations: b.locations, locations_count: b.locations_count,
  }));
  return { results, meta, breweries };
}

function writeData(ds, cats) {
  const { results, meta, breweries } = buildPayload(ds, cats);
  write('data/results.json', JSON.stringify(results));
  write('data/meta.json', JSON.stringify({ generated_at: new Date().toISOString(), ...meta }));
  write('data/breweries.json', JSON.stringify(breweries));
  write('data/categories.json', JSON.stringify(cats.map((c) => ({ name: c.name, slug: c.slug, style_family: c.style_family, special: c.special, ref: c.ref, years: c.years.map((y) => ({ year: y.year, entries: y.entries, number: y.number, medals: y.medals.length })) }))));
  mkdirSync(resolve(DIST, 'data/csv'), { recursive: true });
  for (const dir of [RESULTS, REFERENCE]) {
    for (const f of readdirSync(dir)) if (f.endsWith('.csv') || f.endsWith('.json')) cpSync(resolve(dir, f), resolve(DIST, 'data/csv', f));
  }
}

// ---------- dashboards ----------
function dashboardBody(ds, { href, intro, panels, r, extra = '' }) {
  return `
${dashNav(href, r)}
${intro}
${coveragePills(ds, r)}
<div id="filters" class="filters" aria-label="Filters"></div>
<div id="partial-notice"></div>
${extra}
<div class="dash-grid">${panels.map(([id, wide]) => `<div data-panel="${id}"${wide ? ' class="wide"' : ''}></div>`).join('')}</div>`;
}

function dashboardPages(ds) {
  const featured = ds.breweries.filter((b) => b.profile).slice(0, 6);
  const overview = dashboardBody(ds, { href: '', r: './', intro: `<h1>Great American Beer Festival results dashboards</h1><p class="lede">Every medal from the official winners lists with linked filters: year, medal, classic or special category, style family, category, region, state, brewery type, ownership, distribution, ABV band, and search. Every panel and the table read the same slice, panels respond to clicks, and each chart saves as a PNG from its toolbox.</p>`, panels: [['medals-by-year'], ['map'], ['by-family'], ['top-breweries']], extra: '<div id="stats" class="stats"></div>' });
  write('index.html', layout({ title: 'Dashboards', description: 'Interactive Great American Beer Festival medal dashboards.', body: `${overview}<h2>results</h2><div id="table"></div><h2>featured-deep-dives</h2><ul class="list-plain">${featured.map((b) => `<li><a href="breweries/${b.slug}/">${esc(b.name)}</a> <span class="muted small">${esc(b.hq.city)}, ${esc(b.hq.state)} · ${b.medals.length} GABF medals in the loaded data</span></li>`).join('')}</ul>`, depth: 0, active: 'Dashboards', scripts: '<script type="module" src="assets/dashboards.js"></script>' }));

  const geo = dashboardBody(ds, { href: 'dashboards/geography/', r: '../../', intro: '<h1>Geography</h1><p class="lede">Where the medals go: the US map, Census regions and divisions, Federal Reserve districts, medals per million residents and per $100 billion of real GDP using each medal year\'s population and GDP, and the demographic controls side by side. Click a state, region, or district to focus the other panels.</p>', panels: [['map', true], ['by-region'], ['by-division'], ['by-fed-district'], ['district-rates'], ['per-capita', true], ['per-gdp', true]], extra: '<div id="stats" class="stats"></div>' });
  write('dashboards/geography/index.html', layout({ title: 'Geography dashboard', description: 'GABF medals by state, region, Federal Reserve district, per capita, and per GDP.', body: `${geo}<h2>controls-by-state-and-district</h2><div id="controls-table"></div>`, depth: 2, active: 'Dashboards', scripts: '<script type="module" src="../../assets/dashboards.js"></script>' }));

  const cat = dashboardBody(ds, { href: 'dashboards/categories/', r: '../../', intro: '<h1>Categories</h1><p class="lede">Total entrants by category from the official category headers, with special categories (added ingredient, process, or catch-all) marked, the classic versus special split by year, and category size against how many breweries medal.</p>', panels: [['entrants', true], ['special-share'], ['entries-vs-breweries']], extra: '<div id="stats" class="stats"></div>' });
  write('dashboards/categories/index.html', layout({ title: 'Categories dashboard', description: 'GABF entrants by category and special categories.', body: `${cat}<h2>results</h2><div id="table"></div>`, depth: 2, active: 'Dashboards', scripts: '<script type="module" src="../../assets/dashboards.js"></script>' }));

  const defaultBrewery = ds.breweries.find((b) => b.profile)?.key ?? ds.breweries[0]?.key ?? '';
  const brew = dashboardBody(ds, { href: 'dashboards/breweries/', r: '../../', intro: '<h1>Breweries</h1><p class="lede">Pick a brewery to see its ten-year medal trend (with did-not-exist and not-yet-reported years marked), its categories, and the locations credited. The filters above still scope the stats and table.</p>', panels: [['brewery-trend', true], ['brewery-categories'], ['brewery-locations']], extra: '<div id="brewery-picker" class="picker"></div><div id="stats" class="stats"></div>' });
  write('dashboards/breweries/index.html', layout({ title: 'Breweries dashboard', description: 'Per-brewery GABF medal trends.', body: `${brew}<h2>results</h2><div id="table"></div>`, depth: 2, active: 'Dashboards', scripts: '<script type="module" src="../../assets/dashboards.js"></script>', bodyAttrs: ` data-default-brewery="${esc(defaultBrewery)}"` }));

  const econ = dashboardBody(ds, { href: 'dashboards/economics/', r: '../../', intro: '<h1>Ownership and economics</h1><p class="lede">Who owns the medalists and what they are worth: ownership share, parent companies, and estimated revenue, ARR, gross margin, EBITDA, and distribution channel per brewery. Every financial figure is an estimate (E); the method is on the About page.</p>', panels: [['ownership-share'], ['parents'], ['revenue-by-brewery', true]], extra: '<div id="stats" class="stats"></div>' });
  write('dashboards/economics/index.html', layout({ title: 'Ownership and economics dashboard', description: 'Ownership, investors, and estimated brewery economics.', body: `${econ}<h2>financials-by-brewery</h2><div id="financial-table"></div>`, depth: 2, active: 'Dashboards', scripts: '<script type="module" src="../../assets/dashboards.js"></script>' }));

  write('dashboards/index.html', layout({ title: 'Dashboards', description: 'All dashboards.', body: `<h1>Dashboards</h1><ul class="list-plain">${DASHBOARDS.map(([href, label, desc]) => `<li><a href="../${href}">${esc(label)}</a> <span class="muted">${esc(desc)}</span></li>`).join('')}</ul>`, depth: 1, active: 'Dashboards' }));
}

// ---------- breweries ----------
function breweryCharts(b, depth) {
  const r = '../'.repeat(depth);
  const years = b.trend;
  const byFamily = countBy(b.medals, 'style_family').map(([label, value]) => ({ label, value }));
  const byLocation = countBy(b.medals.map((m) => ({ ...m, loc: m.brewery_location || m.city })), 'loc').map(([label, value]) => ({ label, value }));
  const byCategory = countBy(b.medals, 'category_name').map(([label, value]) => ({ label, value, href: `${r}categories/${b.medals.find((m) => m.category_name === label).category_slug}/` }));
  const figures = [
    figure({ id: 'medals-by-year', title: 'GABF medals by year', subtitle: `${b.name}, ${years[0].year} to ${years[years.length - 1].year}`, height: 280, option: stackedColumnsOption({ labels: years.map((t) => t.year), notes: years.map((t) => STATUS_SHORT[t.status] ?? ''), series: [{ name: 'Gold', data: years.map((t) => t.gold), color: MEDAL_COLORS.Gold }, { name: 'Silver', data: years.map((t) => t.silver), color: MEDAL_COLORS.Silver }, { name: 'Bronze', data: years.map((t) => t.bronze), color: MEDAL_COLORS.Bronze }], saveName: `${b.slug}-medals-by-year` }), note: 'Labels under the axis: not yet founded, pending (results not yet published), partial (year only partially loaded), not loaded.', table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'gold', label: 'Gold', numeric: true }, { key: 'silver', label: 'Silver', numeric: true }, { key: 'bronze', label: 'Bronze', numeric: true }, { key: 'status', label: 'Status', render: (x) => esc(STATUS_LABELS[x.status] ?? x.status) }], years, { className: 'data-table' }) }),
    figure({ id: 'medals-by-style-family', title: 'GABF medals by style family', subtitle: 'all loaded years', height: Math.max(200, 36 * byFamily.length + 60), option: barsHOption({ items: byFamily, color: 'var(--series-3)', labelWidth: 170, saveName: `${b.slug}-style-families` }), table: tableHtml([{ key: 'label', label: 'Style family' }, { key: 'value', label: 'Medals', numeric: true }], byFamily, { className: 'data-table' }) }),
  ];
  if (byLocation.length > 1) figures.push(figure({ id: 'medals-by-location', title: 'GABF medals by location credited', subtitle: 'as printed in the winners list', height: Math.max(180, 36 * byLocation.length + 60), option: barsHOption({ items: byLocation, color: 'var(--series-2)', labelWidth: 170, saveName: `${b.slug}-locations` }), table: tableHtml([{ key: 'label', label: 'Location' }, { key: 'value', label: 'Medals', numeric: true }], byLocation, { className: 'data-table' }) }));
  if (byCategory.length > 1) figures.push(figure({ id: 'medals-by-category', title: 'GABF medals by category', height: Math.max(200, 34 * Math.min(byCategory.length, 15) + 60), option: barsHOption({ items: byCategory.slice(0, 15), labelWidth: 240, saveName: `${b.slug}-categories` }), table: tableHtml([{ key: 'label', label: 'Category' }, { key: 'value', label: 'Medals', numeric: true }], byCategory, { className: 'data-table' }) }));
  return figures.join('');
}

export function profileCard(b) {
  const o = b.ownership;
  const locs = b.location_list.length ? b.location_list.map((l) => ({ label: l.name, address_1: l.address, city: l.city, state: l.state, postal_code: l['postal-code'], opened: l.opened, kitchen: l.kitchen })) : (b.enriched?.locations ?? []).map((l) => ({ label: l.label || l.name, address_1: l.address_1 ?? l.street, city: l.city, state: l.state ?? l.state_province, postal_code: l.postal_code, latitude: l.latitude, longitude: l.longitude }));
  const est = b.estimate;
  const rev = est.revenue;
  const f = b.financials;
  return `<div class="card">
<h2>profile</h2>
<dl class="kv">
<dt>Type</dt><dd>${esc(b.brewery_type)}</dd>
<dt>Headquarters</dt><dd>${esc(b.hq.city)}, ${esc(b.hq.state)}</dd>
<dt>Founded</dt><dd>${b.founded ?? '<span class="muted">unknown</span>'}</dd>
<dt>Employees</dt><dd>${b.employees ? `${fmt(b.employees)} (reported)` : '<span class="muted">unknown</span>'}</dd>
<dt>Website</dt><dd>${b.website ? `<a href="${esc(b.website)}" rel="noopener">${esc(b.website.replace(/^https?:\/\//, ''))}</a>` : '<span class="muted">unknown</span>'}</dd>
<dt>Locations</dt><dd>${locs.length ? `<ul class="list-plain small">${locs.map((l) => `<li>${esc(l.label || l.city)}: ${esc([l.address_1, l.city, l.state, l.postal_code].filter(Boolean).join(', '))}${l.opened ? ` (opened ${esc(l.opened)})` : ''}${l.kitchen ? ', kitchen' : ''} <a href="${mapLink(l)}" rel="noopener">map</a></li>`).join('')}</ul>` : `<span class="muted">${b.locations_count} location(s) seen in results; run the enrichment for addresses</span>`}</dd>
<dt>Known for</dt><dd>${b.known_for.length ? esc(b.known_for.join('; ')) : `<span class="muted">${esc(countBy(b.medals, 'style_family').slice(0, 3).map(([k]) => k).join(', ') || 'no medals loaded')}</span>`}</dd>
</dl>
<h3>ownership-and-investors</h3>
${o ? `<dl class="kv">
<dt>Ownership</dt><dd><span class="pill ${o.ownership_type === 'independent' || o.ownership_type === 'employee-owned' ? 'good' : ''}">${esc(o.ownership_type)}</span></dd>
${o.parent ? `<dt>Parent</dt><dd>${esc(o.parent)}${o.parent_type ? ` <span class="muted small">(${esc(o.parent_type)})</span>` : ''}</dd>` : ''}
${o.investor ? `<dt>Investors</dt><dd>${esc(o.investor)}</dd>` : ''}
${o.stake ? `<dt>Stake</dt><dd>${esc(o.stake)}${o.deal_year ? `, ${esc(o.deal_year)}` : ''}</dd>` : ''}
<dt>BA independent</dt><dd>${esc(o.ba_independent)}</dd>
<dt>Status</dt><dd>${esc(o.status)}</dd>
<dt>Source</dt><dd class="small muted">${esc(o.source)}${o.verified === 'no' ? ' (curated from public announcements; not re-verified)' : ''}</dd>
</dl>` : '<p class="small muted">Not in the ownership table yet. Independent until shown otherwise; add a row to data/reference/ownership.csv when a deal, investor, or parent is confirmed.</p>'}
<h3>distribution</h3>
${b.distributors.length ? `<dl class="kv">${b.distributors.map((d) => `<dt>${esc(d.channel || 'channel')}</dt><dd>${d.distributor ? `${esc(d.distributor)}, ` : ''}${esc(d.territory)}${d.since ? ` (since ${esc(d.since)})` : ''}${d.verified === 'no' ? ' <span class="pill warn">unverified</span>' : ''}<div class="small muted">${esc(d.notes)}</div><div class="small muted">Source: ${esc(d.source)}</div></dd>`).join('')}</dl>` : `<p class="small muted">${b.distribution_channel ? esc(b.distribution_channel) : 'No distributor on record. Add a row to data/reference/distributors.csv (channel, wholesaler, territory, source).'}</p>`}
<h3>scale-estimates</h3>
<dl class="kv">
<dt>Barrels / year</dt><dd>${fmt(est.barrels)} <span class="muted small">(${esc(est.basis)}${est.confidence ? `, ${esc(est.confidence)} confidence` : ''}${est.basis === 'reported' ? '' : ', E'})</span></dd>
<dt>Equivalent</dt><dd class="small">${fmt(est.volume.gallons)} gallons; ${fmt(est.volume.cases_24x12_equivalent)} cases of 24 twelve-ounce; about ${fmt(est.volume.cans_16oz_equivalent)} sixteen-ounce cans packaged (${Math.round(est.volume.packaged_share * 100)}% packaged assumption) and ${fmt(est.volume.pints_equivalent_draft)} pints on draft</dd>
<dt>Revenue / ARR</dt><dd>${usd(rev.total_revenue_usd)} <span class="muted small">(range ${usd(rev.low_usd)} to ${usd(rev.high_usd)}, E)</span></dd>
<dt>Gross margin</dt><dd>${pctOf(f.gross_margin)} <span class="muted small">(gross profit ${usd(f.gross_profit_usd)}, E)</span></dd>
<dt>EBITDA</dt><dd>${usd(f.ebitda_usd)} at ${pctOf(f.ebitda_margin)} <span class="muted small">(range ${pctOf(f.ebitda_margin_low)} to ${pctOf(f.ebitda_margin_high)}, ${usd(f.ebitda_low_usd)} to ${usd(f.ebitda_high_usd)}, E)</span></dd>
<dt>Revenue per barrel</dt><dd>${f.revenue_per_barrel_usd ? usd(f.revenue_per_barrel_usd) : ''} <span class="muted small">(COGS assumption ${usd(f.cogs_per_barrel_usd)} per barrel, E)</span></dd>
<dt>Per location</dt><dd>${f.revenue_per_location_usd ? usd(f.revenue_per_location_usd) : ''} <span class="muted small">across ${b.locations_count} location(s)${b.has_kitchen ? ' with kitchen(s)' : ''}, E</span></dd>
${f.revenue_per_employee_usd ? `<dt>Per employee</dt><dd>${usd(f.revenue_per_employee_usd)} <span class="muted small">E</span></dd>` : ''}
</dl>
<p class="small muted">Method: <a href="../../about/#estimates">estimation notes</a>.</p>
</div>`;
}

function trendTimeline(b) {
  const last = b.trend.slice(-6);
  return `<ul class="timeline">${last.map((t) => `<li><span class="year">${t.year}</span><span>${t.total > 0 ? `${t.total} medal${t.total === 1 ? '' : 's'}: ${[t.gold ? `${t.gold} gold` : '', t.silver ? `${t.silver} silver` : '', t.bronze ? `${t.bronze} bronze` : ''].filter(Boolean).join(', ')}` : `<span class="status">${esc(STATUS_LABELS[t.status] ?? t.status)}</span>`}</span></li>`).join('')}</ul>`;
}

export function renderMarkdownBody(body) {
  return marked.parse(body.replace(/^#\s+.*\n+/m, ''), { gfm: true });
}

function breweryPage(ds, b) {
  const depth = 2;
  const partial = b.medals.some((m) => m.partial);
  const pills = [`<span class="pill">${esc(b.brewery_type)}</span>`, `<span class="pill">${esc(b.hq.city)}, ${esc(b.hq.state)}</span>`, b.founded ? `<span class="pill">founded ${b.founded}</span>` : '', b.ownership ? `<span class="pill ${['independent', 'employee-owned'].includes(b.ownership.ownership_type) ? 'good' : 'warn'}">${esc(b.ownership.ownership_type)}${b.ownership.parent ? `: ${esc(b.ownership.parent)}` : ''}</span>` : '', b.distribution_channel ? `<span class="pill">${esc(b.distribution_channel)}</span>` : '', b.streak > 1 ? `<span class="pill">${b.streak}-year medal streak</span>` : ''].join('');
  const cats = new Set(b.medals.map((m) => m.category_name)).size;
  const stats = [
    statTile({ label: 'GABF medals loaded', value: String(b.medals.length), note: partial ? 'some years partial' : '' }),
    statTile({ label: 'Gold, silver, bronze', medals: [b.by_medal.Gold, b.by_medal.Silver, b.by_medal.Bronze] }),
    statTile({ label: 'First GABF medal (loaded)', value: b.first_year ? String(b.first_year) : 'none' }),
    statTile({ label: 'Categories medaled', value: String(cats), note: `${b.medals.filter((m) => m.special).length} in special categories` }),
    statTile({ label: 'Estimated barrels / year', value: compact(b.estimate.barrels), note: b.estimate.basis === 'reported' ? 'reported' : 'estimate (E)' }),
    statTile({ label: 'Estimated ARR', value: usd(b.financials.arr_usd), note: `EBITDA ${usd(b.financials.ebitda_usd)} at ${pctOf(b.financials.ebitda_margin)} (E)` }),
  ].join('');
  const other = b.other_medals.length ? `<h2>other-competitions</h2>${medalTable(b.other_medals.sort((x, y) => y.year - x.year), { depth, showCompetition: true })}` : '';
  const deepDive = b.profile ? `<section class="prose">${renderMarkdownBody(b.profile.body)}</section>` : `<div class="notice">No deep dive yet. Scaffold one with <code>node scripts/scaffold-brewery.mjs --brewery "${esc(b.name)}"</code>, then research the brewery and fill in the sections.</div>`;
  const body = `
<p class="small"><a href="../">All breweries</a> · <a href="../../dashboards/breweries/#brewery=${encodeURIComponent(b.key)}">open in the breweries dashboard</a></p>
<h1>${esc(b.name)}</h1>
<p class="lede">${pills}${b.website ? ` <a href="${esc(b.website)}" rel="noopener">website</a>` : ''}</p>
${partial ? '<div class="notice">Some years for this brewery come from seed rows (secondary sources) rather than the ingested official list. The official list wins when it is loaded.</div>' : ''}
<div class="stats">${stats}</div>
<div class="hero">
<div class="grid hero-charts">${breweryCharts(b, depth)}</div>
${profileCard(b)}
</div>
<h2>gabf-medal-history</h2>
${b.medals.length ? medalTable([...b.medals].sort((x, y) => y.year - x.year || x.medal_rank - y.medal_rank), { depth }) : '<p class="muted">No GABF medals in the loaded data.</p>'}
${other}
<h2>recent-trend</h2>
${trendTimeline(b)}
<h2>deep-dive</h2>
${deepDive}`;
  write(`breweries/${b.slug}/index.html`, layout({ title: b.name, description: `${b.name}: GABF medal history, locations, ownership, distribution, and scale estimates.`, body, depth, active: 'Breweries' }));
}

function breweriesIndex(ds) {
  const rows = ds.breweries;
  const cols = [
    { key: 'name', label: 'Brewery', render: (b) => `<a href="${esc(b.slug)}/">${esc(b.name)}</a>${b.profile ? ' <span class="pill good">deep dive</span>' : ''}` },
    { key: 'hq', label: 'HQ', render: (b) => `${esc(b.hq.city)}, ${esc(b.hq.state)}` },
    { key: 'brewery_type', label: 'Type' },
    { key: 'medals', label: 'Medals', numeric: true, render: (b) => b.medals.length },
    { key: 'gsb', label: 'G / S / B', render: (b) => `${b.by_medal.Gold} / ${b.by_medal.Silver} / ${b.by_medal.Bronze}` },
    { key: 'points', label: 'Points', numeric: true, render: (b) => b.total_points },
    { key: 'first', label: 'First', numeric: true, render: (b) => b.first_year ?? '' },
    { key: 'last', label: 'Latest', numeric: true, render: (b) => b.last_year ?? '' },
    { key: 'streak', label: 'Streak', numeric: true, render: (b) => b.streak },
    { key: 'ownership', label: 'Ownership', render: (b) => (b.ownership ? `${esc(b.ownership.ownership_type)}${b.ownership.parent ? ` (${esc(b.ownership.parent)})` : ''}` : '<span class="muted">unlisted</span>') },
    { key: 'distribution', label: 'Distribution', render: (b) => esc(b.distribution_channel || '') },
    { key: 'arr', label: 'ARR (E)', numeric: true, render: (b) => usd(b.financials.arr_usd) },
  ];
  const body = `
<h1>Breweries</h1>
<p class="lede">${rows.length} breweries in the loaded results, ranked by points (gold 3, silver 2, bronze 1). Click a column to sort. Type to filter. ARR is an estimate (E).</p>
<p><label class="visually-hidden" for="q">Filter breweries</label><input id="q" class="search-input" type="search" placeholder="Filter by name, city, state, type, or ownership"></p>
<div class="table-wrap" id="brewery-table">${tableHtml(cols, rows)}</div>
<script>
(function(){var q=document.getElementById('q');var rows=Array.prototype.slice.call(document.querySelectorAll('#brewery-table tbody tr'));q.addEventListener('input',function(){var v=q.value.trim().toLowerCase();rows.forEach(function(r){r.style.display=!v||r.textContent.toLowerCase().indexOf(v)>=0?'':'none';});});})();
</script>`;
  write('breweries/index.html', layout({ title: 'Breweries', description: 'Every medal-winning brewery in the loaded GABF results.', body, depth: 1, active: 'Breweries' }));
}

// ---------- categories ----------
// Category names drift between years ("American-Style Pilsener" and "American Pilsener"). Fold away
// accents, case, "-Style", "&" versus "and", a trailing "Beer", and punctuation, then require exact
// equality, so "Juicy or Hazy IPA" never borrows the imperial category's text.
export const foldCategory = (name) => String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[-\s]style\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+beers?$/, '').replace(/\s+/g, '');

function categoryRef(ds, c) {
  if (c.ref?.description) return c.ref;
  const want = foldCategory(c.name);
  const hit = ds.categories.find((row) => row.description && foldCategory(row.category_name) === want);
  return hit ? { ...(c.ref ?? {}), description: hit.description, guideline_source: hit.guideline_source, confidence: hit.confidence, variant_of: hit.category_name } : c.ref;
}

function categoryPage(ds, c) {
  const depth = 2;
  const ref = categoryRef(ds, c);
  const entriesYears = c.years.filter((y) => y.entries);
  const chart = entriesYears.length > 1 ? figure({ id: 'entries-by-year', title: 'Entrants by year', subtitle: 'how competitive the category is', height: 260, option: lineOption({ labels: entriesYears.map((y) => y.year), series: [{ name: 'Entries', data: entriesYears.map((y) => y.entries), color: SERIES_COLORS[0] }], saveName: `${c.slug}-entries` }), table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'entries', label: 'Entries', numeric: true }], entriesYears, { className: 'data-table' }) }) : '';
  const body = `
<p class="small"><a href="../">All categories</a></p>
<h1>${esc(c.name)}</h1>
<p class="lede"><span class="pill ${c.special ? 'warn' : 'good'}">${c.special ? 'special category' : 'classic style category'}</span><span class="pill">${esc(c.style_family)}</span>${ref?.abv_min ? `<span class="pill">ABV ${esc(ref.abv_min)} to ${esc(ref.abv_max)}%</span>` : ''}${ref?.ibu_min ? `<span class="pill">IBU ${esc(ref.ibu_min)} to ${esc(ref.ibu_max)}</span>` : ''}${ref?.srm_min ? `<span class="pill">SRM ${esc(ref.srm_min)} to ${esc(ref.srm_max)}</span>` : ''}${c.latest_entries ? `<span class="pill">${fmt(c.latest_entries)} entrants in ${c.latest_entries_year}</span>` : ''} <a href="../../#category_name=${encodeURIComponent(c.name)}">open in dashboards</a></p>
<div class="grid two">
<div class="card"><h2>definition</h2><p>${ref?.description ? esc(ref.description) : '<span class="muted">No style description is on file for this category yet.</span>'}</p><p class="small muted">${c.special ? 'Special categories are judged on an added ingredient, process, or non-standard base rather than a single classic style.' : 'Classic style categories are judged against a single Brewers Association style description.'}${ref?.guideline_source ? ` Source: ${esc(ref.guideline_source)}${ref.confidence ? ` (${esc(ref.confidence)})` : ''}${ref.variant_of ? `, listed as ${esc(ref.variant_of)}` : ''}.` : ''}</p></div>
${chart || `<div class="card"><h2>entrants</h2><p class="muted">${entriesYears.length === 1 ? `${fmt(entriesYears[0].entries)} entries in ${entriesYears[0].year}. A trend appears once a second year with entry counts is loaded.` : 'Entry counts appear once a full winners list is ingested for a year this category ran.'}</p></div>`}
</div>
<h2>medalists-by-year</h2>
${[...c.years].reverse().map((y) => `<h3>${y.year}${y.number ? ` · category ${esc(y.number)}` : ''}${y.entries ? ` · ${fmt(y.entries)} entrants` : ''}</h3>${medalTable(y.medals.sort((a, b) => a.medal_rank - b.medal_rank), { depth, showYear: false, showBrewery: true, compact: true })}`).join('')}`;
  write(`categories/${c.slug}/index.html`, layout({ title: c.name, description: `${c.name}: definition, entrants by year, and GABF medalists.`, body, depth, active: 'Categories' }));
}

function categoriesIndex(ds, cats) {
  const families = countBy(ds.results, 'style_family').map(([label, value]) => ({ label, value }));
  const cols = [
    { key: 'name', label: 'Category', render: (c) => `<a href="${esc(c.slug)}/">${esc(c.name)}</a>` },
    { key: 'type', label: 'Type', render: (c) => (c.special ? '<span class="pill warn">special</span>' : '<span class="pill good">classic</span>') },
    { key: 'style_family', label: 'Style family' },
    { key: 'abv', label: 'ABV (style)', render: (c) => (c.ref?.abv_min ? `${esc(c.ref.abv_min)} to ${esc(c.ref.abv_max)}%` : '') },
    { key: 'entries', label: 'Latest entrants', numeric: true, render: (c) => fmt(c.latest_entries) },
    { key: 'medals', label: 'Medals loaded', numeric: true, render: (c) => c.rows.length },
    { key: 'years', label: 'Years', render: (c) => c.years.map((y) => y.year).join(', ') },
  ];
  const special = cats.filter((c) => c.special).length;
  const body = `
<h1>Categories</h1>
<p class="lede">${cats.length} GABF categories seen in the loaded results (${special} special, ${cats.length - special} classic), with the style family used for browsing, the style's ABV range, and total entrants from the latest year with counts. Full category lists (around 100 per year) appear once each year's official list is ingested.</p>
<div class="grid two">
${figure({ id: 'medals-by-family', title: 'Medals by style family', subtitle: 'all loaded years', height: Math.max(220, 36 * families.length + 60), option: barsHOption({ items: families, color: 'var(--series-3)', saveName: 'medals-by-style-family' }), table: tableHtml([{ key: 'label', label: 'Style family' }, { key: 'value', label: 'Medals', numeric: true }], families, { className: 'data-table' }) })}
<div class="card"><h2>classic-versus-special</h2><p class="small">A special category is judged on an added ingredient, process, or non-standard base (fruit, spice, coffee, barrel, smoke, gluten-free, non-alcohol, hybrid, specialty IPA, session beer, Pro-Am, collaboration, cider) rather than a single classic style. The rule lives in scripts/lib/style-families.mjs and the per-category flag in data/reference/categories.csv.</p><p class="small">Style families are a browsing layer over the official categories: IPA, Pale Ale, Lager, Pilsner, Wheat, Stout and Porter, Belgian and French, Sour and Wild, Strong and Barrel-Aged, Brown Amber and Red, British and Irish, German Ale, Fruit Spice and Specialty, Smoke and Wood, Gluten-Free and Non-Alcoholic, Cider and Mead, Pro-Am and Collaboration.</p></div>
</div>
<h2>all-categories</h2>
<div class="table-wrap">${tableHtml(cols, cats)}</div>`;
  write('categories/index.html', layout({ title: 'Categories', description: 'GABF categories, style families, special categories, and ABV ranges.', body, depth: 1, active: 'Categories' }));
}

// ---------- reports ----------
const REPORTS = [
  ['top-breweries', 'Top breweries', 'Medal and point leaders, streaks, and first-time winners.'],
  ['top-categories', 'Top categories', 'Most competitive categories by entrants and the style families that collect the most medals.'],
  ['by-state', 'By state', 'Medals by state with population-adjusted rates.'],
  ['by-region', 'By region', 'Census regions and divisions.'],
  ['ownership', 'Ownership and investors', 'Independent versus large-brewer-owned medalists, parents, and investors.'],
  ['economics', 'Economics', 'Estimated barrels, ARR, margins, and distribution for every medalist.'],
  ['trends', 'Trends', 'Entries, medals, breweries, and style-family share over the years.'],
  ['brewery-of-the-year', 'Brewery of the Year', 'Brewery and Brewer of the Year awards by size bracket.'],
];

function reportsIndex(ds) {
  const body = `<h1>Reports</h1><p class="lede">Pre-built views over the loaded results. Each chart carries a table view and saves as a PNG from its toolbox.</p><ul class="list-plain">${REPORTS.map(([slug, title, desc]) => `<li><a href="${slug}/">${esc(title)}</a> <span class="muted">${esc(desc)}</span></li>`).join('')}</ul>${coveragePills(ds, '../')}`;
  write('reports/index.html', layout({ title: 'Reports', description: 'GABF analysis reports.', body, depth: 1, active: 'Reports' }));
}

function reportLayout(ds, slug, title, body) {
  write(`reports/${slug}/index.html`, layout({ title, description: `${title} report.`, body: `<p class="small"><a href="../">All reports</a></p><h1>${esc(title)}</h1>${body}`, depth: 2, active: 'Reports' }));
}

function barsFigure(id, title, items, { subtitle = '', color, labelWidth = 200, valueName = 'Medals', note = '', labelKey = 'label' } = {}) {
  return figure({ id, title, subtitle, height: Math.max(200, 34 * items.length + 60), option: barsHOption({ items, color, labelWidth, valueName, saveName: id }), note, table: tableHtml([{ key: labelKey, label: 'Name' }, { key: 'value', label: valueName, numeric: true }], items, { className: 'data-table' }) });
}

function topBreweries(ds) {
  const r = '../../';
  const all = ds.breweries.filter((b) => b.medals.length).slice(0, 50);
  const bars = all.slice(0, 15).map((b) => ({ label: b.name, value: b.total_points, href: `${r}breweries/${b.slug}/` }));
  const cols = [
    { key: 'rank', label: '#', numeric: true, render: (b) => all.indexOf(b) + 1 },
    { key: 'name', label: 'Brewery', render: (b) => `<a href="${r}breweries/${b.slug}/">${esc(b.name)}</a>` },
    { key: 'hq', label: 'HQ', render: (b) => `${esc(b.hq.city)}, ${esc(b.hq.state)}` },
    { key: 'points', label: 'Points', numeric: true, render: (b) => b.total_points },
    { key: 'medals', label: 'Medals', numeric: true, render: (b) => b.medals.length },
    { key: 'gsb', label: 'G / S / B', render: (b) => `${b.by_medal.Gold} / ${b.by_medal.Silver} / ${b.by_medal.Bronze}` },
    { key: 'first', label: 'First', numeric: true, render: (b) => b.first_year },
    { key: 'streak', label: 'Streak', numeric: true, render: (b) => b.streak },
    { key: 'ownership', label: 'Ownership', render: (b) => (b.ownership ? esc(b.ownership.ownership_type) : '') },
  ];
  const perYear = ds.years.filter((y) => ds.coverage[y] !== 'pending').map((y) => {
    const rows = ds.results.filter((x) => x.year === y);
    const byB = new Map();
    for (const x of rows) {
      const cur = byB.get(x.brewery_key) ?? { name: x.brewery_name, slug: x.brewery_slug, medals: 0, points: 0, g: 0, s: 0, b: 0 };
      cur.medals += 1; cur.points += x.points; if (x.medal === 'Gold') cur.g += 1; if (x.medal === 'Silver') cur.s += 1; if (x.medal === 'Bronze') cur.b += 1;
      byB.set(x.brewery_key, cur);
    }
    return { year: y, list: [...byB.values()].sort((a, b) => b.points - a.points || b.medals - a.medals).slice(0, 25), coverage: ds.coverage[y] };
  }).reverse();
  const firstTimers = ds.coverage[ds.latestComplete] === 'complete' ? ds.breweries.filter((b) => b.first_year === ds.latestComplete) : [];
  const body = `
<p class="lede">Points weight gold 3, silver 2, bronze 1. Years marked partial contain only seed rows, so rankings firm up as official lists are ingested.</p>
<div class="grid two">
${barsFigure('top-breweries-points', 'Top 15 breweries by points', bars, { subtitle: 'all loaded years', color: 'var(--series-2)', labelWidth: 220, valueName: 'Points' })}
<div class="card"><h2>streaks-and-first-timers</h2><p class="small">Longest active medal streaks (consecutive loaded years through ${ds.latestComplete}):</p><ol class="small">${ds.breweries.filter((b) => b.streak > 1).sort((a, b) => b.streak - a.streak).slice(0, 10).map((b) => `<li><a href="${r}breweries/${b.slug}/">${esc(b.name)}</a>: ${b.streak} years</li>`).join('') || '<li class="muted">No multi-year streaks can be computed until consecutive complete years are loaded.</li>'}</ol><p class="small">First-time medalists in ${ds.latestComplete}: ${firstTimers.length ? firstTimers.map((b) => `<a href="${r}breweries/${b.slug}/">${esc(b.name)}</a>`).join(', ') : '<span class="muted">available once the latest year is completely loaded</span>'}.</p></div>
</div>
<h2>all-loaded-years</h2>
<div class="table-wrap">${tableHtml(cols, all)}</div>
${perYear.map((p) => `<h2>${p.year}${p.coverage !== 'complete' ? ` <span class="pill ${p.coverage}">${p.coverage}</span>` : ''}</h2><div class="table-wrap">${tableHtml([{ key: 'name', label: 'Brewery', render: (x) => `<a href="${r}breweries/${x.slug}/">${esc(x.name)}</a>` }, { key: 'points', label: 'Points', numeric: true }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'gsb', label: 'G / S / B', render: (x) => `${x.g} / ${x.s} / ${x.b}` }], p.list)}</div>`).join('')}`;
  reportLayout(ds, 'top-breweries', 'Top breweries', body);
}

function topCategories(ds, cats) {
  const r = '../../';
  const withEntries = cats.filter((c) => c.latest_entries).sort((a, b) => b.latest_entries - a.latest_entries);
  const bars = withEntries.slice(0, 20).map((c) => ({ label: `${c.name}${c.special ? ' (special)' : ''}`, value: c.latest_entries, href: `${r}categories/${c.slug}/` }));
  const families = countBy(ds.results, 'style_family').map(([label, value]) => ({ label, value }));
  const body = `
<p class="lede">Total entrants per category come from the category headers of the official list and show where competition is fiercest. Special categories (added ingredient, process, or catch-all) are marked. Medal counts are fixed at three per category per year, so family totals mostly reflect how many categories a family spans.</p>
<div class="grid two">
${withEntries.length ? barsFigure('most-entered', 'Most entered categories', bars, { subtitle: 'latest year with entry counts', labelWidth: 250, valueName: 'Entrants' }) : '<div class="card"><h2>most-entered-categories</h2><p class="muted">Appears once a full winners list with entry counts is ingested.</p></div>'}
${barsFigure('family-medals', 'Medals by style family', families, { color: 'var(--series-3)' })}
</div>
<h2>all-categories</h2>
<div class="table-wrap">${tableHtml([{ key: 'name', label: 'Category', render: (c) => `<a href="${r}categories/${c.slug}/">${esc(c.name)}</a>` }, { key: 'type', label: 'Type', render: (c) => (c.special ? 'special' : 'classic') }, { key: 'style_family', label: 'Style family' }, { key: 'entries', label: 'Latest entrants', numeric: true, render: (c) => fmt(c.latest_entries) }, { key: 'year', label: 'Year', numeric: true, render: (c) => c.latest_entries_year ?? '' }, { key: 'medals', label: 'Medals loaded', numeric: true, render: (c) => c.rows.length }, { key: 'abv', label: 'ABV (style)', render: (c) => (c.ref?.abv_min ? `${esc(c.ref.abv_min)} to ${esc(c.ref.abv_max)}%` : '') }], cats)}</div>`;
  reportLayout(ds, 'top-categories', 'Top categories', body);
}

function byState(ds) {
  const ind = compactIndicators(ds).state;
  const rates = medalRates(ds.results, (x) => x.state, ind);
  const rows = ds.states.map((s) => {
    const medals = ds.results.filter((x) => x.state === s.state);
    const rate = rates.get(s.state);
    return { ...s, medals: medals.length, latest: medals.filter((x) => x.year === ds.latestComplete).length, breweries: new Set(medals.map((m) => m.brewery_key)).size, gold: medals.filter((m) => m.medal === 'Gold').length, per_million: rate?.per_million ?? 0, per_100b: rate?.per_100b_gdp ?? 0, pop_latest: ind[s.state]?.population?.[ds.latestComplete] ?? null };
  }).filter((s) => s.medals > 0).sort((a, b) => b.medals - a.medals);
  const mapData = ds.states.map((s) => ({ name: s.name, value: rows.find((x) => x.state === s.state)?.medals ?? 0 }));
  const perCap = [...rows].sort((a, b) => b.per_million - a.per_million).slice(0, 20).map((s) => ({ label: s.name, value: Number(s.per_million.toFixed(2)) }));
  const body = `
<p class="lede">Medals by state across all loaded years, with population and GDP adjusted rates: each medal counts against its own year's Census population estimate and BEA real GDP (2026 medals use 2025, the latest published year). The geography dashboard adds Federal Reserve districts, demographic controls, filters, and click-to-focus.</p>
${figure({ id: 'state-map', title: 'Medals by state', subtitle: 'all loaded years', height: 460, option: mapOption({ data: mapData, saveName: 'medals-by-state-map' }), table: tableHtml([{ key: 'name', label: 'State' }, { key: 'value', label: 'Medals', numeric: true }], mapData.filter((d) => d.value).sort((a, b) => b.value - a.value), { className: 'data-table' }) })}
<div class="grid two" style="margin-top:16px">
${barsFigure('state-medals', 'Medals by state', rows.slice(0, 20).map((s) => ({ label: s.name, value: s.medals, href: `../../#state=${s.state}` })), { subtitle: 'top 20' })}
${barsFigure('state-per-capita', 'Medals per million residents', perCap, { subtitle: 'top 20, all loaded years, annual population estimates', color: 'var(--series-3)', valueName: 'Per million' })}
</div>
<h2>all-states</h2>
<div class="table-wrap">${tableHtml([{ key: 'name', label: 'State', render: (s) => `<a href="../../#state=${s.state}">${esc(s.name)}</a>` }, { key: 'region', label: 'Region' }, { key: 'division', label: 'Division' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'gold', label: 'Gold', numeric: true }, { key: 'latest', label: `${ds.latestComplete}`, numeric: true }, { key: 'breweries', label: 'Breweries', numeric: true }, { key: 'pop_latest', label: `Population ${ds.latestComplete}`, numeric: true, render: (s) => fmt(s.pop_latest) }, { key: 'per_million', label: 'Per million', numeric: true, render: (s) => s.per_million.toFixed(2) }, { key: 'per_100b', label: 'Per $100B real GDP', numeric: true, render: (s) => s.per_100b.toFixed(2) }], rows)}</div>`;
  reportLayout(ds, 'by-state', 'By state', body);
}

function byRegion(ds) {
  const roll = (key) => {
    const rates = medalRates(ds.results, (x) => x[key], groupIndicators(ds, key));
    const m = new Map();
    for (const x of ds.results) {
      const k = x[key] || '(unknown)';
      const cur = m.get(k) ?? { name: k, medals: 0, gold: 0, breweries: new Set(), states: new Set(), pop: 0 };
      cur.medals += 1; if (x.medal === 'Gold') cur.gold += 1; cur.breweries.add(x.brewery_key); cur.states.add(x.state);
      m.set(k, cur);
    }
    for (const cur of m.values()) {
      cur.per_million = rates.get(cur.name)?.per_million ?? 0;
      cur.breweries = cur.breweries.size; cur.states = cur.states.size;
    }
    return [...m.values()].sort((a, b) => b.medals - a.medals);
  };
  const regions = roll('region');
  const divisions = roll('division');
  const cols = [{ key: 'name', label: 'Name' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'gold', label: 'Gold', numeric: true }, { key: 'breweries', label: 'Breweries', numeric: true }, { key: 'states', label: 'States', numeric: true }, { key: 'per_million', label: 'Per million', numeric: true, render: (x) => x.per_million.toFixed(2) }];
  const body = `
<p class="lede">Census regions (Northeast, Midwest, South, West) and their divisions, across all loaded years. Per million uses each medal year's Census population estimate.</p>
<div class="grid two">
${figure({ id: 'region-medals', title: 'Medals by region', height: 220, option: barsHOption({ items: regions.map((x) => ({ label: x.name, value: x.medals })), saveName: 'medals-by-region' }), table: tableHtml(cols, regions, { className: 'data-table' }) })}
${figure({ id: 'division-medals', title: 'Medals by division', height: Math.max(220, 36 * divisions.length + 60), option: barsHOption({ items: divisions.map((x) => ({ label: x.name, value: x.medals })), color: 'var(--series-3)', saveName: 'medals-by-division' }), table: tableHtml(cols, divisions, { className: 'data-table' }) })}
</div>`;
  reportLayout(ds, 'by-region', 'By region', body);
}

function ownershipReport(ds) {
  const r = '../../';
  const typeOf = (x) => ds.breweries.find((b) => b.key === x.brewery_key)?.ownership?.ownership_type ?? 'unlisted (presumed independent)';
  const byType = countBy(ds.results.map((x) => ({ t: typeOf(x) })), 't').map(([label, value]) => ({ label, value }));
  const owned = ds.breweries.filter((b) => b.ownership && !['independent', 'employee-owned'].includes(b.ownership.ownership_type));
  const parents = countBy(owned.flatMap((b) => b.medals.map(() => ({ p: b.ownership.parent || b.ownership.ownership_type }))), 'p').map(([label, value]) => ({ label, value }));
  const total = ds.results.length;
  const indep = byType.filter((x) => ['independent', 'employee-owned', 'unlisted (presumed independent)'].includes(x.label)).reduce((s, x) => s + x.value, 0);
  const body = `
<p class="lede">Who owns the medal winners. The Brewers Association counts a brewer as independent when less than 25 percent is owned or controlled by a non-craft alcohol company. The ownership table is curated from public deal announcements and marked unverified until each row is checked; breweries not in the table are presumed independent.</p>
<div class="stats">${statTile({ label: 'Medals to independents', value: pct(indep, total), note: `${fmt(indep)} of ${fmt(total)} loaded medals` })}${statTile({ label: 'Medalists in ownership table', value: String(ds.breweries.filter((b) => b.ownership).length) })}${statTile({ label: 'Large-brewer or conglomerate owned medalists', value: String(owned.length) })}</div>
<div class="grid two">
${barsFigure('ownership-type', 'Medals by ownership type', byType, { labelWidth: 230 })}
${parents.length ? barsFigure('parents', 'Medals by parent company', parents, { subtitle: 'non-independent owners', color: 'var(--series-2)', labelWidth: 230 }) : '<div class="card"><h2>parents</h2><p class="muted">No medalist in the loaded results is owned by a large brewer or conglomerate yet. This fills in as official lists are ingested.</p></div>'}
</div>
<h2>ownership-table</h2>
<p class="small muted">All curated rows, whether or not the brewery has medaled in the loaded years. Edit data/reference/ownership.csv to add deals, investors, and verification.</p>
<div class="table-wrap">${tableHtml([
    { key: 'brewery_name', label: 'Brewery', render: (o) => { const b = ds.breweries.find((x) => x.ownership === o); return b ? `<a href="${r}breweries/${b.slug}/">${esc(o.brewery_name)}</a>` : esc(o.brewery_name); } },
    { key: 'hq', label: 'HQ', render: (o) => `${esc(o.hq_city)}, ${esc(o.hq_state)}` },
    { key: 'ownership_type', label: 'Type' },
    { key: 'parent', label: 'Parent' },
    { key: 'investor', label: 'Investors' },
    { key: 'stake', label: 'Stake' },
    { key: 'deal_year', label: 'Year', numeric: true },
    { key: 'ba_independent', label: 'BA independent' },
    { key: 'status', label: 'Status' },
    { key: 'verified', label: 'Verified' },
  ], ds.ownership)}</div>`;
  reportLayout(ds, 'ownership', 'Ownership and investors', body);
}

function economicsReport(ds) {
  const r = '../../';
  const list = ds.breweries.filter((b) => b.medals.length).sort((a, b) => b.financials.arr_usd - a.financials.arr_usd);
  const bars = list.slice(0, 15).map((b) => ({ label: b.name, value: b.financials.arr_usd, href: `${r}breweries/${b.slug}/` }));
  const body = `
<p class="lede">Estimated economics for every medalist: barrels, ARR (annual revenue run rate), gross margin, EBITDA with a channel-based range, and distribution channel. Every figure is an estimate (E) unless a reported production number exists; the method and parameters are on the About page and in data/reference/estimation-parameters.json.</p>
${barsFigure('arr-by-brewery', 'Estimated ARR by brewery (E)', bars, { subtitle: 'top 15 of the loaded medalists', color: 'var(--series-6)', labelWidth: 220, valueName: 'ARR USD' })}
<h2>all-medalists</h2>
<div class="table-wrap">${tableHtml([
    { key: 'name', label: 'Brewery', render: (b) => `<a href="${r}breweries/${b.slug}/">${esc(b.name)}</a>` },
    { key: 'type', label: 'Type', render: (b) => esc(b.brewery_type) },
    { key: 'locations', label: 'Locations', numeric: true, render: (b) => b.locations_count },
    { key: 'barrels', label: 'Barrels (E)', numeric: true, render: (b) => fmt(b.estimate.barrels) },
    { key: 'basis', label: 'Volume basis', render: (b) => esc(b.estimate.basis) },
    { key: 'cases', label: 'Case equiv.', numeric: true, render: (b) => fmt(b.estimate.volume.cases_24x12_equivalent) },
    { key: 'arr', label: 'ARR USD (E)', numeric: true, render: (b) => usd(b.financials.arr_usd) },
    { key: 'gm', label: 'Gross margin', numeric: true, render: (b) => pctOf(b.financials.gross_margin) },
    { key: 'ebitda', label: 'EBITDA USD (E)', numeric: true, render: (b) => usd(b.financials.ebitda_usd) },
    { key: 'ebitda_range', label: 'EBITDA margin range', render: (b) => `${pctOf(b.financials.ebitda_margin_low)} to ${pctOf(b.financials.ebitda_margin_high)}` },
    { key: 'channel', label: 'Distribution', render: (b) => esc(b.distribution_channel || 'unknown') },
    { key: 'ownership', label: 'Ownership', render: (b) => (b.ownership ? esc(b.ownership.ownership_type) : '<span class="muted">unlisted</span>') },
  ], list)}</div>`;
  reportLayout(ds, 'economics', 'Economics', body);
}

function trendsReport(ds) {
  const summary = ds.summary.filter((s) => s.competition === 'GABF').sort((a, b) => Number(a.year) - Number(b.year));
  const labels = summary.map((s) => s.year);
  const familiesAll = countBy(ds.results, 'style_family').slice(0, 7).map(([k]) => k);
  const famSeries = [...familiesAll, 'Other'].map((f, i) => ({ name: f, color: SERIES_COLORS[i % 8], data: ds.years.map((y) => ds.results.filter((x) => x.year === y && (familiesAll.includes(x.style_family) ? x.style_family === f : f === 'Other')).length) }));
  const loadedYears = ds.years.filter((y) => ds.coverage[y] === 'complete');
  let movers = '';
  if (loadedYears.length >= 2) {
    const [prev, last] = loadedYears.slice(-2);
    const diffs = ds.breweries.map((b) => ({ b, d: b.medals.filter((m) => m.year === last).length - b.medals.filter((m) => m.year === prev).length })).filter((x) => x.d !== 0).sort((a, b) => b.d - a.d);
    movers = `<h2>movers-${prev}-to-${last}</h2><div class="grid two"><div class="card"><h3>gained</h3><ol class="small">${diffs.slice(0, 10).map((x) => `<li><a href="../../breweries/${x.b.slug}/">${esc(x.b.name)}</a> +${x.d}</li>`).join('')}</ol></div><div class="card"><h3>lost</h3><ol class="small">${diffs.slice(-10).reverse().filter((x) => x.d < 0).map((x) => `<li><a href="../../breweries/${x.b.slug}/">${esc(x.b.name)}</a> ${x.d}</li>`).join('')}</ol></div></div>`;
  } else movers = '<div class="notice">Year-over-year movers appear once two consecutive complete years are loaded.</div>';
  const body = `
<p class="lede">Competition scale from the Brewers Association's annual releases, plus style-family share from the loaded results. Blank cells are figures the release did not state or that are still to be filled from the ingested list.</p>
<div class="grid two">
${figure({ id: 'entries-trend', title: 'Entries judged', height: 260, option: lineOption({ labels, series: [{ name: 'Entries', data: summary.map((s) => (s.entries ? Number(s.entries) : null)), color: SERIES_COLORS[0] }], saveName: 'entries-judged' }), table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'entries', label: 'Entries', numeric: true, render: (s) => fmt(s.entries) }], summary, { className: 'data-table' }) })}
${figure({ id: 'medals-breweries-trend', title: 'Medals awarded and breweries entering', height: 260, option: lineOption({ labels, series: [{ name: 'Medals', data: summary.map((s) => (s.medals ? Number(s.medals) : null)), color: SERIES_COLORS[0] }, { name: 'Breweries entering', data: summary.map((s) => (s.entering_breweries ? Number(s.entering_breweries) : null)), color: SERIES_COLORS[1] }], saveName: 'medals-and-breweries' }), table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'medals', label: 'Medals', numeric: true, render: (s) => fmt(s.medals) }, { key: 'entering_breweries', label: 'Breweries entering', numeric: true, render: (s) => fmt(s.entering_breweries) }], summary, { className: 'data-table' }) })}
</div>
${figure({ id: 'family-share', title: 'Medals by style family and year', subtitle: 'top seven families plus Other', height: 320, option: stackedColumnsOption({ labels: ds.years, notes: ds.years.map((y) => (ds.coverage[y] === 'complete' ? '' : ds.coverage[y])), series: famSeries, saveName: 'style-family-by-year', selectiveLabels: false }), table: tableHtml([{ key: 'year', label: 'Year' }, ...famSeries.map((f, i) => ({ key: f.name, label: f.name, numeric: true, render: (row) => f.data[row.i] }))], ds.years.map((y, i) => ({ year: y, i })), { className: 'data-table' }) })}
<h2>competition-scale-by-year</h2>
<div class="table-wrap">${tableHtml([{ key: 'year', label: 'Year', numeric: true }, { key: 'ceremony_date', label: 'Awards date' }, { key: 'venue', label: 'Venue' }, { key: 'entries', label: 'Entries', numeric: true, render: (s) => fmt(s.entries) }, { key: 'entering_breweries', label: 'Breweries entering', numeric: true, render: (s) => fmt(s.entering_breweries) }, { key: 'medals', label: 'Medals', numeric: true, render: (s) => fmt(s.medals) }, { key: 'winning_breweries', label: 'Winning breweries', numeric: true, render: (s) => fmt(s.winning_breweries) }, { key: 'categories', label: 'Categories', numeric: true }, { key: 'loaded', label: 'Loaded', render: (s) => `<span class="pill ${ds.coverage[s.year] ?? 'pending'}">${esc(ds.coverage[s.year] ?? 'pending')}</span>` }, { key: 'notes', label: 'Notes', render: (s) => `<span class="small">${esc(s.notes)}</span>` }], summary)}</div>
${movers}`;
  reportLayout(ds, 'trends', 'Trends', body);
}

function botyReport(ds) {
  const r = '../../';
  const rows = [...ds.awards].sort((a, b) => Number(b.year) - Number(a.year) || a.award.localeCompare(b.award));
  const body = `
<p class="lede">Brewery and Brewer of the Year awards by production bracket. From 2026 the bracket is judged on a company's total production across all locations, with a new bracket above 100,000 barrels replacing the former Brewery Group award.</p>
<div class="table-wrap">${tableHtml([{ key: 'year', label: 'Year', numeric: true }, { key: 'award', label: 'Award' }, { key: 'bracket', label: 'Bracket' }, { key: 'brewery_name', label: 'Brewery', render: (a) => { const b = ds.breweries.find((x) => x.names?.includes?.(a.brewery_name) || x.name === a.brewery_name); return b ? `<a href="${r}breweries/${b.slug}/">${esc(a.brewery_printed)}</a>` : esc(a.brewery_printed); } }, { key: 'city', label: 'City', render: (a) => `${esc(a.city)}, ${esc(a.state)}` }, { key: 'source', label: 'Source', render: (a) => `<span class="small muted">${esc(a.source)}</span>` }], rows)}</div>
${rows.length < 12 ? '<p class="small muted">Only the awards confirmed so far are listed; the ingest adds the full set for each year from the official list.</p>' : ''}`;
  reportLayout(ds, 'brewery-of-the-year', 'Brewery of the Year', body);
}

// ---------- winner research profiles ----------
const NOT_PUBLISHED = '<span class="muted">not published</span>';
const isBlank = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const chips = (list) => (isBlank(list) ? NOT_PUBLISHED : `<span class="chips">${list.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</span>`);
const abvText = (v) => (isBlank(v) ? '' : `${Number(v).toFixed(1).replace(/\.0$/, '')}%`);
const MEDAL_ORDER = { Gold: 1, Silver: 2, Bronze: 3 };

function specCard(fm) {
  const big = (label, v, text) => `<div class="spec-figure"><dt>${label}</dt><dd>${isBlank(v) ? NOT_PUBLISHED : `<span class="spec-number">${esc(text)}</span>`}</dd></div>`;
  return `<section class="card spec-card" aria-labelledby="spec-title">
<h2 id="spec-title">Published specs</h2>
<dl class="spec-figures">${big('ABV', fm.abv, abvText(fm.abv))}${big('IBU', fm.ibu, String(fm.ibu))}</dl>
<dl class="kv spec-kv">
<dt>Style</dt><dd>${isBlank(fm.style) ? NOT_PUBLISHED : esc(fm.style)}</dd>
<dt>Hops</dt><dd>${chips(fm.hops)}</dd>
<dt>Malts</dt><dd>${chips(fm.malts)}</dd>
<dt>Yeast</dt><dd>${chips(fm.yeast)}</dd>
<dt>Adjuncts</dt><dd>${chips(fm.adjuncts)}</dd>
</dl>
<p class="small muted">Specs come from the brewery and the sources cited below. A field the research could not find in any source is shown as not published; nothing is estimated.</p>
</section>`;
}

function beerPage(p, row) {
  const depth = 3;
  const r = '../'.repeat(depth);
  const fm = p.fm;
  const medal = String(fm.medal ?? '');
  const breweryLink = row ? `<a href="${r}breweries/${esc(row.brewery_slug)}/">${esc(fm.brewery)}</a>` : esc(fm.brewery);
  const categoryLink = row ? `<a href="${r}categories/${esc(row.category_slug)}/">${esc(fm['category-name'])}</a>` : esc(fm['category-name']);
  const links = [
    fm['beer-url'] ? `<a class="btn-link" href="${esc(fm['beer-url'])}" rel="noopener">Beer page</a>` : '',
    fm['brewery-url'] ? `<a class="btn-link" href="${esc(fm['brewery-url'])}" rel="noopener">Brewery website</a>` : '',
    row ? `<a class="btn-link" href="${r}breweries/${esc(row.brewery_slug)}/">Brewery medal history</a>` : '',
    row ? `<a class="btn-link" href="${r}categories/${esc(row.category_slug)}/">Category history</a>` : '',
  ].filter(Boolean).join('');
  const body = `
<p class="small"><a href="../">${p.year} winners</a> · Category ${esc(fm['category-number'])}</p>
<h1>${esc(fm.beer)}</h1>
<p class="lede"><span class="pill medal-pill ${medal.toLowerCase()}"><span class="badge-medal ${medal.toLowerCase()}" aria-hidden="true"></span>${esc(medal)}</span> in ${categoryLink}${fm.entries ? ` (${fmt(fm.entries)} entries)` : ''} · ${breweryLink}, ${esc(fm['brewery-city'])}, ${esc(fm['brewery-state'])}</p>
${links ? `<p class="link-row">${links}</p>` : ''}
<div class="beer-layout">
${specCard(fm)}
<section class="prose">${renderMarkdownBody(p.body)}</section>
</div>`;
  write(`beers/${p.year}/${p.stem}/index.html`, layout({ title: `${fm.beer}, ${fm.brewery}`, description: `${fm.beer} by ${fm.brewery}: ${medal} medal, ${p.year} Great American Beer Festival, ${fm['category-name']}. Published specs and research notes.`, body, depth, active: `${p.year} winners` }));
}

function winnersIndex(year, profiles) {
  const n = profiles.length;
  const count = (f) => profiles.filter((p) => f(p.fm)).length;
  const share = (k) => `${k} of ${n}`;
  const stats = [
    statTile({ label: 'Medal profiles', value: String(n), note: `${new Set(profiles.map((p) => p.fm['category-number'])).size} categories` }),
    statTile({ label: 'ABV published', value: String(count((f) => !isBlank(f.abv))), note: share(count((f) => !isBlank(f.abv))) }),
    statTile({ label: 'IBU published', value: String(count((f) => !isBlank(f.ibu))), note: share(count((f) => !isBlank(f.ibu))) }),
    statTile({ label: 'Hops named', value: String(count((f) => !isBlank(f.hops))), note: share(count((f) => !isBlank(f.hops))) }),
    statTile({ label: 'Brewery beer page found', value: String(count((f) => !isBlank(f['beer-url']))), note: share(count((f) => !isBlank(f['beer-url']))) }),
  ].join('');
  const groups = new Map();
  for (const p of profiles) {
    const k = Number(p.fm['category-number']);
    if (!groups.has(k)) groups.set(k, { number: k, name: p.fm['category-name'], entries: p.fm.entries, rows: [] });
    groups.get(k).rows.push(p);
  }
  const head = '<thead><tr><th scope="col">Medal</th><th scope="col">Beer</th><th scope="col">Brewery</th><th scope="col" class="num">ABV</th><th scope="col" class="num">IBU</th><th scope="col">Hops</th></tr></thead>';
  const tbodies = [...groups.values()].sort((a, b) => a.number - b.number).map((g) => `<tbody data-group>
<tr class="group-row"><th colspan="6" scope="colgroup">${g.number}. ${esc(g.name)}${g.entries ? ` <span class="muted small">${fmt(g.entries)} entries</span>` : ''}</th></tr>
${g.rows.sort((a, b) => (MEDAL_ORDER[a.fm.medal] ?? 9) - (MEDAL_ORDER[b.fm.medal] ?? 9)).map((p) => {
    const f = p.fm;
    const text = [f.beer, f.brewery, f['brewery-city'], f['brewery-state'], f['category-name'], f.style, ...(f.hops ?? []), ...(f.malts ?? []), ...(f.yeast ?? []), ...(f.adjuncts ?? [])].join(' ').toLowerCase();
    return `<tr data-medal="${esc(f.medal)}" data-text="${esc(text)}"><td data-label="Medal">${medalDot(f.medal)}</td><td data-label="Beer"><a href="${esc(p.stem)}/">${esc(f.beer)}</a></td><td data-label="Brewery">${esc(f.brewery)} <span class="muted small">${esc(f['brewery-city'])}, ${esc(f['brewery-state'])}</span></td><td class="num" data-label="ABV">${isBlank(f.abv) ? '<span class="muted">n/p</span>' : esc(abvText(f.abv))}</td><td class="num" data-label="IBU">${isBlank(f.ibu) ? '<span class="muted">n/p</span>' : esc(f.ibu)}</td><td class="small" data-label="Hops">${isBlank(f.hops) ? '<span class="muted">not published</span>' : esc(f.hops.join(', '))}</td></tr>`;
  }).join('')}
</tbody>`).join('');
  const body = `
<h1>${year} winners</h1>
<p class="lede">Every medal from the ${year} Great American Beer Festival with the beer's published specs: style, ABV, IBU, and named hops, malts, yeast, and adjuncts, each from the brewery or a cited source. Open a beer for its full research notes. n/p means the figure is not published in any source checked.</p>
<div class="stats">${stats}</div>
<div class="winner-tools">
<label>Search<input id="w-q" type="search" placeholder="Beer, brewery, city, style, or hop" autocomplete="off"></label>
<label>Medal<select id="w-medal"><option value="">All medals</option><option>Gold</option><option>Silver</option><option>Bronze</option></select></label>
<label class="check"><input id="w-hops" type="checkbox"> Hops named</label>
<p id="w-count" class="small muted" aria-live="polite">${n} medals shown</p>
<a class="btn-link" href="../../explorer/">Open the explorer</a>
</div>
<div class="table-wrap winners-table"><table class="data-table">${head}${tbodies}</table></div>
<p id="w-empty" class="notice" hidden>No medal matches these filters. Clear the search or choose all medals.</p>
<script>
(function(){
  var q=document.getElementById('w-q'),m=document.getElementById('w-medal'),h=document.getElementById('w-hops'),c=document.getElementById('w-count'),e=document.getElementById('w-empty');
  var groups=Array.prototype.slice.call(document.querySelectorAll('.winners-table tbody[data-group]'));
  var t;
  function run(){
    var v=q.value.trim().toLowerCase().split(/\\s+/).filter(Boolean),md=m.value,hp=h.checked,shown=0;
    groups.forEach(function(g){
      var any=false;
      Array.prototype.forEach.call(g.querySelectorAll('tr[data-medal]'),function(r){
        var ok=(!md||r.getAttribute('data-medal')===md)&&(!hp||r.cells[5].textContent!=='not published')&&v.every(function(w){return r.getAttribute('data-text').indexOf(w)>=0;});
        r.hidden=!ok; if(ok){any=true;shown++;}
      });
      g.hidden=!any;
    });
    c.textContent=shown+' of ${n} medals shown'; e.hidden=shown>0;
  }
  q.addEventListener('input',function(){clearTimeout(t);t=setTimeout(run,200);});
  m.addEventListener('change',run); h.addEventListener('change',run);
})();
</script>`;
  write(`beers/${year}/index.html`, layout({ title: `${year} winners`, description: `All ${n} medals of the ${year} Great American Beer Festival with published ABV, IBU, hops, malts, yeast, and adjuncts.`, body, depth: 2, active: `${year} winners` }));
}

function winnerPages(ds, profiles) {
  const rowFor = new Map();
  for (const r of ds.results) {
    const p = r.competition && r.competition !== 'GABF' ? null : profileFor(r);
    if (p) rowFor.set(p.stem, r);
  }
  for (const p of profiles) beerPage(p, rowFor.get(p.stem));
  if (profiles.length) winnersIndex(WINNER_YEAR, profiles);
  return { pages: profiles.length, matched: rowFor.size, unmatched: profiles.filter((p) => !rowFor.has(p.stem)).map((p) => p.stem) };
}

// The explorer is built by scripts/build-explorer.mjs into gabf-explorer.html (committed); the
// site serves that file as is.
function copyExplorer() {
  const src = resolve(ROOT, 'gabf-explorer.html');
  if (!existsSync(src)) return;
  mkdirSync(resolve(DIST, 'explorer'), { recursive: true });
  cpSync(src, resolve(DIST, 'explorer', 'index.html'));
}

// ---------- about ----------
export function aboutHtml(ds) {
  const rows = ds.years.map((y) => ({ year: y, status: ds.coverage[y], rows: ds.results.filter((x) => x.year === y).length, source: [...new Set(ds.results.filter((x) => x.year === y).map((x) => x.source))].join('; ') || (ds.summary.find((s) => Number(s.year) === y)?.source ?? '') }));
  return `
<h1>About this site</h1>
<p class="lede">An independent analysis of Great American Beer Festival competition results. It is built from public data by a static pipeline in <a href="${REPO_URL}">this repository</a> and published with GitHub Pages. Charts are drawn with Apache ECharts; each one has a table view and saves as a PNG.</p>
<h2>coverage</h2>
<div class="table-wrap">${tableHtml([{ key: 'year', label: 'Year', numeric: true }, { key: 'status', label: 'Status', render: (x) => `<span class="pill ${x.status}">${esc(x.status)}</span>` }, { key: 'rows', label: 'Rows loaded', numeric: true }, { key: 'source', label: 'Sources', render: (x) => `<span class="small">${esc(x.source)}</span>` }], rows)}</div>
<p class="small">complete: the official winners list was ingested. partial: only seed rows from secondary sources are present. draft: rows transcribed from the awards ceremony, pending the official list. pending: the competition ran or is scheduled but no results are loaded.</p>
<h2>data-sources</h2>
<ul class="list-plain">
<li>Results: the Brewers Association's official GABF winners lists (PDF), parsed by scripts/parse-winners.mjs. Category names and total entrants come from the same lists. Before the PDF is posted, the ceremony transcript importer drafts rows from the live stream captions.</li>
<li>Brewery locations, coordinates, type, and websites: <a href="https://www.openbrewerydb.org">Open Brewery DB</a> (free, open) plus curated overrides. The repository also configures the unofficial Open Brewery DB MCP server for agent lookups.</li>
<li>Style definitions and ABV, IBU, and SRM ranges: Brewers Association Beer Style Guidelines, imported with scripts/import-style-guidelines.mjs. Special categories are flagged by rule and per category in data/reference/categories.csv.</li>
<li>Ownership, investors, and distributors: curated from public announcements (company releases, Brewbound, trade press, state license lookups). Each row carries a verified flag.</li>
<li>Demographics and denominators: Census Bureau annual population estimates (July 1, Vintage 2020 for 2018 and 2019, Vintage 2025 for 2020 to 2025; 2026 medals use 2025), BEA real GDP in chained 2017 dollars and nominal GDP by state (SAGDP1) and county (CAGDP1), ACS 2024 1-year estimates (age, race and Hispanic origin, education, median household income, poverty), 2020 Census urban share, NCES PIAAC modeled literacy estimates (pooled 2012, 2014, and 2017), and NCHS state life expectancy for 2022. Census regions and divisions come from data/reference/states.csv.</li>
<li>Federal Reserve districts: the Board of Governors' district descriptions and the Reserve Banks' county lists (St. Louis, Minneapolis, Dallas, Philadelphia), with counts checked against Cleveland Fed and FRASER figures. Medals in split states are assigned by the medal city's county from the Census place and county subdivision files. West Virginia has no published county list and is assigned whole to the Richmond district as an approximation. District GDP for split states is apportioned by county GDP shares (E).</li>
<li>Competition totals: Brewers Association annual releases and the day-of coverage of each announcement.</li>
</ul>
<h2 id="estimates">estimates</h2>
<p>Production, volume, revenue, and margin figures marked (E) are estimates. Volume order of preference: a reported figure, then a Brewery of the Year bracket (midpoint), then a curated estimate in data/reference/production.csv or a brewery profile, then a heuristic by brewery type and location count. Conversions use the US beer barrel (31 gallons): 13.78 cases of 24 twelve-ounce containers, 248 sixteen-ounce cans or pints, 330.7 twelve-ounce cans. Revenue uses Brewers Association benchmark revenue per barrel by channel (direct-to-consumer 1,276 USD, distributed 602 USD, blended by brewery type) plus food revenue per kitchen location. ARR is the annual revenue run rate. Gross margin and EBITDA margin are brewery-type point estimates with channel ranges (taproom 8 to 24 percent, self-distribution 5 to 11 percent, distributor 2 to 6 percent). Parameters and their sources live in data/reference/estimation-parameters.json.</p>
<h2>trend-semantics</h2>
<p>A brewery's yearly trend distinguishes: medaled, no medal recorded, did not exist yet (year before its founding), closed, results not yet published, year only partially loaded, and no results loaded. A partially loaded year is labelled as such rather than counted as a miss.</p>
<h2>privacy-of-this-site</h2>
<p>A GitHub Pages site is public even when its repository is private (private-repository Pages needs a paid plan, and access control needs GitHub Enterprise Cloud). For a private copy, build locally and open dist/index.html, or publish dist/ behind authentication on a host such as Cloudflare Pages with Access or Netlify with password protection; the site is plain files and runs anywhere.</p>
<h2>attribution</h2>
<p>Great American Beer Festival and GABF are trademarks of the Brewers Association. Style guideline content is used with attribution for non-commercial analysis. Open Brewery DB data is open. Apache ECharts is Apache 2.0 licensed. US state boundaries come from the us-atlas project (US Census Bureau cartographic boundaries). This site is not affiliated with the Brewers Association.</p>`;
}

function aboutPage(ds) {
  const body = aboutHtml(ds);
  write('about/index.html', layout({ title: 'About', description: 'Data sources, coverage, and methods.', body, depth: 1, active: 'About' }));
}

// ---------- main ----------
export function build({ clean = true } = {}) {
  const ds = loadDataset();
  const cats = categoryIndex(ds);
  const profiles = loadWinnerProfiles(WINNER_YEAR);
  PROFILES.clear();
  for (const p of profiles) PROFILES.set(`${p.year}|${p.key}`, p);
  for (const r of ds.results) {
    const p = profileFor(r);
    if (p) r.beer_profile = `beers/${p.year}/${p.stem}/`;
  }
  if (clean && existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  if (!existsSync(resolve(SITE, 'assets', 'us-states.geo.json'))) buildGeo();
  cpSync(resolve(SITE, 'assets'), resolve(DIST, 'assets'), { recursive: true });
  mkdirSync(resolve(DIST, 'assets', 'vendor'), { recursive: true });
  cpSync(require.resolve('echarts/dist/echarts.min.js'), resolve(DIST, 'assets', 'vendor', 'echarts.min.js'));
  writeFileSync(resolve(DIST, '.nojekyll'), '');
  writeData(ds, cats);
  dashboardPages(ds);
  breweriesIndex(ds);
  for (const b of ds.breweries) breweryPage(ds, b);
  categoriesIndex(ds, cats);
  for (const c of cats) categoryPage(ds, c);
  reportsIndex(ds);
  topBreweries(ds);
  topCategories(ds, cats);
  byState(ds);
  byRegion(ds);
  ownershipReport(ds);
  economicsReport(ds);
  trendsReport(ds);
  botyReport(ds);
  aboutPage(ds);
  const winners = winnerPages(ds, profiles);
  copyExplorer();
  return { winners, pages: countFiles(DIST, '.html'), breweries: ds.breweries.length, categories: cats.length, results: ds.results.length, years: ds.years };
}

function countFiles(dir, ext) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countFiles(resolve(dir, entry.name), ext);
    else if (entry.name.endsWith(ext)) n += 1;
  }
  return n;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const r = build({ clean: !args['no-clean'] });
  console.log(`${WINNER_YEAR} winner profiles: ${r.winners.pages} pages, ${r.winners.matched} matched to medal rows, ${r.winners.unmatched.length} unmatched${r.winners.unmatched.length ? ` (${r.winners.unmatched.join('; ')})` : ''}`);
  console.log(`built ${r.pages} pages for ${r.results} medal rows, ${r.breweries} breweries, ${r.categories} categories, years ${r.years.join(', ')} -> ${DIST}`);
}
