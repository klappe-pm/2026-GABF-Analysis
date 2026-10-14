#!/usr/bin/env node
// Fill empty fields of the 2026 winner profiles from each brewery's own website.
//
//   node scripts/scrape-brewery-sites.mjs [year] [file-filter-regex] [--apply] [--concurrency=6] [--max-pages=6]
//
// For each profile with an empty field the scraper tries, in order: the profile's beer-url, pages in the
// brewery's sitemap whose address carries the beer's name, and links on the home page and on its beer,
// shop and menu pages whose text or address carries the beer's name. A page is used only when its title,
// heading or structured data names the beer. JSON-LD Product or Beer data, meta descriptions and labelled
// lines (ABV, IBU, SRM, OG, FG, Hops, Malts, Yeast and so on) are read; nothing is estimated. robots.txt is
// obeyed, requests are spaced per host, the user agent names this project, captured text is scanned for
// token-shaped values before it is cached or written, and the cache (data/cache/) is not tracked by git.
//
// Without --apply the run only reports. With --apply each found value goes into the profile with its source
// URL, retrieval date and method (provenance), the URLs tried are added to the gaps, and the profile's
// derived sections are regenerated. Untappd and BeerAdvocate are never fetched.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { loadContext, missingFields, splitDoc, touch } from './winner-deep-dive.mjs';
import { applyResult } from './lib/winner-apply.mjs';
import { loadHopLookup } from './lib/hop-aliases.mjs';
import { anchors, extractFields, fetchStats, norm, pageMatchesBeer, politeFetch, getRobots, sameSite, sitemapLocs } from './lib/site-scrape.mjs';

export const METHOD = 'scraped from brewery site';
const LIST_PAGE = /\/(beers?|brews?|our-beers?|our-brews?|beer-list|shop|products?|menu|on-tap|tap-list|taproom|collections?)(\/|$|\?)/i;

const tokens = (beer) => String(beer).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
const urlCarries = (url, beer) => {
  try { return norm(new URL(url).pathname).includes(norm(beer)); } catch { return false; }
};

async function sitemapCandidates(origin, beer, budget) {
  const robots = await getRobots(origin);
  const roots = [...new Set([...robots.sitemaps, `${origin}/sitemap.xml`, `${origin}/wp-sitemap.xml`])].filter((u) => sameSite(u, origin)).slice(0, 3);
  const hits = [];
  const seen = new Set();
  const queue = [...roots];
  let fetched = 0;
  while (queue.length && fetched < budget) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const r = await politeFetch(url, { accept: 'application/xml,text/xml,*/*;q=0.5' });
    fetched += 1;
    if (r.status !== 200) continue;
    for (const loc of sitemapLocs(r.body)) {
      if (/\.xml(\?|$)/i.test(loc)) { if (/product|beer|brew|page|post|shop/i.test(loc) && sameSite(loc, origin)) queue.push(loc); } else if (urlCarries(loc, beer)) hits.push(loc);
    }
  }
  return { hits, tried: [...seen] };
}

export async function scrapeProfile(profile, { maxPages = 6 } = {}) {
  const d = profile.data;
  const beer = d.beer;
  const tried = [];
  const found = {};
  const unresolved = [];
  const lookup = profile.lookup;
  const base = d['brewery-url'];
  if (!base) return { found, tried, unresolved: ['no brewery website on file'] };
  let origin;
  try { origin = new URL(base).origin; } catch { return { found, tried, unresolved: ['brewery website is not a valid URL'] }; }

  const queue = [];
  const seen = new Set();
  const enqueue = (u) => { if (u && !seen.has(u) && sameSite(u, origin)) { seen.add(u); queue.push(u); } };
  if (d['beer-url']) enqueue(d['beer-url']);
  const sm = await sitemapCandidates(origin, beer, 3);
  tried.push(...sm.tried);
  sm.hits.slice(0, 3).forEach(enqueue);

  const home = await politeFetch(base);
  tried.push(base);
  const lists = [];
  if (home.status === 200) {
    for (const a of anchors(home.body, home.finalUrl ?? base)) {
      if (!sameSite(a.url, origin)) continue;
      if (urlCarries(a.url, beer) || norm(a.text).includes(norm(beer))) enqueue(a.url);
      else if (LIST_PAGE.test(a.url) && lists.length < 3 && !lists.includes(a.url)) lists.push(a.url);
    }
  }
  if (queue.length < 2) {
    for (const l of lists) {
      if (seen.has(l)) continue;
      seen.add(l);
      const r = await politeFetch(l);
      tried.push(l);
      if (r.status !== 200) continue;
      for (const a of anchors(r.body, r.finalUrl ?? l)) if (sameSite(a.url, origin) && (urlCarries(a.url, beer) || norm(a.text).includes(norm(beer)))) enqueue(a.url);
    }
  }

  let used = 0;
  let retrieved = null;
  while (queue.length && used < maxPages) {
    const url = queue.shift();
    const r = await politeFetch(url);
    tried.push(url);
    used += 1;
    if (r.status !== 200 || !r.body) continue;
    if (!pageMatchesBeer(r.body, beer)) continue;
    retrieved = r.fetchedAt ?? retrieved;
    const f = extractFields(r.body);
    const src = r.finalUrl ?? url;
    const take = (key, field, shape) => { if (f[key] !== undefined && !found[field]) found[field] = { value: shape ? shape(f[key]) : f[key], source: src }; };
    take('description', 'description'); take('tastingNotes', 'tasting-notes'); take('abv', 'abv'); take('ibu', 'ibu');
    take('srm', 'srm'); if (!found.srm && f.color) found.srm = { value: `${f.color} (no SRM number published)`, source: src };
    take('og', 'og'); take('fg', 'fg'); take('water', 'water'); take('process', 'process');
    take('hops', 'hops'); take('malts', 'malts'); take('yeast', 'yeast'); take('adjuncts', 'adjuncts');
  }
  return { found, tried: [...new Set(tried)], retrieved: retrieved ?? new Date().toISOString().slice(0, 10), unresolved, lookup };
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name, dflt) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
  const positional = args.filter((a) => !a.startsWith('--'));
  const year = positional[0] ?? '2026';
  const filter = positional[1] ? new RegExp(positional[1]) : null;
  const apply = args.includes('--apply');
  const concurrency = Number(flag('concurrency', 6));
  const maxPages = Number(flag('max-pages', 6));
  const dir = resolve(ROOT, 'docs', year, 'winner');
  const ctx = loadContext();
  const lookup = loadHopLookup();
  const files = readdirSync(dir).filter((x) => /^\d{3}-.+\.md$/.test(x)).sort().filter((f) => !filter || filter.test(f));
  const jobs = files.map((f) => {
    const text = readFileSync(resolve(dir, f), 'utf8');
    const { data } = splitDoc(text);
    return { f, text, data, missing: missingFields(data), lookup };
  }).filter((j) => j.missing.length);
  console.log(`${jobs.length} of ${files.length} profiles have an empty field; scraping with ${concurrency} hosts at a time`);
  const today = new Date().toISOString().slice(0, 10);
  const report = [];
  await pool(jobs, concurrency, async (j) => {
    const res = await scrapeProfile({ data: j.data, lookup }, { maxPages });
    const entry = { file: j.f, wrote: [], tried: res.tried.length, unresolved: res.unresolved };
    if (apply) {
      const out = applyResult(j.text, ctx, { found: res.found, tried: res.tried, retrieved: res.retrieved ?? today, method: METHOD }, { lookup, file: j.f });
      entry.wrote = out.wrote;
      entry.unresolved = [...(res.unresolved ?? [])];
      let next = out.text;
      if (next !== j.text) { next = touch(next, today); writeFileSync(resolve(dir, j.f), next); }
    } else entry.wrote = Object.keys(res.found).filter((k) => j.missing.includes(k));
    report.push(entry);
    console.log(`${j.f}: ${entry.wrote.length ? entry.wrote.join(', ') : 'nothing new'} (${entry.tried} pages tried)`);
  });
  const cache = resolve(ROOT, 'data/cache');
  mkdirSync(cache, { recursive: true });
  writeFileSync(resolve(cache, `scrape-report-${year}.json`), JSON.stringify({ at: today, fetchStats, report }, null, 1));
  const byField = {};
  for (const r of report) for (const w of r.wrote) byField[w] = (byField[w] ?? 0) + 1;
  console.log('fields found:', JSON.stringify(byField), 'requests:', JSON.stringify(fetchStats));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
