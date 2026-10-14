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

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadWinnerProfiles } from './lib/winner-profiles.mjs';
import { readCsvRecords } from './lib/csv.mjs';
import { breweryKey } from './lib/slug.mjs';
import { ROOT } from './lib/paths.mjs';

const API = 'https://api.catalog.beer';
const CACHE = resolve(ROOT, 'data/cache/catalog-beer');
export const OUT = resolve(ROOT, 'data/reference/catalog-beer-winners.csv');
export const beerPageUrl = (id) => `https://catalog.beer/beer/${id}`;

function readKey() {
  try {
    return execFileSync('security', ['find-generic-password', '-s', 'catalog-beer-api-key', '-w'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

let live = 0;
let maxRequests = Infinity;
async function api(key, path) {
  mkdirSync(CACHE, { recursive: true });
  const file = resolve(CACHE, `${createHash('sha1').update(path).digest('hex')}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (live >= maxRequests) throw new Error('request limit for this run reached');
  live += 1;
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, Accept: 'application/json' } });
  const body = res.status === 404 ? { data: [] } : await res.json();
  if (!res.ok && res.status !== 404) throw new Error(`Catalog.beer ${res.status} on ${path.split('?')[0]}`);
  writeFileSync(file, JSON.stringify(body));
  return body;
}

export const norm = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

// The beer whose brewer resolves to the same brewery key and whose name matches exactly, or, failing
// that, matches once the brewery's name is dropped from the front of either name.
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
// A brewer is the same brewery when the normalized names agree or the websites share a host.
export const sameBrewer = (brewer, brewery, site) => Boolean(brewer) && (breweryKey(brewer.name) === breweryKey(brewery) || (hostOf(site) !== '' && hostOf(brewer.url) === hostOf(site)));
export function pickMatch(candidates, brewery, beer, site) {
  const key = breweryKey(brewery);
  const strip = (name) => norm(name).replace(new RegExp(`^${norm(key)}`), '');
  const same = candidates.filter((c) => sameBrewer(c.brewer, brewery, site));
  return same.find((c) => norm(c.name) === norm(beer)) ?? same.find((c) => strip(c.name) === strip(beer) && strip(beer).length > 2) ?? null;
}

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
  if (mi >= 0) maxRequests = Number(args[mi + 1]);
  const year = args.find((a) => /^\d{4}$/.test(a)) ?? '2026';
  const rows = [];
  const brewerBeers = new Map();
  for (const p of loadWinnerProfiles(Number(year))) {
    const { brewery, beer } = p.fm;
    const site = p.fm['brewery-url'];
    let hit = null;
    try {
      const search = await api(key, `/beer/search?q=${encodeURIComponent(beer)}&count=100`);
      hit = pickMatch(search.data ?? [], brewery, beer, site);
      if (!hit) {
        // Fall back to the brewer's own catalog.
        const bs = await api(key, `/brewer/search?q=${encodeURIComponent(brewery)}&count=25`);
        const brewer = (bs.data ?? []).find((b) => sameBrewer(b, brewery, site));
        if (!brewer && process.env.DEBUG) console.error(`no brewer ${brewery} | candidates ${(bs.data ?? []).slice(0, 3).map((b) => b.name).join('; ')}`);
        if (brewer) {
          if (!brewerBeers.has(brewer.id)) brewerBeers.set(brewer.id, (await api(key, `/brewer/${brewer.id}/beer?count=500`)).data ?? []);
          const listed = pickMatch(brewerBeers.get(brewer.id).map((b) => ({ ...b, brewer })), brewery, beer, site);
          if (listed) hit = await api(key, `/beer/${listed.id}`);
          else if (process.env.DEBUG) console.error(`miss ${brewery} | ${beer} | ${brewerBeers.get(brewer.id).length} beers listed`);
        }
      }
    } catch (err) {
      console.error(`${p.file}: ${err.message}`);
      if (/limit/.test(err.message)) break;
      continue;
    }
    rows.push([p.file, hit ? hit.id : '', hit ? beerPageUrl(hit.id) : '', hit?.name ?? '', hit?.brewer?.name ?? '', hit ? hit.abv : '', hit && hit.ibu !== null && hit.ibu !== undefined ? hit.ibu : '', hit?.style ?? '', hit?.last_modified ? new Date(hit.last_modified * 1000).toISOString().slice(0, 10) : '']);
  }
  const header = 'profile,catalog_beer_id,url,name,brewer,abv,ibu,style,last_modified';
  writeFileSync(OUT, `${header}\n${rows.map((r) => r.map(q).join(',')).join('\n')}\n`);
  console.log(`${rows.filter((r) => r[1]).length} of ${rows.length} profiles matched; ${live} live requests this run`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
