// Interactive dashboards: one filter row scopes every panel on the page; panels are
// Apache ECharts figures (with table views) plus stat tiles and result tables. Which
// panels appear is set by the page's data-dashboard attribute. Clicking a state on the
// map, a year column, a category bar, or a brewery bar narrows or navigates.
import { compact, countBy, esc, figure, gsbColumn, statTile, statusLabel, statusShort, tableHtml } from './charts.mjs';
import { estMark, installEstimates } from './estimates.mjs';
import { barsHOption, lineOption, mapOption, MEDAL_COLORS, scatterOption, SERIES_COLORS, stackedColumnsOption } from './chart-options.mjs';
import { CONTROL_FIELDS, latestValue, medalRates } from './rates.mjs';
import { applyFilters as applyGlobal, createGlobalFilter, decorateRows, emptyStateHtml, hashFor, parseHash, partialNoticeHtml, pickState, STATE_KEYS, valueLabel } from './filter-bar.mjs';
import { oddsItems, specNoteHtml as specNote, yearsInView } from './page-views.mjs';
import { sortByLabel } from './sort-order.mjs';
import { NOT_FOUND_HTML } from './not-found.mjs';
import { setSiteText, tx } from './site-text.mjs';

// state.filters holds this page's own keys (tab, brewery); the site wide selection lives in the
// global filter (ctl.state), shared with every other page.
const state = { rows: [], meta: null, breweries: [], categories: [], filters: {} };
let ctl = null;
const base = window.GABF_BASE || './';
// Standalone mode: the single-file build embeds its data (window.GABF_DATA), so there is no
// server, no page navigation, and links become in-page hash routes.
const STANDALONE = typeof window.GABF_DATA === 'object' && window.GABF_DATA !== null;
// The single file has no #site-text script: its copy entries travel in the embedded payload.
if (STANDALONE) setSiteText(window.GABF_DATA.meta?.copy?.text);
// The rate panels use the latest published population and GDP year for the newest medal year.
const RATE_YEARS = { latest_year: 2026, data_year: 2025 };
const bHref = (slug) => {
  if (!STANDALONE) return `${base}breweries/${slug}/`;
  const b = state.breweries.find((x) => x.slug === slug);
  return `#tab=breweries&brewery=${encodeURIComponent(b ? b.key : slug)}`;
};
const cHref = (name, slug) => (STANDALONE ? `#tab=categories&category_name=${encodeURIComponent(name)}` : `${base}categories/${slug}/`);
const qs = (id) => document.getElementById(id);
const pageKeys = (obj) => Object.fromEntries(Object.entries(obj).filter(([k, v]) => !STATE_KEYS.includes(k) && v));

function writeHash() {
  try { history.replaceState(null, '', location.href.split('#')[0] + hashFor({ ...pageKeys(state.filters), ...pickState(ctl.state) })); } catch (e) { /* file:// may refuse; the view still works */ }
}

// The global selection, then this page's brewery pick (the breweries dashboard, or its tab in the single file).
function applyFilters(rows) {
  const f = state.filters;
  return applyGlobal(rows, ctl.state).filter((r) => !(f.brewery && (!STANDALONE || f.tab === 'breweries') && r.brewery_key !== f.brewery));
}

// A click on a bar, column, or state toggles that value in the global filter.
function setFilter(id, value) {
  ctl.set(id, ctl.state[id] === String(value) ? '' : value);
}

// ---------- panel builders: each returns { option, table, height, onClick, note } ----------
function yearRows(rows) {
  return yearsInView(state.meta, ctl.state).map((y) => {
    const yr = rows.filter((r) => r.year === y);
    const cov = state.meta.coverage[y];
    return { year: y, gold: yr.filter((r) => r.medal === 'Gold').length, silver: yr.filter((r) => r.medal === 'Silver').length, bronze: yr.filter((r) => r.medal === 'Bronze').length, total: yr.length, note: cov === 'complete' ? '' : cov };
  });
}

const PANELS = {
  'medals-by-year': { title: tx('pages.dashboards.panels.medals_by_year.title', 'Medals by Year'), subtitle: tx('pages.dashboards.panels.medals_by_year.subtitle', 'Stacked by medal. Select a column to filter by that year.'), build(rows) {
    const yr = yearRows(rows);
    const option = stackedColumnsOption({ labels: yr.map((r) => r.year), notes: yr.map((r) => r.note), series: [{ name: 'Gold', data: yr.map((r) => r.gold), color: MEDAL_COLORS.Gold }, { name: 'Silver', data: yr.map((r) => r.silver), color: MEDAL_COLORS.Silver }, { name: 'Bronze', data: yr.map((r) => r.bronze), color: MEDAL_COLORS.Bronze }], saveName: 'medals-by-year' });
    return { option, height: 280, onClick: (p) => setFilter('year', String(yr[p.dataIndex].year)), table: tableHtml([{ key: 'year', label: 'Year' }, gsbColumn((r) => [r.gold, r.silver, r.bronze]), { key: 'note', label: 'Coverage' }], yr, { className: 'data-table' }) };
  } },
  map: { title: tx('pages.dashboards.panels.map.title', 'Medals by State'), subtitle: tx('pages.dashboards.panels.map.subtitle', 'Select a state to filter by it.'), build(rows) {
    const counts = countBy(rows, 'state_name');
    const data = state.meta.states.map((s) => ({ name: s.name, value: counts.find(([n]) => n === s.name)?.[1] ?? 0 }));
    const option = mapOption({ data, saveName: 'medals-by-state' });
    return { option, height: 420, onClick: (p) => { const code = state.meta.states.find((s) => s.name === p.name)?.state; if (code) setFilter('state', code); }, table: tableHtml([{ key: 'name', label: 'State' }, { key: 'value', label: 'Medals', numeric: true }], data.filter((d) => d.value).sort((a, b) => b.value - a.value), { className: 'data-table' }) };
  } },
  'by-family': { title: tx('pages.dashboards.panels.by_family.title', 'Medals by Style Family'), subtitle: 'click to focus a family', build(rows) {
    const items = countBy(rows, 'style_family').map(([label, value]) => ({ label, value }));
    return { option: barsHOption({ items, color: 'var(--series-3)', saveName: 'medals-by-style-family' }), height: Math.max(220, 36 * items.length + 60), onClick: (p) => setFilter('style_family', p.name), table: tableHtml([{ key: 'label', label: tx('global.tables.medal_columns.style_family', 'Style Family') }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'top-breweries': { title: tx('pages.dashboards.panels.top_breweries.title', 'Top Breweries'), subtitle: tx('pages.dashboards.panels.top_breweries.subtitle', 'Ranked by points (gold 3, silver 2, bronze 1). Select a brewery to open it.'), build(rows) {
    const m = new Map();
    for (const r of rows) {
      const cur = m.get(r.brewery_key) ?? { label: r.brewery_name, value: 0, pts: 0, slug: r.brewery_slug };
      cur.value += 1; cur.pts += r.points; m.set(r.brewery_key, cur);
    }
    const items = [...m.values()].sort((a, b) => b.pts - a.pts || b.value - a.value).slice(0, 15).map((b) => ({ label: b.label, value: b.pts, href: bHref(b.slug), medals: b.value }));
    return { option: barsHOption({ items, color: 'var(--series-2)', valueName: 'Points', saveName: 'top-breweries' }), height: Math.max(220, 36 * items.length + 60), table: tableHtml([{ key: 'label', label: 'Brewery' }, { key: 'value', label: 'Points', numeric: true }, { key: 'medals', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'by-region': { title: tx('pages.dashboards.panels.by_region.title', 'Medals by Census Region'), build(rows) {
    const items = countBy(rows, 'region').map(([label, value]) => ({ label, value }));
    return { option: barsHOption({ items, saveName: 'medals-by-region' }), height: 220, onClick: (p) => setFilter('region', p.name), table: tableHtml([{ key: 'label', label: 'Region' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'by-division': { title: tx('pages.dashboards.panels.by_division.title', 'Medals by Census Division'), build(rows) {
    const items = countBy(rows, 'division').map(([label, value]) => ({ label, value }));
    return { option: barsHOption({ items, color: 'var(--series-3)', saveName: 'medals-by-division' }), height: Math.max(220, 36 * items.length + 60), table: tableHtml([{ key: 'label', label: 'Division' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'per-capita': { title: tx('pages.dashboards.panels.per_capita.title', 'Medals per Million Residents, by State'), subtitle: tx('pages.dashboards.panels.per_capita.subtitle', "Each medal against its year's Census population; {{latest_year}} uses {{data_year}}.", RATE_YEARS), build(rows) {
    const items = stateRateItems(rows, 'per_million');
    return { option: barsHOption({ items, color: 'var(--series-3)', valueName: 'Per Million', saveName: 'medals-per-million' }), height: Math.max(220, 36 * items.length + 60), onClick: (p) => { const it = items.find((i) => i.label === p.name); if (it) setFilter('state', it.code); }, table: tableHtml([{ key: 'label', label: 'State' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'value', label: 'Per Million', numeric: true }], items, { className: 'data-table' }) };
  } },
  'per-gdp': { title: tx('pages.dashboards.panels.per_gdp.title', 'Medals per $100 Billion of Real GDP, by State'), subtitle: tx('pages.dashboards.panels.per_gdp.subtitle', "Real GDP in 2017 dollars, in each medal's year; {{latest_year}} uses {{data_year}}.", RATE_YEARS), build(rows) {
    const items = stateRateItems(rows, 'per_100b_gdp');
    return { option: barsHOption({ items, color: 'var(--series-2)', valueName: 'Per $100B', saveName: 'medals-per-gdp' }), height: Math.max(220, 36 * items.length + 60), onClick: (p) => { const it = items.find((i) => i.label === p.name); if (it) setFilter('state', it.code); }, table: tableHtml([{ key: 'label', label: 'State' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'value', label: 'Per $100B Real GDP', numeric: true }], items, { className: 'data-table' }) };
  } },
  'by-fed-district': { title: tx('pages.dashboards.panels.by_fed_district.title', 'Medals by Federal Reserve District'), subtitle: tx('pages.dashboards.panels.by_fed_district.subtitle', "Most medals first. Split states are placed by the medal city's county. Select a district to filter by it."), build(rows) {
    const items = districtItems(rows).map((d) => ({ label: d.label, value: d.medals, name: d.name })).sort((a, b) => b.value - a.value);
    const approx = rows.filter((r) => /approximation/.test(r.fed_district_method)).length;
    return { option: barsHOption({ items, color: 'var(--series-1)', saveName: 'medals-by-fed-district' }), height: Math.max(220, 34 * items.length + 60), onClick: (p) => { const it = items.find((i) => i.label === p.name); if (it) setFilter('fed_district_name', it.name); }, note: approx ? `${approx} medal${approx === 1 ? '' : 's'} in view sit in West Virginia, which is assigned whole to the Richmond district as an approximation (no primary county list).` : '', table: tableHtml([{ key: 'label', label: 'District' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'district-rates': { title: tx('pages.dashboards.panels.district_rates.title', 'Medals per Million Residents, by Fed District'), subtitle: tx('pages.dashboards.panels.district_rates.subtitle', 'District population from whole states plus split state counties, in each medal year.'), build(rows) {
    const list = districtItems(rows);
    const items = list.map((d) => ({ label: d.label, value: Number(d.per_million.toFixed(2)), name: d.name, medals: d.medals, per_gdp: d.per_100b_gdp.toFixed(2) })).sort((a, b) => b.value - a.value);
    return { option: barsHOption({ items, color: 'var(--series-3)', valueName: 'Per Million', saveName: 'fed-district-per-million' }), height: Math.max(220, 34 * items.length + 60), onClick: (p) => { const it = items.find((i) => i.label === p.name); if (it) setFilter('fed_district_name', it.name); }, note: 'Per $100B real GDP is in the table view; split state GDP is apportioned by county GDP shares (E).', table: tableHtml([{ key: 'label', label: 'District' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'value', label: 'Per Million', numeric: true }, { key: 'per_gdp', label: 'Per $100B Real GDP (E)', numeric: true }], items, { className: 'data-table' }) };
  } },
  entrants: { title: tx('pages.dashboards.panels.entrants.title', 'Entrants by Category'), subtitle: tx('pages.dashboards.panels.entrants.subtitle', 'Entries judged, most crowded first. Special categories are marked. Select a category to filter by it.'), build(rows) {
    const m = new Map();
    for (const r of rows) if (r.entries) { const cur = m.get(r.category_name) ?? { label: r.category_name, value: 0, special: r.special, years: new Set() }; cur.value = Math.max(cur.value, r.entries); cur.years.add(r.year); m.set(r.category_name, cur); }
    const items = [...m.values()].sort((a, b) => b.value - a.value).slice(0, 25).map((c) => ({ label: `${c.label}${c.special ? ' (special)' : ''}`, value: c.value, name: c.label, years: [...c.years].join(', ') }));
    return { option: barsHOption({ items, valueName: 'Entries', labelWidth: 240, saveName: 'entrants-by-category' }), height: Math.max(220, 32 * items.length + 60), onClick: (p) => { const it = items.find((i) => i.label === p.name); if (it) setFilter('category_name', it.name); }, note: 'Entry counts come from the category headers of the official list; a partial year shows counts for its sample of medals alone.', table: tableHtml([{ key: 'name', label: 'Category' }, { key: 'value', label: 'Entries', numeric: true }, { key: 'years', label: 'Years' }], items, { className: 'data-table' }) };
  } },
  'entry-odds': { title: tx('pages.dashboards.panels.entry_odds.title', 'Hardest Categories to Medal in'), subtitle: tx('pages.dashboards.panels.entry_odds.subtitle', 'Entries per medal, highest first. Select a category to filter by it.'), build(rows) {
    const odds = oddsItems(rows, { words: {
      note: tx('pages.dashboards.panels.entry_odds.note', 'Entries divided by medals awarded in the category, pooled over the years in view.'),
      missingOne: tx('pages.dashboards.panels.entry_odds.missing_one', '1 medal in view has no published entry count and is left out.'),
      missingMany: tx('pages.dashboards.panels.entry_odds.missing_many', '{{count}} medals in view have no published entry count and are left out.'),
    } });
    if (!odds.list.length) return { empty: tx('pages.dashboards.panels.entry_odds.empty', 'No medal in view has a published entry count.') };
    const items = odds.list.slice(0, 20);
    return { option: barsHOption({ items, valueName: 'Entries per Medal', labelWidth: 240, saveName: 'entries-per-medal' }), height: Math.max(220, 30 * items.length + 60), onClick: (p) => setFilter('category_name', p.name), note: odds.note, table: tableHtml([{ key: 'label', label: 'Category' }, { key: 'value', label: 'Entries per Medal', numeric: true }, { key: 'entries', label: 'Entries', numeric: true }, { key: 'medals', label: 'Medals Awarded', numeric: true }, { key: 'years', label: 'Years' }], odds.list, { className: 'data-table' }) };
  } },
  'special-share': { title: tx('pages.dashboards.panels.special_share.title', 'Classic and Special Categories by Year'), build(rows) {
    const labels = yearsInView(state.meta, ctl.state);
    const classic = labels.map((y) => rows.filter((r) => r.year === y && !r.special).length);
    const special = labels.map((y) => rows.filter((r) => r.year === y && r.special).length);
    return { option: stackedColumnsOption({ labels, notes: labels.map((y) => (state.meta.coverage[y] === 'complete' ? '' : state.meta.coverage[y])), series: [{ name: 'Classic style categories', data: classic, color: 'var(--series-1)' }, { name: 'Special categories', data: special, color: 'var(--series-2)' }], saveName: 'classic-vs-special' }), height: 280, table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'classic', label: 'Classic', numeric: true }, { key: 'special', label: 'Special', numeric: true }], labels.map((y, i) => ({ year: y, classic: classic[i], special: special[i] })), { className: 'data-table' }) };
  } },
  'entries-vs-breweries': { title: tx('pages.dashboards.panels.entries_vs_breweries.title', 'Category Size and Medal Spread'), subtitle: tx('pages.dashboards.panels.entries_vs_breweries.subtitle', 'Entries judged against the number of breweries that medaled, across the years in view.'), build(rows) {
    const m = new Map();
    for (const r of rows) if (r.entries) { const cur = m.get(r.category_name) ?? { name: r.category_name, x: 0, b: new Set() }; cur.x = Math.max(cur.x, r.entries); cur.b.add(r.brewery_key); m.set(r.category_name, cur); }
    const points = [...m.values()].map((c) => ({ name: c.name, x: c.x, y: c.b.size, size: 8 + c.b.size * 2 }));
    return { option: scatterOption({ points, xName: 'Entries', yName: 'Breweries', saveName: 'entries-vs-breweries' }), height: 320, table: tableHtml([{ key: 'name', label: 'Category' }, { key: 'x', label: 'Entries', numeric: true }, { key: 'y', label: 'Breweries', numeric: true }], points, { className: 'data-table' }) };
  } },
  'brewery-trend': { title: tx('pages.dashboards.panels.brewery_trend.title', 'Medals by Year'), build(rows) {
    const b = currentBrewery();
    if (!b) return null;
    const years = new Set(yearsInView(state.meta, ctl.state));
    const trend = b.trend.filter((t) => years.has(t.year));
    const labels = trend.map((t) => t.year);
    const option = stackedColumnsOption({ labels, notes: trend.map((t) => statusShort(t.status)), series: [{ name: 'Gold', data: trend.map((t) => t.gold), color: MEDAL_COLORS.Gold }, { name: 'Silver', data: trend.map((t) => t.silver), color: MEDAL_COLORS.Silver }, { name: 'Bronze', data: trend.map((t) => t.bronze), color: MEDAL_COLORS.Bronze }], saveName: `${b.slug}-medals-by-year` });
    return { option, height: 280, subtitle: tx('pages.dashboards.panels.brewery_trend.subtitle', '{{brewery_name}}, Every Medal in the Record', { brewery_name: b.name }), table: tableHtml([{ key: 'year', label: 'Year' }, gsbColumn((t) => [t.gold, t.silver, t.bronze]), { key: 'status', label: 'Status', render: (t) => esc(statusLabel(t.status)) }], trend, { className: 'data-table' }) };
  } },
  'brewery-categories': { title: tx('pages.dashboards.panels.brewery_categories.title', 'Medals by Category'), build(rows) {
    const b = currentBrewery();
    if (!b) return null;
    const items = countBy(state.rows.filter((r) => r.brewery_key === b.key), 'category_name').map(([label, value]) => ({ label, value }));
    return { option: barsHOption({ items, labelWidth: 240, saveName: `${b.slug}-categories` }), height: Math.max(200, 34 * items.length + 60), subtitle: b.name, table: tableHtml([{ key: 'label', label: 'Category' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'brewery-locations': { title: tx('pages.dashboards.panels.brewery_locations.title', 'Medals by Location Credited'), build(rows) {
    const b = currentBrewery();
    if (!b) return null;
    const items = countBy(state.rows.filter((r) => r.brewery_key === b.key).map((r) => ({ loc: r.brewery_location || r.city })), 'loc').map(([label, value]) => ({ label, value }));
    return { option: barsHOption({ items, color: 'var(--series-2)', saveName: `${b.slug}-locations` }), height: Math.max(180, 36 * items.length + 60), subtitle: b.name, table: tableHtml([{ key: 'label', label: 'Location' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'ownership-share': { title: tx('pages.dashboards.panels.ownership_share.title', 'Medals by Ownership'), build(rows) {
    const items = countBy(rows, 'ownership_type').map(([v, value]) => ({ label: valueLabel('ownership_type', v), value, raw: v }));
    return { option: barsHOption({ items, labelWidth: 230, saveName: 'medals-by-ownership' }), height: Math.max(200, 36 * items.length + 60), onClick: (p) => { const it = items.find((i) => i.label === p.name); if (it) setFilter('ownership_type', it.raw); }, table: tableHtml([{ key: 'label', label: 'Ownership Type' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  parents: { title: tx('pages.dashboards.panels.parents.title', 'Medals by Parent Company'), subtitle: tx('pages.dashboards.panels.parents.subtitle', 'Owners That Are Not Independent'), build(rows) {
    const items = countBy(rows.filter((r) => r.parent), 'parent').map(([label, value]) => ({ label, value }));
    if (!items.length) return { empty: 'No medalist in view is owned by a large brewer or conglomerate.' };
    return { option: barsHOption({ items, color: 'var(--series-2)', labelWidth: 230, saveName: 'medals-by-parent' }), height: Math.max(200, 36 * items.length + 60), table: tableHtml([{ key: 'label', label: 'Parent' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'revenue-by-brewery': { title: tx('pages.dashboards.panels.revenue.title', 'Estimated Annual Revenue by Brewery (E)'), subtitle: 'breweries in view, estimate method in About', build(rows) {
    const keys = new Set(rows.map((r) => r.brewery_key));
    const items = state.breweries.filter((b) => keys.has(b.key)).sort((a, b) => b.estimate.revenue_usd - a.estimate.revenue_usd).slice(0, 15).map((b) => ({ label: b.name, value: b.estimate.revenue_usd, href: bHref(b.slug), basis: b.estimate.basis }));
    return { option: barsHOption({ items, color: 'var(--series-5)', valueName: 'Revenue USD', labelWidth: 220, saveName: 'estimated-revenue' }), height: Math.max(220, 36 * items.length + 60), table: tableHtml([{ key: 'label', label: 'Brewery' }, { key: 'value', label: 'Revenue USD', numeric: true, render: (r) => compact(r.value) }, { key: 'basis', label: 'Volume Source', render: (r) => esc(valueLabel('basis', r.basis)) }], items, { className: 'data-table' }) };
  } },
  'entries-trend': { title: tx('pages.dashboards.panels.entries_trend.title', 'Entries Judged by Year'), subtitle: tx('pages.dashboards.panels.entries_trend.subtitle', 'Brewers Association totals. A year with no published figure is blank.'), build() {
    const s = state.meta.summary.filter((x) => x.competition === 'GABF').sort((a, b) => Number(a.year) - Number(b.year));
    const labels = s.map((x) => x.year);
    return { option: lineOption({ labels, series: [{ name: 'Entries', data: s.map((x) => (x.entries ? Number(x.entries) : null)), color: SERIES_COLORS[0] }], saveName: 'entries-judged' }), height: 280, table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'entries', label: 'Entries', numeric: true }, { key: 'entering_breweries', label: 'Breweries Entering', numeric: true }], s, { className: 'data-table' }) };
  } },
  'medals-trend': { title: tx('pages.dashboards.panels.medals_trend.title', 'Medals Awarded and Winning Breweries'), subtitle: tx('pages.dashboards.panels.medals_trend.subtitle', 'Brewers Association totals. A year with no published figure is blank.'), build() {
    const s = state.meta.summary.filter((x) => x.competition === 'GABF').sort((a, b) => Number(a.year) - Number(b.year));
    const labels = s.map((x) => x.year);
    return { option: lineOption({ labels, series: [{ name: 'Medals', data: s.map((x) => (x.medals ? Number(x.medals) : null)), color: SERIES_COLORS[1] }, { name: tx('global.charts.legend.winning_breweries', 'Winning Breweries'), data: s.map((x) => (x.winning_breweries ? Number(x.winning_breweries) : null)), color: SERIES_COLORS[2] }], saveName: 'medals-and-winners' }), height: 280, table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'winning_breweries', label: 'Winning Breweries', numeric: true }], s, { className: 'data-table' }) };
  } },
};

function stateRateItems(rows, field) {
  const rates = medalRates(rows, (r) => r.state, state.meta.indicators?.state);
  return [...rates.values()].map((x) => ({ code: x.key, label: state.meta.states.find((s) => s.state === x.key)?.name ?? x.key, medals: x.medals, value: Number(x[field].toFixed(2)) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 20);
}

function districtItems(rows) {
  const rates = medalRates(rows, (r) => r.fed_district, state.meta.indicators?.district);
  const names = new Map(rows.filter((r) => r.fed_district).map((r) => [String(r.fed_district), r.fed_district_name]));
  return [...rates.values()].map((x) => ({ ...x, name: names.get(x.key), label: `${x.key} ${names.get(x.key)}` })).sort((a, b) => Number(a.key) - Number(b.key));
}

// Side by side table: medals, medals per million, medals per $100B real GDP, and the controls,
// for states or districts in view. Controls are cross sections (ACS 2024, Census 2020 urban,
// PIAAC modeled literacy, NCHS 2022 life expectancy); districts carry GDP per capita only.
function renderControlsTable(rows) {
  const el = qs('controls-table');
  if (!el) return;
  const level = state.controlsLevel || 'state';
  const ind = state.meta.indicators ?? { state: {}, district: {} };
  let list;
  if (level === 'district') {
    list = districtItems(rows).map((d) => ({ name: d.label, medals: d.medals, per_million: d.per_million, per_gdp: d.per_100b_gdp, series: ind.district[d.key] ?? {} }));
  } else {
    const rates = medalRates(rows, (r) => r.state, ind.state);
    list = [...rates.values()].map((x) => ({ name: state.meta.states.find((s) => s.state === x.key)?.name ?? x.key, code: x.key, medals: x.medals, per_million: x.per_million, per_gdp: x.per_100b_gdp, series: ind.state[x.key] ?? {} }));
  }
  list.sort((a, b) => b.per_million - a.per_million);
  const fields = level === 'district' ? CONTROL_FIELDS.filter((f) => f.key === 'gdp_per_capita_real') : CONTROL_FIELDS;
  const cols = [
    { key: 'name', label: level === 'district' ? 'District' : 'State' },
    { key: 'medals', label: 'Medals', numeric: true },
    { key: 'per_million', label: 'Per Million', numeric: true, render: (x) => x.per_million.toFixed(2) },
    { key: 'per_gdp', label: `Per $100B real GDP${level === 'district' ? ' (E)' : ''}`, numeric: true, render: (x) => x.per_gdp.toFixed(2) },
    ...fields.map((f) => ({ key: f.key, label: f.key === 'gdp_per_capita_real' ? 'Real GDP per capita 2025 (chained 2017 USD)' : f.label, numeric: true, render: (x) => { const v = latestValue(x.series[f.key]); return v === null ? '' : v.toLocaleString('en-US', { maximumFractionDigits: f.digits, minimumFractionDigits: f.digits }); } })),
  ];
  el.innerHTML = `<label class="small">Rows<select id="controls-level"><option value="district"${level === 'district' ? ' selected' : ''}>Federal Reserve districts</option><option value="state"${level === 'state' ? ' selected' : ''}>States</option></select></label><div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml(cols, list)}</div><p class="small muted">Rates sum each medal against its own year's population and real GDP. Controls: ACS 2024 1-year (age, race and Hispanic origin, education, income, poverty), 2020 Census urban share, NCES PIAAC modeled literacy (pooled 2012, 2014, 2017), NCHS life expectancy 2022. District demographics are not compiled; district GDP for split states is apportioned (E), and West Virginia is assigned whole to the Richmond district (approximation). Sources and method are on the About page.</p>`;
  qs('controls-level').addEventListener('change', (e) => { state.controlsLevel = e.target.value; renderControlsTable(applyFilters(state.rows)); });
  wireSortable(el);
}

function currentBrewery() {
  const key = state.filters.brewery || state.defaultBrewery;
  return state.breweries.find((b) => b.key === key) ?? null;
}

function renderPanel(el, rows) {
  const def = PANELS[el.dataset.panel];
  if (!def) return;
  const built = def.build(rows);
  window.GABFCharts.dispose(el.querySelector('figure') || el);
  if (!built) { el.innerHTML = ''; return; }
  if (built.empty) { el.innerHTML = `<div class="card"><h3>${esc(def.title)}</h3><p class="muted">${esc(built.empty)}</p></div>`; return; }
  el.innerHTML = figure({ id: el.dataset.panel, title: def.title, subtitle: built.subtitle ?? def.subtitle ?? '', option: built.option, height: built.height ?? 300, table: built.table ?? '', note: built.note ?? '' });
  const fig = el.querySelector('figure');
  if (built.onClick) fig.__onClick = built.onClick;
  window.GABFCharts.initAll(el);
}

function renderStats(rows) {
  const el = qs('stats');
  if (!el) return;
  const breweries = new Set(rows.map((r) => r.brewery_key)).size;
  const states = new Set(rows.map((r) => r.state)).size;
  const cats = new Set(rows.map((r) => r.category_name)).size;
  const special = rows.filter((r) => r.special).length;
  const entries = [...new Map(rows.filter((r) => r.entries).map((r) => [`${r.year}|${r.category_name}`, r.entries])).values()].reduce((s, n) => s + n, 0);
  el.innerHTML = [
    statTile({ label: tx('pages.dashboards.stats.medals', 'Medals in View'), value: rows.length.toLocaleString() }),
    statTile({ label: tx('pages.dashboards.stats.breweries', 'Breweries'), value: breweries.toLocaleString() }),
    statTile({ label: tx('pages.dashboards.stats.states', 'States'), value: states.toLocaleString() }),
    statTile({ label: tx('pages.dashboards.stats.categories', 'Categories in View'), value: cats.toLocaleString(), note: tx('pages.dashboards.stats.categories_note', '{{count}} medals in special categories', { count: special }) }),
    statTile({ label: tx('pages.dashboards.stats.medal_split', 'Gold, Silver, Bronze'), medals: ['Gold', 'Silver', 'Bronze'].map((m) => rows.filter((r) => r.medal === m).length) }),
    statTile({ label: tx('pages.dashboards.stats.entrants', 'Entrants in These Categories'), value: entries ? entries.toLocaleString() : 'n/a', note: tx('pages.dashboards.stats.entrants_note', 'Sum of category entry counts') }),
  ].join('');
}

function renderTable(rows) {
  const el = qs('table');
  if (!el) return;
  const limit = Math.min(rows.length, state.tableLimit ?? 25);
  const rank = { Gold: 1, Silver: 2, Bronze: 3 };
  rows = [...rows].sort((a, b) => b.year - a.year || String(a.category_name).localeCompare(String(b.category_name)) || (rank[a.medal] ?? 9) - (rank[b.medal] ?? 9));
  const medalDot = (m) => `<span class="badge-medal ${String(m).toLowerCase()}"></span>${esc(m)}`;
  el.innerHTML = `<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([
    { key: 'year', label: tx('global.tables.medal_columns.year', 'Year'), numeric: true },
    { key: 'medal', label: tx('global.tables.medal_columns.medal', 'Medal'), render: (r) => medalDot(r.medal) },
    { key: 'beer_name', label: tx('global.tables.medal_columns.beer', 'Beer'), render: (r) => (r.beer_profile && !STANDALONE ? `<a href="${esc(base + r.beer_profile)}">${esc(r.beer_name)}</a>` : esc(r.beer_name)) },
    { key: 'brewery_name', label: tx('global.tables.medal_columns.brewery', 'Brewery'), render: (r) => `<a href="${esc(bHref(r.brewery_slug))}">${esc(r.brewery_name)}</a>${r.brewery_location ? ` <span class="muted small">(${esc(r.brewery_location)})</span>` : ''}` },
    { key: 'city', label: tx('global.tables.medal_columns.city', 'City'), render: (r) => `${esc(r.city)}, ${esc(r.state)}` },
    { key: 'category_name', label: tx('global.tables.medal_columns.category', 'Category'), render: (r) => `<a href="${esc(cHref(r.category_name, r.category_slug))}">${esc(r.category_name)}</a>${r.special ? ' <span class="pill">special</span>' : ''}` },
    { key: 'entries', label: tx('global.tables.medal_columns.entrants', 'Entrants'), numeric: true, render: (r) => (r.entries ?? '') },
    { key: 'style_family', label: tx('global.tables.medal_columns.style_family', 'Style Family') },
    { key: 'abv', label: tx('global.tables.medal_columns.abv', 'ABV'), numeric: true, render: (r) => (r.abv !== null && r.abv !== undefined ? `${r.abv}%${specNote(r, r.abv_source)}` : NOT_FOUND_HTML) },
    { key: 'ibu', label: 'IBU', numeric: true, render: (r) => (r.ibu !== null && r.ibu !== undefined ? `${esc(r.ibu)}${specNote(r, r.ibu_source)}` : NOT_FOUND_HTML) },
    { key: 'abv_min', label: tx('global.tables.medal_columns.abv_style', 'ABV (Style Range)'), render: (r) => (r.abv_min ? `${r.abv_min} to ${r.abv_max}%` : NOT_FOUND_HTML) },
    { key: 'beer_profile', label: 'Beer Profile', render: (r) => (r.beer_profile && !STANDALONE ? `<a href="${esc(base + r.beer_profile)}">Full Profile</a>` : NOT_FOUND_HTML) },
    { key: 'ownership_type', label: tx('global.tables.medal_columns.ownership', 'Ownership'), render: (r) => `${esc(valueLabel('ownership_type', r.ownership_type))}${r.parent ? ` (${esc(r.parent)})` : ''}` },
    { key: 'distribution_channel', label: tx('global.tables.medal_columns.distribution', 'Distribution'), render: (r) => esc(valueLabel('distribution_channel', r.distribution_channel)) },
  ], rows.slice(0, limit))}</div><div class="table-more"><p class="small muted">${esc(tx('global.tables.pager.showing', 'Showing {{shown}} of {{total}} medals, newest first.', { shown: limit.toLocaleString(), total: rows.length.toLocaleString() }))}</p>${rows.length > limit ? `<button class="btn" type="button" id="show-more">${esc(tx('global.tables.pager.show_more', 'Show {{count}} More', { count: Math.min(100, rows.length - limit) }))}</button><button class="btn" type="button" id="show-all">${esc(tx('global.tables.pager.show_all', 'Show All'))}</button>` : ''}</div>`;
  const more = qs('show-more');
  if (more) more.addEventListener('click', () => { state.tableLimit = limit + 100; renderTable(state.lastRows); });
  const all = qs('show-all');
  if (all) all.addEventListener('click', () => { state.tableLimit = Infinity; renderTable(state.lastRows); });
  wireSortable(el);
}

// Sorting is delegated in page.js for every table.sortable, including ones drawn later.
function wireSortable() {}

// The breweries that still have medals under the global selection, in the site sort order, each
// with its medal count under that selection.
function breweryChoices() {
  const counts = new Map();
  for (const r of applyGlobal(state.rows, ctl.state)) counts.set(r.brewery_key, (counts.get(r.brewery_key) ?? 0) + 1);
  return sortByLabel(state.breweries.filter((x) => counts.has(x.key)), (x) => x.name).map((x) => ({ ...x, shown: counts.get(x.key) }));
}

// When the picked brewery has no medals under the current filters, move to the first one that does.
function settleBrewery() {
  if (!qs('brewery-picker') || (STANDALONE && state.filters.tab !== 'breweries')) return;
  const choices = breweryChoices();
  const key = state.filters.brewery || state.defaultBrewery;
  if (choices.length && !choices.some((x) => x.key === key)) state.filters.brewery = choices[0].key;
}

function renderBreweryPicker() {
  const el = qs('brewery-picker');
  if (!el) return;
  const b = currentBrewery();
  const sorted = breweryChoices();
  const option = (x) => esc(tx('pages.dashboards.breweries.picker_option', '{{brewery_name}} ({{count}})', { brewery_name: x.name, count: x.shown.toLocaleString('en-US') }));
  const founded = b?.founded ? ` · ${esc(tx('pages.dashboards.breweries.picker_meta_founded', 'founded {{year}}', { year: b.founded }))}` : '';
  const profileLink = b && !STANDALONE ? ` · <a href="${base}breweries/${esc(b.slug)}/">${esc(tx('pages.dashboards.breweries.picker_profile_link', 'Open Profile'))}</a>` : '';
  el.innerHTML = `<label>${esc(tx('pages.dashboards.breweries.picker_label', 'Brewery'))}<select id="f-brewery"${sorted.length ? '' : ' disabled'}>${sorted.length ? sorted.map((x) => `<option value="${esc(x.key)}"${b && x.key === b.key ? ' selected' : ''}>${option(x)}</option>`).join('') : '<option>No brewery matches</option>'}</select></label>${b ? `<p class="small">${esc(b.hq.city)}, ${esc(b.hq.state)} · ${esc(valueLabel('brewery_type', b.brewery_type))}${founded}${b.ownership ? ` · ${esc(valueLabel('ownership_type', b.ownership.type))}` : ''}${profileLink}</p>` : ''}`;
  if (sorted.length) qs('f-brewery').addEventListener('change', (e) => { state.filters.brewery = e.target.value; render(); });
}

function renderFinancialTable(rows) {
  const el = qs('financial-table');
  if (!el) return;
  const keys = new Set(rows.map((r) => r.brewery_key));
  const list = state.breweries.filter((b) => keys.has(b.key)).sort((a, b) => b.financials.arr_usd - a.financials.arr_usd);
  el.innerHTML = `<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([
    { key: 'name', label: 'Brewery', render: (b) => `<a href="${esc(bHref(b.slug))}">${esc(b.name)}</a>` },
    { key: 'type', label: 'Type', render: (b) => esc(valueLabel('brewery_type', b.brewery_type)) },
    { key: 'barrels', label: tx('pages.dashboards.economics.columns.barrels', 'Barrels (E)'), numeric: true, cellClass: 'est-cell', sortValue: (b) => b.estimate.barrels, render: (b) => `${compact(b.estimate.barrels)}${b.estimate.basis === 'reported' ? '' : ` ${estMark(b.key, 'barrels')}`}` },
    { key: 'arr', label: 'ARR USD (E)', numeric: true, cellClass: 'est-cell', sortValue: (b) => b.financials.arr_usd, render: (b) => `${compact(b.financials.arr_usd)} ${estMark(b.key, 'arr')}` },
    { key: 'gm', label: 'Gross Margin (E)', numeric: true, cellClass: 'est-cell', sortValue: (b) => b.financials.gross_margin, render: (b) => `${Math.round(b.financials.gross_margin * 100)}% ${estMark(b.key, 'gross_margin')}` },
    { key: 'ebitda', label: 'EBITDA USD (E)', numeric: true, cellClass: 'est-cell', sortValue: (b) => b.financials.ebitda_usd, render: (b) => `${compact(b.financials.ebitda_usd)} (${Math.round(b.financials.ebitda_margin_low * 100)} to ${Math.round(b.financials.ebitda_margin_high * 100)}%) ${estMark(b.key, 'ebitda')}` },
    { key: 'channel', label: 'Distribution', render: (b) => esc(valueLabel('distribution_channel', b.distribution_channel || 'unknown')) },
    { key: 'ownership', label: 'Ownership', render: (b) => (b.ownership ? `${esc(valueLabel('ownership_type', b.ownership.type))}${b.ownership.parent ? ` (${esc(b.ownership.parent)})` : ''}` : `<span class="muted">${esc(valueLabel('ownership_type', 'unlisted'))}</span>`) },
    { key: 'basis', label: 'Volume Source', render: (b) => esc(valueLabel('basis', b.estimate.basis)) },
  ], list)}</div>`;
  wireSortable(el);
}

const TAB_NAMES = () => Array.from(document.querySelectorAll('[data-tab]')).map((el) => el.dataset.tab);
function tabScope() { return document.querySelector('[data-tab].active') || document; }
function applyTab() {
  const names = TAB_NAMES();
  if (!names.length) return;
  if (!names.includes(state.filters.tab)) state.filters.tab = names[0];
  document.querySelectorAll('[data-tab]').forEach((el) => el.classList.toggle('active', el.dataset.tab === state.filters.tab));
  document.querySelectorAll('[data-tab-link]').forEach((a) => a.classList.toggle('active', a.dataset.tabLink === state.filters.tab));
  document.body.dataset.activeTab = state.filters.tab;
}

function renderBreweryDetail() {
  const el = qs('brewery-detail');
  if (!el || !STANDALONE) return;
  const b = currentBrewery();
  const html = b ? window.GABF_DATA.brewery_html[b.key] : null;
  el.innerHTML = html ? html : '<p class="muted">Pick a brewery above.</p>';
  wireSortable(el);
}

// Nothing matches: one message naming the active filters, with a button to remove each, in place
// of the panels and the table.
function renderEmpty(rows) {
  let box = qs('dash-empty');
  const grids = [...tabScope().querySelectorAll('.dash-grid')];
  if (!box && grids[0]) { box = document.createElement('div'); box.id = 'dash-empty'; }
  if (box && grids[0]) grids[0].before(box);
  const empty = rows.length === 0;
  if (box) box.innerHTML = empty ? emptyStateHtml(ctl.state, state.rows, state.meta) : '';
  grids.forEach((g) => { g.hidden = empty; });
  ['table', 'financial-table', 'controls-table'].forEach((id) => { const el = qs(id); if (el) el.hidden = empty; });
  return empty;
}

function render() {
  applyTab();
  settleBrewery();
  const rows = applyFilters(state.rows);
  state.lastRows = rows;
  writeHash();
  const notice = qs('partial-notice');
  if (notice) notice.innerHTML = partialNoticeHtml(rows, state.meta);
  const live = qs('filter-live');
  if (live) live.textContent = `${rows.length.toLocaleString('en-US')} medal${rows.length === 1 ? '' : 's'} in view`;
  renderStats(rows);
  renderBreweryPicker();
  if (renderEmpty(rows)) return;
  tabScope().querySelectorAll('[data-panel]').forEach((el) => renderPanel(el, rows));
  renderBreweryDetail();
  renderTable(rows);
  renderFinancialTable(rows);
  renderControlsTable(rows);
}

// Inside a Claude artifact, page-initiated downloads are inert; the host offers a save prompt
// through the "downloads" capability instead. Anywhere else the capability is absent (null).
async function hostedDownloads() {
  try { return window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null; } catch (e) { return null; }
}

async function downloadCsv() {
  const rows = applyFilters(state.rows);
  const cols = ['year', 'competition', 'category_number', 'category_name', 'category_type', 'entries', 'medal', 'beer_name', 'brewery_name', 'brewery_location', 'city', 'state', 'region', 'fed_district', 'fed_district_name', 'fed_district_method', 'style_family', 'abv_min', 'abv_max', 'abv', 'ibu', 'abv_source', 'spec_note', 'brewery_type', 'ownership_type', 'parent', 'distribution_channel'];
  const escCsv = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const text = [cols.join(','), ...rows.map((r) => cols.map((c) => escCsv(r[c])).join(','))].join('\n');
  const filename = 'gabf-results-filtered.csv';
  const hosted = await hostedDownloads();
  if (hosted) {
    try { await hosted.save({ filename, data: text }); } catch (e) { if (!e || e.code !== 'declined') console.warn('CSV save failed', e); }
    return;
  }
  const blob = new Blob([text], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function init() {
  // The multi-page site mounts the global filter in app.mjs (loaded first); the single file has no
  // app.mjs, so it mounts its own, without browser storage (the hash carries the view).
  ctl = window.GABF_FILTER ?? createGlobalFilter({ trigger: document.querySelector('.filter-trigger'), chipsEl: qs('filter-chips'), storage: null });
  let results;
  let meta;
  let breweries;
  if (STANDALONE) [results, meta, breweries] = [window.GABF_DATA.results, window.GABF_DATA.meta, window.GABF_DATA.breweries];
  else {
    const load = window.GABF_LOAD ?? (() => Promise.all([fetch(`${base}data/results.json`).then((r) => r.json()), fetch(`${base}data/meta.json`).then((r) => r.json())]).then(([rows, m]) => ({ rows, meta: m })));
    const [d, b] = await Promise.all([load(), fetch(`${base}data/breweries.json`).then((r) => { if (!r.ok) throw new Error(`breweries ${r.status}`); return r.json(); })]);
    [results, meta, breweries] = [d.rows, d.meta, b];
  }
  state.meta = meta;
  state.breweries = breweries;
  state.rows = decorateRows(results, meta);
  // The single file has no app.mjs: it explains its (E) marks from the embedded brewery data.
  if (STANDALONE) {
    const byKey = new Map(breweries.map((b) => [b.key, b.explain]));
    installEstimates({ lookup: async (key) => byKey.get(key) ?? null, aboutHref: '#tab=about' });
  }
  ctl.setData({ rows: state.rows, meta });
  state.filters = pageKeys(parseHash(location.hash));
  state.defaultBrewery = document.querySelector('[data-default-brewery]')?.dataset.defaultBrewery || breweries[0]?.key;
  document.body.classList.remove('is-loading');
  ctl.subscribe(() => { state.tableLimit = 25; render(); });
  render();
  const download = qs('download');
  if (download) download.addEventListener('click', downloadCsv);
  document.querySelectorAll('[data-tab-link]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    state.filters.tab = a.dataset.tabLink;
    render();
    window.scrollTo(0, 0);
  }));
  window.addEventListener('hashchange', () => { state.filters = pageKeys(parseHash(location.hash)); render(); });
  if (STANDALONE) {
    // In-page links (brewery names, categories, coverage pills) are hash routes. Handling the click
    // here keeps them working where the address bar is not ours to change, such as a sandboxed frame.
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.hasAttribute('data-tab-link') || e.defaultPrevented) return;
      e.preventDefault();
      const next = parseHash(a.getAttribute('href'));
      state.filters = pageKeys(next);
      if (Object.keys(pickState(next)).length) ctl.replace({ ...ctl.state, ...pickState(next) });
      else render();
      window.scrollTo(0, 0);
    });
  }
}

init().catch(() => {
  document.body.classList.remove('is-loading');
  const el = qs('stats') || document.querySelector('main');
  el.innerHTML = '<div class="notice" role="alert">The medal data could not be loaded, so the dashboard cannot draw. Check the connection and reload the page.</div>';
});
