// The site's data at build time, from the same pipeline the static site uses: scripts/lib/data-model.mjs
// loads the dataset, and scripts/build-site.mjs decorates the medal rows and builds the shared payload.
// Nothing here forks that code; it only slices the result into the plain records each page needs.
//
// Next loads this module with Node's own import (see site-data.ts), so the pipeline runs exactly as it
// does in the Node build, and the node test runner imports it directly (tests/site-data.test.mjs).

import { resolve } from 'node:path';
import { categoryIndex, loadDataset, stripStyle } from '../../scripts/lib/data-model.mjs';
import { buildPayload, enrichResults, renderMarkdownBody } from '../../scripts/build-site.mjs';
import { humanizeHeadings } from '../../site/assets/charts.mjs';
import { scopeRows } from '../../site/assets/filter-bar.mjs';
import { traitsOf } from './models/analysis.mjs';

export const REPO = resolve(import.meta.dirname, '..', '..');
export const WINNER_YEAR = 2026;

// One load per process. Next renders pages in several workers and may load a module more than once
// in one worker, so the dataset is kept on globalThis rather than in a module variable.
const KEY = Symbol.for('gabf-analysis.site-model');

export function site() {
  const g = globalThis;
  if (!g[KEY]) {
    const ds = loadDataset({ root: REPO });
    enrichResults(ds);
    const cats = categoryIndex(ds);
    const payload = buildPayload(ds, cats);
    // The Explore filters read two fields the shared rows do not carry: the investor of the brewery's
    // ownership research and the category characteristics found by words in the category name.
    const investor = new Map(ds.breweries.filter((b) => b.ownership?.investor).map((b) => [b.key, String(b.ownership.investor)]));
    for (const r of payload.results) {
      r.investor = investor.get(r.brewery_key) ?? null;
      r.traits = traitsOf(r.category_name);
    }
    g[KEY] = { ds, cats, payload, profiles: new Map(ds.winnerProfiles.map((p) => [p.stem, p])) };
  }
  return g[KEY];
}

// ---------- generateStaticParams ----------
// Each returns the params of one dynamic route, one entry per page the current site renders.

export const beerParams = () => site().ds.winnerProfiles.map((p) => ({ year: String(p.year), stem: p.stem }));
export const breweryParams = () => site().ds.breweries.map((b) => ({ slug: b.slug }));
export const categoryParams = () => site().cats.map((c) => ({ slug: c.slug }));
export const hopParams = () => site().ds.hops.varieties.map((v) => ({ slug: v.slug }));
export const hopFarmParams = () => site().ds.hops.farms.map((f) => ({ slug: f.slug }));

// ---------- shared records ----------

// The decorated medal rows every filtered view reads (the fields of data/results.json), limited to a
// page's own scope such as { year: '2026' } or { brewery_key: 'green cheek' }.
export const medalRows = (scope = {}) => scopeRows(site().payload.results, scope);

// The fields the global filter reads on a row: every dimension, the partial year flag, and the search
// text. A page that passes rows to a client view sends these plus its own display fields, not whole rows.
export const FILTER_FIELDS = [
  'year', 'medal', 'category_type', 'style_family', 'category_name', 'abv_band', 'hop_varieties', 'hop_farms_named', 'hop_farms_grown',
  'section', 'traits', 'investor', 'region', 'state', 'city', 'fed_district_name', 'brewery_key', 'brewery_type', 'ownership_type', 'distribution_channel', 'partial',
  'beer_name', 'brewery_name', 'brewery_location', 'state_name', 'search_extra',
];
export const filterRow = (row, extra = []) => Object.fromEntries([...FILTER_FIELDS, ...extra].map((k) => [k, row[k] ?? null]));

// The two files the global filter loads in the browser: every medal row and the lookups that label them.
export function filterData() {
  const { results, meta } = site().payload;
  return { results, meta: { ...meta, legacy_category_names: legacyCategoryNames() } };
}

// Category names as the winners list printed them, mapped to the current name, for the names that changed when
// the word Style left them. The browser uses it to read old #category_name= links.
export function legacyCategoryNames() {
  const out = {};
  for (const r of site().ds.results) if (r.category_printed && r.category_printed !== r.category_name) out[r.category_printed] = r.category_name;
  return out;
}

export function counts() {
  const { ds, cats } = site();
  return {
    results: ds.results.length,
    breweries: ds.breweries.length,
    categories: cats.length,
    beers: ds.winnerProfiles.length,
    hops: ds.hops.varieties.length,
    hopFarms: ds.hops.farms.length,
    years: ds.years,
    coverage: ds.coverage,
  };
}

// The hop varieties a beer used, as the hop model resolved them, each with its hop page slug.
function beerHops(stem) {
  const beer = site().ds.hops.beers.get(stem);
  const seen = new Set();
  return (beer?.usage ?? []).filter((u) => !seen.has(u.slug) && seen.add(u.slug)).map((u) => ({ name: u.canonical, slug: u.slug }));
}

const numberOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const textOrNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const listOf = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
const stemOf = (row) => (row.beer_profile ? row.beer_profile.split('/').filter(Boolean).at(-1) : null);

// The winners list of a year: every medal row of the year, with the published specs of its beer when a
// research profile exists. Filter fields stay on each row so the global filter can narrow the list.
export function winners(year = WINNER_YEAR) {
  const { profiles } = site();
  return medalRows({ year: String(year) }).map((row) => {
    const stem = stemOf(row);
    const p = stem ? profiles.get(stem) : null;
    return {
      ...filterRow(row, ['category_number', 'category_slug', 'brewery_slug', 'entries']),
      stem,
      abv: p ? numberOrNull(p.fm.abv) : row.abv,
      ibu: p ? numberOrNull(p.fm.ibu) : null,
      hops: stem ? beerHops(stem) : [],
    };
  });
}

// Markdown research notes as page HTML: kebab headings read as words, each heading one level down so the
// notes sit under the page's own section heading, and every table scrolls inside its own box
// (data-table-scroll marks it for the table rules).
export function notesHtml(body) {
  return humanizeHeadings(renderMarkdownBody(body)).replace(/<(\/?)h([2-5])\b/g, (m, close, n) => `<${close}h${Number(n) + 1}`).replace(/<div tabindex="0" role="region" aria-label="([^"]*)" class="table-wrap">/g, '<div tabindex="0" role="region" aria-label="$1" class="table-wrap" data-table-scroll="">');
}

// One winning beer: its published specs, its medal row, the hops it used, and its research notes.
export function beer(stem) {
  const { profiles, ds } = site();
  const p = profiles.get(stem);
  if (!p) return null;
  const row = ds.results.find((r) => stemOf(r) === stem) ?? null;
  const fm = p.fm;
  const sourced = (v) => {
    if (typeof v === 'string') return textOrNull(v) ? { text: v.trim(), source: null } : null;
    if (!v || typeof v !== 'object') return null;
    const text = textOrNull(v.text);
    return text ? { text, source: textOrNull(v.source) ?? textOrNull(v.url) } : null;
  };
  return {
    stem,
    year: p.year,
    beer: String(fm.beer),
    brewery: String(fm.brewery),
    city: String(fm['brewery-city'] ?? ''),
    state: String(fm['brewery-state'] ?? ''),
    medal: String(fm.medal),
    category: row?.category_name ?? stripStyle(String(fm['category-name'])),
    categoryNumber: Number(fm['category-number']),
    entries: numberOrNull(fm.entries),
    abv: numberOrNull(fm.abv),
    ibu: numberOrNull(fm.ibu),
    style: textOrNull(fm.style),
    hops: beerHops(stem),
    malts: listOf(fm.malts),
    yeast: listOf(fm.yeast),
    adjuncts: listOf(fm.adjuncts),
    tastingNote: sourced(fm['tasting-notes']),
    description: sourced(fm.description),
    beerUrl: textOrNull(fm['beer-url']),
    breweryUrl: textOrNull(fm['brewery-url']),
    brewerySlug: row?.brewery_slug ?? null,
    categorySlug: row?.category_slug ?? null,
    notesHtml: notesHtml(p.body),
  };
}
