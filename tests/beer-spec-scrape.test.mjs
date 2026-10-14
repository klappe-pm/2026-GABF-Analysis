import test from 'node:test';
import assert from 'node:assert/strict';
import { namesExactBeer } from '../scripts/scrape-beer-specs.mjs';
import { mergeWebsites } from '../scripts/import-brewery-websites.mjs';

test('a scraped page counts only when one of its names is exactly the beer', () => {
  assert.equal(namesExactBeer(['Fudge Sickles | Fort George Brewery'], 'Fudge Sickles'), true);
  assert.equal(namesExactBeer(['Backside Stout'], 'Backside Stout'), true);
  assert.equal(namesExactBeer(['Backside Stout Nitro | Steamworks'], 'Backside Stout'), false);
  assert.equal(namesExactBeer(['Our Beers | Steamworks'], 'Backside Stout'), false);
  assert.equal(namesExactBeer(['IPA'], 'IP'), false);
});

test('a researched website is added only when none is on file and the host is the brewery\'s own', () => {
  const rows = [{ brewery_name: 'A Brewing Co.', website: 'https://a.example/', instagram: '', untappd: '', beeradvocate: '', source: 'website resolved', checked: '2026-10-01' }];
  const out = mergeWebsites(rows, [
    { brewery: 'A Brewing Co.', website: 'https://other.example/' },
    { brewery: 'B Brewing', website: 'https://bbrewing.example/' },
    { brewery: 'C Brewing', website: 'https://www.facebook.com/cbrewing' },
    { brewery: 'D Brewing', website: null },
  ], '2026-10-14');
  assert.equal(out.added, 1);
  assert.equal(out.rows.find((r) => r.brewery_name === 'A Brewing Co.').website, 'https://a.example/');
  assert.equal(out.rows.find((r) => r.brewery_name === 'B Brewing').website, 'https://bbrewing.example/');
  assert.equal(out.refused.length, 1);
});
