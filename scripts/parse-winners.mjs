#!/usr/bin/env node
// Parse an official winners list (PDF or extracted text) into data/results/gabf-YYYY.csv.
//
//   node scripts/parse-winners.mjs --year 2025                       (uses data/raw/gabf-2025-winners.pdf)
//   node scripts/parse-winners.mjs --year 2026 --input path/to/list.pdf
//   node scripts/parse-winners.mjs --year 2026 --input list.txt --dry-run
//
// The extracted text is kept beside the PDF (data/raw/gabf-YYYY-winners.txt) so the
// parse is reproducible without the binary, and unparsed segments are printed so a
// human can fix the text or the parser before the CSV is trusted.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAW, RESULTS, parseArgs } from './lib/paths.mjs';
import { parseWinnersText, RESULT_COLUMNS } from './lib/parse-winners-lib.mjs';
import { readCsvRecords, toCsv } from './lib/csv.mjs';

export async function extractPdfText(path) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const data = new Uint8Array(readFileSync(path));
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}

export async function loadInputText(input) {
  if (input.toLowerCase().endsWith('.pdf')) return extractPdfText(input);
  return readFileSync(input, 'utf8');
}

function mergeAwards(existingPath, awards, year) {
  const columns = ['year', 'competition', 'award', 'bracket', 'brewery_printed', 'brewery_name', 'brewery_location', 'city', 'state', 'source'];
  const existing = existsSync(existingPath) ? readCsvRecords(readFileSync(existingPath, 'utf8')) : [];
  const kept = existing.filter((a) => Number(a.year) !== Number(year));
  const merged = [...kept, ...awards].sort((a, b) => Number(a.year) - Number(b.year) || a.award.localeCompare(b.award));
  return toCsv(merged, columns);
}

export async function parseYear({ year, input, dryRun = false, source }) {
  const inputPath = input ?? resolve(RAW, `gabf-${year}-winners.pdf`);
  if (!existsSync(inputPath)) throw new Error(`Input not found: ${inputPath}. Run npm run fetch -- --year ${year} first or pass --input.`);
  const text = await loadInputText(inputPath);
  const src = source ?? `Official GABF ${year} winners list (${inputPath.split('/').pop()})`;
  const parsed = parseWinnersText(text, { year, source: src });
  const report = {
    year,
    input: inputPath,
    categories: parsed.categories.length,
    medals: parsed.rows.length,
    awards: parsed.awards.length,
    problems: parsed.problems,
    breweries: new Set(parsed.rows.map((r) => r.brewery_name)).size,
  };
  if (!dryRun) {
    mkdirSync(RAW, { recursive: true });
    mkdirSync(RESULTS, { recursive: true });
    if (inputPath.toLowerCase().endsWith('.pdf')) writeFileSync(resolve(RAW, `gabf-${year}-winners.txt`), text);
    writeFileSync(resolve(RESULTS, `gabf-${year}.csv`), toCsv(parsed.rows, RESULT_COLUMNS));
    if (parsed.awards.length) writeFileSync(resolve(RESULTS, 'brewery-of-the-year.csv'), mergeAwards(resolve(RESULTS, 'brewery-of-the-year.csv'), parsed.awards, year));
  }
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const year = Number(args.year);
  if (!year) {
    console.error('usage: node scripts/parse-winners.mjs --year 2025 [--input file.pdf|file.txt] [--dry-run]');
    process.exit(2);
  }
  const report = await parseYear({ year, input: args.input, dryRun: Boolean(args['dry-run']) });
  console.log(`${year}: ${report.categories} categories, ${report.medals} medals, ${report.breweries} breweries, ${report.awards} brewery awards`);
  if (report.problems.length) {
    console.log(`${report.problems.length} problems:`);
    for (const p of report.problems) console.log(`  [${p.kind}] ${p.detail}`);
  }
  if (report.medals < 100 && !args['dry-run']) console.warn('Fewer than 100 medals parsed; check the extracted text before trusting this file.');
  process.exit(report.problems.some((p) => p.kind === 'no-categories') ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
