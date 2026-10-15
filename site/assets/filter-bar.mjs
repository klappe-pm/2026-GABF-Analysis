// The site's one filter: dimension definitions, display labels for raw values, the filtering rule
// (complete years by default), option counts, chips, the global state (URL hash first, then
// browser storage, then the default), and the header control with its panel. The pure functions
// run in Node (build and tests) and in the browser; createGlobalFilter needs a DOM.

import { NOT_FOUND } from './not-found.mjs';
import { titleCase } from './title-case.mjs';
import { esc } from './charts.mjs';
import { compareLabels, compareYearsNewestFirst, compareBands } from './sort-order.mjs';
import { tx } from './site-text.mjs';

export const FILTERS = [
  { id: 'year', label: 'Year', group: 'When' },
  { id: 'medal', label: 'Medal', group: 'What' },
  { id: 'category_type', label: 'Category Type', group: 'What' },
  { id: 'style_family', label: 'Style Family', group: 'What' },
  { id: 'category_name', label: 'Category', group: 'What' },
  { id: 'abv_band', label: 'ABV Band', group: 'What' },
  // A beer lists several hops and farms, so these read an array on the row (`field`) and match when
  // it holds the picked value. The two farm filters are separate on purpose: one is the farm the
  // brewery named, the other a farm that grows a hop the beer uses. They are never combined.
  // The Explore filters. Characteristics are words found in the category name (a row lists several). The
  // investor filter is built but hidden until the owner turns it on (`hidden`).
  { id: 'section', label: 'Section', group: 'What' },
  { id: 'characteristic', field: 'traits', multi: true, label: 'Category Characteristic', group: 'What' },
  { id: 'investor', label: 'Investor', group: 'Who', hidden: true },
  { id: 'hop_variety', field: 'hop_varieties', multi: true, label: 'Hop Variety', group: 'What' },
  { id: 'hop_farm_named', field: 'hop_farms_named', multi: true, label: 'Hop Farm Named by the Brewery', group: 'What' },
  { id: 'hop_farm_grown', field: 'hop_farms_grown', multi: true, label: 'Hop Farm That Grows a Hop Used', group: 'What' },
  { id: 'region', label: 'Region', group: 'Where' },
  { id: 'state', label: 'State', group: 'Where' },
  { id: 'city', label: 'City', group: 'Where' },
  { id: 'fed_district_name', label: 'Fed District', group: 'Where' },
  { id: 'brewery_key', label: 'Brewery', group: 'Who' },
  { id: 'brewery_type', label: 'Brewery Type', group: 'Who' },
  { id: 'ownership_type', label: 'Ownership', group: 'Who' },
  { id: 'distribution_channel', label: 'Distribution', group: 'Who' },
];
export const GROUPS = ['When', 'What', 'Where', 'Who'];

// The words of the filter come from the copy documents (global/filters.md, dimensions and groups): the
// build ships them in each page's #filter-copy script and on meta.copy.filters, so an edit to the copy
// reaches this site and the Material app alike. The labels above are only the fallback when no copy
// was shipped (a test, an old payload).
export const FILTER_COPY_KEYS = { dimensions: FILTERS.map((f) => f.id), groups: GROUPS.map((g) => g.toLowerCase()) };
export const dimensionLabel = (def, copy = null) => copy?.dimensions?.[def.id] ?? def.label;
export const groupLabel = (group, copy = null) => copy?.groups?.[group.toLowerCase()] ?? group;
function pageFilterCopy() {
  try { return JSON.parse(document.getElementById('filter-copy')?.textContent || 'null'); } catch (e) { return null; }
}
// Only these keys are global filter state. Page keys in the hash (tab, brewery) are never stored.
export const STATE_KEYS = [...FILTERS.map((f) => f.id), 'q', 'years'];
export const STORAGE_KEY = 'gabf-filters';

// Display text for raw slugs stored in the data.
export const VALUE_LABELS = {
  ownership_type: { independent: 'Independent', 'employee-owned': 'Employee Owned', 'public-company-owned': 'Public Company Owned', 'large-brewer-owned': 'Large Brewer Owned', 'private-equity-backed': 'Private Equity Backed', 'beverage-conglomerate-owned': 'Beverage Conglomerate Owned', closed: 'Closed', unlisted: NOT_FOUND },
  distribution_channel: { 'self-distribution': 'Self Distributed', distributor: 'Through a Distributor', taproom: 'Taproom Only', unknown: NOT_FOUND, '': NOT_FOUND },
  brewery_type: { micro: 'Microbrewery', brewpub: 'Brewpub', regional: 'Regional Brewery', planning: 'In Planning', large: 'Large Brewery', closed: 'Closed', contract: 'Contract Brewer', proprietor: 'Alternating Proprietor', nano: 'Nanobrewery', bar: 'Bar', taproom: 'Taproom' },
  category_type: { classic: 'Classic Style', special: 'Special' },
  basis: { 'type-heuristic': 'Estimated from Brewery Type', 'boty-bracket': 'Brewery of the Year Size Bracket', estimate: 'Curated Estimate', reported: 'Reported', bracket: 'Size Bracket', curated: 'Curated Estimate', heuristic: 'Estimated from Brewery Type', 'profile estimate': 'Brewery Profile Estimate' },
  section: { main: 'Main Competition', 'pro-am': 'Pro-Am', collaboration: 'Collaboration' },
  characteristic: { sour: 'Sour or Wild Category', fruit: 'Fruit Category', spice: 'Herb or Spice Category', coffee: 'Coffee Category', chocolate: 'Chocolate Category', barrel_aged: 'Wood or Barrel Category', non_alcoholic: 'Nonalcoholic Category', gluten_free: 'Gluten-Free Category' },
  first_time: { new: 'First Medal in the Loaded Record', 'new-complete': 'First Medal in the Complete Record' },
};

// Data slugs that must never show as text: every value label key plus trend status keys.
export const DATA_SLUGS = [...new Set([...Object.values(VALUE_LABELS).flatMap((m) => Object.keys(m)), 'did-not-exist', 'not-yet-reported', 'no-data', 'no-results', 'no-medal'].filter((k) => k.includes('-')))];

// Replace known slugs in the text of rendered HTML (never inside tags, code, or link targets)
// with plain words, so prose that mentions a field or status by its key still reads as English.
export function unslugText(html, slugs) {
  const set = new Set(slugs);
  if (!set.size) return html;
  let skip = 0;
  return String(html).split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) { if (/^<(code|pre|script|style)\b/i.test(part)) skip += 1; else if (/^<\/(code|pre|script|style)>/i.test(part)) skip -= 1; return part; }
    if (skip > 0) return part;
    return part.replace(/(^|[^\w\/.-])([a-z][a-z0-9]*(?:-[a-z0-9]+)+)(?![\w\/-]|\.\w)/g, (m, pre, slug) => (set.has(slug) ? `${pre}${slug.replace(/-/g, ' ')}` : m));
  }).join('');
}

// Every filter lists the rows that hold no value as one option, so a missing value can be found.
// The token is non-empty because an empty selection means All. The site's older stated-gap
// tokens (ownership 'unlisted', distribution 'unknown') fold into it, so there is one such option.
export const NOT_DEFINED = 'not-defined';
const LEGACY_BLANKS = { ownership_type: 'unlisted', distribution_channel: 'unknown' };
const foldBlank = (id, v) => (v === '' || v === LEGACY_BLANKS[id] ? NOT_DEFINED : v);

// The value labels with a group in global/labels.md read from the copy; VALUE_LABELS stands in when no
// copy was shipped. The basis labels stay here: their copy entries carry the (E) mark, which the views
// add on their own.
const COPY_LABEL_GROUPS = new Set(['ownership_type', 'distribution_channel', 'brewery_type', 'category_type', 'section', 'characteristic', 'first_time']);
const notFound = () => tx('global.labels.not_found', NOT_FOUND);

export function valueLabel(id, value, meta = null) {
  const v = String(value ?? '');
  if (v === NOT_DEFINED) return notFound();
  if (id === 'brewery_type' && !v) return notFound();
  if (id === 'state') return meta?.states?.find((s) => s.state === v)?.name ?? v;
  if (id === 'city') return v.replace(/\s+-\s+/g, ', ');
  if (id === 'brewery_key') return meta?.names?.brewery_key?.[v] ?? v;
  if (id === 'abv_band') {
    const band = meta?.abv_bands?.find((b) => b.id === v);
    if (band) return band.label;
    if (v === 'under-4') return tx('global.labels.abv_band.under-4', 'Under 4%');
    if (/^\d+-to-\d+$/.test(v)) return `${v.replace('-to-', ' to ')}%`;
    return v;
  }
  if (VALUE_LABELS[id] && Object.hasOwn(VALUE_LABELS[id], v)) {
    if (!COPY_LABEL_GROUPS.has(id)) return VALUE_LABELS[id][v];
    return tx(`global.labels.${id}.${v === '' ? '(blank)' : v}`, VALUE_LABELS[id][v]);
  }
  // Unknown slug: show it as words rather than as a slug.
  return /^[a-z0-9]+(-[a-z0-9]+)+$/.test(v) ? titleCase(v.replace(/-/g, ' ')) : v;
}

// ---------- state ----------
export function parseHash(hash) {
  const out = {};
  for (const part of String(hash ?? '').replace(/^#/, '').split('&')) {
    const [k, v] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return out;
}
export function hashFor(obj) {
  const parts = Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `#${parts.join('&')}` : '';
}
export function pickState(obj) {
  const out = {};
  for (const k of STATE_KEYS) if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') out[k] = String(obj[k]);
  if (out.years && out.years !== 'all') delete out.years;
  return out;
}
// The URL wins when it carries any filter key; otherwise the stored selection; otherwise the default.
export function resolveState(hashObj, stored) {
  const fromHash = pickState(hashObj);
  if (Object.keys(fromHash).length) return fromHash;
  return pickState(stored ?? {});
}
export const isDefaultState = (s) => Object.keys(pickState(s)).length === 0;

export function readStored(storage) {
  try { const raw = storage?.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
export function writeStored(storage, state) {
  try { if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(pickState(state))); } catch (e) { /* storage unavailable: the hash still carries the view */ }
}

// ---------- rows ----------
// Shared payload rows carry brewery attributes already; older payloads get them from meta.
export function decorateRows(rows, meta) {
  // The brewery names, kept on meta so a Brewery chip reads as a name wherever meta travels.
  if (meta && typeof meta === 'object') meta.names = { ...meta.names, brewery_key: Object.fromEntries(rows.map((r) => [r.brewery_key, r.brewery_name])) };
  return rows.map((r) => (r.ownership_type ? r : {
    ...r,
    brewery_type: r.brewery_type || meta?.brewery_types?.[r.brewery_key] || '',
    ownership_type: meta?.ownership?.[r.brewery_key]?.ownership_type ?? 'unlisted',
    parent: meta?.ownership?.[r.brewery_key]?.parent ?? '',
    distribution_channel: r.distribution_channel || meta?.distribution?.[r.brewery_key] || 'unknown',
  }));
}

// A page's own scope (one brewery, one category, one year) is applied before the global filter
// and never enters the global state.
export function scopeRows(rows, scope = {}) {
  const entries = Object.entries(scope ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? rows.filter((r) => entries.every(([k, v]) => String(r[k] ?? '') === String(v))) : rows;
}

// The value a row holds for a filter. A city is keyed with its state ("Portland, OR") so two
// cities that share a name stay apart.
export function fieldValue(row, id) {
  if (id === 'city') return row.city ? `${row.city}, ${row.state}` : NOT_DEFINED;
  return foldBlank(id, String(row[id] ?? ''));
}

// Every value a row holds for a filter: one for a plain filter, the whole list for a multi filter.
export function fieldValues(row, id) {
  const def = FILTERS.find((d) => d.id === id);
  if (!def?.multi) return [fieldValue(row, id)];
  const list = row[def.field];
  return Array.isArray(list) && list.length ? list.map(String) : [NOT_DEFINED];
}

// The value a selection holds, with the older gap tokens read as Not Found.
export const selectedValue = (s, id) => foldBlank(id, String(s[id] ?? ''));

// Partial years (seed rows only) stay out unless a year is picked or years=all.
export const includesPartial = (s) => s.years === 'all' || Boolean(s.year);
export function applyFilters(rows, s = {}) {
  const q = String(s.q ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    if (!includesPartial(s) && r.partial) return false;
    for (const def of FILTERS) {
      const v = s[def.id];
      if (v && !fieldValues(r, def.id).includes(selectedValue(s, def.id))) return false;
    }
    if (q.length) {
      const hay = `${r.beer_name} ${r.brewery_name} ${r.brewery_location ?? ''} ${r.city} ${r.state} ${r.state_name ?? ''} ${r.category_name} ${r.style_family ?? ''} ${r.search_extra ?? ''}`.toLowerCase();
      if (!q.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}
export const viewRows = (rows, scope, s) => applyFilters(scopeRows(rows, scope), s);

// Progressive options. The options for one filter are the values present in the rows that match
// every other active selection (and the search), each with its count under those selections, so
// no option ever leads to zero results. The year list also offers partial years, because picking
// one brings its rows into view; the other lists count partial years only when they are in view.
export function optionList(scope, id, s = {}, meta = null) {
  const others = { ...s };
  delete others[id];
  if (id === 'year') others.years = 'all';
  const pool = applyFilters(scope, others);
  const counts = new Map();
  const names = new Map();
  for (const r of pool) {
    for (const v of new Set(fieldValues(r, id))) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
      if (id === 'brewery_key' && !names.has(v)) names.set(v, r.brewery_name || v);
    }
  }
  let plainCity = null;
  if (id === 'city') {
    // A city shows without its state unless another state has a city of the same name.
    const states = new Map();
    for (const r of scope) if (r.city) states.set(r.city, (states.get(r.city) ?? new Set()).add(r.state));
    // One source row has a collaboration venue in its city field; a spaced hyphen there reads as a comma.
    const readable = (t) => t.replace(/\s+-\s+/g, ', ');
    plainCity = (v) => { if (v === NOT_DEFINED) return NOT_FOUND; const name = v.slice(0, v.lastIndexOf(', ')); return readable(states.get(name)?.size > 1 ? v : name); };
  }
  const labelOf = (v) => (id === 'brewery_key' && v !== NOT_DEFINED ? names.get(v) : plainCity ? plainCity(v) : valueLabel(id, v, meta));
  const list = [...counts.entries()].map(([v, n]) => ({ value: v, count: n, label: labelOf(v) }));
  // Years run newest first and ABV bands by their range (ordered bins, not names); the rest by label.
  const order = id === 'year' ? (a, b) => compareYearsNewestFirst(a.value, b.value) : id === 'abv_band' ? (a, b) => compareBands(a.value, b.value) : (a, b) => compareLabels(a.label, b.label);
  return list.sort(order);
}

// Drop any selection that the others have left with no rows, so the state never holds a filter
// that matches nothing. `keep` is the filter the user just changed; it is never dropped.
export function pruneState(scope, s, keep = null) {
  const next = { ...s };
  for (let guard = 0; guard < FILTERS.length + 1; guard += 1) {
    const stale = FILTERS.find((d) => next[d.id] && d.id !== keep && !optionList(scope, d.id, next).some((o) => o.value === selectedValue(next, d.id)));
    if (!stale) break;
    delete next[stale.id];
  }
  return next;
}

export const partialYearsIn = (rows) => [...new Set(rows.filter((r) => r.partial).map((r) => r.year))].sort();

export function activeChips(s, meta = null) {
  const chips = FILTERS.filter((d) => s[d.id]).map((d) => ({ id: d.id, text: `${dimensionLabel(d, meta?.copy?.filters)}: ${valueLabel(d.id, s[d.id], meta)}` }));
  if (s.q) chips.push({ id: 'q', text: tx('global.filters.chips.search_chip', 'Search: {{query}}', { query: s.q }) });
  if (s.years === 'all' && !s.year) chips.push({ id: 'years', text: tx('global.filters.chips.partial_chip', 'Partial Years Included') });
  return chips;
}
export const activeCount = (s) => activeChips(s).length;

// Message for an empty result: what is active, with a button that removes each filter.
export function emptyStateHtml(s, scope, meta = null) {
  const chips = activeChips(s, meta);
  const partial = !includesPartial(s) && scope.some((r) => r.partial);
  const title = tx('global.states.no_results.title', 'No medals match these filters.');
  const removeHint = tx('global.states.no_results.remove_hint', 'Remove a filter to see more.');
  const partialHint = tx('global.states.no_results.partial_hint', 'Some medals here are in partial years, which are hidden by default.');
  const removeHidden = tx('global.filters.chips.remove_hidden', '(Remove)');
  const include = tx('global.states.no_results.include_partial', 'Include Partial Years');
  return `<div class="empty-state" role="status"><p><strong>${esc(title)}</strong>${chips.length ? ` ${esc(removeHint)}` : ''}${partial ? ` ${esc(partialHint)}` : ''}</p><div class="chip-row">${chips.map((c) => `<button type="button" class="chip removable" data-remove="${esc(c.id)}">${esc(c.text)}<span aria-hidden="true"> ×</span><span class="visually-hidden"> ${esc(removeHidden)}</span></button>`).join('')}${partial ? `<button type="button" class="chip removable" data-include-partial>${esc(include)}</button>` : ''}</div></div>`;
}

export function partialNoticeHtml(rows, meta) {
  const years = partialYearsIn(rows);
  if (!years.length) return '';
  const firstComplete = meta?.years?.find((y) => meta.coverage?.[y] === 'complete');
  // The copy entry names the first complete year; with no complete year loaded, the code's wording.
  if (firstComplete) {
    const key = years.length > 1 ? 'global.states.partial_notice.many' : 'global.states.partial_notice.one';
    const fallback = years.length > 1
      ? '{{years}} include only a sample of medals from secondary sources. Complete official lists start in {{first_complete_year}}. Read those years as partial.'
      : '{{years}} includes only a sample of medals from secondary sources. Complete official lists start in {{first_complete_year}}. Read {{years}} as partial.';
    return `<div class="notice">${esc(tx(key, fallback, { years: years.join(' and '), first_complete_year: firstComplete }))}</div>`;
  }
  return `<div class="notice">${years.join(' and ')} ${years.length > 1 ? 'include' : 'includes'} only a sample of medals from secondary sources. Read counts for ${years.length > 1 ? 'those years' : 'that year'} as partial.</div>`;
}

// ---------- the header control and panel ----------
// createGlobalFilter({ trigger, chipsEl, storage, loadData }) returns a controller:
//   state            the live selection (global keys only)
//   subscribe(fn)    fn(state) after every change
//   setScope(scope, fixed)  the page scope for option counts and its fixed chips ([{ text }])
//   setData({ rows, meta }) rows and meta for counts and labels (loadData is called on first open otherwise)
//   remove(key), includePartial(), open()
export function createGlobalFilter({ trigger, chipsEl, storage = null, loadData = null }) {
  const listeners = [];
  const state = resolveState(parseHash(location.hash), readStored(storage));
  let rows = null;
  let meta = null;
  let labels = null;
  let scope = {};
  let fixed = [];
  let dialog = null;
  let timer = null;
  const pageCopy = pageFilterCopy();

  const scoped = () => scopeRows(rows ?? [], scope);
  const words = () => meta?.copy?.filters ?? pageCopy;
  // meta plus the brewery names found in the rows, so a Brewery chip reads as a name, and the filter
  // words from the page, so a chip drawn before the data loads already reads from the copy.
  function labelMeta() {
    if (!labels && rows) labels = { ...meta, names: { brewery_key: Object.fromEntries(rows.map((r) => [r.brewery_key, r.brewery_name])) } };
    const base = labels ?? meta;
    return base?.copy?.filters || !pageCopy ? base : { ...base, copy: { ...base?.copy, filters: pageCopy } };
  }
  // After a change, drop any other selection the new one has left with no results.
  function settle(keep) {
    if (!rows) return;
    const next = pruneState(scoped(), state, keep);
    for (const k of Object.keys(state)) if (!(k in next)) delete state[k];
  }
  function persist() {
    writeStored(storage, state);
    const other = Object.fromEntries(Object.entries(parseHash(location.hash)).filter(([k]) => !STATE_KEYS.includes(k)));
    try { history.replaceState(null, '', location.href.split('#')[0] + hashFor({ ...other, ...state })); } catch (e) { /* file:// may refuse; the view still works */ }
  }
  function renderTrigger() {
    if (!trigger) return;
    const n = activeCount(state);
    const label = tx('global.filters.trigger.label', 'Filters');
    trigger.innerHTML = `${esc(label)}${n ? ` <span class="filter-count">· ${n}</span>` : ''}`;
    trigger.setAttribute('aria-label', n ? tx('global.filters.trigger.accessible_label_with_count', 'Filters, {{count}} active', { count: n }) : label);
  }
  function renderChips() {
    if (!chipsEl) return;
    const chips = activeChips(state, labelMeta());
    const bar = tx('global.filters.chips.bar_label', 'Active Filters');
    const fixedTip = tx('global.filters.chips.fixed_tooltip', 'This page is limited to this value');
    const clear = tx('global.filters.chips.clear_all', 'Clear All');
    chipsEl.innerHTML = fixed.length || chips.length ? `<div class="inner chip-row" aria-label="${esc(bar)}">${fixed.map((c) => `<span class="chip fixed" title="${esc(fixedTip)}">${esc(c.text)}</span>`).join('')}${chips.map((c) => `<button type="button" class="chip removable" data-remove="${esc(c.id)}" aria-label="${esc(tx('global.filters.chips.remove_label', 'Remove Filter {{chip}}', { chip: c.text }))}">${esc(c.text)}<span aria-hidden="true"> ×</span></button>`).join('')}${chips.length ? `<button type="button" class="chip clear" data-clear>${esc(clear)}</button>` : ''}</div>` : '';
    chipsEl.hidden = !(fixed.length || chips.length);
  }
  function select(def) {
    const opts = optionList(scoped(), def.id, state, meta);
    const cur = state[def.id] ? selectedValue(state, def.id) : '';
    const missing = cur && !opts.some((o) => o.value === cur) ? `<option value="${esc(cur)}" selected>${esc(tx('global.filters.options.not_in_view', '{{label}} (0)', { label: valueLabel(def.id, cur, labelMeta()) }))}</option>` : '';
    const option = (o) => esc(tx('global.filters.options.with_count', '{{label}} ({{count}})', { label: o.label, count: o.count.toLocaleString('en-US') }));
    return `<label>${esc(dimensionLabel(def, words()))}<select id="gf-${def.id}" data-filter="${def.id}"${opts.length ? '' : ' disabled'}><option value="">${esc(tx('global.filters.options.all', 'All'))}</option>${missing}${opts.map((o) => `<option value="${esc(o.value)}"${o.value === cur ? ' selected' : ''}>${option(o)}</option>`).join('')}</select></label>`;
  }
  function renderPanel() {
    if (!dialog) return;
    const body = dialog.querySelector('.filter-panel-body');
    if (!rows) { body.innerHTML = `<p class="muted">${esc(tx('global.filters.panel.loading', 'Loading medals…'))}</p>`; return; }
    const focused = document.activeElement && dialog.contains(document.activeElement) ? document.activeElement.id : '';
    const sc = scoped();
    const partial = partialYearsIn(sc);
    const n = applyFilters(sc, state).length;
    const note = `<p class="small muted">${esc(tx('global.filters.partial_years.default_note', 'Shows complete official lists by default.'))}</p>`;
    const include = esc(tx('global.filters.partial_years.include', 'Include Partial Years ({{years}})', { years: partial.join(', ') }));
    body.innerHTML = `<label class="search">${esc(tx('global.filters.search.label', 'Search'))}<input id="gf-q" type="search" placeholder="${esc(tx('global.filters.search.placeholder', 'Beer, brewery, city, or hop'))}" value="${esc(state.q ?? '')}" autocomplete="off"></label>
<div class="filter-groups">${GROUPS.map((g) => `<fieldset class="filter-group"><legend>${esc(groupLabel(g, words()))}</legend>${FILTERS.filter((d) => d.group === g && !d.hidden).map(select).join('')}${g === 'When' ? (partial.length ? `<label class="check"><input type="checkbox" id="gf-years" data-years${state.years === 'all' ? ' checked' : ''}> ${include}</label>${note}` : note) : ''}</fieldset>`).join('')}</div>`;
    const count = n.toLocaleString('en-US');
    dialog.querySelector('.filter-panel-count').textContent = fixed.length
      ? tx('global.filters.panel.match_count_scoped', '{{count}} medals match on this page ({{scope}})', { count, scope: fixed.map((c) => c.text).join(', ') })
      : n === 1 ? tx('global.filters.panel.match_count_one', '1 medal matches') : tx('global.filters.panel.match_count_many', '{{count}} medals match', { count });
    if (focused) { const f = document.getElementById(focused); if (f) f.focus(); }
  }
  function changed() {
    persist();
    renderTrigger();
    renderChips();
    renderPanel();
    listeners.forEach((fn) => fn(state));
  }
  function clearAll() { for (const k of STATE_KEYS) delete state[k]; changed(); }
  function remove(key) { delete state[key]; changed(); }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'filter-panel';
    dialog.setAttribute('aria-labelledby', 'gf-title');
    const title = esc(tx('global.filters.panel.title', 'Filter Medals'));
    const close = esc(tx('global.filters.panel.close', 'Close'));
    const reset = esc(tx('global.filters.panel.reset', 'Clear All'));
    const apply = esc(tx('global.filters.panel.apply', 'Show Results'));
    dialog.innerHTML = `<div class="filter-panel-head"><h2 id="gf-title">${title}</h2><button type="button" class="btn" data-close>${close}</button></div><div class="filter-panel-body"></div><div class="filter-panel-foot"><p class="filter-panel-count" aria-live="polite"></p><button type="button" class="btn" data-clear>${reset}</button><button type="button" class="btn primary" data-close>${apply}</button></div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.filter) {
        if (t.value) state[t.dataset.filter] = t.value; else delete state[t.dataset.filter];
        settle(t.dataset.filter);
        changed();
      } else if (t.hasAttribute('data-years')) {
        if (t.checked) state.years = 'all'; else delete state.years;
        settle(null);
        changed();
      }
    });
    dialog.addEventListener('input', (e) => {
      if (e.target.id !== 'gf-q') return;
      clearTimeout(timer);
      timer = setTimeout(() => { if (e.target.value) state.q = e.target.value; else delete state.q; changed(); }, 200);
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) { dialog.close(); return; }
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-close')) dialog.close();
      else if (b.hasAttribute('data-clear')) clearAll();
    });
    // The browser restores focus after the close event; return it to the trigger after that.
    dialog.addEventListener('close', () => { if (trigger) setTimeout(() => trigger.focus(), 0); });
    return dialog;
  }
  function open() {
    ensureDialog();
    renderPanel();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    dialog.addEventListener('close', () => trigger && trigger.setAttribute('aria-expanded', 'false'), { once: true });
    const first = dialog.querySelector('#gf-q');
    if (first) first.focus();
    if (!rows && loadData) loadData().then((d) => { api.setData(d); }).catch(() => { dialog.querySelector('.filter-panel-body').innerHTML = `<p>${esc(tx('global.filters.panel.load_error', 'Filters are unavailable because the medal data did not load. Reload the page to try again.'))}</p>`; });
  }

  if (trigger) {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', open);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'f' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(input|select|textarea)$/i.test(t.tagName))) return;
    if (dialog && dialog.open) return;
    e.preventDefault();
    open();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest ? e.target.closest('button') : null;
    if (!b || (dialog && dialog.contains(b))) return;
    if (b.dataset.remove && (b.closest('.filter-chips-bar') || b.closest('.empty-state'))) remove(b.dataset.remove);
    else if (b.hasAttribute('data-clear') && b.closest('.filter-chips-bar')) clearAll();
    else if (b.hasAttribute('data-include-partial')) { state.years = 'all'; changed(); }
  });
  window.addEventListener('hashchange', () => {
    const next = pickState(parseHash(location.hash));
    if (JSON.stringify(next) === JSON.stringify(pickState(state))) return;
    for (const k of STATE_KEYS) delete state[k];
    Object.assign(state, next);
    changed();
  });

  const api = {
    state,
    subscribe(fn) { listeners.push(fn); },
    setScope(s, f = []) { scope = s ?? {}; fixed = f; renderChips(); renderPanel(); },
    setData(d) { rows = d.rows ?? rows; meta = d.meta ?? meta; labels = null; renderChips(); renderPanel(); },
    remove,
    set(key, value) { if (value) state[key] = String(value); else delete state[key]; changed(); },
    // Replace the whole selection (used by in-page links in the single-file build).
    replace(next) { for (const k of STATE_KEYS) delete state[k]; Object.assign(state, pickState(next)); changed(); },
    clear: clearAll,
    includePartial() { state.years = 'all'; changed(); },
    open,
    persist,
  };
  persist();
  renderTrigger();
  renderChips();
  return api;
}
