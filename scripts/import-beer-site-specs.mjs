#!/usr/bin/env node
// Import brewery website research into data/reference/beer-specs.csv (source kind brewery-site) and
// record beers with no published page in data/reference/beer-specs-gaps.csv, with the sources
// checked. Input is one or more JSON files, each an array of
//   { brewery, beer, status: "found" | "gap", abv, ibu, style, source_url, sources_checked }
// A value is kept only when its page is on the brewery's own site: rating and checkin sites,
// menu aggregators and distributors are refused, so their values never reach the data.
//
// Usage: node scripts/import-beer-site-specs.mjs --retrieved 2026-10-14 results-1.json [results-2.json ...]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCsvRecords, toCsv } from './lib/csv.mjs';
import { REFERENCE, parseArgs } from './lib/paths.mjs';
import { COLUMNS, SPECS, specKey } from './fetch-beer-specs.mjs';

export const GAPS = resolve(REFERENCE, 'beer-specs-gaps.csv');
export const GAP_COLUMNS = ['brewery_name', 'beer_name', 'checked', 'sources_checked'];
const REFUSED = /(^|\.)(untappd\.com|beeradvocate\.com|ratebeer\.com|beermenus\.com|catalog\.beer|facebook\.com|instagram\.com)$/;

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '' : String(Number(v)));

export function importResults(results, { specs, gaps, retrieved }) {
  const specRows = new Map(specs.map((r) => [`${specKey(r.brewery_name, r.beer_name)}|${r.source_kind}`, r]));
  const gapRows = new Map(gaps.map((r) => [specKey(r.brewery_name, r.beer_name), r]));
  const refused = [];
  let found = 0;
  for (const x of results) {
    const k = specKey(x.brewery, x.beer);
    const host = hostOf(x.source_url);
    const hasValue = num(x.abv) !== '' || num(x.ibu) !== '' || Boolean(x.style);
    if (x.status === 'found' && host && REFUSED.test(host)) refused.push(`${x.brewery} | ${x.beer}: ${host}`);
    if (x.status === 'found' && host && !REFUSED.test(host) && hasValue) {
      specRows.set(`${k}|brewery-site`, {
        brewery_name: x.brewery,
        beer_name: x.beer,
        abv: num(x.abv),
        ibu: num(x.ibu),
        style: (x.style ?? '').replace(/\s+-\s+/g, ': '),
        source_url: x.source_url,
        source_kind: 'brewery-site',
        retrieved,
        match_confidence: 'high',
        match_basis: "brewery's own page for the beer",
        source_beer_name: '',
        source_brewer_name: '',
      });
      gapRows.delete(k);
      found += 1;
    } else if (!specRows.has(`${k}|brewery-site`) && !specRows.has(`${k}|catalog-beer`)) {
      gapRows.set(k, { brewery_name: x.brewery, beer_name: x.beer, checked: retrieved, sources_checked: (x.sources_checked ?? []).join(' ; ') });
    }
  }
  const sort = (a, b) => a.brewery_name.localeCompare(b.brewery_name) || a.beer_name.localeCompare(b.beer_name) || String(a.source_kind ?? '').localeCompare(String(b.source_kind ?? ''));
  return { specs: [...specRows.values()].sort(sort), gaps: [...gapRows.values()].sort(sort), found, refused };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.retrieved) { console.error('--retrieved YYYY-MM-DD is required'); process.exit(1); }
  const results = args._.flatMap((f) => JSON.parse(readFileSync(resolve(f), 'utf8')));
  const read = (p) => (existsSync(p) ? readCsvRecords(readFileSync(p, 'utf8')) : []);
  const out = importResults(results, { specs: read(SPECS), gaps: read(GAPS), retrieved: args.retrieved });
  writeFileSync(SPECS, toCsv(out.specs, COLUMNS));
  writeFileSync(GAPS, toCsv(out.gaps, GAP_COLUMNS));
  console.log(`${results.length} researched, ${out.found} found on brewery sites, ${out.gaps.length} gaps on file, ${out.refused.length} refused sources`);
  for (const r of out.refused) console.log(`refused ${r}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
