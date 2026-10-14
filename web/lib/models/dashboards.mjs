// Build time data for the dashboards lane: the files the dashboards read in the browser (breweries,
// brewery attributes, category summaries, estimate explanations, the CSV downloads), the home page
// lists, and the tile positions of the state grid. Pages read it through laneModel('dashboards').
//
// Every file has the address and content the current site serves, so a bookmarked or linked file keeps
// working.

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { breweryInfo, explainEstimate } from '../../../scripts/build-site.mjs';
import { TILES } from '../../../scripts/chart-gallery/data.mjs';
import { REFERENCE, RESULTS } from '../../../scripts/lib/paths.mjs';
import { site } from '../site-model.mjs';
import { categoryLines, scoresheet } from './home.mjs';

export { TILES };

const MEDAL_NAMES = ['Gold', 'Silver', 'Bronze'];

// The breweries the dashboards draw from: trend, estimate, financials, ownership. The explanations of
// each estimate are a separate file (estimatesFile), loaded when an (E) mark is opened.
export function breweriesFile() {
  return site().payload.breweries.map(({ explain, ...b }) => b);
}

export const breweryInfoFile = () => breweryInfo(site().ds);

export function estimatesFile() {
  const { ds } = site();
  return Object.fromEntries(ds.breweries.map((b) => [b.key, explainEstimate(b, ds.params)]));
}

export function categoriesFile() {
  return site().cats.map((c) => ({
    name: c.name,
    slug: c.slug,
    style_family: c.style_family,
    special: c.special,
    ref: c.ref,
    years: c.years.map((y) => ({ year: y.year, entries: y.entries, number: y.number, medals: y.medals.length })),
  }));
}

// Every CSV and JSON file of the results and reference tables, flattened into one folder, as the
// current site publishes them under /data/csv/.
const csvPaths = () => {
  const out = new Map();
  for (const dir of [RESULTS, REFERENCE]) {
    for (const f of readdirSync(dir)) if (f.endsWith('.csv') || f.endsWith('.json')) out.set(f, resolve(dir, f));
  }
  return out;
};
export const csvNames = () => [...csvPaths().keys()].sort();
export const csvFile = (name) => {
  const path = csvPaths().get(name);
  return path ? readFileSync(path, 'utf8') : null;
};

// The breweries with a deep dive profile, first six, for the overview page.
export function featuredBreweries() {
  return site().ds.breweries.filter((b) => b.profile).slice(0, 6).map((b) => ({ slug: b.slug, name: b.name, city: b.hq.city, state: b.hq.state, medals: b.medals.length }));
}

// The brewery the breweries dashboard opens on when none is picked.
export function defaultBrewery() {
  const { ds } = site();
  return ds.breweries.find((b) => b.profile || b.facts)?.key ?? ds.breweries[0]?.key ?? '';
}

// The year the rates are computed for, and the data year they borrow when the latest year is not yet
// published: "2026 uses 2025".
export function rateYears() {
  const { payload, ds } = site();
  const latest = Math.max(...payload.meta.years);
  // The reference tables say it in the source column: "2025 value used for 2026, which is not yet published".
  const source = String(Object.values(ds.stateIndicators)[0]?.population?.[latest]?.source ?? '');
  const borrowed = source.match(/(\d{4}) value used for (\d{4})/);
  return { latest, data: borrowed && Number(borrowed[2]) === latest ? Number(borrowed[1]) : latest };
}

// The medal count per state for the tile grid test and the build checks.
export function tileCheck() {
  const { payload } = site();
  const codes = new Set(payload.meta.states.map((s) => s.state));
  return { missing: [...codes].filter((c) => !TILES[c]), extra: Object.keys(TILES).filter((c) => !codes.has(c)) };
}

export { MEDAL_NAMES };

// ---------- the home page ----------

const pct = (x) => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;

// The page for the latest complete year: its scoresheet and category index, built from the same rows the
// browser filters, and the figures of the headline finding (medal concentration over the complete years).
export function homeData() {
  const { payload } = site();
  const { meta } = payload;
  const year = meta.latest_complete;
  const rows = payload.results.filter((r) => r.year === year);
  const summary = meta.summary.find((s) => s.competition === 'GABF' && Number(s.year) === year);
  const complete = payload.results.filter((r) => meta.coverage[r.year] === 'complete');
  const perBrewery = new Map();
  for (const r of complete) perBrewery.set(r.brewery_key, { name: r.brewery_name, n: (perBrewery.get(r.brewery_key)?.n ?? 0) + 1 });
  const ranked = [...perBrewery.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const years = [...new Set(complete.map((r) => r.year))].sort();
  const top = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 10)));
  return {
    year,
    firstYear: Math.min(...meta.years),
    lastYear: Math.max(...meta.years),
    scoresheet: scoresheet(rows, summary?.entries ? Number(summary.entries) : null),
    categories: categoryLines(rows),
    finding: {
      year_range: `${years[0]} to ${years.at(-1)}`,
      brewery_count: ranked.length.toLocaleString('en-US'),
      medal_count: complete.length.toLocaleString('en-US'),
      top_decile_share: pct(top.reduce((s, b) => s + b.n, 0) / complete.length),
      single_medal_share: pct(ranked.filter((b) => b.n === 1).length / ranked.length),
      top_brewery: ranked[0].name,
      top_brewery_medals: String(ranked[0].n),
    },
  };
}

// What the search field finds: every brewery, every category, and the winning beers of the research year.
export function searchIndex() {
  const { ds, cats } = site();
  const entry = (kind, label, meta, path) => ({ kind, label, meta, path, text: `${label} ${meta}`.toLowerCase() });
  const beers = ds.winnerProfiles.map((p) => entry('beer', String(p.fm.beer), `${p.fm.brewery}, ${p.year}`, `/beers/${p.year}/${p.stem}/`));
  return [
    ...ds.breweries.filter((b) => b.medals.length).map((b) => entry('brewery', b.name, [b.hq.city, b.hq.state].filter(Boolean).join(', '), `/breweries/${b.slug}/`)),
    ...cats.map((c) => entry('category', c.name, c.style_family, `/categories/${c.slug}/`)),
    ...beers,
  ];
}
