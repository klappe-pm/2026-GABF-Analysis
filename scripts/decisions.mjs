#!/usr/bin/env node
// Owner decisions: file a question for the owner, list the open ones, and poll for answers.
//
//   npm run decisions -- open --question "..." --option "Keep separate => no source links them" \
//     --option "Merge them => one operation" --recommend A --blocks "..." --context "..." [--area data] [--dry-run]
//   npm run decisions -- open --file decisions.json
//   npm run decisions -- list
//   npm run decisions -- poll            (create and queue a ticket for each new owner answer)
//
// An option is its words, then " => ", then what choosing it means; letters are given in order. The
// issue is assigned to klappe-pm and labelled "needs: owner decision". An open issue that asks the
// same question is returned instead of filing a second. File format for --file: a JSON array of
// { question, options: [...], recommend, blocks, context, area }.

import { readFileSync } from 'node:fs';
import { ROOT, parseArgs } from './lib/paths.mjs';
import { engine } from './lib/agent-graph.mjs';
import { dryExec, realExec } from './feedback-pipeline.mjs';
import { appendLog, enqueue, queueDirOf } from './lib/feedback-queue.mjs';
import { REPO } from './lib/feedback-issue.mjs';
import { listOpenDecisions, openDecision, pollDecisions } from './lib/owner-decisions.mjs';
import { feedbackDirOf, loadCategories } from './lib/review-store.mjs';

// parseArgs keeps one value per flag; --option repeats.
export function repeated(argv, flag) {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === `--${flag}` && argv[i + 1] !== undefined) out.push(argv[i + 1]);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const [command = 'list'] = args._;
  const dry = Boolean(args['dry-run']);
  const exec = dry ? dryExec(REPO) : realExec;
  const sanitize = dry ? undefined : (await engine('design-feedback.mjs')).sanitize;
  const queueDir = queueDirOf(ROOT);
  if (command === 'open') {
    const inputs = args.file
      ? JSON.parse(readFileSync(args.file, 'utf8'))
      : [{ question: args.question, context: args.context, options: repeated(argv, 'option'), recommend: args.recommend, blocks: args.blocks, area: args.area }];
    for (const input of inputs) {
      const r = openDecision(input, { exec, cwd: ROOT, queueDir, sanitize, dry });
      console.log(`${r.created ? 'filed' : 'already open'}: #${r.number} ${r.url}`);
    }
  } else if (command === 'list') {
    for (const i of listOpenDecisions({ exec, cwd: ROOT })) console.log(`#${i.number} ${i.title}\n    ${i.url}`);
  } else if (command === 'poll') {
    const fresh = pollDecisions({ exec, cwd: ROOT, storeDir: feedbackDirOf(ROOT), queueDir, sanitize, categories: loadCategories(ROOT), root: ROOT });
    for (const t of fresh) { enqueue(queueDir, t.id); appendLog(queueDir, { id: t.id, step: 'decision', status: 'ok', detail: `answer to #${t.data['decision-issue']}` }); }
    console.log(fresh.length ? fresh.map((t) => `${t.id} from the answer to #${t.data['decision-issue']}`).join('\n') : 'No new answers.');
  } else {
    console.error(`unknown command ${command}; expected open, list, or poll`);
    process.exit(2);
  }
}
