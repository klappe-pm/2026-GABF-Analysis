import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { redact } from '../scripts/lib/redact.mjs';
import { extractFields, pageMatchesBeer, parseRobots, politeFetch, robotsAllows, sitemapLocs, splitList } from '../scripts/lib/site-scrape.mjs';
import { applyResult, cleanDashes } from '../scripts/lib/winner-apply.mjs';
import { loadContext, splitDoc } from '../scripts/winner-deep-dive.mjs';
import { loadHopLookup } from '../scripts/lib/hop-aliases.mjs';

const PAGE = `<html><head><title>Fuzztail Hefeweizen | Sunriver Brewing</title>
<meta name="description" content="A soft, banana and clove hefeweizen brewed with white wheat and Hallertau hops for easy summer drinking.">
<script type="application/ld+json">{"@type":"Product","name":"Fuzztail","description":"A soft, banana and clove hefeweizen brewed with white wheat for easy summer drinking.","additionalProperty":[{"name":"ABV","value":"5.1%"}]}</script></head>
<body><h1>Fuzztail</h1><ul><li>IBU: 14</li><li>SRM: 4</li><li>Hops: Hallertau Mittelfruh, Saphir</li><li>Yeast</li><li>Bavarian wheat yeast</li><li>OG: 1.050</li><li>FG 1.012</li></ul></body></html>`;

test('robots.txt: longest match wins and the project token is honoured', () => {
  const r = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/beers\nSitemap: https://x.test/s.xml\n\nUser-agent: gabf-analysis-research\nDisallow: /nothing-here');
  assert.equal(robotsAllows(r, '/private/x'), true);
  const star = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/beers');
  assert.equal(robotsAllows(star, '/private/x'), false);
  assert.equal(robotsAllows(star, '/private/beers/a'), true);
  assert.deepEqual(star.sitemaps, []);
  assert.deepEqual(r.sitemaps, ['https://x.test/s.xml']);
});

test('sitemap locations are read, CDATA included', () => {
  assert.deepEqual(sitemapLocs('<urlset><url><loc>https://a.test/beer/x</loc></url><url><loc><![CDATA[https://a.test/y]]></loc></url></urlset>'), ['https://a.test/beer/x', 'https://a.test/y']);
});

test('a page counts only when its title or heading names the beer', () => {
  assert.equal(pageMatchesBeer(PAGE, 'Fuzztail'), true);
  assert.equal(pageMatchesBeer(PAGE, 'Other Beer'), false);
});

test('fields are read from structured data and labelled lines', () => {
  const f = extractFields(PAGE);
  assert.equal(f.abv, 5.1);
  assert.equal(f.ibu, 14);
  assert.equal(f.srm, '4');
  assert.deepEqual(f.hops, ['Hallertau Mittelfruh', 'Saphir']);
  assert.deepEqual(f.yeast, ['Bavarian wheat yeast']);
  assert.equal(f.og, '1.050');
  assert.equal(f.fg, '1.012');
  assert.match(f.description, /banana and clove/);
});

test('out of range figures and sentences are not taken as values', () => {
  assert.equal(extractFields('<h1>X</h1><p>ABV: 99%</p>').abv, undefined);
  assert.deepEqual(splitList('We use a long sentence about hops that goes on and on and on forever'), []);
});

test('token-shaped values are redacted before they are kept', () => {
  const key = ['sk', 'a'.repeat(30)].join('-');
  const r = redact(`note ${key} end`);
  assert.equal(r.text, 'note [REDACTED:sk_style_key] end');
  assert.deepEqual(redact('plain beer text').kinds, []);
});

test('Untappd and BeerAdvocate are never fetched', async () => {
  for (const url of ['https://untappd.com/b/x/1', 'https://www.beeradvocate.com/beer/profile/1/2/']) {
    const r = await politeFetch(url);
    assert.equal(r.status, 0);
    assert.match(r.skipped, /never scraped/);
  }
});

test('dashes used as punctuation are rewritten', () => {
  const em = String.fromCharCode(0x2014);
  assert.equal(cleanDashes(`soft ${em} and bright`), 'soft, and bright');
  assert.equal(cleanDashes('4 - 6 weeks'), '4 to 6 weeks');
  assert.equal(cleanDashes('a -- b'), 'a, b');
});

test('apply fills only empty fields, records provenance and keeps the profile valid', () => {
  const dir = resolve(ROOT, 'docs/2026/winner');
  const file = '001-american-wheat-beer-1-wormtown-brewery-summer-ale.md';
  const text = readFileSync(resolve(dir, file), 'utf8');
  const ctx = loadContext();
  const res = applyResult(text, ctx, {
    found: { ibu: { value: 18, source: 'https://example.test/summer' }, abv: { value: 9.9, source: 'https://example.test/summer' }, yeast: { value: ['House ale yeast'], source: 'https://example.test/summer' } },
    tried: ['https://example.test/summer'], retrieved: '2026-10-14',
  }, { lookup: loadHopLookup(), file });
  assert.deepEqual(res.wrote.sort(), ['ibu', 'yeast']);
  assert.match(res.text, /^ibu: 18$/m);
  assert.match(res.text, /^abv: 4\.8$/m, 'an existing value is never overwritten');
  assert.match(res.text, /method: "scraped from brewery site"/);
  assert.match(res.text, /^\| IBU \| 18 \|/m);
  const gaps = splitDoc(res.text).data.gaps.map((g) => g.field);
  assert.ok(!gaps.includes('ibu') && !gaps.includes('yeast') && gaps.includes('malts'), 'a filled field has no gaps entry');
  assert.match(res.text, /https:\/\/example\.test\/summer/);
});

test('hop details fill blank form, use and farm, and add a named hop', () => {
  const dir = resolve(ROOT, 'docs/2026/winner');
  const file = '001-american-wheat-beer-1-wormtown-brewery-summer-ale.md';
  const text = readFileSync(resolve(dir, file), 'utf8');
  const res = applyResult(text, loadContext(), {
    found: { 'hop-profile': [{ published: 'Azacca', form: 'T90 pellets', use: 'dry hop', 'lot-or-farm': 'Roy Farms', source: 'https://example.test/s' }, { published: 'Citra', use: 'whirlpool', source: 'https://example.test/s' }] },
    tried: [], retrieved: '2026-10-14',
  }, { lookup: loadHopLookup(), file });
  const hp = splitDoc(res.text).data['hop-profile'];
  assert.equal(hp.find((h) => h.published === 'Azacca').form, 'T90 pellets');
  assert.equal(hp.find((h) => h.published === 'Azacca')['lot-or-farm'], 'Roy Farms');
  assert.equal(hp.find((h) => h.published === 'Citra').variety, 'Citra');
  assert.deepEqual(splitDoc(res.text).data.hops.sort(), ['Azacca', 'BRU-1', 'Citra']);
});
