import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUSES, loadFoundations, loadSpecs, statusProblem } from '../scripts/design-system/lib.mjs';

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
