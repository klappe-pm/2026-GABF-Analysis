// The feedback pipeline's queue: one JSON file under .docs/feedback/.queue/ (local, never
// committed) that survives a restart, a per step log (log.jsonl), and the watcher that notices a
// ticket file written by someone other than the review server, such as the design system page's
// Save. A ticket id is queued at most once, so a ticket can never create two issues.

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, watch as fsWatch, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { ACCEPTED, listTickets, parseTicket } from './review-store.mjs';

export const STATES = ['queued', 'issue', 'in progress', 'pr', 'merged', 'needs attention'];
// A ticket whose images are still being captured is left alone this long before it counts as ready anyway.
export const CAPTURE_GRACE_MS = 5 * 60 * 1000;

export const queueDirOf = (root, env = process.env) => resolve(env.GABF_QUEUE_DIR || resolve(root, '.docs/feedback/.queue'));
const queueFile = (dir) => resolve(dir, 'queue.json');
export const logFile = (dir) => resolve(dir, 'log.jsonl');

export function readQueue(dir) {
  try { return JSON.parse(readFileSync(queueFile(dir), 'utf8')); } catch { return { jobs: [] }; }
}

function writeQueue(dir, queue) {
  mkdirSync(dir, { recursive: true });
  const tmp = `${queueFile(dir)}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(queue, null, 2)}\n`);
  renameSync(tmp, queueFile(dir));
}

export function appendLog(dir, entry, now = new Date()) {
  mkdirSync(dir, { recursive: true });
  appendFileSync(logFile(dir), `${JSON.stringify({ at: now.toISOString(), ...entry })}\n`);
}

// Queue a ticket id. A second call for the same id adds nothing, whatever state the first is in.
export function enqueue(dir, id, now = new Date()) {
  const queue = readQueue(dir);
  const key = String(id).toUpperCase();
  const hit = queue.jobs.find((j) => j.id === key);
  if (hit) return { added: false, job: hit };
  const job = { id: key, state: 'queued', enqueued: now.toISOString(), updated: now.toISOString() };
  queue.jobs.push(job);
  writeQueue(dir, queue);
  appendLog(dir, { id: key, step: 'queue', status: 'queued' }, now);
  return { added: true, job };
}

export function updateJob(dir, id, patch, now = new Date()) {
  const queue = readQueue(dir);
  const job = queue.jobs.find((j) => j.id === String(id).toUpperCase());
  if (!job) throw new Error(`no queued job for ${id}`);
  Object.assign(job, patch, { updated: now.toISOString() });
  writeQueue(dir, queue);
  return job;
}

// First queued job in the order it was queued.
export const nextJob = (dir) => readQueue(dir).jobs.find((j) => j.state === 'queued') ?? null;

// A needs attention job goes back to queued by hand, never by itself.
export function retryJob(dir, id) {
  const job = readQueue(dir).jobs.find((j) => j.id === String(id).toUpperCase());
  if (!job || job.state !== 'needs attention') return null;
  return updateJob(dir, id, { state: 'queued', error: null });
}

export const jobFor = (dir, id) => readQueue(dir).jobs.find((j) => j.id === String(id).toUpperCase()) ?? null;

// ---------- which tickets are ready ----------

export function ticketReady(data, now = new Date()) {
  if (!data || data.status !== ACCEPTED || data.issue) return false;
  if (data.capture === 'pending') return now - new Date(data.created ?? 0) > CAPTURE_GRACE_MS;
  return true;
}

// Queue every ready ticket that is not queued yet. Used by the manual run.
export function scanStore(storeDir, queueDir, now = new Date()) {
  const added = [];
  for (const t of listTickets(storeDir)) if (ticketReady(t.data, now) && enqueue(queueDir, t.id, now).added) added.push(t.id);
  return added;
}

// ---------- the watcher ----------

// Watch the ticket store for new or changed ticket files and queue the ready ones after the file
// has stopped changing, so a half written file is never read as a ticket. `watch` and the timer
// are injectable for tests.
export function watchStore({ storeDir, queueDir, onQueued = () => {}, debounceMs = 1500, watch = fsWatch, now = () => new Date(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  const timers = new Map();
  const tries = new Map();
  const consider = (file) => {
    let before;
    try { before = statSync(file).mtimeMs; } catch { return; }
    const arm = () => {
      clearTimer(timers.get(file));
      timers.set(file, setTimer(() => {
        timers.delete(file);
        let after;
        try { after = statSync(file).mtimeMs; } catch { return; }
        if (after !== before) { before = after; arm(); return; }
        let parsed = null;
        try { parsed = parseTicket(readFileSync(file, 'utf8')); } catch { parsed = null; }
        if (!parsed?.data?.id) {
          const n = (tries.get(file) ?? 0) + 1;
          tries.set(file, n);
          if (n < 5) arm();
          return;
        }
        tries.delete(file);
        if (!ticketReady(parsed.data, now())) return;
        const { added } = enqueue(queueDir, parsed.data.id, now());
        if (added) onQueued(parsed.data.id);
      }, debounceMs));
    };
    arm();
  };
  const watcher = watch(storeDir, { recursive: true }, (event, name) => {
    if (!name) return;
    const rel = String(name);
    if (!rel.endsWith('.md') || rel.split(sep).some((p) => p.startsWith('.'))) return;
    const file = resolve(storeDir, rel);
    if (rel.split(sep).length !== 2) return;
    consider(file);
  });
  return { close() { for (const t of timers.values()) clearTimer(t); timers.clear(); watcher.close?.(); } };
}

// ---------- one runner at a time ----------

export function takeLock(dir) {
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, 'runner.lock');
  if (existsSync(file)) {
    const pid = Number(readFileSync(file, 'utf8').trim());
    let alive = false;
    try { process.kill(pid, 0); alive = pid !== process.pid; } catch { alive = false; }
    if (alive) return null;
  }
  writeFileSync(file, String(process.pid));
  return () => { try { unlinkSync(file); } catch { /* already gone */ } };
}
