#!/usr/bin/env node
// Download the official GABF winners list PDF for one or more years into data/raw/.
//
//   node scripts/fetch-winners.mjs --year 2025
//   node scripts/fetch-winners.mjs --year 2026 --url https://.../GABF26-Winners-List.pdf
//   node scripts/fetch-winners.mjs --all
//
// Known URLs are listed below; for a year without a known URL the script tries the
// publishing patterns the Brewers Association has used, and otherwise asks for --url.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAW, parseArgs } from './lib/paths.mjs';

export const KNOWN_URLS = {
  2021: ['https://www.greatamericanbeerfestival.com/wp-content/uploads/2021/10/GABF21-Winners-List-2.pdf'],
  2024: ['https://cdn.greatamericanbeerfestival.com/wp-content/uploads/GABF24-Winners-List.pdf'],
  2025: ['https://cdn.greatamericanbeerfestival.com/wp-content/uploads/GABF25-Winners-List-1.pdf', 'https://cdn.brewersassociation.org/wp-content/uploads/2025/10/11090251/GABF25-Winners-List.pdf'],
};

export function candidateUrls(year) {
  const yy = String(year).slice(2);
  const known = KNOWN_URLS[year] ?? [];
  const guesses = [
    `https://cdn.greatamericanbeerfestival.com/wp-content/uploads/GABF${yy}-Winners-List.pdf`,
    `https://cdn.greatamericanbeerfestival.com/wp-content/uploads/GABF${yy}-Winners-List-1.pdf`,
    `https://cdn.brewersassociation.org/wp-content/uploads/${year}/10/GABF${yy}-Winners-List.pdf`,
    `https://www.greatamericanbeerfestival.com/wp-content/uploads/${year}/10/GABF${yy}-Winners-List.pdf`,
    `https://www.greatamericanbeerfestival.com/wp-content/uploads/${year}/09/GABF${yy}-Winners-List.pdf`,
    `https://cdn.greatamericanbeerfestival.com/wp-content/uploads/GABF${yy}_Winners_List.pdf`,
  ];
  return [...new Set([...known, ...guesses])];
}

async function tryDownload(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'gabf-analysis/0.1 (+https://github.com/klappe-pm/GABF-Analysis)' }, redirect: 'follow' });
  if (!res.ok) return { ok: false, status: res.status };
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.subarray(0, 5).toString('latin1').startsWith('%PDF')) return { ok: false, status: res.status, reason: 'not a PDF' };
  return { ok: true, buf };
}

export async function fetchYear(year, { url, outDir = RAW, force = false } = {}) {
  mkdirSync(outDir, { recursive: true });
  const target = resolve(outDir, `gabf-${year}-winners.pdf`);
  if (existsSync(target) && !force) return { year, path: target, skipped: true };
  const urls = url ? [url] : candidateUrls(year);
  const attempts = [];
  for (const u of urls) {
    try {
      const r = await tryDownload(u);
      attempts.push({ url: u, status: r.status ?? 200, ok: r.ok, reason: r.reason });
      if (r.ok) {
        writeFileSync(target, r.buf);
        return { year, path: target, url: u, bytes: r.buf.length, attempts };
      }
    } catch (err) {
      attempts.push({ url: u, ok: false, reason: err.message });
    }
  }
  return { year, path: null, attempts };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const years = args.all ? [2021, 2022, 2023, 2024, 2025, 2026] : [Number(args.year)];
  if (!years[0]) {
    console.error('usage: node scripts/fetch-winners.mjs --year 2025 [--url <pdf url>] [--force] | --all');
    process.exit(2);
  }
  let failed = 0;
  for (const year of years) {
    const r = await fetchYear(year, { url: args.url, force: Boolean(args.force) });
    if (r.skipped) console.log(`${year}: already present at ${r.path} (use --force to refetch)`);
    else if (r.path) console.log(`${year}: saved ${r.bytes} bytes from ${r.url} to ${r.path}`);
    else {
      failed += 1;
      console.error(`${year}: no PDF found. Attempts:`);
      for (const a of r.attempts) console.error(`  ${a.url} -> ${a.ok ? 'ok' : `${a.status ?? ''} ${a.reason ?? 'failed'}`}`);
      console.error(`  Find the link on the Brewers Association press release for ${year} and pass it with --url.`);
    }
  }
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
