import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEnrichment, checkResults, checkYearSummary, loadResults } from '../scripts/validate-data.mjs';

const row = (over = {}) => ({
  year: '2025', section: 'main', category_number: '1', category_name: 'American Wheat Beer', entries: '35', medal: 'Gold',
  beer_name: 'Summer Ale', brewery_name: 'Example Brewing Co.', city: 'Denver', state: 'CO', ...over,
});

test('checkResults accepts a clean category and flags a missing medal as a warning', () => {
  const { errors, warnings } = checkResults([row(), row({ medal: 'Silver', beer_name: 'B' })]);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, ['2025|main|1: no Bronze medal listed']);
});

test('checkResults fails on bad states, unknown medals, duplicates, and conflicting entry counts', () => {
  const { errors } = checkResults([
    row({ state: 'ZZ' }),
    row({ medal: 'Platinum', beer_name: 'C' }),
    row({ medal: 'Silver', beer_name: 'D', entries: '36' }),
    row({ medal: 'Silver', beer_name: 'D', entries: '36' }),
  ]);
  const text = errors.join('\n');
  assert.match(text, /unknown state "ZZ"/);
  assert.match(text, /unknown medal "Platinum"/);
  assert.match(text, /duplicate medal row \(2x\)/);
  assert.match(text, /conflicting entry counts/);
});

test('checkYearSummary reports a count that differs from the loaded rows', () => {
  const rows = [row(), row({ medal: 'Silver' })];
  assert.deepEqual(checkYearSummary(rows, [{ year: '2025', medals: '2' }]), []);
  assert.equal(checkYearSummary(rows, [{ year: '2025', medals: '3' }]).length, 1);
});

test('checkEnrichment counts unmatched breweries and flags a state disagreement', () => {
  const enriched = { breweries: {
    a: { name: 'Example Brewing Co.', best: { state: 'Texas' } },
    b: { name: 'Nowhere Brewing', best: null },
  } };
  const result = checkEnrichment([row()], enriched);
  assert.equal(result.matched, 1);
  assert.equal(result.unmatched, 1);
  assert.equal(result.stateMismatches, 1);
});

test('the committed results pass the structural checks with no errors', () => {
  assert.deepEqual(checkResults(loadResults()).errors, []);
});
