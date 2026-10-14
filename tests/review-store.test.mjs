// The sealed feedback store and the tickets generated from it, exercised with a stand in for the
// engine's chain so the test runs without the agent-graph checkout.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkMarkdown } from '../scripts/check-prose.mjs';
import { addNote, deriveTickets, refine, renderTicketFiles, sanitizeDeep, sealIssues, setStatus, split, ticketId } from '../scripts/lib/review-store.mjs';

// A minimal engine with the same surface the store uses: read, append with a chain, next id, sanitize.
function fakeEngine() {
  const FILE = 'docs/design/design-feedback.jsonl';
  const read = (root) => (existsSync(resolve(root, FILE)) ? readFileSync(resolve(root, FILE), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return {
    readFeedback: read,
    nextId: (records) => `fb-${String(records.filter((r) => r.kind === 'note').length + 1).padStart(3, '0')}`,
    sanitize: (text) => (text.includes('SECRETVALUE') ? { text: text.replace(/SECRETVALUE/g, '[REDACTED:test_shape]'), redacted: ['test_shape'] } : { text, redacted: [] }),
    append: (record, root) => {
      const existing = read(root);
      const prev = existing.length ? existing[existing.length - 1].hash : 'genesis';
      const full = { ...record, prev, hash: `h${existing.length + 1}` };
      appendFileSync(resolve(root, FILE), `${JSON.stringify(full)}\n`);
      return full;
    },
  };
}
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'gabf-store-'));
  mkdirSync(resolve(dir, 'docs/design'), { recursive: true });
  writeFileSync(resolve(dir, 'docs/design/feedback-categories.json'), JSON.stringify({ categories: ['Bug', 'Layout', 'Data'] }));
  return dir;
}
const element = { mode: 'element', text: 'The chip runs into the header.', categories: ['Layout', 'Nope'], page: { route: '/breweries/x/', hash: '#year=2026' }, target: { selector: '#main > h1', text: 'X Brewing', box: { document: { x: 1, y: 2, width: 3, height: 4 } }, point: { document: { x: 2, y: 3 } } }, code: [{ location: 'scripts/build-site.mjs:393 breweryPage', via: 'data-src' }] };

test('a note is sealed over every field and keeps only known categories', () => {
  const fb = fakeEngine();
  const dir = scratch();
  const n = addNote(fb, dir, element);
  assert.equal(n.id, 'fb-001');
  assert.equal(n.ticket, 'WI-001');
  assert.deepEqual(n.categories, ['Layout']);
  assert.deepEqual(n.categories_unknown, ['Nope']);
  assert.deepEqual(sealIssues(fb.readFeedback(dir)), []);
});

test('changing any field after it was written breaks the seal', () => {
  const fb = fakeEngine();
  const dir = scratch();
  addNote(fb, dir, element);
  const file = resolve(dir, 'docs/design/design-feedback.jsonl');
  const record = JSON.parse(readFileSync(file, 'utf8'));
  record.target.selector = '#somewhere-else';
  writeFileSync(file, `${JSON.stringify(record)}\n`);
  assert.match(sealIssues(fb.readFeedback(dir))[0], /seal does not match/);
});

test('every string in a note is scanned, not only the note text', () => {
  const fb = fakeEngine();
  const dir = scratch();
  const n = addNote(fb, dir, { ...element, target: { ...element.target, text: 'key SECRETVALUE here' } });
  assert.ok(!JSON.stringify(n).includes('SECRETVALUE'));
  assert.deepEqual(n.redacted, ['test_shape']);
  assert.deepEqual(sanitizeDeep({ a: ['SECRETVALUE'] }, fb.sanitize).value, { a: ['[REDACTED:test_shape]'] });
});

test('refinements, status, splits, and resolutions append and drive the ticket', () => {
  const fb = fakeEngine();
  const dir = scratch();
  addNote(fb, dir, element);
  refine(fb, dir, 'fb-001', { note: 'Only at phone width.', categories: ['Layout', 'Bug'], title: 'Chip overlaps header on phones' });
  setStatus(fb, dir, 'fb-001', 'in-progress');
  const child = split(fb, dir, 'fb-001', { text: 'The year chip label is unclear.', categories: ['Data'] });
  assert.equal(child.split_from, 'fb-001');
  setStatus(fb, dir, 'fb-001', 'done', { change: 'abc1234', note: 'Wrapped the chip row.' });
  const [t1, t2] = deriveTickets(fb.readFeedback(dir));
  assert.equal(t1.status, 'done');
  assert.equal(t1.change, 'abc1234');
  assert.equal(t1.title, 'Chip overlaps header on phones');
  assert.deepEqual(t1.categories, ['Layout', 'Bug']);
  assert.equal(t2.id, ticketId(child.id));
  assert.equal(t2.status, 'open');
  assert.throws(() => refine(fb, dir, 'fb-001', { categories: ['Unknown'] }), /unknown categories/);
  assert.deepEqual(sealIssues(fb.readFeedback(dir)), []);
});

test('generated tickets pass the repository prose check even when the reviewer used a dash', () => {
  const fb = fakeEngine();
  const dir = scratch();
  const dash = String.fromCharCode(0x2014);
  addNote(fb, dir, { ...element, text: `The header ${dash} on phones ${dash} is too tall. Fix it -- please.` });
  for (const [name, body] of renderTicketFiles(fb.readFeedback(dir))) {
    assert.deepEqual(checkMarkdown(body, { fileName: name }), [], `${name} fails the prose check`);
  }
});
