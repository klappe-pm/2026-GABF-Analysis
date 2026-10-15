// Brewery links and current beer lists: the reference tables join to brewery entities by
// normalized name, the checked website wins over Open Brewery DB, and the profile card renders
// plain labels and a dated list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadDataset } from '../scripts/lib/data-model.mjs';
import { breweryLinks, currentBeersHtml } from '../scripts/lib/site-payload.mjs';
import { readCsvRecords } from '../scripts/lib/csv.mjs';
import { ROOT } from '../scripts/lib/paths.mjs';

function fixtureRoot({ links = '', beers = '' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gabf-links-'));
  for (const d of ['data/results', 'data/reference', 'data/enriched']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'data/results/gabf-2026.csv'), 'year,competition,section,category_number,category_name,entries,medal,beer_name,brewery_printed,brewery_name,brewery_location,city,state,source,notes\n2026,GABF,main,1,American Wheat Beer,35,Gold,Summer Ale,Wormtown Brewery,Wormtown Brewery,,Worcester,MA,Official list,\n2026,GABF,main,1,American Wheat Beer,35,Silver,Fuzztail,Sunriver Brewing Co.,Sunriver Brewing Co.,,Sunriver,OR,Official list,\n');
  writeFileSync(join(root, 'data/enriched/breweries.json'), JSON.stringify({ breweries: { wormtown: { best: { website_url: 'http://open-brewery-db.example' } }, sunriver: { best: { website_url: 'http://sunriver.example' } } } }));
  writeFileSync(join(root, 'data/reference/estimation-parameters.json'), readFileSync(resolve(ROOT, 'data/reference/estimation-parameters.json')));
  writeFileSync(join(root, 'data/reference/brewery-links.csv'), `brewery_name,website,instagram,untappd,beeradvocate,source,checked\n${links}`);
  writeFileSync(join(root, 'data/reference/current-beers.csv'), `brewery_name,beer_name,style,abv,source,as_of\n${beers}`);
  return root;
}

test('brewery links join by normalized name and the checked website wins', () => {
  const root = fixtureRoot({ links: 'Wormtown Brewery Co.,https://wormtownbrewery.com/,https://www.instagram.com/wormtownbrewery/,https://untappd.com/WormtownBrewery,,checked by hand,2026-10-14\n' });
  const ds = loadDataset({ root });
  const w = ds.breweries.find((b) => b.key === 'wormtown');
  assert.equal(w.links.untappd, 'https://untappd.com/WormtownBrewery');
  assert.equal(w.website, 'https://wormtownbrewery.com/');
  const s = ds.breweries.find((b) => b.key === 'sunriver');
  assert.equal(s.links, null);
  assert.equal(s.website, 'http://sunriver.example', 'without a checked link the Open Brewery DB website stays');
  const html = breweryLinks(w);
  assert.match(html, />Instagram</);
  assert.match(html, />Untappd</);
  assert.doesNotMatch(html, /BeerAdvocate/, 'an empty column renders nothing');
  assert.match(html, /checked 2026-10-14/);
  assert.match(breweryLinks(s), /Not Found/);
});

test('current beers join per brewery and render dated, grouped by source', () => {
  const root = fixtureRoot({ beers: 'Wormtown Brewery,Be Hoppy,American IPA,6.5,https://wormtownbrewery.com/beer/,2026-10-14\nWormtown Brewery,Summer Ale,,,https://wormtownbrewery.com/beer/,2026-10-14\n' });
  const ds = loadDataset({ root });
  const w = ds.breweries.find((b) => b.key === 'wormtown');
  assert.equal(w.current_beers.length, 2);
  const html = currentBeersHtml(w);
  assert.match(html, /As of 2026-10-14, from <a href="https:\/\/wormtownbrewery.com\/beer\/" rel="noopener">wormtownbrewery.com<\/a>/);
  assert.match(html, /Be Hoppy <span class="muted">\(American IPA, 6.5% ABV\)<\/span>/);
  assert.match(html, /<li>Summer Ale<\/li>/);
  assert.match(currentBeersHtml(ds.breweries.find((b) => b.key === 'sunriver')), /Not Found/);
});

test('the tracked reference tables are well formed', () => {
  const links = readCsvRecords(readFileSync(resolve(ROOT, 'data/reference/brewery-links.csv'), 'utf8'));
  const seen = new Set();
  for (const l of links) {
    assert.ok(!seen.has(l.brewery_name), `${l.brewery_name} listed once`);
    seen.add(l.brewery_name);
    for (const k of ['website', 'instagram', 'untappd', 'beeradvocate']) if (l[k]) assert.match(l[k], /^https?:\/\//, `${l.brewery_name} ${k} is a web address`);
    if (l.instagram) assert.match(l.instagram, /^https:\/\/www\.instagram\.com\/[A-Za-z0-9_.]+\/$/);
    if (l.untappd) assert.match(l.untappd, /^https:\/\/untappd\.com\//);
    assert.match(l.checked, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(l.source, `${l.brewery_name} names how it was checked`);
  }
  const ds = loadDataset();
  const joined = new Set(ds.breweries.filter((b) => b.links).map((b) => b.links.brewery_name));
  for (const l of links) assert.ok(joined.has(l.brewery_name), `${l.brewery_name} joins to a brewery in the results`);
  const beers = readCsvRecords(readFileSync(resolve(ROOT, 'data/reference/current-beers.csv'), 'utf8'));
  for (const c of beers) {
    assert.ok(c.brewery_name && c.beer_name, 'brewery and beer named');
    assert.match(c.source, /^https:\/\//);
    assert.doesNotMatch(c.source, /untappd\.com/, 'current beer lists come from the brewery, not Untappd');
    assert.match(c.as_of, /^\d{4}-\d{2}-\d{2}$/);
    if (c.abv) assert.ok(Number(c.abv) > 0 && Number(c.abv) < 70, `${c.beer_name} abv is a number`);
  }
});
