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
//                    change, register a ticket, list and edit tickets
//   everything else  the prototype (docs/design/prototype) and the sketches (docs/design/sketches)
//
// One origin is the point: the control plane can reach into its live frame to open the Filters
// panel or an estimate note, and the frame can post picked spots back, which a second port would
// forbid. Tickets are written as Markdown to .docs/feedback/<page-name>/ (GABF_FEEDBACK_DIR moves
// it); copy edits go to .docs/content-management-system/ (GABF_CMS_DIR moves it). The engine's own
// server is not used: only its secret scan is, imported read only.

import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { ROOT, parseArgs } from './lib/paths.mjs';
import { engine } from './lib/agent-graph.mjs';
import { addTicket, editTicket, feedbackDirOf, findTicket, listTickets, loadCategories } from './lib/review-store.mjs';
import { describeScreen, loadManifest, regionsPayload } from './lib/review-screens.mjs';
import { componentsForScreen, componentsForSpot, knownComponents, sourceMapEntries, withSpec } from './lib/review-components.mjs';
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
function rebuildWith(root, dist) {
  return () => {
    execFileSync(process.execPath, [resolve(root, 'scripts/build-site.mjs')], { cwd: root, env: { ...process.env, GABF_FEEDBACK: '1', GABF_DIST: dist }, stdio: 'ignore' });
  };
}

export function createReviewServer({ root = ROOT, port = 4173, sanitize, rebuild = null, env = process.env } = {}) {
  const siteDir = resolve(root, env.GABF_REVIEW_DIST || 'dist-review');
  const prototypeDir = resolve(root, 'docs/design/prototype');
  const sketchesDir = resolve(root, 'docs/design/sketches');
  const feedbackDir = feedbackDirOf(root, env);
  const cmsDir = cmsDirOf(root, env);
  const doRebuild = rebuild ?? rebuildWith(root, siteDir);

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
    }, { sanitize, categories: loadCategories(root) });
    return { id: ticket.id, page: ticket.page, file: ticket.file, status: ticket.status, redacted: ticket.redacted, rebuilt, edited: edits.length > 0 };
  }

  function summaries(url) {
    const page = url.searchParams.get('page');
    const step = url.searchParams.get('step');
    return listTickets(feedbackDir)
      .filter((t) => (!page || t.page === page) && (!step || t.data.step === step))
      .map((t) => ({ id: t.id, title: t.data.title, status: t.data.status, step: t.data.step, page: t.page, spots: (t.data.spots ?? []).length, revised: t.data.revised }));
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

  return createServer(async (req, res) => {
    const url = new URL(req.url, `http://${HOST}`);
    const site = /^\/(site|site-slow|site-fail)(\/.*)?$/.exec(url.pathname);
    if (site) {
      if (!site[2]) { res.writeHead(302, { location: `/${site[1]}/` }); return res.end(); }
      return serveSite(req, res, site[1], site[2]);
    }
    if (req.method === 'POST' && foreignOrigin(req)) return send(res, 403, { error: 'feedback is accepted only from this machine' });
    try {
      const p = url.pathname;
      if (p === '/review/categories' && req.method === 'GET') return send(res, 200, { categories: loadCategories(root) });
      if (p === '/review/regions' && req.method === 'GET') return send(res, 200, regionsPayload(manifest()));
      if (p === '/review/lists' && req.method === 'GET') {
        const copy = loadCopy(cmsDir);
        return send(res, 200, { components: knownComponents(root, manifest()).map((n) => withSpec(root, n)), contentKeys: copy.map((e) => e.key) });
      }
      if (p === '/review/derive' && req.method === 'POST') return send(res, 200, derive(await readBody(req)));
      if (p === '/review/content' && req.method === 'POST') return send(res, 200, preview(await readBody(req)));
      if (p === '/review/feedback' && req.method === 'GET') return send(res, 200, summaries(url));
      if (p === '/review/feedback' && req.method === 'POST') return send(res, 200, register(await readBody(req)));
      const edit = /^\/review\/feedback\/(WI-\d+)$/i.exec(p);
      if (edit && req.method === 'GET') { const t = findTicket(feedbackDir, edit[1]); return t ? send(res, 200, { ...t.data, note: t.body }) : send(res, 404, { error: 'no such ticket' }); }
      if (edit && req.method === 'POST') {
        const body = await readBody(req);
        return send(res, 200, editTicket(feedbackDir, edit[1], body, { sanitize, categories: loadCategories(root) }));
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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const PORT = Number(args.port ?? 4173);
  const fb = await engine('design-feedback.mjs');
  const server = createReviewServer({ port: PORT, sanitize: fb.sanitize });
  server.listen(PORT, HOST, () => {
    console.log(`Review server on http://${HOST}:${PORT}/ (bound to ${HOST} only)`);
    console.log(`  the design control plane: http://${HOST}:${PORT}/`);
    console.log(`  the review build of the site: http://${HOST}:${PORT}/site/`);
    console.log(`  tickets are written as Markdown under ${feedbackDirOf(ROOT)}`);
    console.log('  open Feedback in the control plane bar; Escape closes the panel');
  });
}
