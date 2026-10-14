import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareBands, compareLabels, compareYearsNewestFirst, sortByLabel, sortText } from '../site/assets/sort-order.mjs';

test('entries that start with a number come before entries that start with a letter', () => {
  assert.deepEqual(sortByLabel(['Amber', '7 Barrel', 'Zwickel', '12 Mile']), ['7 Barrel', '12 Mile', 'Amber', 'Zwickel']);
});

test('numbers sort naturally, so 2 comes before 10 and 100', () => {
  assert.deepEqual(sortByLabel(['100 Club', '10 Hops', '2 Row', '1,000 Barrels']), ['2 Row', '10 Hops', '100 Club', '1,000 Barrels']);
  assert.ok(compareLabels('2', '10') < 0);
  assert.ok(compareLabels('4 to 5%', '10 to 11%') < 0);
});

test('letters sort alphabetically and ignore case', () => {
  assert.deepEqual(sortByLabel(['banana', 'Apple', 'cherry', 'Banana split']), ['Apple', 'banana', 'Banana split', 'cherry']);
  assert.equal(compareLabels('apple', 'APPLE') < 0 || compareLabels('apple', 'APPLE') > 0, true, 'a stable tie break keeps equal text deterministic');
  assert.equal(compareLabels('Apple', 'Apple'), 0);
});

test('a leading The is ignored, in any case', () => {
  assert.equal(sortText('The Alchemist'), 'Alchemist');
  assert.equal(sortText('the bruery'), 'bruery');
  assert.deepEqual(sortByLabel(['Boulevard', 'The Alchemist', 'Avery', 'THE Bruery']), ['The Alchemist', 'Avery', 'Boulevard', 'THE Bruery']);
});

test('The only counts as a leading article, and a bare The stays', () => {
  assert.equal(sortText('Theory Brewing'), 'Theory Brewing');
  assert.equal(sortText('Brewery of The Year'), 'Brewery of The Year');
  assert.equal(sortText('The'), 'The');
});

test('a number after The still sorts with the numbers', () => {
  assert.deepEqual(sortByLabel(['Apple', 'The 3 Brothers', '10 Barrel', '2 Row']), ['2 Row', 'The 3 Brothers', '10 Barrel', 'Apple']);
});

test('sortByLabel returns a copy and reads a label from objects', () => {
  const input = [{ name: 'b' }, { name: '1' }];
  const out = sortByLabel(input, (x) => x.name);
  assert.deepEqual(out.map((x) => x.name), ['1', 'b']);
  assert.deepEqual(input.map((x) => x.name), ['b', '1']);
});

test('a year control may run newest first', () => {
  assert.deepEqual(['2018', '2026', '2024'].sort(compareYearsNewestFirst), ['2026', '2024', '2018']);
});

test('ordered bins run by their numeric range, lowest first, not by name', () => {
  const ids = ['10-plus', '5-to-6', 'under-4', '8-to-10', '4-to-5', '6-to-7', '7-to-8'];
  assert.deepEqual([...ids].sort(compareBands), ['under-4', '4-to-5', '5-to-6', '6-to-7', '7-to-8', '8-to-10', '10-plus']);
});
