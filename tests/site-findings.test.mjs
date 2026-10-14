import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINDINGS, findings, findingsForReport } from '../web/lib/models/findings.mjs';

// The written findings of the analysis pages: every token is computed from the data, and none is left unfilled.
test('every finding renders with its figures and no placeholder left', () => {
  const all = findings();
  assert.equal(all.length, FINDINGS.length);
  for (const f of all) {
    assert.ok(f.title && f.blocks.length, f.name);
    for (const b of f.blocks) {
      if (b.type === 'text') assert.doesNotMatch(b.text, /\{\{|undefined|null|NaN/, `${f.name}: ${b.text}`);
      if (b.type === 'gap') assert.ok(b.missing.length > 0);
    }
  }
});

test('the figures are consistent with the dataset', () => {
  const [concentration, firstTime] = findings(['concentration-of-medals', 'first-time-medalists']);
  assert.match(concentration.blocks[0].text, /^From \d{4} to \d{4}, [\d,]+ breweries won [\d,]+ medals\. The top tenth/);
  assert.match(firstTime.blocks[0].text, /^\d+ breweries won their first medal in the record in \d{4}\./);
});

test('reports show the findings that name them', () => {
  assert.deepEqual(findingsForReport('top-breweries').map((f) => f.name), ['concentration-of-medals']);
  assert.deepEqual(findingsForReport('by-region'), []);
});
