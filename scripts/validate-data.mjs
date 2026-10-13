#!/usr/bin/env node
// Validate the loaded results and the Open Brewery DB enrichment.
//
//   node scripts/validate-data.mjs            (structural checks, offline)
//   node scripts/validate-data.mjs --live     (also re-query the Open Brewery DB by id)
//   node scripts/validate-data.mjs --live --limit 50
//
// Errors fail the run (exit 1). Warnings are facts about the source data that need a human look.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ENRICHED, RESULTS, parseArgs } from './lib/paths.mjs';
import { readCsvRecords } from './lib/csv.mjs';
import { US_STATES, normalizeState } from './lib/text.mjs';

const MEDALS = new Set(['Gold', 'Silver', 'Bronze', 'Honorable Mention']);
const API = 'https://api.openbrewerydb.org/v1/breweries';
const USER_AGENT = 'gabf-analysis/0.1 (+https://github.com/klappe-pm/GABF-Analysis)';

export function loadResults(dir = RESULTS) {
  return readdirSync(dir)
    .filter((f) => /^gabf-\d{4}\.csv$/.test(f))
    .sort()
    .flatMap((f) => readCsvRecords(readFileSync(resolve(dir, f), 'utf8')));
}

// Structural checks on medal rows. Returns { errors, warnings }.
export function checkResults(rows) {
  const errors = [];
  const warnings = [];
  const seen = new Map();
  const entriesByCategory = new Map();
  const medalsByCategory = new Map();
  for (const r of rows) {
    const where = `${r.year} ${r.section} category ${r.category_number} ${r.medal}`;
    if (!MEDALS.has(r.medal)) errors.push(`${where}: unknown medal "${r.medal}"`);
    for (const field of ['beer_name', 'brewery_name', 'category_name']) if (!r[field]) errors.push(`${where}: empty ${field}`);
    if (!US_STATES[normalizeState(r.state)]) errors.push(`${where}: unknown state "${r.state}" (${r.brewery_name})`);
    if (!r.city) errors.push(`${where}: empty city (${r.brewery_name})`);
    const unique = `${r.year}|${r.section}|${r.category_number}|${r.medal}|${r.beer_name}|${r.brewery_name}`;
    seen.set(unique, (seen.get(unique) ?? 0) + 1);
    const cat = `${r.year}|${r.section}|${r.category_number}`;
    if (r.entries) {
      const set = entriesByCategory.get(cat) ?? new Set();
      set.add(r.entries);
      entriesByCategory.set(cat, set);
    }
    const meds = medalsByCategory.get(cat) ?? [];
    meds.push(r.medal);
    medalsByCategory.set(cat, meds);
  }
  for (const [key, n] of seen) if (n > 1) errors.push(`duplicate medal row (${n}x): ${key}`);
  for (const [cat, set] of entriesByCategory) if (set.size > 1) errors.push(`${cat}: conflicting entry counts ${[...set].join(', ')}`);
  for (const [cat, meds] of medalsByCategory) {
    for (const m of ['Gold', 'Silver', 'Bronze']) {
      const n = meds.filter((x) => x === m).length;
      if (n === 0) warnings.push(`${cat}: no ${m} medal listed`);
      if (n > 1) warnings.push(`${cat}: ${n} ${m} medals listed`);
    }
  }
  return { errors, warnings };
}

// Compare the loaded medal count per year with year-summary.csv. Differences are warnings.
export function checkYearSummary(rows, summaryRows) {
  const warnings = [];
  const counted = {};
  for (const r of rows) counted[r.year] = (counted[r.year] ?? 0) + 1;
  for (const s of summaryRows) {
    if (!s.medals || !counted[s.year]) continue;
    if (Number(s.medals) !== counted[s.year]) warnings.push(`${s.year}: year-summary says ${s.medals} medals, results hold ${counted[s.year]}`);
  }
  return warnings;
}

// Compare each matched brewery's Open Brewery DB state with the state the results print.
export function checkEnrichment(rows, enriched) {
  const warnings = [];
  const statesByKey = new Map();
  for (const r of rows) {
    const key = r.brewery_name;
    const set = statesByKey.get(key) ?? new Set();
    set.add(normalizeState(r.state));
    statesByKey.set(key, set);
  }
  const breweries = Object.values(enriched.breweries ?? {});
  const matched = breweries.filter((b) => b.best);
  let stateMismatches = 0;
  for (const b of matched) {
    const resultStates = statesByKey.get(b.name);
    const apiState = normalizeState(b.best.state ?? b.best.state_province);
    if (resultStates && apiState && !resultStates.has(apiState)) {
      stateMismatches += 1;
      warnings.push(`${b.name}: results print ${[...resultStates].join('/')} but Open Brewery DB says ${apiState}`);
    }
  }
  return { total: breweries.length, matched: matched.length, unmatched: breweries.length - matched.length, stateMismatches, warnings };
}

// A reset connection should cost one record, not the whole run: retry with a growing pause, then give up on that record.
async function fetchWithRetry(url, attempts = 4) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    } catch {
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

async function liveCheck(enriched, limit) {
  const matched = Object.values(enriched.breweries).filter((b) => b.best?.id);
  const sample = matched.slice(0, limit ?? matched.length);
  const problems = [];
  let ok = 0;
  for (const b of sample) {
    const res = await fetchWithRetry(`${API}/${b.best.id}`);
    if (!res) problems.push(`${b.name}: Open Brewery DB unreachable after retries`);
    else if (res.status === 404) problems.push(`${b.name}: id ${b.best.id} no longer exists in Open Brewery DB`);
    else if (!res.ok) problems.push(`${b.name}: Open Brewery DB answered ${res.status}`);
    else {
      const live = await res.json();
      const cached = b.locations?.find((l) => l.source === 'openbrewerydb' && l.id === b.best.id) ?? b.best;
      const moved = live.city !== cached.city || (live.state ?? live.state_province) !== (cached.state ?? cached.state_province);
      if (moved) problems.push(`${b.name}: cached ${cached.city}, ${cached.state} but live record says ${live.city}, ${live.state ?? live.state_province}`);
      else ok += 1;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { checked: sample.length, ok, problems };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = loadResults();
  const { errors, warnings } = checkResults(rows);
  const summaryPath = resolve(RESULTS, 'year-summary.csv');
  if (existsSync(summaryPath)) warnings.push(...checkYearSummary(rows, readCsvRecords(readFileSync(summaryPath, 'utf8'))));
  const enrichedPath = resolve(ENRICHED, 'breweries.json');
  const enriched = existsSync(enrichedPath) ? JSON.parse(readFileSync(enrichedPath, 'utf8')) : { breweries: {} };
  const enrichment = checkEnrichment(rows, enriched);
  console.log(`${rows.length} medal rows across ${new Set(rows.map((r) => r.year)).size} years`);
  console.log(`enrichment: ${enrichment.matched} of ${enrichment.total} breweries matched in Open Brewery DB, ${enrichment.unmatched} unmatched, ${enrichment.stateMismatches} state mismatches`);
  if (args.live) {
    const live = await liveCheck(enriched, args.limit ? Number(args.limit) : undefined);
    console.log(`live: ${live.ok} of ${live.checked} re-queried records unchanged`);
    warnings.push(...live.problems);
  }
  for (const w of [...warnings, ...enrichment.warnings]) console.log(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  if (errors.length) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
