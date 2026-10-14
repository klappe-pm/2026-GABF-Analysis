// The pipeline queue keeps its order and survives a restart, a ticket id is queued once, and the
// watcher queues a ticket written by someone else only after the file has settled.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { appendLog, enqueue, jobFor, logFile, nextJob, readQueue, retryJob, scanStore, ticketReady, updateJob, watchStore } from '../scripts/lib/feedback-queue.mjs';
import { pipelineStatus } from '../scripts/review-server.mjs';

const scratch = () => mkdtempSync(join(tmpdir(), 'gabf-queue-'));
const ticketText = (id, extra = '') => `---\nid: ${id}\nstatus: ACCEPTED\npage: design-system\ncreated: '2026-10-14T10:00:00.000Z'\n${extra}---\n\nA note.\n`;

test('jobs run in the order they were queued and the queue survives a restart', () => {
  const dir = scratch();
  enqueue(dir, 'WI-003');
  enqueue(dir, 'WI-001');
  enqueue(dir, 'WI-002');
  assert.deepEqual(readQueue(dir).jobs.map((j) => j.id), ['WI-003', 'WI-001', 'WI-002']);
  assert.equal(nextJob(dir).id, 'WI-003');
  updateJob(dir, 'WI-003', { state: 'merged' });
  assert.equal(nextJob(dir).id, 'WI-001', 'a finished job is skipped');
  // A fresh read, as after a restart, sees the same file.
  assert.equal(JSON.parse(readFileSync(resolve(dir, 'queue.json'), 'utf8')).jobs[0].state, 'merged');
  assert.equal(jobFor(dir, 'wi-002').state, 'queued');
});

test('a ticket id is queued once, whatever state the job is in', () => {
  const dir = scratch();
  assert.equal(enqueue(dir, 'WI-001').added, true);
  assert.equal(enqueue(dir, 'wi-001').added, false);
  updateJob(dir, 'WI-001', { state: 'needs attention', error: 'x' });
  assert.equal(enqueue(dir, 'WI-001').added, false, 'a failed job is not requeued by itself');
  assert.equal(retryJob(dir, 'WI-001').state, 'queued');
  assert.equal(readQueue(dir).jobs.length, 1);
});

test('every step is a line in the log', () => {
  const dir = scratch();
  enqueue(dir, 'WI-001');
  appendLog(dir, { id: 'WI-001', step: 'issue', status: 'ok', detail: '#4' });
  const lines = readFileSync(logFile(dir), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.step), ['queue', 'issue']);
  assert.ok(lines.every((l) => l.at && l.id === 'WI-001'));
});

test('only accepted tickets without an issue, and with finished capture, are ready', () => {
  const now = new Date('2026-10-14T10:01:00.000Z');
  assert.equal(ticketReady({ status: 'ACCEPTED' }, now), true);
  assert.equal(ticketReady({ status: 'ACCEPTED', issue: 4 }, now), false);
  assert.equal(ticketReady({ status: 'DONE' }, now), false);
  assert.equal(ticketReady({ status: 'ACCEPTED', capture: 'pending', created: '2026-10-14T10:00:30.000Z' }, now), false);
  assert.equal(ticketReady({ status: 'ACCEPTED', capture: 'pending', created: '2026-10-14T09:00:00.000Z' }, now), true, 'a stale pending capture does not hold a ticket forever');
  assert.equal(ticketReady({ status: 'ACCEPTED', capture: 'done' }, now), true);
});

// A fake file watcher and fake timers, so the test controls both events and time.
function harness() {
  const store = scratch();
  const queue = scratch();
  mkdirSync(join(store, 'design-system'), { recursive: true });
  let handler = null;
  const timers = [];
  const queued = [];
  const w = watchStore({
    storeDir: store, queueDir: queue, onQueued: (id) => queued.push(id),
    watch: (_dir, _opts, fn) => { handler = fn; return { close() {} }; },
    setTimer: (fn) => { timers.push(fn); return timers.length - 1; },
    clearTimer: (i) => { if (timers[i]) timers[i] = null; },
    now: () => new Date('2026-10-14T12:00:00.000Z'),
  });
  // One look at every armed timer; a timer armed during the look waits for the next one.
  const fire = () => { for (const fn of timers.splice(0)) if (fn) fn(); };
  return { store, queue, emit: (name) => handler('change', name), fire, queued, w };
}

test('the watcher queues a settled ticket file once, however many events it sees', () => {
  const h = harness();
  const file = join(h.store, 'design-system', 'wi-010-button.md');
  writeFileSync(file, ticketText('WI-010'));
  h.emit('design-system/wi-010-button.md');
  h.emit('design-system/wi-010-button.md');
  h.emit('design-system/wi-010-button.md');
  h.fire();
  assert.deepEqual(h.queued, ['WI-010']);
  h.emit('design-system/wi-010-button.md');
  h.fire();
  assert.deepEqual(h.queued, ['WI-010'], 'a second write of the same ticket creates no second job');
  assert.equal(readQueue(h.queue).jobs.length, 1);
  h.w.close();
});

test('a half written file is not picked up until it parses, and one still changing waits', () => {
  const h = harness();
  const file = join(h.store, 'design-system', 'wi-011-half.md');
  writeFileSync(file, '---\nid: WI-011\nstatus: ACC');
  h.emit('design-system/wi-011-half.md');
  h.fire();
  assert.deepEqual(h.queued, [], 'the cut off file has no readable ticket yet');
  writeFileSync(file, ticketText('WI-011'));
  h.fire();
  assert.deepEqual(h.queued, [], 'the file changed since the last look, so it settles first');
  h.fire();
  assert.deepEqual(h.queued, ['WI-011'], 'once the file is whole, the next look queues it');
  // A file that changes between the event and the look is looked at again, not read.
  const busy = join(h.store, 'design-system', 'wi-012-busy.md');
  writeFileSync(busy, ticketText('WI-012'));
  h.emit('design-system/wi-012-busy.md');
  utimesSync(busy, new Date(), new Date(Date.now() + 5000));
  h.fire();
  assert.deepEqual(h.queued, ['WI-011'], 'still changing, so not queued on this look');
  h.fire();
  assert.deepEqual(h.queued, ['WI-011', 'WI-012']);
});

test('the watcher ignores a ticket that already has an issue, a done ticket, a pending capture, and other files', () => {
  const h = harness();
  const put = (name, text) => { writeFileSync(join(h.store, 'design-system', name), text); h.emit(`design-system/${name}`); };
  put('wi-020-has-issue.md', ticketText('WI-020', 'issue: 9\n'));
  put('wi-021-done.md', ticketText('WI-021').replace('ACCEPTED', 'DONE'));
  put('wi-022-capturing.md', ticketText('WI-022', "capture: pending\n").replace("'2026-10-14T10:00:00.000Z'", "'2026-10-14T11:59:00.000Z'"));
  put('notes.txt', 'not a ticket');
  h.emit('.queue/queue.json');
  h.emit('.work/x/a.md');
  h.fire();
  assert.deepEqual(h.queued, []);
  assert.deepEqual(readQueue(h.queue).jobs, []);
});

test('a manual scan queues every ready ticket once', () => {
  const store = scratch();
  const queue = scratch();
  mkdirSync(join(store, 'design-system'), { recursive: true });
  writeFileSync(join(store, 'design-system', 'wi-030-a.md'), ticketText('WI-030'));
  writeFileSync(join(store, 'design-system', 'wi-031-b.md'), ticketText('WI-031', 'issue: 3\n'));
  assert.deepEqual(scanStore(store, queue), ['WI-030']);
  assert.deepEqual(scanStore(store, queue), []);
});

test('the panel status reads the job first, then the ticket', () => {
  assert.equal(pipelineStatus({ state: 'queued' }, {}).label, 'Queued');
  assert.equal(pipelineStatus({ state: 'issue', issue: 4 }, {}).label, 'Issue #4');
  assert.equal(pipelineStatus({ state: 'in progress', issue: 4 }, {}).label, 'In progress');
  assert.equal(pipelineStatus({ state: 'pr', issue: 4, pr: 5 }, {}).label, 'PR #5');
  assert.equal(pipelineStatus({ state: 'pr', issue: 4, pr: 5 }, {}).prUrl, 'https://github.com/klappe-pm/GABF-Analysis/pull/5');
  assert.equal(pipelineStatus({ state: 'merged', issue: 4, pr: 5 }, {}).label, 'Merged');
  assert.equal(pipelineStatus({ state: 'needs attention', error: 'verify failed' }, {}).error, 'verify failed');
  assert.equal(pipelineStatus(null, { status: 'DONE', pr: 5 }).label, 'Merged');
  assert.equal(pipelineStatus(null, {}), null);
});
