#!/usr/bin/env node
// Build the hop Markdown files with complete frontmatter and backlinks:
//   docs/hops/varieties/<slug>.md   from hop-varieties.csv, hop-aliases.csv, hop-acreage.csv and the 2026 profiles
//   docs/hops/farms/<slug>.md       from hop-farms.csv, hop-farm-varieties.csv and hop-merchants.csv
//   docs/hops/README.md and docs/hops/farms/README.md   the two indexes
// A variety page body comes from build-hop-data.mjs; a farm page keeps its researched body. Both get
// regenerated frontmatter and a regenerated "related" section.
//
//   node scripts/build-hop-docs.mjs            write the files
//   node scripts/build-hop-docs.mjs --check    exit 1 and list the files that are stale

import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { REFERENCE, ROOT } from './lib/paths.mjs';
import { readCsvRecords } from './lib/csv.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import { applyFiles, frontmatter, mdLink, metaFor, prose, relPath, sortText } from './lib/doc-meta.mjs';
import { PATHS, buildGraph } from './lib/doc-graph.mjs';
import { withoutRelated, byMedalThenBeer } from './lib/hops.mjs';
import { MEASURES, buildPage, buildReadme, buildVarietyRecords } from './build-hop-data.mjs';

const csv = (name) => {
  const file = resolve(REFERENCE, name);
  return existsSync(file) ? readCsvRecords(readFileSync(file, 'utf8')) : [];
};
const list = (text, sep = ';') => String(text ?? '').split(sep).map((x) => x.trim()).filter(Boolean);
const num = (v) => (v !== '' && v !== undefined && v !== null && Number.isFinite(Number(v)) ? Number(v) : null);
const orNull = (v) => (v === '' || v === undefined ? null : v);

const rangeText = (min, max) => {
  if (min === '' && max === '') return null;
  if (min === '') return `up to ${max}`;
  if (min === max) return String(min);
  return `${min} to ${max}`;
};

const KEYS = {
  alpha: 'alpha-acid-percent',
  beta: 'beta-acid-percent',
  cohumulone: 'cohumulone-percent-of-alpha',
  total_oil: 'total-oil-ml-per-100g',
  myrcene: 'myrcene-percent-of-oil',
  humulene: 'humulene-percent-of-oil',
  caryophyllene: 'caryophyllene-percent-of-oil',
  farnesene: 'farnesene-percent-of-oil',
};

const withBlank = (lines) => `${lines.join('\n')}\n`;
const bodyOf = (text) => parseFrontmatter(text).body.replace(/^\n+/, '');

const medalWord = (m) => String(m ?? '').toLowerCase();

// ---------- varieties ----------
function latestAcres(rows) {
  const withAcres = rows.filter((r) => r.acres !== '' && r.acres !== undefined);
  const years = withAcres.map((r) => Number(r.year)).filter(Boolean);
  if (!years.length) return { year: null, byState: [] };
  const year = Math.max(...years);
  const byState = withAcres.filter((r) => Number(r.year) === year).map((r) => `${r.state} ${Number(r.acres).toLocaleString('en-US')}`);
  return { year, byState };
}

function varietyMeta(row, v, acreageRows, dates) {
  const aliases = list(row.aliases);
  const latest = latestAcres(acreageRows.filter((a) => a.variety_slug === row.slug));
  const measures = Object.fromEntries(MEASURES.map((m) => [KEYS[m.col], rangeText(row[`${m.col}_min`], row[`${m.col}_max`])]));
  const aromaDescriptors = list(row.aroma_descriptors, ',');
  const sources = [...new Set([...list(row.identity_source_urls, '|'), ...list(row.chemistry_source_urls, '|'), ...list(row.aroma_source_urls, '|'), row.acreage_source_url].filter(Boolean))];
  const gaps = [];
  const need = (key, value) => { if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) gaps.push(key); };
  need('breeder', row.breeder);
  need('release-year', row.year_released);
  need('parentage', row.parentage);
  if (row.status === 'not published') gaps.push('proprietary-status');
  if (row.use === 'not published') gaps.push('use');
  for (const [key, value] of Object.entries(measures)) need(key, value);
  need('aroma-descriptors', aromaDescriptors);
  if (row.us_grown === 'yes' && !latest.year) gaps.push('us-acres-latest');
  return metaFor({
    category: 'hops',
    subCategory: 'variety',
    topics: ['hop-varieties', 'hops'],
    types: ['hop-variety'],
    status: 'DONE',
    aliases,
    tags: [row.status.replace(/ /g, '-'), row.origin_country.toLowerCase().replace(/ /g, '-'), row.kind],
    dates,
    extra: {
      ...measures,
      'alpha-class': orNull(row.alpha_class),
      'aroma-attribution': orNull(row.aroma_attribution),
      'aroma-descriptors': aromaDescriptors,
      breeder: orNull(row.breeder),
      'canonical-name': row.canonical_variety,
      gaps,
      kind: row.kind,
      'medal-beers-2026': v ? v.usages.size : 0,
      'origin-country': row.origin_country,
      'owner-program': orNull(row.breeder),
      parentage: orNull(row.parentage),
      'proprietary-status': row.status,
      'release-year': num(row.year_released),
      'release-year-note': orNull(row.year_note),
      slug: row.slug,
      sources,
      trademark: orNull(row.trademark),
      'us-acres-latest': latest.byState,
      'us-acres-latest-year': latest.year,
      'us-grown': row.us_grown === 'yes',
      use: row.use === 'not published' ? null : row.use,
      'use-basis': orNull(row.use_basis),
    },
  });
}

function varietyRelated(graph, v) {
  const self = PATHS.variety(v.docSlug);
  const lines = ['## related', ''];
  lines.push(`- ${mdLink('all hop varieties', self, PATHS.hopsIndex)}`, `- ${mdLink('all hop farms', self, PATHS.farmsIndex)}`, `- ${mdLink('all breweries', self, PATHS.breweriesIndex)}`, '');
  const grown = [...v.farms.values()].map((x) => x.farm).sort(graph.byName);
  lines.push('### grown-by', '', 'Farms that the hop farm data lists as growing this variety. A farm here grows the variety; it is not a statement that any brewery bought from it.', '');
  if (grown.length) {
    for (const f of grown) {
      const entry = v.farms.get(f.slug).entry;
      const years = [...entry.years].sort().join(', ');
      lines.push(`- ${mdLink(f.name, self, PATHS.farm(f.slug))}${f.state && f.state !== 'unstated' ? `, ${f.state}` : ''}; published as ${prose([...entry.published].join(', '))}${years ? `; ${years}` : ''}`);
    }
  } else lines.push('No farm in the hop farm data publishes this variety.');
  lines.push('');
  const usages = [...v.usages.values()].sort((a, b) => byMedalThenBeer(a.beer, b.beer));
  const namedPairs = [];
  for (const { beer, entries } of usages) for (const e of entries) if (e.farm) namedPairs.push({ beer, farm: e.farm });
  lines.push('### named-by-the-brewery', '', 'Farms a brewery named for this hop in its 2026 beer profile. This is a direct statement by the brewery about that beer.', '');
  if (namedPairs.length) {
    const seen = new Set();
    for (const { beer, farm } of namedPairs) {
      const key = `${farm.slug}|${beer.stem}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const brewery = graph.breweryBySlug.get(beer.brewery_slug);
      lines.push(`- ${mdLink(farm.name, self, PATHS.farm(farm.slug))}, named for ${mdLink(beer.beer, self, PATHS.beer(beer.stem))}${brewery ? ` by ${mdLink(brewery.name, self, PATHS.brewery(brewery.slug))}` : ''}`);
    }
  } else lines.push('No 2026 beer profile names a farm for this hop.');
  lines.push('');
  lines.push('### medal-beers-2026', '', '2026 medal beers whose profile names this hop.', '');
  if (usages.length) {
    for (const { beer, entries } of usages) {
      const published = sortText(entries.map((e) => e.published));
      const brewery = graph.breweryBySlug.get(beer.brewery_slug);
      lines.push(`- ${mdLink(beer.beer, self, PATHS.beer(beer.stem))}, ${medalWord(beer.medal)}, ${prose(beer.category)}${brewery ? `, by ${mdLink(brewery.name, self, PATHS.brewery(brewery.slug))}` : `, by ${prose(beer.brewery)}`}; published as ${prose(published.join(', '))}`);
    }
  } else lines.push('No 2026 medal beer profile names this hop.');
  lines.push('');
  const byBrewery = new Map();
  for (const { beer } of usages) {
    const b = graph.breweryBySlug.get(beer.brewery_slug);
    if (b) byBrewery.set(b.slug, { brewery: b, count: (byBrewery.get(b.slug)?.count ?? 0) + 1 });
  }
  lines.push('### breweries', '', 'Breweries with a 2026 medal beer that names this hop.', '');
  if (byBrewery.size) {
    for (const { brewery, count } of [...byBrewery.values()].sort((a, b) => graph.byName(a.brewery, b.brewery))) lines.push(`- ${mdLink(brewery.name, self, PATHS.brewery(brewery.slug))}, ${count} ${count === 1 ? 'beer' : 'beers'}`);
  } else lines.push('No brewery has a 2026 medal beer that names this hop.');
  return lines;
}

// ---------- farms ----------
function farmMeta(rec, f, merchantNames, existing, dates) {
  const self = PATHS.farm(rec.slug);
  const varietiesGrown = [];
  const withoutPage = [];
  for (const { variety } of f ? f.varieties.values() : []) {
    if (variety.listed) varietiesGrown.push(relPath(self, PATHS.variety(variety.docSlug)));
    else withoutPage.push(variety.name);
  }
  const sources = [rec.source_url, ...list(rec.other_sources, '|')].filter(Boolean);
  const state = /^[A-Z]{2}$/.test(rec.state) ? rec.state : null;
  const certifications = list(rec.certifications);
  const gaps = [];
  const need = (key, value) => { if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) gaps.push(key); };
  need('state', state);
  need('city', rec.city);
  need('county', rec.county);
  need('founded', rec.founded);
  need('generation', rec.generation);
  need('acreage', rec.acreage);
  need('ownership', rec.family_ownership);
  need('certifications', certifications);
  need('merchant-affiliation', rec.merchant_affiliation);
  need('varieties-grown', [...varietiesGrown, ...withoutPage]);
  return metaFor({
    category: 'hops',
    subCategory: 'farm',
    topics: ['hop-farms', 'hops'],
    types: ['hop-farm'],
    status: existing?.status ?? 'DRAFT',
    aliases: [],
    tags: [state ? state.toLowerCase() : 'state-not-stated', rec.verified === 'yes' ? 'verified' : 'unverified'],
    dates,
    extra: {
      acreage: orNull(rec.acreage),
      certifications,
      city: orNull(rec.city),
      county: orNull(rec.county),
      'county-source': orNull(rec.county_source),
      founded: num(rec.founded) ?? orNull(rec.founded),
      gaps,
      generation: orNull(rec.generation),
      'merchant-affiliation': orNull(rec.merchant_affiliation),
      merchants: merchantNames,
      name: rec.name,
      ownership: orNull(rec.family_ownership),
      'sells-direct': orNull(rec.sells_direct),
      slug: rec.slug,
      sources,
      state,
      'varieties-grown': varietiesGrown,
      'varieties-without-page': withoutPage,
      'variety-source-role': orNull(rec.variety_source_role),
      verification: orNull(rec.verification),
      verified: rec.verified === 'yes',
    },
  });
}

function farmRelated(graph, f, merchants) {
  const self = PATHS.farm(f.slug);
  const lines = ['## related', ''];
  lines.push(`- ${mdLink('all hop farms', self, PATHS.farmsIndex)}`, `- ${mdLink('all hop varieties', self, PATHS.hopsIndex)}`, `- ${mdLink('all breweries', self, PATHS.breweriesIndex)}`, '');
  const varieties = [...f.varieties.values()].sort((a, b) => graph.byName(a.variety, b.variety));
  lines.push('### varieties-grown', '', 'Varieties the hop farm data lists as grown here, each with the name the source printed.', '');
  if (varieties.length) {
    for (const x of varieties) {
      const years = [...x.years].sort().join(', ');
      const link = x.variety.listed ? mdLink(x.variety.name, self, PATHS.variety(x.variety.docSlug)) : prose(x.variety.name);
      lines.push(`- ${link}; published as ${prose([...x.published].join(', '))}${years ? `; ${years}` : ''}`);
    }
  } else lines.push('No variety is recorded for this farm.');
  lines.push('');
  const named = [...f.named.values()].sort((a, b) => byMedalThenBeer(a.beer, b.beer));
  lines.push('### named-by-the-brewery', '', 'Brewery statements: 2026 medal beers whose profile names this farm for a hop.', '');
  if (named.length) {
    for (const { beer, entries } of named) {
      const brewery = graph.breweryBySlug.get(beer.brewery_slug);
      const hops = [...new Map(entries.map((e) => [e.variety.slug, e.variety])).values()];
      const hopText = hops.map((h) => (h.listed ? mdLink(h.name, self, PATHS.variety(h.docSlug)) : prose(h.name))).join(', ');
      lines.push(`- ${mdLink(beer.beer, self, PATHS.beer(beer.stem))}${brewery ? ` by ${mdLink(brewery.name, self, PATHS.brewery(brewery.slug))}` : ''}, hop ${hopText}`);
    }
  } else lines.push('No 2026 beer profile names this farm.');
  lines.push('');
  const grown = [...f.grown.values()].sort((a, b) => byMedalThenBeer(a.beer, b.beer));
  lines.push('### reached-through-varieties', '', '2026 medal beers that name a hop this farm grows. The link runs through the variety: the farm grows the hop, and the brewery did not necessarily buy from this farm.', '');
  if (grown.length) {
    for (const { beer, varieties: vs } of grown) {
      const brewery = graph.breweryBySlug.get(beer.brewery_slug);
      const hopText = [...vs.values()].sort(graph.byName).map((h) => (h.listed ? mdLink(h.name, self, PATHS.variety(h.docSlug)) : prose(h.name))).join(', ');
      lines.push(`- ${mdLink(beer.beer, self, PATHS.beer(beer.stem))}${brewery ? ` by ${mdLink(brewery.name, self, PATHS.brewery(brewery.slug))}` : ''}, hops ${hopText}`);
    }
  } else lines.push('No 2026 medal beer names a hop this farm is recorded as growing.');
  lines.push('');
  const breweries = new Map();
  for (const { beer } of grown) { const b = graph.breweryBySlug.get(beer.brewery_slug); if (b) breweries.set(b.slug, b); }
  lines.push('### breweries-reached-through-varieties', '');
  if (breweries.size) for (const b of [...breweries.values()].sort(graph.byName)) lines.push(`- ${mdLink(b.name, self, PATHS.brewery(b.slug))}`);
  else lines.push('No brewery is reached through the varieties this farm grows.');
  lines.push('');
  lines.push('### merchants', '');
  if (merchants.length) {
    for (const m of merchants) lines.push(`- ${prose(m.name)}${m.type ? `, ${prose(m.type)}` : ''}${m.location ? `, ${prose(m.location)}` : ''}${m.source_url ? `; [source](${m.source_url})` : ''}`);
  } else lines.push('No merchant relationship is recorded for this farm.');
  return lines;
}

// ---------- files ----------
export function hopDocFiles(graph = buildGraph(), { root = ROOT } = {}) {
  const files = [];
  const records = buildVarietyRecords();
  const acreage = csv('hop-acreage.csv');
  const farmRecs = csv('hop-farms.csv');
  const merchants = csv('hop-merchants.csv');
  const model = graph.model;
  const bySlug = new Map(model.varieties.filter((x) => x.docSlug).map((x) => [x.docSlug, x]));

  for (const row of records) {
    const v = bySlug.get(row.slug);
    files.push([PATHS.variety(row.slug), (dates) => {
      if (!v) throw new Error(`variety ${row.slug} is not in the hop model`);
      const body = bodyOf(buildPage(row, acreage)).replace(/\n+$/, '');
      return withBlank([frontmatter(varietyMeta(row, v, acreage, dates)), '', body, '', ...varietyRelated(graph, v)]);
    }]);
  }

  for (const rec of farmRecs) {
    const f = model.farmBySlug.get(rec.slug);
    const rel = PATHS.farm(rec.slug);
    files.push([rel, (dates) => {
      const full = resolve(root, rel);
      const old = existsSync(full) ? parseFrontmatter(readFileSync(full, 'utf8')) : null;
      const body = old ? withoutRelated(old.body).replace(/^\n+/, '').replace(/\n+$/, '') : `# ${rec.slug}\n\n${prose(rec.name)} is recorded from the sources listed below.`;
      const merchantRows = f?.merchants ?? [];
      const names = merchantRows.map((m) => prose(m.name));
      return withBlank([frontmatter(farmMeta(rec, f, names, old?.data, dates)), '', body, '', ...farmRelated(graph, f, merchantRows)]);
    }]);
  }

  // hops index: regenerated body, frontmatter and a related section that lists every farm
  files.push([PATHS.hopsIndex, (dates) => {
    const body = bodyOf(buildReadme(records)).replace(/\n+$/, '');
    const meta = metaFor({ category: 'hops', subCategory: 'guide', topics: ['hop-varieties', 'hops'], types: ['guide'], status: 'DONE', tags: ['hops'], dates, extra: { 'farm-count': farmRecs.length, 'variety-count': records.length } });
    const lines = ['## related', '', `- ${mdLink('hop farms index', PATHS.hopsIndex, PATHS.farmsIndex)}`, `- ${mdLink('breweries index', PATHS.hopsIndex, PATHS.breweriesIndex)}`, '', '### hop-farms', ''];
    for (const f of model.farms) lines.push(`- ${mdLink(f.name, PATHS.hopsIndex, PATHS.farm(f.slug))}`);
    return withBlank([frontmatter(meta), '', body, '', ...lines]);
  }]);

  // farms index: researched prose kept, frontmatter regenerated, farm tables regenerated
  files.push([PATHS.farmsIndex, (dates) => {
    const full = resolve(root, PATHS.farmsIndex);
    const old = parseFrontmatter(readFileSync(full, 'utf8'));
    const body = withoutRelated(old.body).replace(/^\n+/, '').replace(/\n+$/, '');
    const meta = metaFor({ category: 'hops', subCategory: 'guide', topics: ['hop-farms', 'hops'], types: ['guide'], status: old.data.status ?? 'DRAFT', tags: ['hop-farms'], dates, extra: { 'farm-count': farmRecs.length, 'merchant-count': merchants.length } });
    const self = PATHS.farmsIndex;
    const lines = ['## related', '', `- ${mdLink('hop varieties index', self, PATHS.hopsIndex)}`, `- ${mdLink('breweries index', self, PATHS.breweriesIndex)}`, ''];
    return withBlank([frontmatter(meta), '', body, '', ...lines]);
  }]);

  return files;
}

// Pages for varieties that left the catalogue are removed.
export function staleVarietyFiles(records = buildVarietyRecords(), root = ROOT) {
  const dir = resolve(root, 'docs/hops/varieties');
  const keep = new Set(records.map((r) => `${r.slug}.md`));
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md') && !keep.has(f)).map((f) => resolve(dir, f)) : [];
}

function main() {
  const check = process.argv.includes('--check');
  const graph = buildGraph();
  const stale = applyFiles(hopDocFiles(graph), { check });
  const orphans = staleVarietyFiles();
  if (!check) for (const f of orphans) rmSync(f);
  const problems = check ? [...stale, ...orphans] : [];
  if (check && problems.length) {
    console.log(`${problems.length} hop documents are stale; run npm run docs:build`);
    for (const f of problems.slice(0, 20)) console.log(`  ${f}`);
    process.exit(1);
  }
  console.log(check ? 'hop documents are current' : `hop documents: ${stale.length} written`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
