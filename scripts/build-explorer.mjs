#!/usr/bin/env node
// Build gabf-explorer.html at the repository root: the explorer prototype with its dataset rebuilt
// from every data/results/gabf-YYYY.csv (all years on file, partial years flagged), and the 2026
// records filled from the winner research database (ABV, IBU, hops, other ingredients, beer and
// brewery pages). Earlier years carry medal rows only, with no specs.
//
// Every record also gains fed_district_name (Federal Reserve district, county based in split states)
// and the brewery attributes of the site's data model (type, ownership, investors, distribution, kitchen,
// region), read through breweryAttributeLookup so the explorer and the site cannot disagree. A value no
// source states is left empty and the explorer shows Not Found.
// The embedded dataset JSON and the Catalog.beer footer line change; the prototype's markup, styles,
// and code are otherwise copied as is.
// Records are matched on beer name, medal, and award category, which are unique within a year.
// A value the research did not find stays empty, so the explorer keeps showing "Not researched".
//
//   node scripts/build-explorer.mjs [--year 2026] [--in site/explorer/gabf-explorer-prototype.html] [--out gabf-explorer.html] [--baseline]
//
// --baseline skips the research database, which is how the prototype's own embedded dataset is refreshed.
//
// Run node scripts/build-winner-db.mjs first. Needs Node 22 or newer for node:sqlite.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readCsvRecords } from './lib/csv.mjs';
import { beerDetailsHtml } from './lib/catalog-attribution.mjs';
import { breweryAttributeLookup, canonicalCategoryNames, categoryFold, districtAssigner, loadDataset, MEDAL_POINTS } from './lib/data-model.mjs';
import { VALUE_LABELS } from '../site/assets/filter-bar.mjs';
import { ROOT } from './lib/paths.mjs';
import { inlineBrandCss } from './brand/build.mjs';
import { slugify } from './lib/slug.mjs';
import { matchKey } from './lib/winner-profiles.mjs';

export { matchKey };

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const year = args.year || '2026';
const baseline = process.argv.includes('--baseline');
const input = resolve(ROOT, args.in || 'site/explorer/gabf-explorer-prototype.html');
const output = resolve(ROOT, args.out || 'gabf-explorer.html');
const dbPath = resolve(ROOT, 'data', 'enriched', `winners-${year}.sqlite`);

const FOOTER_DETAILS = /(<span id="beer-details">)([\s\S]*?)(<\/span>)/;
const DATASET = /(<script type="application\/json" id="dataset">)([\s\S]*?)(<\/script>)/;
// The brand colors and fonts, inlined from site/assets/brand.css and the self hosted fonts (generated from the design settings).
const BRAND = /(<style id="brand">)([\s\S]*?)(<\/style>)/;
export const inlineBrand = (html) => {
  if (!BRAND.test(html)) throw new Error('explorer template has no brand style block');
  return html.replace(BRAND, (_, open, _body, close) => `${open}\n${inlineBrandCss()}${close}`);
};


const RESULTS = resolve(ROOT, 'data', 'results');
const SECTIONS = new Set(['main', 'pro-am', 'collaboration']);
// Official winners list pages where the explorer knows one; other years cite the source column.
const RESULT_URLS = {
  2022: 'https://cdn.greatamericanbeerfestival.com/wp-content/uploads/GABF22-Winners-List-2.pdf',
  2023: 'https://cdn.greatamericanbeerfestival.com/wp-content/uploads/GABF23-Winners-List-1.pdf',
  2024: 'https://cdn.greatamericanbeerfestival.com/wp-content/uploads/GABF24-Winners-List.pdf',
  2025: 'https://www.greatamericanbeerfestival.com/2025-winners/',
  2026: 'https://www.greatamericanbeerfestival.com/the-competition/winners/',
};
const lookup = (q) => `https://www.google.com/search?q=${encodeURIComponent(q).replace(/'/g, '%27')}`;

// Every GABF results file, as raw rows. The year in the file name is the year of the rows.
export function loadResultRows(dir = RESULTS) {
  return readdirSync(dir).filter((f) => /^gabf-\d{4}\.csv$/.test(f)).sort()
    .flatMap((f) => readCsvRecords(readFileSync(resolve(dir, f), 'utf8')));
}

// The explorer dataset: one record per medal row on file, plus year metadata. A record that was
// already in `previous` keeps its identifiers so saved links and exports stay stable.
export function buildDataset(rows, previous = [], summary = []) {
  const canonical = canonicalCategoryNames(rows);
  const sig = (y, section, category, medal, beer, brewery) => [y, section, categoryFold(category), medal, beer, brewery].map((x) => String(x).trim().toLowerCase()).join('|');
  const known = new Map(previous.map((r) => [sig(r.year, r.competition_section, r.official_category, r.medal, r.beer, r.brewery), r]));
  const nextSeq = {};
  for (const r of previous) nextSeq[r.year] = Math.max(nextSeq[r.year] ?? 0, Number(String(r.award_id).split('-').at(-1)) || 0);
  const beerIds = new Map(previous.map((r) => [`${r.beer}|${r.brewery}`, r.beer_id]));
  const breweryIds = new Map(previous.map((r) => [`${r.brewery}|${r.city}|${r.state}`, r.brewery_id]));
  const perBrewery = new Map();
  for (const r of rows) perBrewery.set(r.brewery_name, (perBrewery.get(r.brewery_name) ?? 0) + 1);

  const records = rows.map((r) => {
    if (!SECTIONS.has(r.section || 'main')) throw new Error(`${r.year}: unknown section ${r.section}`);
    const category = canonical.get(categoryFold(r.category_name)) ?? r.category_name;
    const section = r.section || 'main';
    const old = known.get(sig(r.year, section, category, r.medal, r.beer_name, r.brewery_name));
    const awardId = old?.award_id ?? `AW-${r.year}-${String((nextSeq[r.year] = (nextSeq[r.year] ?? 0) + 1)).padStart(4, '0')}`;
    const beerId = beerIds.get(`${r.beer_name}|${r.brewery_name}`) ?? `BE-${slugify(r.beer_name)}-${slugify(r.brewery_name)}`;
    const breweryId = breweryIds.get(`${r.brewery_name}|${r.city}|${r.state}`) ?? `BR-${slugify(r.brewery_name)}-${slugify(r.city)}-${slugify(r.state)}`;
    return {
      award_id: awardId,
      year: String(r.year),
      medal: r.medal,
      medal_points: String(MEDAL_POINTS[r.medal] ?? 0),
      beer_id: beerId,
      beer: r.beer_name,
      brewery_id: breweryId,
      brewery: r.brewery_name,
      city: r.city,
      state: r.state,
      official_category: category,
      category_number: r.category_number,
      entries: r.entries,
      competition_section: section,
      named_hops: '',
      hop_evidence: 'Not supplied in official winner data.',
      official_result_url: RESULT_URLS[r.year] ?? '',
      beer_lookup_url: lookup(`"${r.beer_name}" "${r.brewery_name}" beer`),
      brewery_lookup_url: lookup(`"${r.brewery_name}" ${r.city} ${r.state}`),
      imported_award_count_for_brewery: String(perBrewery.get(r.brewery_name)),
    };
  });

  // Year metadata. A year is partial when any of its rows says so in the notes, the same test the site uses.
  const yearStatus = {};
  for (const y of [...new Set(rows.map((r) => Number(r.year)))].sort((a, b) => a - b)) {
    const yr = rows.filter((r) => Number(r.year) === y);
    yearStatus[y] = {
      rows: yr.length,
      status: yr.some((r) => /partial seed|transcript draft/i.test(r.notes ?? '')) ? 'partial' : 'complete',
      source: [...new Set(yr.map((r) => r.source).filter(Boolean))].join('; '),
    };
  }
  const summaryYears = summary.filter((s) => s.competition === 'GABF').map((s) => Number(s.year));
  const targetYears = [...new Set([...Object.keys(yearStatus).map(Number), ...summaryYears])].sort((a, b) => a - b);
  return { records, yearStatus, targetYears };
}

// The brewery attributes of one record, taken from the data model (breweryAttributeLookup) and stored as
// text: a value no source states is the empty string, which the explorer shows as Not Found.
export function attributeFields(a) {
  return {
    brewery_type: a.brewery_type ?? '',
    ownership_type: a.ownership_type ?? '',
    investors: a.investors ?? '',
    distribution_channel: a.distribution_channel ?? '',
    has_kitchen: a.has_kitchen === null ? '' : a.has_kitchen ? 'yes' : 'no',
    region: a.region ?? '',
  };
}

// The words shown for each stored slug, the same labels the site uses.
export function valueLabels() {
  const only = (m) => Object.fromEntries(Object.entries(m).filter(([k, v]) => k && v !== 'Not Found'));
  return { brewery_type: only(VALUE_LABELS.brewery_type), ownership_type: only(VALUE_LABELS.ownership_type), distribution_channel: only(VALUE_LABELS.distribution_channel) };
}

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

function enrich(record, r, hops) {
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
    // The hop page each name links to, in the same order: the canonical variety of the site's hop model.
    confirmed_hop_slugs: r.hops.map((h) => hops.resolveVariety(h)?.slug ?? '').join('; '),
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
  const html = readFileSync(input, 'utf8');
  const m = html.match(DATASET);
  if (!m) throw new Error(`${input}: no dataset script block`);
  const dataset = JSON.parse(m[2]);
  const summary = readCsvRecords(readFileSync(resolve(RESULTS, 'year-summary.csv'), 'utf8'));
  const built = buildDataset(loadResultRows(), dataset.records, summary);
  dataset.records = built.records;
  dataset.year_status = built.yearStatus;
  dataset.target_years = built.targetYears;
  // Only the research year carries specs; every other year is medal rows.
  dataset.spec_years = baseline ? [] : [Number(year)];
  // localProfiles: false keeps the git-ignored breweries/ deep dives out, so the committed explorer is the same on every checkout.
  const ds = loadDataset({ localProfiles: false });
  const { hops } = ds;
  const attrs = breweryAttributeLookup(ds);
  dataset.value_labels = valueLabels();
  let research = new Map();
  if (!baseline) {
    if (!existsSync(dbPath)) throw new Error(`${dbPath} missing; run node scripts/build-winner-db.mjs ${year}`);
    research = loadResearch();
  }
  // Federal Reserve district for every record (every year), assigned the same way as the site:
  // whole states directly, split states by the medal city's county.
  const ref = (f) => readCsvRecords(readFileSync(resolve(ROOT, 'data', 'reference', f), 'utf8'));
  const district = districtAssigner(ref('fed-districts.csv'), ref('medal-city-counties.csv'));
  let matched = 0;
  const unmatched = [];
  dataset.records = dataset.records.map((raw) => {
    const rec = { ...raw, fed_district_name: district(String(raw.state ?? '').toUpperCase(), String(raw.city ?? '').trim()).name, ...attributeFields(attrs({ brewery_name: raw.brewery, state: raw.state })) };
    if (baseline || String(rec.year) !== year) return rec;
    const r = research.get(matchKey(rec.beer, rec.medal, rec.official_category));
    if (!r) { unmatched.push(`${rec.beer} (${rec.brewery})`); return rec; }
    matched += 1;
    return enrich(rec, r, hops);
  });
  const json = JSON.stringify(dataset).replace(/<\//g, '<\\/');
  if (!FOOTER_DETAILS.test(html)) throw new Error(`${input}: no beer-details footer span`);
  const out = inlineBrand(html).replace(DATASET, (_, open, _body, close) => `${open}${json}${close}`)
    .replace(FOOTER_DETAILS, (_, open, _body, close) => `${open}${beerDetailsHtml()}${close}`);
  writeFileSync(output, out);
  const perYear = Object.entries(built.yearStatus).map(([y, v]) => `${y}: ${v.rows}${v.status === 'partial' ? ' partial' : ''}`).join(', ');
  console.log(`${output}: ${dataset.records.length} records (${perYear})`);
  if (!baseline) console.log(`${matched} ${year} records enriched, ${unmatched.length} unmatched, ${research.size} research profiles`);
  if (unmatched.length) console.log(`unmatched: ${unmatched.join('; ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
