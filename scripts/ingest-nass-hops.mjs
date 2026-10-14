#!/usr/bin/env node
// Build data/reference/hop-acreage.csv from the USDA NASS National Hop Reports.
//
//   node scripts/ingest-nass-hops.mjs --fetch      download the three reports into data/cache/nass-hops, then build
//   node scripts/ingest-nass-hops.mjs              build from the reports already in data/cache/nass-hops
//   node scripts/ingest-nass-hops.mjs --dir <dir>  build from hopsan25.txt, hopsan24.txt and hopsan23.txt in <dir>
//
// Each crop year comes from the newest report that covers it (see YEAR_SOURCE). A withheld, unavailable
// or not applicable value is left blank and named in the matching code column. "-" in the report is zero.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CACHE, ROOT, parseArgs } from './lib/paths.mjs';
import { toCsv } from './lib/csv.mjs';
import { CATALOGUE } from './lib/hop-catalogue.mjs';
import { hopSlug } from './lib/hop-aliases.mjs';
import { NASS_REPORTS, YEAR_SOURCE, nassKey, parseNassVarietyTables } from './lib/nass-hops.mjs';

export const ACREAGE_COLUMNS = ['variety', 'state', 'year', 'acres', 'production_1000_lb', 'yield_lb_per_acre', 'acres_code', 'production_code', 'yield_code', 'nass_label', 'source'];

const SPECIAL = new Map([['Total', 'all-varieties'], ['Experimental', 'experimental'], ['Other varieties', 'other-varieties']]);

// NASS key -> catalogue slug, from the `nass` field of each record.
export function nassSlugMap() {
  const map = new Map();
  for (const rec of CATALOGUE) if (rec.nass) map.set(nassKey(rec.nass), hopSlug(rec.canonical));
  return map;
}

export function buildAcreageRows(reportTexts) {
  const slugs = nassSlugMap();
  const byKey = new Map();
  const unmatched = new Map();
  for (const report of NASS_REPORTS) {
    const text = reportTexts[report.id];
    if (!text) throw new Error(`missing report text for ${report.id}`);
    for (const row of parseNassVarietyTables(text, report.years)) {
      if (YEAR_SOURCE[row.year] !== report.id) continue;
      const variety = SPECIAL.get(row.key) ?? slugs.get(row.key);
      if (!variety) {
        unmatched.set(row.key, (unmatched.get(row.key) ?? 0) + 1);
        continue;
      }
      const id = `${variety}|${row.state}|${row.year}`;
      const rec = byKey.get(id) ?? { variety, state: row.state, year: row.year, nass_label: row.label, source: report.url };
      rec[row.measure] = row.value;
      rec[`${row.measure}_code`] = row.code;
      byKey.set(id, rec);
    }
  }
  const rows = [...byKey.values()].map((r) => ({
    variety: r.variety, state: r.state, year: r.year, acres: r.area ?? '', production_1000_lb: r.production ?? '', yield_lb_per_acre: r.yield ?? '',
    acres_code: r.area_code ?? '', production_code: r.production_code ?? '', yield_code: r.yield_code ?? '', nass_label: r.nass_label, source: r.source,
  }));
  rows.sort((a, b) => a.variety.localeCompare(b.variety) || a.state.localeCompare(b.state) || a.year - b.year);
  return { rows, unmatched };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = args.dir ? resolve(args.dir) : resolve(CACHE, 'nass-hops');
  if (args.fetch) {
    mkdirSync(dir, { recursive: true });
    for (const report of NASS_REPORTS) {
      const res = await fetch(report.url, { headers: { 'user-agent': 'gabf-analysis/0.1 (+https://github.com/klappe-pm/GABF-Analysis)' } });
      if (!res.ok) throw new Error(`${report.url}: HTTP ${res.status}`);
      writeFileSync(resolve(dir, `${report.id}.txt`), await res.text());
    }
  }
  const texts = {};
  for (const report of NASS_REPORTS) {
    const file = resolve(dir, `${report.id}.txt`);
    if (!existsSync(file)) throw new Error(`${file} not found; run with --fetch`);
    texts[report.id] = readFileSync(file, 'utf8');
  }
  const { rows, unmatched } = buildAcreageRows(texts);
  writeFileSync(resolve(ROOT, 'data/reference/hop-acreage.csv'), toCsv(rows, ACREAGE_COLUMNS));
  console.log(`wrote ${rows.length} rows to data/reference/hop-acreage.csv`);
  if (unmatched.size) console.log(`NASS variety lines not in the catalogue (not written): ${[...unmatched.keys()].join('; ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
