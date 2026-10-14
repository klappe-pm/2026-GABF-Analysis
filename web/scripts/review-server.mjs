#!/usr/bin/env node
// The web review server: npm run web:review builds the site with the review widget (WEB_REVIEW=1, into
// web/out-web-review) and runs this. It is the local review server of scripts/review-server.mjs with the web
// build served at the root of its origin, bound to 127.0.0.1 only, on port 4176 unless --port says otherwise.
//
//   /                   the review build of the site, with the Feedback entry point on every page
//   /review/...         the endpoints the widget uses: categories, the journey steps of a route, the
//                       copy check, the in place copy save, and the ticket register
//   /review/design-system/...  a read only view of the design system files the component tags link to
//
// A ticket is written to docs/feedback/<page>/ in the pipeline format, and its screenshots are taken when
// it is saved. The pipeline that turns a ticket into an issue and a pull request stays off unless
// GABF_FEEDBACK_PIPELINE=on, so a review session never reaches GitHub on its own.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { engine } from '../../scripts/lib/agent-graph.mjs';
import { captureImages, chromiumPath, loadPlaywright } from '../../scripts/lib/feedback-capture.mjs';
import { feedbackDirOf } from '../../scripts/lib/review-store.mjs';
import { parseArgs, ROOT } from '../../scripts/lib/paths.mjs';
import { createReviewServer } from '../../scripts/review-server.mjs';

const HOST = '127.0.0.1';
const args = parseArgs(process.argv.slice(2));
const PORT = Number(args.port ?? process.env.PORT ?? 4176);
const WEB_DIR = 'web/out-web-review';

// A copy change is written to the copy documents, so the review build is made again for the page to show it.
// The server waits for it (a few seconds), so the page reloads on the new words and a second edit cannot overlap.
const rebuild = () => {
  execFileSync('npm', ['run', 'build', '--prefix', 'web'], { cwd: ROOT, env: { ...process.env, WEB_REVIEW: '1' }, stdio: 'ignore' });
};

let sanitize;
try {
  sanitize = (await engine('design-feedback.mjs')).sanitize;
} catch {
  sanitize = undefined;
}

let pipeline = null;
if (process.env.GABF_FEEDBACK_PIPELINE === 'on') {
  const { buildContext, createRunner } = await import('../../scripts/feedback-pipeline.mjs');
  const { enqueue } = await import('../../scripts/lib/feedback-queue.mjs');
  const ctx = buildContext({ sanitize });
  const runner = createRunner(ctx);
  pipeline = { enqueue: (id) => enqueue(ctx.queueDir, id), kick: () => runner.kick() };
}

const capture = async (job) => captureImages({ ...job, playwright: await loadPlaywright({ root: ROOT }), executablePath: chromiumPath() });
const server = createReviewServer({ root: ROOT, port: PORT, sanitize, capture, pipeline, webDir: WEB_DIR, rebuild });
server.listen(PORT, HOST, () => {
  console.log(`Web review server on http://${HOST}:${PORT}/ (bound to ${HOST} only)`);
  console.log(`  the review build: ${resolve(ROOT, WEB_DIR)}`);
  console.log(`  tickets are written as Markdown under ${feedbackDirOf(ROOT)}`);
  console.log(`  the feedback pipeline is ${pipeline ? 'on (GABF_FEEDBACK_PIPELINE=on)' : 'off: tickets stay local'}`);
  console.log('  open Feedback at the bottom right of any page; Escape closes the panel');
});
process.on('SIGINT', () => process.exit(0));
