#!/usr/bin/env node
// Look up the 2018 to 2025 GABF medal beers in Catalog.beer (https://catalog.beer, CC BY 4.0) and
// record ABV, IBU and style per beer in data/reference/beer-specs.csv, each row with its source URL,
// source kind, retrieval date and match confidence.
//
// A match is accepted only when the Catalog.beer brewer and the medal brewery have the same
// normalized name and the beer names agree after normalization (exactly, or once the brewery's name
// is dropped from the front). A brewer that agrees only by website host is reported, never stored.
// Rows from other source kinds (a brewery's own page) are kept as they are on every run.
//
// The client, key handling and request cache live in scripts/lib/catalog-beer.mjs.
//
// Usage:
//   node scripts/fetch-beer-specs.mjs [--year 2025] [--medal Gold] [--limit 100] [--max-requests N]
//     [--report path.json] [--dry-run]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCsvRecords, toCsv } from './lib/csv.mjs';
import { loadDataset } from './lib/data-model.mjs';
import { breweryKey } from './lib/slug.mjs';
import { REFERENCE, ROOT, parseArgs } from './lib/paths.mjs';
import { beerPageUrl, lookupBeer, readKey, requests } from './lib/catalog-beer.mjs';

export const SPECS = resolve(REFERENCE, 'beer-specs.csv');
export const COLUMNS = ['brewery_name', 'beer_name', 'abv', 'ibu', 'style', 'source_url', 'source_kind', 'retrieved', 'match_confidence', 'match_basis', 'source_beer_name', 'source_brewer_name'];
const FIRST = 2018;
const LAST = 2025;

export const specKey = (brewery, beer) => `${breweryKey(brewery)}|${String(beer).trim().toLowerCase()}`;

// Distinct brewery and beer pairs with a medal in the year range, oldest medal order kept.
export function medalBeers(results, { year, medal } = {}) {
  const seen = new Map();
  for (const r of results) {
    if (r.competition !== 'GABF' || r.year < FIRST || r.year > LAST) continue;
    if (year && r.year !== year) continue;
    if (medal && r.medal !== medal) continue;
    const k = specKey(r.brewery_name, r.beer_name);
    if (!seen.has(k)) seen.set(k, { brewery: r.brewery_name, beer: r.beer_name, brewery_key: r.brewery_key, years: new Set() });
    seen.get(k).years.add(r.year);
  }
  return [...seen.values()];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = readKey();
  if (!key) { console.error('Catalog.beer key not found in the Keychain (service catalog-beer-api-key).'); process.exit(1); }
  if (args['max-requests']) requests.max = Number(args['max-requests']);
  const ds = loadDataset({ root: ROOT, localProfiles: false });
  const siteByKey = new Map(ds.breweries.map((b) => [b.key, b.website || '']));
  let beers = medalBeers(ds.results, { year: args.year ? Number(args.year) : undefined, medal: args.medal });
  if (args.limit) beers = beers.slice(0, Number(args.limit));

  const existing = existsSync(SPECS) ? readCsvRecords(readFileSync(SPECS, 'utf8')) : [];
  const kept = existing.filter((r) => r.source_kind !== 'catalog-beer');
  const catalog = new Map(existing.filter((r) => r.source_kind === 'catalog-beer').map((r) => [specKey(r.brewery_name, r.beer_name), r]));
  const today = new Date().toISOString().slice(0, 10);
  const report = { looked_up: 0, matched: 0, high: 0, medium: 0, host_only: [], matches: [], misses: [], errors: [] };
  const brewerBeers = new Map();
  for (const b of beers) {
    let m;
    try {
      m = await lookupBeer(key, { brewery: b.brewery, beer: b.beer, site: siteByKey.get(b.brewery_key) }, brewerBeers);
    } catch (err) {
      report.errors.push(`${b.brewery} | ${b.beer}: ${err.message}`);
      if (/limit/.test(err.message)) break;
      continue;
    }
    report.looked_up += 1;
    if (!m) { report.misses.push(`${b.brewery} | ${b.beer}`); continue; }
    if (m.basis.startsWith('brewery website')) { report.host_only.push(`${b.brewery} | ${b.beer} => ${m.hit.brewer?.name} | ${m.hit.name}`); continue; }
    report.matched += 1;
    report[m.confidence] += 1;
    const h = m.hit;
    const prior = catalog.get(specKey(b.brewery, b.beer));
    const row = {
      brewery_name: b.brewery,
      beer_name: b.beer,
      abv: h.abv === null || h.abv === undefined || Number(h.abv) === 0 ? '' : String(h.abv),
      ibu: h.ibu === null || h.ibu === undefined ? '' : String(h.ibu),
      style: (h.style ?? '').replace(/\s+-\s+/g, ': '),
      source_url: beerPageUrl(h.id),
      source_kind: 'catalog-beer',
      retrieved: prior?.source_url === beerPageUrl(h.id) ? prior.retrieved : today,
      match_confidence: m.confidence,
      match_basis: m.basis,
      source_beer_name: h.name ?? '',
      source_brewer_name: h.brewer?.name ?? '',
    };
    catalog.set(specKey(b.brewery, b.beer), row);
    report.matches.push(row);
  }
  const rows = [...kept, ...catalog.values()].sort((a, b) => a.brewery_name.localeCompare(b.brewery_name) || a.beer_name.localeCompare(b.beer_name) || a.source_kind.localeCompare(b.source_kind));
  if (!args['dry-run']) writeFileSync(SPECS, toCsv(rows, COLUMNS));
  if (args.report) writeFileSync(resolve(args.report), JSON.stringify(report, null, 2));
  const n = (f) => report.matches.filter((r) => r[f] !== '').length;
  console.log(`${beers.length} beers, ${report.looked_up} looked up, ${report.matched} matched (${report.high} high, ${report.medium} medium), ${report.host_only.length} rejected website-only brewer matches, ${report.errors.length} errors`);
  console.log(`matched with ABV ${n('abv')}, IBU ${n('ibu')}, style ${n('style')}; ${requests.live} live requests this run`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
