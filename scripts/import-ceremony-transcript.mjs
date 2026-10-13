#!/usr/bin/env node
// Draft a year's results from the awards ceremony transcript, for the hours between the
// live announcement and the official PDF.
//
//   yt-dlp --write-auto-sub --sub-lang en --skip-download -o "ceremony-2026" "https://www.youtube.com/live/EhJtEzE5wbg"
//   node scripts/import-ceremony-transcript.mjs --year 2026 --input ceremony-2026.en.vtt
//   node scripts/import-ceremony-transcript.mjs --year 2026 --input ceremony-2026.en.vtt --promote
//
// Without --promote the draft goes to data/results/drafts/gabf-YYYY-transcript.csv and a
// review summary is printed. With --promote it also replaces data/results/gabf-YYYY.csv,
// with every row marked as a transcript draft until the official list is ingested.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RESULTS, parseArgs } from './lib/paths.mjs';
import { toCsv } from './lib/csv.mjs';
import { RESULT_COLUMNS } from './lib/parse-winners-lib.mjs';
import { loadDataset } from './lib/data-model.mjs';
import { breweryNamesFromDataset, parseTranscript } from './lib/transcript-lib.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const year = Number(args.year);
  if (!year || !args.input) {
    console.error('usage: node scripts/import-ceremony-transcript.mjs --year 2026 --input transcript.vtt [--promote]');
    process.exit(2);
  }
  const ds = loadDataset();
  const knownCategories = ds.categories.map((c) => c.category_name);
  const knownBreweries = breweryNamesFromDataset(ds);
  const raw = readFileSync(args.input, 'utf8');
  const { rows, categories, problems } = parseTranscript(raw, { year, knownCategories, knownBreweries, source: `Awards ceremony transcript (${args.input.split('/').pop()})` });
  const draftDir = resolve(RESULTS, 'drafts');
  mkdirSync(draftDir, { recursive: true });
  const draftPath = resolve(draftDir, `gabf-${year}-transcript.csv`);
  writeFileSync(draftPath, toCsv(rows, [...RESULT_COLUMNS, 'confidence']));
  const byConf = [0, 1, 2, 3].map((c) => rows.filter((r) => r.confidence === c).length);
  console.log(`${year}: ${categories.length} categories announced, ${rows.length} medal rows drafted to ${draftPath}`);
  console.log(`confidence: high ${byConf[3]}, medium ${byConf[2]}, low ${byConf[1] + byConf[0]}`);
  if (problems.length) {
    console.log(`${problems.length} problems:`);
    for (const p of problems.slice(0, 40)) console.log(`  [${p.kind}] ${p.detail}`);
  }
  if (args.promote) {
    const out = resolve(RESULTS, `gabf-${year}.csv`);
    writeFileSync(out, toCsv(rows.map(({ confidence, ...r }) => r), RESULT_COLUMNS));
    console.log(`promoted to ${out}; replace it with the official list as soon as it is published (npm run parse -- --year ${year}).`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
