#!/usr/bin/env node
// Validate the hop reference data and check that every hop named in the 2026 beer profiles is covered.
//
//   node scripts/validate-hops.mjs
//
// Errors fail the run. The report lists how many profile hop mentions mapped to a canonical variety and which
// names are on the explicit unmapped list (data/reference/hop-unmapped.csv).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { REFERENCE, ROOT } from './lib/paths.mjs';
import { readCsvRecords } from './lib/csv.mjs';
import { loadHopLookup, resolveHop } from './lib/hop-aliases.mjs';
import { MEASURES, VARIETY_COLUMNS } from './build-hop-data.mjs';
import { ACREAGE_COLUMNS } from './ingest-nass-hops.mjs';

export const STATUSES = new Set(['proprietary', 'public', 'not published']);
export const KINDS = new Set(['variety', 'blend', 'group']);
export const ACREAGE_STATES = new Set(['Idaho', 'Oregon', 'Washington', 'United States']);
export const ACREAGE_SPECIAL = new Set(['all-varieties', 'experimental', 'other-varieties']);

export function readCsvFile(name, dir = REFERENCE) {
  return readCsvRecords(readFileSync(resolve(dir, name), 'utf8'));
}

export function csvHeader(name, dir = REFERENCE) {
  return readFileSync(resolve(dir, name), 'utf8').split('\n')[0].split(',');
}

// Structural checks on hop-varieties.csv rows. Returns an array of error strings.
export function checkVarietyRows(rows) {
  const errors = [];
  const seen = new Set();
  for (const r of rows) {
    const id = r.slug || '(no slug)';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) errors.push(`${id}: slug is not lowercase kebab-case`);
    if (seen.has(r.slug)) errors.push(`${id}: duplicate slug`);
    seen.add(r.slug);
    if (!r.canonical_name) errors.push(`${id}: empty canonical_name`);
    if (!r.origin_country) errors.push(`${id}: empty origin_country`);
    if (!KINDS.has(r.kind)) errors.push(`${id}: unknown kind "${r.kind}"`);
    if (!STATUSES.has(r.status)) errors.push(`${id}: unknown status "${r.status}"`);
    if (!['yes', 'no'].includes(r.us_grown)) errors.push(`${id}: us_grown must be yes or no`);
    const sources = ['identity_source_urls', 'chemistry_source_urls', 'aroma_source_urls'].flatMap((c) => r[c].split('|').filter(Boolean));
    if (sources.length === 0) errors.push(`${id}: no source in any field group`);
    for (const u of sources) if (!/^https:\/\//.test(u)) errors.push(`${id}: source "${u}" is not an https URL`);
    for (const m of MEASURES) {
      const min = r[`${m.col}_min`];
      const max = r[`${m.col}_max`];
      for (const v of [min, max]) if (v !== '' && !Number.isFinite(Number(v))) errors.push(`${id}: ${m.col} value "${v}" is not a number`);
      if (min !== '' && max !== '' && Number(min) > Number(max)) errors.push(`${id}: ${m.col} minimum exceeds maximum`);
    }
    const missing = MEASURES.filter((m) => r[`${m.col}_min`] === '' && r[`${m.col}_max`] === '');
    if (missing.length && !r.chemistry_gap) errors.push(`${id}: ${missing.map((m) => m.col).join(', ')} missing with no stated gap`);
    if (!r.aroma_descriptors && !r.aroma_gap) errors.push(`${id}: no aroma descriptors and no stated gap`);
    if (r.aroma_descriptors && !r.aroma_attribution) errors.push(`${id}: aroma descriptors without an attribution`);
    if (!r.breeder_program && !/breeder_program/.test(r.identity_gap)) errors.push(`${id}: no breeder program and no stated gap`);
    if (!r.year_released && !/year_released/.test(r.identity_gap)) errors.push(`${id}: no release year and no stated gap`);
    if (!r.parentage && !/parentage/.test(r.identity_gap)) errors.push(`${id}: no parentage and no stated gap`);
    if (r.nass_label && !r.acreage_source_url) errors.push(`${id}: NASS label without an acreage source`);
    if (!r.nass_label && r.acreage_source_url) errors.push(`${id}: acreage source without a NASS label`);
  }
  return errors;
}

export function checkAcreageRows(rows, varietyRows) {
  const errors = [];
  const slugs = new Set(varietyRows.map((v) => v.slug));
  const withNass = new Set(varietyRows.filter((v) => v.nass_label).map((v) => v.slug));
  const seen = new Set();
  for (const r of rows) {
    const id = `${r.variety}|${r.state}|${r.year}`;
    if (seen.has(id)) errors.push(`${id}: duplicate acreage row`);
    seen.add(id);
    if (!ACREAGE_SPECIAL.has(r.variety) && !slugs.has(r.variety)) errors.push(`${id}: variety is not in hop-varieties.csv`);
    if (slugs.has(r.variety) && !withNass.has(r.variety)) errors.push(`${id}: acreage for a variety with no NASS label`);
    if (!ACREAGE_STATES.has(r.state)) errors.push(`${id}: unknown state`);
    if (!/^20(2[1-5])$/.test(r.year)) errors.push(`${id}: year outside 2021 to 2025`);
    if (!/^https:\/\//.test(r.source)) errors.push(`${id}: source is not an https URL`);
    for (const [value, code] of [['acres', 'acres_code'], ['production_1000_lb', 'production_code'], ['yield_lb_per_acre', 'yield_code']]) {
      if (r[value] === '' && !['D', 'NA', 'X'].includes(r[code])) errors.push(`${id}: blank ${value} without a D, NA or X code`);
      if (r[value] !== '' && r[code] !== '') errors.push(`${id}: ${value} has both a value and a code`);
      if (r[value] !== '' && !(Number(r[value]) >= 0)) errors.push(`${id}: ${value} is not a non negative number`);
    }
  }
  return errors;
}

// Every hop name a 2026 profile publishes: the normalized `hops` list, plus `published` and `variety` of each
// `hop-profile` entry once the profiles carry that schema. Returns [{ name, file, field }].
export function profileHopNames(dir = resolve(ROOT, 'docs/2026/winner')) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const text = readFileSync(resolve(dir, file), 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) continue;
    const fm = YAML.parse(m[1]) ?? {};
    for (const name of fm.hops ?? []) out.push({ name: String(name), file, field: 'hops' });
    for (const entry of fm['hop-profile'] ?? []) {
      if (entry?.published) out.push({ name: String(entry.published), file, field: 'hop-profile.published' });
      if (entry?.variety) out.push({ name: String(entry.variety), file, field: 'hop-profile.variety' });
    }
  }
  return out;
}

export function classifyProfileHops(mentions, lookup) {
  const mapped = [];
  const unmapped = [];
  const unknown = [];
  for (const mention of mentions) {
    const r = resolveHop(mention.name, lookup);
    if (r.status === 'mapped') mapped.push({ ...mention, ...r });
    else if (r.status === 'unmapped') unmapped.push({ ...mention, ...r });
    else unknown.push(mention);
  }
  return { mapped, unmapped, unknown };
}

function unique(list) {
  return [...new Set(list)];
}

function main() {
  const varieties = readCsvFile('hop-varieties.csv');
  const acreage = readCsvFile('hop-acreage.csv');
  const errors = [];
  if (csvHeader('hop-varieties.csv').join(',') !== VARIETY_COLUMNS.join(',')) errors.push('hop-varieties.csv columns differ from the expected set');
  if (csvHeader('hop-acreage.csv').join(',') !== ACREAGE_COLUMNS.join(',')) errors.push('hop-acreage.csv columns differ from the expected set');
  errors.push(...checkVarietyRows(varieties), ...checkAcreageRows(acreage, varieties));
  const lookup = loadHopLookup();
  const { mapped, unmapped, unknown } = classifyProfileHops(profileHopNames(), lookup);
  for (const u of unknown) errors.push(`${u.file}: hop "${u.name}" (${u.field}) maps to no variety and is not on the unmapped list`);
  const count = (s) => varieties.filter((v) => v.status === s).length;
  console.log(`${varieties.length} varieties: ${count('proprietary')} proprietary, ${count('public')} public, ${count('not published')} status not published`);
  console.log(`${acreage.length} acreage rows`);
  const total = mapped.length + unmapped.length + unknown.length;
  console.log(`2026 profile hop mentions: ${total}; mapped ${mapped.length}; on the unmapped list ${unmapped.length}; unknown ${unknown.length}`);
  console.log(`distinct names: ${unique([...mapped, ...unmapped, ...unknown].map((m) => m.name)).length}; unmapped names: ${unique(unmapped.map((m) => m.name)).join('; ') || 'none'}`);
  for (const e of errors) console.log(`error: ${e}`);
  console.log(`${errors.length} errors`);
  process.exit(errors.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
