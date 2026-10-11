#!/usr/bin/env node
// Build the static site into dist/. Pure Node, no framework: every page is a
// template function, charts are server-rendered SVG from site/assets/charts.mjs, and
// the explorer loads data/results.json for client-side filtering.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { marked } from 'marked';
import { DIST, REFERENCE, RESULTS, SITE, parseArgs } from './lib/paths.mjs';
import { categoryIndex, loadDataset } from './lib/data-model.mjs';
import { ABV_BANDS } from './lib/style-families.mjs';
import { barsH, columnsStacked, compact, esc, figure, legendHtml, lineChart, MEDAL_SERIES, SERIES_COLORS, statTile, STATUS_LABELS, tableHtml } from '../site/assets/charts.mjs';

const SITE_TITLE = 'GABF Analysis';
const REPO_URL = 'https://github.com/klappe-pm/2026-GABF-Analysis';
const fmt = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-US'));
const usd = (n) => `$${compact(n)}`;
const pct = (num, den) => (den ? `${((100 * num) / den).toFixed(1)}%` : '');

function write(relPath, html) {
  const full = resolve(DIST, relPath);
  mkdirSync(resolve(full, '..'), { recursive: true });
  writeFileSync(full, html);
}

function layout({ title, description = '', body, depth = 0, active = '', scripts = '' }) {
  const r = depth === 0 ? './' : '../'.repeat(depth);
  const nav = [['', 'Explorer'], ['breweries/', 'Breweries'], ['categories/', 'Categories'], ['reports/', 'Reports'], ['about/', 'About']]
    .map(([href, label]) => `<a href="${r}${href}"${active === label ? ' class="active"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${SITE_TITLE}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="${r}assets/styles.css">
</head>
<body>
<header class="site-header"><div class="inner"><a class="brand" href="${r}">${SITE_TITLE}</a><nav class="site-nav">${nav}</nav><button class="theme-toggle" type="button">Dark mode</button></div></header>
<main>
${body}
</main>
<footer class="site-footer"><div class="inner">Results from the Brewers Association's official Great American Beer Festival winners lists. Brewery locations from Open Brewery DB and curated overrides. Estimates are marked (E). <a href="${REPO_URL}">Source and data</a>.</div></footer>
<script src="${r}assets/page.js" defer></script>
${scripts}
</body>
</html>
`;
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

function medalTable(rows, { depth, showYear = true, showBrewery = false, showCompetition = false } = {}) {
  const r = '../'.repeat(depth);
  const cols = [];
  if (showYear) cols.push({ key: 'year', label: 'Year', numeric: true });
  if (showCompetition) cols.push({ key: 'competition', label: 'Competition' });
  cols.push({ key: 'medal', label: 'Medal', render: (x) => medalDot(x.medal) });
  cols.push({ key: 'beer_name', label: 'Beer' });
  if (showBrewery) cols.push({ key: 'brewery_name', label: 'Brewery', render: (x) => `<a href="${r}breweries/${esc(x.brewery_slug)}/">${esc(x.brewery_name)}</a>${x.brewery_location ? ` <span class="muted small">(${esc(x.brewery_location)})</span>` : ''}` });
  else cols.push({ key: 'brewery_location', label: 'Location credited', render: (x) => esc(x.brewery_location || x.city) });
  cols.push({ key: 'city', label: 'City', render: (x) => `${esc(x.city)}, ${esc(x.state)}` });
  cols.push({ key: 'category_name', label: 'Category', render: (x) => `<a href="${r}categories/${esc(x.category_slug)}/">${esc(x.category_name)}</a>${x.entries ? ` <span class="muted small">(${fmt(x.entries)} entries)</span>` : ''}` });
  cols.push({ key: 'style_family', label: 'Style family' });
  cols.push({ key: 'notes', label: 'Notes', render: (x) => `<span class="small muted">${esc(x.notes ?? '')}</span>` });
  return `<div class="table-wrap">${tableHtml(cols, rows)}</div>`;
}

// ---------- data exports ----------
function writeData(ds, cats) {
  const fields = ['year', 'competition', 'section', 'category_number', 'category_name', 'category_slug', 'entries', 'medal', 'beer_name', 'brewery_name', 'brewery_key', 'brewery_slug', 'brewery_location', 'city', 'state', 'state_name', 'region', 'division', 'style_family', 'abv_min', 'abv_max', 'abv', 'abv_band', 'points', 'partial'];
  const rows = ds.results.map((r) => Object.fromEntries(fields.map((f) => [f, r[f] ?? null])));
  write('data/results.json', JSON.stringify(rows));
  const meta = {
    generated_at: new Date().toISOString(),
    years: ds.years,
    coverage: ds.coverage,
    latest_complete: ds.latestComplete,
    summary: ds.summary,
    states: ds.states.map((s) => ({ state: s.state, name: s.name, region: s.region, division: s.division, population_2020: Number(s.population_2020) })),
    abv_bands: ABV_BANDS,
    brewery_types: Object.fromEntries(ds.breweries.map((b) => [b.key, b.brewery_type])),
    ownership: Object.fromEntries(ds.breweries.filter((b) => b.ownership).map((b) => [b.key, { ownership_type: b.ownership.ownership_type, parent: b.ownership.parent }])),
    categories: cats.map((c) => ({ name: c.name, slug: c.slug, style_family: c.style_family })),
  };
  write('data/meta.json', JSON.stringify(meta));
  write('data/breweries.json', JSON.stringify(ds.breweries.map((b) => ({ key: b.key, slug: b.slug, name: b.name, hq: b.hq, brewery_type: b.brewery_type, founded: b.founded, medals: b.medals.length, by_medal: b.by_medal, points: b.total_points, first_year: b.first_year, last_year: b.last_year, streak: b.streak, ownership: b.ownership ? { type: b.ownership.ownership_type, parent: b.ownership.parent, investor: b.ownership.investor } : null, estimate: { barrels: b.estimate.barrels, basis: b.estimate.basis, revenue_usd: b.estimate.revenue.total_revenue_usd }, has_profile: Boolean(b.profile), locations: b.locations }))));
  write('data/categories.json', JSON.stringify(cats.map((c) => ({ name: c.name, slug: c.slug, style_family: c.style_family, ref: c.ref, years: c.years.map((y) => ({ year: y.year, entries: y.entries, number: y.number, medals: y.medals.length })) }))));
  mkdirSync(resolve(DIST, 'data/csv'), { recursive: true });
  for (const dir of [RESULTS, REFERENCE]) {
    for (const f of readdirSync(dir)) if (f.endsWith('.csv') || f.endsWith('.json')) cpSync(resolve(dir, f), resolve(DIST, 'data/csv', f));
  }
}

// ---------- explorer ----------
function explorerPage(ds) {
  const featured = ds.breweries.filter((b) => b.profile).slice(0, 6);
  const body = `
<h1>Great American Beer Festival results explorer</h1>
<p class="lede">Every medal from the official winners lists, filterable by year, medal, style family, category, state, region, brewery type, ownership, and ABV band. Charts and the table always agree because they read the same slice. Years marked partial carry only seed rows until the official list is ingested.</p>
${coveragePills(ds)}
<div id="filters" class="filters" aria-label="Filters"></div>
<div id="partial-notice"></div>
<div id="stats" class="stats"></div>
<div id="charts" class="grid two"></div>
<h2>results</h2>
<div id="table"></div>
<h2>featured-deep-dives</h2>
<ul class="list-plain">${featured.map((b) => `<li><a href="breweries/${b.slug}/">${esc(b.name)}</a> <span class="muted small">${esc(b.hq.city)}, ${esc(b.hq.state)} · ${b.medals.length} GABF medals in the loaded data</span></li>`).join('')}</ul>
<p class="small muted">Reports: <a href="reports/top-breweries/">top breweries</a>, <a href="reports/top-categories/">top categories</a>, <a href="reports/by-state/">states and per capita</a>, <a href="reports/by-region/">regions</a>, <a href="reports/ownership/">ownership and investors</a>, <a href="reports/trends/">trends</a>, <a href="reports/brewery-of-the-year/">brewery of the year</a>.</p>`;
  write('index.html', layout({ title: 'Explorer', description: 'Filter and chart every Great American Beer Festival medal.', body, depth: 0, active: 'Explorer', scripts: '<script type="module" src="assets/app.js"></script>' }));
}

// ---------- breweries ----------
function breweryCharts(b, depth) {
  const r = '../'.repeat(depth);
  const years = b.trend.map((t) => ({ x: String(t.year), values: { gold: t.gold, silver: t.silver, bronze: t.bronze }, status: t.status, statusShort: t.status === 'did-not-exist' ? 'not yet founded' : t.status === 'not-yet-reported' ? 'pending' : t.status === 'no-data' ? 'partial' : t.status === 'no-results' ? 'not loaded' : t.status === 'closed' ? 'closed' : '' }));
  const byFamily = countBy(b.medals, 'style_family').map(([label, value]) => ({ label, value }));
  const byLocation = countBy(b.medals.map((m) => ({ ...m, loc: m.brewery_location || `${m.city} (as printed)` })), 'loc').map(([label, value]) => ({ label, value }));
  const byCategory = countBy(b.medals, 'category_name').map(([label, value]) => ({ label, value, href: `${r}categories/${esc(b.medals.find((m) => m.category_name === label).category_slug)}/` }));
  const figures = [
    figure({ id: 'medals-by-year', title: 'GABF medals by year', subtitle: `${b.name}, ${years[0].x} to ${years[years.length - 1].x}`, svg: columnsStacked({ rows: years, title: 'GABF medals by year' }), legend: legendHtml(MEDAL_SERIES), note: 'Markers under the axis: × the brewery did not exist yet (or had closed), … results not yet published, · year only partially loaded, ○ no results loaded for that year.', table: tableHtml([{ key: 'x', label: 'Year' }, { key: 'gold', label: 'Gold', numeric: true, render: (x) => x.values.gold }, { key: 'silver', label: 'Silver', numeric: true, render: (x) => x.values.silver }, { key: 'bronze', label: 'Bronze', numeric: true, render: (x) => x.values.bronze }, { key: 'status', label: 'Status', render: (x) => esc(STATUS_LABELS[x.status] ?? x.status) }], years, { className: 'data-table' }) }),
    figure({ id: 'medals-by-style-family', title: 'GABF medals by style family', subtitle: 'all loaded years', svg: barsH({ items: byFamily, title: 'Medals by style family', color: 'var(--series-3)', labelWidth: 170 }), table: tableHtml([{ key: 'label', label: 'Style family' }, { key: 'value', label: 'Medals', numeric: true }], byFamily, { className: 'data-table' }) }),
  ];
  if (byLocation.length > 1) figures.push(figure({ id: 'medals-by-location', title: 'GABF medals by location credited', subtitle: 'as printed in the winners list', svg: barsH({ items: byLocation, title: 'Medals by location', color: 'var(--series-2)', labelWidth: 170 }), table: tableHtml([{ key: 'label', label: 'Location' }, { key: 'value', label: 'Medals', numeric: true }], byLocation, { className: 'data-table' }) }));
  if (byCategory.length > 1) figures.push(figure({ id: 'medals-by-category', title: 'GABF medals by category', svg: barsH({ items: byCategory.slice(0, 15), title: 'Medals by category', color: 'var(--series-1)', labelWidth: 230 }), table: tableHtml([{ key: 'label', label: 'Category' }, { key: 'value', label: 'Medals', numeric: true }], byCategory, { className: 'data-table' }) }));
  return figures.join('');
}

function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const v = r[key] || '(unknown)';
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function profileCard(b) {
  const o = b.ownership;
  const locs = b.location_list.length ? b.location_list.map((l) => ({ label: l.name, address_1: l.address, city: l.city, state: l.state, postal_code: l['postal-code'], opened: l.opened, kitchen: l.kitchen, notes: l.notes })) : (b.enriched?.locations ?? []).map((l) => ({ label: l.label || l.name, address_1: l.address_1 ?? l.street, city: l.city, state: l.state ?? l.state_province, postal_code: l.postal_code, latitude: l.latitude, longitude: l.longitude, website_url: l.website_url, source: l.source }));
  const est = b.estimate;
  const rev = est.revenue;
  return `<div class="card">
<h2>profile</h2>
<dl class="kv">
<dt>Type</dt><dd>${esc(b.brewery_type)}</dd>
<dt>Headquarters</dt><dd>${esc(b.hq.city)}, ${esc(b.hq.state)}</dd>
<dt>Founded</dt><dd>${b.founded ?? '<span class="muted">unknown</span>'}</dd>
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
<h3>scale-estimates</h3>
<dl class="kv">
<dt>Barrels / year</dt><dd>${fmt(est.barrels)} <span class="muted small">(${esc(est.basis)}${est.confidence ? `, ${esc(est.confidence)} confidence` : ''}${est.basis === 'reported' ? '' : ', E'})</span></dd>
<dt>Equivalent</dt><dd class="small">${fmt(est.volume.gallons)} gallons; ${fmt(est.volume.cases_24x12_equivalent)} cases of 24 twelve-ounce; about ${fmt(est.volume.cans_16oz_equivalent)} sixteen-ounce cans packaged (${Math.round(est.volume.packaged_share * 100)}% packaged assumption) and ${fmt(est.volume.pints_equivalent_draft)} pints on draft</dd>
<dt>Revenue / year</dt><dd>${usd(rev.total_revenue_usd)} <span class="muted small">(range ${usd(rev.low_usd)} to ${usd(rev.high_usd)}, E)</span></dd>
<dt>Locations</dt><dd>${b.locations_count}${b.has_kitchen ? ', with kitchen(s)' : ''}</dd>
</dl>
<p class="small muted">Method: <a href="../../about/#estimates">estimation notes</a>.</p>
</div>`;
}

function trendTimeline(b) {
  const last = b.trend.slice(-6);
  return `<ul class="timeline">${last.map((t) => `<li><span class="year">${t.year}</span><span>${t.total > 0 ? `${t.total} medal${t.total === 1 ? '' : 's'}: ${[t.gold ? `${t.gold} gold` : '', t.silver ? `${t.silver} silver` : '', t.bronze ? `${t.bronze} bronze` : ''].filter(Boolean).join(', ')}` : `<span class="status">${esc(STATUS_LABELS[t.status] ?? t.status)}</span>`}</span></li>`).join('')}</ul>`;
}

function renderMarkdownBody(body) {
  const withoutH1 = body.replace(/^#\s+.*\n+/m, '');
  return marked.parse(withoutH1, { gfm: true });
}

function breweryPage(ds, b) {
  const depth = 2;
  const partial = b.medals.some((m) => m.partial);
  const pills = [`<span class="pill">${esc(b.brewery_type)}</span>`, `<span class="pill">${esc(b.hq.city)}, ${esc(b.hq.state)}</span>`, b.founded ? `<span class="pill">founded ${b.founded}</span>` : '', b.ownership ? `<span class="pill ${['independent', 'employee-owned'].includes(b.ownership.ownership_type) ? 'good' : 'warn'}">${esc(b.ownership.ownership_type)}${b.ownership.parent ? `: ${esc(b.ownership.parent)}` : ''}</span>` : '', b.streak > 1 ? `<span class="pill">${b.streak}-year medal streak</span>` : ''].join('');
  const cats = new Set(b.medals.map((m) => m.category_name)).size;
  const stats = [
    statTile({ label: 'GABF medals loaded', value: String(b.medals.length), note: partial ? 'some years partial' : '' }),
    statTile({ label: 'Gold / Silver / Bronze', value: `${b.by_medal.Gold} / ${b.by_medal.Silver} / ${b.by_medal.Bronze}` }),
    statTile({ label: 'First GABF medal (loaded)', value: b.first_year ? String(b.first_year) : 'none' }),
    statTile({ label: 'Categories medaled', value: String(cats) }),
    statTile({ label: 'Estimated barrels / year', value: compact(b.estimate.barrels), note: b.estimate.basis === 'reported' ? 'reported' : 'estimate (E)' }),
    statTile({ label: 'Estimated revenue / year', value: usd(b.estimate.revenue.total_revenue_usd), note: 'estimate (E)' }),
  ].join('');
  const other = b.other_medals.length ? `<h2>other-competitions</h2>${medalTable(b.other_medals.sort((x, y) => y.year - x.year), { depth, showCompetition: true })}` : '';
  const deepDive = b.profile ? `<section class="prose">${renderMarkdownBody(b.profile.body)}</section>` : `<div class="notice">No deep dive yet. Scaffold one with <code>node scripts/scaffold-brewery.mjs --brewery "${esc(b.name)}"</code>, then research the brewery and fill in the sections.</div>`;
  const body = `
<p class="small"><a href="../">All breweries</a></p>
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
  write(`breweries/${b.slug}/index.html`, layout({ title: b.name, description: `${b.name}: GABF medal history, locations, ownership, and scale estimates.`, body, depth, active: 'Breweries' }));
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
  ];
  const body = `
<h1>breweries</h1>
<p class="lede">${rows.length} breweries in the loaded results, ranked by points (gold 3, silver 2, bronze 1). Click a column to sort. Type to filter.</p>
<p><input id="q" type="search" placeholder="Filter by name, city, or state" style="font: inherit; padding: 7px 10px; width: 100%; max-width: 420px; border: 1px solid var(--axis); border-radius: 6px; background: var(--surface-1); color: var(--text-primary);"></p>
<div class="table-wrap" id="brewery-table">${tableHtml(cols, rows)}</div>
<script>
(function(){var q=document.getElementById('q');var rows=Array.prototype.slice.call(document.querySelectorAll('#brewery-table tbody tr'));q.addEventListener('input',function(){var v=q.value.trim().toLowerCase();rows.forEach(function(r){r.style.display=!v||r.textContent.toLowerCase().indexOf(v)>=0?'':'none';});});})();
</script>`;
  write('breweries/index.html', layout({ title: 'Breweries', description: 'Every medal-winning brewery in the loaded GABF results.', body, depth: 1, active: 'Breweries' }));
}

// ---------- categories ----------
function categoryPage(ds, c) {
  const depth = 2;
  const ref = c.ref;
  const entriesSeries = c.years.filter((y) => y.entries).map((y) => ({ x: String(y.year), y: y.entries }));
  const chart = entriesSeries.length > 1 ? figure({ id: 'entries-by-year', title: 'Entries by year', subtitle: 'how competitive the category is', svg: lineChart({ series: [{ label: 'Entries', points: entriesSeries }], title: 'Entries by year' }), table: tableHtml([{ key: 'x', label: 'Year' }, { key: 'y', label: 'Entries', numeric: true }], entriesSeries, { className: 'data-table' }) }) : '';
  const body = `
<p class="small"><a href="../">All categories</a></p>
<h1>${esc(c.name)}</h1>
<p class="lede"><span class="pill">${esc(c.style_family)}</span>${ref?.abv_min ? `<span class="pill">ABV ${esc(ref.abv_min)} to ${esc(ref.abv_max)}%</span>` : ''}${ref?.ibu_min ? `<span class="pill">IBU ${esc(ref.ibu_min)} to ${esc(ref.ibu_max)}</span>` : ''}${ref?.srm_min ? `<span class="pill">SRM ${esc(ref.srm_min)} to ${esc(ref.srm_max)}</span>` : ''} <a href="../../#category_name=${encodeURIComponent(c.name)}">open in explorer</a></p>
<div class="grid two">
<div class="card"><h2>definition</h2><p>${ref?.description ? esc(ref.description) : '<span class="muted">No definition loaded yet. Run the style guidelines import or add a row to data/reference/categories.csv.</span>'}</p>${ref ? `<p class="small muted">Source: ${esc(ref.guideline_source)} (${esc(ref.confidence)}). The Brewers Association updates its style guidelines each spring; ranges here are approximate until the current guidelines are imported.</p>` : ''}</div>
${chart || `<div class="card"><h2>entries</h2><p class="muted">Entry counts appear once a full winners list is ingested for a year this category ran.</p></div>`}
</div>
<h2>medalists-by-year</h2>
${[...c.years].reverse().map((y) => `<h3>${y.year}${y.number ? ` · category ${esc(y.number)}` : ''}${y.entries ? ` · ${fmt(y.entries)} entries` : ''}</h3>${medalTable(y.medals.sort((a, b) => a.medal_rank - b.medal_rank), { depth, showYear: false, showBrewery: true })}`).join('')}`;
  write(`categories/${c.slug}/index.html`, layout({ title: c.name, description: `${c.name}: definition, entries by year, and GABF medalists.`, body, depth, active: 'Categories' }));
}

function categoriesIndex(ds, cats) {
  const families = countBy(ds.results, 'style_family');
  const cols = [
    { key: 'name', label: 'Category', render: (c) => `<a href="${esc(c.slug)}/">${esc(c.name)}</a>` },
    { key: 'style_family', label: 'Style family' },
    { key: 'abv', label: 'ABV (style)', render: (c) => (c.ref?.abv_min ? `${esc(c.ref.abv_min)} to ${esc(c.ref.abv_max)}%` : '') },
    { key: 'entries', label: 'Latest entries', numeric: true, render: (c) => fmt(c.latest_entries) },
    { key: 'medals', label: 'Medals loaded', numeric: true, render: (c) => c.rows.length },
    { key: 'years', label: 'Years', render: (c) => c.years.map((y) => y.year).join(', ') },
  ];
  const body = `
<h1>categories</h1>
<p class="lede">GABF categories seen in the loaded results, with the style family used for browsing and the style's ABV range. Full category lists (around 100 per year) appear once each year's official list is ingested.</p>
<div class="grid two">
${figure({ id: 'medals-by-family', title: 'Medals by style family', subtitle: 'all loaded years', svg: barsH({ items: families.map(([label, value]) => ({ label, value })), title: 'Medals by style family', color: 'var(--series-3)' }), table: tableHtml([{ key: 'label', label: 'Style family' }, { key: 'value', label: 'Medals', numeric: true }], families.map(([label, value]) => ({ label, value })), { className: 'data-table' }) })}
<div class="card"><h2>style-families</h2><p class="small">Style families are a browsing layer over the official categories: IPA, Pale Ale, Lager, Pilsner, Wheat, Stout and Porter, Belgian and French, Sour and Wild, Strong and Barrel-Aged, Brown Amber and Red, British and Irish, German Ale, Fruit Spice and Specialty, Smoke and Wood, Gluten-Free and Non-Alcoholic, Cider and Mead, Pro-Am and Collaboration. The mapping lives in scripts/lib/style-families.mjs and data/reference/categories.csv.</p></div>
</div>
<h2>all-categories</h2>
<div class="table-wrap">${tableHtml(cols, cats)}</div>`;
  write('categories/index.html', layout({ title: 'Categories', description: 'GABF categories, style families, and ABV ranges.', body, depth: 1, active: 'Categories' }));
}

// ---------- reports ----------
const REPORTS = [
  ['top-breweries', 'Top breweries', 'Medal and point leaders, streaks, and first-time winners.'],
  ['top-categories', 'Top categories', 'Most competitive categories by entries and the style families that collect the most medals.'],
  ['by-state', 'By state', 'Medals by state with population-adjusted rates.'],
  ['by-region', 'By region', 'Census regions and divisions.'],
  ['ownership', 'Ownership and investors', 'Independent versus large-brewer-owned medalists, parents, and investors.'],
  ['trends', 'Trends', 'Entries, medals, breweries, and style-family share over the years.'],
  ['brewery-of-the-year', 'Brewery of the Year', 'Brewery and Brewer of the Year awards by size bracket.'],
];

function reportsIndex(ds) {
  const body = `<h1>reports</h1><p class="lede">Pre-built views over the loaded results. Each report carries a table view beside its chart.</p><ul class="list-plain">${REPORTS.map(([slug, title, desc]) => `<li><a href="${slug}/">${esc(title)}</a> <span class="muted">${esc(desc)}</span></li>`).join('')}</ul>${coveragePills(ds, '../')}`;
  write('reports/index.html', layout({ title: 'Reports', description: 'GABF analysis reports.', body, depth: 1, active: 'Reports' }));
}

function reportLayout(ds, slug, title, body) {
  write(`reports/${slug}/index.html`, layout({ title, description: `${title} report.`, body: `<p class="small"><a href="../">All reports</a></p><h1>${esc(title.toLowerCase().replace(/\s+/g, '-'))}</h1>${body}`, depth: 2, active: 'Reports' }));
}

function topBreweries(ds) {
  const depth = 2;
  const r = '../'.repeat(depth);
  const all = ds.breweries.filter((b) => b.medals.length).slice(0, 50);
  const bars = all.slice(0, 15).map((b) => ({ label: b.name, value: b.total_points, href: `${r}breweries/${b.slug}/`, tip: `${b.name}: ${b.total_points} points from ${b.medals.length} medals` }));
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
    const list = [...byB.values()].sort((a, b) => b.points - a.points || b.medals - a.medals).slice(0, 25);
    return { year: y, list, coverage: ds.coverage[y] };
  }).reverse();
  const firstTimers = ds.latestComplete ? ds.breweries.filter((b) => b.first_year === ds.latestComplete && ds.coverage[ds.latestComplete] === 'complete') : [];
  const body = `
<p class="lede">Points weight gold 3, silver 2, bronze 1. Years marked partial contain only seed rows, so rankings firm up as official lists are ingested.</p>
<div class="grid two">
${figure({ id: 'top-breweries-points', title: 'Top 15 breweries by points', subtitle: 'all loaded years', svg: barsH({ items: bars, title: 'Top breweries by points', color: 'var(--series-2)', labelWidth: 220 }), table: tableHtml([{ key: 'label', label: 'Brewery' }, { key: 'value', label: 'Points', numeric: true }], bars, { className: 'data-table' }) })}
<div class="card"><h2>streaks-and-first-timers</h2><p class="small">Longest active medal streaks (consecutive loaded years through ${ds.latestComplete}):</p><ol class="small">${ds.breweries.filter((b) => b.streak > 1).sort((a, b) => b.streak - a.streak).slice(0, 10).map((b) => `<li><a href="${r}breweries/${b.slug}/">${esc(b.name)}</a>: ${b.streak} years</li>`).join('') || '<li class="muted">No multi-year streaks can be computed until consecutive complete years are loaded.</li>'}</ol><p class="small">First-time medalists in ${ds.latestComplete}: ${firstTimers.length ? firstTimers.map((b) => `<a href="${r}breweries/${b.slug}/">${esc(b.name)}</a>`).join(', ') : '<span class="muted">available once the latest year is completely loaded</span>'}.</p></div>
</div>
<h2>all-loaded-years</h2>
<div class="table-wrap">${tableHtml(cols, all)}</div>
${perYear.map((p) => `<h2>${p.year}${p.coverage === 'partial' ? ' <span class="pill partial">partial</span>' : ''}</h2><div class="table-wrap">${tableHtml([{ key: 'name', label: 'Brewery', render: (x) => `<a href="${r}breweries/${x.slug}/">${esc(x.name)}</a>` }, { key: 'points', label: 'Points', numeric: true }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'gsb', label: 'G / S / B', render: (x) => `${x.g} / ${x.s} / ${x.b}` }], p.list)}</div>`).join('')}`;
  reportLayout(ds, 'top-breweries', 'Top breweries', body);
}

function topCategories(ds, cats) {
  const r = '../../';
  const withEntries = cats.filter((c) => c.latest_entries).sort((a, b) => b.latest_entries - a.latest_entries);
  const bars = withEntries.slice(0, 15).map((c) => ({ label: c.name, value: c.latest_entries, href: `${r}categories/${c.slug}/` }));
  const families = countBy(ds.results, 'style_family').map(([label, value]) => ({ label, value }));
  const body = `
<p class="lede">Entry counts come from the category headers in the official list and show where competition is fiercest. Medal counts across categories are fixed at three per category per year, so family totals mostly reflect how many categories a family spans.</p>
<div class="grid two">
${withEntries.length ? figure({ id: 'most-entered', title: 'Most entered categories', subtitle: 'latest year with entry counts', svg: barsH({ items: bars, title: 'Most entered categories', labelWidth: 240 }), table: tableHtml([{ key: 'label', label: 'Category' }, { key: 'value', label: 'Entries', numeric: true }], bars, { className: 'data-table' }) }) : '<div class="card"><h2>most-entered-categories</h2><p class="muted">Appears once a full winners list with entry counts is ingested.</p></div>'}
${figure({ id: 'family-medals', title: 'Medals by style family', svg: barsH({ items: families, title: 'Medals by style family', color: 'var(--series-3)' }), table: tableHtml([{ key: 'label', label: 'Style family' }, { key: 'value', label: 'Medals', numeric: true }], families, { className: 'data-table' }) })}
</div>
<h2>all-categories</h2>
<div class="table-wrap">${tableHtml([{ key: 'name', label: 'Category', render: (c) => `<a href="${r}categories/${c.slug}/">${esc(c.name)}</a>` }, { key: 'style_family', label: 'Style family' }, { key: 'entries', label: 'Latest entries', numeric: true, render: (c) => fmt(c.latest_entries) }, { key: 'medals', label: 'Medals loaded', numeric: true, render: (c) => c.rows.length }, { key: 'abv', label: 'ABV (style)', render: (c) => (c.ref?.abv_min ? `${esc(c.ref.abv_min)} to ${esc(c.ref.abv_max)}%` : '') }], cats)}</div>`;
  reportLayout(ds, 'top-categories', 'Top categories', body);
}

function byState(ds) {
  const rows = ds.states.map((s) => {
    const medals = ds.results.filter((x) => x.state === s.state);
    const latest = medals.filter((x) => x.year === ds.latestComplete).length;
    const pop = Number(s.population_2020) || 0;
    return { ...s, medals: medals.length, latest, breweries: new Set(medals.map((m) => m.brewery_key)).size, gold: medals.filter((m) => m.medal === 'Gold').length, per_million: pop ? (medals.length / pop) * 1e6 : 0 };
  }).filter((s) => s.medals > 0).sort((a, b) => b.medals - a.medals);
  const bars = rows.slice(0, 20).map((s) => ({ label: s.name, value: s.medals, href: `../../#state=${s.state}` }));
  const perCap = [...rows].sort((a, b) => b.per_million - a.per_million).slice(0, 20).map((s) => ({ label: s.name, value: Number(s.per_million.toFixed(2)) }));
  const body = `
<p class="lede">Medals by state across all loaded years, with a population-adjusted rate (medals per million residents, 2020 Census). Click a state to open it in the explorer.</p>
<div class="grid two">
${figure({ id: 'state-medals', title: 'Medals by state', subtitle: 'top 20', svg: barsH({ items: bars, title: 'Medals by state' }), table: tableHtml([{ key: 'label', label: 'State' }, { key: 'value', label: 'Medals', numeric: true }], bars, { className: 'data-table' }) })}
${figure({ id: 'state-per-capita', title: 'Medals per million residents', subtitle: 'top 20, all loaded years', svg: barsH({ items: perCap, title: 'Medals per million residents', color: 'var(--series-3)', valueFormat: (v) => Number(v).toFixed(2) }), table: tableHtml([{ key: 'label', label: 'State' }, { key: 'value', label: 'Per million', numeric: true }], perCap, { className: 'data-table' }) })}
</div>
<h2>all-states</h2>
<div class="table-wrap">${tableHtml([{ key: 'name', label: 'State', render: (s) => `<a href="../../#state=${s.state}">${esc(s.name)}</a>` }, { key: 'region', label: 'Region' }, { key: 'division', label: 'Division' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'gold', label: 'Gold', numeric: true }, { key: 'latest', label: `${ds.latestComplete}`, numeric: true }, { key: 'breweries', label: 'Breweries', numeric: true }, { key: 'population_2020', label: 'Population 2020', numeric: true, render: (s) => fmt(s.population_2020) }, { key: 'per_million', label: 'Per million', numeric: true, render: (s) => s.per_million.toFixed(2) }], rows)}</div>`;
  reportLayout(ds, 'by-state', 'By state', body);
}

function byRegion(ds) {
  const roll = (key) => {
    const m = new Map();
    for (const x of ds.results) {
      const k = x[key] || '(unknown)';
      const cur = m.get(k) ?? { name: k, medals: 0, gold: 0, breweries: new Set(), states: new Set(), pop: 0 };
      cur.medals += 1; if (x.medal === 'Gold') cur.gold += 1; cur.breweries.add(x.brewery_key); cur.states.add(x.state);
      m.set(k, cur);
    }
    for (const cur of m.values()) {
      cur.pop = ds.states.filter((s) => s[key] === cur.name).reduce((sum, s) => sum + (Number(s.population_2020) || 0), 0);
      cur.per_million = cur.pop ? (cur.medals / cur.pop) * 1e6 : 0;
      cur.breweries = cur.breweries.size; cur.states = cur.states.size;
    }
    return [...m.values()].sort((a, b) => b.medals - a.medals);
  };
  const regions = roll('region');
  const divisions = roll('division');
  const cols = [{ key: 'name', label: 'Name' }, { key: 'medals', label: 'Medals', numeric: true }, { key: 'gold', label: 'Gold', numeric: true }, { key: 'breweries', label: 'Breweries', numeric: true }, { key: 'states', label: 'States', numeric: true }, { key: 'per_million', label: 'Per million', numeric: true, render: (x) => x.per_million.toFixed(2) }];
  const body = `
<p class="lede">Census regions (Northeast, Midwest, South, West) and their divisions, across all loaded years.</p>
<div class="grid two">
${figure({ id: 'region-medals', title: 'Medals by region', svg: barsH({ items: regions.map((x) => ({ label: x.name, value: x.medals })), title: 'Medals by region' }), table: tableHtml(cols, regions, { className: 'data-table' }) })}
${figure({ id: 'division-medals', title: 'Medals by division', svg: barsH({ items: divisions.map((x) => ({ label: x.name, value: x.medals })), title: 'Medals by division', color: 'var(--series-3)' }), table: tableHtml(cols, divisions, { className: 'data-table' }) })}
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
${figure({ id: 'ownership-type', title: 'Medals by ownership type', svg: barsH({ items: byType, title: 'Medals by ownership type', labelWidth: 230 }), table: tableHtml([{ key: 'label', label: 'Ownership type' }, { key: 'value', label: 'Medals', numeric: true }], byType, { className: 'data-table' }) })}
${parents.length ? figure({ id: 'parents', title: 'Medals by parent company', subtitle: 'non-independent owners', svg: barsH({ items: parents, title: 'Medals by parent', color: 'var(--series-2)', labelWidth: 230 }), table: tableHtml([{ key: 'label', label: 'Parent' }, { key: 'value', label: 'Medals', numeric: true }], parents, { className: 'data-table' }) }) : '<div class="card"><h2>parents</h2><p class="muted">No medalist in the loaded results is owned by a large brewer or conglomerate yet. This fills in as official lists are ingested.</p></div>'}
</div>
<h2>ownership-table</h2>
<p class="small muted">All curated rows, whether or not the brewery has medaled in the loaded years. Edit data/reference/ownership.csv to add deals, investors, and verification.</p>
<div class="table-wrap">${tableHtml([
    { key: 'brewery_name', label: 'Brewery', render: (o) => { const b = ds.breweries.find((x) => x.key === ds.breweries.find((y) => y.ownership === o)?.key); return b ? `<a href="${r}breweries/${b.slug}/">${esc(o.brewery_name)}</a>` : esc(o.brewery_name); } },
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

function trendsReport(ds) {
  const summary = ds.summary.filter((s) => s.competition === 'GABF').sort((a, b) => Number(a.year) - Number(b.year));
  const series = (key, label) => ({ label, points: summary.filter((s) => s[key]).map((s) => ({ x: s.year, y: Number(s[key]) })) });
  const entries = series('entries', 'Entries');
  const medals = series('medals', 'Medals awarded');
  const breweries = series('entering_breweries', 'Breweries entering');
  const familiesAll = countBy(ds.results, 'style_family').slice(0, 7).map(([k]) => k);
  const famSeries = [...familiesAll, 'Other'].map((f, i) => ({ key: f, label: f, color: SERIES_COLORS[i % 8] }));
  const famRows = ds.years.map((y) => {
    const rows = ds.results.filter((x) => x.year === y);
    const values = {};
    for (const f of famSeries) values[f.key] = 0;
    for (const x of rows) values[familiesAll.includes(x.style_family) ? x.style_family : 'Other'] += 1;
    return { x: String(y), values, status: rows.length ? (ds.coverage[y] === 'partial' ? 'no-data' : 'medaled') : (ds.coverage[y] === 'pending' ? 'not-yet-reported' : 'no-results') };
  });
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
${figure({ id: 'entries-trend', title: 'Entries judged', svg: lineChart({ series: [entries], title: 'Entries judged' }), table: tableHtml([{ key: 'x', label: 'Year' }, { key: 'y', label: 'Entries', numeric: true, render: (p) => fmt(p.y) }], entries.points, { className: 'data-table' }) })}
${figure({ id: 'medals-breweries-trend', title: 'Medals awarded and breweries entering', svg: lineChart({ series: [medals, breweries], title: 'Medals and breweries' }), legend: legendHtml([{ ...medals, color: SERIES_COLORS[0] }, { ...breweries, color: SERIES_COLORS[1] }], 'line'), table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'medals', label: 'Medals', numeric: true, render: (s) => fmt(s.medals) }, { key: 'entering_breweries', label: 'Breweries entering', numeric: true, render: (s) => fmt(s.entering_breweries) }], summary, { className: 'data-table' }) })}
</div>
${figure({ id: 'family-share', title: 'Medals by style family and year', subtitle: 'top seven families plus Other', svg: columnsStacked({ rows: famRows, series: famSeries, title: 'Style family by year', height: 300, labelMode: 'all' }), legend: legendHtml(famSeries), table: tableHtml([{ key: 'x', label: 'Year' }, ...famSeries.map((f) => ({ key: f.key, label: f.label, numeric: true, render: (row) => row.values[f.key] }))], famRows, { className: 'data-table' }) })}
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
<div class="table-wrap">${tableHtml([{ key: 'year', label: 'Year', numeric: true }, { key: 'award', label: 'Award' }, { key: 'bracket', label: 'Bracket' }, { key: 'brewery_name', label: 'Brewery', render: (a) => { const b = ds.breweries.find((x) => x.name === a.brewery_name || x.names?.includes?.(a.brewery_name)); return b ? `<a href="${r}breweries/${b.slug}/">${esc(a.brewery_printed)}</a>` : esc(a.brewery_printed); } }, { key: 'city', label: 'City', render: (a) => `${esc(a.city)}, ${esc(a.state)}` }, { key: 'source', label: 'Source', render: (a) => `<span class="small muted">${esc(a.source)}</span>` }], rows)}</div>
${rows.length < 8 ? '<p class="small muted">Only the awards confirmed so far are listed; the ingest adds the full set for each year from the official list.</p>' : ''}`;
  reportLayout(ds, 'brewery-of-the-year', 'Brewery of the Year', body);
}

// ---------- about ----------
function aboutPage(ds) {
  const rows = ds.years.map((y) => ({ year: y, status: ds.coverage[y], rows: ds.results.filter((x) => x.year === y).length, source: [...new Set(ds.results.filter((x) => x.year === y).map((x) => x.source))].join('; ') || (ds.summary.find((s) => Number(s.year) === y)?.source ?? '') }));
  const body = `
<h1>about-this-site</h1>
<p class="lede">An independent analysis of Great American Beer Festival competition results. It is built from public data by a static pipeline in <a href="${REPO_URL}">this repository</a> and published with GitHub Pages.</p>
<h2>coverage</h2>
<div class="table-wrap">${tableHtml([{ key: 'year', label: 'Year', numeric: true }, { key: 'status', label: 'Status', render: (x) => `<span class="pill ${x.status}">${esc(x.status)}</span>` }, { key: 'rows', label: 'Rows loaded', numeric: true }, { key: 'source', label: 'Sources', render: (x) => `<span class="small">${esc(x.source)}</span>` }], rows)}</div>
<p class="small">complete: the official winners list was ingested. partial: only seed rows from secondary sources are present. pending: the competition ran or is scheduled but no results are loaded.</p>
<h2>data-sources</h2>
<ul class="list-plain">
<li>Results: the Brewers Association's official GABF winners lists (PDF), parsed by scripts/parse-winners.mjs. Category names and entry counts come from the same lists.</li>
<li>Brewery locations, coordinates, type, and websites: <a href="https://www.openbrewerydb.org">Open Brewery DB</a> (free, open) plus curated overrides for breweries it does not cover.</li>
<li>Style definitions and ABV, IBU, and SRM ranges: Brewers Association Beer Style Guidelines, imported with scripts/import-style-guidelines.mjs. Until the current year's guidelines are imported, ranges are approximate.</li>
<li>Ownership and investors: curated from public acquisition and investment announcements (company releases, Brewbound, trade press). Each row carries a verified flag.</li>
<li>Demographics: 2020 Census resident population by state and Census regions and divisions.</li>
<li>Competition totals: Brewers Association annual releases.</li>
</ul>
<h2 id="estimates">estimates</h2>
<p>Production, volume, and revenue figures marked (E) are estimates. Order of preference: a reported figure, then a Brewery of the Year bracket (midpoint), then a curated estimate in data/reference/production.csv or a brewery profile, then a heuristic by brewery type and location count. Conversions use the US beer barrel (31 gallons): 13.78 cases of 24 twelve-ounce containers, 248 sixteen-ounce cans or pints, 330.7 twelve-ounce cans. Revenue blends on-premise and wholesale revenue per barrel by brewery type and adds food revenue per kitchen location. Parameters live in data/reference/estimation-parameters.json.</p>
<h2>trend-semantics</h2>
<p>A brewery's yearly trend distinguishes four states: medaled, no medal recorded, did not exist yet (year before its founding), and results not yet published. A year that is only partially loaded is labelled as such rather than counted as a miss.</p>
<h2>attribution</h2>
<p>Great American Beer Festival and GABF are trademarks of the Brewers Association. Style guideline content is used with attribution for non-commercial analysis. Open Brewery DB data is open. This site is not affiliated with the Brewers Association.</p>`;
  write('about/index.html', layout({ title: 'About', description: 'Data sources, coverage, and methods.', body, depth: 1, active: 'About' }));
}

// ---------- main ----------
export function build({ clean = true } = {}) {
  const ds = loadDataset();
  const cats = categoryIndex(ds);
  if (clean && existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(resolve(SITE, 'assets'), resolve(DIST, 'assets'), { recursive: true });
  writeFileSync(resolve(DIST, '.nojekyll'), '');
  writeData(ds, cats);
  explorerPage(ds);
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
  trendsReport(ds);
  botyReport(ds);
  aboutPage(ds);
  return { pages: countFiles(DIST, '.html'), breweries: ds.breweries.length, categories: cats.length, results: ds.results.length, years: ds.years };
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
  console.log(`built ${r.pages} pages for ${r.results} medal rows, ${r.breweries} breweries, ${r.categories} categories, years ${r.years.join(', ')} -> ${DIST}`);
}
