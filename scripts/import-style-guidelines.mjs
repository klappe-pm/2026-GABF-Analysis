#!/usr/bin/env node
// Refresh data/reference/categories.csv from the Brewers Association Beer Style Guidelines.
//
//   node scripts/import-style-guidelines.mjs --input ~/Downloads/2026-ba-beer-style-guidelines.pdf --year 2026
//
// Existing rows keep their style_family and description; ranges are updated where the
// guideline names match (case-insensitive). New styles are appended with a style family
// derived from the name. Nothing is deleted.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REFERENCE, parseArgs } from './lib/paths.mjs';
import { readCsvRecords, toCsv } from './lib/csv.mjs';
import { parseStyleGuidelines } from './lib/style-guidelines-lib.mjs';
import { styleFamily } from './lib/style-families.mjs';
import { loadInputText } from './parse-winners.mjs';

const COLUMNS = ['category_name', 'style_family', 'abv_min', 'abv_max', 'ibu_min', 'ibu_max', 'srm_min', 'srm_max', 'description', 'guideline_source', 'confidence'];

export function mergeStyles(existing, parsed, sourceLabel) {
  const byName = new Map(existing.map((c) => [c.category_name.toLowerCase(), { ...c }]));
  let updated = 0;
  let added = 0;
  for (const s of parsed) {
    const key = s.category_name.toLowerCase();
    if (byName.has(key)) {
      const row = byName.get(key);
      Object.assign(row, { abv_min: s.abv_min, abv_max: s.abv_max, ibu_min: s.ibu_min, ibu_max: s.ibu_max, srm_min: s.srm_min, srm_max: s.srm_max, guideline_source: sourceLabel, confidence: 'guideline' });
      if (!row.description && s.description) row.description = s.description;
      updated += 1;
    } else {
      byName.set(key, { ...s, style_family: styleFamily(s.category_name), guideline_source: sourceLabel, confidence: 'guideline' });
      added += 1;
    }
  }
  return { rows: [...byName.values()], updated, added };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('usage: node scripts/import-style-guidelines.mjs --input guidelines.pdf|guidelines.txt [--year 2026]');
    process.exit(2);
  }
  const text = await loadInputText(args.input);
  const parsed = parseStyleGuidelines(text);
  const path = resolve(REFERENCE, 'categories.csv');
  const existing = readCsvRecords(readFileSync(path, 'utf8'));
  const label = `Brewers Association ${args.year ?? ''} Beer Style Guidelines`.replace(/\s+/g, ' ');
  const { rows, updated, added } = mergeStyles(existing, parsed, label);
  writeFileSync(path, toCsv(rows, COLUMNS));
  console.log(`parsed ${parsed.length} styles; updated ${updated}, added ${added}; wrote ${path}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
