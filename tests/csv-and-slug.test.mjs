import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, readCsvRecords, toCsv } from '../scripts/lib/csv.mjs';
import { breweryKey, slugify, splitLocationSuffix } from '../scripts/lib/slug.mjs';

test('csv round trips quoted fields', () => {
  const records = [{ a: 'plain', b: 'has, comma', c: 'has "quote"' }, { a: 'x', b: '', c: 'multi\nline' }];
  const text = toCsv(records, ['a', 'b', 'c']);
  const back = readCsvRecords(text);
  assert.deepEqual(back, records);
  assert.equal(parseCsv('a,b\r\n1,2\r\n').length, 2);
});

test('breweryKey folds corporate suffixes and punctuation', () => {
  assert.equal(breweryKey('Green Cheek Beer Co.'), 'green cheek');
  assert.equal(breweryKey('Green Cheek Beer Company'), 'green cheek');
  assert.equal(breweryKey('The Westbound & Down Brewing Co.'), 'westbound and down');
  assert.equal(breweryKey("Russian River Brewing Company"), 'russian river');
  assert.equal(breweryKey('Beer Co.'), 'beer');
});

test('slugify and splitLocationSuffix', () => {
  assert.equal(slugify('Green Cheek Beer Co.'), 'green-cheek-beer-co');
  assert.equal(slugify('Westbound & Down'), 'westbound-and-down');
  assert.deepEqual(splitLocationSuffix('Green Cheek Beer Co. (Costa Mesa)'), { name: 'Green Cheek Beer Co.', location: 'Costa Mesa' });
  assert.deepEqual(splitLocationSuffix('Green Cheek Beer Co. - Costa Mesa'), { name: 'Green Cheek Beer Co.', location: 'Costa Mesa' });
  assert.deepEqual(splitLocationSuffix('Plain Brewing'), { name: 'Plain Brewing', location: '' });
});
