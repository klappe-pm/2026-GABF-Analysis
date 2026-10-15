// Page views: the filterable part of every data page, rendered from medal rows. The build calls
// these with the default selection (complete years) to write the HTML, and app.mjs calls the same
// functions in the browser whenever the global filter changes, so the two can never disagree.
// Each view takes (rows, ctx): rows already narrowed to the page scope and the global filter;
// ctx carries the relative root r, meta, the filter state, and page data.

import { compact, countBy, esc, figure, gsbColumn, gsbHtml, humanizeHeadings, statTile, statusLabel, statusShort, tableHtml } from './charts.mjs';
import { barsHOption, lineOption, mapOption, MEDAL_COLORS, SERIES_COLORS, stackedColumnsOption } from './chart-options.mjs';
import { medalRates } from './rates.mjs';
import { emptyStateHtml, includesPartial, partialNoticeHtml, valueLabel } from './filter-bar.mjs';
import { estMark } from './estimates.mjs';
import { compareLabels } from './sort-order.mjs';
import { hopCopy, hopLinksHtml, hopSlug } from './hop-links.mjs';
import { beerCardsHtml } from './profile-cards.mjs';
import { NOT_FOUND_HTML } from './not-found.mjs';
import { tx } from './site-text.mjs';

const fmt = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-US'));
const usd = (n) => `$${compact(n)}`;
const pct = (num, den) => (den ? `${((100 * num) / den).toFixed(1)}%` : '');
const pctOf = (x) => `${Math.round(Number(x) * 100)}%`;
const RANK = { Gold: 1, Silver: 2, Bronze: 3 };
const byNewest = (a, b) => b.year - a.year || (RANK[a.medal] ?? 9) - (RANK[b.medal] ?? 9);
const items = (pairs) => pairs.map(([label, value]) => ({ label, value }));
const mapped = (rows, id) => rows.map((r) => ({ ...r, [id]: valueLabel(id, r[id]) }));

export function medalDot(m) {
  return `<span class="badge-medal ${String(m).toLowerCase()}" aria-hidden="true"></span>${esc(m)}`;
}

// Years a chart should show: every loaded year, minus partial years unless they are in view.
export function yearsInView(meta, state = {}) {
  if (state.year) return [Number(state.year)];
  return (meta?.years ?? []).filter((y) => includesPartial(state) || meta.coverage?.[y] !== 'partial');
}

// Reader note for a medal row: the only notes in the data mark partial year samples.
export const noteFor = (x) => (x.partial ? 'From a partial year sample' : '');

// Entries per medal: the field a medal was won against, from the official category headers.
export const entriesPerMedal = (r) => (r.entries && r.category_medals ? r.entries / r.category_medals : null);

// The beer's own published figures. A missing value reads Not Found; the style range is never
// used here.
export const NOT_DEFINED_HTML = NOT_FOUND_HTML;
const hasNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
// A current published value (not the medal year's figure) carries its note and source link.
export const specNoteHtml = (x, url) => (x.spec_note ? ` <span class="muted small">(${url ? `<a href="${esc(url)}" rel="noopener">${esc(x.spec_note)}</a>` : esc(x.spec_note)})</span>` : '');
export const abvCell = (x) => (hasNum(x.abv) ? `${esc(Number(x.abv).toFixed(1).replace(/\.0$/, ''))}%${specNoteHtml(x, x.abv_source)}` : NOT_DEFINED_HTML);
export const ibuCell = (x) => (hasNum(x.ibu) ? `${esc(String(Number(x.ibu)))}${specNoteHtml(x, x.ibu_source)}` : NOT_DEFINED_HTML);
const profileCell = (x, r) => (x.beer_profile ? `<a href="${r}${esc(x.beer_profile)}">Full Profile</a>` : NOT_DEFINED_HTML);

// compact: drop columns whose value is the same on every row and columns empty on every row.
// The Notes column is dropped whenever it is empty.
export function medalTable(rows, { r, showYear = true, showBrewery = false, compact: compactCols = false, odds = false, meta = null } = {}) {
  const hc = hopCopy(meta);
  let cols = [];
  if (showYear) cols.push({ key: 'year', label: tx('global.tables.medal_columns.year', 'Year'), numeric: true });
  cols.push({ key: 'medal', label: tx('global.tables.medal_columns.medal', 'Medal'), render: (x) => medalDot(x.medal) });
  cols.push({ key: 'beer_name', label: tx('global.tables.medal_columns.beer', 'Beer'), render: (x) => (x.beer_profile ? `<a href="${r}${esc(x.beer_profile)}">${esc(x.beer_name)}</a>` : esc(x.beer_name)) });
  cols.push({ key: 'abv', label: tx('global.tables.medal_columns.abv', 'ABV'), numeric: true, keep: true, render: abvCell });
  cols.push({ key: 'ibu', label: 'IBU', numeric: true, keep: true, render: ibuCell });
  // Only 2026 beers carry hops; the column is dropped below when no row in view has any.
  cols.push({ key: 'hop_varieties', label: hc.column, hops: true, render: (x) => hopLinksHtml(x.hop_varieties, { r, none: hc.none }) });
  if (showBrewery) cols.push({ key: 'brewery_name', label: tx('global.tables.medal_columns.brewery', 'Brewery'), render: (x) => `<a href="${r}breweries/${esc(x.brewery_slug)}/">${esc(x.brewery_name)}</a>${x.brewery_location ? ` <span class="muted small">(${esc(x.brewery_location)})</span>` : ''}` });
  else cols.push({ key: 'brewery_location', label: tx('global.tables.medal_columns.location_credited', 'Location Credited'), render: (x) => esc(x.brewery_location || x.city) });
  cols.push({ key: 'city', label: tx('global.tables.medal_columns.city', 'City'), render: (x) => `${esc(x.city)}, ${esc(x.state)}` });
  cols.push({ key: 'category_name', label: tx('global.tables.medal_columns.category', 'Category'), droppable: true, render: (x) => `<a href="${r}categories/${esc(x.category_slug)}/">${esc(x.category_name)}</a>${x.special ? ' <span class="pill">special</span>' : ''}` });
  cols.push({ key: 'entries', label: odds ? tx('global.tables.medal_columns.field', 'Field (Entries)') : tx('global.tables.medal_columns.entrants', 'Entrants'), numeric: true, droppable: true, render: (x) => (x.entries ? fmt(x.entries) : '') });
  if (odds) cols.push({ key: 'odds', label: tx('global.tables.medal_columns.entries_per_medal', 'Entries per Medal'), numeric: true, render: (x) => { const e = entriesPerMedal(x); return e ? e.toFixed(1) : ''; } });
  cols.push({ key: 'style_family', label: tx('global.tables.medal_columns.style_family', 'Style Family'), droppable: true });
  cols.push({ key: 'beer_profile', label: 'Beer Profile', keep: true, render: (x) => profileCell(x, r) });
  cols.push({ key: 'notes', label: tx('global.tables.medal_columns.notes', 'Notes'), render: (x) => `<span class="small muted">${esc(noteFor(x))}</span>` });
  const values = (c) => new Set(rows.map((x) => String(c.key === 'odds' ? (entriesPerMedal(x) ?? '') : c.key === 'notes' ? noteFor(x) : (x[c.key] ?? '')).trim()));
  cols = cols.filter((c) => {
    const v = values(c);
    if (v.size === 1 && v.has('') && !c.keep && (c.key === 'notes' || c.key === 'odds' || c.hops || compactCols)) return false;
    return !(compactCols && c.droppable && v.size === 1);
  });
  return `<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml(cols, rows)}</div>`;
}

function barsFigure(id, title, list, { subtitle = '', color, labelWidth = 200, valueName = 'Medals', note = '', labelHeader = 'Name' } = {}) {
  return figure({ id, title, subtitle, height: Math.max(200, 34 * list.length + 60), option: barsHOption({ items: list, color, labelWidth, valueName, saveName: id }), note, table: tableHtml([{ key: 'label', label: labelHeader }, { key: 'value', label: valueName, numeric: true }], list, { className: 'data-table' }) });
}

function medalsByYearFigure(id, rows, years, notes, { subtitle = '', saveName = id } = {}) {
  const data = years.map((y) => ({ year: y, gold: rows.filter((x) => x.year === y && x.medal === 'Gold').length, silver: rows.filter((x) => x.year === y && x.medal === 'Silver').length, bronze: rows.filter((x) => x.year === y && x.medal === 'Bronze').length, note: notes[y] ?? '' }));
  return figure({ id, title: tx('pages.brewery-detail.charts.by_year_title', 'Medals by Year'), subtitle, height: 280, option: stackedColumnsOption({ labels: years, notes: data.map((d) => d.note), series: [{ name: 'Gold', data: data.map((d) => d.gold), color: MEDAL_COLORS.Gold }, { name: 'Silver', data: data.map((d) => d.silver), color: MEDAL_COLORS.Silver }, { name: 'Bronze', data: data.map((d) => d.bronze), color: MEDAL_COLORS.Bronze }], saveName }), table: tableHtml([{ key: 'year', label: 'Year' }, gsbColumn((d) => [d.gold, d.silver, d.bronze]), { key: 'note', label: 'Status' }], data, { className: 'data-table' }) });
}

const medalSplit = (rows) => ['Gold', 'Silver', 'Bronze'].map((m) => rows.filter((x) => x.medal === m).length);

// ---------- brewery page ----------
function breweryView(rows, ctx) {
  const { r, meta, state, page } = ctx;
  const b = page.brewery;
  const years = yearsInView(meta, state);
  const statusOf = Object.fromEntries((b.trend ?? []).map((t) => [t.year, t.status]));
  const notes = Object.fromEntries(years.map((y) => [y, statusOf[y] ? statusShort(statusOf[y]) : '']));
  const cats = new Set(rows.map((m) => m.category_name)).size;
  const first = rows.length ? Math.min(...rows.map((m) => m.year)) : null;
  const stats = [
    statTile({ label: tx('pages.brewery-detail.stats.medals', 'Medals in View'), value: String(rows.length) }),
    statTile({ label: tx('pages.brewery-detail.stats.medal_split', 'Gold, Silver, Bronze'), medals: medalSplit(rows) }),
    statTile({ label: tx('pages.brewery-detail.stats.first_medal', 'First Medal in View'), value: first ? String(first) : tx('pages.brewery-detail.stats.first_medal_none', 'None') }),
    statTile({ label: tx('pages.brewery-detail.stats.categories', 'Categories Medaled'), value: String(cats), note: tx('pages.brewery-detail.stats.categories_note', '{{count}} in special categories', { count: rows.filter((m) => m.special).length }) }),
    statTile({ label: b.basis === 'reported' ? tx('pages.brewery-detail.scale.barrels', 'Barrels per year') : tx('pages.brewery-detail.stats.barrels', 'Estimated Barrels per Year'), value: compact(b.barrels), mark: b.basis === 'reported' ? '' : estMark(b.key, 'barrels'), note: b.basis === 'reported' ? tx('pages.brewery-detail.stats.barrels_note_reported', 'Reported') : tx('pages.brewery-detail.stats.barrels_note_estimate', 'Estimate (E)') }),
    statTile({ label: tx('pages.brewery-detail.stats.arr', 'Estimated ARR'), value: usd(b.arr), mark: estMark(b.key, 'arr'), note: tx('pages.brewery-detail.stats.arr_note', 'EBITDA {{ebitda}} at {{margin}} (E)', { ebitda: usd(b.ebitda), margin: pctOf(b.ebitda_margin) }) }),
  ].join('');
  const byFamily = items(countBy(rows, 'style_family'));
  const byLocation = items(countBy(rows.map((m) => ({ loc: m.brewery_location || m.city })), 'loc'));
  const byCategory = countBy(rows, 'category_name').map(([label, value]) => ({ label, value, href: `${r}categories/${rows.find((m) => m.category_name === label).category_slug}/` }));
  const figs = [
    medalsByYearFigure('medals-by-year', rows, years, notes, { subtitle: tx('pages.brewery-detail.charts.by_year_subtitle', '{{brewery_name}}, {{first_year}} to {{last_year}}', { brewery_name: b.name, first_year: years[0], last_year: years[years.length - 1] }), saveName: `${b.slug}-medals-by-year` }),
    barsFigure('medals-by-style-family', tx('pages.brewery-detail.charts.by_family_title', 'Medals by Style Family'), byFamily, { color: 'var(--series-3)', labelWidth: 170, labelHeader: tx('global.tables.medal_columns.style_family', 'Style Family') }),
  ];
  if (byLocation.length > 1) figs.push(barsFigure('medals-by-location', tx('pages.brewery-detail.charts.by_location_title', 'Medals by Location Credited'), byLocation, { subtitle: tx('pages.brewery-detail.charts.by_location_subtitle', 'As Printed in the Winners List'), color: 'var(--series-2)', labelWidth: 170, labelHeader: 'Location' }));
  if (byCategory.length > 1) figs.push(barsFigure('medals-by-category', tx('pages.brewery-detail.charts.by_category_title', 'Medals by Category'), byCategory.slice(0, 15), { labelWidth: 240, labelHeader: tx('global.tables.medal_columns.category', 'Category') }));
  const byYear = [...years].reverse().map((y) => {
    const ms = rows.filter((m) => m.year === y);
    return { year: y, medals: ms.length, split: medalSplit(ms), status: ms.length ? '' : (statusOf[y] ? statusLabel(statusOf[y]) : 'No medal in view') };
  });
  const recent = tableHtml([{ key: 'year', label: 'Year', numeric: true }, { key: 'medals', label: 'Medals', numeric: true }, gsbColumn((x) => x.split), { key: 'status', label: 'Note', render: (x) => `<span class="muted small">${esc(x.status)}</span>` }], byYear);
  return `<div class="stats">${stats}</div>
<div class="grid">${figs.join('')}</div>
<h2>medals-by-year</h2>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${recent}</div>
${hopsUsedHtml(rows, { r, meta })}
<h2>gabf-medal-history</h2>
<p class="small muted">Field is the number of entries in the category that year, from the official list; entries per medal divides it by the medals awarded there.</p>
${medalTable([...rows].sort(byNewest), { r, odds: true, meta })}
${beerCardsHtml(rows, { r, meta })}`;
}

// The hops used across a set of medal beers, one row per variety, each linking to its page.
export function hopsUsedHtml(rows, { r, meta }) {
  const hc = hopCopy(meta);
  const tally = new Map();
  for (const x of rows) for (const name of x.hop_varieties ?? []) tally.set(name, (tally.get(name) ?? 0) + 1);
  if (!tally.size) return '';
  const list = [...tally.entries()].map(([name, beers]) => ({ name, beers })).sort((a, b) => b.beers - a.beers || compareLabels(a.name, b.name));
  const table = tableHtml([
    { key: 'name', label: hc.brewery_variety, render: (x) => `<a href="${r}hops/${esc(hopSlug(x.name))}/">${esc(x.name)}</a>` },
    { key: 'beers', label: hc.brewery_beers, numeric: true },
  ], list);
  const wrapTable = (t) => `<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${t}</div>`;
  // Farms reached by these beers, kept apart: the ones a brewery named, and the ones that grow a variety used.
  const farmSlugs = meta?.hop_farm_slugs ?? {};
  const farmTable = (field, title, label, note) => {
    const counts = new Map();
    for (const x of rows) for (const name of x[field] ?? []) if (farmSlugs[name]) counts.set(name, (counts.get(name) ?? 0) + 1);
    if (!counts.size) return '';
    const farms = [...counts.entries()].map(([name, beers]) => ({ name, beers })).sort((a, b) => b.beers - a.beers || compareLabels(a.name, b.name));
    return `<h3>${esc(title)}</h3><p class="small muted"><strong>${esc(label)}</strong> ${esc(note)}</p>${wrapTable(tableHtml([
      { key: 'name', label: hc.brewery_farm, render: (x) => `<a href="${r}hop-farms/${esc(farmSlugs[x.name])}/">${esc(x.name)}</a>` },
      { key: 'beers', label: hc.brewery_beers, numeric: true },
    ], farms))}`;
  };
  const farms = farmTable('hop_farms_named', hc.brewery_farms_named_title, hc.brewery_farms_named_label, hc.brewery_farms_named_note) + farmTable('hop_farms_grown', hc.brewery_farms_grown_title, hc.brewery_farms_grown_label, hc.brewery_farms_grown_note);
  return `<h2>${esc(hc.brewery_title)}</h2><p class="small muted">${esc(hc.brewery_note)}</p>${wrapTable(table)}${farms}`;
}

// ---------- category page ----------
function categoryView(rows, ctx) {
  const { r, page, meta } = ctx;
  const perYear = new Map();
  for (const x of rows) if (!perYear.has(x.year)) perYear.set(x.year, { year: x.year, entries: x.entries, number: x.category_number, medals: [] });
  for (const x of rows) perYear.get(x.year).medals.push(x);
  const list = [...perYear.values()].sort((a, b) => a.year - b.year);
  const withEntries = list.filter((y) => y.entries);
  const chart = withEntries.length > 1
    ? figure({ id: 'entries-by-year', title: tx('pages.category-detail.entrants.title', 'Entrants by Year'), subtitle: tx('pages.category-detail.entrants.subtitle', 'How Crowded the Category Is'), height: 260, option: lineOption({ labels: withEntries.map((y) => y.year), series: [{ name: tx('pages.category-detail.entrants.series', 'Entries'), data: withEntries.map((y) => y.entries), color: SERIES_COLORS[0] }], saveName: `${page.slug}-entries` }), table: tableHtml([{ key: 'year', label: tx('global.tables.medal_columns.year', 'Year') }, { key: 'entries', label: tx('pages.category-detail.entrants.series', 'Entries'), numeric: true }], withEntries, { className: 'data-table' }) })
    : `<div class="card"><h2>entrants</h2><p class="muted">${esc(withEntries.length === 1 ? tx('pages.category-detail.entrants.one_year', '{{count}} entries in {{year}}. A trend needs a second year with entry counts in view.', { count: fmt(withEntries[0].entries), year: withEntries[0].year }) : tx('pages.category-detail.entrants.none', 'No entry counts in view for this category.'))}</p></div>`;
  const yearHeading = (y) => (y.number && y.entries
    ? tx('pages.category-detail.medalists.year_heading_entrants', '{{year}} · Category {{number}} · {{count}} Entrants', { year: y.year, number: y.number, count: fmt(y.entries) })
    : y.number ? tx('pages.category-detail.medalists.year_heading_number', '{{year}} · Category {{number}}', { year: y.year, number: y.number })
      : `${y.year}${y.entries ? ` · ${fmt(y.entries)} Entrants` : ''}`);
  return `${chart}
<h2>medalists-by-year</h2>
${[...list].reverse().map((y) => `<h3>${esc(yearHeading(y))}</h3>${medalTable(y.medals.sort(byNewest), { r, showYear: false, showBrewery: true, compact: true, meta })}`).join('')}
${beerCardsHtml(rows, { r, meta })}`;
}

// ---------- 2026 winners index ----------
const isBlank = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const abvText = (v) => (isBlank(v) ? '' : `${Number(v).toFixed(1).replace(/\.0$/, '')}%`);

function winnersView(rows, ctx) {
  const { page } = ctx;
  const specs = page.specs;
  const list = rows.filter((x) => x.beer_profile && specs[x.beer_profile]);
  const n = list.length;
  const count = (f) => list.filter((x) => f(specs[x.beer_profile])).length;
  const tile = (label, k) => statTile({ label, value: String(k), note: tx('pages.beers-index.stats.share_note', '{{count}} of {{total}}', { count: k, total: n }) });
  const stats = [
    statTile({ label: tx('pages.beers-index.stats.medals', 'Medals in View'), value: String(n), note: tx('pages.beers-index.stats.medals_note', '{{count}} categories', { count: new Set(list.map((x) => x.category_name)).size }) }),
    tile(tx('pages.beers-index.stats.abv', 'ABV Published'), count((s) => !isBlank(s.abv))),
    tile(tx('pages.beers-index.stats.ibu', 'IBU Published'), count((s) => !isBlank(s.ibu))),
    tile(tx('pages.beers-index.stats.hops', 'Hops Named'), count((s) => !isBlank(s.hops))),
    tile(tx('pages.beers-index.stats.beer_page', 'Brewery Beer Page Found'), count((s) => !isBlank(s.beer_url))),
  ].join('');
  const groups = new Map();
  for (const x of list) {
    const k = Number(x.category_number);
    if (!groups.has(k)) groups.set(k, { number: k, name: x.category_name, entries: x.entries, rows: [] });
    groups.get(k).rows.push(x);
  }
  const h = {
    medal: tx('pages.beers-index.table.medal', 'Medal'), beer: tx('pages.beers-index.table.beer', 'Beer'), brewery: tx('pages.beers-index.table.brewery', 'Brewery'),
    abv: tx('pages.beers-index.table.abv', 'ABV'), ibu: tx('pages.beers-index.table.ibu', 'IBU'), hops: tx('pages.beers-index.table.hops', 'Hops'),
  };
  const unpublished = `<span class="muted">${esc(tx('pages.beers-index.table.not_published', 'Not Published'))}</span>`;
  const head = `<thead><tr><th scope="col">${esc(h.medal)}</th><th scope="col">${esc(h.beer)}</th><th scope="col">${esc(h.brewery)}</th><th scope="col" class="num">${esc(h.abv)}</th><th scope="col" class="num">${esc(h.ibu)}</th><th scope="col">${esc(h.hops)}</th></tr></thead>`;
  const bodies = [...groups.values()].sort((a, b) => a.number - b.number).map((g) => `<tbody>
<tr class="group-row"><th colspan="6" scope="colgroup">${esc(tx('pages.beers-index.table.group_row', '{{number}}. {{category_name}}', { number: g.number, category_name: g.name }))}${g.entries ? ` <span class="muted small">${esc(tx('pages.beers-index.table.group_entries', '{{count}} Entries', { count: fmt(g.entries) }))}</span>` : ''}</th></tr>
${g.rows.sort(byNewest).map((x) => {
    const s = specs[x.beer_profile];
    return `<tr><td data-label="${esc(h.medal)}">${medalDot(x.medal)}</td><td data-label="${esc(h.beer)}"><a href="${ctx.r}${esc(x.beer_profile)}">${esc(x.beer_name)}</a></td><td data-label="${esc(h.brewery)}"><a href="${ctx.r}breweries/${esc(x.brewery_slug)}/">${esc(x.brewery_name)}</a> <span class="muted small">${esc(x.city)}, ${esc(x.state)}</span></td><td class="num" data-label="${esc(h.abv)}">${isBlank(s.abv) ? unpublished : esc(abvText(s.abv))}</td><td class="num" data-label="${esc(h.ibu)}">${isBlank(s.ibu) ? unpublished : esc(s.ibu)}</td><td class="small" data-label="${esc(h.hops)}">${isBlank(s.hops) ? unpublished : hopLinksHtml(s.hops, { r: ctx.r })}</td></tr>`;
  }).join('')}
</tbody>`).join('');
  return `<div class="stats">${stats}</div>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap winners-table"><table class="data-table">${head}${bodies}</table></div>
${beerCardsHtml(list, { r: ctx.r, meta: ctx.meta })}`;
}

// ---------- first time medalists ----------
function firstTimeView(rows, ctx) {
  const { r, page } = ctx;
  const year = page.year;
  const fresh = rows.filter((x) => x.first_time === 'new');
  const complete = rows.filter((x) => x.first_time === 'new-complete');
  const breweries = new Set(fresh.map((x) => x.brewery_key));
  const [g] = medalSplit(fresh);
  const stats = [
    statTile({ label: tx('pages.first-time-medalists.stats.breweries', 'First Time Medalists'), value: String(breweries.size), note: tx('pages.first-time-medalists.stats.breweries_note', 'No medal in the record before {{year}}', { year }) }),
    statTile({ label: tx('pages.first-time-medalists.stats.share', 'Share of {{year}} Medals in View', { year }), value: pct(fresh.length, rows.length) || '0%', note: tx('pages.first-time-medalists.stats.share_note', '{{count}} of {{total}} medals', { count: fresh.length, total: rows.length }) }),
    statTile({ label: tx('pages.first-time-medalists.stats.golds', 'Golds Among Them'), value: String(g), note: tx('pages.first-time-medalists.stats.golds_note', '{{share}} of their medals', { share: pct(g, fresh.length) || '0%' }) }),
    statTile({ label: tx('pages.first-time-medalists.stats.split', 'Their Gold, Silver, Bronze'), medals: medalSplit(fresh) }),
    statTile({ label: tx('pages.first-time-medalists.stats.complete', 'First in the Complete Record'), value: String(new Set(complete.map((x) => x.brewery_key)).size), note: tx('pages.first-time-medalists.stats.complete_note', 'Earlier medals only in partial years') }),
  ].join('');
  const stateItems = countBy(fresh, 'state_name').slice(0, 20).map(([label, value]) => ({ label, value }));
  const district = items(countBy(fresh, 'fed_district_name'));
  const family = items(countBy(fresh, 'style_family'));
  const medals = ['Gold', 'Silver', 'Bronze'].map((m) => ({ label: m, value: fresh.filter((x) => x.medal === m).length }));
  const charts = fresh.length ? `<div class="grid">
${barsFigure('first-time-by-state', tx('pages.first-time-medalists.charts.by_state_title', 'By State'), stateItems, { subtitle: tx('pages.first-time-medalists.charts.by_state_subtitle', 'Medals Won by First Time Medalists, Top 20'), labelHeader: 'State', labelWidth: 150 })}
${barsFigure('first-time-by-district', tx('pages.first-time-medalists.charts.by_district_title', 'By Fed District'), district, { subtitle: tx('pages.first-time-medalists.charts.by_district_subtitle', 'Federal Reserve District of the Medal City'), color: 'var(--series-1)', labelHeader: 'District', labelWidth: 150 })}
${barsFigure('first-time-by-family', tx('pages.first-time-medalists.charts.by_family_title', 'By Style Family'), family, { color: 'var(--series-3)', labelHeader: tx('global.tables.medal_columns.style_family', 'Style Family'), labelWidth: 170 })}
${barsFigure('first-time-by-medal', tx('pages.first-time-medalists.charts.by_medal_title', 'By Medal'), medals, { color: 'var(--series-4)', labelHeader: tx('global.tables.medal_columns.medal', 'Medal'), labelWidth: 80 })}
</div>` : '';
  const table = (list) => {
    const byB = new Map();
    for (const x of list) { if (!byB.has(x.brewery_key)) byB.set(x.brewery_key, []); byB.get(x.brewery_key).push(x); }
    const out = [...byB.values()].sort((a, b) => b.length - a.length || a[0].brewery_name.localeCompare(b[0].brewery_name));
    const t = {
      brewery: tx('pages.first-time-medalists.table.brewery', 'Brewery'), medal: tx('pages.first-time-medalists.table.medal', 'Medal'), beer: tx('pages.first-time-medalists.table.beer', 'Beer'),
      abv: tx('pages.first-time-medalists.table.abv', 'ABV'), ibu: tx('pages.first-time-medalists.table.ibu', 'IBU'), profile: tx('pages.first-time-medalists.table.beer_profile', 'Beer Profile'),
      category: tx('pages.first-time-medalists.table.category', 'Category'), beaten: tx('pages.first-time-medalists.table.entries_beaten', 'Entries Beaten'),
    };
    return `<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap"><table class="data-table"><thead><tr><th scope="col">${esc(t.brewery)}</th><th scope="col">${esc(t.medal)}</th><th scope="col">${esc(t.beer)}</th><th scope="col" class="num">${esc(t.abv)}</th><th scope="col" class="num">${esc(t.ibu)}</th><th scope="col">${esc(t.profile)}</th><th scope="col">${esc(t.category)}</th><th scope="col" class="num">${esc(t.beaten)}</th></tr></thead><tbody>${out.map((ms) => ms.sort(byNewest).map((x, i) => `<tr>${i === 0 ? `<td data-label="Brewery" rowspan="${ms.length}"><a href="${r}breweries/${esc(x.brewery_slug)}/">${esc(x.brewery_name)}</a> <span class="muted small">${esc(x.city)}, ${esc(x.state)}</span></td>` : ''}<td data-label="Medal">${medalDot(x.medal)}</td><td data-label="Beer">${x.beer_profile ? `<a href="${r}${esc(x.beer_profile)}">${esc(x.beer_name)}</a>` : esc(x.beer_name)}</td><td class="num" data-label="ABV">${abvCell(x)}</td><td class="num" data-label="IBU">${ibuCell(x)}</td><td data-label="Beer profile">${profileCell(x, r)}</td><td data-label="Category"><a href="${r}categories/${esc(x.category_slug)}/">${esc(x.category_name)}</a></td><td class="num" data-label="Entries beaten">${x.entries ? fmt(Math.max(0, x.entries - 1)) : '<span class="muted">not published</span>'}</td></tr>`).join('')).join('')}</tbody></table></div>`;
  };
  return `<div class="stats">${stats}</div>
${charts}
<h2>first-time-medalists</h2>
${fresh.length ? table(fresh) : `<p class="muted">${esc(tx('pages.first-time-medalists.table.empty', 'No first time medalist in view.'))}</p>`}
<h2>first-in-the-complete-record</h2>
<p class="small muted">${esc(tx('pages.first-time-medalists.complete_record.note', 'These breweries medaled in {{year}} and earlier only in partial years ({{partial_years}}), which hold a sample of medals, not the official lists. Counting only the complete lists ({{complete_range}}), they are first time medalists.', { year, partial_years: page.partialYears.join(' and '), complete_range: page.completeRange }))}</p>
${complete.length ? table(complete) : `<p class="muted">${esc(tx('pages.first-time-medalists.complete_record.empty', 'None in view.'))}</p>`}`;
}

// ---------- indexes ----------
function breweriesIndexView(rows, ctx) {
  const { r, page } = ctx;
  const info = page.breweries;
  const agg = new Map();
  for (const x of rows) {
    const cur = agg.get(x.brewery_key) ?? { key: x.brewery_key, slug: x.brewery_slug, name: x.brewery_name, medals: 0, points: 0, g: 0, s: 0, b: 0, first: x.year, last: x.year };
    cur.medals += 1; cur.points += x.points; if (x.medal === 'Gold') cur.g += 1; if (x.medal === 'Silver') cur.s += 1; if (x.medal === 'Bronze') cur.b += 1;
    cur.first = Math.min(cur.first, x.year); cur.last = Math.max(cur.last, x.year);
    agg.set(x.brewery_key, cur);
  }
  const list = [...agg.values()].map((a) => ({ ...a, ...(info[a.key] ?? {}), slug: info[a.key]?.slug ?? a.slug, name: info[a.key]?.name ?? a.name })).sort((a, b) => b.points - a.points || b.medals - a.medals || a.name.localeCompare(b.name));
  const cols = [
    { key: 'name', label: tx('global.tables.brewery_columns.brewery', 'Brewery'), render: (b) => `<a href="${r}breweries/${esc(b.slug)}/">${esc(b.name)}</a>${b.deep_dive ? ` <span class="pill good">${esc(tx('pages.breweries-index.table.deep_dive_pill', 'Deep Dive'))}</span>` : ''}` },
    { key: 'hq', label: tx('global.tables.brewery_columns.hq', 'Headquarters'), render: (b) => esc(b.hq ?? '') },
    { key: 'brewery_type', label: tx('global.tables.brewery_columns.type', 'Type'), render: (b) => esc(valueLabel('brewery_type', b.brewery_type)) },
    { key: 'medals', label: tx('global.tables.brewery_columns.medals', 'Medals'), numeric: true },
    gsbColumn((b) => [b.g, b.s, b.b]),
    { key: 'points', label: tx('global.tables.brewery_columns.points', 'Points'), numeric: true },
    { key: 'first', label: tx('global.tables.brewery_columns.first', 'First Medal'), numeric: true },
    { key: 'last', label: tx('global.tables.brewery_columns.latest', 'Latest Medal'), numeric: true },
    { key: 'ownership', label: tx('global.tables.brewery_columns.ownership', 'Ownership'), render: (b) => esc(valueLabel('ownership_type', b.ownership_type || 'unlisted')) },
    { key: 'arr', label: 'ARR (E)', numeric: true, sortValue: (b) => b.arr ?? 0, cellClass: 'est-cell', render: (b) => (b.arr ? `${usd(b.arr)} ${estMark(b.key, 'arr')}` : '') },
  ];
  const count = list.length === 1
    ? tx('pages.breweries-index.table.count_one', '1 brewery with medals in view. Select a column header to sort.')
    : tx('pages.breweries-index.table.count', '{{count}} breweries with medals in view. Select a column header to sort.', { count: list.length.toLocaleString('en-US') });
  return `<p class="small muted">${esc(count)}</p><div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml(cols, list)}</div>`;
}

function categoriesIndexView(rows, ctx) {
  const { r } = ctx;
  const families = items(countBy(rows, 'style_family'));
  const agg = new Map();
  for (const x of rows) {
    const cur = agg.get(x.category_name) ?? { name: x.category_name, slug: x.category_slug, special: x.special, style_family: x.style_family, abv_min: x.abv_min, abv_max: x.abv_max, medals: 0, years: new Set(), latest: null, latestYear: null };
    cur.medals += 1; cur.years.add(x.year);
    if (x.entries && (!cur.latestYear || x.year > cur.latestYear)) { cur.latest = x.entries; cur.latestYear = x.year; }
    agg.set(x.category_name, cur);
  }
  const list = [...agg.values()].sort((a, b) => compareLabels(a.name, b.name));
  const cols = [
    { key: 'name', label: tx('global.tables.category_columns.category', 'Category'), render: (c) => `<a href="${r}categories/${esc(c.slug)}/">${esc(c.name)}</a>` },
    { key: 'type', label: tx('global.tables.category_columns.type', 'Type'), render: (c) => (c.special ? `<span class="pill warn">${esc(tx('global.labels.category_pill.special_short', 'Special'))}</span>` : `<span class="pill good">${esc(tx('global.labels.category_pill.classic_short', 'Classic'))}</span>`) },
    { key: 'style_family', label: tx('global.tables.category_columns.style_family', 'Style Family') },
    { key: 'abv', label: tx('global.tables.category_columns.abv', 'ABV (Style Range)'), render: (c) => (c.abv_min ? esc(tx('global.tables.category_columns.abv_value', '{{min}} to {{max}}%', { min: c.abv_min, max: c.abv_max })) : '') },
    { key: 'entries', label: tx('global.tables.category_columns.latest_entrants', 'Latest Entrants'), numeric: true, render: (c) => fmt(c.latest) },
    { key: 'medals', label: tx('global.tables.category_columns.medals_in_view', 'Medals in View'), numeric: true },
    { key: 'years', label: tx('global.tables.category_columns.years', 'Years'), render: (c) => [...c.years].sort().join(', ') },
  ];
  return `<div class="grid">${barsFigure('medals-by-family', tx('pages.results-by-category.chart.title', 'Medals by Style Family'), families, { subtitle: tx('pages.results-by-category.chart.subtitle', 'Medals in View'), color: 'var(--series-3)', labelHeader: tx('global.tables.category_columns.style_family', 'Style Family') })}</div>
<h2>all-categories</h2>
<p class="small muted">${esc(tx('pages.results-by-category.table.count', '{{count}} categories with medals in view.', { count: list.length }))}</p>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml(cols, list)}</div>`;
}

// ---------- reports ----------
function aggregateBreweries(rows) {
  const m = new Map();
  for (const x of rows) {
    const cur = m.get(x.brewery_key) ?? { key: x.brewery_key, name: x.brewery_name, slug: x.brewery_slug, medals: 0, points: 0, g: 0, s: 0, b: 0, first: x.year };
    cur.medals += 1; cur.points += x.points; if (x.medal === 'Gold') cur.g += 1; if (x.medal === 'Silver') cur.s += 1; if (x.medal === 'Bronze') cur.b += 1;
    cur.first = Math.min(cur.first, x.year);
    m.set(x.brewery_key, cur);
  }
  return [...m.values()].sort((a, b) => b.points - a.points || b.medals - a.medals || a.name.localeCompare(b.name));
}

function topBreweriesView(rows, ctx) {
  const { r, meta, state, page } = ctx;
  const info = page.breweries;
  const all = aggregateBreweries(rows).slice(0, 50);
  const bars = all.slice(0, 15).map((b) => ({ label: b.name, value: b.points, href: `${r}breweries/${b.slug}/` }));
  const cols = [
    { key: 'rank', label: '#', numeric: true, render: (b) => all.indexOf(b) + 1 },
    { key: 'name', label: 'Brewery', render: (b) => `<a href="${r}breweries/${esc(info[b.key]?.slug ?? b.slug)}/">${esc(info[b.key]?.name ?? b.name)}</a>` },
    { key: 'hq', label: 'HQ', render: (b) => esc(info[b.key]?.hq ?? '') },
    { key: 'points', label: 'Points', numeric: true },
    { key: 'medals', label: 'Medals', numeric: true },
    gsbColumn((b) => [b.g, b.s, b.b]),
    { key: 'first', label: 'First in View', numeric: true },
    { key: 'ownership', label: 'Ownership', render: (b) => esc(valueLabel('ownership_type', info[b.key]?.ownership_type || 'unlisted')) },
  ];
  const perYear = yearsInView(meta, state).filter((y) => rows.some((x) => x.year === y)).reverse().map((y) => ({ year: y, coverage: meta.coverage[y], list: aggregateBreweries(rows.filter((x) => x.year === y)).slice(0, 25) }));
  const streaks = Object.values(info).filter((b) => b.streak > 1).sort((a, b) => b.streak - a.streak).slice(0, 10);
  return `<div class="grid">
${barsFigure('top-breweries-points', tx('pages.analysis-report.top_breweries.chart_title', 'Top 15 Breweries by Points'), bars, { subtitle: tx('pages.analysis-report.top_breweries.chart_subtitle', 'Medals in View'), color: 'var(--series-2)', labelWidth: 220, valueName: 'Points', labelHeader: tx('global.tables.brewery_columns.brewery', 'Brewery') })}
<div class="card"><h2>streaks</h2><p class="small">${esc(tx('pages.analysis-report.top_breweries.streaks_note', 'Consecutive years with a medal, through {{year}}. A streak needs every year, so it uses the full record and ignores Filters.', { year: meta.latest_complete }))}</p><ol class="small">${streaks.map((b) => `<li>${tx('pages.analysis-report.top_breweries.streak_item', '{{brewery_name}}: {{count}} years', { brewery_name: `<a href="${r}breweries/${esc(b.slug)}/">${esc(b.name)}</a>`, count: b.streak })}</li>`).join('') || `<li class="muted">${esc(tx('pages.analysis-report.top_breweries.streaks_empty', 'No streak longer than one year.'))}</li>`}</ol><p class="small">Breweries whose first medal came in ${meta.latest_complete}: <a href="${r}first-time-medalists/${meta.latest_complete}/">first time medalists</a>.</p></div>
</div>
<h2>top-50-in-view</h2>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml(cols, all)}</div>
${perYear.map((p) => `<h2>${p.year}${p.coverage !== 'complete' ? ` <span class="pill ${esc(p.coverage)}">${esc(p.coverage)}</span>` : ''}</h2><div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([{ key: 'name', label: 'Brewery', render: (x) => `<a href="${r}breweries/${esc(x.slug)}/">${esc(x.name)}</a>` }, { key: 'points', label: 'Points', numeric: true }, { key: 'medals', label: 'Medals', numeric: true }, gsbColumn((x) => [x.g, x.s, x.b])], p.list)}</div>`).join('')}`;
}

function topCategoriesView(rows, ctx) {
  const { r } = ctx;
  const latest = new Map();
  const medalsBy = new Map();
  for (const x of rows) {
    medalsBy.set(x.category_name, (medalsBy.get(x.category_name) ?? 0) + 1);
    if (!x.entries) continue;
    const cur = latest.get(x.category_name);
    if (!cur || x.year > cur.year) latest.set(x.category_name, { name: x.category_name, slug: x.category_slug, special: x.special, style_family: x.style_family, entries: x.entries, year: x.year, abv_min: x.abv_min, abv_max: x.abv_max });
  }
  const withEntries = [...latest.values()].sort((a, b) => b.entries - a.entries);
  const special = tx('pages.analysis-report.top_categories.special_suffix', '(Special)');
  const bars = withEntries.slice(0, 20).map((c) => ({ label: `${c.name}${c.special ? ` ${special}` : ''}`, value: c.entries, href: `${r}categories/${c.slug}/` }));
  const families = items(countBy(rows, 'style_family'));
  const odds = oddsItems(rows);
  return `<div class="grid">
${withEntries.length ? barsFigure('most-entered', tx('pages.analysis-report.top_categories.most_entered_title', 'Most Entered Categories'), bars, { subtitle: tx('pages.analysis-report.top_categories.most_entered_subtitle', 'Latest Year in View with Entry Counts'), labelWidth: 250, valueName: 'Entrants', labelHeader: tx('global.tables.category_columns.category', 'Category') }) : `<div class="card"><h2>most-entered-categories</h2><p class="muted">${esc(tx('pages.analysis-report.top_categories.most_entered_empty', 'No entry counts in view.'))}</p></div>`}
${barsFigure('family-medals', tx('pages.analysis-report.top_categories.families_title', 'Medals by Style Family'), families, { color: 'var(--series-3)', labelHeader: tx('global.tables.category_columns.style_family', 'Style Family') })}
</div>
${odds.figure}
<h2>all-categories-in-view</h2>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([{ key: 'name', label: tx('global.tables.category_columns.category', 'Category'), render: (c) => `<a href="${r}categories/${esc(c.slug)}/">${esc(c.name)}</a>` }, { key: 'type', label: tx('global.tables.category_columns.type', 'Type'), render: (c) => esc(c.special ? tx('global.labels.category_pill.special_short', 'Special') : tx('global.labels.category_pill.classic_short', 'Classic')) }, { key: 'style_family', label: tx('global.tables.category_columns.style_family', 'Style Family') }, { key: 'entries', label: tx('global.tables.category_columns.latest_entrants', 'Latest Entrants'), numeric: true, render: (c) => fmt(c.entries) }, { key: 'year', label: tx('global.tables.category_columns.year', 'Year'), numeric: true }, { key: 'medals', label: tx('global.tables.category_columns.medals_in_view', 'Medals in View'), numeric: true, render: (c) => medalsBy.get(c.name) ?? 0 }, { key: 'abv', label: tx('global.tables.category_columns.abv', 'ABV (Style Range)'), render: (c) => (c.abv_min ? esc(tx('global.tables.category_columns.abv_value', '{{min}} to {{max}}%', { min: c.abv_min, max: c.abv_max })) : '') }], withEntries)}</div>`;
}

// Medal odds: entries per medal by category, pooled over the years in view. Rows without an
// official entry count are left out and counted in the note.
// The words come from the report's copy unless a caller (the dashboard) passes its own entries.
const reportOddsWords = () => ({
  note: tx('pages.analysis-report.top_categories.odds_note', 'Entries divided by medals awarded in the category, pooled over the years in view.'),
  missingOne: tx('pages.analysis-report.top_categories.odds_missing_one', '1 medal in view has no published entry count and is left out.'),
  missingMany: tx('pages.analysis-report.top_categories.odds_missing_many', '{{count}} medals in view have no published entry count and are left out.'),
});
export function oddsItems(rows, { limit = 20, words = reportOddsWords() } = {}) {
  const m = new Map();
  let missing = 0;
  for (const x of rows) {
    if (!x.entries || !x.category_medals) { missing += 1; continue; }
    const k = x.category_name;
    const cur = m.get(k) ?? { label: k, slug: x.category_slug, entries: 0, medals: 0, seen: new Set() };
    const ky = `${x.year}`;
    if (!cur.seen.has(ky)) { cur.seen.add(ky); cur.entries += x.entries; cur.medals += x.category_medals; }
    m.set(k, cur);
  }
  const list = [...m.values()].map((c) => ({ label: c.label, value: Number((c.entries / c.medals).toFixed(1)), entries: c.entries, medals: c.medals, years: [...c.seen].sort().join(', '), slug: c.slug })).sort((a, b) => b.value - a.value);
  const note = `${words.note}${missing ? ` ${missing === 1 ? words.missingOne : words.missingMany.replace('{{count}}', String(missing))}` : ''}`;
  const top = list.slice(0, limit);
  const perMedal = tx('pages.analysis-report.top_categories.odds_columns.entries_per_medal', 'Entries per Medal');
  return {
    list,
    note,
    figure: list.length ? figure({ id: 'entry-odds', title: tx('pages.analysis-report.top_categories.odds_title', 'Hardest Categories to Medal in'), subtitle: tx('pages.analysis-report.top_categories.odds_subtitle', 'Entries per Medal, Highest First'), height: Math.max(200, 30 * top.length + 60), option: barsHOption({ items: top, valueName: perMedal, labelWidth: 250, saveName: 'entries-per-medal' }), note, table: tableHtml([{ key: 'label', label: tx('pages.analysis-report.top_categories.odds_columns.category', 'Category') }, { key: 'value', label: perMedal, numeric: true }, { key: 'entries', label: tx('pages.analysis-report.top_categories.odds_columns.entries', 'Entries'), numeric: true }, { key: 'medals', label: tx('pages.analysis-report.top_categories.odds_columns.medals_awarded', 'Medals Awarded'), numeric: true }, { key: 'years', label: tx('pages.analysis-report.top_categories.odds_columns.years', 'Years') }], list, { className: 'data-table' }) }) : '',
  };
}

function byStateView(rows, ctx) {
  const { meta } = ctx;
  const ind = meta.indicators?.state ?? {};
  const rates = medalRates(rows, (x) => x.state, ind);
  const latest = meta.latest_complete;
  const list = meta.states.map((s) => {
    const ms = rows.filter((x) => x.state === s.state);
    const rate = rates.get(s.state);
    return { ...s, medals: ms.length, split: medalSplit(ms), breweries: new Set(ms.map((m) => m.brewery_key)).size, latest: ms.filter((m) => m.year === latest).length, per_million: rate?.per_million ?? 0, per_100b: rate?.per_100b_gdp ?? 0, pop_latest: ind[s.state]?.population?.[latest] ?? null };
  }).filter((s) => s.medals > 0).sort((a, b) => b.medals - a.medals);
  const mapData = meta.states.map((s) => ({ name: s.name, value: list.find((x) => x.state === s.state)?.medals ?? 0 }));
  const perCap = [...list].sort((a, b) => b.per_million - a.per_million).slice(0, 20).map((s) => ({ label: s.name, value: Number(s.per_million.toFixed(2)) }));
  return `${figure({ id: 'state-map', title: tx('pages.analysis-report.by_state.map_title', 'Medals by State'), subtitle: tx('pages.analysis-report.by_state.map_subtitle', 'Medals in View'), height: 460, option: mapOption({ data: mapData, saveName: 'medals-by-state-map' }), table: tableHtml([{ key: 'name', label: 'State' }, { key: 'value', label: 'Medals', numeric: true }], mapData.filter((d) => d.value).sort((a, b) => b.value - a.value), { className: 'data-table' }) })}
<div class="grid">
${barsFigure('state-medals', tx('pages.analysis-report.by_state.bars_title', 'Medals by State'), list.slice(0, 20).map((s) => ({ label: s.name, value: s.medals })), { subtitle: tx('pages.analysis-report.by_state.bars_subtitle', 'Top 20'), labelHeader: 'State' })}
${barsFigure('state-per-capita', tx('pages.analysis-report.by_state.per_capita_title', 'Medals per Million Residents'), perCap, { subtitle: tx('pages.analysis-report.by_state.per_capita_subtitle', "Top 20, by Each Year's Population"), color: 'var(--series-3)', valueName: 'Per Million', labelHeader: 'State' })}
</div>
<h2>all-states-in-view</h2>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([{ key: 'name', label: 'State' }, { key: 'region', label: 'Region' }, { key: 'division', label: 'Division' }, { key: 'medals', label: 'Medals', numeric: true }, gsbColumn((s) => s.split), { key: 'latest', label: `${latest}`, numeric: true }, { key: 'breweries', label: 'Breweries', numeric: true }, { key: 'pop_latest', label: `Population ${latest}`, numeric: true, render: (s) => fmt(s.pop_latest) }, { key: 'per_million', label: 'Per Million', numeric: true, render: (s) => s.per_million.toFixed(2) }, { key: 'per_100b', label: 'Per $100B Real GDP', numeric: true, render: (s) => s.per_100b.toFixed(2) }], list)}</div>`;
}

// Population and real GDP summed over the states in each Census region or division.
export function groupIndicators(meta, key) {
  const out = {};
  for (const s of meta.states) {
    const g = s[key];
    const series = meta.indicators?.state?.[s.state] ?? {};
    for (const ind of ['population', 'gdp_real']) {
      for (const [y, v] of Object.entries(series[ind] ?? {})) {
        const target = ((out[g] ??= {})[ind] ??= {});
        target[y] = (target[y] ?? 0) + v;
      }
    }
  }
  return out;
}

function byRegionView(rows, ctx) {
  const { meta } = ctx;
  const roll = (key) => {
    const rates = medalRates(rows, (x) => x[key], groupIndicators(meta, key));
    const m = new Map();
    for (const x of rows) {
      const k = x[key] || '(unknown)';
      const cur = m.get(k) ?? { name: k, medals: 0, split: [0, 0, 0], breweries: new Set(), states: new Set() };
      cur.medals += 1; const i = RANK[x.medal] - 1; if (i >= 0 && i < 3) cur.split[i] += 1; cur.breweries.add(x.brewery_key); cur.states.add(x.state);
      m.set(k, cur);
    }
    return [...m.values()].map((c) => ({ ...c, breweries: c.breweries.size, states: c.states.size, per_million: rates.get(c.name)?.per_million ?? 0 })).sort((a, b) => b.medals - a.medals);
  };
  const regions = roll('region');
  const divisions = roll('division');
  const cols = [{ key: 'name', label: 'Name' }, { key: 'medals', label: 'Medals', numeric: true }, gsbColumn((x) => x.split), { key: 'breweries', label: 'Breweries', numeric: true }, { key: 'states', label: 'States', numeric: true }, { key: 'per_million', label: 'Per Million', numeric: true, render: (x) => x.per_million.toFixed(2) }];
  return `<div class="grid">
${figure({ id: 'region-medals', title: tx('pages.analysis-report.by_region.regions_title', 'Medals by Region'), height: 220, option: barsHOption({ items: regions.map((x) => ({ label: x.name, value: x.medals })), saveName: 'medals-by-region' }), table: tableHtml(cols, regions, { className: 'data-table' }) })}
${figure({ id: 'division-medals', title: tx('pages.analysis-report.by_region.divisions_title', 'Medals by Division'), height: Math.max(220, 36 * divisions.length + 60), option: barsHOption({ items: divisions.map((x) => ({ label: x.name, value: x.medals })), color: 'var(--series-3)', saveName: 'medals-by-division' }), table: tableHtml(cols, divisions, { className: 'data-table' }) })}
</div>`;
}

function ownershipView(rows, ctx) {
  const { page } = ctx;
  const byType = countBy(rows, 'ownership_type').map(([v, value]) => ({ label: valueLabel('ownership_type', v), value }));
  const indep = rows.filter((x) => ['independent', 'employee-owned'].includes(x.ownership_type)).length;
  const undefinedCount = rows.filter((x) => x.ownership_type === 'unlisted').length;
  const ownedKeys = new Set(rows.filter((x) => !['independent', 'employee-owned', 'unlisted'].includes(x.ownership_type)).map((x) => x.brewery_key));
  const parents = items(countBy(rows.filter((x) => ownedKeys.has(x.brewery_key)).map((x) => ({ p: x.parent || valueLabel('ownership_type', x.ownership_type) })), 'p'));
  const listed = new Set(rows.filter((x) => page.ownershipKeys.includes(x.brewery_key)).map((x) => x.brewery_key)).size;
  // The independents note stays here: its copy entry describes a different counting rule (breweries with
  // no record counted as independent) from the one this view applies (left out).
  return `<div class="stats">${statTile({ label: tx('pages.analysis-report.ownership.stat_independent', 'Medals to Independent Breweries'), value: pct(indep, rows.length), note: `${fmt(indep)} of ${fmt(rows.length)} medals in view; ${fmt(undefinedCount)} have no ownership record and are not counted` })}${statTile({ label: tx('pages.analysis-report.ownership.stat_listed', 'Medalists with Ownership Research'), value: String(listed) })}${statTile({ label: tx('pages.analysis-report.ownership.stat_owned', 'Medalists Owned by a Large Brewer or Other Company'), value: String(ownedKeys.size) })}</div>
<div class="grid">
${barsFigure('ownership-type', tx('pages.analysis-report.ownership.by_type_title', 'Medals by Ownership'), byType, { labelWidth: 230, labelHeader: tx('global.tables.brewery_columns.ownership', 'Ownership') })}
${parents.length ? barsFigure('parents', tx('pages.analysis-report.ownership.parents_title', 'Medals by Parent Company'), parents, { subtitle: tx('pages.analysis-report.ownership.parents_subtitle', 'Owners That Are Not Independent'), color: 'var(--series-2)', labelWidth: 230, labelHeader: 'Parent' }) : `<div class="card"><h2>parents</h2><p class="muted">${esc(tx('pages.analysis-report.ownership.parents_empty', 'No medalist in view is owned by a large brewer or other company.'))}</p></div>`}
</div>`;
}

function economicsView(rows, ctx) {
  const { r, page } = ctx;
  const info = page.breweries;
  const keys = new Set(rows.map((x) => x.brewery_key));
  const list = [...keys].map((k) => info[k]).filter(Boolean).sort((a, b) => (b.arr ?? 0) - (a.arr ?? 0));
  const bars = list.slice(0, 15).map((b) => ({ label: b.name, value: b.arr, href: `${r}breweries/${b.slug}/` }));
  return `${barsFigure('arr-by-brewery', tx('pages.analysis-report.economics.chart_title', 'Estimated ARR by Brewery (E)'), bars, { subtitle: tx('pages.analysis-report.economics.chart_subtitle', 'Top 15 Medalists in View'), color: 'var(--series-5)', labelWidth: 220, valueName: 'ARR USD', labelHeader: tx('pages.analysis-report.economics.columns.brewery', 'Brewery') })}
<h2>all-medalists-in-view</h2>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([
    { key: 'name', label: tx('pages.analysis-report.economics.columns.brewery', 'Brewery'), render: (b) => `<a href="${r}breweries/${esc(b.slug)}/">${esc(b.name)}</a>` },
    { key: 'type', label: tx('pages.analysis-report.economics.columns.type', 'Type'), render: (b) => esc(valueLabel('brewery_type', b.brewery_type)) },
    { key: 'locations', label: tx('pages.analysis-report.economics.columns.locations', 'Locations'), numeric: true, render: (b) => b.locations_count },
    { key: 'barrels', label: tx('pages.analysis-report.economics.columns.barrels', 'Barrels (E)'), numeric: true, cellClass: 'est-cell', sortValue: (b) => b.barrels ?? 0, render: (b) => `${fmt(b.barrels)}${b.basis === 'reported' ? '' : ` ${estMark(b.key, 'barrels')}`}` },
    { key: 'basis', label: tx('pages.analysis-report.economics.columns.basis', 'Volume Basis'), render: (b) => esc(valueLabel('basis', b.basis)) },
    { key: 'cases', label: tx('pages.analysis-report.economics.columns.cases', 'Case Equivalents'), numeric: true, render: (b) => fmt(b.cases) },
    { key: 'arr', label: tx('pages.analysis-report.economics.columns.arr', 'ARR (E)'), numeric: true, cellClass: 'est-cell', sortValue: (b) => b.arr ?? 0, render: (b) => `${usd(b.arr)} ${estMark(b.key, 'arr')}` },
    { key: 'gm', label: tx('pages.analysis-report.economics.columns.gross_margin', 'Gross Margin (E)'), numeric: true, cellClass: 'est-cell', sortValue: (b) => b.gross_margin ?? 0, render: (b) => `${pctOf(b.gross_margin)} ${estMark(b.key, 'gross_margin')}` },
    { key: 'ebitda', label: tx('pages.analysis-report.economics.columns.ebitda', 'EBITDA (E)'), numeric: true, cellClass: 'est-cell', sortValue: (b) => b.ebitda ?? 0, render: (b) => `${usd(b.ebitda)} ${estMark(b.key, 'ebitda')}` },
    { key: 'ebitda_range', label: tx('pages.analysis-report.economics.columns.ebitda_range', 'EBITDA Margin Range (E)'), render: (b) => `${pctOf(b.ebitda_margin_low)} to ${pctOf(b.ebitda_margin_high)}` },
    { key: 'channel', label: tx('pages.analysis-report.economics.columns.distribution', 'Distribution'), render: (b) => esc(valueLabel('distribution_channel', b.distribution_channel || 'unknown')) },
    { key: 'ownership', label: tx('pages.analysis-report.economics.columns.ownership', 'Ownership'), render: (b) => esc(valueLabel('ownership_type', b.ownership_type || 'unlisted')) },
  ], list)}</div>`;
}

function trendsView(rows, ctx) {
  const { r, meta, state } = ctx;
  const years = yearsInView(meta, state);
  const top = countBy(rows, 'style_family').slice(0, SERIES_COLORS.length - 1).map(([k]) => k);
  const series = [...top, 'Other'].map((f, i) => ({ name: f, color: f === 'Other' ? 'var(--mark-other)' : SERIES_COLORS[i], data: years.map((y) => rows.filter((x) => x.year === y && (top.includes(x.style_family) ? x.style_family === f : f === 'Other')).length) }));
  const complete = years.filter((y) => meta.coverage[y] === 'complete' && rows.some((x) => x.year === y));
  let movers = `<div class="notice">${esc(tx('pages.analysis-report.trends.movers_empty', 'Movers appear when two complete years are in view.'))}</div>`;
  if (complete.length >= 2) {
    const [prev, last] = complete.slice(-2);
    const names = new Map(rows.map((x) => [x.brewery_key, { name: x.brewery_name, slug: x.brewery_slug }]));
    const diffs = [...names.keys()].map((k) => ({ ...names.get(k), d: rows.filter((x) => x.brewery_key === k && x.year === last).length - rows.filter((x) => x.brewery_key === k && x.year === prev).length })).filter((x) => x.d !== 0).sort((a, b) => b.d - a.d);
    movers = `<h2>${esc(tx('pages.analysis-report.trends.movers_title', 'Movers, {{previous_year}} to {{year}}', { previous_year: prev, year: last }))}</h2><div class="grid two"><div class="card"><h3>${esc(tx('pages.analysis-report.trends.gained', 'Gained'))}</h3><ol class="small">${diffs.slice(0, 10).filter((x) => x.d > 0).map((x) => `<li><a href="${r}breweries/${esc(x.slug)}/">${esc(x.name)}</a> +${x.d}</li>`).join('')}</ol></div><div class="card"><h3>${esc(tx('pages.analysis-report.trends.lost', 'Lost'))}</h3><ol class="small">${diffs.slice(-10).reverse().filter((x) => x.d < 0).map((x) => `<li><a href="${r}breweries/${esc(x.slug)}/">${esc(x.name)}</a> ${x.d}</li>`).join('')}</ol></div></div>`;
  }
  return `${figure({ id: 'family-share', title: tx('pages.analysis-report.trends.families_title', 'Medals by Style Family and Year'), subtitle: 'top four families in view plus Other', height: 320, option: stackedColumnsOption({ labels: years, notes: years.map((y) => (meta.coverage[y] === 'complete' ? '' : meta.coverage[y])), series, saveName: 'style-family-by-year', selectiveLabels: false }), table: tableHtml([{ key: 'year', label: 'Year' }, ...series.map((f) => ({ key: f.name, label: f.name, numeric: true, render: (row) => f.data[row.i] }))], years.map((y, i) => ({ year: y, i })), { className: 'data-table' }) })}
${movers}`;
}

export const VIEWS = {
  brewery: breweryView,
  category: categoryView,
  winners: winnersView,
  'first-time': firstTimeView,
  'breweries-index': breweriesIndexView,
  'categories-index': categoriesIndexView,
  'top-breweries': topBreweriesView,
  'top-categories': topCategoriesView,
  'by-state': byStateView,
  'by-region': byRegionView,
  ownership: ownershipView,
  economics: economicsView,
  trends: trendsView,
};

// Render a view: the empty state when nothing matches, otherwise the partial notice and the view.
// scopeAll: the page scope before the global filter (for the empty state's partial hint).
export function renderView(name, rows, ctx) {
  if (ctx.scopeAll && !ctx.scopeAll.length) return '<p class="muted">No GABF medals in the loaded results for this page.</p>';
  if (!rows.length) return emptyStateHtml(ctx.state ?? {}, ctx.scopeAll ?? [], ctx.meta);
  return humanizeHeadings(`${partialNoticeHtml(rows, ctx.meta)}${VIEWS[name](rows, ctx)}`);
}
