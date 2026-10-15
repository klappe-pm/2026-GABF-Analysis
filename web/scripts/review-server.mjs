#!/usr/bin/env node
// The review server: npm run review (port 4173, the pipeline on) and npm run web:review (port 4176, the pipeline
// off) build the site with the review widget (WEB_REVIEW=1, into web/out-web-review) and run this. It is the local
// review server of scripts/review-server.mjs with the web build served at the root of its origin and the design
// control plane beside it, bound to 127.0.0.1 only.
//
//   node web/scripts/review-server.mjs [--port 4176] [--pipeline on|off]
//
//   /                   the review build of the site, with the Feedback entry point on every page
//   /control-plane/     the design control plane: jobs, journeys and every screen, each framing a page of this site
//   /review/...         the endpoints the widget uses: categories, the journey steps of a route, the
//                       copy check, the in place copy save, and the ticket register
//   /review/design-system/...  a read only view of the design system files the component tags link to
//   /__design/check, /__design/edit  the review settings panel's saves, filed beside the feedback tickets
//   /design-settings/   the settings files, live
//
// A ticket is written to docs/feedback/<page>/ in the pipeline format, and its screenshots are taken when
// it is saved. The pipeline that turns a ticket into an issue and a pull request runs when --pipeline on is given
// (npm run review) or GABF_FEEDBACK_PIPELINE=on; GABF_FEEDBACK_PIPELINE=off turns it off either way. With it on, a
// watcher on the ticket store queues tickets written by someone else, and owner answers on decision issues are
// polled every two minutes (GABF_DECISION_POLL_MS).

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
  execFileSync('npm', ['run', 'build', '--prefix', 'web'], { cwd: ROOT, env: { ...process.env, WEB_REVIEW: '1', DESIGN_REVIEW: '1' }, stdio: 'ignore' });
};

let sanitize;
try {
  sanitize = (await engine('design-feedback.mjs')).sanitize;
} catch {
  sanitize = undefined;
}

const envPipeline = process.env.GABF_FEEDBACK_PIPELINE;
const pipelineOn = envPipeline ? envPipeline === 'on' : args.pipeline === 'on';
let pipeline = null;
let watcher = null;
if (pipelineOn) {
  const { buildContext, createRunner } = await import('../../scripts/feedback-pipeline.mjs');
  const { enqueue, readQueue, updateJob, watchStore } = await import('../../scripts/lib/feedback-queue.mjs');
  const ctx = buildContext({ sanitize });
  // A job that was running when the server stopped did not finish; it waits for a person.
  for (const j of readQueue(ctx.queueDir).jobs) if (['issue', 'in progress', 'pr'].includes(j.state)) updateJob(ctx.queueDir, j.id, { state: 'needs attention', error: 'interrupted before it finished' });
  const runner = createRunner(ctx);
  pipeline = { enqueue: (id) => enqueue(ctx.queueDir, id), kick: () => runner.kick() };
  watcher = watchStore({ storeDir: ctx.storeDir, queueDir: ctx.queueDir, onQueued: () => runner.kick() });
  runner.kick();
  // Owner answers: ask GitHub for answers on open decision issues, away from the server's own loop.
  const { spawn } = await import('node:child_process');
  const poll = () => {
    const child = spawn(process.execPath, [resolve(ROOT, 'scripts/decisions.mjs'), 'poll'], { cwd: ROOT, stdio: 'ignore' });
    child.on('exit', () => runner.kick());
  };
  poll();
  setInterval(poll, Number(process.env.GABF_DECISION_POLL_MS || 120000)).unref();
}

const capture = async (job) => captureImages({ ...job, playwright: await loadPlaywright({ root: ROOT }), executablePath: chromiumPath() });

// The picture a settings ticket carries: the edited component's states, or the settings row for a site wide
// setting, drawn on the style guide page of this same server from the files just saved.
const edits = await import('../../scripts/design-system/edit.mjs');
let browser = null;
async function designCapture({ target, key, path }) {
  const playwright = await loadPlaywright({ root: ROOT });
  browser ??= await playwright.chromium.launch({ executablePath: chromiumPath() });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  try {
    await page.goto(`http://${HOST}:${PORT}/design-system/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('html[data-settings-applied="true"]', { timeout: 20000 });
    const el = target === 'settings' ? page.locator(`tr:has([data-setting=${JSON.stringify(`settings:${key}`)}])`) : page.locator(`#component-${target}-sample`);
    if (!(await el.count())) return false;
    await page.evaluate(() => document.fonts.ready);
    await el.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await el.first().screenshot({ path, animations: 'disabled' });
    return true;
  } finally {
    await page.close();
  }
}

const server = createReviewServer({ root: ROOT, port: PORT, sanitize, capture, pipeline, webDir: WEB_DIR, rebuild, design: { edits, capture: designCapture } });
server.listen(PORT, HOST, () => {
  console.log(`Web review server on http://${HOST}:${PORT}/ (bound to ${HOST} only)`);
  console.log(`  the design control plane: http://${HOST}:${PORT}/control-plane/`);
  console.log(`  the review build: ${resolve(ROOT, WEB_DIR)}`);
  console.log(`  tickets are written as Markdown under ${feedbackDirOf(ROOT)}`);
  console.log(`  the feedback pipeline is ${pipeline ? 'on: a saved ticket becomes an issue and a pull request' : 'off: tickets stay local'}`);
  console.log('  open Feedback at the bottom right of any page; Escape closes the panel');
});
process.on('SIGINT', () => { watcher?.close(); process.exit(0); });
