import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exploreRows } from '../web/lib/models/analysis.mjs';
import { beerIdOf, breweryIdOf, readEnrichment } from '../web/lib/models/explore-import.mjs';

// The identifiers of the retired explorer, kept so its exports and enrichment files still match.
const rows = exploreRows();

test('every medal row has an award, beer and brewery location identifier in the retired formats', () => {
  assert.equal(new Set(rows.map((r) => r.award_id)).size, rows.length);
  for (const r of rows) {
    assert.match(r.award_id, /^AW-\d{4}-\d{4}$/);
    assert.match(r.beer_id, /^BE-[a-z0-9-]+$/);
    assert.match(r.brewery_id, /^BR-[a-z0-9-]+$/);
  }
  assert.equal(breweryIdOf("Gowan's Heirloom Cider", 'Philo', 'CA'), 'BR-gowan-s-heirloom-cider-philo-ca');
  assert.equal(beerIdOf('West Coast IPA Is Dead!', 'Green Cheek Beer Co.'), 'BE-west-coast-ipa-is-dead-green-cheek-beer-co');
});

test('a row keeps the award identifier it had in the retired explorer', () => {
  const r = rows.find((x) => x.beer_name === 'West Coast IPA Is Dead!' && x.year === 2018);
  assert.equal(r.award_id, 'AW-2018-0001');
  assert.equal(r.brewery_id, 'BR-green-cheek-beer-co-orange-ca');
});

test('enrichment matches records by identifier and needs evidence', () => {
  const known = new Set(rows.map((r) => r.brewery_id));
  const id = rows[0].brewery_id;
  const ok = readEnrichment(`brewery_id,evidence_url,ownership\n${id},https://example.com/a,Acme Holdings\nBR-no-such-brewery-xx,https://example.com/b,Other`, 'breweries', known);
  assert.deepEqual(ok.patches, [{ id, fields: { ownership: 'Acme Holdings' }, evidence: 'https://example.com/a' }]);
  assert.equal(ok.skipped, 1);
  assert.equal(readEnrichment(`brewery_id,evidence_url\n${id},not a url`, 'breweries', known).error.code, 'no_evidence');
  assert.equal(readEnrichment(`brewery_id,evidence_url,ownership\n${id},https://e.com,a\n${id},https://e.com,b`, 'breweries', known).error.code, 'duplicate_id');
  assert.equal(readEnrichment('name,evidence_url\nx,https://e.com', 'breweries', known).error.column, 'brewery_id');
  assert.equal(readEnrichment(`beer_id,ownership\nx,y`, 'beers', known).error.column, 'evidence_url');
});
