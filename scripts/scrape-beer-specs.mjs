#!/usr/bin/env node
// Scrape current published ABV and IBU for the 2018 to 2025 medal beers that have no value yet, from
// each brewery's own website, and record them in data/reference/beer-specs.csv (method: scraped from
// brewery site). Beers with nothing found are recorded in data/reference/beer-specs-gaps.csv with the
// URLs tried.
//
// The page search and the polite fetching are the shared ones: scrapeProfile in
// scripts/scrape-brewery-sites.mjs over scripts/lib/site-scrape.mjs, which obeys robots.txt, spaces
// requests per host, sends the project user agent, scans captured text for token-shaped values before
// caching, and never fetches Untappd, BeerAdvocate or RateBeer. On top of that, a value is kept only
// when one of the page's names (title, heading, og:title or JSON-LD name) equals the beer's name once
// the brewery or site part is split off, so a variant ("X Nitro", "Barrel-Aged X") never stands in.
//
// Usage: node scripts/scrape-beer-specs.mjs [--year 2023] [--limit N] [--concurrency 6] [--max-pages 6] [--dry-run]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readCsvRecords, toCsv } from './lib/csv.mjs';
import { loadDataset } from './lib/data-model.mjs';
import { ROOT, parseArgs } from './lib/paths.mjs';
import { fetchStats, norm, pageNames, politeFetch } from './lib/site-scrape.mjs';
import { METHOD, scrapeProfile } from './scrape-brewery-sites.mjs';
import { COLUMNS, SPECS, medalBeers, specKey } from './fetch-beer-specs.mjs';
import { GAPS, GAP_COLUMNS } from './import-beer-site-specs.mjs';

// Title separators: a pipe, colon, middle dot, en or em dash, or a spaced hyphen. The dash characters
// are built from their code points.
const DASHES = String.fromCharCode(0x00b7, 0x2013, 0x2014);
const SEPARATOR = new RegExp(`\\s+[|:${DASHES}-]\\s+|\\s*[|${DASHES}]\\s*`);

// A page name names this exact beer: the whole name, or one part of a title split at a separator
// ("Fudge Sickles | Fort George Brewery").
export function namesExactBeer(names, beer) {
  const key = norm(beer);
  if (key.length < 3) return false;
  return names.some((n) => norm(n) === key || String(n).split(SEPARATOR).some((part) => norm(part) === key));
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ds = loadDataset({ root: ROOT, localProfiles: false });
  const siteByKey = new Map(ds.breweries.map((b) => [b.key, b.website || '']));
  const read = (p) => (existsSync(p) ? readCsvRecords(readFileSync(p, 'utf8')) : []);
  const specs = read(SPECS);
  const gaps = read(GAPS);
  const have = new Set(specs.map((r) => specKey(r.brewery_name, r.beer_name)));
  let beers = medalBeers(ds.results, { year: args.year ? Number(args.year) : undefined }).filter((b) => !have.has(specKey(b.brewery, b.beer)));
  if (args.limit) beers = beers.slice(0, Number(args.limit));
  const gapByKey = new Map(gaps.map((g) => [specKey(g.brewery_name, g.beer_name), g]));
  console.log(`${beers.length} medal beers without a value; scraping brewery sites`);

  const added = [];
  let done = 0;
  await pool(beers, Number(args.concurrency ?? 6), async (b) => {
    const site = siteByKey.get(b.brewery_key);
    const k = specKey(b.brewery, b.beer);
    const res = site ? await scrapeProfile({ data: { beer: b.beer, 'brewery-url': site } }, { maxPages: Number(args['max-pages'] ?? 6) }) : { found: {}, tried: [], unresolved: ['no brewery website on file'] };
    const kept = {};
    for (const field of ['abv', 'ibu']) {
      const f = res.found[field];
      if (!f) continue;
      const page = await politeFetch(f.source);
      if (page.status === 200 && namesExactBeer(pageNames(page.body), b.beer)) kept[field] = f;
    }
    const src = kept.abv?.source ?? kept.ibu?.source;
    if (src && (!kept.ibu || kept.ibu.source === src)) {
      added.push({ brewery_name: b.brewery, beer_name: b.beer, abv: kept.abv ? String(kept.abv.value) : '', ibu: kept.ibu ? String(kept.ibu.value) : '', style: '', source_url: src, source_kind: 'brewery-site', retrieved: res.retrieved, match_confidence: 'high', match_basis: METHOD, source_beer_name: '', source_brewer_name: '' });
      gapByKey.delete(k);
    } else {
      const prior = gapByKey.get(k);
      const tried = [...new Set([...(prior?.sources_checked ? prior.sources_checked.split(' ; ') : []), ...res.tried, ...(res.unresolved ?? [])])];
      gapByKey.set(k, { brewery_name: b.brewery, beer_name: b.beer, checked: res.retrieved ?? new Date().toISOString().slice(0, 10), sources_checked: tried.join(' ; ') });
    }
    done += 1;
    if (done % 50 === 0) console.log(`${done} of ${beers.length} done, ${added.length} with a value`);
  });

  const sort = (a, b) => a.brewery_name.localeCompare(b.brewery_name) || a.beer_name.localeCompare(b.beer_name) || String(a.source_kind ?? '').localeCompare(String(b.source_kind ?? ''));
  if (!args['dry-run']) {
    writeFileSync(SPECS, toCsv([...specs, ...added].sort(sort), COLUMNS));
    writeFileSync(GAPS, toCsv([...gapByKey.values()].sort(sort), GAP_COLUMNS));
  }
  console.log(`${added.length} of ${beers.length} beers found on brewery sites (ABV ${added.filter((r) => r.abv).length}, IBU ${added.filter((r) => r.ibu).length}); requests ${JSON.stringify(fetchStats)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
