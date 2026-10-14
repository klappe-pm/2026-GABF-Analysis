// Page views: the filterable part of every data page, rendered from medal rows. The build calls
// these with the default selection (complete years) to write the HTML, and app.mjs calls the same
// functions in the browser whenever the global filter changes, so the two can never disagree.
// Each view takes (rows, ctx): rows already narrowed to the page scope and the global filter;
// ctx carries the relative root r, meta, the filter state, and page data.

import { compact, countBy, esc, figure, gsbColumn, gsbHtml, humanizeHeadings, statTile, STATUS_LABELS, STATUS_SHORT, tableHtml } from './charts.mjs';
import { barsHOption, lineOption, mapOption, MEDAL_COLORS, SERIES_COLORS, stackedColumnsOption } from './chart-options.mjs';
import { medalRates } from './rates.mjs';
import { emptyStateHtml, includesPartial, partialNoticeHtml, valueLabel } from './filter-bar.mjs';
import { estMark } from './estimates.mjs';
import { compareLabels } from './sort-order.mjs';
import { hopCopy, hopLinksHtml, hopSlug } from './hop-links.mjs';
import { beerCardsHtml } from './profile-cards.mjs';

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

// The beer's own published figures. A missing value reads "Not defined"; the style range is never
// used here.
export const NOT_DEFINED_HTML = '<span class="muted">Not defined</span>';
const hasNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
export const abvCell = (x) => (hasNum(x.abv) ? `${esc(Number(x.abv).toFixed(1).replace(/\.0$/, ''))}%` : NOT_DEFINED_HTML);
export const ibuCell = (x) => (hasNum(x.ibu) ? esc(String(Number(x.ibu))) : NOT_DEFINED_HTML);
const profileCell = (x, r) => (x.beer_profile ? `<a href="${r}${esc(x.beer_profile)}">Full profile</a>` : NOT_DEFINED_HTML);

// compact: drop columns whose value is the same on every row and columns empty on every row.
// The Notes column is dropped whenever it is empty.
export function medalTable(rows, { r, showYear = true, showBrewery = false, compact: compactCols = false, odds = false, meta = null } = {}) {
  const hc = hopCopy(meta);
  let cols = [];
  if (showYear) cols.push({ key: 'year', label: 'Year', numeric: true });
  cols.push({ key: 'medal', label: 'Medal', render: (x) => medalDot(x.medal) });
  cols.push({ key: 'beer_name', label: 'Beer', render: (x) => (x.beer_profile ? `<a href="${r}${esc(x.beer_profile)}">${esc(x.beer_name)}</a>` : esc(x.beer_name)) });
  cols.push({ key: 'abv', label: 'ABV', numeric: true, keep: true, render: abvCell });
  cols.push({ key: 'ibu', label: 'IBU', numeric: true, keep: true, render: ibuCell });
  // Only 2026 beers carry hops; the column is dropped below when no row in view has any.
  cols.push({ key: 'hop_varieties', label: hc.column, hops: true, render: (x) => hopLinksHtml(x.hop_varieties, { r, none: hc.none }) });
  if (showBrewery) cols.push({ key: 'brewery_name', label: 'Brewery', render: (x) => `<a href="${r}breweries/${esc(x.brewery_slug)}/">${esc(x.brewery_name)}</a>${x.brewery_location ? ` <span class="muted small">(${esc(x.brewery_location)})</span>` : ''}` });
  else cols.push({ key: 'brewery_location', label: 'Location credited', render: (x) => esc(x.brewery_location || x.city) });
  cols.push({ key: 'city', label: 'City', render: (x) => `${esc(x.city)}, ${esc(x.state)}` });
  cols.push({ key: 'category_name', label: 'Category', droppable: true, render: (x) => `<a href="${r}categories/${esc(x.category_slug)}/">${esc(x.category_name)}</a>${x.special ? ' <span class="pill">special</span>' : ''}` });
  cols.push({ key: 'entries', label: odds ? 'Field (entries)' : 'Entrants', numeric: true, droppable: true, render: (x) => (x.entries ? fmt(x.entries) : '') });
  if (odds) cols.push({ key: 'odds', label: 'Entries per medal', numeric: true, render: (x) => { const e = entriesPerMedal(x); return e ? e.toFixed(1) : ''; } });
  cols.push({ key: 'style_family', label: 'Style family', droppable: true });
  cols.push({ key: 'beer_profile', label: 'Beer profile', keep: true, render: (x) => profileCell(x, r) });
  cols.push({ key: 'notes', label: 'Notes', render: (x) => `<span class="small muted">${esc(noteFor(x))}</span>` });
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
  return figure({ id, title: 'GABF medals by year', subtitle, height: 280, option: stackedColumnsOption({ labels: years, notes: data.map((d) => d.note), series: [{ name: 'Gold', data: data.map((d) => d.gold), color: MEDAL_COLORS.Gold }, { name: 'Silver', data: data.map((d) => d.silver), color: MEDAL_COLORS.Silver }, { name: 'Bronze', data: data.map((d) => d.bronze), color: MEDAL_COLORS.Bronze }], saveName }), table: tableHtml([{ key: 'year', label: 'Year' }, gsbColumn((d) => [d.gold, d.silver, d.bronze]), { key: 'note', label: 'Status' }], data, { className: 'data-table' }) });
}

const medalSplit = (rows) => ['Gold', 'Silver', 'Bronze'].map((m) => rows.filter((x) => x.medal === m).length);

// ---------- brewery page ----------
function breweryView(rows, ctx) {
  const { r, meta, state, page } = ctx;
  const b = page.brewery;
  const years = yearsInView(meta, state);
  const statusOf = Object.fromEntries((b.trend ?? []).map((t) => [t.year, t.status]));
  const notes = Object.fromEntries(years.map((y) => [y, STATUS_SHORT[statusOf[y]] ?? '']));
  const cats = new Set(rows.map((m) => m.category_name)).size;
  const first = rows.length ? Math.min(...rows.map((m) => m.year)) : null;
  const stats = [
    statTile({ label: 'GABF medals in view', value: String(rows.length) }),
    statTile({ label: 'Gold, silver, bronze', medals: medalSplit(rows) }),
    statTile({ label: 'First medal in view', value: first ? String(first) : 'none' }),
    statTile({ label: 'Categories medaled', value: String(cats), note: `${rows.filter((m) => m.special).length} in special categories` }),
    statTile({ label: b.basis === 'reported' ? 'Barrels per year' : 'Estimated barrels per year', value: compact(b.barrels), mark: b.basis === 'reported' ? '' : estMark(b.key, 'barrels'), note: b.basis === 'reported' ? 'reported' : 'estimate' }),
    statTile({ label: 'Estimated ARR', value: usd(b.arr), mark: estMark(b.key, 'arr'), note: `EBITDA ${usd(b.ebitda)} at ${pctOf(b.ebitda_margin)}, also an estimate` }),
  ].join('');
  const byFamily = items(countBy(rows, 'style_family'));
  const byLocation = items(countBy(rows.map((m) => ({ loc: m.brewery_location || m.city })), 'loc'));
  const byCategory = countBy(rows, 'category_name').map(([label, value]) => ({ label, value, href: `${r}categories/${rows.find((m) => m.category_name === label).category_slug}/` }));
  const figs = [
    medalsByYearFigure('medals-by-year', rows, years, notes, { subtitle: `${b.name}, ${years[0]} to ${years[years.length - 1]}`, saveName: `${b.slug}-medals-by-year` }),
    barsFigure('medals-by-style-family', 'GABF medals by style family', byFamily, { color: 'var(--series-3)', labelWidth: 170, labelHeader: 'Style family' }),
  ];
  if (byLocation.length > 1) figs.push(barsFigure('medals-by-location', 'GABF medals by location credited', byLocation, { subtitle: 'as printed in the winners list', color: 'var(--series-2)', labelWidth: 170, labelHeader: 'Location' }));
  if (byCategory.length > 1) figs.push(barsFigure('medals-by-category', 'GABF medals by category', byCategory.slice(0, 15), { labelWidth: 240, labelHeader: 'Category' }));
  const byYear = [...years].reverse().map((y) => {
    const ms = rows.filter((m) => m.year === y);
    return { year: y, medals: ms.length, split: medalSplit(ms), status: ms.length ? '' : (STATUS_LABELS[statusOf[y]] ?? 'No medal in view') };
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
    ? figure({ id: 'entries-by-year', title: 'Entrants by year', subtitle: 'how competitive the category is', height: 260, option: lineOption({ labels: withEntries.map((y) => y.year), series: [{ name: 'Entries', data: withEntries.map((y) => y.entries), color: SERIES_COLORS[0] }], saveName: `${page.slug}-entries` }), table: tableHtml([{ key: 'year', label: 'Year' }, { key: 'entries', label: 'Entries', numeric: true }], withEntries, { className: 'data-table' }) })
    : `<div class="card"><h2>entrants</h2><p class="muted">${withEntries.length === 1 ? `${fmt(withEntries[0].entries)} entries in ${withEntries[0].year}. A trend appears when a second year with entry counts is in view.` : 'No entry counts in view for this category.'}</p></div>`;
  return `${chart}
<h2>medalists-by-year</h2>
${[...list].reverse().map((y) => `<h3>${y.year}${y.number ? ` · category ${esc(y.number)}` : ''}${y.entries ? ` · ${fmt(y.entries)} entrants` : ''}</h3>${medalTable(y.medals.sort(byNewest), { r, showYear: false, showBrewery: true, compact: true, meta })}`).join('')}
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
  const tile = (label, k) => statTile({ label, value: String(k), note: `${k} of ${n}` });
  const stats = [
    statTile({ label: 'Medals in view', value: String(n), note: `${new Set(list.map((x) => x.category_name)).size} categories` }),
    tile('ABV published', count((s) => !isBlank(s.abv))),
    tile('IBU published', count((s) => !isBlank(s.ibu))),
    tile('Hops named', count((s) => !isBlank(s.hops))),
    tile('Brewery beer page found', count((s) => !isBlank(s.beer_url))),
  ].join('');
  const groups = new Map();
  for (const x of list) {
    const k = Number(x.category_number);
    if (!groups.has(k)) groups.set(k, { number: k, name: x.category_name, entries: x.entries, rows: [] });
    groups.get(k).rows.push(x);
  }
  const head = '<thead><tr><th scope="col">Medal</th><th scope="col">Beer</th><th scope="col">Brewery</th><th scope="col" class="num">ABV</th><th scope="col" class="num">IBU</th><th scope="col">Hops</th></tr></thead>';
  const bodies = [...groups.values()].sort((a, b) => a.number - b.number).map((g) => `<tbody>
<tr class="group-row"><th colspan="6" scope="colgroup">${g.number}. ${esc(g.name)}${g.entries ? ` <span class="muted small">${fmt(g.entries)} entries</span>` : ''}</th></tr>
${g.rows.sort(byNewest).map((x) => {
    const s = specs[x.beer_profile];
    return `<tr><td data-label="Medal">${medalDot(x.medal)}</td><td data-label="Beer"><a href="${ctx.r}${esc(x.beer_profile)}">${esc(x.beer_name)}</a></td><td data-label="Brewery"><a href="${ctx.r}breweries/${esc(x.brewery_slug)}/">${esc(x.brewery_name)}</a> <span class="muted small">${esc(x.city)}, ${esc(x.state)}</span></td><td class="num" data-label="ABV">${isBlank(s.abv) ? '<span class="muted">not published</span>' : esc(abvText(s.abv))}</td><td class="num" data-label="IBU">${isBlank(s.ibu) ? '<span class="muted">not published</span>' : esc(s.ibu)}</td><td class="small" data-label="Hops">${isBlank(s.hops) ? '<span class="muted">not published</span>' : hopLinksHtml(s.hops, { r: ctx.r })}</td></tr>`;
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
    statTile({ label: 'First time medalists', value: String(breweries.size), note: `no medal in the loaded years before ${year}` }),
    statTile({ label: `Share of ${year} medals in view`, value: pct(fresh.length, rows.length) || '0%', note: `${fresh.length} of ${rows.length} medals` }),
    statTile({ label: 'Golds among them', value: String(g), note: `${pct(g, fresh.length) || '0%'} of their medals` }),
    statTile({ label: 'Their gold, silver, bronze', medals: medalSplit(fresh) }),
    statTile({ label: 'First in the complete record', value: String(new Set(complete.map((x) => x.brewery_key)).size), note: 'earlier medals only in partial years' }),
  ].join('');
  const stateItems = countBy(fresh, 'state_name').slice(0, 20).map(([label, value]) => ({ label, value }));
  const district = items(countBy(fresh, 'fed_district_name'));
  const family = items(countBy(fresh, 'style_family'));
  const medals = ['Gold', 'Silver', 'Bronze'].map((m) => ({ label: m, value: fresh.filter((x) => x.medal === m).length }));
  const charts = fresh.length ? `<div class="grid">
${barsFigure('first-time-by-state', 'By state', stateItems, { subtitle: 'medals won by first time medalists, top 20', labelHeader: 'State', labelWidth: 150 })}
${barsFigure('first-time-by-district', 'By Fed district', district, { subtitle: 'Federal Reserve district of the medal city', color: 'var(--series-1)', labelHeader: 'District', labelWidth: 150 })}
${barsFigure('first-time-by-family', 'By style family', family, { color: 'var(--series-3)', labelHeader: 'Style family', labelWidth: 170 })}
${barsFigure('first-time-by-medal', 'By medal', medals, { color: 'var(--series-4)', labelHeader: 'Medal', labelWidth: 80 })}
</div>` : '';
  const table = (list) => {
    const byB = new Map();
    for (const x of list) { if (!byB.has(x.brewery_key)) byB.set(x.brewery_key, []); byB.get(x.brewery_key).push(x); }
    const out = [...byB.values()].sort((a, b) => b.length - a.length || a[0].brewery_name.localeCompare(b[0].brewery_name));
    return `<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Brewery</th><th scope="col">Medal</th><th scope="col">Beer</th><th scope="col" class="num">ABV</th><th scope="col" class="num">IBU</th><th scope="col">Beer profile</th><th scope="col">Category</th><th scope="col" class="num">Entries beaten</th></tr></thead><tbody>${out.map((ms) => ms.sort(byNewest).map((x, i) => `<tr>${i === 0 ? `<td data-label="Brewery" rowspan="${ms.length}"><a href="${r}breweries/${esc(x.brewery_slug)}/">${esc(x.brewery_name)}</a> <span class="muted small">${esc(x.city)}, ${esc(x.state)}</span></td>` : ''}<td data-label="Medal">${medalDot(x.medal)}</td><td data-label="Beer">${x.beer_profile ? `<a href="${r}${esc(x.beer_profile)}">${esc(x.beer_name)}</a>` : esc(x.beer_name)}</td><td class="num" data-label="ABV">${abvCell(x)}</td><td class="num" data-label="IBU">${ibuCell(x)}</td><td data-label="Beer profile">${profileCell(x, r)}</td><td data-label="Category"><a href="${r}categories/${esc(x.category_slug)}/">${esc(x.category_name)}</a></td><td class="num" data-label="Entries beaten">${x.entries ? fmt(Math.max(0, x.entries - 1)) : '<span class="muted">not published</span>'}</td></tr>`).join('')).join('')}</tbody></table></div>`;
  };
  return `<div class="stats">${stats}</div>
${charts}
<h2>first-time-medalists</h2>
${fresh.length ? table(fresh) : '<p class="muted">No first time medalist in view.</p>'}
<h2>first-in-the-complete-record</h2>
<p class="small muted">These breweries medaled in ${year} and earlier only in partial years (${page.partialYears.join(' and ')}), which hold a sample of medals rather than the official lists. They are first time medalists if only the complete lists (${page.completeRange}) count.</p>
${complete.length ? table(complete) : '<p class="muted">None in view.</p>'}`;
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
    { key: 'name', label: 'Brewery', render: (b) => `<a href="${r}breweries/${esc(b.slug)}/">${esc(b.name)}</a>${b.deep_dive ? ' <span class="pill good">deep dive</span>' : ''}` },
    { key: 'hq', label: 'HQ', render: (b) => esc(b.hq ?? '') },
    { key: 'brewery_type', label: 'Type', render: (b) => esc(valueLabel('brewery_type', b.brewery_type)) },
    { key: 'medals', label: 'Medals', numeric: true },
    gsbColumn((b) => [b.g, b.s, b.b]),
    { key: 'points', label: 'Points', numeric: true },
    { key: 'first', label: 'First', numeric: true },
    { key: 'last', label: 'Latest', numeric: true },
    { key: 'ownership', label: 'Ownership', render: (b) => esc(valueLabel('ownership_type', b.ownership_type || 'unlisted')) },
    { key: 'arr', label: 'ARR (E)', numeric: true, sortValue: (b) => b.arr ?? 0, cellClass: 'est-cell', render: (b) => (b.arr ? `${usd(b.arr)} ${estMark(b.key, 'arr')}` : '') },
  ];
  return `<p class="small muted">${list.length.toLocaleString('en-US')} breweries with medals in view, ranked by points (gold 3, silver 2, bronze 1). Click a column to sort.</p><div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml(cols, list)}</div>`;
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
    { key: 'name', label: 'Category', render: (c) => `<a href="${r}categories/${esc(c.slug)}/">${esc(c.name)}</a>` },
    { key: 'type', label: 'Type', render: (c) => (c.special ? '<span class="pill warn">special</span>' : '<span class="pill good">classic</span>') },
    { key: 'style_family', label: 'Style family' },
    { key: 'abv', label: 'ABV (style)', render: (c) => (c.abv_min ? `${esc(c.abv_min)} to ${esc(c.abv_max)}%` : '') },
    { key: 'entries', label: 'Latest entrants', numeric: true, render: (c) => fmt(c.latest) },
    { key: 'medals', label: 'Medals in view', numeric: true },
    { key: 'years', label: 'Years', render: (c) => [...c.years].sort().join(', ') },
  ];
  return `<div class="grid">${barsFigure('medals-by-family', 'Medals by style family', families, { color: 'var(--series-3)', labelHeader: 'Style family' })}</div>
<h2>all-categories</h2>
<p class="small muted">${list.length} categories with medals in view.</p>
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
    { key: 'first', label: 'First in view', numeric: true },
    { key: 'ownership', label: 'Ownership', render: (b) => esc(valueLabel('ownership_type', info[b.key]?.ownership_type || 'unlisted')) },
  ];
  const perYear = yearsInView(meta, state).filter((y) => rows.some((x) => x.year === y)).reverse().map((y) => ({ year: y, coverage: meta.coverage[y], list: aggregateBreweries(rows.filter((x) => x.year === y)).slice(0, 25) }));
  const streaks = Object.values(info).filter((b) => b.streak > 1).sort((a, b) => b.streak - a.streak).slice(0, 10);
  return `<div class="grid">
${barsFigure('top-breweries-points', 'Top 15 breweries by points', bars, { subtitle: 'medals in view', color: 'var(--series-2)', labelWidth: 220, valueName: 'Points', labelHeader: 'Brewery' })}
<div class="card"><h2>streaks</h2><p class="small">Longest active medal streaks, consecutive loaded years through ${meta.latest_complete}. A streak needs every year, so it is computed over the full record and the filter does not change it.</p><ol class="small">${streaks.map((b) => `<li><a href="${r}breweries/${esc(b.slug)}/">${esc(b.name)}</a>: ${b.streak} years</li>`).join('') || '<li class="muted">No streaks longer than one year yet.</li>'}</ol><p class="small">Breweries whose first medal came in ${meta.latest_complete}: <a href="${r}first-time-medalists/${meta.latest_complete}/">first time medalists</a>.</p></div>
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
  const bars = withEntries.slice(0, 20).map((c) => ({ label: `${c.name}${c.special ? ' (special)' : ''}`, value: c.entries, href: `${r}categories/${c.slug}/` }));
  const families = items(countBy(rows, 'style_family'));
  const odds = oddsItems(rows);
  return `<div class="grid">
${withEntries.length ? barsFigure('most-entered', 'Most entered categories', bars, { subtitle: 'latest year in view with entry counts', labelWidth: 250, valueName: 'Entrants', labelHeader: 'Category' }) : '<div class="card"><h2>most-entered-categories</h2><p class="muted">No entry counts in view.</p></div>'}
${barsFigure('family-medals', 'Medals by style family', families, { color: 'var(--series-3)', labelHeader: 'Style family' })}
</div>
${odds.figure}
<h2>all-categories-in-view</h2>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([{ key: 'name', label: 'Category', render: (c) => `<a href="${r}categories/${esc(c.slug)}/">${esc(c.name)}</a>` }, { key: 'type', label: 'Type', render: (c) => (c.special ? 'special' : 'classic') }, { key: 'style_family', label: 'Style family' }, { key: 'entries', label: 'Latest entrants', numeric: true, render: (c) => fmt(c.entries) }, { key: 'year', label: 'Year', numeric: true }, { key: 'medals', label: 'Medals in view', numeric: true, render: (c) => medalsBy.get(c.name) ?? 0 }, { key: 'abv', label: 'ABV (style)', render: (c) => (c.abv_min ? `${esc(c.abv_min)} to ${esc(c.abv_max)}%` : '') }], withEntries)}</div>`;
}

// Medal odds: entries per medal by category, pooled over the years in view. Rows without an
// official entry count are left out and counted in the note.
export function oddsItems(rows, { limit = 20 } = {}) {
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
  const note = `Entries divided by medals awarded in the category, pooled over the years in view.${missing ? ` ${missing} medal${missing === 1 ? ' in view has no published entry count and is' : 's in view have no published entry count and are'} left out.` : ''}`;
  const top = list.slice(0, limit);
  return {
    list,
    note,
    figure: list.length ? figure({ id: 'entry-odds', title: 'Hardest categories to medal in', subtitle: 'entries per medal, highest first', height: Math.max(200, 30 * top.length + 60), option: barsHOption({ items: top, valueName: 'Entries per medal', labelWidth: 250, saveName: 'entries-per-medal' }), note, table: tableHtml([{ key: 'label', label: 'Category' }, { key: 'value', label: 'Entries per medal', numeric: true }, { key: 'entries', label: 'Entries', numeric: true }, { key: 'medals', label: 'Medals awarded', numeric: true }, { key: 'years', label: 'Years' }], list, { className: 'data-table' }) }) : '',
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
  return `${figure({ id: 'state-map', title: 'Medals by state', subtitle: 'medals in view', height: 460, option: mapOption({ data: mapData, saveName: 'medals-by-state-map' }), table: tableHtml([{ key: 'name', label: 'State' }, { key: 'value', label: 'Medals', numeric: true }], mapData.filter((d) => d.value).sort((a, b) => b.value - a.value), { className: 'data-table' }) })}
<div class="grid">
${barsFigure('state-medals', 'Medals by state', list.slice(0, 20).map((s) => ({ label: s.name, value: s.medals })), { subtitle: 'top 20', labelHeader: 'State' })}
${barsFigure('state-per-capita', 'Medals per million residents', perCap, { subtitle: 'top 20, annual population estimates', color: 'var(--series-3)', valueName: 'Per million', labelHeader: 'State' })}
</div>
<h2>all-states-in-view</h2>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([{ key: 'name', label: 'State' }, { key: 'region', label: 'Region' }, { key: 'division', label: 'Division' }, { key: 'medals', label: 'Medals', numeric: true }, gsbColumn((s) => s.split), { key: 'latest', label: `${latest}`, numeric: true }, { key: 'breweries', label: 'Breweries', numeric: true }, { key: 'pop_latest', label: `Population ${latest}`, numeric: true, render: (s) => fmt(s.pop_latest) }, { key: 'per_million', label: 'Per million', numeric: true, render: (s) => s.per_million.toFixed(2) }, { key: 'per_100b', label: 'Per $100B real GDP', numeric: true, render: (s) => s.per_100b.toFixed(2) }], list)}</div>`;
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
  const cols = [{ key: 'name', label: 'Name' }, { key: 'medals', label: 'Medals', numeric: true }, gsbColumn((x) => x.split), { key: 'breweries', label: 'Breweries', numeric: true }, { key: 'states', label: 'States', numeric: true }, { key: 'per_million', label: 'Per million', numeric: true, render: (x) => x.per_million.toFixed(2) }];
  return `<div class="grid">
${figure({ id: 'region-medals', title: 'Medals by region', height: 220, option: barsHOption({ items: regions.map((x) => ({ label: x.name, value: x.medals })), saveName: 'medals-by-region' }), table: tableHtml(cols, regions, { className: 'data-table' }) })}
${figure({ id: 'division-medals', title: 'Medals by division', height: Math.max(220, 36 * divisions.length + 60), option: barsHOption({ items: divisions.map((x) => ({ label: x.name, value: x.medals })), color: 'var(--series-3)', saveName: 'medals-by-division' }), table: tableHtml(cols, divisions, { className: 'data-table' }) })}
</div>`;
}

function ownershipView(rows, ctx) {
  const { page } = ctx;
  const byType = countBy(rows, 'ownership_type').map(([v, value]) => ({ label: valueLabel('ownership_type', v), value }));
  const indep = rows.filter((x) => ['independent', 'employee-owned', 'unlisted'].includes(x.ownership_type)).length;
  const ownedKeys = new Set(rows.filter((x) => !['independent', 'employee-owned', 'unlisted'].includes(x.ownership_type)).map((x) => x.brewery_key));
  const parents = items(countBy(rows.filter((x) => ownedKeys.has(x.brewery_key)).map((x) => ({ p: x.parent || valueLabel('ownership_type', x.ownership_type) })), 'p'));
  const listed = new Set(rows.filter((x) => page.ownershipKeys.includes(x.brewery_key)).map((x) => x.brewery_key)).size;
  return `<div class="stats">${statTile({ label: 'Medals to independents', value: pct(indep, rows.length), note: `${fmt(indep)} of ${fmt(rows.length)} medals in view; no ownership record counts as independent` })}${statTile({ label: 'Medalists with an ownership record', value: String(listed) })}${statTile({ label: 'Large brewer or conglomerate owned medalists', value: String(ownedKeys.size) })}</div>
<div class="grid">
${barsFigure('ownership-type', 'Medals by ownership type', byType, { labelWidth: 230, labelHeader: 'Ownership' })}
${parents.length ? barsFigure('parents', 'Medals by parent company', parents, { subtitle: 'owners that are not independent', color: 'var(--series-2)', labelWidth: 230, labelHeader: 'Parent' }) : '<div class="card"><h2>parents</h2><p class="muted">No medalist in view is owned by a large brewer or conglomerate.</p></div>'}
</div>`;
}

function economicsView(rows, ctx) {
  const { r, page } = ctx;
  const info = page.breweries;
  const keys = new Set(rows.map((x) => x.brewery_key));
  const list = [...keys].map((k) => info[k]).filter(Boolean).sort((a, b) => (b.arr ?? 0) - (a.arr ?? 0));
  const bars = list.slice(0, 15).map((b) => ({ label: b.name, value: b.arr, href: `${r}breweries/${b.slug}/` }));
  return `${barsFigure('arr-by-brewery', 'Estimated ARR by brewery (E)', bars, { subtitle: 'top 15 medalists in view', color: 'var(--series-5)', labelWidth: 220, valueName: 'ARR USD', labelHeader: 'Brewery' })}
<h2>all-medalists-in-view</h2>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([
    { key: 'name', label: 'Brewery', render: (b) => `<a href="${r}breweries/${esc(b.slug)}/">${esc(b.name)}</a>` },
    { key: 'type', label: 'Type', render: (b) => esc(valueLabel('brewery_type', b.brewery_type)) },
    { key: 'locations', label: 'Locations', numeric: true, render: (b) => b.locations_count },
    { key: 'barrels', label: 'Barrels (E)', numeric: true, cellClass: 'est-cell', sortValue: (b) => b.barrels ?? 0, render: (b) => `${fmt(b.barrels)}${b.basis === 'reported' ? '' : ` ${estMark(b.key, 'barrels')}`}` },
    { key: 'basis', label: 'Volume source', render: (b) => esc(valueLabel('basis', b.basis)) },
    { key: 'cases', label: 'Case equiv.', numeric: true, render: (b) => fmt(b.cases) },
    { key: 'arr', label: 'ARR USD (E)', numeric: true, cellClass: 'est-cell', sortValue: (b) => b.arr ?? 0, render: (b) => `${usd(b.arr)} ${estMark(b.key, 'arr')}` },
    { key: 'gm', label: 'Gross margin (E)', numeric: true, cellClass: 'est-cell', sortValue: (b) => b.gross_margin ?? 0, render: (b) => `${pctOf(b.gross_margin)} ${estMark(b.key, 'gross_margin')}` },
    { key: 'ebitda', label: 'EBITDA USD (E)', numeric: true, cellClass: 'est-cell', sortValue: (b) => b.ebitda ?? 0, render: (b) => `${usd(b.ebitda)} ${estMark(b.key, 'ebitda')}` },
    { key: 'ebitda_range', label: 'EBITDA margin range', render: (b) => `${pctOf(b.ebitda_margin_low)} to ${pctOf(b.ebitda_margin_high)}` },
    { key: 'channel', label: 'Distribution', render: (b) => esc(valueLabel('distribution_channel', b.distribution_channel || 'unknown')) },
    { key: 'ownership', label: 'Ownership', render: (b) => esc(valueLabel('ownership_type', b.ownership_type || 'unlisted')) },
  ], list)}</div>`;
}

function trendsView(rows, ctx) {
  const { r, meta, state } = ctx;
  const years = yearsInView(meta, state);
  const top = countBy(rows, 'style_family').slice(0, SERIES_COLORS.length - 1).map(([k]) => k);
  const series = [...top, 'Other'].map((f, i) => ({ name: f, color: f === 'Other' ? 'var(--mark-other)' : SERIES_COLORS[i], data: years.map((y) => rows.filter((x) => x.year === y && (top.includes(x.style_family) ? x.style_family === f : f === 'Other')).length) }));
  const complete = years.filter((y) => meta.coverage[y] === 'complete' && rows.some((x) => x.year === y));
  let movers = '<div class="notice">Year over year movers appear when two complete years are in view.</div>';
  if (complete.length >= 2) {
    const [prev, last] = complete.slice(-2);
    const names = new Map(rows.map((x) => [x.brewery_key, { name: x.brewery_name, slug: x.brewery_slug }]));
    const diffs = [...names.keys()].map((k) => ({ ...names.get(k), d: rows.filter((x) => x.brewery_key === k && x.year === last).length - rows.filter((x) => x.brewery_key === k && x.year === prev).length })).filter((x) => x.d !== 0).sort((a, b) => b.d - a.d);
    movers = `<h2>Movers ${prev} to ${last}</h2><div class="grid two"><div class="card"><h3>gained</h3><ol class="small">${diffs.slice(0, 10).filter((x) => x.d > 0).map((x) => `<li><a href="${r}breweries/${esc(x.slug)}/">${esc(x.name)}</a> +${x.d}</li>`).join('')}</ol></div><div class="card"><h3>lost</h3><ol class="small">${diffs.slice(-10).reverse().filter((x) => x.d < 0).map((x) => `<li><a href="${r}breweries/${esc(x.slug)}/">${esc(x.name)}</a> ${x.d}</li>`).join('')}</ol></div></div>`;
  }
  return `${figure({ id: 'family-share', title: 'Medals by style family and year', subtitle: 'top four families in view plus Other', height: 320, option: stackedColumnsOption({ labels: years, notes: years.map((y) => (meta.coverage[y] === 'complete' ? '' : meta.coverage[y])), series, saveName: 'style-family-by-year', selectiveLabels: false }), table: tableHtml([{ key: 'year', label: 'Year' }, ...series.map((f) => ({ key: f.name, label: f.name, numeric: true, render: (row) => f.data[row.i] }))], years.map((y, i) => ({ year: y, i })), { className: 'data-table' }) })}
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
