#!/usr/bin/env node
// Apply hand researched findings (JSON) to the 2026 winner profiles.
//
//   node scripts/apply-research-findings.mjs <findings.json> [more.json ...] [--date=YYYY-MM-DD]
//
// Each file is an array of { file, found, tried, method, note }. Values go through the same apply step the
// scraper uses (scripts/lib/winner-apply.mjs): only empty fields are filled, each value is recorded in the
// provenance list with its source URL, retrieval date and method, and the URLs tried are added to the gaps.
// A finding whose source is an Untappd, BeerAdvocate or RateBeer page is refused.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { loadContext, touch } from './winner-deep-dive.mjs';
import { applyResult } from './lib/winner-apply.mjs';
import { loadHopLookup } from './lib/hop-aliases.mjs';

const REFUSED = /(^|\.)(untappd\.com|beeradvocate\.com|ratebeer\.com)$/i;
const host = (u) => { try { return new URL(u).hostname; } catch { return ''; } };

function sourcesOf(found) {
  const out = [];
  for (const v of Object.values(found ?? {})) {
    if (Array.isArray(v)) for (const r of v) out.push(r.source);
    else out.push(v?.source);
  }
  return out.filter(Boolean);
}

const args = process.argv.slice(2);
const date = args.find((a) => a.startsWith('--date='))?.slice(7) ?? new Date().toISOString().slice(0, 10);
const files = args.filter((a) => !a.startsWith('--'));
const ctx = loadContext();
const lookup = loadHopLookup();
let changed = 0;
const totals = {};
for (const f of files) {
  for (const item of JSON.parse(readFileSync(resolve(f), 'utf8'))) {
    const bad = sourcesOf(item.found).filter((u) => REFUSED.test(host(u)));
    if (bad.length) { console.log(`${item.file}: refused, source on a closed or forbidden site: ${bad[0]}`); continue; }
    const path = resolve(ROOT, 'docs/2026/winner', item.file);
    const text = readFileSync(path, 'utf8');
    const tried = (item.tried ?? []).filter((u) => /^https?:\/\//.test(u) && !REFUSED.test(host(u)));
    const res = { found: item.found ?? {}, tried, retrieved: date, method: item.method ?? 'brewery material found by search', note: item.note };
    const out = applyResult(text, ctx, res, { lookup, file: item.file });
    let next = out.text;
    if (next !== text) { next = touch(next, date); writeFileSync(path, next); changed += 1; }
    for (const w of out.wrote) totals[w] = (totals[w] ?? 0) + 1;
    console.log(`${item.file}: ${out.wrote.length ? out.wrote.join(', ') : 'nothing new'}${res.unresolved ? ` | unresolved: ${res.unresolved.join('; ')}` : ''}`);
  }
}
console.log(`${changed} profiles updated`, JSON.stringify(totals));
