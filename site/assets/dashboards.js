// Interactive dashboards: one filter row scopes every panel on the page; panels are
// Apache ECharts figures (with table views) plus stat tiles and result tables. Which
// panels appear is set by the page's data-dashboard attribute. Clicking a state on the
// map, a year column, a category bar, or a brewery bar narrows or navigates.
import { compact, countBy, esc, figure, statTile, tableHtml } from './charts.mjs';
import { barsHOption, lineOption, mapOption, MEDAL_COLORS, scatterOption, SERIES_COLORS, stackedColumnsOption } from './chart-options.mjs';
import { CONTROL_FIELDS, latestValue, medalRates } from './rates.mjs';

const state = { rows: [], meta: null, breweries: [], categories: [], filters: {}, showAll: false };
const base = window.GABF_BASE || './';
// Standalone mode: the single-file build embeds its data (window.GABF_DATA), so there is no
// server, no page navigation, and links become in-page hash routes.
const STANDALONE = typeof window.GABF_DATA === 'object' && window.GABF_DATA !== null;
const bHref = (slug) => {
  if (!STANDALONE) return `${base}breweries/${slug}/`;
  const b = state.breweries.find((x) => x.slug === slug);
  return `#tab=breweries&brewery=${encodeURIComponent(b ? b.key : slug)}`;
};
const cHref = (name, slug) => (STANDALONE ? `#tab=categories&category_name=${encodeURIComponent(name)}` : `${base}categories/${slug}/`);
const FILTERS = [
  { id: 'year', label: 'Year', key: 'year' },
  { id: 'medal', label: 'Medal', key: 'medal' },
  { id: 'category_type', label: 'Category type', key: 'category_type' },
  { id: 'style_family', label: 'Style family', key: 'style_family' },
  { id: 'category_name', label: 'Category', key: 'category_name' },
  { id: 'region', label: 'Region', key: 'region' },
  { id: 'state', label: 'State', key: 'state' },
  { id: 'fed_district_name', label: 'Fed district', key: 'fed_district_name' },
  { id: 'brewery_type', label: 'Brewery type', key: 'brewery_type' },
  { id: 'ownership_type', label: 'Ownership', key: 'ownership_type' },
  { id: 'distribution_channel', label: 'Distribution', key: 'distribution_channel' },
  { id: 'abv_band', label: 'ABV band', key: 'abv_band' },
];

const qs = (id) => document.getElementById(id);

function hashFor(filters) {
  const parts = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `#${parts.join('&')}` : '';
}
function parseHash(hash) {
  const out = {};
  for (const part of String(hash).replace(/^#/, '').split('&')) {
    const [k, v] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return out;
}
const readHash = () => parseHash(location.hash);
function writeHash() {
  try { history.replaceState(null, '', location.href.split('#')[0] + hashFor(state.filters)); } catch (e) { /* file:// may refuse; the view still works */ }
}

function applyFilters(rows) {
  const f = state.filters;
  const q = (f.q ?? '').trim().toLowerCase();
  return rows.filter((r) => {
    for (const def of FILTERS) {
      const v = f[def.id];
      if (v && String(r[def.key] ?? '') !== v) return false;
    }
    if (f.brewery && (!STANDALONE || f.tab === 'breweries') && r.brewery_key !== f.brewery) return false;
    if (q) {
      const hay = `${r.beer_name} ${r.brewery_name} ${r.brewery_location} ${r.city} ${r.state_name} ${r.category_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function options(rows, key, labelFor = (v) => v) {
  const counts = new Map();
  for (const r of rows) {
    const v = String(r[key] ?? '');
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => (key === 'year' ? Number(b[0]) - Number(a[0]) : String(labelFor(a[0])).localeCompare(String(labelFor(b[0])))));
}

function buildFilterRow() {
  const wrap = qs('filters');
  if (!wrap) return;
  const stateName = (code) => state.meta.states.find((s) => s.state === code)?.name ?? code;
  const bandLabel = (id) => state.meta.abv_bands.find((b) => b.id === id)?.label ?? id;
  let html = '';
  for (const def of FILTERS) {
    const labelFor = def.id === 'state' ? stateName : def.id === 'abv_band' ? bandLabel : (v) => v;
    const pool = def.id === 'category_name' && state.filters.style_family ? state.rows.filter((r) => r.style_family === state.filters.style_family) : state.rows;
    const opts = options(pool, def.key, labelFor);
    html += `<label>${esc(def.label)}<select id="f-${def.id}"><option value="">All</option>${opts.map(([v, n]) => `<option value="${esc(v)}"${state.filters[def.id] === v ? ' selected' : ''}>${esc(labelFor(v))} (${n})</option>`).join('')}</select></label>`;
  }
  html += `<label>Search<input id="f-q" type="search" placeholder="beer, brewery, city" value="${esc(state.filters.q ?? '')}"></label>`;
  html += `<div class="actions"><button class="btn" id="reset" type="button">Reset</button><button class="btn" id="download" type="button">Download CSV</button></div>`;
  wrap.innerHTML = html;
  for (const def of FILTERS) qs(`f-${def.id}`).addEventListener('change', (e) => { state.filters[def.id] = e.target.value; if (def.id === 'style_family') { state.filters.category_name = ''; buildFilterRow(); } render(); });
  qs('f-q').addEventListener('input', (e) => { state.filters.q = e.target.value; render(); });
  qs('reset').addEventListener('click', () => { state.filters = {}; buildFilterRow(); render(); });
  qs('download').addEventListener('click', downloadCsv);
}

function setFilter(id, value) {
  state.filters[id] = state.filters[id] === value ? '' : value;
  buildFilterRow();
  render();
}

// ---------- panel builders: each returns { option, table, height, onClick, note } ----------
function yearRows(rows) {
  return state.meta.years.map((y) => {
    const yr = rows.filter((r) => r.year === y);
    const cov = state.meta.coverage[y];
    return { year: y, gold: yr.filter((r) => r.medal === 'Gold').length, silver: yr.filter((r) => r.medal === 'Silver').length, bronze: yr.filter((r) => r.medal === 'Bronze').length, total: yr.length, note: cov === 'complete' ? '' : cov };
  });
}

const PANELS = {
  'medals-by-year': { title: 'Medals by year', subtitle: 'stacked by medal; click a column to focus that year', build(rows) {
    const yr = yearRows(rows);
    const option = stackedColumnsOption({ labels: yr.map((r) => r.year), notes: yr.map((r) => r.note), series: [{ name: 'Gold', data: yr.map((r) => r.gold), color: MEDAL_COLORS.Gold }, { name: 'Silver', data: yr.map((r) => r.silver), color: MEDAL_COLORS.Silver }, { name: 'Bronze', data: yr.map((r) => r.bronze), color: MEDAL_COLORS.Bronze }], saveName: 'medals-by-year' });
    return { option, height: 280, onClick: (p) => setFilter('year', String(yr[p.dataIndex].year)), table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'gold', label: 'Gold', numeric: true }, { key: 'silver', label: 'Silver', numeric: true }, { key: 'bronze', label: 'Bronze', numeric: true }, { key: 'note', label: 'Coverage' }], yr, { className: 'data-table' }) };
  } },
  map: { title: 'Medals by state', subtitle: 'click a state to focus it', build(rows) {
    const counts = countBy(rows, 'state_name');
    const data = state.meta.states.map((s) => ({ name: s.name, value: counts.find(([n]) => n === s.name)?.[1] ?? 0 }));
    const option = mapOption({ data, saveName: 'medals-by-state' });
    return { option, height: 420, onClick: (p) => { const code = state.meta.states.find((s) => s.name === p.name)?.state; if (code) setFilter('state', code); }, table: tableHtml([{ key: 'name', label: 'State' }, { key: 'value', label: 'Medals', numeric: true }], data.filter((d) => d.value).sort((a, b) => b.value - a.value), { className: 'data-table' }) };
  } },
  'by-family': { title: 'Medals by style family', subtitle: 'click to focus a family', build(rows) {
    const items = countBy(rows, 'style_family').map(([label, value]) => ({ label, value }));
    return { option: barsHOption({ items, color: 'var(--series-3)', saveName: 'medals-by-style-family' }), height: Math.max(220, 36 * items.length + 60), onClick: (p) => setFilter('style_family', p.name), table: tableHtml([{ key: 'label', label: 'Style family' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'top-breweries': { title: 'Top breweries', subtitle: 'ranked by points (gold 3, silver 2, bronze 1); click to open the brewery', build(rows) {
    const m = new Map();
    for (const r of rows) {
      const cur = m.get(r.brewery_key) ?? { label: r.brewery_name, value: 0, pts: 0, slug: r.brewery_slug };
      cur.value += 1; cur.pts += r.points; m.set(r.brewery_key, cur);
    }
    const items = [...m.values()].sort((a, b) => b.pts - a.pts || b.value - a.value).slice(0, 15).map((b) => ({ label: b.label, value: b.pts, href: bHref(b.slug), medals: b.value }));
    return { option: barsHOption({ items, color: 'var(--series-2)', valueName: 'Points', saveName: 'top-breweries' }), height: Math.max(220, 36 * items.length + 60), table: tableHtml([{ key: 'label', label: 'Brewery' }, { key: 'value', label: 'Points', numeric: true }, { key: 'medals', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'by-region': { title: 'Medals by Census region', build(rows) {
    const items = countBy(rows, 'region').map(([label, value]) => ({ label, value }));
    return { option: barsHOption({ items, saveName: 'medals-by-region' }), height: 220, onClick: (p) => setFilter('region', p.name), table: tableHtml([{ key: 'label', label: 'Region' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'by-division': { title: 'Medals by Census division', build(rows) {
    const items = countBy(rows, 'division').map(([label, value]) => ({ label, value }));
    return { option: barsHOption({ items, color: 'var(--series-3)', saveName: 'medals-by-division' }), height: Math.max(220, 36 * items.length + 60), table: tableHtml([{ key: 'label', label: 'Division' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'per-capita': { title: 'Medals per million residents by state', subtitle: "each medal against its year's Census population estimate; 2026 uses 2025", build(rows) {
    const items = stateRateItems(rows, 'per_million');
    return { option: barsHOption({ items, color: 'var(--series-3)', valueName: 'Per million', saveName: 'medals-per-million' }), height: Math.max(220, 36 * items.length + 60), onClick: (p) => { const it = items.find((i) => i.label === p.name); if (it) setFilter('state', it.code); }, table: tableHtml([{ key: 'label', label: 'State' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'value', label: 'Per million', numeric: true }], items, { className: 'data-table' }) };
  } },
  'per-gdp': { title: 'Medals per $100 billion of real GDP by state', subtitle: "BEA real GDP (chained 2017 dollars) in each medal's year; 2026 uses 2025", build(rows) {
    const items = stateRateItems(rows, 'per_100b_gdp');
    return { option: barsHOption({ items, color: 'var(--series-2)', valueName: 'Per $100B', saveName: 'medals-per-gdp' }), height: Math.max(220, 36 * items.length + 60), onClick: (p) => { const it = items.find((i) => i.label === p.name); if (it) setFilter('state', it.code); }, table: tableHtml([{ key: 'label', label: 'State' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'value', label: 'Per $100B real GDP', numeric: true }], items, { className: 'data-table' }) };
  } },
  'by-fed-district': { title: 'Medals by Federal Reserve district', subtitle: 'split states assigned by the medal city county; click to focus a district', build(rows) {
    const items = districtItems(rows).map((d) => ({ label: d.label, value: d.medals, name: d.name }));
    const approx = rows.filter((r) => /approximation/.test(r.fed_district_method)).length;
    return { option: barsHOption({ items, color: 'var(--series-1)', saveName: 'medals-by-fed-district' }), height: Math.max(220, 34 * items.length + 60), onClick: (p) => { const it = items.find((i) => i.label === p.name); if (it) setFilter('fed_district_name', it.name); }, note: approx ? `${approx} medal${approx === 1 ? '' : 's'} in view sit in West Virginia, which is assigned whole to the Richmond district as an approximation (no primary county list).` : '', table: tableHtml([{ key: 'label', label: 'District' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'district-rates': { title: 'Medals per million residents by Fed district', subtitle: 'district population from whole states plus split state counties, per medal year', build(rows) {
    const list = districtItems(rows);
    const items = list.map((d) => ({ label: d.label, value: Number(d.per_million.toFixed(2)), name: d.name, medals: d.medals, per_gdp: d.per_100b_gdp.toFixed(2) })).sort((a, b) => b.value - a.value);
    return { option: barsHOption({ items, color: 'var(--series-3)', valueName: 'Per million', saveName: 'fed-district-per-million' }), height: Math.max(220, 34 * items.length + 60), onClick: (p) => { const it = items.find((i) => i.label === p.name); if (it) setFilter('fed_district_name', it.name); }, note: 'Per $100B real GDP is in the table view; split state GDP is apportioned by county GDP shares (E).', table: tableHtml([{ key: 'label', label: 'District' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'value', label: 'Per million', numeric: true }, { key: 'per_gdp', label: 'Per $100B real GDP (E)', numeric: true }], items, { className: 'data-table' }) };
  } },
  entrants: { title: 'Entrants by category', subtitle: 'entries judged, most competitive first; special categories marked; click to focus', build(rows) {
    const m = new Map();
    for (const r of rows) if (r.entries) { const cur = m.get(r.category_name) ?? { label: r.category_name, value: 0, special: r.special, years: new Set() }; cur.value = Math.max(cur.value, r.entries); cur.years.add(r.year); m.set(r.category_name, cur); }
    const items = [...m.values()].sort((a, b) => b.value - a.value).slice(0, 25).map((c) => ({ label: `${c.label}${c.special ? ' (special)' : ''}`, value: c.value, name: c.label, years: [...c.years].join(', ') }));
    return { option: barsHOption({ items, valueName: 'Entries', labelWidth: 240, saveName: 'entrants-by-category' }), height: Math.max(220, 32 * items.length + 60), onClick: (p) => { const it = items.find((i) => i.label === p.name); if (it) setFilter('category_name', it.name); }, note: 'Entry counts come from the category headers of the official list; a year loaded only from seed rows shows counts for those rows alone.', table: tableHtml([{ key: 'name', label: 'Category' }, { key: 'value', label: 'Entries', numeric: true }, { key: 'years', label: 'Years' }], items, { className: 'data-table' }) };
  } },
  'special-share': { title: 'Classic versus special categories by year', build(rows) {
    const labels = state.meta.years;
    const classic = labels.map((y) => rows.filter((r) => r.year === y && !r.special).length);
    const special = labels.map((y) => rows.filter((r) => r.year === y && r.special).length);
    return { option: stackedColumnsOption({ labels, notes: labels.map((y) => (state.meta.coverage[y] === 'complete' ? '' : state.meta.coverage[y])), series: [{ name: 'Classic style categories', data: classic, color: 'var(--series-1)' }, { name: 'Special categories', data: special, color: 'var(--series-2)' }], saveName: 'classic-vs-special' }), height: 280, table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'classic', label: 'Classic', numeric: true }, { key: 'special', label: 'Special', numeric: true }], labels.map((y, i) => ({ year: y, classic: classic[i], special: special[i] })), { className: 'data-table' }) };
  } },
  'entries-vs-breweries': { title: 'Category size versus medal spread', subtitle: 'entries judged against distinct medal-winning breweries across loaded years', build(rows) {
    const m = new Map();
    for (const r of rows) if (r.entries) { const cur = m.get(r.category_name) ?? { name: r.category_name, x: 0, b: new Set() }; cur.x = Math.max(cur.x, r.entries); cur.b.add(r.brewery_key); m.set(r.category_name, cur); }
    const points = [...m.values()].map((c) => ({ name: c.name, x: c.x, y: c.b.size, size: 8 + c.b.size * 2 }));
    return { option: scatterOption({ points, xName: 'Entries', yName: 'Breweries', saveName: 'entries-vs-breweries' }), height: 320, table: tableHtml([{ key: 'name', label: 'Category' }, { key: 'x', label: 'Entries', numeric: true }, { key: 'y', label: 'Breweries', numeric: true }], points, { className: 'data-table' }) };
  } },
  'brewery-trend': { title: 'Brewery medals by year', build(rows) {
    const b = currentBrewery();
    if (!b) return null;
    const labels = b.trend.map((t) => t.year);
    const option = stackedColumnsOption({ labels, notes: b.trend.map((t) => ({ 'did-not-exist': 'not yet founded', 'not-yet-reported': 'pending', 'no-data': 'partial', 'no-results': 'not loaded', closed: 'closed' }[t.status] ?? '')), series: [{ name: 'Gold', data: b.trend.map((t) => t.gold), color: MEDAL_COLORS.Gold }, { name: 'Silver', data: b.trend.map((t) => t.silver), color: MEDAL_COLORS.Silver }, { name: 'Bronze', data: b.trend.map((t) => t.bronze), color: MEDAL_COLORS.Bronze }], saveName: `${b.slug}-medals-by-year` });
    return { option, height: 280, subtitle: b.name, table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'gold', label: 'Gold', numeric: true }, { key: 'silver', label: 'Silver', numeric: true }, { key: 'bronze', label: 'Bronze', numeric: true }, { key: 'status', label: 'Status' }], b.trend, { className: 'data-table' }) };
  } },
  'brewery-categories': { title: 'Brewery medals by category', build(rows) {
    const b = currentBrewery();
    if (!b) return null;
    const items = countBy(state.rows.filter((r) => r.brewery_key === b.key), 'category_name').map(([label, value]) => ({ label, value }));
    return { option: barsHOption({ items, labelWidth: 240, saveName: `${b.slug}-categories` }), height: Math.max(200, 34 * items.length + 60), subtitle: b.name, table: tableHtml([{ key: 'label', label: 'Category' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'brewery-locations': { title: 'Brewery medals by location credited', build(rows) {
    const b = currentBrewery();
    if (!b) return null;
    const items = countBy(state.rows.filter((r) => r.brewery_key === b.key).map((r) => ({ loc: r.brewery_location || r.city })), 'loc').map(([label, value]) => ({ label, value }));
    return { option: barsHOption({ items, color: 'var(--series-2)', saveName: `${b.slug}-locations` }), height: Math.max(180, 36 * items.length + 60), subtitle: b.name, table: tableHtml([{ key: 'label', label: 'Location' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'ownership-share': { title: 'Medals by ownership type', build(rows) {
    const items = countBy(rows, 'ownership_type').map(([label, value]) => ({ label, value }));
    return { option: barsHOption({ items, labelWidth: 230, saveName: 'medals-by-ownership' }), height: Math.max(200, 36 * items.length + 60), onClick: (p) => setFilter('ownership_type', p.name), table: tableHtml([{ key: 'label', label: 'Ownership type' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  parents: { title: 'Medals by parent company', subtitle: 'non-independent owners', build(rows) {
    const items = countBy(rows.filter((r) => r.parent), 'parent').map(([label, value]) => ({ label, value }));
    if (!items.length) return { empty: 'No medalist in view is owned by a large brewer or conglomerate.' };
    return { option: barsHOption({ items, color: 'var(--series-2)', labelWidth: 230, saveName: 'medals-by-parent' }), height: Math.max(200, 36 * items.length + 60), table: tableHtml([{ key: 'label', label: 'Parent' }, { key: 'value', label: 'Medals', numeric: true }], items, { className: 'data-table' }) };
  } },
  'revenue-by-brewery': { title: 'Estimated annual revenue by brewery (E)', subtitle: 'breweries in view, estimate method in About', build(rows) {
    const keys = new Set(rows.map((r) => r.brewery_key));
    const items = state.breweries.filter((b) => keys.has(b.key)).sort((a, b) => b.estimate.revenue_usd - a.estimate.revenue_usd).slice(0, 15).map((b) => ({ label: b.name, value: b.estimate.revenue_usd, href: bHref(b.slug), basis: b.estimate.basis }));
    return { option: barsHOption({ items, color: 'var(--series-6)', valueName: 'Revenue USD', labelWidth: 220, saveName: 'estimated-revenue' }), height: Math.max(220, 36 * items.length + 60), table: tableHtml([{ key: 'label', label: 'Brewery' }, { key: 'value', label: 'Revenue USD', numeric: true, render: (r) => compact(r.value) }, { key: 'basis', label: 'Basis' }], items, { className: 'data-table' }) };
  } },
  'entries-trend': { title: 'Entries judged by year', subtitle: 'Brewers Association totals; years without a published figure are left blank', build() {
    const s = state.meta.summary.filter((x) => x.competition === 'GABF').sort((a, b) => Number(a.year) - Number(b.year));
    const labels = s.map((x) => x.year);
    return { option: lineOption({ labels, series: [{ name: 'Entries', data: s.map((x) => (x.entries ? Number(x.entries) : null)), color: SERIES_COLORS[0] }], saveName: 'entries-judged' }), height: 280, table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'entries', label: 'Entries', numeric: true }, { key: 'entering_breweries', label: 'Breweries entering', numeric: true }], s, { className: 'data-table' }) };
  } },
  'medals-trend': { title: 'Medals awarded and winning breweries', subtitle: 'Brewers Association totals; blank years have no published figure', build() {
    const s = state.meta.summary.filter((x) => x.competition === 'GABF').sort((a, b) => Number(a.year) - Number(b.year));
    const labels = s.map((x) => x.year);
    return { option: lineOption({ labels, series: [{ name: 'Medals', data: s.map((x) => (x.medals ? Number(x.medals) : null)), color: SERIES_COLORS[1] }, { name: 'Winning breweries', data: s.map((x) => (x.winning_breweries ? Number(x.winning_breweries) : null)), color: SERIES_COLORS[2] }], saveName: 'medals-and-winners' }), height: 280, table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'winning_breweries', label: 'Winning breweries', numeric: true }], s, { className: 'data-table' }) };
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
    { key: 'per_million', label: 'Per million', numeric: true, render: (x) => x.per_million.toFixed(2) },
    { key: 'per_gdp', label: `Per $100B real GDP${level === 'district' ? ' (E)' : ''}`, numeric: true, render: (x) => x.per_gdp.toFixed(2) },
    ...fields.map((f) => ({ key: f.key, label: f.key === 'gdp_per_capita_real' ? 'Real GDP per capita 2025 (chained 2017 USD)' : f.label, numeric: true, render: (x) => { const v = latestValue(x.series[f.key]); return v === null ? '' : v.toLocaleString('en-US', { maximumFractionDigits: f.digits, minimumFractionDigits: f.digits }); } })),
  ];
  el.innerHTML = `<label class="small">Rows<select id="controls-level"><option value="state"${level === 'state' ? ' selected' : ''}>States</option><option value="district"${level === 'district' ? ' selected' : ''}>Federal Reserve districts</option></select></label><div class="table-wrap">${tableHtml(cols, list)}</div><p class="small muted">Rates sum each medal against its own year's population and real GDP. Controls: ACS 2024 1-year (age, race and Hispanic origin, education, income, poverty), 2020 Census urban share, NCES PIAAC modeled literacy (pooled 2012, 2014, 2017), NCHS life expectancy 2022. District demographics are not compiled; district GDP for split states is apportioned (E), and West Virginia is assigned whole to the Richmond district (approximation). Sources and method are in docs/data-sources.md.</p>`;
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
    statTile({ label: 'Medals in view', value: rows.length.toLocaleString() }),
    statTile({ label: 'Breweries', value: breweries.toLocaleString() }),
    statTile({ label: 'States', value: states.toLocaleString() }),
    statTile({ label: 'Categories', value: cats.toLocaleString(), note: `${special} medals in special categories` }),
    statTile({ label: 'Gold, silver, bronze', medals: ['Gold', 'Silver', 'Bronze'].map((m) => rows.filter((r) => r.medal === m).length) }),
    statTile({ label: 'Entrants in categories shown', value: entries ? entries.toLocaleString() : 'n/a', note: 'sum of category entry counts' }),
  ].join('');
}

function renderTable(rows) {
  const el = qs('table');
  if (!el) return;
  const limit = Math.min(rows.length, state.tableLimit ?? 25);
  const rank = { Gold: 1, Silver: 2, Bronze: 3 };
  rows = [...rows].sort((a, b) => b.year - a.year || String(a.category_name).localeCompare(String(b.category_name)) || (rank[a.medal] ?? 9) - (rank[b.medal] ?? 9));
  const medalDot = (m) => `<span class="badge-medal ${String(m).toLowerCase()}"></span>${esc(m)}`;
  el.innerHTML = `<div class="table-wrap stack">${tableHtml([
    { key: 'year', label: 'Year', numeric: true },
    { key: 'medal', label: 'Medal', render: (r) => medalDot(r.medal) },
    { key: 'beer_name', label: 'Beer', render: (r) => (r.beer_profile && !STANDALONE ? `<a href="${esc(base + r.beer_profile)}">${esc(r.beer_name)}</a>` : esc(r.beer_name)) },
    { key: 'brewery_name', label: 'Brewery', render: (r) => `<a href="${esc(bHref(r.brewery_slug))}">${esc(r.brewery_name)}</a>${r.brewery_location ? ` <span class="muted small">(${esc(r.brewery_location)})</span>` : ''}` },
    { key: 'city', label: 'City', render: (r) => `${esc(r.city)}, ${esc(r.state)}` },
    { key: 'category_name', label: 'Category', render: (r) => `<a href="${esc(cHref(r.category_name, r.category_slug))}">${esc(r.category_name)}</a>${r.special ? ' <span class="pill">special</span>' : ''}` },
    { key: 'entries', label: 'Entries', numeric: true, render: (r) => (r.entries ?? '') },
    { key: 'style_family', label: 'Style family' },
    { key: 'abv', label: 'ABV', render: (r) => (r.abv ? `${r.abv}%` : (r.abv_min ? `${r.abv_min} to ${r.abv_max}% (style)` : '')) },
    { key: 'ownership_type', label: 'Ownership', render: (r) => `${esc(r.ownership_type)}${r.parent ? ` (${esc(r.parent)})` : ''}` },
    { key: 'distribution_channel', label: 'Distribution' },
  ], rows.slice(0, limit))}</div><div class="table-more"><p class="small muted">Showing ${limit.toLocaleString()} of ${rows.length.toLocaleString()} medals, newest first.</p>${rows.length > limit ? `<button class="btn" type="button" id="show-more">Show ${Math.min(100, rows.length - limit)} more</button><button class="btn" type="button" id="show-all">Show all</button>` : ''}</div>`;
  const more = qs('show-more');
  if (more) more.addEventListener('click', () => { state.tableLimit = limit + 100; renderTable(state.lastRows); });
  const all = qs('show-all');
  if (all) all.addEventListener('click', () => { state.tableLimit = Infinity; renderTable(state.lastRows); });
  wireSortable(el);
}

function wireSortable(root) {
  root.querySelectorAll('table.sortable').forEach((table) => {
    Array.from(table.tHead.rows[0].cells).forEach((th, idx) => {
      th.addEventListener('click', () => {
        const numeric = th.classList.contains('num');
        const dir = th.getAttribute('aria-sort') === 'descending' ? 'asc' : 'desc';
        Array.from(th.parentNode.cells).forEach((c) => c.removeAttribute('aria-sort'));
        th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
        const tbody = table.tBodies[0];
        const rows = Array.from(tbody.rows);
        rows.sort((a, b) => {
          const va = a.cells[idx].textContent.trim(); const vb = b.cells[idx].textContent.trim();
          if (numeric) { const na = parseFloat(va.replace(/[^0-9.-]/g, '')) || 0; const nb = parseFloat(vb.replace(/[^0-9.-]/g, '')) || 0; return dir === 'asc' ? na - nb : nb - na; }
          return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
        rows.forEach((r) => tbody.appendChild(r));
      });
    });
  });
}

function renderBreweryPicker() {
  const el = qs('brewery-picker');
  if (!el) return;
  const b = currentBrewery();
  const sorted = [...state.breweries].sort((x, y) => y.points - x.points || x.name.localeCompare(y.name));
  el.innerHTML = `<label>Brewery<select id="f-brewery">${sorted.map((x) => `<option value="${esc(x.key)}"${b && x.key === b.key ? ' selected' : ''}>${esc(x.name)} (${x.medals})</option>`).join('')}</select></label>${b ? `<p class="small">${esc(b.hq.city)}, ${esc(b.hq.state)} · ${esc(b.brewery_type)}${b.founded ? ` · founded ${b.founded}` : ''}${b.ownership ? ` · ${esc(b.ownership.type)}` : ''}${STANDALONE ? '' : ` · <a href="${base}breweries/${esc(b.slug)}/">open profile</a>`}</p>` : ''}`;
  qs('f-brewery').addEventListener('change', (e) => { state.filters.brewery = e.target.value; render(); });
}

function renderFinancialTable(rows) {
  const el = qs('financial-table');
  if (!el) return;
  const keys = new Set(rows.map((r) => r.brewery_key));
  const list = state.breweries.filter((b) => keys.has(b.key)).sort((a, b) => b.financials.arr_usd - a.financials.arr_usd);
  el.innerHTML = `<div class="table-wrap">${tableHtml([
    { key: 'name', label: 'Brewery', render: (b) => `<a href="${esc(bHref(b.slug))}">${esc(b.name)}</a>` },
    { key: 'type', label: 'Type', render: (b) => esc(b.brewery_type) },
    { key: 'barrels', label: 'Barrels (E)', numeric: true, render: (b) => compact(b.estimate.barrels) },
    { key: 'arr', label: 'ARR USD (E)', numeric: true, render: (b) => compact(b.financials.arr_usd) },
    { key: 'gm', label: 'Gross margin (E)', numeric: true, render: (b) => `${Math.round(b.financials.gross_margin * 100)}%` },
    { key: 'ebitda', label: 'EBITDA USD (E)', numeric: true, render: (b) => `${compact(b.financials.ebitda_usd)} (${Math.round(b.financials.ebitda_margin_low * 100)} to ${Math.round(b.financials.ebitda_margin_high * 100)}%)` },
    { key: 'channel', label: 'Distribution', render: (b) => esc(b.distribution_channel || 'unknown') },
    { key: 'ownership', label: 'Ownership', render: (b) => (b.ownership ? `${esc(b.ownership.type)}${b.ownership.parent ? ` (${esc(b.ownership.parent)})` : ''}` : '<span class="muted">unlisted</span>') },
    { key: 'basis', label: 'Volume basis', render: (b) => esc(b.estimate.basis) },
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

function render() {
  applyTab();
  const rows = applyFilters(state.rows);
  writeHash();
  const notice = qs('partial-notice');
  if (notice) {
    const partialYears = [...new Set(rows.filter((r) => r.partial).map((r) => r.year))].sort();
    notice.innerHTML = partialYears.length ? `<div class="notice">Years ${partialYears.join(', ')} are only partially loaded (seed or transcript rows). Run the ingest to load the complete official lists; see the runbook in the repository.</div>` : '';
  }
  renderStats(rows);
  renderBreweryPicker();
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
  const cols = ['year', 'competition', 'category_number', 'category_name', 'category_type', 'entries', 'medal', 'beer_name', 'brewery_name', 'brewery_location', 'city', 'state', 'region', 'fed_district', 'fed_district_name', 'fed_district_method', 'style_family', 'abv_min', 'abv_max', 'abv', 'brewery_type', 'ownership_type', 'parent', 'distribution_channel'];
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
  const [results, meta, breweries] = STANDALONE
    ? [window.GABF_DATA.results, window.GABF_DATA.meta, window.GABF_DATA.breweries]
    : await Promise.all([
      fetch(`${base}data/results.json`).then((r) => r.json()),
      fetch(`${base}data/meta.json`).then((r) => r.json()),
      fetch(`${base}data/breweries.json`).then((r) => r.json()),
    ]);
  state.meta = meta;
  state.breweries = breweries;
  state.rows = results.map((r) => ({ ...r, brewery_type: meta.brewery_types[r.brewery_key] ?? '', ownership_type: meta.ownership[r.brewery_key]?.ownership_type ?? 'unlisted', parent: meta.ownership[r.brewery_key]?.parent ?? '', distribution_channel: meta.distribution[r.brewery_key] ?? 'unknown' }));
  state.filters = readHash();
  state.defaultBrewery = document.querySelector('[data-default-brewery]')?.dataset.defaultBrewery || breweries[0]?.key;
  buildFilterRow();
  render();
  document.querySelectorAll('[data-tab-link]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    state.filters.tab = a.dataset.tabLink;
    render();
    window.scrollTo(0, 0);
  }));
  window.addEventListener('hashchange', () => { state.filters = readHash(); buildFilterRow(); render(); });
  if (STANDALONE) {
    // In-page links (brewery names, categories, coverage pills) are hash routes. Handling the click
    // here keeps them working where the address bar is not ours to change, such as a sandboxed frame.
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.hasAttribute('data-tab-link') || e.defaultPrevented) return;
      e.preventDefault();
      state.filters = parseHash(a.getAttribute('href'));
      buildFilterRow();
      render();
      window.scrollTo(0, 0);
    });
  }
}

init().catch((err) => { const el = qs('stats') || document.querySelector('main'); el.innerHTML = `<div class="notice">Could not load data: ${esc(err.message)}</div>`; });
