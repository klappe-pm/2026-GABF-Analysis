#!/usr/bin/env node
// One command for the moment a new year's results drop:
//
//   node scripts/new-year.mjs --year 2026                       (fetch official PDF, parse, enrich, build, test)
//   node scripts/new-year.mjs --year 2026 --url https://...pdf  (known PDF link)
//   node scripts/new-year.mjs --year 2026 --pdf ~/Downloads/GABF26-Winners-List.pdf
//   node scripts/new-year.mjs --year 2026 --csv ~/Downloads/results.csv
//   add --offline to skip Open Brewery DB lookups.

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ROOT, parseArgs } from './lib/paths.mjs';

function run(label, scriptArgs, command = process.execPath) {
  console.log(`\n== ${label}: ${command === process.execPath ? 'node' : command} ${scriptArgs.join(' ')}`);
  const r = spawnSync(command, scriptArgs.map((a) => (a.startsWith('scripts/') ? resolve(ROOT, a) : a)), { stdio: 'inherit', cwd: ROOT });
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
// The tests read the generated single file pages, the winners database and the web app's export; all are build
// outputs and not in git.
run('brand', ['scripts/brand/build.mjs']);
run('winners database', ['scripts/build-winner-db.mjs', '2026']);
run('chart gallery', ['scripts/build-chart-gallery.mjs']);
run('standalone', ['scripts/build-standalone.mjs']);
// The web app's export is built before the tests, because the tests that read it fail on an export older than the data.
run('web build', ['run', 'web:build'], 'npm');
run('test', ['--test']);
console.log(`\nDone. Review data/results/gabf-${year}.csv, preview the site (npm run web:serve), then commit data/ and push to publish.`);
