#!/usr/bin/env node
// Enrich every brewery in the results with Open Brewery DB (address, coordinates, type,
// website) and write data/enriched/breweries.json. Responses are cached under
// data/cache/obdb/ (ignored by git) so reruns are cheap and polite.
//
//   node scripts/enrich-breweries.mjs            (all breweries missing enrichment)
//   node scripts/enrich-breweries.mjs --all      (refresh everything)
//   node scripts/enrich-breweries.mjs --offline  (apply overrides only, no network)
//
// Open Brewery DB is a free, no-key API: https://www.openbrewerydb.org/documentation

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CACHE, ENRICHED, REFERENCE, parseArgs } from './lib/paths.mjs';
import { loadDataset } from './lib/data-model.mjs';
import { breweryKey } from './lib/slug.mjs';
import { readCsvRecords } from './lib/csv.mjs';

const API = 'https://api.openbrewerydb.org/v1/breweries';
const USER_AGENT = 'gabf-analysis/0.1 (+https://github.com/klappe-pm/GABF-Analysis)';

function cachePath(query) {
  return resolve(CACHE, 'obdb', `${query.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`);
}

async function obdbSearch(name, state) {
  const query = `name=${name}&state=${state}`;
  const path = cachePath(query);
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  const url = `${API}?by_name=${encodeURIComponent(name.toLowerCase().replace(/\s+/g, '_'))}${state ? `&by_state=${encodeURIComponent(state.toLowerCase().replace(/\s+/g, '_'))}` : ''}&per_page=50`;
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Open Brewery DB ${res.status} for ${url}`);
  const json = await res.json();
  mkdirSync(resolve(CACHE, 'obdb'), { recursive: true });
  writeFileSync(path, JSON.stringify(json, null, 2));
  await new Promise((r) => setTimeout(r, 250));
  return json;
}

// Score a candidate against the brewery we know from the results.
export function scoreCandidate(candidate, { key, cities }) {
  let score = 0;
  if (breweryKey(candidate.name) === key) score += 10;
  else if (breweryKey(candidate.name).startsWith(key) || key.startsWith(breweryKey(candidate.name))) score += 5;
  if (cities.some((c) => c && candidate.city && c.toLowerCase() === candidate.city.toLowerCase())) score += 4;
  if (candidate.latitude && candidate.longitude) score += 1;
  if (['brewpub', 'micro', 'regional', 'large', 'taproom', 'nano'].includes(candidate.brewery_type)) score += 1;
  return score;
}

export function pickLocations(candidates, brewery) {
  const scored = candidates.map((c) => ({ c, score: scoreCandidate(c, { key: brewery.key, cities: brewery.locations.map((l) => l.city) }) })).filter((x) => x.score >= 5).sort((a, b) => b.score - a.score);
  const best = scored[0]?.c ?? null;
  const locations = scored.map((x) => x.c);
  return { best, locations };
}

function applyOverrides(record, overrides) {
  for (const o of overrides) {
    const loc = { source: 'override', label: o.brewery_location, address_1: o.address, city: o.city, state: o.state, postal_code: o.postal_code, latitude: o.latitude, longitude: o.longitude, website_url: o.website, brewery_type: o.brewery_type, notes: o.notes };
    if (!o.brewery_location) record.best = { ...(record.best ?? {}), ...Object.fromEntries(Object.entries(loc).filter(([, v]) => v)) };
    const existingIdx = record.locations.findIndex((l) => l.city?.toLowerCase() === o.city.toLowerCase() && (l.label ?? '') === (o.brewery_location ?? ''));
    if (existingIdx >= 0) record.locations[existingIdx] = { ...record.locations[existingIdx], ...Object.fromEntries(Object.entries(loc).filter(([, v]) => v)) };
    else if (o.brewery_location || record.locations.length === 0) record.locations.push(loc);
  }
  return record;
}

export async function enrich({ all = false, offline = false } = {}) {
  const dataset = loadDataset();
  const outPath = resolve(ENRICHED, 'breweries.json');
  const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : { breweries: {} };
  const overrides = readCsvRecords(readFileSync(resolve(REFERENCE, 'brewery-overrides.csv'), 'utf8'));
  const out = { generated_at: new Date().toISOString(), source: 'Open Brewery DB (https://www.openbrewerydb.org) plus data/reference/brewery-overrides.csv', breweries: { ...existing.breweries } };
  let fetched = 0;
  let failed = 0;
  for (const b of dataset.breweries) {
    const prior = out.breweries[b.key];
    let record = prior && !all ? { ...prior, locations: [...(prior.locations ?? [])] } : { key: b.key, name: b.name, best: null, locations: [], obdb_queried_at: null };
    if (!offline && (all || !prior || !prior.obdb_queried_at)) {
      const states = [...new Set(b.locations.map((l) => l.state).filter(Boolean))];
      try {
        const candidates = [];
        for (const state of states.length ? states : ['']) {
          const stateName = dataset.stateByCode[state]?.name ?? state;
          candidates.push(...(await obdbSearch(b.name.replace(/[^\w\s]/g, ' '), stateName)));
        }
        const { best, locations } = pickLocations(candidates, b);
        record = { key: b.key, name: b.name, best, locations: locations.map((l) => ({ source: 'openbrewerydb', ...l })), obdb_queried_at: new Date().toISOString(), obdb_candidates: candidates.length };
        fetched += 1;
      } catch (err) {
        failed += 1;
        record.error = err.message;
      }
    }
    out.breweries[b.key] = applyOverrides(record, overrides.filter((o) => breweryKey(o.brewery_name) === b.key));
  }
  mkdirSync(ENRICHED, { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  return { breweries: Object.keys(out.breweries).length, fetched, failed, outPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const r = await enrich({ all: Boolean(args.all), offline: Boolean(args.offline) });
  console.log(`${r.breweries} breweries in ${r.outPath}; fetched ${r.fetched}, failed ${r.failed}`);
  if (r.failed) console.warn('Some lookups failed; rerun later, the cache keeps what succeeded.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
