#!/usr/bin/env node
// The local review server: the review build of the site, the design control plane, and the
// feedback store, on one origin bound to 127.0.0.1 only.
//
//   node scripts/review-server.mjs [--port 4173]
//
//   /site/...        the review build (dist-review/), with the page picker the control plane drives
//   /site-slow/...   the same, with data/*.json held back, so loading states can be reviewed
//   /site-fail/...   the same, with data/*.json answered 503, so error states can be reviewed
//   /review/...      the feedback panel's endpoints: lists, regions, derive links, preview a copy
//                    change, register a ticket, list and edit tickets, and the in place editor's
//                    resolve (which text is page copy) and save (a copy edit with one spot)
//   /review/design-system/...  a read only view of .design/design-system/ and nothing outside it: a
//                    Markdown file as a readable page, any other file as it is
//   everything else  the prototype (docs/design/prototype) and the sketches (docs/design/sketches)
//
// One origin is the point: the control plane can reach into its live frame to open the Filters
// panel or an estimate note, and the frame can post picked spots back, which a second port would
// forbid. Tickets are written as Markdown to docs/feedback/<page-name>/ with their captured images
// beside them (GABF_FEEDBACK_DIR moves it); copy edits go to .docs/content-management-system/
// (GABF_CMS_DIR moves it). When a ticket is registered the server captures its images and starts
// the feedback pipeline in the background (see feedback-pipeline.mjs); GABF_FEEDBACK_PIPELINE=off
// turns the automatic run off. The engine's own server is not used: only its secret scan is,
// imported read only.

import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { ROOT, parseArgs } from './lib/paths.mjs';
import { engine } from './lib/agent-graph.mjs';
import { addTicket, editTicket, feedbackDirOf, findTicket, listTickets, loadCategories, patchTicket } from './lib/review-store.mjs';
import { jobFor, queueDirOf, readQueue } from './lib/feedback-queue.mjs';
import { readFileSync as readText } from 'node:fs';
import { describeScreen, loadManifest, regionsPayload } from './lib/review-screens.mjs';
import { basename, dirname } from 'node:path';
import { VIEW_PREFIX, componentsForScreen, componentsForSpot, knownComponents, sourceMapEntries, withSpec } from './lib/review-components.mjs';
import { designSystemFile, designSystemType, renderDesignSystemPage } from './lib/review-design-system.mjs';
import { applyContentEdit, checkEdit, cmsDirOf, findInstances, loadCopy, loadInventory, matchContent, usedBy } from './lib/review-content.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.csv': 'text/csv; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf' };
const HOLD_MS = 10 * 60 * 1000;
const HOST = '127.0.0.1';

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 256_000) { reject(new Error('note too large')); req.destroy(); } });
    req.on('end', () => { try { resolveBody(JSON.parse(raw || '{}')); } catch { reject(new Error('the note was not valid JSON')); } });
  });
}

// The review site is rebuilt after a copy change so the framed page shows the new words at once.
function rebuildWith(root, dist, cmsDir) {
  return () => {
    execFileSync(process.execPath, [resolve(root, 'scripts/build-site.mjs')], { cwd: root, env: { ...process.env, GABF_FEEDBACK: '1', GABF_DIST: dist, GABF_CMS_DIR: cmsDir }, stdio: 'ignore' });
  };
}

// What the panel shows for a ticket's journey through the pipeline.
export function pipelineStatus(job, data, repo = 'klappe-pm/GABF-Analysis') {
  const issue = job?.issue ?? data?.issue ?? null;
  const pr = job?.pr ?? data?.pr ?? null;
  const links = {
    issue,
    issueUrl: job?.issueUrl ?? data?.['issue-url'] ?? (issue ? `https://github.com/${repo}/issues/${issue}` : null),
    pr,
    prUrl: job?.prUrl ?? data?.['pr-url'] ?? (pr ? `https://github.com/${repo}/pull/${pr}` : null),
  };
  let label = null;
  if (job) {
    label = { queued: 'Queued', issue: `Issue #${issue}`, 'in progress': 'In progress', pr: `PR #${pr}`, merged: 'Merged', 'needs attention': 'Needs attention' }[job.state] ?? job.state;
  } else if (data?.status === 'DONE' && pr) label = 'Merged';
  else if (pr) label = `PR #${pr}`;
  else if (issue) label = `Issue #${issue}`;
  return label ? { label, state: job?.state ?? (data?.status === 'DONE' ? 'merged' : pr ? 'pr' : 'issue'), ...links, error: job?.error ?? null, needsPull: job?.needsPull ?? null } : null;
}

// `capture` takes screenshots for a registered ticket; `pipeline` ({ enqueue, kick }) starts the
// issue and pull request run. Both are off unless given, so tests and screenshots never reach out.
export function createReviewServer({ root = ROOT, port = 4173, sanitize, rebuild = null, env = process.env, capture = null, pipeline = null } = {}) {
  const siteDir = resolve(root, env.GABF_REVIEW_DIST || 'dist-review');
  const prototypeDir = resolve(root, 'docs/design/prototype');
  const sketchesDir = resolve(root, 'docs/design/sketches');
  const feedbackDir = feedbackDirOf(root, env);
  const cmsDir = cmsDirOf(root, env);
  const doRebuild = rebuild ?? rebuildWith(root, siteDir, cmsDir);
  const queueDir = queueDirOf(root, env);
  let server = null;

  // A page on another origin must not be able to write into this repository through the browser.
  const foreignOrigin = (req) => {
    const origin = req.headers.origin;
    return origin && !new RegExp(`^http://(127\\.0\\.0\\.1|localhost):${port}$`).test(origin);
  };

  const manifest = () => loadManifest(root);

  // Links for a set of picked spots: the components behind them, from the source map, and the
  // copy entries behind their text. No spots means the whole page, linked to what the screen is made of.
  function derive(body) {
    const m = manifest();
    const screen = describeScreen(root, m, body.screen);
    if (!screen) throw new Error(`unknown screen ${body.screen}`);
    const spots = Array.isArray(body.spots) ? body.spots : [];
    const entries = sourceMapEntries(root);
    const copy = loadCopy(cmsDir);
    const inventory = loadInventory(cmsDir);
    const components = [];
    const content = [];
    if (!spots.length) {
      for (const c of componentsForScreen(root, m, body.screen, entries)) components.push({ ...c, spots: [] });
    }
    for (const [i, spot] of spots.entries()) {
      const n = Number(spot.n) || i + 1;
      for (const c of componentsForSpot(root, spot, entries)) {
        const hit = components.find((x) => x.name === c.name);
        if (hit) hit.spots.push(n); else components.push({ ...c, spots: [n] });
      }
      for (const e of matchContent(spot.text, copy, inventory)) content.push({ key: e.key, file: e.file, value: e.value, match: e.match, spot: n });
    }
    return { screen, components, content };
  }

  function preview(body) {
    const copy = loadCopy(cmsDir);
    const { problems, primary } = checkEdit({ copy, key: body.key, newValue: String(body.newValue ?? '') });
    if (!primary) return { problems, old: null, instances: [], usedBy: null };
    const fresh = body.newValue === undefined || body.newValue === null ? [] : problems;
    const secret = sanitize && body.newValue ? sanitize(String(body.newValue)).redacted.length : 0;
    if (secret) fresh.push('The copy contains a value shaped like a secret. It is not written.');
    const m = manifest();
    return { old: primary.value, file: primary.file, problems: fresh, instances: findInstances(root, cmsDir, primary, primary.value, { copy }), usedBy: usedBy(root, cmsDir, primary, primary.value, m) };
  }

  // Which texts on the framed page are one line of page copy, and which copy entry each one is. A
  // text is editable in place only when its whole words are the value of a copy entry; a text built
  // from several entries, or filled from the data, is not. When several entries hold the same words
  // the entry of the page being reviewed comes first, then the shared ones; the rest are offered as
  // related instances by the same preview the panel uses.
  function inlineResolve(body) {
    const m = manifest();
    const screen = describeScreen(root, m, body.screen);
    const page = screen ? screen.page : '';
    const copy = loadCopy(cmsDir);
    const inventory = loadInventory(cmsDir);
    // The entry the build reads comes first, so an edit lands on the key that draws the element
    // (the build records its reads in review-copy-keys.json); then the reviewed page, then shared.
    let read = new Set();
    try { read = new Set(JSON.parse(readFileSync(resolve(siteDir, 'review-copy-keys.json'), 'utf8'))); } catch { read = new Set(); }
    const rank = (e) => (read.has(e.key) ? 0 : e.key.startsWith(`pages.${page}.`) ? 1 : e.key.startsWith('global.') ? 2 : 3);
    const out = {};
    for (const text of (Array.isArray(body.texts) ? body.texts : []).slice(0, 400).map(String)) {
      const hits = matchContent(text, copy, inventory).filter((e) => e.match === 'exact' || e.match === 'inventory').sort((a, b) => rank(a) - rank(b));
      out[text] = hits.length ? { key: hits[0].key, value: hits[0].value, file: hits[0].file, others: hits.length - 1 } : null;
    }
    return out;
  }

  // Saving an inline edit is the copy edit the panel sends, with one spot: the same check, the same
  // write, the same related instances, the same rebuild and the same ACCEPTED ticket.
  function inlineSave(body) {
    const spot = body.spot && typeof body.spot === 'object' ? body.spot : null;
    return register({
      screen: body.screen,
      text: 'Edited in place on the page.',
      categories: [],
      spots: spot ? [{ n: 1, selector: spot.selector, rect: spot.rect, text: spot.text }] : [],
      components: body.components ?? [],
      contentEdits: [{ key: body.key, newValue: String(body.newValue ?? ''), take: body.take ?? [] }],
      device: body.device,
      viewport: body.viewport,
      build: body.build,
    });
  }

  function register(body) {
    const m = manifest();
    const screen = describeScreen(root, m, body.screen);
    if (!screen) throw new Error('Choose a journey step first. Feedback is recorded against a step.');
    const edits = [];
    let rebuilt = false;
    const asked = (body.contentEdits ?? []).filter((e) => e && e.key);
    // Check every edit before any file is written, so a refused one leaves the copy as it was.
    const copy = asked.length ? loadCopy(cmsDir) : [];
    for (const e of asked) {
      const { problems } = checkEdit({ copy, key: e.key, newValue: String(e.newValue ?? '') });
      if (problems.length) { const error = new Error(problems[0]); error.problems = problems; throw error; }
    }
    for (const e of asked) edits.push(applyContentEdit(root, { cmsDir, key: e.key, newValue: String(e.newValue ?? ''), take: e.take ?? [], sanitize }));
    if (edits.length) { try { doRebuild(); rebuilt = true; } catch { rebuilt = false; } }
    const components = (body.components ?? []).map((c) => (typeof c === 'string' ? withSpec(root, c) : withSpec(root, String(c.name), c.instance)));
    const ticket = addTicket(feedbackDir, {
      ...screen,
      text: body.text,
      categories: body.categories,
      spots: body.spots,
      components,
      contentKeys: [...(body.contentKeys ?? []), ...edits.map((e) => e.key)],
      contentEdits: edits,
      device: body.device,
      viewport: body.viewport,
      build: body.build,
      capture: capture ? 'pending' : undefined,
      settingEdits: body.settingEdits,
    }, { sanitize, categories: loadCategories(root), root });
    afterRegister(ticket, screen, body);
    return { id: ticket.id, page: ticket.page, file: ticket.file, status: ticket.status, redacted: ticket.redacted, rebuilt, edited: edits.length > 0 };
  }

  // Capture the images, then start the pipeline, after the response has gone: saving never waits.
  function afterRegister(ticket, screen, body) {
    if (!capture && !pipeline) return;
    setImmediate(async () => {
      if (capture) {
        try {
          const m = manifest();
          const entries = sourceMapEntries(root);
          const base = basename(ticket.file, '.md');
          const spots = (body.spots ?? []).map((s, i) => ({ ...s, n: Number(s.n) || i + 1, component: componentsForSpot(root, s, entries)[0]?.name ?? null }));
          const images = await capture({
            origin: `http://${HOST}:${server.address().port}`,
            ticket: { ...screen, viewport: body.viewport, spots, region: regionsPayload(m).screens[screen.step] ?? null },
            outDir: resolve(dirname(ticket.file), base),
            relDir: base,
          });
          patchTicket(feedbackDir, ticket.id, { images, capture: 'done' }, { sanitize });
        } catch {
          try { patchTicket(feedbackDir, ticket.id, { capture: 'unavailable' }, { sanitize }); } catch { /* the ticket is gone */ }
        }
      }
      if (pipeline) { pipeline.enqueue(ticket.id); pipeline.kick(); }
    });
  }

  function summaries(url) {
    const page = url.searchParams.get('page');
    const step = url.searchParams.get('step');
    return listTickets(feedbackDir)
      .filter((t) => (!page || t.page === page) && (!step || t.data.step === step))
      .map((t) => ({ id: t.id, title: t.data.title, status: t.data.status, step: t.data.step, page: t.page, spots: (t.data.spots ?? []).length, revised: t.data.revised, pipeline: pipelineStatus(jobFor(queueDir, t.id), t.data), images: (t.data.images ?? []).map((i) => ({ kind: i.kind, spot: i.spot, name: basename(i.path), url: `/review/feedback-image/${t.id}/${basename(i.path)}` })) }));
  }

  function serveSite(req, res, served, rest) {
    if (!existsSync(siteDir)) return send(res, 503, `The review build is missing at ${siteDir}. Run: npm run review:build`, 'text/plain; charset=utf-8');
    let path = decodeURIComponent(rest || '/');
    if (path.endsWith('/')) path += 'index.html';
    let file = normalize(join(siteDir, path));
    if (!file.startsWith(siteDir)) return send(res, 403, 'outside the site', 'text/plain; charset=utf-8');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) return send(res, 404, 'not found', 'text/plain; charset=utf-8');
    const isData = path.startsWith('/data/');
    if (isData && served === 'site-fail') return send(res, 503, 'data withheld by the review server for an error state', 'text/plain; charset=utf-8');
    if (isData && served === 'site-slow') {
      const timer = setTimeout(() => send(res, 503, 'data held back for a loading state', 'text/plain; charset=utf-8'), HOLD_MS);
      req.on('close', () => clearTimeout(timer));
      return undefined;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
    return undefined;
  }

  server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${HOST}`);
    const site = /^\/(site|site-slow|site-fail)(\/.*)?$/.exec(url.pathname);
    if (site) {
      if (!site[2]) { res.writeHead(302, { location: `/${site[1]}/` }); return res.end(); }
      return serveSite(req, res, site[1], site[2]);
    }
    if (url.pathname.startsWith(VIEW_PREFIX)) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed', 'text/plain; charset=utf-8');
      const file = designSystemFile(root, url.pathname.slice(VIEW_PREFIX.length));
      if (!file) return send(res, 404, 'There is no such file in the design system.', 'text/plain; charset=utf-8');
      if (extname(file).toLowerCase() === '.md') return send(res, 200, renderDesignSystemPage(root, file), 'text/html; charset=utf-8');
      res.writeHead(200, { 'content-type': designSystemType(file), 'cache-control': 'no-store' });
      return createReadStream(file).pipe(res);
    }
    if (req.method === 'POST' && foreignOrigin(req)) return send(res, 403, { error: 'feedback is accepted only from this machine' });
    try {
      const p = url.pathname;
      if (p === '/review/categories' && req.method === 'GET') return send(res, 200, { categories: loadCategories(root) });
      if (p === '/review/regions' && req.method === 'GET') return send(res, 200, regionsPayload(manifest()));
      if (p === '/review/lists' && req.method === 'GET') {
        const copy = loadCopy(cmsDir);
        // nodes pairs each manifest component id with the design system name the source map gives it,
        // so the control plane's component lists can link the ids they show.
        const nodes = {};
        for (const e of sourceMapEntries(root)) if (e.node && e.component) nodes[e.node.replace(/^component:/, '')] = e.component;
        return send(res, 200, { components: knownComponents(root, manifest()).map((n) => withSpec(root, n)), nodes, contentKeys: copy.map((e) => e.key) });
      }
      if (p === '/review/derive' && req.method === 'POST') return send(res, 200, derive(await readBody(req)));
      if (p === '/review/content' && req.method === 'POST') return send(res, 200, preview(await readBody(req)));
      if (p === '/review/inline/resolve' && req.method === 'POST') return send(res, 200, inlineResolve(await readBody(req)));
      if (p === '/review/inline/save' && req.method === 'POST') return send(res, 200, inlineSave(await readBody(req)));
      if (p === '/review/feedback' && req.method === 'GET') return send(res, 200, summaries(url));
      const image = /^\/review\/feedback-image\/(WI-\d+)\/([\w.-]+\.png)$/i.exec(p);
      if (image && req.method === 'GET') {
        const t = findTicket(feedbackDir, image[1]);
        const file = t ? resolve(dirname(t.file), basename(t.file, '.md'), image[2]) : null;
        if (!file || !existsSync(file)) return send(res, 404, 'There is no such image.', 'text/plain; charset=utf-8');
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
        return createReadStream(file).pipe(res);
      }
      if (p === '/review/decisions' && req.method === 'GET') {
        let list = { open: [] };
        try { list = JSON.parse(readText(resolve(queueDir, 'decisions.json'), 'utf8')); } catch { list = { open: [] }; }
        return send(res, 200, list);
      }
      if (p === '/review/pipeline' && req.method === 'GET') return send(res, 200, Object.fromEntries(readQueue(queueDir).jobs.map((j) => [j.id, pipelineStatus(j, findTicket(feedbackDir, j.id)?.data)])));
      if (p === '/review/feedback' && req.method === 'POST') return send(res, 200, register(await readBody(req)));
      const edit = /^\/review\/feedback\/(WI-\d+)$/i.exec(p);
      if (edit && req.method === 'GET') { const t = findTicket(feedbackDir, edit[1]); return t ? send(res, 200, { ...t.data, note: t.body }) : send(res, 404, { error: 'no such ticket' }); }
      if (edit && req.method === 'POST') {
        const body = await readBody(req);
        return send(res, 200, editTicket(feedbackDir, edit[1], body, { sanitize, categories: loadCategories(root), root }));
      }
    } catch (error) {
      return send(res, error.problems ? 422 : 400, { error: error.message, problems: error.problems ?? [error.message] });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });
    // The prototype and the sketches, from those two directories only.
    const sketches = url.pathname.startsWith('/sketches/');
    const dir = sketches ? sketchesDir : prototypeDir;
    const rel = sketches ? url.pathname.slice('/sketches'.length) : url.pathname === '/' ? '/index.html' : url.pathname;
    const file = normalize(join(dir, decodeURIComponent(rel)));
    if (!file.startsWith(dir)) return send(res, 403, 'outside the control plane', 'text/plain; charset=utf-8');
    if (!existsSync(file) || !statSync(file).isFile()) return send(res, 404, 'not found', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    return createReadStream(file).pipe(res);
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const PORT = Number(args.port ?? 4173);
  const fb = await engine('design-feedback.mjs');
  const on = process.env.GABF_FEEDBACK_PIPELINE !== 'off';
  let runner = null;
  let watcher = null;
  let pipeline = null;
  if (on) {
    const { buildContext, createRunner } = await import('./feedback-pipeline.mjs');
    const { enqueue, queueDirOf: qd, readQueue: rq, updateJob: uj, watchStore } = await import('./lib/feedback-queue.mjs');
    const ctx = buildContext({ sanitize: fb.sanitize });
    // A job that was running when the server stopped did not finish; it waits for a person.
    for (const j of rq(ctx.queueDir).jobs) if (['issue', 'in progress', 'pr'].includes(j.state)) uj(ctx.queueDir, j.id, { state: 'needs attention', error: 'interrupted before it finished' });
    runner = createRunner(ctx);
    pipeline = { enqueue: (id) => enqueue(ctx.queueDir, id), kick: () => runner.kick() };
    watcher = watchStore({ storeDir: ctx.storeDir, queueDir: qd(ROOT), onQueued: () => runner.kick() });
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
  const { loadPlaywright, chromiumPath, captureImages } = await import('./lib/feedback-capture.mjs');
  const capture = async (job) => captureImages({ ...job, playwright: await loadPlaywright({ root: ROOT }), executablePath: chromiumPath() });
  const server = createReviewServer({ port: PORT, sanitize: fb.sanitize, capture, pipeline });
  process.on('SIGINT', () => { watcher?.close(); process.exit(0); });
  server.listen(PORT, HOST, () => {
    console.log(`Review server on http://${HOST}:${PORT}/ (bound to ${HOST} only)`);
    console.log(`  the design control plane: http://${HOST}:${PORT}/`);
    console.log(`  the review build of the site: http://${HOST}:${PORT}/site/`);
    console.log(`  tickets are written as Markdown under ${feedbackDirOf(ROOT)}`);
    console.log(`  the feedback pipeline is ${on ? 'on: a saved ticket becomes an issue and a pull request' : 'off (GABF_FEEDBACK_PIPELINE=off)'}`);
    console.log('  open Feedback in the control plane bar; Escape closes the panel');
  });
}
