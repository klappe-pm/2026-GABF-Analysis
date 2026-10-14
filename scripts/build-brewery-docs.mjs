#!/usr/bin/env node
// Build one tracked Markdown file per brewery in the data model, plus the index:
//   docs/breweries/<slug>.md   frontmatter and a short body from the results, data/enriched/breweries.json,
//                              brewery-facts.csv, brewery-links.csv, ownership.csv and the 2026 hop profiles
//   docs/breweries/README.md   every brewery file
// The local breweries/ deep dives are git ignored and are not read here, so the files are the same on every checkout.
// Estimates (barrels, revenue) are left out.
//
//   node scripts/build-brewery-docs.mjs            write the files
//   node scripts/build-brewery-docs.mjs --check    exit 1 and list the files that are stale

import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { applyFiles, cell, frontmatter, mdLink, metaFor, prose, relPath, sortText } from './lib/doc-meta.mjs';
import { PATHS, buildGraph, reachOf } from './lib/doc-graph.mjs';

const orNull = (v) => (v === '' || v === undefined || v === null ? null : v);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const splitList = (text) => String(text ?? '').split(';').map((x) => x.trim()).filter(Boolean);

function hqOf(b, ds) {
  if (b.ownership?.hq_city && b.ownership?.hq_state) return { city: b.ownership.hq_city, state: b.ownership.hq_state };
  const top = [...b.locations].sort((x, y) => y.medals - x.medals || (x.city < y.city ? -1 : 1))[0];
  return { city: top?.city ?? '', state: top?.state ?? '' };
}

function medalYears(medals) {
  const years = new Map();
  for (const m of medals) {
    const y = years.get(m.year) ?? { year: m.year, gold: 0, silver: 0, bronze: 0 };
    const k = String(m.medal).toLowerCase();
    if (k in y) y[k] += 1;
    years.set(m.year, y);
  }
  return [...years.values()].sort((a, b) => b.year - a.year);
}

function breweryMeta(graph, b, dates) {
  const ds = graph.ds;
  const self = PATHS.brewery(b.slug);
  const reach = reachOf(graph, b.slug);
  const hq = hqOf(b, ds);
  const stateRow = ds.stateByCode[hq.state] ?? null;
  const hqRow = [...b.medals].reverse().find((m) => m.city === hq.city && m.state === hq.state) ?? [...b.medals].reverse().find((m) => m.state === hq.state) ?? null;
  const printed = sortText([...b.names, ...b.medals.map((m) => m.brewery_printed), ...b.other_medals.map((m) => m.brewery_printed), ...splitList(b.ownership?.aliases)].filter((n) => n && n !== b.name));
  const type = b.overrides.find((o) => !o.brewery_location && o.brewery_type)?.brewery_type ?? b.enriched?.best?.brewery_type ?? null;
  const links = b.links ?? {};
  const years = medalYears(b.medals);
  const facts = b.facts;
  const sources = sortText([links.source, b.ownership?.source, facts?.source].filter(Boolean));
  const meta = {
    'beer-count-2026': reach.beers.length,
    'beers-2026': reach.beers.map((beer) => relPath(self, PATHS.beer(beer.stem))),
    beeradvocate: orNull(links.beeradvocate),
    'brewery-type': type,
    'categories-won': sortText(b.medals.map((m) => m.category_name)),
    city: orNull(hq.city),
    'employees': facts ? Number(facts.employees) || null : null,
    'farms-named': [...reach.named.values()].map((x) => relPath(self, PATHS.farm(x.farm.slug))),
    'farms-reached': [...reach.grown.values()].map((x) => relPath(self, PATHS.farm(x.farm.slug))),
    'fed-district': hqRow?.fed_district ?? null,
    'fed-district-name': orNull(hqRow?.fed_district_name),
    'first-medal-year': b.first_year,
    founded: b.founded,
    'hops-used': [...reach.varieties.values()].filter((x) => graph.hasPage(x.variety)).map((x) => relPath(self, PATHS.variety(x.variety.docSlug))),
    instagram: orNull(links.instagram),
    'known-for': b.known_for ?? [],
    'last-medal-year': b.last_year,
    'medals-bronze': b.by_medal.Bronze,
    'medals-by-year': years.map((y) => `${y.year}: ${plural(y.gold, 'gold', 'gold')}, ${plural(y.silver, 'silver', 'silver')}, ${plural(y.bronze, 'bronze', 'bronze')}`),
    'medals-gold': b.by_medal.Gold,
    'medals-silver': b.by_medal.Silver,
    'medals-total': b.medals.length,
    name: b.name,
    ownership: orNull(b.ownership?.ownership_type),
    'ownership-parent': orNull(b.ownership?.parent),
    region: orNull(stateRow?.region),
    slug: b.slug,
    sources,
    state: orNull(hq.state),
    untappd: orNull(links.untappd),
    website: orNull(b.website),
    'world-beer-cup-medals': b.other_medals.length,
  };
  const gaps = [];
  for (const key of ['brewery-type', 'city', 'state', 'region', 'fed-district', 'founded', 'ownership', 'website', 'instagram', 'untappd', 'beeradvocate']) if (meta[key] === null) gaps.push(key);
  meta.gaps = gaps;
  return metaFor({
    category: 'breweries',
    subCategory: 'brewery',
    topics: ['breweries', 'gabf'],
    types: ['brewery'],
    status: 'DRAFT',
    aliases: printed,
    tags: [hq.state ? hq.state.toLowerCase() : 'state-not-stated', b.by_medal.Gold ? 'gold-medalist' : 'medalist', reach.beers.length ? 'medal-2026' : 'no-medal-2026'],
    dates,
    extra: meta,
  });
}

const beerLine = (self, beer) => `- ${mdLink(beer.beer, self, PATHS.beer(beer.stem))}, ${String(beer.medal).toLowerCase()}, ${prose(beer.category)}`;

function breweryBody(graph, b) {
  const self = PATHS.brewery(b.slug);
  const reach = reachOf(graph, b.slug);
  const hq = hqOf(b, graph.ds);
  const type = b.overrides.find((o) => !o.brewery_location && o.brewery_type)?.brewery_type ?? b.enriched?.best?.brewery_type ?? null;
  const where = hq.city ? ` of ${prose(hq.city)}${hq.state ? `, ${hq.state}` : ''}` : '';
  const years = medalYears(b.medals);
  const span = b.first_year === b.last_year ? `in ${b.last_year}` : `between ${b.first_year} and ${b.last_year}`;
  const wbc = b.other_medals.length ? ` It also holds ${plural(b.other_medals.length, 'World Beer Cup medal')}.` : '';
  const lines = [
    `# ${b.slug}`,
    '',
    `${prose(b.name)}${where}${type ? ` (${type})` : ''} has won ${plural(b.medals.length, 'GABF medal')} (${b.by_medal.Gold} gold, ${b.by_medal.Silver} silver, ${b.by_medal.Bronze} bronze) ${span}.${wbc}`,
    '',
    '## medals',
    '',
    '| Year | Gold | Silver | Bronze | Total |',
    '|---|---|---|---|---|',
    ...years.map((y) => `| ${y.year} | ${y.gold} | ${y.silver} | ${y.bronze} | ${y.gold + y.silver + y.bronze} |`),
    `| All years | ${b.by_medal.Gold} | ${b.by_medal.Silver} | ${b.by_medal.Bronze} | ${b.medals.length} |`,
    '',
    '## 2026-beers',
    '',
  ];
  if (reach.beers.length) for (const beer of reach.beers) lines.push(beerLine(self, beer));
  else lines.push('No 2026 medal.');
  lines.push('', '## hops', '');
  const hops = [...reach.varieties.values()].sort((a, c) => graph.byName(a.variety, c.variety));
  if (hops.length) {
    for (const { variety, beers } of hops) lines.push(`- ${graph.hasPage(variety) ? mdLink(variety.name, self, PATHS.variety(variety.docSlug)) : prose(variety.name)}, ${plural(beers.size, 'beer')}`);
  } else lines.push(reach.beers.length ? 'No 2026 profile names a hop.' : 'No 2026 medal beer, so no hop is recorded.');
  lines.push('', '## related', '');
  lines.push(`- ${mdLink('all breweries', self, PATHS.breweriesIndex)}`, `- ${mdLink('all hop varieties', self, PATHS.hopsIndex)}`, `- ${mdLink('all hop farms', self, PATHS.farmsIndex)}`, '');
  lines.push('### farms-named-by-the-brewery', '', 'Farms this brewery names for a hop in a 2026 beer profile. This is a direct statement by the brewery.', '');
  const named = [...reach.named.values()].sort((a, c) => graph.byName(a.farm, c.farm));
  if (named.length) {
    for (const { farm, varieties } of named) {
      const hopText = [...varieties].map((s) => graph.model.varietyBySlug.get(s)).sort(graph.byName).map((v) => (graph.hasPage(v) ? mdLink(v.name, self, PATHS.variety(v.docSlug)) : prose(v.name))).join(', ');
      lines.push(`- ${mdLink(farm.name, self, PATHS.farm(farm.slug))}, for ${hopText}`);
    }
  } else lines.push('No 2026 profile of this brewery names a farm.');
  lines.push('', '### farms-grown-reaching-its-hops', '', 'Farms recorded as growing a variety this brewery uses. The link runs through the variety; the brewery did not necessarily buy from these farms.', '');
  const grown = [...reach.grown.values()].sort((a, c) => graph.byName(a.farm, c.farm));
  if (grown.length) {
    for (const { farm, varieties } of grown) {
      const hopText = [...varieties].map((s) => graph.model.varietyBySlug.get(s)).sort(graph.byName).map((v) => (graph.hasPage(v) ? mdLink(v.name, self, PATHS.variety(v.docSlug)) : prose(v.name))).join(', ');
      lines.push(`- ${mdLink(farm.name, self, PATHS.farm(farm.slug))}, grows ${hopText}`);
    }
  } else lines.push('No farm is recorded as growing a variety this brewery uses.');
  return `${lines.join('\n')}\n`;
}

const tableLink = (text, from, to) => `[${cell(text).replace(/\[/g, '(').replace(/\]/g, ')')}](${relPath(from, to)})`;

export function breweryDocFiles(graph = buildGraph()) {
  const files = [];
  for (const b of graph.ds.breweries) {
    files.push([PATHS.brewery(b.slug), (dates) => `${frontmatter(breweryMeta(graph, b, dates))}\n\n${breweryBody(graph, b)}`]);
  }
  files.push([PATHS.breweriesIndex, (dates) => {
    const self = PATHS.breweriesIndex;
    const sorted = [...graph.ds.breweries].sort((a, c) => a.name.localeCompare(c.name, 'en', { sensitivity: 'base' }) || (a.slug < c.slug ? -1 : 1));
    const with2026 = sorted.filter((b) => (graph.beersByBrewery.get(b.slug) ?? []).length).length;
    const meta = metaFor({ category: 'breweries', subCategory: 'guide', topics: ['breweries', 'gabf'], types: ['guide'], status: 'DRAFT', tags: ['breweries'], dates, extra: { 'brewery-count': sorted.length, 'breweries-with-2026-beers': with2026 } });
    const lines = [
      '# README.MD',
      '',
      `Every brewery in the GABF results data has a file here: ${sorted.length} breweries, ${with2026} of them with a 2026 medal beer. Each file lists its medals, its 2026 beers, the hops those beers use, and the hop farms reached through them.`,
      '',
      '## breweries',
      '',
      '| Brewery | City | State | GABF medals | 2026 beers |',
      '|---|---|---|---|---|',
    ];
    for (const b of sorted) {
      const hq = hqOf(b, graph.ds);
      lines.push(`| ${tableLink(b.name, self, PATHS.brewery(b.slug))} | ${cell(hq.city)} | ${hq.state} | ${b.medals.length} | ${(graph.beersByBrewery.get(b.slug) ?? []).length} |`);
    }
    lines.push('', '## related', '', `- ${mdLink('all hop varieties', self, PATHS.hopsIndex)}`, `- ${mdLink('all hop farms', self, PATHS.farmsIndex)}`);
    return `${frontmatter(meta)}\n\n${lines.join('\n')}\n`;
  }]);
  return files;
}

// Files for breweries that left the data model are removed.
export function staleBreweryFiles(graph, root = ROOT) {
  const dir = resolve(root, 'docs/breweries');
  const keep = new Set([...graph.ds.breweries.map((b) => `${b.slug}.md`), 'README.md']);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md') && !keep.has(f)).map((f) => resolve(dir, f)) : [];
}

function main() {
  const check = process.argv.includes('--check');
  const graph = buildGraph();
  const stale = applyFiles(breweryDocFiles(graph), { check });
  const orphans = staleBreweryFiles(graph);
  if (!check) for (const f of orphans) rmSync(f);
  if (check && (stale.length || orphans.length)) {
    console.log(`${stale.length + orphans.length} brewery documents are stale; run npm run docs:build`);
    for (const f of [...stale, ...orphans].slice(0, 20)) console.log(`  ${f}`);
    process.exit(1);
  }
  console.log(check ? 'brewery documents are current' : `brewery documents: ${stale.length} written`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
