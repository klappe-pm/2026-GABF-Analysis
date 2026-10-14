// Catalog.beer client and matching (https://catalog.beer, CC BY 4.0), shared by the 2026 winner
// lookups (scripts/fetch-catalog-beer.mjs) and the medal row specs (scripts/fetch-beer-specs.mjs).
//
// The API key is read from the macOS Keychain (service catalog-beer-api-key) inside this process,
// held in memory, and sent only as the HTTP Basic username. It is never printed or written.
// Raw responses are cached under data/cache/catalog-beer/ (ignored by git), so a rerun costs no
// requests. Each live request is counted.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { breweryKey } from './slug.mjs';
import { ROOT } from './paths.mjs';

const API = 'https://api.catalog.beer';
const CACHE = resolve(ROOT, 'data/cache/catalog-beer');
export const beerPageUrl = (id) => `https://catalog.beer/beer/${id}`;

export function readKey() {
  try {
    return execFileSync('security', ['find-generic-password', '-s', 'catalog-beer-api-key', '-w'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

export const requests = { live: 0, max: Infinity };
export async function api(key, path) {
  mkdirSync(CACHE, { recursive: true });
  const file = resolve(CACHE, `${createHash('sha1').update(path).digest('hex')}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (requests.live >= requests.max) throw new Error('request limit for this run reached');
  requests.live += 1;
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, Accept: 'application/json' } });
  const body = res.status === 404 ? { data: [] } : await res.json();
  // 402 means the account's paid allowance is used up; the run stops rather than repeat it.
  if (res.status === 402) throw new Error('Catalog.beer 402: the request limit for this account is reached');
  if (!res.ok && res.status !== 404) throw new Error(`Catalog.beer ${res.status} on ${path.split('?')[0]}`);
  writeFileSync(file, JSON.stringify(body));
  return body;
}

export const norm = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const sameName = (brewer, brewery) => Boolean(brewer) && breweryKey(brewer.name) === breweryKey(brewery);
const sameHost = (brewer, site) => Boolean(brewer) && hostOf(site) !== '' && hostOf(brewer.url) === hostOf(site);
// A brewer is the same brewery when the normalized names agree or the websites share a host.
export const sameBrewer = (brewer, brewery, site) => sameName(brewer, brewery) || sameHost(brewer, site);

// The beer whose brewer resolves to the same brewery and whose name matches exactly, or, failing
// that, matches once the brewery's name is dropped from the front of either name. The confidence
// records how: brewery by name or by website host, beer name exact or with the brewery prefix dropped.
export function pickMatchWithConfidence(candidates, brewery, beer, site) {
  const key = breweryKey(brewery);
  const strip = (name) => norm(name).replace(new RegExp(`^${norm(key)}`), '');
  const same = candidates.filter((c) => sameBrewer(c.brewer, brewery, site));
  let hit = same.find((c) => norm(c.name) === norm(beer));
  let how = 'exact name';
  if (!hit) {
    hit = same.find((c) => strip(c.name) === strip(beer) && strip(beer).length > 2);
    how = 'name without brewery prefix';
  }
  if (!hit) return null;
  const by = sameName(hit.brewer, brewery) ? 'brewery name' : 'brewery website';
  return { hit, confidence: by === 'brewery name' && how === 'exact name' ? 'high' : 'medium', basis: `${by}, ${how}` };
}

export const pickMatch = (candidates, brewery, beer, site) => pickMatchWithConfidence(candidates, brewery, beer, site)?.hit ?? null;

// Look one beer up: a beer name search first, then the brewer's own catalog. `brewerBeers` caches
// each brewer's beer list across calls.
export async function lookupBeer(key, { brewery, beer, site }, brewerBeers = new Map()) {
  const search = await api(key, `/beer/search?q=${encodeURIComponent(beer)}&count=100`);
  const direct = pickMatchWithConfidence(search.data ?? [], brewery, beer, site);
  if (direct) return direct;
  const bs = await api(key, `/brewer/search?q=${encodeURIComponent(brewery)}&count=25`);
  const brewer = (bs.data ?? []).find((b) => sameBrewer(b, brewery, site));
  if (!brewer) return null;
  if (!brewerBeers.has(brewer.id)) brewerBeers.set(brewer.id, (await api(key, `/brewer/${brewer.id}/beer?count=500`)).data ?? []);
  const listed = pickMatchWithConfidence(brewerBeers.get(brewer.id).map((b) => ({ ...b, brewer })), brewery, beer, site);
  if (!listed) return null;
  return { ...listed, hit: await api(key, `/beer/${listed.hit.id}`) };
}

export const lastModified = (hit) => (hit?.last_modified ? new Date(hit.last_modified * 1000).toISOString().slice(0, 10) : '');
