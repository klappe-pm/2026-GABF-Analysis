// The medal data and the shared pieces built from it: the decorated medal rows, the payload every dashboard reads
// (results, meta and per brewery summaries), the estimate explanations, and the few HTML pieces the single file
// dashboard (scripts/build-standalone.mjs) embeds: a brewery's profile card and the about section. The web app reads
// the same functions through web/lib (site-model.mjs and the models), so the two never drift apart. This was the
// page builder of the retired static site (scripts/build-site.mjs); its pages are now the web app's.

import { marked } from 'marked';
import { breweryAttributeLookup } from './data-model.mjs';
import { ABV_BANDS } from './style-families.mjs';
import { compact, countBy, esc, tableHtml, titleCase } from '../../site/assets/charts.mjs';
import { DATA_SLUGS, FILTER_COPY_KEYS, unslugText, valueLabel } from '../../site/assets/filter-bar.mjs';
import { estMark } from '../../site/assets/estimates.mjs';
import { ambiguousFirstTimers, firstTimeStatus } from './first-time.mjs';
import { loadWinnerProfiles, matchKey } from './winner-profiles.mjs';
import { loadSiteCopy } from './site-copy.mjs';
import { siteTextKeys } from './site-text-keys.mjs';
import { setSiteText, TEXT_GROUPS } from '../../site/assets/site-text.mjs';
import { HOP_COPY_DEFAULTS } from '../../site/assets/hop-links.mjs';
import { BEER_CARD_DEFAULTS } from '../../site/assets/profile-cards.mjs';

// Visible copy that has a key in .docs/content-management-system/ is read from there (see lib/site-copy.mjs).
const COPY = loadSiteCopy();
const REPO_URL = 'https://github.com/klappe-pm/GABF-Analysis';
const WINNER_YEAR = 2026;
const fmt = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-US'));
const usd = (n) => `$${compact(n)}`;
const pctOf = (x) => `${Math.round(Number(x) * 100)}%`;
const NOT_FOUND_TEXT = COPY('global.labels.not_found');
const NOT_DEFINED = `<span class="muted">${esc(NOT_FOUND_TEXT)}</span>`;
// The words the shared table views draw for hops, from pages/hop-detail.md, shipped on meta.copy.hops.
const HOP_SHARED_COPY = () => Object.fromEntries(Object.keys(HOP_COPY_DEFAULTS).map((k) => [k, COPY(`pages.hop-detail.shared_views.${k}`)]));
const CARD_COPY = () => Object.fromEntries(Object.keys(BEER_CARD_DEFAULTS).map((k) => [k, COPY(`pages.profile-cards.beer.${k}`)]));
// The global filter's dimension labels and group legends, from global/filters.md: shipped on meta.copy.filters
// and in every page's #filter-copy script, so the header filter reads the same words as the Material app.
// The copy entries the old site's code reads through tx (site/assets/site-text.mjs): set here for the
// build's own rendering, written into every page's #site-text script, and shipped on meta.copy.text.
const SITE_TEXT = Object.fromEntries([...siteTextKeys(), ...TEXT_GROUPS.flatMap((g) => COPY.keysUnder(g))].map((k) => [k, COPY.raw(k)]));
setSiteText(SITE_TEXT);
const FILTER_COPY = () => Object.fromEntries(Object.entries(FILTER_COPY_KEYS).map(([section, keys]) => [section, Object.fromEntries(keys.map((k) => [k, COPY(`global.filters.${section}.${k}`)]))]));

// Winner research profiles keyed by year plus matchKey; filled by enrichResults().
const PROFILES = new Map();
const profileKey = (year, beer, medal, category) => `${year}|${matchKey(beer, medal, category)}`;
const profileFor = (row) => (row.competition && row.competition !== 'GABF' ? null : PROFILES.get(profileKey(row.year, row.beer_name, row.medal, row.category_name)) ?? null);

function mapLink(loc) {
  if (loc.latitude && loc.longitude) return `https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=15/${loc.latitude}/${loc.longitude}`;
  const q = [loc.address_1 ?? loc.address, loc.city, loc.state].filter(Boolean).join(', ');
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`;
}

// ---------- data exports ----------
const RESULT_FIELDS = ['year', 'competition', 'section', 'category_number', 'category_name', 'category_slug', 'category_type', 'special', 'entries', 'category_medals', 'medal', 'beer_name', 'brewery_name', 'brewery_key', 'brewery_slug', 'brewery_location', 'city', 'state', 'state_name', 'region', 'division', 'fed_district', 'fed_district_name', 'fed_district_method', 'style_family', 'abv_min', 'abv_max', 'abv', 'ibu', 'abv_source', 'ibu_source', 'spec_note', 'beer_url', 'abv_band', 'points', 'partial', 'draft', 'notes', 'brewery_type', 'ownership_type', 'parent', 'distribution_channel', 'beer_profile', 'first_time', 'search_extra', 'hop_varieties', 'hop_farms_named', 'hop_farms_grown', 'beer_style', 'tasting_note', 'tasting_source'];

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
  const attrs = breweryAttributeLookup(ds);
  for (const r of ds.results) {
    const b = byKey.get(r.brewery_key);
    const a = attrs(r);
    // The site's stated-gap tokens: a blank type, 'unlisted' ownership and 'unknown' distribution all read Not Found.
    r.brewery_type = a.brewery_type ?? '';
    r.ownership_type = a.ownership_type ?? 'unlisted';
    r.parent = b?.ownership?.parent ?? '';
    r.distribution_channel = a.distribution_channel ?? 'unknown';
    r.category_medals = perCat.get(`${r.year}|${r.category_name}`) ?? null;
    const p = profileFor(r);
    if (p) {
      r.beer_profile = `beers/${p.year}/${p.stem}/`;
      r.search_extra = [p.fm.style, ...(p.fm.hops ?? []), ...(p.fm.malts ?? []), ...(p.fm.yeast ?? []), ...(p.fm.adjuncts ?? [])].filter(Boolean).join(' ');
    }
    r.abv_source = r.spec?.abv.source?.url ?? null;
    r.ibu_source = r.spec?.ibu.source?.url ?? null;
    r.beer_url = r.spec?.beer_url ?? null;
    // A current published value (Catalog.beer or a brewery site) is labelled as such, never as the medal year's figure.
    const cur = r.spec?.current ? (r.spec.abv.source ?? r.spec.ibu.source ?? r.spec.style.source) : null;
    r.spec_note = cur ? [COPY('global.tables.medal_columns.current_value', { source: cur.label, date: r.spec.retrieved }), r.spec.confidence === 'medium' ? COPY('global.tables.medal_columns.current_value_medium') : ''].filter(Boolean).join('; ') : null;
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
  const assumed = !b.brewery_type;
  // No source states the type, so the generic default row of estimation-parameters.json is used and the text says so.
  const type = assumed ? 'brewery of an assumed generic type (no source states its brewery type)' : valueLabel('brewery_type', b.brewery_type).toLowerCase();
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
    ['Brewery type', assumed ? `${NOT_FOUND_TEXT} (estimate uses an assumed generic type)` : valueLabel('brewery_type', b.brewery_type)],
    ['Locations', String(n)],
    ['Kitchen', b.has_kitchen === null || b.has_kitchen === undefined ? `${NOT_FOUND_TEXT} (no food revenue is added)` : b.has_kitchen ? 'Yes' : 'No'],
    ['Distribution', b.distribution_channel ? valueLabel('distribution_channel', b.distribution_channel) : NOT_FOUND_TEXT],
    ['Employees', b.employees ? num(b.employees) : NOT_FOUND_TEXT],
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
    copy: { hops: HOP_SHARED_COPY(), cards: CARD_COPY(), filters: FILTER_COPY(), text: SITE_TEXT },
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
  // Section headings and table headers written in the research documents read in title case on the site.
  return unslugText(html, PROSE_SLUGS).replace(/<(h[2-6]|th)(\s[^>]*)?>([^<]+)<\/\1>/g, (m, tag, attrs = '', text) => `<${tag}${attrs}>${titleCase(text)}</${tag}>`);
}

// ---------- categories ----------
// Category names drift between years ("American-Style Pilsener" and "American Pilsener"). Fold away
// accents, case, "-Style", "&" versus "and", a trailing "Beer", and punctuation, then require exact
// equality, so "Juicy or Hazy IPA" never borrows the imperial category's text.
export const foldCategory = (name) => String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[-\s]style\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+beers?$/, '').replace(/\s+/g, '');


// ---------- about ----------
export function aboutHtml(ds) {
  const SOURCE = { complete: 'Official winners list', partial: 'A sample of medals from secondary sources', draft: 'Transcribed from the awards ceremony, pending the official list', pending: 'Not available' };
  const rows = ds.years.map((y) => ({ year: y, status: ds.coverage[y], rows: ds.results.filter((x) => x.year === y).length, source: SOURCE[ds.coverage[y]] ?? 'Not available' }));
  return `
<h1>About This Site</h1>
<p class="lede">An independent analysis of Great American Beer Festival competition results, built from public data and published with GitHub Pages. Charts are drawn with Apache ECharts; each one has a table view and saves as a PNG. The <a href="${REPO_URL}">source code and data</a> are public.</p>
<h2>coverage</h2>
<div tabindex="0" role="region" aria-label="Scrollable data table" class="table-wrap">${tableHtml([{ key: 'year', label: 'Year', numeric: true }, { key: 'status', label: 'Status', render: (x) => `<span class="pill ${x.status}">${esc(x.status.charAt(0).toUpperCase() + x.status.slice(1))}</span>` }, { key: 'rows', label: 'Medals on This Site', numeric: true }, { key: 'source', label: 'Source', render: (x) => `<span class="small">${esc(x.source)}</span>` }], rows)}</div>
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

