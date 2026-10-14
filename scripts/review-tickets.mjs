#!/usr/bin/env node
// Tickets from design feedback. Every command that changes a ticket appends a sealed record to
// docs/design/design-feedback.jsonl and regenerates docs/work-items/; nothing is edited in place.
//
//   npm run tickets -- list [--all]
//   npm run tickets -- show WI-001
//   npm run tickets -- status WI-001 in-progress [--note "..."] [--by "name"]
//   npm run tickets -- refine WI-001 [--note "..."] [--categories "Bug,Layout"] [--title "..."] [--by "name"] [--setup-test]
//   npm run tickets -- split WI-001 --text "..." [--categories "Data"]
//   npm run tickets -- resolve WI-001 --commit <sha> --note "what was done" [--by "name"]
//   npm run tickets -- decline WI-001 --note "why not" [--by "name"]
//   npm run tickets -- generate
//   npm run tickets -- export-github [WI-001 ...]
//
// export-github only prints the gh commands that would open GitHub issues. It never runs them:
// opening an issue is an external action the owner takes, not this script.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, parseArgs } from './lib/paths.mjs';
import { engine } from './lib/agent-graph.mjs';
import { deriveTickets, noteIdOf, refine, setStatus, split, TICKETS_DIR, writeTicketFiles } from './lib/review-store.mjs';

const args = parseArgs(process.argv.slice(2));
const [command = 'list', ref, value] = args._;
const fb = await engine('design-feedback.mjs');
const records = () => fb.readFeedback(ROOT);
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : null);
const need = (cond, usage) => { if (!cond) { console.error(`usage: ${usage}`); process.exit(2); } };
const after = (written) => { writeTicketFiles(ROOT, records()); console.log(`Recorded at line ${records().length}, hash ${written.hash}. Tickets regenerated in ${TICKETS_DIR}/.`); };

if (command === 'list') {
  const tickets = deriveTickets(records()).filter((t) => args.all || t.status === 'open' || t.status === 'in-progress');
  if (!tickets.length) console.log(args.all ? 'No tickets.' : 'No open tickets.');
  for (const t of tickets) {
    console.log(`${t.id}  ${t.status.padEnd(11)} ${t.note.page?.route ?? t.note.screen ?? ''}  ${t.categories.join(', ')}`);
    console.log(`    ${t.title}`);
    const code = (t.note.code ?? []).slice(0, 3).map((c) => c.location);
    if (code.length) console.log(`    code: ${code.join('; ')}`);
  }
} else if (command === 'show') {
  need(ref, 'tickets show WI-001');
  console.log(readFileSync(resolve(ROOT, TICKETS_DIR, `${ref.toUpperCase()}.md`), 'utf8'));
} else if (command === 'status') {
  need(ref && value, 'tickets status WI-001 <open|in-progress|done|declined> [--note "..."]');
  after(setStatus(fb, ROOT, noteIdOf(ref), value, { note: args.note ?? '', change: args.commit ?? null, by: args.by ?? null }));
} else if (command === 'refine') {
  need(ref, 'tickets refine WI-001 [--note "..."] [--categories "A,B"] [--title "..."]');
  after(refine(fb, ROOT, noteIdOf(ref), { note: args.note ?? '', categories: list(args.categories), title: args.title ?? null, by: args.by ?? null, setupTest: Boolean(args['setup-test']) }));
} else if (command === 'split') {
  need(ref && args.text, 'tickets split WI-001 --text "the part that becomes its own ticket" [--categories "A,B"]');
  const created = split(fb, ROOT, noteIdOf(ref), { text: args.text, categories: list(args.categories) ?? [] });
  writeTicketFiles(ROOT, records());
  console.log(`Split ${ref} into ${created.id} (${created.ticket}).`);
} else if (command === 'resolve') {
  need(ref && args.commit, 'tickets resolve WI-001 --commit <sha> --note "what was done"');
  after(setStatus(fb, ROOT, noteIdOf(ref), 'done', { note: args.note ?? '', change: args.commit, by: args.by ?? null }));
} else if (command === 'decline') {
  need(ref && args.note, 'tickets decline WI-001 --note "why it will not be done"');
  after(setStatus(fb, ROOT, noteIdOf(ref), 'declined', { note: args.note, by: args.by ?? null }));
} else if (command === 'generate') {
  const files = writeTicketFiles(ROOT, records());
  console.log(`${files.size - 1} ticket(s) written to ${TICKETS_DIR}/.`);
} else if (command === 'export-github') {
  const wanted = new Set(args._.slice(1).map((s) => s.toUpperCase()));
  const tickets = deriveTickets(records()).filter((t) => (wanted.size ? wanted.has(t.id) : t.status === 'open'));
  console.log('# Not run. These commands would open one GitHub issue per ticket; run them yourself only if you want issues.');
  for (const t of tickets) {
    const body = `${TICKETS_DIR}/${t.id}.md`;
    console.log(`gh issue create --title ${JSON.stringify(`${t.id}: ${t.title}`)} --body-file ${body}${t.categories.length ? ` --label ${JSON.stringify(t.categories.join(','))}` : ''}`);
  }
} else {
  console.error(`unknown command ${command}; expected list, show, status, refine, split, resolve, decline, generate, or export-github`);
  process.exit(2);
}
