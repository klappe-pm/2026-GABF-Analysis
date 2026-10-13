#!/usr/bin/env node
// Create a brewery deep-dive markdown file pre-filled from the loaded data.
//
//   node scripts/scaffold-brewery.mjs --brewery "Westbound & Down Brewing Co."
//
// Prints a research checklist afterwards so the deep dive can be completed quickly.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BREWERIES, parseArgs } from './lib/paths.mjs';
import { loadDataset } from './lib/data-model.mjs';
import { breweryKey, slugify } from './lib/slug.mjs';
import { stringifyFrontmatter } from './lib/frontmatter.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.brewery) {
  console.error('usage: node scripts/scaffold-brewery.mjs --brewery "Brewery Name"');
  process.exit(2);
}
const ds = loadDataset();
const key = breweryKey(args.brewery);
const b = ds.breweries.find((x) => x.key === key);
if (!b) {
  console.error(`No brewery matching "${args.brewery}" in the loaded results. Known names include: ${ds.breweries.slice(0, 10).map((x) => x.name).join('; ')}`);
  process.exit(1);
}
const slug = slugify(b.name);
const path = resolve(BREWERIES, `${slug}.md`);
if (existsSync(path) && !args.force) {
  console.error(`${path} already exists (use --force to overwrite).`);
  process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
const families = [...new Set(b.medals.map((m) => m.style_family))];
const locs = (b.enriched?.locations ?? []).map((l) => ({ name: l.label || l.city, address: l.address_1 ?? '', city: l.city ?? '', state: l.state ?? '', 'postal-code': l.postal_code ?? '', opened: null, kitchen: false, notes: l.source === 'openbrewerydb' ? 'From Open Brewery DB' : (l.notes ?? '') }));
const data = {
  domain: 'beer', category: 'brewery', 'sub-category': 'deep-dive', topics: ['gabf'], types: ['brewery-profile'],
  'date-created': today, 'date-revised': today, status: 'DRAFT', aliases: b.names.filter((n) => n !== b.name), tags: [],
  'barrels-estimate': null, brewery: b.name, 'brewery-type': b.brewery_type, founded: b.founded, 'has-kitchen': false,
  'hq-city': b.hq.city, 'hq-state': b.hq.state, 'known-for': families, locations: locs,
  'revenue-estimate-usd': null, 'revenue-high-usd': null, 'revenue-low-usd': null, website: b.website || '',
};
const template = readFileSync(resolve(BREWERIES, 'template-brewery.md'), 'utf8').split('\n---\n').slice(1).join('\n---\n').replace(/^# brewery-slug/m, `# ${slug}`);
const medalLines = [...b.medals].sort((x, y) => y.year - x.year).map((m) => `| ${m.year} | GABF | ${m.medal} | ${m.beer_name} | ${m.category_name}${m.entries ? ` (${m.entries} entries)` : ''} | ${m.brewery_location || m.city} |`);
const body = template.replace('The build fills the medal table from the results data; use this section for context on notable wins.', `| year | competition | medal | beer | category | location credited |\n|---|---|---|---|---|---|\n${medalLines.join('\n')}`);
writeFileSync(path, stringifyFrontmatter(data, body));
console.log(`wrote ${path}`);
console.log('\nResearch checklist:');
console.log(`  1. Founders and founding year: company site${b.website ? ` (${b.website})` : ''}, local press, Brewbound profile.`);
console.log('  2. Ownership and investors: Brewbound, trade press, state corporation records; add a row to data/reference/ownership.csv.');
console.log('  3. Locations and kitchens: company site, Open Brewery DB (npm run enrich), Google or OpenStreetMap.');
console.log('  4. Production: Brewers Association top 50 list, local press, TTB; add to data/reference/production.csv with basis reported or estimate.');
console.log('  5. Styles known for: Untappd top beers, company site, medal record above.');
console.log('  6. Rebuild: npm run build, then open dist/breweries/' + slug + '/index.html');
