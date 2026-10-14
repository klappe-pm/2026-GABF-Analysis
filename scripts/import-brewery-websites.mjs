#!/usr/bin/env node
// Add researched official brewery websites to data/reference/brewery-links.csv. Input is one or more
// JSON files, each an array of { brewery, website, confirmed_by }, where website is the brewery's own
// home page, checked to name the brewery and its city, or null. A website already on file is never
// replaced; directory, social and rating hosts are refused; every value passes the token-shaped scan.
//
// Usage: node scripts/import-brewery-websites.mjs --checked 2026-10-14 sites-1.json [sites-2.json ...]

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCsvRecords, toCsv } from './lib/csv.mjs';
import { REFERENCE, parseArgs } from './lib/paths.mjs';
import { hasTokenShape } from './lib/redact.mjs';
import { breweryKey } from './lib/slug.mjs';

export const LINKS = resolve(REFERENCE, 'brewery-links.csv');
const COLUMNS = ['brewery_name', 'website', 'instagram', 'untappd', 'beeradvocate', 'source', 'checked'];
const SOURCE = 'official site found by web search; home page names the brewery and city';
const REFUSED = /(^|\.)(untappd\.com|beeradvocate\.com|ratebeer\.com|beermenus\.com|facebook\.com|instagram\.com|yelp\.com|openbrewerydb\.org|google\.com)$/i;

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

export function mergeWebsites(rows, found, checked) {
  const byKey = new Map(rows.map((r) => [breweryKey(r.brewery_name), r]));
  let added = 0;
  const refused = [];
  for (const x of found) {
    const host = hostOf(x.website);
    if (!x.website || !host) continue;
    if (REFUSED.test(host) || hasTokenShape(x.website)) { refused.push(`${x.brewery}: ${host}`); continue; }
    const k = breweryKey(x.brewery);
    const row = byKey.get(k);
    if (row?.website) continue;
    if (row) {
      row.website = x.website;
      row.source = row.source ? `${SOURCE}; ${row.source}` : SOURCE;
      row.checked = checked;
    } else byKey.set(k, { brewery_name: x.brewery, website: x.website, instagram: '', untappd: '', beeradvocate: '', source: SOURCE, checked });
    added += 1;
  }
  const out = [...byKey.values()].sort((a, b) => a.brewery_name.localeCompare(b.brewery_name));
  return { rows: out, added, refused };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.checked) { console.error('--checked YYYY-MM-DD is required'); process.exit(1); }
  const found = args._.flatMap((f) => JSON.parse(readFileSync(resolve(f), 'utf8')));
  const out = mergeWebsites(readCsvRecords(readFileSync(LINKS, 'utf8')), found, args.checked);
  writeFileSync(LINKS, toCsv(out.rows, COLUMNS));
  console.log(`${found.length} researched, ${out.added} websites added, ${out.refused.length} refused`);
  for (const r of out.refused) console.log(`refused ${r}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
