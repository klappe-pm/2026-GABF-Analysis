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

export const ACREAGE_COLUMNS = ['variety', 'variety_slug', 'state', 'year', 'acres', 'production_1000_lb', 'production_lbs', 'yield_lb_per_acre', 'acres_code', 'production_code', 'yield_code', 'nass_label', 'source'];
export const TOTALS_COLUMNS = ['line', 'state', 'year', 'acres', 'production_1000_lb', 'production_lbs', 'yield_lb_per_acre', 'acres_code', 'production_code', 'yield_code', 'nass_label', 'source'];

// Report lines that are not one variety. They go to hop-acreage-totals.csv so hop-acreage.csv holds only varieties.
const SPECIAL = new Map([['Total', 'all varieties'], ['Experimental', 'experimental'], ['Other varieties', 'other varieties']]);

// NASS key -> catalogue slug, from the `nass` field of each record.
export function nassSlugMap() {
  const map = new Map();
  for (const rec of CATALOGUE) if (rec.nass) map.set(nassKey(rec.nass), hopSlug(rec.canonical));
  return map;
}

const nameBySlug = () => new Map(CATALOGUE.map((r) => [hopSlug(r.canonical), r.canonical]));
const pounds = (v) => (v === '' || v === null || v === undefined ? '' : Math.round(Number(v) * 1000));

export function buildAcreageRows(reportTexts) {
  const slugs = nassSlugMap();
  const names = nameBySlug();
  const byKey = new Map();
  const unmatched = new Map();
  for (const report of NASS_REPORTS) {
    const text = reportTexts[report.id];
    if (!text) throw new Error(`missing report text for ${report.id}`);
    for (const row of parseNassVarietyTables(text, report.years)) {
      if (YEAR_SOURCE[row.year] !== report.id) continue;
      const line = SPECIAL.get(row.key);
      const variety = line ?? slugs.get(row.key);
      if (!variety) {
        unmatched.set(row.key, (unmatched.get(row.key) ?? 0) + 1);
        continue;
      }
      const id = `${variety}|${row.state}|${row.year}`;
      const rec = byKey.get(id) ?? { variety, line, state: row.state, year: row.year, nass_label: row.label, source: report.url };
      rec[row.measure] = row.value;
      rec[`${row.measure}_code`] = row.code;
      byKey.set(id, rec);
    }
  }
  const all = [...byKey.values()].map((r) => ({
    slug: r.variety, line: r.line, state: r.state, year: r.year, acres: r.area ?? '', production_1000_lb: r.production ?? '', production_lbs: pounds(r.production),
    yield_lb_per_acre: r.yield ?? '', acres_code: r.area_code ?? '', production_code: r.production_code ?? '', yield_code: r.yield_code ?? '', nass_label: r.nass_label, source: r.source,
  }));
  const rows = all.filter((r) => !r.line).map((r) => ({ variety: names.get(r.slug), variety_slug: r.slug, ...r }));
  rows.sort((a, b) => a.variety_slug.localeCompare(b.variety_slug) || a.state.localeCompare(b.state) || a.year - b.year);
  const totals = all.filter((r) => r.line);
  totals.sort((a, b) => a.line.localeCompare(b.line) || a.state.localeCompare(b.state) || a.year - b.year);
  return { rows, totals, unmatched };
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
  const { rows, totals, unmatched } = buildAcreageRows(texts);
  writeFileSync(resolve(ROOT, 'data/reference/hop-acreage.csv'), toCsv(rows, ACREAGE_COLUMNS));
  writeFileSync(resolve(ROOT, 'data/reference/hop-acreage-totals.csv'), toCsv(totals, TOTALS_COLUMNS));
  console.log(`wrote ${rows.length} rows to data/reference/hop-acreage.csv and ${totals.length} to hop-acreage-totals.csv`);
  if (unmatched.size) console.log(`NASS variety lines not in the catalogue (not written): ${[...unmatched.keys()].join('; ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
