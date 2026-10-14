import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSiteCopy } from '../scripts/lib/site-copy.mjs';
import { NOT_FOUND, NOT_FOUND_HTML } from '../site/assets/not-found.mjs';

test('the browser views and the build read the same Not Found wording from global.labels.not_found', () => {
  const copy = loadSiteCopy();
  assert.equal(copy('global.labels.not_found'), 'Not Found');
  assert.equal(NOT_FOUND, copy('global.labels.not_found'));
  assert.match(NOT_FOUND_HTML, new RegExp(`>${NOT_FOUND}<`));
});
