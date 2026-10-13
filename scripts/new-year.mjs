#!/usr/bin/env node
// One command for the moment a new year's results drop:
//
//   node scripts/new-year.mjs --year 2026                       (fetch official PDF, parse, enrich, build)
//   node scripts/new-year.mjs --year 2026 --url https://...pdf  (known PDF link)
//   node scripts/new-year.mjs --year 2026 --pdf ~/Downloads/GABF26-Winners-List.pdf
//   node scripts/new-year.mjs --year 2026 --csv ~/Downloads/results.csv
//   add --offline to skip Open Brewery DB lookups.

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ROOT, parseArgs } from './lib/paths.mjs';

function run(label, scriptArgs) {
  console.log(`\n== ${label}: node ${scriptArgs.join(' ')}`);
  const r = spawnSync(process.execPath, scriptArgs.map((a) => (a.startsWith('scripts/') ? resolve(ROOT, a) : a)), { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) {
    console.error(`${label} failed (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
}

const args = parseArgs(process.argv.slice(2));
const year = Number(args.year);
if (!year) {
  console.error('usage: node scripts/new-year.mjs --year 2026 [--url <pdf url> | --pdf <file> | --csv <file>] [--offline]');
  process.exit(2);
}
if (args.csv) run('import csv', ['scripts/import-results-csv.mjs', '--year', String(year), '--input', args.csv]);
else {
  if (args.pdf) run('parse', ['scripts/parse-winners.mjs', '--year', String(year), '--input', args.pdf]);
  else {
    run('fetch', ['scripts/fetch-winners.mjs', '--year', String(year), ...(args.url ? ['--url', args.url] : []), ...(args.force ? ['--force'] : [])]);
    run('parse', ['scripts/parse-winners.mjs', '--year', String(year)]);
  }
}
run('enrich', ['scripts/enrich-breweries.mjs', ...(args.offline ? ['--offline'] : [])]);
run('test', ['--test']);
run('build', ['scripts/build-site.mjs']);
console.log(`\nDone. Review data/results/gabf-${year}.csv and dist/, then commit data/ and breweries/ and push to publish.`);
