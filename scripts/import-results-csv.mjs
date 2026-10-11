#!/usr/bin/env node
// Normalize a hand-made or third-party results CSV into data/results/gabf-YYYY.csv.
// Header names are matched loosely (medal, beer, brewery, city, state, category, entries).
//
//   node scripts/import-results-csv.mjs --year 2026 --input ~/Downloads/gabf-2026.csv [--source "where it came from"]

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RESULTS, parseArgs } from './lib/paths.mjs';
import { readCsvRecords, toCsv } from './lib/csv.mjs';
import { RESULT_COLUMNS } from './lib/parse-winners-lib.mjs';
import { splitLocationSuffix } from './lib/slug.mjs';
import { normalizeState } from './lib/text.mjs';

const HEADER_ALIASES = {
  medal: ['medal', 'award', 'place'],
  beer_name: ['beer', 'beer_name', 'beer name', 'entry', 'entry name'],
  brewery_printed: ['brewery', 'brewery_name', 'brewery name', 'company', 'winner'],
  city: ['city', 'town'],
  state: ['state', 'st', 'province'],
  category_name: ['category', 'category_name', 'category name', 'style'],
  category_number: ['category_number', 'category number', 'cat', 'cat #', 'number'],
  entries: ['entries', 'entry count', 'num entries'],
  brewery_location: ['location', 'brewery_location', 'brewery location'],
  section: ['section', 'competition section'],
};

export function mapHeaders(header) {
  const lower = header.map((h) => h.trim().toLowerCase());
  const mapping = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = lower.findIndex((h) => aliases.includes(h));
    if (idx >= 0) mapping[field] = header[idx];
  }
  return mapping;
}

export function normalizeRecords(records, { year, source = '' }) {
  if (records.length === 0) return [];
  const mapping = mapHeaders(Object.keys(records[0]));
  for (const required of ['medal', 'beer_name', 'brewery_printed', 'state']) {
    if (!mapping[required]) throw new Error(`Could not find a column for ${required}. Headers: ${Object.keys(records[0]).join(', ')}`);
  }
  return records.map((rec) => {
    const get = (f) => (mapping[f] ? String(rec[mapping[f]] ?? '').trim() : '');
    const medalRaw = get('medal').toLowerCase();
    const medal = medalRaw.startsWith('g') ? 'Gold' : medalRaw.startsWith('s') ? 'Silver' : medalRaw.startsWith('b') ? 'Bronze' : get('medal');
    const printed = get('brewery_printed');
    const { name, location } = splitLocationSuffix(printed);
    return {
      year: String(year),
      competition: 'GABF',
      section: get('section') || 'main',
      category_number: get('category_number'),
      category_name: get('category_name'),
      entries: get('entries'),
      medal,
      beer_name: get('beer_name'),
      brewery_printed: printed,
      brewery_name: name,
      brewery_location: get('brewery_location') || location,
      city: get('city'),
      state: normalizeState(get('state')),
      source,
      notes: '',
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const year = Number(args.year);
  if (!year || !args.input) {
    console.error('usage: node scripts/import-results-csv.mjs --year 2026 --input results.csv [--source "..."]');
    process.exit(2);
  }
  const records = readCsvRecords(readFileSync(args.input, 'utf8'));
  const rows = normalizeRecords(records, { year, source: args.source ?? `Imported from ${args.input}` });
  const out = resolve(RESULTS, `gabf-${year}.csv`);
  writeFileSync(out, toCsv(rows, RESULT_COLUMNS));
  console.log(`${year}: wrote ${rows.length} rows to ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
