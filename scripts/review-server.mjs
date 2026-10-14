#!/usr/bin/env node
// The local review server: the review build of the site, the design control plane, and the
// feedback store, on one origin bound to 127.0.0.1 only.
//
//   node scripts/review-server.mjs [--port 4173]
//
//   /site/...        the review build (dist-review/), with the inline feedback widget
//   /site-slow/...   the same, with data/*.json held back, so loading states can be reviewed
//   /site-fail/...   the same, with data/*.json answered 503, so error states can be reviewed
//   /review/...      the widget's endpoints: notes (GET open notes for a route, POST a note), categories
//   /feedback        the prototype panel's endpoint, written through the same sealed store
//   everything else  the prototype (docs/design/prototype) and the sketches (docs/design/sketches)
//
// One origin is the point: a screen in the prototype can reach into its live frame to clear the
// stored filter, open the Filters panel, or open an estimate note, which a second port would forbid.
// The engine's own server (design-feedback.mjs serve) is not used: it serves .mjs with no script
// type, does not resolve a directory to its index.html, and its static handler passes a file's
// bytes through JSON.stringify, so every page it serves arrives as a JSON byte array. The store
// functions are the engine's, unchanged; only the HTTP layer is local.

import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { ROOT, parseArgs } from './lib/paths.mjs';
import { engine } from './lib/agent-graph.mjs';
import { addNote, loadCategories, ticketId, writeTicketFiles } from './lib/review-store.mjs';

const args = parseArgs(process.argv.slice(2));
const PORT = Number(args.port ?? 4173);
const HOST = '127.0.0.1';
const SITE_DIR = resolve(ROOT, process.env.GABF_REVIEW_DIST || 'dist-review');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.csv': 'text/csv; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf' };
const HOLD_MS = 10 * 60 * 1000;

const DESIGN_PROTOTYPE = resolve(ROOT, 'docs/design/prototype');
const DESIGN_SKETCHES = resolve(ROOT, 'docs/design/sketches');
const fb = await engine('design-feedback.mjs');

function manifest() { return JSON.parse(readFileSync(resolve(ROOT, 'docs/design/design-nodes.json'), 'utf8')); }

// Which manifest screen a note was left on: the one the prototype frame names, or the screen whose
// declared state matches the page's route, hash, data condition, and frame width.
export function matchScreen(input, m = manifest()) {
  const nodes = m.nodes;
  const surfaceOf = (id) => Object.entries(m.surfaces).find(([, s]) => s.screens.includes(id));
  const describe = (id) => {
    const node = nodes[`screen:${id}`];
    const [surface] = surfaceOf(id) ?? [null];
    return { screen: id, surface, path: node.path, manifest: { screen: `screen:${id}`, surface: surface ? `surface:${surface}` : null, nodes: [...node.consumes, ...(surface ? [`surface:${surface}`] : [])] } };
  };
  if (input.screen && nodes[`screen:${input.screen}`]) return describe(input.screen);
  const page = input.page ?? {};
  const served = page.served || 'site';
  const frame = input.device === 'phone' ? 'phone' : 'desktop';
  const candidates = [];
  for (const [name, s] of Object.entries(m.surfaces)) {
    for (const id of s.screens) {
      const st = nodes[`screen:${id}`].state ?? {};
      if ((st.route || s.route) !== page.route) continue;
      let score = 1;
      if ((st.served || 'site') === served) score += 4;
      if ((st.hash || '') === (page.hash || '')) score += 4;
      if ((st.frame || 'desktop') === frame) score += 2;
      if (!st.drive) score += 1;
      candidates.push({ id, name, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  if (!candidates.length) {
    const surface = Object.entries(m.surfaces).find(([, s]) => s.route === page.route);
    return { screen: null, surface: surface ? surface[0] : null, path: null, manifest: surface ? { screen: null, surface: `surface:${surface[0]}`, nodes: [] } : null };
  }
  return describe(candidates[0].id);
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

// A page on another origin must not be able to write into this repository through the browser.
function foreignOrigin(req) {
  const origin = req.headers.origin;
  return origin && !new RegExp(`^http://(127\\.0\\.0\\.1|localhost):${PORT}$`).test(origin);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 256_000) { reject(new Error('note too large')); req.destroy(); } });
    req.on('end', () => { try { resolveBody(JSON.parse(raw || '{}')); } catch { reject(new Error('the note was not valid JSON')); } });
  });
}

function record(input) {
  const written = addNote(fb, ROOT, input, matchScreen(input));
  writeTicketFiles(ROOT, fb.readFeedback(ROOT));
  return written;
}

function openFor(route) {
  const records = fb.readFeedback(ROOT);
  const closed = new Set(records.filter((r) => r.kind === 'resolution').map((r) => r.resolves));
  return records.filter((r) => r.kind === 'note' && !closed.has(r.id) && (!route || r.page?.route === route))
    .map((r) => ({ id: r.id, ticket: r.ticket ?? ticketId(r.id), text: r.text, categories: r.categories ?? [], mode: r.mode, target: r.target ?? null, screen: r.screen }));
}

function serveSite(req, res, served, rest) {
  if (!existsSync(SITE_DIR)) return send(res, 503, `The review build is missing at ${SITE_DIR}. Run: npm run review:build`, 'text/plain; charset=utf-8');
  let path = decodeURIComponent(rest || '/');
  if (path.endsWith('/')) path += 'index.html';
  let file = normalize(join(SITE_DIR, path));
  if (!file.startsWith(SITE_DIR)) return send(res, 403, 'outside the site', 'text/plain; charset=utf-8');
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  const site = /^\/(site|site-slow|site-fail)(\/.*)?$/.exec(url.pathname);
  if (site) {
    if (!site[2]) { res.writeHead(302, { location: `/${site[1]}/` }); return res.end(); }
    return serveSite(req, res, site[1], site[2]);
  }
  if (req.method === 'POST' && foreignOrigin(req)) return send(res, 403, { error: 'feedback is accepted only from this machine' });
  try {
    if (url.pathname === '/review/categories' && req.method === 'GET') return send(res, 200, { categories: loadCategories(ROOT) });
    if (url.pathname === '/review/feedback' && req.method === 'GET') return send(res, 200, openFor(url.searchParams.get('route')));
    if (url.pathname === '/review/feedback' && req.method === 'POST') {
      const written = record(await readBody(req));
      return send(res, 200, { id: written.id, ticket: written.ticket, redacted: written.redacted ?? [] });
    }
    // The prototype panel posts { screen, surface, path, text }: a whole page note on that screen.
    if (url.pathname === '/feedback' && req.method === 'POST') {
      const input = await readBody(req);
      const written = record({ ...input, mode: 'page', page: null, code: [] });
      return send(res, 200, { id: written.id, ticket: written.ticket, redacted: written.redacted ?? [] });
    }
    if (url.pathname === '/feedback' && req.method === 'GET') return send(res, 200, fb.openNotes(fb.readFeedback(ROOT)));
  } catch (error) {
    return send(res, 400, { error: error.message });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });
  // The prototype and the sketches, from those two directories only.
  const sketches = url.pathname.startsWith('/sketches/');
  const dir = sketches ? DESIGN_SKETCHES : DESIGN_PROTOTYPE;
  const rel = sketches ? url.pathname.slice('/sketches'.length) : url.pathname === '/' ? '/index.html' : url.pathname;
  const file = normalize(join(dir, decodeURIComponent(rel)));
  if (!file.startsWith(dir)) return send(res, 403, 'outside the control plane', 'text/plain; charset=utf-8');
  if (!existsSync(file) || !statSync(file).isFile()) return send(res, 404, 'not found', 'text/plain; charset=utf-8');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  return createReadStream(file).pipe(res);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, HOST, () => {
    console.log(`Review server on http://${HOST}:${PORT}/ (bound to ${HOST} only)`);
    console.log(`  the site with feedback:   http://${HOST}:${PORT}/site/`);
    console.log(`  the design control plane: http://${HOST}:${PORT}/`);
    console.log('  feedback is appended to docs/design/design-feedback.jsonl and tickets to docs/work-items/');
    console.log('  in the site: Shift+F or the Feedback button toggles feedback; Escape cancels picking a spot');
  });
}
