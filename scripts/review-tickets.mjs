#!/usr/bin/env node
// Tickets from design feedback. A ticket is a Markdown file under docs/feedback/<page-name>/, with
// its captured images in a folder beside it, tracked in git. Tickets are registered from the
// Feedback panel in the design control plane; this command reads and maintains them.
//
//   npm run tickets -- list [--all]
//   npm run tickets -- show WI-001
//   npm run tickets -- refine WI-001 [--note "..."] [--categories "Bug,Layout"] [--title "..."]
//   npm run tickets -- resolve WI-001 --commit <sha> --note "what was done"
//   npm run tickets -- decline WI-001 --note "why not"
//   npm run tickets -- migrate [--from path/to/design-feedback.jsonl]
//   npm run tickets -- export-github [WI-001 ...]
//   npm run tickets -- process [WI-001 ...] [--scan] [--dry-run]
//
// A refine keeps the ticket ACCEPTED and moves only its revised time. migrate copies the notes of
// the retired sealed store into the new layout once; running it again skips what it already wrote.
// migrate also moves tickets left in the retired local folder .docs/feedback/ to docs/feedback/,
// unchanged apart from the two new fields (images and issue).
// export-github only prints the gh commands that would open GitHub issues. It never runs them.
// process runs the feedback pipeline by hand: every queued ticket becomes an issue, a branch, a
// pull request, a merge and a handoff (see scripts/feedback-pipeline.mjs). Name tickets to queue
// them, or add --scan to queue every accepted ticket that has no issue yet. --dry-run prints the
// gh and git commands and runs none of them. GABF_FEEDBACK_PIPELINE=off turns off only the
// automatic run in the review server; this command still works.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, parseArgs } from './lib/paths.mjs';
import { engine } from './lib/agent-graph.mjs';
import { ACCEPTED, LOCAL_FEEDBACK_DIR, editTicket, feedbackDirOf, findTicket, listTickets, loadCategories, migrateLegacyStore, migrateRecords, setStatus } from './lib/review-store.mjs';
import { describeScreen, loadManifest } from './lib/review-screens.mjs';
import { componentsForSpot } from './lib/review-components.mjs';

const OLD_STORE = 'docs/design/design-feedback.jsonl';
const args = parseArgs(process.argv.slice(2));
const [command = 'list', ref] = args._;
const dir = feedbackDirOf(ROOT);
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);
const need = (cond, usage) => { if (!cond) { console.error(`usage: ${usage}`); process.exit(2); } };

async function sanitizer() {
  const fb = await engine('design-feedback.mjs');
  return fb.sanitize;
}

// The old store's text: the file when it is still there, else the last version git has of it.
function oldStoreText() {
  const from = args.from ? resolve(args.from) : resolve(ROOT, OLD_STORE);
  if (existsSync(from)) return readFileSync(from, 'utf8');
  if (args.from) throw new Error(`${args.from} does not exist`);
  const removed = execFileSync('git', ['log', '-n1', '--format=%H', '--diff-filter=D', '--', OLD_STORE], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!removed) throw new Error(`${OLD_STORE} is not on disk and git has no record of it`);
  return execFileSync('git', ['show', `${removed}^:${OLD_STORE}`], { cwd: ROOT, encoding: 'utf8' });
}

if (command === 'list') {
  const tickets = listTickets(dir).filter((t) => args.all || t.data.status === ACCEPTED);
  if (!tickets.length) console.log(args.all ? 'No tickets.' : 'No accepted tickets.');
  for (const t of tickets) {
    const d = t.data;
    console.log(`${t.id}  ${String(d.status).padEnd(8)} ${d.page}  ${d.step ?? ''}  ${(d.categories ?? []).join(', ')}`);
    console.log(`    ${d.title}`);
    const bits = [];
    if ((d.spots ?? []).length) bits.push(`${d.spots.length} spot${d.spots.length === 1 ? '' : 's'}`);
    if ((d['content-keys'] ?? []).length) bits.push(`content ${d['content-keys'].join(', ')}`);
    if (bits.length) console.log(`    ${bits.join('; ')}`);
    for (const c of d.components ?? []) console.log(`    component ${c.name}: ${c.spec ?? 'no design system file yet'}`);
  }
} else if (command === 'show') {
  need(ref, 'tickets show WI-001');
  const t = findTicket(dir, ref);
  if (!t) { console.error(`no ticket ${ref}`); process.exit(1); }
  console.log(readFileSync(t.file, 'utf8'));
} else if (command === 'refine') {
  need(ref, 'tickets refine WI-001 [--note "..."] [--categories "A,B"] [--title "..."]');
  const patch = {};
  if (typeof args.note === 'string') patch.text = args.note;
  if (typeof args.title === 'string') patch.title = args.title;
  if (typeof args.categories === 'string') patch.categories = list(args.categories);
  const done = editTicket(dir, ref, patch, { sanitize: await sanitizer(), categories: loadCategories(ROOT) });
  console.log(`${done.id} stays ${done.status}; revised. ${done.file}`);
} else if (command === 'resolve') {
  need(ref && args.commit, 'tickets resolve WI-001 --commit <sha> --note "what was done"');
  const done = setStatus(dir, ref, 'DONE', { note: args.note ?? '', change: args.commit, sanitize: await sanitizer() });
  console.log(`${done.id} is DONE in ${args.commit}.`);
} else if (command === 'decline') {
  need(ref && args.note, 'tickets decline WI-001 --note "why it will not be done"');
  const done = setStatus(dir, ref, 'DECLINED', { note: args.note, sanitize: await sanitizer() });
  console.log(`${done.id} is DECLINED.`);
} else if (command === 'process') {
  const { buildContext, processQueue } = await import('./feedback-pipeline.mjs');
  const { enqueue, scanStore } = await import('./lib/feedback-queue.mjs');
  const ctx = buildContext({ dry: Boolean(args['dry-run']) });
  if (ctx.dry) ctx.sanitize = (text) => ({ text, redacted: [] }); else ctx.sanitize = await sanitizer();
  for (const id of args._.slice(1)) { if (!findTicket(ctx.storeDir, id)) { console.error(`no ticket ${id}`); process.exit(1); } enqueue(ctx.queueDir, id); }
  if (args.scan) for (const id of scanStore(ctx.storeDir, ctx.queueDir)) console.log(`queued ${id}`);
  const results = await processQueue(ctx);
  if (!results.length) console.log('Nothing is queued.');
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
} else if (command === 'migrate') {
  const moved = migrateLegacyStore(resolve(ROOT, LOCAL_FEEDBACK_DIR), dir);
  if (moved.length) console.log(moved.map((m) => `${m.from} -> ${m.to}`).join('\n'));
  let text = '';
  try { text = oldStoreText(); } catch (error) { if (args.from) throw error; }
  const records = text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const manifest = loadManifest(ROOT);
  const written = migrateRecords(dir, records, {
    sanitize: await sanitizer(),
    categories: loadCategories(ROOT),
    describe: (screen) => describeScreen(ROOT, manifest, screen),
    components: (note) => componentsForSpot(ROOT, { matches: (note.code ?? []).map((c) => ({ via: c.via })) }),
  });
  if (written.length) console.log(written.map((w) => `${w.id} -> ${w.file}`).join('\n'));
  else if (!moved.length) console.log('Nothing to migrate: every note is already in the new layout.');
} else if (command === 'export-github') {
  const wanted = new Set(args._.slice(1).map((s) => s.toUpperCase()));
  const tickets = listTickets(dir).filter((t) => (wanted.size ? wanted.has(t.id) : t.data.status === ACCEPTED));
  console.log('# Not run. These commands would open one GitHub issue per ticket; run them yourself only if you want issues.');
  for (const t of tickets) {
    const cats = t.data.categories ?? [];
    console.log(`gh issue create --title ${JSON.stringify(`${t.id}: ${t.data.title}`)} --body-file ${JSON.stringify(t.file)}${cats.length ? ` --label ${JSON.stringify(cats.join(','))}` : ''}`);
  }
} else {
  console.error(`unknown command ${command}; expected list, show, refine, resolve, decline, migrate, export-github, or process`);
  process.exit(2);
}
