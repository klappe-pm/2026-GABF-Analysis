import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteTextKeys } from '../scripts/lib/site-text-keys.mjs';
import { loadSiteCopy } from '../scripts/lib/site-copy.mjs';
import { setSiteText, TEXT_GROUPS, tx } from '../site/assets/site-text.mjs';

test('every key the old site reads through tx is a copy entry, so an edit there reaches both sites', () => {
  const copy = loadSiteCopy();
  const keys = siteTextKeys();
  assert.ok(keys.length > 0);
  for (const k of keys) assert.ok(copy.has(k), `${k} is not in the copy documents`);
  for (const g of TEXT_GROUPS) assert.ok(copy.keysUnder(g).length > 0, `${g} has no entries`);
});

test('tx reads the shipped copy, fills placeholders, and falls back to the words in the code', () => {
  assert.equal(tx('global.test.missing', 'In the code {{n}}', { n: 2 }), 'In the code 2');
  setSiteText({ 'global.test.present': 'From the copy {{n}}' });
  assert.equal(tx('global.test.present', 'In the code', { n: 3 }), 'From the copy 3');
});
