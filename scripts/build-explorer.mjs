#!/usr/bin/env node
// Build gabf-explorer.html at the repository root: the explorer prototype with its 2026 records
// filled from the winner research database (ABV, IBU, hops, other ingredients, beer and brewery pages).
//
// Every record also gains fed_district_name (Federal Reserve district, county based in split states).
// Only the embedded dataset JSON changes; the prototype's markup, styles, and code are copied as is.
// Records are matched on beer name, medal, and award category, which are unique within a year.
// A value the research did not find stays empty, so the explorer keeps showing "Not researched".
//
//   node scripts/build-explorer.mjs [--year 2026] [--in site/explorer/gabf-explorer-prototype.html] [--out gabf-explorer.html]
//
// Run node scripts/build-winner-db.mjs first. Needs Node 22 or newer for node:sqlite.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readCsvRecords } from './lib/csv.mjs';
import { districtAssigner } from './lib/data-model.mjs';
import { ROOT } from './lib/paths.mjs';
import { matchKey } from './lib/winner-profiles.mjs';

export { matchKey };

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const year = args.year || '2026';
const input = resolve(ROOT, args.in || 'site/explorer/gabf-explorer-prototype.html');
const output = resolve(ROOT, args.out || 'gabf-explorer.html');
const dbPath = resolve(ROOT, 'data', 'enriched', `winners-${year}.sqlite`);

const DATASET = /(<script type="application\/json" id="dataset">)([\s\S]*?)(<\/script>)/;

function loadResearch() {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const beers = db.prepare(`SELECT b.id, b.beer, b.medal, b.abv, b.ibu, b.style, b.beer_url, b.file, c.name AS category, br.url AS brewery_url
    FROM beers b JOIN categories c ON c.number = b.category_number JOIN breweries br ON br.name = b.brewery`).all();
  const ingredients = db.prepare('SELECT kind, name FROM ingredients i JOIN beer_ingredients bi ON bi.ingredient_id = i.id WHERE bi.beer_id = ? ORDER BY kind, name');
  const firstSource = db.prepare('SELECT url FROM sources WHERE beer_id = ? ORDER BY url LIMIT 1');
  const byKey = new Map();
  for (const b of beers) {
    const items = ingredients.all(b.id);
    const pick = (kind) => items.filter((i) => i.kind === kind).map((i) => i.name);
    const key = matchKey(b.beer, b.medal, b.category);
    if (byKey.has(key)) throw new Error(`duplicate research key ${key}`);
    byKey.set(key, { ...b, hops: pick('hop'), malts: pick('malt'), yeast: pick('yeast'), adjuncts: pick('adjunct'), source: firstSource.get(b.id)?.url ?? null });
  }
  db.close();
  return byKey;
}

function enrich(record, r) {
  const other = [
    r.malts.length ? `Malts: ${r.malts.join(', ')}` : '',
    r.yeast.length ? `Yeast: ${r.yeast.join(', ')}` : '',
    r.adjuncts.length ? `Adjuncts: ${r.adjuncts.join(', ')}` : '',
  ].filter(Boolean).join('; ');
  return {
    ...record,
    abv: r.abv === null ? '' : String(r.abv),
    ibu: r.ibu === null ? '' : String(r.ibu),
    confirmed_hops: r.hops.join('; '),
    hop_evidence: r.hops.length ? `Named in the cited sources of docs/${year}/winner/${r.file}` : `Not published in any source checked; see docs/${year}/winner/${r.file}`,
    ingredients: other,
    beer_style: r.style ?? '',
    beer_url: r.beer_url ?? '',
    website: r.brewery_url ?? '',
    evidence_url: r.beer_url ?? r.source ?? '',
    source_name: `Official ${year} winners list plus research profile docs/${year}/winner/${r.file}`,
    evidence_status: 'Specs from the brewery site and cited sources, researched 2026-10-13; gaps are stated in the profile, nothing estimated',
    research_profile: `docs/${year}/winner/${r.file}`,
  };
}

function main() {
  if (!existsSync(dbPath)) throw new Error(`${dbPath} missing; run node scripts/build-winner-db.mjs ${year}`);
  const html = readFileSync(input, 'utf8');
  const m = html.match(DATASET);
  if (!m) throw new Error(`${input}: no dataset script block`);
  const dataset = JSON.parse(m[2]);
  const research = loadResearch();
  // Federal Reserve district for every record (every year), assigned the same way as the site:
  // whole states directly, split states by the medal city's county.
  const ref = (f) => readCsvRecords(readFileSync(resolve(ROOT, 'data', 'reference', f), 'utf8'));
  const district = districtAssigner(ref('fed-districts.csv'), ref('medal-city-counties.csv'));
  let matched = 0;
  const unmatched = [];
  dataset.records = dataset.records.map((raw) => {
    const rec = { ...raw, fed_district_name: district(String(raw.state ?? '').toUpperCase(), String(raw.city ?? '').trim()).name };
    if (String(rec.year) !== year) return rec;
    const r = research.get(matchKey(rec.beer, rec.medal, rec.official_category));
    if (!r) { unmatched.push(`${rec.beer} (${rec.brewery})`); return rec; }
    matched += 1;
    return enrich(rec, r);
  });
  const json = JSON.stringify(dataset).replace(/<\//g, '<\\/');
  writeFileSync(output, html.replace(DATASET, (_, open, _body, close) => `${open}${json}${close}`));
  console.log(`${output}: ${matched} ${year} records enriched, ${unmatched.length} unmatched, ${research.size} research profiles`);
  if (unmatched.length) console.log(`unmatched: ${unmatched.join('; ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
