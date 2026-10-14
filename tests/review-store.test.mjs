// The per page Markdown ticket store: the multi spot model, the ACCEPTED status, alphabetized
// categories, the secret scan on every string, and the migration of the retired sealed store.
// Every test writes to a temporary directory; nothing touches .docs/.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ACCEPTED, addTicket, alphabetized, cleanCategories, editTicket, findTicket, listTickets, migrateRecords, nextId, parseTicket, sanitizeDeep, setStatus, ticketIssues } from '../scripts/lib/review-store.mjs';
import { kebab } from '../scripts/lib/review-screens.mjs';

const sanitize = (text) => (text.includes('SECRETVALUE') ? { text: text.replace(/SECRETVALUE/g, '[REDACTED:test_shape]'), redacted: ['test_shape'] } : { text, redacted: [] });
const store = () => mkdtempSync(join(tmpdir(), 'gabf-tickets-'));
const categories = ['Layout', 'Bug', 'content', 'Accessibility', 'Data'];

const input = (extra = {}) => ({
  text: 'The chart legend is hard to read. Make it larger.',
  categories: ['Layout', 'Nope'],
  page: 'overview-dashboard',
  job: 'JOB-1',
  jobTitle: 'Benchmark a brewery against the field',
  step: 'S-01',
  state: 'overview-default',
  statePath: 'happy',
  route: '/',
  hash: '',
  served: 'site',
  spots: [
    { n: 1, selector: '#medals-by-year', rect: { x: 10.4, y: 20.6, width: 300, height: 200 }, text: 'Medals by year' },
    { n: 2, selector: '#stats > div:nth-of-type(2)', rect: { x: 1, y: 2, width: 3, height: 4 }, text: 'Breweries 947' },
  ],
  components: [{ name: 'chart-frame', spec: '.design/design-system/components/chart-frame/spec.md', instance: '#medals-by-year' }, 'form-field'],
  contentKeys: ['pages.home.title', 'pages.home.title'],
  device: 'desktop',
  viewport: { width: 1440, height: 900 },
  build: { commit: '0123456789abcdef' },
  ...extra,
});

test('a ticket is one Markdown file under the page name with every required key', () => {
  const dir = store();
  const t = addTicket(dir, input(), { sanitize, categories, now: new Date('2026-10-14T20:00:00Z') });
  assert.equal(t.id, 'WI-001');
  assert.equal(t.status, ACCEPTED);
  assert.equal(t.file, resolve(dir, 'overview-dashboard', 'wi-001-the-chart-legend-is-hard-to-read.md'));
  const { data, body } = parseTicket(readFileSync(t.file, 'utf8'));
  assert.equal(data.id, 'WI-001');
  assert.equal(data.status, 'ACCEPTED');
  assert.equal(data.job, 'JOB-1');
  assert.equal(data.step, 'S-01');
  assert.equal(data.state, 'overview-default');
  assert.equal(data.route, '/');
  assert.equal(data.created, '2026-10-14T20:00:00.000Z');
  assert.equal(data.revised, data.created);
  assert.deepEqual(data['content-keys'], ['pages.home.title']);
  assert.match(body, /^The chart legend is hard to read\. Make it larger\./);
  assert.deepEqual(ticketIssues(dir), []);
});

test('one ticket carries several spots, each with selector, rect, and element text', () => {
  const dir = store();
  const t = addTicket(dir, input(), { sanitize, categories });
  const { data } = parseTicket(readFileSync(t.file, 'utf8'));
  assert.equal(data.spots.length, 2);
  assert.deepEqual(data.spots[0], { n: 1, selector: '#medals-by-year', rect: { x: 10, y: 21, width: 300, height: 200 }, text: 'Medals by year' });
  assert.equal(data.spots[1].selector, '#stats > div:nth-of-type(2)');
  assert.equal(data.spots[1].text, 'Breweries 947');
});

test('a ticket with no spots is whole page feedback', () => {
  const dir = store();
  const t = addTicket(dir, input({ spots: [] }), { sanitize, categories });
  assert.deepEqual(parseTicket(readFileSync(t.file, 'utf8')).data.spots, []);
});

test('components keep their name, their spec path when there is one, and their instance', () => {
  const dir = store();
  const t = addTicket(dir, input(), { sanitize, categories });
  const { data } = parseTicket(readFileSync(t.file, 'utf8'));
  assert.deepEqual(data.components, [
    { name: 'chart-frame', spec: '.design/design-system/components/chart-frame/spec.md', instance: '#medals-by-year' },
    { name: 'form-field', spec: null },
  ]);
});

test('categories are alphabetized, known only, and stored in that order', () => {
  assert.deepEqual(alphabetized(['Layout', 'bug', 'Data', 'Accessibility', 'Action']), ['Accessibility', 'Action', 'bug', 'Data', 'Layout']);
  const picked = cleanCategories(['Layout', 'Data', 'Bug', 'Nope'], categories);
  assert.deepEqual(picked.categories, ['Bug', 'Data', 'Layout']);
  assert.deepEqual(picked.unknown, ['Nope']);
  const dir = store();
  const t = addTicket(dir, input({ categories: ['Layout', 'Data', 'Bug'] }), { sanitize, categories });
  assert.deepEqual(parseTicket(readFileSync(t.file, 'utf8')).data.categories, ['Bug', 'Data', 'Layout']);
});

test('the real category list is stored alphabetized at load', async () => {
  const { loadCategories } = await import('../scripts/lib/review-store.mjs');
  const list = loadCategories(resolve(import.meta.dirname, '..'));
  assert.deepEqual(list, alphabetized(list));
  assert.ok(list.length > 10);
});

test('ids count up across every page and never repeat', () => {
  const dir = store();
  addTicket(dir, input(), { sanitize, categories });
  const second = addTicket(dir, input({ page: 'brewery-detail', step: 'S-27' }), { sanitize, categories });
  assert.equal(second.id, 'WI-002');
  assert.equal(nextId(dir), 'WI-003');
  assert.deepEqual(listTickets(dir).map((t) => t.page), ['overview-dashboard', 'brewery-detail']);
});

test('an edit keeps the ticket ACCEPTED and moves only revised', () => {
  const dir = store();
  const t = addTicket(dir, input(), { sanitize, categories, now: new Date('2026-10-14T20:00:00Z') });
  const edited = editTicket(dir, 'WI-001', { text: 'A new note about the legend.', categories: ['Data', 'Bug'] }, { sanitize, categories, now: new Date('2026-10-15T09:30:00Z') });
  assert.equal(edited.status, 'ACCEPTED');
  const { data, body } = parseTicket(readFileSync(t.file, 'utf8'));
  assert.equal(data.status, 'ACCEPTED');
  assert.equal(data.created, '2026-10-14T20:00:00.000Z');
  assert.equal(data.revised, '2026-10-15T09:30:00.000Z');
  assert.deepEqual(data.categories, ['Bug', 'Data']);
  assert.match(body, /^A new note about the legend\./);
  assert.equal(data.spots.length, 2);
  assert.throws(() => editTicket(dir, 'WI-001', { categories: ['Nope'] }, { sanitize, categories }), /unknown categories/);
  assert.throws(() => editTicket(dir, 'WI-009', { text: 'x' }, { sanitize, categories }), /no ticket/);
});

test('a lifecycle change is explicit and an edit after it does not reset it', () => {
  const dir = store();
  addTicket(dir, input(), { sanitize, categories });
  setStatus(dir, 'WI-001', 'DONE', { change: 'abc1234', note: 'Larger legend.', sanitize });
  assert.equal(findTicket(dir, 'WI-001').data.status, 'DONE');
  assert.equal(findTicket(dir, 'WI-001').data.resolution.change, 'abc1234');
  editTicket(dir, 'WI-001', { title: 'Legend size' }, { sanitize, categories });
  assert.equal(findTicket(dir, 'WI-001').data.status, 'DONE');
  assert.throws(() => setStatus(dir, 'WI-001', 'OPEN', { sanitize }), /status must be one of/);
});

test('every string is scanned for secret shaped values, the note, spot text, and keys alike', () => {
  const dir = store();
  const t = addTicket(dir, input({ text: 'Token SECRETVALUE in the note.', spots: [{ n: 1, selector: '#a', rect: {}, text: 'key SECRETVALUE here' }] }), { sanitize, categories });
  const raw = readFileSync(t.file, 'utf8');
  assert.ok(!raw.includes('SECRETVALUE'));
  assert.deepEqual(parseTicket(raw).data.redacted, ['test_shape']);
  assert.deepEqual(t.redacted, ['test_shape']);
  assert.deepEqual(sanitizeDeep({ a: ['SECRETVALUE'] }, sanitize).value, { a: ['[REDACTED:test_shape]'] });
});

test('a ticket needs a note or a copy edit, and a page', () => {
  const dir = store();
  assert.throws(() => addTicket(dir, input({ text: '  ' }), { sanitize, categories }), /needs a note/);
  assert.throws(() => addTicket(dir, input({ page: null }), { sanitize, categories }), /needs a page/);
});

test('page names are plain lowercase kebab case', () => {
  assert.equal(kebab('Overview dashboard'), 'overview-dashboard');
  assert.equal(kebab('Ownership and economics dashboard'), 'ownership-and-economics-dashboard');
  assert.equal(kebab('2026 winners index'), '2026-winners-index');
  assert.equal(kebab('Results & reports'), 'results-and-reports');
});

test('an absent store has no tickets and no problems, as in CI', () => {
  const dir = join(store(), 'not-there');
  assert.deepEqual(listTickets(dir), []);
  assert.deepEqual(ticketIssues(dir), []);
});

test('the ticket check names a misfiled ticket, a bad status, and a repeated id', () => {
  const dir = store();
  addTicket(dir, input(), { sanitize, categories });
  mkdirSync(resolve(dir, 'brewery-detail'));
  const text = readFileSync(findTicket(dir, 'WI-001').file, 'utf8').replace('status: ACCEPTED', 'status: PENDING');
  writeFileSync(resolve(dir, 'brewery-detail', 'wi-001-copy.md'), text);
  const issues = ticketIssues(dir);
  assert.ok(issues.some((i) => /status PENDING/.test(i)));
  assert.ok(issues.some((i) => /filed under brewery-detail/.test(i)));
  assert.ok(issues.some((i) => /used by/.test(i)));
});

// ---------- the retired store ----------

const records = [
  { kind: 'note', id: 'fb-001', at: '2026-10-14T18:22:10.691Z', screen: 'S-29', surface: 'brewery-detail', text: 'Whole page note.', ticket: 'WI-001', mode: 'page', categories: ['Other'], page: { route: '/breweries/x/', hash: '#year=2026', served: 'site' }, device: 'desktop', viewport: { width: 1440, height: 772 }, build: { commit: '63dafc4bee8f00' }, target: null, code: [] },
  { kind: 'note', id: 'fb-002', at: '2026-10-14T18:22:15.378Z', screen: 'S-27', surface: 'brewery-detail', text: 'Pinned note.', ticket: 'WI-002', mode: 'element', categories: ['Heading'], page: { route: '/breweries/x/', hash: '', served: 'site' }, target: { selector: '#main > h1', text: 'X Brewing', box: { document: { x: 1, y: 2, width: 3, height: 4 } } }, code: [{ location: 'x', via: '.site-header' }] },
  { kind: 'refinement', at: '2026-10-14T18:22:23.903Z', refines: 'fb-002', note: 'Marked as a setup test.', categories: ['Heading', 'Typography'] },
  { kind: 'resolution', at: '2026-10-14T18:22:38.371Z', resolves: 'fb-002', status: 'done', change: '113f8ad', note: 'Setup test complete.' },
];
const describe = (screen) => ({ step: screen, job: 'JOB-1', jobTitle: 'Benchmark', state: `state-${screen}`, statePath: 'happy', page: 'brewery-detail', route: '/breweries/x/', hash: '', served: 'site' });

test('the old sealed store migrates once into the new layout, each note ACCEPTED, ids kept', () => {
  const dir = store();
  const first = migrateRecords(dir, records, { sanitize, describe, categories: ['Other', 'Heading', 'Typography'], components: () => [{ name: 'form-header', spec: null }] });
  assert.deepEqual(first.map((w) => w.id), ['WI-001', 'WI-002']);
  const t2 = findTicket(dir, 'WI-002');
  assert.equal(t2.data.status, 'ACCEPTED');
  assert.equal(t2.data['legacy-id'], 'fb-002');
  assert.equal(t2.data.step, 'S-27');
  assert.deepEqual(t2.data.categories, ['Heading', 'Typography']);
  assert.deepEqual(t2.data.spots, [{ n: 1, selector: '#main > h1', rect: { x: 1, y: 2, width: 3, height: 4 }, text: 'X Brewing' }]);
  assert.deepEqual(t2.data.components, [{ name: 'form-header', spec: null }]);
  assert.equal(t2.data.revised, '2026-10-14T18:22:38.371Z');
  assert.match(t2.body, /done in 113f8ad/);
  assert.deepEqual(findTicket(dir, 'WI-001').data.spots, []);
  assert.equal(migrateRecords(dir, records, { sanitize, describe, categories: ['Other'] }).length, 0);
  assert.equal(listTickets(dir).length, 2);
  assert.ok(existsSync(t2.file));
});
