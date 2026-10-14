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
import { compact, countBy, esc, figure, humanizeHeadings, tableHtml } from '../site/assets/charts.mjs';
import { lineOption, SERIES_COLORS } from '../site/assets/chart-options.mjs';
import { applyFilters, DATA_SLUGS, scopeRows, unslugText, valueLabel } from '../site/assets/filter-bar.mjs';
import { medalDot, renderView } from '../site/assets/page-views.mjs';
import { estMark } from '../site/assets/estimates.mjs';
import { ambiguousFirstTimers, firstTimeStatus } from './lib/first-time.mjs';
import { loadWinnerProfiles, matchKey } from './lib/winner-profiles.mjs';
import { loadSiteCopy } from './lib/site-copy.mjs';
import { annotatePage, assertReviewAllowed, callerLocation, copyReviewAssets, REVIEW } from './lib/review-build.mjs';
import { createHopPages } from './lib/hop-pages.mjs';
import { HOP_COPY_DEFAULTS } from '../site/assets/hop-links.mjs';
import { BEER_CARD_DEFAULTS } from '../site/assets/profile-cards.mjs';

const require = createRequire(import.meta.url);
// Visible copy that has a key in .docs/content-management-system/ is read from there (see lib/site-copy.mjs).
const COPY = loadSiteCopy();
const SITE_TITLE = COPY('global.site.identity.name');
const REPO_URL = 'https://github.com/klappe-pm/GABF-Analysis';
const WINNER_YEAR = 2026;
const fmt = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-US'));
const usd = (n) => `$${compact(n)}`;
const pctOf = (x) => `${Math.round(Number(x) * 100)}%`;
const NOT_DEFINED = `<span class="muted">${esc(COPY('global.states.gaps.not_defined'))}</span>`;
// The words the shared table views draw for hops, from pages/hop-detail.md, shipped on meta.copy.hops.
const HOP_SHARED_COPY = () => Object.fromEntries(Object.keys(HOP_COPY_DEFAULTS).map((k) => [k, COPY(`pages.hop-detail.shared_views.${k}`)]));
// The hop model and pages of the current build (set in build()).
let HOP_PAGES = null;
const CARD_COPY = () => Object.fromEntries(Object.keys(BEER_CARD_DEFAULTS).map((k) => [k, COPY(`pages.profile-cards.beer.${k}`)]));

// Winner research profiles keyed by year plus matchKey; filled by enrichResults().
const PROFILES = new Map();
const profileKey = (year, beer, medal, category) => `${year}|${matchKey(beer, medal, category)}`;
const profileFor = (row) => (row.competition && row.competition !== 'GABF' ? null : PROFILES.get(profileKey(row.year, row.beer_name, row.medal, row.category_name)) ?? null);

// The rows and meta every page view reads, set once per build from the shared payload.
const VIEW = { rows: [], meta: null, info: null };

// Region of a page that follows the global filter: rendered here with the default selection and
// again in the browser by app.mjs from the same rows. Returns the HTML and the page data script.
function viewRegion(name, { scope = {}, page = {}, depth, breweryInfo = false, fixed = [] }) {
  const r = depth === 0 ? './' : '../'.repeat(depth);
  const all = scopeRows(VIEW.rows, scope);
  const rows = applyFilters(all, {});
  const html = renderView(name, rows, { r, meta: VIEW.meta, state: {}, page: breweryInfo ? { ...page, breweries: VIEW.info } : page, scopeAll: all });
  return { html: `<div class="view" data-view="${esc(name)}">${html}</div>`, pageData: { scope, page, breweryInfo, fixed } };
}

// Markdown sources keep kebab-case headings; every rendered page shows them as display text.
function write(relPath, html) {
  const full = resolve(DIST, relPath);
  mkdirSync(resolve(full, '..'), { recursive: true });
  let out = relPath.endsWith('.html') ? unslugText(humanizeHeadings(html), PROSE_SLUGS) : html;
  // Review build only (GABF_FEEDBACK=1): source attributes, the build record, and the widget.
  if (REVIEW && relPath.endsWith('.html')) out = annotatePage(out, relPath, callerLocation());
  writeFileSync(full, out);
}

const DASHBOARDS = [
  ['', 'Overview', 'Medals by year, state, style family, and brewery with every filter.'],
  ['dashboards/geography/', 'Geography', 'US map, Census regions and divisions, Federal Reserve districts, medals per million residents and per real GDP, demographic controls.'],
  ['dashboards/categories/', 'Categories', 'Entrants by category, classic versus special categories, category size versus medal spread.'],
  ['dashboards/breweries/', 'Breweries', 'Pick a brewery: medals by year, by category, and by location.'],
  ['dashboards/economics/', 'Ownership and economics', 'Ownership share, parents, estimated revenue, ARR, margins, distribution.'],
];

function layout({ title, description = '', body, depth = 0, active = '', scripts = '', bodyAttrs = '', pageData = null }) {
  const r = depth === 0 ? './' : '../'.repeat(depth);
  const nav = [['', 'Dashboards'], [`beers/${WINNER_YEAR}/`, `${WINNER_YEAR} winners`], [`first-time-medalists/${WINNER_YEAR}/`, 'First time medalists'], ['breweries/', 'Breweries'], ['categories/', 'Categories'], ['hops/', COPY('global.navigation.header.hops')], ['hop-farms/', COPY('global.navigation.header.hop_farms')], ['reports/', 'Reports'], ['explorer/', 'Explorer'], ['about/', 'About']]
    .map(([href, label]) => `<a href="${r}${href}"${active === label ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${SITE_TITLE}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="${r}assets/fonts.css">
<link rel="stylesheet" href="${r}assets/brand.css">
<link rel="stylesheet" href="${r}assets/styles.css">
<link rel="icon" href="data:,">
<script>window.GABF_BASE = ${JSON.stringify(r)};</script>
</head>
<body${bodyAttrs}>
<a class="skip-link" href="#main">${esc(COPY('global.site.header.skip_link'))}</a>
<header class="site-header collapsible"><div class="inner"><a class="brand" href="${r}">${SITE_TITLE}</a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">${esc(COPY('global.site.header.menu_button'))}</button><nav class="site-nav" id="site-nav" aria-label="${esc(COPY('global.site.header.nav_label'))}">${nav}</nav><button class="filter-trigger" type="button" aria-keyshortcuts="f" title="Filter every page (shortcut: f)">${esc(COPY('global.filters.trigger.label'))}</button></div></header>
<div class="filter-chips-bar" id="filter-chips" hidden></div>
<p class="visually-hidden" id="filter-live" aria-live="polite"></p>
<main id="main" tabindex="-1">
${body}
</main>
${pageData ? `<script type="application/json" id="page-data">${JSON.stringify(pageData).replace(/</g, '\\u003c')}</script>` : ''}
<footer class="site-footer"><div class="inner">Results from the Brewers Association's official Great American Beer Festival winners lists. Brewery locations from Open Brewery DB and curated overrides. Charts by Apache ECharts. Estimates are marked (E). <a href="${REPO_URL}">${esc(COPY('global.site.footer.source_link'))}</a>.${CATALOG_BEER_ATTRIBUTION}</div></footer>
<script src="${r}assets/vendor/echarts.min.js"></script>
<script src="${r}assets/page.js" defer></script>
<script src="${r}assets/echarts-init.js" defer></script>
<script type="module" src="${r}assets/app.mjs"></script>
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

function mapLink(loc) {
  if (loc.latitude && loc.longitude) return `https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=15/${loc.latitude}/${loc.longitude}`;
  const q = [loc.address_1 ?? loc.address, loc.city, loc.state].filter(Boolean).join(', ');
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`;
}

// World Beer Cup and other competitions: not in the global filter's rows, shown as recorded.
function otherMedalsTable(rows) {
  const cols = [
    { key: 'year', label: 'Year', numeric: true },
    { key: 'competition', label: 'Competition' },
    { key: 'medal', label: 'Medal', render: (x) => medalDot(x.medal) },
    { key: 'beer_name', label: 'Beer' },
    { key: 'city', label: 'City', render: (x) => `${esc(x.city)}, ${esc(x.state)}` },
    { key: 'category_name', label: 'Category' },
  ];
  return `<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml(cols, rows)}</div>`;
}

// ---------- data exports ----------
const RESULT_FIELDS = ['year', 'competition', 'section', 'category_number', 'category_name', 'category_slug', 'category_type', 'special', 'entries', 'category_medals', 'medal', 'beer_name', 'brewery_name', 'brewery_key', 'brewery_slug', 'brewery_location', 'city', 'state', 'state_name', 'region', 'division', 'fed_district', 'fed_district_name', 'fed_district_method', 'style_family', 'abv_min', 'abv_max', 'abv', 'ibu', 'abv_source', 'ibu_source', 'beer_url', 'abv_band', 'points', 'partial', 'draft', 'notes', 'brewery_type', 'ownership_type', 'parent', 'distribution_channel', 'beer_profile', 'first_time', 'search_extra', 'hop_varieties', 'hop_farms_named', 'hop_farms_grown', 'beer_style', 'tasting_note', 'tasting_source'];

// Decorate the medal rows once per dataset with what the views and the filter need: brewery
// attributes, medals awarded per category and year (for entries per medal), the 2026 research
// profile link, and the first time medalist flag for the latest year.
export function enrichResults(ds) {
  if (ds.__enriched) return ds;
  const profiles = loadWinnerProfiles(WINNER_YEAR);
  PROFILES.clear();
  for (const p of profiles) PROFILES.set(`${p.year}|${p.key}`, p);
  const byKey = new Map(ds.breweries.map((b) => [b.key, b]));
  const perCat = new Map();
  for (const r of ds.results) perCat.set(`${r.year}|${r.category_name}`, (perCat.get(`${r.year}|${r.category_name}`) ?? 0) + 1);
  const partialYears = ds.years.filter((y) => ds.coverage[y] === 'partial');
  const status = firstTimeStatus(ds.results, { year: WINNER_YEAR, partialYears });
  for (const r of ds.results) {
    const b = byKey.get(r.brewery_key);
    r.brewery_type = b?.brewery_type ?? '';
    r.ownership_type = b?.ownership?.ownership_type ?? 'unlisted';
    r.parent = b?.ownership?.parent ?? '';
    r.distribution_channel = b?.distribution_channel || 'unknown';
    r.category_medals = perCat.get(`${r.year}|${r.category_name}`) ?? null;
    const p = profileFor(r);
    if (p) {
      r.beer_profile = `beers/${p.year}/${p.stem}/`;
      r.search_extra = [p.fm.style, ...(p.fm.hops ?? []), ...(p.fm.malts ?? []), ...(p.fm.yeast ?? []), ...(p.fm.adjuncts ?? [])].filter(Boolean).join(' ');
    }
    r.abv_source = r.spec?.abv.source?.url ?? null;
    r.ibu_source = r.spec?.ibu.source?.url ?? null;
    r.beer_url = r.spec?.beer_url ?? null;
    if (r.year === WINNER_YEAR) r.first_time = status.get(r.brewery_key) ?? '';
  }
  ds.winnerProfiles = profiles;
  registerProseSlugs([...profiles, ...ds.profiles]);
  ds.firstTime = { status, partialYears, ambiguous: ambiguousFirstTimers(ds.results, status, WINNER_YEAR) };
  ds.__enriched = true;
  return ds;
}

// How one brewery's estimates were made, in plain words, for the (E) popovers. Mirrors the method
// in scripts/lib/estimate.mjs: barrels from the best evidence, revenue from barrels times a price
// per barrel by brewery type plus kitchen revenue, margins by brewery type and distribution channel.
export function explainEstimate(b, params) {
  const est = b.estimate;
  const rev = est.revenue;
  const f = b.financials;
  const type = valueLabel('brewery_type', b.brewery_type).toLowerCase();
  const n = b.locations_count;
  const num = (x) => Number(x).toLocaleString('en-US');
  const money = (x) => `$${num(Math.round(x))}`;
  let barrels;
  if (est.basis === 'reported') barrels = `Reported by the brewery${est.year ? ` for ${est.year}` : ''}: ${num(est.barrels)} barrels.`;
  else if (est.basis === 'boty-bracket') barrels = est.range?.max ? `The midpoint of the Brewery of the Year size bracket it competed in (${num(est.range.min)} to ${num(est.range.max)} barrels): ${num(est.barrels)} barrels.` : `1.25 times the floor of the open Brewery of the Year size bracket it competed in (over ${num((est.range?.min ?? 1) - 1)} barrels): ${num(est.barrels)} barrels.`;
  else if (est.basis === 'estimate') barrels = `A researched estimate from published reporting on this brewery (${est.confidence || 'low'} confidence): ${num(est.barrels)} barrels.`;
  else {
    const perType = params.barrels_by_brewery_type[b.brewery_type] ?? params.barrels_by_brewery_type.default;
    barrels = `No production figure is published, so this uses a typical volume for a ${type} (${num(perType)} barrels)${n > 1 ? ` plus ${num(params.barrels_per_additional_location)} barrels for each of ${n - 1} more location${n - 1 === 1 ? '' : 's'}` : ''}: ${num(est.barrels)} barrels.`;
  }
  const arr = rev.basis === 'profile estimate'
    ? `A researched revenue estimate for this brewery of ${money(rev.total_revenue_usd)}, with a range of ${money(rev.low_usd)} to ${money(rev.high_usd)}.`
    : `${num(est.barrels)} barrels times ${money(rev.revenue_per_barrel_usd)} per barrel, the benchmark price for a ${type}${rev.food_revenue_usd ? `, plus ${money(params.food_revenue_per_kitchen_location)} of food sales for each of ${n} location${n === 1 ? '' : 's'} with a kitchen` : ''}, gives ${money(rev.total_revenue_usd)} a year. The range shown is 0.7 to 1.35 times that.`;
  const channelKey = params.ebitda_margin_range_by_channel[b.distribution_channel] ? b.distribution_channel : (b.brewery_type === 'brewpub' || b.brewery_type === 'taproom' ? 'taproom' : 'self-distribution');
  const channelText = { taproom: 'taproom sales', 'self-distribution': 'self distributed', distributor: 'distributor sold' }[channelKey] ?? 'similar';
  const pctText = (x) => `${Math.round(x * 100)} percent`;
  const text = {
    barrels,
    arr,
    gross_margin: `Annual revenue (${money(f.arr_usd)}) times a ${pctText(f.gross_margin)} gross margin, typical for a ${type}, gives ${money(f.gross_profit_usd)} of gross profit.`,
    ebitda: `Annual revenue (${money(f.arr_usd)}) times a ${pctText(f.ebitda_margin)} EBITDA margin, typical for a ${type}, gives ${money(f.ebitda_usd)}. The range uses ${pctText(f.ebitda_margin_low)} to ${pctText(f.ebitda_margin_high)}, typical for ${channelText} breweries.`,
    per_barrel: `Annual revenue (${money(f.arr_usd)}) divided by ${num(est.barrels)} barrels.`,
    per_location: `Annual revenue (${money(f.arr_usd)}) divided by ${n} location${n === 1 ? '' : 's'}.`,
    per_employee: `Annual revenue (${money(f.arr_usd)}) divided by ${b.employees ? num(b.employees) : 'the reported'} employees.`,
  };
  const inputs = [
    ['Barrels', `${num(est.barrels)} (${valueLabel('basis', est.basis).toLowerCase()})`],
    ['Brewery type', valueLabel('brewery_type', b.brewery_type)],
    ['Locations', String(n)],
    ['Kitchen', b.has_kitchen ? 'Yes' : 'No'],
    ['Distribution', b.distribution_channel ? valueLabel('distribution_channel', b.distribution_channel) : 'Not defined'],
    ['Employees', b.employees ? num(b.employees) : 'Not defined'],
  ];
  return { name: b.name, text, inputs };
}

// Brewery attributes the index and report views join to medal rows (data/brewery-info.json).
export function breweryInfo(ds) {
  return Object.fromEntries(ds.breweries.filter((b) => b.medals.length).map((b) => [b.key, {
    key: b.key, name: b.name, slug: b.slug, hq: [b.hq.city, b.hq.state].filter(Boolean).join(', '), brewery_type: b.brewery_type, ownership_type: b.ownership?.ownership_type ?? 'unlisted', streak: b.streak, deep_dive: Boolean(b.profile),
    arr: b.financials.arr_usd, barrels: b.estimate.barrels, basis: b.estimate.basis, cases: b.estimate.volume.cases_24x12_equivalent, gross_margin: b.financials.gross_margin, ebitda: b.financials.ebitda_usd, ebitda_margin_low: b.financials.ebitda_margin_low, ebitda_margin_high: b.financials.ebitda_margin_high,
    distribution_channel: b.distribution_channel, locations_count: b.locations_count,
  }]));
}

// Indicator tables trimmed for the browser: { state: { CA: { population: { 2024: n } } }, district: {...}, units }.
export function compactIndicators(ds) {
  const trim = (idx) => Object.fromEntries(Object.entries(idx).map(([k, inds]) => [k, Object.fromEntries(Object.entries(inds).map(([ind, years]) => [ind, Object.fromEntries(Object.entries(years).map(([y, v]) => [y, v.value]))]))]));
  const units = {};
  for (const idx of [ds.stateIndicators, ds.districtIndicators]) for (const inds of Object.values(idx)) for (const [ind, years] of Object.entries(inds)) units[ind] ??= Object.values(years)[0]?.unit ?? '';
  return { state: trim(ds.stateIndicators), district: trim(ds.districtIndicators), units };
}

// The data every dashboard reads: decorated results, meta (years, coverage, states, lookups),
// and per-brewery summaries. Shared by the multi-page site (written as JSON files) and the
// single-file build (embedded in the HTML), so the two can never drift apart.
export function buildPayload(ds, cats) {
  enrichResults(ds);
  const results =ds.results.map((r) => Object.fromEntries(RESULT_FIELDS.map((f) => [f, r[f] ?? null])));
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
    copy: { hops: HOP_SHARED_COPY(), cards: CARD_COPY() },
    // Farm name to page slug, so a brewery page can link the farms its beers reach.
    hop_farm_slugs: Object.fromEntries(ds.hops.farms.map((f) => [f.name, f.slug])),
  };
  const breweries = ds.breweries.map((b) => ({
    key: b.key, slug: b.slug, name: b.name, hq: b.hq, brewery_type: b.brewery_type, founded: b.founded, employees: b.employees, medals: b.medals.length, by_medal: b.by_medal, points: b.total_points, first_year: b.first_year, last_year: b.last_year, streak: b.streak, trend: b.trend,
    ownership: b.ownership ? { type: b.ownership.ownership_type, parent: b.ownership.parent, investor: b.ownership.investor } : null,
    distribution_channel: b.distribution_channel, distributors: b.distributors.map((d) => ({ channel: d.channel, distributor: d.distributor, territory: d.territory })),
    estimate: { barrels: b.estimate.barrels, basis: b.estimate.basis, revenue_usd: b.estimate.revenue.total_revenue_usd },
    financials: b.financials, has_profile: Boolean(b.profile), locations: b.locations, locations_count: b.locations_count,
    explain: explainEstimate(b, ds.params),
  }));
  return { results, meta, breweries };
}

function writeData(ds, cats) {
  const { results, meta, breweries } = buildPayload(ds, cats);
  VIEW.rows = results;
  VIEW.meta = meta;
  VIEW.info = breweryInfo(ds);
  write('data/brewery-info.json', JSON.stringify(VIEW.info));
  write('data/estimates.json', JSON.stringify(Object.fromEntries(ds.breweries.map((b) => [b.key, explainEstimate(b, ds.params)]))));
  write('data/results.json', JSON.stringify(results));
  write('data/meta.json', JSON.stringify({ generated_at: new Date().toISOString(), ...meta }));
  // The site serves explanations separately (data/estimates.json, loaded on first use).
  write('data/breweries.json', JSON.stringify(breweries.map(({ explain, ...b }) => b)));
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
<div id="partial-notice"></div>
${extra}
<p class="dash-actions"><button class="btn" id="download" type="button">Download the medals in view (CSV)</button></p>
<div class="dash-grid">${panels.map(([id, wide]) => `<div data-panel="${id}"${wide ? ' class="wide"' : ''}></div>`).join('')}</div>`;
}

function dashboardPages(ds) {
  const featured = ds.breweries.filter((b) => b.profile).slice(0, 6);
  const overview = dashboardBody(ds, { href: '', r: './', intro: `<h1>Great American Beer Festival results dashboards</h1><p class="lede">Which states, styles, and breweries keep winning at the Great American Beer Festival. Start with the medal count by year, then see where the medals land on the map, which style families collect the most, and which breweries lead on points. The Filters button in the header narrows every page; click a bar, column, or state to focus it.</p>`, panels: [['medals-by-year'], ['map'], ['by-family'], ['top-breweries']], extra: '<div id="stats" class="stats"></div>' });
  const featuredList = featured.length ? `<h2>featured-deep-dives</h2><ul class="list-plain">${featured.map((b) => `<li><a href="breweries/${b.slug}/">${esc(b.name)}</a> <span class="muted small">${esc(b.hq.city)}, ${esc(b.hq.state)} · ${b.medals.length} GABF medals in the loaded data</span></li>`).join('')}</ul>` : '';
  write('index.html', layout({ title: 'Dashboards', description: 'Interactive Great American Beer Festival medal dashboards.', body: `${overview}<h2>results</h2><div id="table"></div>${featuredList}`, depth: 0, active: 'Dashboards', scripts: '<script type="module" src="assets/dashboards.js"></script>' }));

  const geo = dashboardBody(ds, { href: 'dashboards/geography/', r: '../../', intro: '<h1>Geography</h1><p class="lede">Where the medals go: the US map, Census regions and divisions, Federal Reserve districts, medals per million residents and per $100 billion of real GDP using each medal year\'s population and GDP, and the demographic controls side by side. Click a state, region, or district to focus the other panels.</p>', panels: [['map', true], ['by-region'], ['by-division'], ['by-fed-district'], ['district-rates'], ['per-capita', true], ['per-gdp', true]], extra: '<div id="stats" class="stats"></div>' });
  write('dashboards/geography/index.html', layout({ title: 'Geography dashboard', description: 'GABF medals by state, region, Federal Reserve district, per capita, and per GDP.', body: `${geo}<h2>controls-by-state-and-district</h2><div id="controls-table"></div>`, depth: 2, active: 'Dashboards', scripts: '<script type="module" src="../../assets/dashboards.js"></script>' }));

  const cat = dashboardBody(ds, { href: 'dashboards/categories/', r: '../../', intro: '<h1>Categories</h1><p class="lede">Total entrants by category from the official category headers, with special categories (added ingredient, process, or catch all) marked, the classic versus special split by year, and category size against how many breweries medal.</p>', panels: [['entrants', true], ['entry-odds', true], ['special-share'], ['entries-vs-breweries']], extra: '<div id="stats" class="stats"></div>' });
  write('dashboards/categories/index.html', layout({ title: 'Categories dashboard', description: 'GABF entrants by category and special categories.', body: `${cat}<h2>results</h2><div id="table"></div>`, depth: 2, active: 'Dashboards', scripts: '<script type="module" src="../../assets/dashboards.js"></script>' }));

  const defaultBrewery = ds.breweries.find((b) => b.profile || b.facts)?.key ?? ds.breweries[0]?.key ?? '';
  const brew = dashboardBody(ds, { href: 'dashboards/breweries/', r: '../../', intro: '<h1>Breweries</h1><p class="lede">Pick a brewery to see its medal trend (years before it opened and years not yet published are marked), its categories, and the locations credited. The global filter still scopes the stats and table.</p>', panels: [['brewery-trend', true], ['brewery-categories'], ['brewery-locations']], extra: '<div id="brewery-picker" class="picker"></div><div id="stats" class="stats"></div>' });
  write('dashboards/breweries/index.html', layout({ title: 'Breweries dashboard', description: 'Per-brewery GABF medal trends.', body: `${brew}<h2>results</h2><div id="table"></div>`, depth: 2, active: 'Dashboards', scripts: '<script type="module" src="../../assets/dashboards.js"></script>', bodyAttrs: ` data-default-brewery="${esc(defaultBrewery)}"` }));

  const econ = dashboardBody(ds, { href: 'dashboards/economics/', r: '../../', intro: '<h1>Ownership and economics</h1><p class="lede">Who owns the medalists and what they are worth: ownership share, parent companies, and estimated revenue, ARR, gross margin, EBITDA, and distribution channel per brewery. Every financial figure is an estimate (E); the method is on the About page.</p>', panels: [['ownership-share'], ['parents'], ['revenue-by-brewery', true]], extra: '<div id="stats" class="stats"></div>' });
  write('dashboards/economics/index.html', layout({ title: 'Ownership and economics dashboard', description: 'Ownership, investors, and estimated brewery economics.', body: `${econ}<h2>financials-by-brewery</h2><div id="financial-table"></div>`, depth: 2, active: 'Dashboards', scripts: '<script type="module" src="../../assets/dashboards.js"></script>' }));

  write('dashboards/index.html', layout({ title: 'Dashboards', description: 'All dashboards.', body: `<h1>Dashboards</h1><ul class="list-plain">${DASHBOARDS.map(([href, label, desc]) => `<li><a href="../${href}">${esc(label)}</a> <span class="muted">${esc(desc)}</span></li>`).join('')}</ul>`, depth: 1, active: 'Dashboards' }));
}

// Attribution for values taken from Catalog.beer (CC BY 4.0); shown in every page footer.
export const CATALOG_BEER_ATTRIBUTION = ' Some beer details are from <a href="https://catalog.beer">Catalog.beer</a>, licensed <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> and adapted.';

// ---------- breweries ----------
const LINK_LABELS = [['instagram', 'Instagram'], ['untappd', 'Untappd'], ['beeradvocate', 'BeerAdvocate']];
export function breweryLinks(b) {
  const l = b.links ?? {};
  const items = LINK_LABELS.filter(([k]) => l[k]).map(([k, label]) => `<a href="${esc(l[k])}" rel="noopener">${label}</a>`);
  if (!items.length) return NOT_DEFINED;
  return `${items.join(' · ')}${l.checked ? ` <span class="muted small">(checked ${esc(l.checked)})</span>` : ''}`;
}

// The brewery's current beers, grouped by the list they came from, each dated.
export function currentBeersHtml(b) {
  if (!b.current_beers?.length) return `<p>${NOT_DEFINED}</p>`;
  const groups = new Map();
  for (const c of b.current_beers) {
    const k = `${c.source}|${c.as_of}`;
    if (!groups.has(k)) groups.set(k, { source: c.source, as_of: c.as_of, beers: [] });
    groups.get(k).beers.push(c);
  }
  const item = (c) => {
    const detail = [c.style, c.abv ? `${c.abv}% ABV` : ''].filter(Boolean).map(esc).join(', ');
    return `<li>${esc(c.beer_name)}${detail ? ` <span class="muted">(${detail})</span>` : ''}</li>`;
  };
  const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'source'; } };
  return [...groups.values()].map((g) => `<p class="small muted">As of ${esc(g.as_of)}, from <a href="${esc(g.source)}" rel="noopener">${esc(host(g.source))}</a>.</p>
<ul class="list-plain small">${g.beers.map(item).join('')}</ul>`).join('');
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
<dt>Type</dt><dd>${esc(valueLabel('brewery_type', b.brewery_type))}</dd>
<dt>Headquarters</dt><dd>${esc(b.hq.city)}, ${esc(b.hq.state)}</dd>
<dt>Founded</dt><dd>${b.founded ?? NOT_DEFINED}</dd>
<dt>Employees</dt><dd>${b.employees ? `${fmt(b.employees)} (reported)` : NOT_DEFINED}</dd>
<dt>Website</dt><dd>${b.website ? `<a href="${esc(b.website)}" rel="noopener">${esc(b.website.replace(/^https?:\/\//, ''))}</a>` : NOT_DEFINED}</dd>
<dt>Links</dt><dd>${breweryLinks(b)}</dd>
<dt>Locations</dt><dd>${locs.length ? `<ul class="list-plain small">${locs.map((l) => `<li>${esc(l.label || l.city)}: ${esc([l.address_1, l.city, l.state, l.postal_code].filter(Boolean).join(', '))}${l.opened ? ` (opened ${esc(l.opened)})` : ''}${l.kitchen ? ', kitchen' : ''} <a href="${mapLink(l)}" rel="noopener">map</a></li>`).join('')}</ul>` : '<span class="muted">Not available</span>'}</dd>
<dt>Known for</dt><dd>${b.known_for.length ? esc(b.known_for.join('; ')) : (countBy(b.medals, 'style_family').length ? `<span class="muted">${esc(countBy(b.medals, 'style_family').slice(0, 3).map(([k]) => k).join(', '))}</span>` : NOT_DEFINED)}</dd>
</dl>
<h3>current-beers</h3>
${currentBeersHtml(b)}
<h3>ownership-and-investors</h3>
${o ? `<dl class="kv">
<dt>Ownership</dt><dd><span class="pill ${o.ownership_type === 'independent' || o.ownership_type === 'employee-owned' ? 'good' : ''}">${esc(valueLabel('ownership_type', o.ownership_type))}</span></dd>
${o.parent ? `<dt>Parent</dt><dd>${esc(o.parent)}${o.parent_type ? ` <span class="muted small">(${esc(o.parent_type)})</span>` : ''}</dd>` : ''}
${o.investor ? `<dt>Investors</dt><dd>${esc(o.investor)}</dd>` : ''}
${o.stake ? `<dt>Stake</dt><dd>${esc(o.stake)}${o.deal_year ? `, ${esc(o.deal_year)}` : ''}</dd>` : ''}
<dt>BA independent</dt><dd>${esc(o.ba_independent)}</dd>
<dt>Status</dt><dd>${esc(o.status)}</dd>
<dt>Source</dt><dd class="small muted">${esc(o.source)}${o.verified === 'no' ? ' (from public announcements; not independently verified)' : ''}</dd>
</dl>` : `<p>${NOT_DEFINED}</p>`}
<h3>distribution</h3>
${b.distributors.length ? `<dl class="kv">${b.distributors.map((d) => `<dt>${esc(d.channel ? valueLabel('distribution_channel', d.channel) : 'Channel')}</dt><dd>${d.distributor ? `${esc(d.distributor)}, ` : ''}${esc(d.territory)}${d.since ? ` (since ${esc(d.since)})` : ''}${d.verified === 'no' ? ' <span class="pill warn">unverified</span>' : ''}<div class="small muted">${esc(d.notes)}</div><div class="small muted">Source: ${esc(d.source)}</div></dd>`).join('')}</dl>` : `<p>${b.distribution_channel ? esc(valueLabel('distribution_channel', b.distribution_channel)) : NOT_DEFINED}</p>`}
<h3>scale-estimates</h3>
<dl class="kv">
<dt>Barrels / year</dt><dd>${fmt(est.barrels)}${est.basis === 'reported' ? ' <span class="muted small">(reported)</span>' : ` ${estMark(b.key, 'barrels')} <span class="muted small">(${esc(valueLabel('basis', est.basis).toLowerCase())}${est.confidence ? `, ${esc(est.confidence)} confidence` : ''})</span>`}</dd>
<dt>Equivalent</dt><dd class="small">${fmt(est.volume.gallons)} gallons; ${fmt(est.volume.cases_24x12_equivalent)} cases of 24 twelve ounce; about ${fmt(est.volume.cans_16oz_equivalent)} sixteen ounce cans packaged (${Math.round(est.volume.packaged_share * 100)}% packaged assumption) and ${fmt(est.volume.pints_equivalent_draft)} pints on draft</dd>
<dt>Revenue / ARR</dt><dd>${usd(rev.total_revenue_usd)} ${estMark(b.key, 'arr')} <span class="muted small">(range ${usd(rev.low_usd)} to ${usd(rev.high_usd)})</span></dd>
<dt>Gross margin</dt><dd>${pctOf(f.gross_margin)} ${estMark(b.key, 'gross_margin')} <span class="muted small">(gross profit ${usd(f.gross_profit_usd)})</span></dd>
<dt>EBITDA</dt><dd>${usd(f.ebitda_usd)} at ${pctOf(f.ebitda_margin)} ${estMark(b.key, 'ebitda')} <span class="muted small">(range ${pctOf(f.ebitda_margin_low)} to ${pctOf(f.ebitda_margin_high)}, ${usd(f.ebitda_low_usd)} to ${usd(f.ebitda_high_usd)})</span></dd>
<dt>Revenue per barrel</dt><dd>${f.revenue_per_barrel_usd ? usd(f.revenue_per_barrel_usd) : ''} ${estMark(b.key, 'per_barrel')} <span class="muted small">(cost of goods assumption ${usd(f.cogs_per_barrel_usd)} per barrel)</span></dd>
<dt>Per location</dt><dd>${f.revenue_per_location_usd ? usd(f.revenue_per_location_usd) : ''} ${estMark(b.key, 'per_location')} <span class="muted small">across ${b.locations_count} location${b.locations_count === 1 ? '' : 's'}${b.has_kitchen ? ' with kitchens' : ''}</span></dd>
${f.revenue_per_employee_usd ? `<dt>Per employee</dt><dd>${usd(f.revenue_per_employee_usd)} ${estMark(b.key, 'per_employee')}</dd>` : ''}
</dl>
<p class="small muted">(E) marks an estimate; select it to see how that figure was made. <a href="../../about/#estimates">How the estimates are made</a>.</p>
</div>`;
}

// Field names and status keys that prose sometimes quotes (frontmatter keys such as beer-url, trend
// statuses such as did-not-exist) read as plain words on the page; the markdown source keeps them.
export const PROSE_SLUGS = new Set(DATA_SLUGS);
export function registerProseSlugs(docs) {
  for (const d of docs) {
    for (const k of Object.keys(d.data ?? d.fm ?? {})) if (k.includes('-')) PROSE_SLUGS.add(k);
    for (const m of String(d.body ?? '').matchAll(/^#{1,6}\s+([a-z0-9]+(?:-[a-z0-9]+)+)\s*$/gm)) PROSE_SLUGS.add(m[1]);
  }
}
export function renderMarkdownBody(body) {
  const html = marked.parse(body.replace(/^#\s+.*\n+/m, ''), { gfm: true })
    .replace(/<table>/g, '<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap"><table class="data-table">')
    .replace(/<\/table>/g, '</table></div>');
  return unslugText(html, PROSE_SLUGS);
}

function breweryPage(ds, b) {
  const depth = 2;
  const own = b.ownership;
  const pills = [`<span class="pill">${esc(valueLabel('brewery_type', b.brewery_type))}</span>`, `<span class="pill">${esc(b.hq.city)}, ${esc(b.hq.state)}</span>`, b.founded ? `<span class="pill">founded ${b.founded}</span>` : '', own ? `<span class="pill ${['independent', 'employee-owned'].includes(own.ownership_type) ? 'good' : 'warn'}">${esc(valueLabel('ownership_type', own.ownership_type))}${own.parent ? `: ${esc(own.parent)}` : ''}</span>` : '', b.distribution_channel ? `<span class="pill">${esc(valueLabel('distribution_channel', b.distribution_channel))}</span>` : '', b.streak > 1 ? `<span class="pill">${b.streak} year medal streak</span>` : ''].join('');
  const view = viewRegion('brewery', {
    depth,
    scope: { brewery_key: b.key },
    fixed: [{ text: `Brewery: ${b.name}` }],
    page: { brewery: { key: b.key, explain: explainEstimate(b, ds.params), name: b.name, slug: b.slug, trend: b.trend.map((t) => ({ year: t.year, status: t.status })), barrels: b.estimate.barrels, basis: b.estimate.basis, arr: b.financials.arr_usd, ebitda: b.financials.ebitda_usd, ebitda_margin: b.financials.ebitda_margin } },
  });
  const other = b.other_medals.length ? `<h2>other-competitions</h2><p class="small muted">World Beer Cup and other competitions, as recorded; the site filter covers GABF medals only.</p>${otherMedalsTable([...b.other_medals].sort((x, y) => y.year - x.year))}` : '';
  const deepDive = b.profile ? `<section class="prose">${renderMarkdownBody(b.profile.body)}</section>` : '<div class="notice">No deep dive has been written for this brewery yet.</div>';
  const body = `
<p class="small"><a href="../">All breweries</a> · <a href="../../dashboards/breweries/#brewery=${encodeURIComponent(b.key)}">open in the breweries dashboard</a></p>
<h1>${esc(b.name)}</h1>
<p class="lede">${pills}${b.website ? ` <a href="${esc(b.website)}" rel="noopener">website</a>` : ''}</p>
<div class="hero">
${view.html}
${profileCard(b)}
</div>
${other}
<h2>deep-dive</h2>
${deepDive}`;
  write(`breweries/${b.slug}/index.html`, layout({ title: b.name, description: `${b.name}: GABF medal history, locations, ownership, distribution, and scale estimates.`, body, depth, active: 'Breweries', pageData: view.pageData }));
}

function breweriesIndex(ds) {
  const view = viewRegion('breweries-index', { depth: 1, breweryInfo: true });
  const body = `
<h1>Breweries</h1>
<p class="lede">Every medal winning brewery in the loaded results, ranked by points (gold 3, silver 2, bronze 1). Use Filters in the header to narrow by year, style, place, or ownership, or search by name. ARR is an estimate (E).</p>
${view.html}`;
  write('breweries/index.html', layout({ title: 'Breweries', description: 'Every medal winning brewery in the loaded GABF results.', body, depth: 1, active: 'Breweries', pageData: view.pageData }));
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
  const view = viewRegion('category', { depth, scope: { category_name: c.name }, fixed: [{ text: `Category: ${c.name}` }], page: { slug: c.slug } });
  const body = `
<p class="small"><a href="../">${esc(COPY('pages.category-detail.links.back'))}</a></p>
<h1>${esc(c.name)}</h1>
<p class="lede"><span class="pill ${c.special ? 'warn' : 'good'}">${c.special ? 'special category' : 'classic style category'}</span><span class="pill">${esc(c.style_family)}</span>${ref?.abv_min ? `<span class="pill">ABV ${esc(ref.abv_min)} to ${esc(ref.abv_max)}%</span>` : ''}${ref?.ibu_min ? `<span class="pill">IBU ${esc(ref.ibu_min)} to ${esc(ref.ibu_max)}</span>` : ''}${ref?.srm_min ? `<span class="pill">SRM ${esc(ref.srm_min)} to ${esc(ref.srm_max)}</span>` : ''}${c.latest_entries ? `<span class="pill">${fmt(c.latest_entries)} entrants in ${c.latest_entries_year}</span>` : ''} <a href="../../#category_name=${encodeURIComponent(c.name)}">open in dashboards</a></p>
<div class="card definition"><h2>definition</h2><p>${ref?.description ? esc(ref.description) : '<span class="muted">No style description is on file for this category yet.</span>'}</p><p class="small muted">${c.special ? 'Special categories are judged on an added ingredient, process, or nonstandard base rather than a single classic style.' : 'Classic style categories are judged against a single Brewers Association style description.'}${ref?.guideline_source ? ` Source: ${esc(ref.guideline_source)}${ref.confidence ? ` (${esc(ref.confidence)})` : ''}${ref.variant_of ? `, listed as ${esc(ref.variant_of)}` : ''}.` : ''}</p></div>
${view.html}`;
  write(`categories/${c.slug}/index.html`, layout({ title: c.name, description: `${c.name}: definition, entrants by year, and GABF medalists.`, body, depth, active: 'Categories', pageData: view.pageData }));
}

function categoriesIndex(ds, cats) {
  const view = viewRegion('categories-index', { depth: 1 });
  const special = cats.filter((c) => c.special).length;
  const body = `
<h1>Categories</h1>
<p class="lede">${cats.length} GABF categories seen in the loaded results (${special} special, ${cats.length - special} classic), with the style family used for browsing, the style's ABV range, and total entrants from the latest year with counts.</p>
<div class="card"><h2>classic-versus-special</h2><p class="small">A special category is judged on an added ingredient, process, or nonstandard base (fruit, spice, coffee, barrel, smoke, gluten-free, non-alcohol, hybrid, specialty IPA, session beer, Pro-Am, collaboration, cider) rather than a single classic style.</p><p class="small">Style families are a browsing layer over the official categories: IPA, Pale Ale, Lager, Pilsner, Wheat, Stout and Porter, Belgian and French, Sour and Wild, Strong and Barrel-Aged, Brown Amber and Red, British and Irish, German Ale, Fruit Spice and Specialty, Smoke and Wood, Gluten-Free and Non-Alcoholic, Cider and Mead, Pro-Am and Collaboration.</p></div>
${view.html}`;
  write('categories/index.html', layout({ title: 'Categories', description: 'GABF categories, style families, special categories, and ABV ranges.', body, depth: 1, active: 'Categories', pageData: view.pageData }));
}

// ---------- reports ----------
const REPORTS = [
  ['top-breweries', 'Top breweries', 'Medal and point leaders and active streaks.'],
  ['top-categories', 'Top categories', 'Most competitive categories by entrants and entries per medal, and the style families that collect the most medals.'],
  ['by-state', 'By state', 'Medals by state with population adjusted rates.'],
  ['by-region', 'By region', 'Census regions and divisions.'],
  ['ownership', 'Ownership and investors', 'Independent versus large brewer owned medalists, parents, and investors.'],
  ['economics', 'Economics', 'Estimated barrels, ARR, margins, and distribution for every medalist.'],
  ['trends', 'Trends', 'Entries, medals, breweries, and style family share over the years.'],
  ['brewery-of-the-year', 'Brewery of the Year', 'Brewery and Brewer of the Year awards by size bracket.'],
];

function reportsIndex(ds) {
  const body = `<h1>Reports</h1><p class="lede">Ready made views over the loaded results. Each follows the Filters selection in the header, carries a table view for every chart, and saves charts as PNG from the toolbox.</p><ul class="list-plain">${REPORTS.map(([slug, title, desc]) => `<li><a href="${slug}/">${esc(title)}</a> <span class="muted">${esc(desc)}</span></li>`).join('')}</ul>${coveragePills(ds, '../')}`;
  write('reports/index.html', layout({ title: 'Reports', description: 'GABF analysis reports.', body, depth: 1, active: 'Reports' }));
}

// A report page: lede, the filterable view, and any static sections before or after it.
function reportLayout(slug, title, { lede, viewName = null, before = '', after = '', breweryInfo = false, page = {} }) {
  const view = viewName ? viewRegion(viewName, { depth: 2, breweryInfo, page }) : null;
  const body = `<p class="small"><a href="../">All reports</a></p><h1>${esc(title)}</h1><p class="lede">${lede}</p>${before}${view ? view.html : ''}${after}`;
  write(`reports/${slug}/index.html`, layout({ title, description: `${title} report.`, body, depth: 2, active: 'Reports', pageData: view ? view.pageData : null }));
}

function topBreweries() {
  reportLayout('top-breweries', 'Top breweries', { viewName: 'top-breweries', breweryInfo: true, lede: 'Points weight gold 3, silver 2, bronze 1. Rankings use the medals in view; partial years join them only when you include them in Filters.' });
}

function topCategories() {
  reportLayout('top-categories', 'Top categories', { viewName: 'top-categories', lede: 'Total entrants per category come from the category headers of the official list and show where competition is fiercest. Entries per medal reads each category as odds: how many entries each medal had to beat. Special categories (added ingredient, process, or catch all) are marked.' });
}

function byState() {
  reportLayout('by-state', 'By state', { viewName: 'by-state', lede: "Medals by state with population and GDP adjusted rates: each medal counts against its own year's Census population estimate and BEA real GDP (2026 medals use 2025, the latest published year). The geography dashboard adds Federal Reserve districts, demographic controls, and click to focus." });
}

function byRegion() {
  reportLayout('by-region', 'By region', { viewName: 'by-region', lede: "Census regions (Northeast, Midwest, South, West) and their divisions. Per million uses each medal year's Census population estimate." });
}

function ownershipReport(ds) {
  const r = '../../';
  const after = `<h2>ownership-table</h2>
<p class="small muted">Every ownership record on file, whether or not the brewery has medaled in the loaded years. The site filter does not narrow this list.</p>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([
    { key: 'brewery_name', label: 'Brewery', render: (o) => { const b = ds.breweries.find((x) => x.ownership === o); return b ? `<a href="${r}breweries/${b.slug}/">${esc(o.brewery_name)}</a>` : esc(o.brewery_name); } },
    { key: 'hq', label: 'HQ', render: (o) => `${esc(o.hq_city)}, ${esc(o.hq_state)}` },
    { key: 'ownership_type', label: 'Type', render: (o) => esc(valueLabel('ownership_type', o.ownership_type)) },
    { key: 'parent', label: 'Parent' },
    { key: 'investor', label: 'Investors' },
    { key: 'stake', label: 'Stake' },
    { key: 'deal_year', label: 'Year', numeric: true },
    { key: 'ba_independent', label: 'BA independent' },
    { key: 'status', label: 'Status' },
    { key: 'verified', label: 'Verified' },
  ], ds.ownership)}</div>`;
  reportLayout('ownership', 'Ownership and investors', { viewName: 'ownership', after, page: { ownershipKeys: ds.breweries.filter((b) => b.ownership).map((b) => b.key) }, lede: 'Who owns the medal winners. The Brewers Association counts a brewer as independent when less than 25 percent is owned or controlled by a non craft alcohol company. Ownership records come from public deal announcements and are marked unverified until checked; a brewery with no record is counted as independent.' });
}

function economicsReport() {
  reportLayout('economics', 'Economics', { viewName: 'economics', breweryInfo: true, lede: 'Estimated economics for every medalist in view: barrels, ARR (annual revenue run rate), gross margin, EBITDA with a channel based range, and distribution channel. Every figure is an estimate (E) unless a reported production number exists; the About page explains how the estimates are made.' });
}

function trendsReport(ds) {
  const summary = ds.summary.filter((s) => s.competition === 'GABF').sort((a, b) => Number(a.year) - Number(b.year));
  const labels = summary.map((s) => s.year);
  const before = `<p class="small muted">The first two charts and the scale table are the Brewers Association's published totals for the whole competition, so the site filter does not change them. The style family chart and the movers below follow the filter.</p>
<div class="grid two">
${figure({ id: 'entries-trend', title: 'Entries judged', height: 260, option: lineOption({ labels, series: [{ name: 'Entries', data: summary.map((s) => (s.entries ? Number(s.entries) : null)), color: SERIES_COLORS[0] }], saveName: 'entries-judged' }), table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'entries', label: 'Entries', numeric: true, render: (s) => fmt(s.entries) }], summary, { className: 'data-table' }) })}
${figure({ id: 'medals-breweries-trend', title: 'Medals awarded and breweries entering', height: 260, option: lineOption({ labels, series: [{ name: 'Medals', data: summary.map((s) => (s.medals ? Number(s.medals) : null)), color: SERIES_COLORS[0] }, { name: 'Breweries entering', data: summary.map((s) => (s.entering_breweries ? Number(s.entering_breweries) : null)), color: SERIES_COLORS[1] }], saveName: 'medals-and-breweries' }), table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'medals', label: 'Medals', numeric: true, render: (s) => fmt(s.medals) }, { key: 'entering_breweries', label: 'Breweries entering', numeric: true, render: (s) => fmt(s.entering_breweries) }], summary, { className: 'data-table' }) })}
</div>
<h2>competition-scale-by-year</h2>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([{ key: 'year', label: 'Year', numeric: true }, { key: 'ceremony_date', label: 'Awards date' }, { key: 'venue', label: 'Venue' }, { key: 'entries', label: 'Entries', numeric: true, render: (s) => fmt(s.entries) }, { key: 'entering_breweries', label: 'Breweries entering', numeric: true, render: (s) => fmt(s.entering_breweries) }, { key: 'medals', label: 'Medals', numeric: true, render: (s) => fmt(s.medals) }, { key: 'winning_breweries', label: 'Winning breweries', numeric: true, render: (s) => fmt(s.winning_breweries) }, { key: 'categories', label: 'Categories', numeric: true }, { key: 'loaded', label: 'Loaded', render: (s) => `<span class="pill ${ds.coverage[s.year] ?? 'pending'}">${esc(ds.coverage[s.year] ?? 'pending')}</span>` }, { key: 'notes', label: 'Notes', render: (s) => `<span class="small">${esc(s.notes)}</span>` }], summary)}</div>
<h2>style-families-and-movers</h2>`;
  reportLayout('trends', 'Trends', { viewName: 'trends', before, lede: "Competition scale from the Brewers Association's annual releases, plus style family share and year over year movers from the loaded results. Blank cells are figures the release did not state." });
}

function botyReport(ds) {
  const r = '../../';
  const rows = [...ds.awards].sort((a, b) => Number(b.year) - Number(a.year) || a.award.localeCompare(b.award));
  const after = `<p class="small muted">These are awards, not medal rows, so the site filter does not narrow this list.</p>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([{ key: 'year', label: 'Year', numeric: true }, { key: 'award', label: 'Award' }, { key: 'bracket', label: 'Bracket' }, { key: 'brewery_name', label: 'Brewery', render: (a) => { const b = ds.breweries.find((x) => x.names?.includes?.(a.brewery_name) || x.name === a.brewery_name); return b ? `<a href="${r}breweries/${b.slug}/">${esc(a.brewery_printed)}</a>` : esc(a.brewery_printed); } }, { key: 'city', label: 'City', render: (a) => `${esc(a.city)}, ${esc(a.state)}` }, { key: 'source', label: 'Source', render: (a) => `<span class="small muted">${esc(a.source)}</span>` }], rows)}</div>
${rows.length < 12 ? '<p class="small muted">Only the awards confirmed so far are listed; the ingest adds the full set for each year from the official list.</p>' : ''}`;
  reportLayout('brewery-of-the-year', 'Brewery of the Year', { after, lede: "Brewery and Brewer of the Year awards by production bracket. From 2026 the bracket is judged on a company's total production across all locations, with a new bracket above 100,000 barrels replacing the former Brewery Group award." });
}

// ---------- winner research profiles ----------
const NOT_PUBLISHED = '<span class="muted">not published</span>';
const isBlank = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const chips = (list) => (isBlank(list) ? NOT_PUBLISHED : `<span class="chips">${list.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</span>`);
const abvText = (v) => (isBlank(v) ? '' : `${Number(v).toFixed(1).replace(/\.0$/, '')}%`);

function specCard(fm) {
  const big = (label, v, text) => `<div class="spec-figure"><dt>${label}</dt><dd>${isBlank(v) ? NOT_PUBLISHED : `<span class="spec-number">${esc(text)}</span>`}</dd></div>`;
  return `<section class="card spec-card" aria-labelledby="spec-title">
<h2 id="spec-title">${esc(COPY('pages.beer-detail.specs.title'))}</h2>
<dl class="spec-figures">${big(esc(COPY('pages.beer-detail.specs.abv')), fm.abv, abvText(fm.abv))}${big(esc(COPY('pages.beer-detail.specs.ibu')), fm.ibu, String(fm.ibu))}</dl>
<dl class="kv spec-kv">
<dt>${esc(COPY('pages.beer-detail.specs.style'))}</dt><dd>${isBlank(fm.style) ? NOT_PUBLISHED : esc(fm.style)}</dd>
<dt>${esc(COPY('pages.beer-detail.specs.hops'))}</dt><dd>${chips(fm.hops)}</dd>
<dt>${esc(COPY('pages.beer-detail.specs.malts'))}</dt><dd>${chips(fm.malts)}</dd>
<dt>${esc(COPY('pages.beer-detail.specs.yeast'))}</dt><dd>${chips(fm.yeast)}</dd>
<dt>${esc(COPY('pages.beer-detail.specs.adjuncts'))}</dt><dd>${chips(fm.adjuncts)}</dd>
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
    fm['beer-url'] ? `<a class="btn-link" href="${esc(fm['beer-url'])}" rel="noopener">${esc(COPY('pages.beer-detail.buttons.beer_page'))}</a>` : '',
    fm['brewery-url'] ? `<a class="btn-link" href="${esc(fm['brewery-url'])}" rel="noopener">${esc(COPY('pages.beer-detail.buttons.brewery_website'))}</a>` : '',
    row ? `<a class="btn-link" href="${r}breweries/${esc(row.brewery_slug)}/">${esc(COPY('pages.beer-detail.buttons.brewery_history'))}</a>` : '',
    row ? `<a class="btn-link" href="${r}categories/${esc(row.category_slug)}/">${esc(COPY('pages.beer-detail.buttons.category_history'))}</a>` : '',
  ].filter(Boolean).join('');
  const body = `
<p class="small"><a href="../">${p.year} winners</a> · Category ${esc(fm['category-number'])}</p>
<h1>${esc(fm.beer)}</h1>
<p class="lede"><span class="pill medal-pill ${medal.toLowerCase()}"><span class="badge-medal ${medal.toLowerCase()}" aria-hidden="true"></span>${esc(medal)}</span> in ${categoryLink}${fm.entries ? ` (${fmt(fm.entries)} entries)` : ''} · ${breweryLink}, ${esc(fm['brewery-city'])}, ${esc(fm['brewery-state'])}</p>
${links ? `<p class="link-row">${links}</p>` : ''}
${HOP_PAGES.beerHopHtml(HOP_PAGES.model.beers.get(p.stem), { r })}
<div class="beer-layout">
${specCard(fm)}
<section class="prose">${renderMarkdownBody(p.body)}</section>
</div>`;
  write(`beers/${p.year}/${p.stem}/index.html`, layout({ title: `${fm.beer}, ${fm.brewery}`, description: `${fm.beer} by ${fm.brewery}: ${medal} medal, ${p.year} Great American Beer Festival, ${fm['category-name']}. Published specs and research notes.`, body, depth, active: `${p.year} winners` }));
}

function winnersIndex(year, profiles) {
  const specs = Object.fromEntries(profiles.map((p) => [`beers/${p.year}/${p.stem}/`, { abv: p.fm.abv ?? null, ibu: p.fm.ibu ?? null, hops: HOP_PAGES.model.beers.get(p.stem)?.usage.map((u) => u.canonical) ?? p.fm.hops ?? [], beer_url: p.fm['beer-url'] ?? null }]));
  const view = viewRegion('winners', { depth: 2, scope: { year: String(year) }, fixed: [{ text: `Year: ${year}` }], page: { specs } });
  const body = `
<h1>${year} winners</h1>
<p class="lede">Every medal from the ${year} Great American Beer Festival with the beer's published specs: style, ABV, IBU, and named hops, malts, yeast, and adjuncts, each from the brewery or a cited source. Open a beer for its full research notes. Use Filters in the header to narrow by medal, style, place, or brewery, or search by beer, brewery, or hop.</p>
<p class="link-row"><a class="btn-link" href="../../first-time-medalists/${year}/">First time medalists in ${year}</a><a class="btn-link" href="../../explorer/">Open the explorer</a></p>
${view.html}`;
  write(`beers/${year}/index.html`, layout({ title: `${year} winners`, description: `All ${profiles.length} medals of the ${year} Great American Beer Festival with published ABV, IBU, hops, malts, yeast, and adjuncts.`, body, depth: 2, active: `${year} winners`, pageData: view.pageData }));
}

function firstTimePage(ds) {
  const year = WINNER_YEAR;
  const { partialYears, ambiguous, status } = ds.firstTime;
  const complete = ds.years.filter((y) => ds.coverage[y] === 'complete');
  const completeRange = complete.length ? `${complete[0]} to ${complete[complete.length - 1]}` : '';
  const pending = ds.years.filter((y) => ds.coverage[y] === 'pending');
  const view = viewRegion('first-time', { depth: 2, scope: { year: String(year) }, fixed: [{ text: `Year: ${year}` }], page: { year, partialYears, completeRange } });
  const body = `
<h1>First time medalists in ${year}</h1>
<p class="lede">Breweries whose first GABF medal in the loaded results came in ${year}, with each of their ${year} medals and the field each medal beat.</p>
<section class="card definition" aria-labelledby="ft-definition"><h2 id="ft-definition">How first time is defined</h2>
<p>The loaded results run ${ds.years[0]} to ${ds.years[ds.years.length - 1]}. ${partialYears.join(' and ')} hold only a sample of medals from secondary sources${pending.length ? `, and ${pending.join(' and ')} has no results loaded` : ''}. A first time medalist has no medal in any loaded year before ${year}; a medal in a year that is not loaded cannot be seen, so a brewery that last won only then is counted here. Breweries are matched on the site's normalized brewery key, so renamed printings and location suffixes such as "(Costa Mesa)" roll up to one brewery.</p>
<p>A brewery whose only earlier medals fall in the partial years is listed separately as first in the complete record (${completeRange}).</p>
<p class="small muted">${[...status.values()].filter((s) => s === 'new').length} breweries are first time medalists and ${[...status.values()].filter((s) => s === 'new-complete').length} are first in the complete record, before any filter.</p></section>
${view.html}
<h2>names-to-check</h2>
${ambiguous.length ? `<p class="small muted">These first time medalists share a city with an earlier medalist under a different name, or one name contains the other. They are kept as separate breweries because nothing in the data confirms they are the same; check them before relying on the count.</p>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap"><table class="data-table"><thead><tr><th scope="col">First time medalist</th><th scope="col">Earlier medalist to compare</th></tr></thead><tbody>${ambiguous.map((a) => `<tr><td>${esc(a.name)} <span class="muted small">${esc(a.city)}, ${esc(a.state)}</span></td><td>${a.candidates.map((c) => `${esc(c.name)} <span class="muted small">${esc(c.city)}, ${esc(c.state)}; ${c.years.join(', ')}</span>`).join('<br>')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No first time medalist shares a city and a name token with an earlier medalist.</p>'}`;
  write(`first-time-medalists/${year}/index.html`, layout({ title: `First time medalists in ${year}`, description: `Breweries whose first GABF medal in the loaded results came in ${year}.`, body, depth: 2, active: 'First time medalists', pageData: view.pageData }));
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
  if (REVIEW) writeFileSync(resolve(DIST, 'explorer', 'index.html'), annotatePage(readFileSync(src, 'utf8'), 'explorer/index.html', 'scripts/build-explorer.mjs'));
  else cpSync(src, resolve(DIST, 'explorer', 'index.html'));
}

// ---------- about ----------
export function aboutHtml(ds) {
  const SOURCE = { complete: 'Official winners list', partial: 'A sample of medals from secondary sources', draft: 'Transcribed from the awards ceremony, pending the official list', pending: 'Not available' };
  const rows = ds.years.map((y) => ({ year: y, status: ds.coverage[y], rows: ds.results.filter((x) => x.year === y).length, source: SOURCE[ds.coverage[y]] ?? 'Not available' }));
  return `
<h1>About this site</h1>
<p class="lede">An independent analysis of Great American Beer Festival competition results, built from public data and published with GitHub Pages. Charts are drawn with Apache ECharts; each one has a table view and saves as a PNG. The <a href="${REPO_URL}">source code and data</a> are public.</p>
<h2>coverage</h2>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([{ key: 'year', label: 'Year', numeric: true }, { key: 'status', label: 'Status', render: (x) => `<span class="pill ${x.status}">${esc(x.status.charAt(0).toUpperCase() + x.status.slice(1))}</span>` }, { key: 'rows', label: 'Medals on this site', numeric: true }, { key: 'source', label: 'Source', render: (x) => `<span class="small">${esc(x.source)}</span>` }], rows)}</div>
<p class="small">Complete years carry every medal from the official list. Partial years hold only a sample of medals from secondary sources and are hidden by default; include them from Filters. Pending years have no results on this site.</p>
<h2>data-sources</h2>
<ul class="list-plain">
<li>Results: the Brewers Association's official GABF winners lists. Category names and total entrants come from the same lists. Before an official list is posted, results can be transcribed from the live awards ceremony and are marked as a draft.</li>
<li>Brewery locations, coordinates, type, and websites: <a href="https://www.openbrewerydb.org">Open Brewery DB</a> (free, open) plus corrections checked by hand.</li>
<li>Style definitions and ABV, IBU, and SRM ranges: Brewers Association Beer Style Guidelines. Categories judged on an added ingredient or process are marked special.</li>
<li>Ownership, investors, and distributors: public announcements (company releases, Brewbound, trade press, state license lookups). Each record says whether it has been verified.</li>
<li>Demographics and denominators: Census Bureau annual population estimates (July 1, Vintage 2020 for 2018 and 2019, Vintage 2025 for 2020 to 2025; 2026 medals use 2025), BEA real GDP in chained 2017 dollars and nominal GDP by state (SAGDP1) and county (CAGDP1), ACS 2024 one year estimates (age, race and Hispanic origin, education, median household income, poverty), 2020 Census urban share, NCES PIAAC modeled literacy estimates (pooled 2012, 2014, and 2017), and NCHS state life expectancy for 2022. Census regions and divisions follow the Census Bureau's definitions.</li>
<li>Federal Reserve districts: the Board of Governors' district descriptions and the Reserve Banks' county lists (St. Louis, Minneapolis, Dallas, Philadelphia), with counts checked against Cleveland Fed and FRASER figures. Medals in split states are assigned by the medal city's county from the Census place and county subdivision files. West Virginia has no published county list and is assigned whole to the Richmond district as an approximation. District GDP for split states is apportioned by county GDP shares (E).</li>
<li>Competition totals: Brewers Association annual releases and same day coverage of each announcement.</li>
</ul>
<h2 id="estimates">estimates</h2>
<p>Production, volume, revenue, and margin figures marked (E) are estimates. Volume comes from the best available evidence, in this order: a figure the brewery reported, then the midpoint of its Brewery of the Year size bracket, then a researched estimate, then a typical volume for its brewery type and number of locations. Conversions use the US beer barrel (31 gallons): 13.78 cases of 24 twelve ounce containers, 248 sixteen ounce cans or pints, 330.7 twelve ounce cans. Revenue uses Brewers Association benchmark revenue per barrel by channel (direct to consumer 1,276 USD, distributed 602 USD, blended by brewery type) plus food revenue per kitchen location. ARR is the annual revenue run rate. Gross margin and EBITDA margin are point estimates by brewery type with channel ranges (taproom 8 to 24 percent, self distribution 5 to 11 percent, distributor 2 to 6 percent). The figures behind these assumptions are published with the source code.</p>
<h2>reading-a-brewery-trend</h2>
<p>A brewery's yearly trend distinguishes: medaled, no medal recorded, did not exist yet (year before its founding), closed, results not yet published, year only partially available, and no results available. A partial year is labelled as such rather than counted as a miss.</p>
<h2>attribution</h2>
<p>Great American Beer Festival and GABF are trademarks of the Brewers Association. Style guideline content is used with attribution for noncommercial analysis. Open Brewery DB data is open. Apache ECharts is Apache 2.0 licensed. US state boundaries come from the US Atlas project (US Census Bureau cartographic boundaries). This site is not affiliated with the Brewers Association.</p>`;
}

function aboutPage(ds) {
  const body = aboutHtml(ds);
  write('about/index.html', layout({ title: 'About', description: 'Data sources, coverage, and methods.', body, depth: 1, active: 'About' }));
}

// ---------- main ----------
export function build({ clean = true } = {}) {
  assertReviewAllowed();
  const ds = loadDataset();
  const cats = categoryIndex(ds);
  enrichResults(ds);
  if (clean && existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  if (!existsSync(resolve(SITE, 'assets', 'us-states.geo.json'))) buildGeo();
  cpSync(resolve(SITE, 'assets'), resolve(DIST, 'assets'), { recursive: true });
  mkdirSync(resolve(DIST, 'assets', 'vendor'), { recursive: true });
  cpSync(require.resolve('echarts/dist/echarts.min.js'), resolve(DIST, 'assets', 'vendor', 'echarts.min.js'));
  writeFileSync(resolve(DIST, '.nojekyll'), '');
  if (REVIEW) copyReviewAssets(DIST);
  writeData(ds, cats);
  dashboardPages(ds);
  breweriesIndex(ds);
  for (const b of ds.breweries) breweryPage(ds, b);
  categoriesIndex(ds, cats);
  for (const c of cats) categoryPage(ds, c);
  reportsIndex(ds);
  topBreweries();
  topCategories();
  byState();
  byRegion();
  ownershipReport(ds);
  economicsReport();
  trendsReport(ds);
  botyReport(ds);
  aboutPage(ds);
  HOP_PAGES = createHopPages({ model: ds.hops, ds, layout, write, COPY, renderMarkdownBody, registerDocs: registerProseSlugs, notDefined: NOT_DEFINED, year: WINNER_YEAR, meta: { copy: { cards: CARD_COPY() } } });
  const hopsBuilt = HOP_PAGES.writeAll();
  const winners = winnerPages(ds, ds.winnerProfiles);
  firstTimePage(ds);
  copyExplorer();
  // Review build only: the copy keys the pages above read, so an inline edit changes the key the build draws.
  if (REVIEW) writeFileSync(resolve(DIST, 'review-copy-keys.json'), JSON.stringify([...COPY.used].sort()));
  return { winners, hops: hopsBuilt, pages: countFiles(DIST, '.html'), breweries: ds.breweries.length, categories: cats.length, results: ds.results.length, years: ds.years };
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
  console.log(`hop pages: ${r.hops.varieties} varieties, ${r.hops.farms} farms, ${r.hops.pages} pages including the two indexes`);
  console.log(`built ${r.pages} pages for ${r.results} medal rows, ${r.breweries} breweries, ${r.categories} categories, years ${r.years.join(', ')} -> ${DIST}`);
}
