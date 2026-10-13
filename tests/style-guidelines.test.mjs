import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseStyleGuidelines } from '../scripts/lib/style-guidelines-lib.mjs';
import { mergeStyles } from '../scripts/import-style-guidelines.mjs';

const text = readFileSync(new URL('./fixtures/style-guidelines-sample.txt', import.meta.url), 'utf8');

test('parseStyleGuidelines reads name, ABV, IBU, SRM, and color', () => {
  const styles = parseStyleGuidelines(text);
  assert.equal(styles.length, 2);
  const pils = styles[0];
  assert.equal(pils.category_name, 'Italian-Style Pilsener');
  assert.equal(pils.abv_min, 4.8);
  assert.equal(pils.abv_max, 5.8);
  assert.equal(pils.ibu_min, 25);
  assert.equal(pils.ibu_max, 40);
  assert.equal(pils.srm_min, 2);
  assert.equal(pils.srm_max, 5);
  assert.match(pils.description, /Straw to pale/);
  assert.equal(styles[1].category_name, 'Baltic-Style Porter');
  assert.equal(styles[1].abv_max, 9.3);
});

test('mergeStyles updates ranges on existing rows and appends new ones', () => {
  const existing = [{ category_name: 'Italian-Style Pilsener', style_family: 'Pilsner', abv_min: '1', abv_max: '2', ibu_min: '', ibu_max: '', srm_min: '', srm_max: '', description: 'kept', guideline_source: 'old', confidence: 'approximate' }];
  const { rows, updated, added } = mergeStyles(existing, parseStyleGuidelines(text), 'BA 2026');
  assert.equal(updated, 1);
  assert.equal(added, 1);
  const pils = rows.find((r) => r.category_name === 'Italian-Style Pilsener');
  assert.equal(pils.abv_min, 4.8);
  assert.equal(pils.description, 'kept');
  assert.equal(pils.style_family, 'Pilsner');
  const porter = rows.find((r) => r.category_name === 'Baltic-Style Porter');
  assert.equal(porter.style_family, 'Stout and Porter');
});
