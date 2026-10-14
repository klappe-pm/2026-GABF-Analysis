#!/usr/bin/env node
// Look up the 2026 winners in Catalog.beer (https://catalog.beer, CC BY 4.0) and record the match,
// ABV, IBU and style per profile in data/reference/catalog-beer-winners.csv.
//
// The API key is read from the macOS Keychain (service catalog-beer-api-key) inside this process,
// held in memory, and sent only as the HTTP Basic username. It is never printed or written.
// Raw responses are cached under data/cache/catalog-beer/ (ignored by git), so a rerun costs no
// requests. Each live request is counted and the count is printed at the end.
//
// Usage:
//   node scripts/fetch-catalog-beer.mjs --check-key     prints only the key length
//   node scripts/fetch-catalog-beer.mjs [year] [--max-requests N]

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadWinnerProfiles } from './lib/winner-profiles.mjs';
import { readCsvRecords } from './lib/csv.mjs';
import { ROOT } from './lib/paths.mjs';
import { beerPageUrl, lastModified, lookupBeer, readKey, requests } from './lib/catalog-beer.mjs';

export { beerPageUrl, norm, pickMatch, sameBrewer } from './lib/catalog-beer.mjs';
export const OUT = resolve(ROOT, 'data/reference/catalog-beer-winners.csv');

// Apply the recorded matches to the profiles: the Catalog.beer page joins the sources; ABV, IBU or
// style fills a profile field only when the field is empty (the brewery's own value wins), and a
// dated research note records what Catalog.beer lists. Uses no requests.
export function applyMatch(text, m, date) {
  if (!m.catalog_beer_id || text.includes(m.url)) return text;
  const end = text.indexOf('\n---', 4);
  let fm = text.slice(0, end);
  let body = text.slice(end);
  const cite = `[Catalog.beer: ${m.name}](${m.url})`;
  fm = fm.replace(/^sources:\n((?:  - .*\n?)*)/m, (all, items) => {
    const list = [...items.matchAll(/^  - (.*)$/gm)].map((x) => JSON.parse(x[1]));
    list.push(m.url);
    list.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return `sources:\n${list.map((u) => `  - ${JSON.stringify(u)}`).join('\n')}\n`;
  });
  const filled = [];
  const fill = (key, value, row, shown) => {
    if (value === '' || value === undefined) return;
    const re = new RegExp(`^${key}: (null|""|)$`, 'm');
    if (!re.test(fm)) return;
    fm = fm.replace(re, `${key}: ${key === 'style' ? JSON.stringify(value) : Number(value)}`);
    body = body.replace(new RegExp(`^\\| ${row} \\| not published \\| none found \\|$`, 'm'), `| ${row} | ${shown} | ${cite} |`);
    filled.push(key === 'abv' ? 'ABV' : key === 'ibu' ? 'IBU' : 'style');
  };
  fill('abv', m.abv, 'ABV', `${m.abv}%`);
  fill('ibu', m.ibu, 'IBU', m.ibu);
  fill('style', m.style, 'Style', m.style);
  const listed = [m.abv !== '' ? `${m.abv}% ABV` : '', m.ibu !== '' ? `${m.ibu} IBU` : '', m.style ? `style "${m.style.replace(/\s+-\s+/g, ': ')}"` : ''].filter(Boolean).join(', ');
  const note = `- Catalog.beer ${date}: ${cite} lists ${listed || 'no figures'}${m.last_modified ? ` (entry last modified ${m.last_modified})` : ''}. ${filled.length ? `It fills the empty ${filled.join(' and ')}; ` : ''}${filled.length ? 'where' : 'Where'} it differs from the brewery's own published value, the brewery's value stands.`;
  body = `${body.trimEnd()}\n${note}\n`;
  fm = fm.replace(/^date-revised: .*$/m, `date-revised: ${date}`);
  return fm + body;
}

function applyToProfiles(date) {
  const rows = readCsvRecords(readFileSync(OUT, 'utf8'));
  const dir = resolve(ROOT, 'docs/2026/winner');
  let n = 0;
  for (const m of rows) {
    const path = resolve(dir, m.profile);
    const before = readFileSync(path, 'utf8');
    const after = applyMatch(before, m, date);
    if (after !== before) { writeFileSync(path, after); n += 1; }
  }
  console.log(`${n} profiles updated from Catalog.beer`);
}

const q = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--apply')) { applyToProfiles(args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? new Date().toISOString().slice(0, 10)); return; }
  const key = readKey();
  if (args.includes('--check-key')) { console.log(`key length ${key.length}`); return; }
  if (!key) { console.error('Catalog.beer key not found in the Keychain (service catalog-beer-api-key).'); process.exit(1); }
  const mi = args.indexOf('--max-requests');
  if (mi >= 0) requests.max = Number(args[mi + 1]);
  const year = args.find((a) => /^\d{4}$/.test(a)) ?? '2026';
  const rows = [];
  const brewerBeers = new Map();
  for (const p of loadWinnerProfiles(Number(year))) {
    let hit = null;
    try {
      hit = (await lookupBeer(key, { brewery: p.fm.brewery, beer: p.fm.beer, site: p.fm['brewery-url'] }, brewerBeers))?.hit ?? null;
    } catch (err) {
      console.error(`${p.file}: ${err.message}`);
      if (/limit/.test(err.message)) break;
      continue;
    }
    rows.push([p.file, hit ? hit.id : '', hit ? beerPageUrl(hit.id) : '', hit?.name ?? '', hit?.brewer?.name ?? '', hit ? hit.abv : '', hit && hit.ibu !== null && hit.ibu !== undefined ? hit.ibu : '', hit?.style ?? '', lastModified(hit)]);
  }
  const header = 'profile,catalog_beer_id,url,name,brewer,abv,ibu,style,last_modified';
  writeFileSync(OUT, `${header}\n${rows.map((r) => r.map(q).join(',')).join('\n')}\n`);
  console.log(`${rows.filter((r) => r[1]).length} of ${rows.length} profiles matched; ${requests.live} live requests this run`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
