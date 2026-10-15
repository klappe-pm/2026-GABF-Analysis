#!/usr/bin/env node
// The local review server: the web review build of the site, the design control plane, and the
// feedback store, on one origin bound to 127.0.0.1 only. Its command line is web/scripts/review-server.mjs
// (npm run review and npm run web:review); this module is the server those start and the tests boot.
//
//   /                the web review build (web/out-web-review), with the review widget on every page; a page
//                    opened with ?review-state=slow or fail has its data/*.json held back or answered 503
//   /control-plane/  the design control plane, whose screens frame the pages above
//   /review/...      the feedback panel's endpoints: lists, regions, derive links, preview a copy
//                    change, register a ticket, list and edit tickets, and the in place editor's
//                    resolve (which text is page copy) and save (a copy edit with one spot)
//   /review/design-system/...  a read only view of .design/design-system/ and nothing outside it: a
//                    Markdown file as a readable page, any other file as it is
//   /sketches/...    the sketches (docs/design/sketches); with no web build, the prototype is at the root
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
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { addTicket, editTicket, feedbackDirOf, findTicket, listTickets, loadCategories, patchTicket } from './lib/review-store.mjs';
import { jobFor, queueDirOf, readQueue } from './lib/feedback-queue.mjs';
import { readFileSync as readText } from 'node:fs';
import { describeScreen, listScreens, loadManifest, regionsPayload, screensForRoute } from './lib/review-screens.mjs';
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
// `webDir` is the web review build (web/out-web-review). When given, the server serves it at the root of
// its origin, and tickets may carry the route the reviewer was on (served: web). The design control plane
// is then at /control-plane/: its screens frame the web build's pages on this same origin. A page opened
// with ?review-state=slow or ?review-state=fail has its data/*.json requests held back or answered 503
// (read from the request's Referer, which carries the page address), so loading and error states can be
// reviewed without a second build.
//
// `design` ({ edits, capture }) adds what the review settings panel needs on the same origin: POST
// /__design/check and /__design/edit (the design system's edit module, writing one settings key and filing
// its ticket in the same store as the feedback tickets, so ids never collide), and the settings files, live,
// at /design-settings/.
export function createReviewServer({ root = ROOT, port = 4173, sanitize, rebuild = null, env = process.env, capture = null, pipeline = null, webDir = null, design = null } = {}) {
  const webRoot = webDir ? resolve(root, webDir) : null;
  const prototypeDir = resolve(root, 'docs/design/prototype');
  const sketchesDir = resolve(root, 'docs/design/sketches');
  const feedbackDir = feedbackDirOf(root, env);
  const cmsDir = cmsDirOf(root, env);
  // The site is built again after a copy change so the page shows the new words; the command line passes the web
  // review build (web/scripts/review-server.mjs). Without one the copy files change and the page waits for a rebuild.
  const doRebuild = rebuild ?? (() => { throw new Error('no rebuild for this server'); });
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
    // The entry of the page under review comes first, then a shared one, so an edit lands on the key that draws it.
    const rank = (e) => (e.key.startsWith(`pages.${page}.`) ? 0 : e.key.startsWith('global.') ? 1 : 2);
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
      route: body.route,
      hash: body.hash,
      served: body.served,
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
    const base = describeScreen(root, m, body.screen);
    if (!base) throw new Error('Choose a journey step first. Feedback is recorded against a step.');
    // A web ticket records the address the reviewer was on, not the step's sample address.
    const onWeb = webRoot && body.served === 'web';
    if (onWeb && !/^\/[\w\-./%]*$/.test(String(body.route ?? ''))) throw new Error('The page address was not recognised.');
    const screen = onWeb ? { ...base, route: String(body.route), hash: /^#[^\s]*$/.test(String(body.hash ?? '')) ? String(body.hash) : '', served: 'web' } : base;
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

  // The web review build as the static export lays it out: a folder address serves its index.html, and an
  // address with no page serves 404.html with a 404 status.
  function serveWeb(req, res, pathname) {
    if (pathname.startsWith('/data/')) {
      let state = null;
      try { state = new URL(req.headers.referer ?? '').searchParams.get('review-state'); } catch { state = null; }
      if (state === 'fail') return send(res, 503, 'data withheld by the review server for an error state', 'text/plain; charset=utf-8');
      if (state === 'slow') {
        const timer = setTimeout(() => send(res, 503, 'data held back for a loading state', 'text/plain; charset=utf-8'), HOLD_MS);
        req.on('close', () => clearTimeout(timer));
        return undefined;
      }
    }
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'bad address', 'text/plain; charset=utf-8'); }
    const file = normalize(join(webRoot, rel.endsWith('/') ? `${rel}index.html` : rel));
    if (!file.startsWith(webRoot)) return send(res, 403, 'outside the site', 'text/plain; charset=utf-8');
    let target = file;
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
    if (!existsSync(target) && !extname(target)) target = `${file}.html`;
    if (!existsSync(target)) {
      const missing = join(webRoot, '404.html');
      if (!existsSync(missing)) return send(res, 404, 'not found', 'text/plain; charset=utf-8');
      res.writeHead(404, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' });
      return createReadStream(missing).pipe(res);
    }
    res.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    return createReadStream(target).pipe(res);
  }

  server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${HOST}`);
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
      if (design && req.method === 'POST' && (p === '/__design/check' || p === '/__design/edit')) {
        try {
          const body = await readBody(req);
          if (p === '/__design/check') return send(res, 200, await design.edits.checkDesignEdit(body));
          return send(res, 200, await design.edits.applyDesignEdit({ ...body, feedbackDir, sanitize, capture: design.capture }));
        } catch (error) {
          return send(res, 422, { problems: error.problems ?? [error.message] });
        }
      }
      if (p === '/review/web/screens' && req.method === 'GET') {
        const m = manifest();
        const route = url.searchParams.get('route') ?? '/';
        return send(res, 200, { matched: screensForRoute(root, m, route).map((s) => s.id), screens: listScreens(root, m) });
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
    // The settings files, read live so a saved setting shows on the next load without a rebuild.
    if (design && url.pathname.startsWith('/design-settings/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const base = resolve(root, '.design/design-system');
      const file = normalize(join(base, decodeURIComponent(url.pathname.slice('/design-settings'.length))));
      if (!file.startsWith(base) || extname(file) !== '.md' || !existsSync(file)) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' });
      return createReadStream(file).pipe(res);
    }
    // With the web build at the root, the control plane lives under /control-plane/.
    const plane = webRoot ? /^\/control-plane(\/.*)?$/.exec(url.pathname) : null;
    if (plane && !plane[1]) { res.writeHead(302, { location: '/control-plane/' }); return res.end(); }
    if (webRoot && !plane && !url.pathname.startsWith('/sketches/')) return serveWeb(req, res, url.pathname);
    // The prototype and the sketches, from those two directories only.
    const sketches = url.pathname.startsWith('/sketches/');
    const dir = sketches ? sketchesDir : prototypeDir;
    const inPlane = plane ? plane[1] : url.pathname;
    const rel = sketches ? url.pathname.slice('/sketches'.length) : inPlane === '/' ? '/index.html' : inPlane;
    const file = normalize(join(dir, decodeURIComponent(rel)));
    if (!file.startsWith(dir)) return send(res, 403, 'outside the control plane', 'text/plain; charset=utf-8');
    if (!existsSync(file) || !statSync(file).isFile()) return send(res, 404, 'not found', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    return createReadStream(file).pipe(res);
  });
  return server;
}
