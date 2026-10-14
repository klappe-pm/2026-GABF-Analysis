import test from 'node:test';
import assert from 'node:assert/strict';
import { pickMatchWithConfidence } from '../scripts/lib/catalog-beer.mjs';
import { attachBeerSpecs } from '../scripts/lib/winner-specs.mjs';
import { medalBeers, specKey } from '../scripts/fetch-beer-specs.mjs';
import { abvCell } from '../site/assets/page-views.mjs';

const beer = (name, brewer, url = '') => ({ id: name, name, brewer: { name: brewer, url } });

test('a Catalog.beer match needs the same brewery and an exact normalized beer name', () => {
  const m = pickMatchWithConfidence([beer('Backside Stout', 'Steamworks Brewing Company')], 'Steamworks Brewing Co.', 'Backside Stout', '');
  assert.equal(m.confidence, 'high');
  assert.equal(pickMatchWithConfidence([beer('Backside Stout Nitro', 'Steamworks Brewing Company')], 'Steamworks Brewing Co.', 'Backside Stout', ''), null);
  assert.equal(pickMatchWithConfidence([beer('Backside Stout', 'Other Brewing Company')], 'Steamworks Brewing Co.', 'Backside Stout', ''), null);
});

test('dropping the brewery name from the front gives a medium confidence match', () => {
  const m = pickMatchWithConfidence([beer('Tripel', 'Allagash Brewing Company')], 'Allagash Brewing Co.', 'Allagash Tripel', '');
  assert.equal(m.confidence, 'medium');
  assert.match(m.basis, /without brewery prefix/);
});

test('a brewer that agrees only by website host is reported by its basis', () => {
  const m = pickMatchWithConfidence([beer('Oros', 'Offset Bier Company', 'https://offsetbier.com')], 'O set Bier Co.', 'Oros', 'https://www.offsetbier.com/');
  assert.match(m.basis, /^brewery website/);
});

test('medalBeers keeps one entry per brewery and beer across 2018 to 2025 only', () => {
  const rows = [
    { competition: 'GABF', year: 2024, medal: 'Gold', brewery_name: 'A Brewing Co.', brewery_key: 'a', beer_name: 'X' },
    { competition: 'GABF', year: 2025, medal: 'Silver', brewery_name: 'A Brewing Co.', brewery_key: 'a', beer_name: 'x' },
    { competition: 'GABF', year: 2026, medal: 'Gold', brewery_name: 'A Brewing Co.', brewery_key: 'a', beer_name: 'Y' },
  ];
  const list = medalBeers(rows);
  assert.equal(list.length, 1);
  assert.deepEqual([...list[0].years], [2024, 2025]);
});

test('current published values attach to earlier medal rows with their label, never to 2026', () => {
  const results = [
    { competition: 'GABF', year: 2023, brewery_name: 'A Brewing Co.', beer_name: 'X', spec: null },
    { competition: 'GABF', year: 2026, brewery_name: 'A Brewing Co.', beer_name: 'X', spec: null },
  ];
  const rows = [{ brewery_name: 'A Brewing Co.', beer_name: 'X', abv: '6.5', ibu: '', style: 'Stout', source_url: 'https://catalog.beer/beer/1', source_kind: 'catalog-beer', retrieved: '2026-10-14', match_confidence: 'high' }];
  assert.equal(attachBeerSpecs(results, rows, { keyOf: specKey }), 1);
  assert.equal(results[0].abv, 6.5);
  assert.equal(results[0].ibu, null);
  assert.equal(results[0].spec.current, true);
  assert.equal(results[0].spec.abv.source.label, 'Catalog.beer');
  assert.equal(results[1].spec, null);
  const html = abvCell({ ...results[0], abv_source: 'https://catalog.beer/beer/1', spec_note: 'current published value, Catalog.beer, retrieved 2026-10-14' });
  assert.match(html, /6\.5%/);
  assert.match(html, /current published value, Catalog\.beer, retrieved 2026-10-14/);
});
