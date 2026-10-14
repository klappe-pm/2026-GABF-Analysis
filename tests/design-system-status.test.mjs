import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUSES, THEMES, loadFoundations, loadSpecs, loadTokens, statusProblem } from '../scripts/design-system/lib.mjs';

test('a spec status is one of draft, review, or approved', () => {
  assert.deepEqual(STATUSES, ['draft', 'review', 'approved']);
  for (const status of STATUSES) assert.equal(statusProblem({ status }), null, status);
  assert.match(statusProblem({}), /missing status/);
  for (const bad of ['Approved', 'done', '', null, 3]) assert.match(statusProblem({ status: bad }), /must be one of draft, review, approved/, String(bad));
});

test('every component and foundation spec carries a valid status, and typography is approved', () => {
  const specs = loadSpecs();
  const foundations = loadFoundations();
  assert.ok(specs.length > 0 && foundations.length > 0);
  for (const s of specs) assert.equal(statusProblem(s.data), null, s.spec);
  for (const f of foundations) assert.equal(statusProblem(f.data), null, f.spec);
  assert.equal(foundations.find((f) => f.name === 'typography').data.status, 'approved');
});

test('the system has one light theme and no spec mentions a dark theme', () => {
  assert.deepEqual(THEMES, ['light']);
  const tokens = loadTokens();
  assert.deepEqual(Object.keys(tokens.themes), ['light']);
  for (const s of loadSpecs()) assert.doesNotMatch(s.text, /dark (theme|mode|stock)|theme toggle|prefers-color-scheme/i, s.spec);
  for (const f of loadFoundations()) assert.doesNotMatch(f.sections ? JSON.stringify(f.sections) : '', /dark (theme|mode|stock)/i, f.spec);
});
