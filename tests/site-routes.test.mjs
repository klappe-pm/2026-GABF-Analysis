import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';

// Routing parity: every address the static site publishes has a route in the Material app (web/app), a
// documented redirect, or a place in PENDING while its lane ports it. The addresses come from the route
// table in docs/site-port-plan.md and, when a static build is present, from every page and data file in dist/.
// When a lane lands a route, its PENDING line must go: the test fails while a pending address is routed.

const PENDING = [
];

// Old address to new address, each with its meta refresh page in the app (docs/site-port-plan.md, routing-parity).
const REDIRECTS = { '/reports/': '/analysis/', '/reports/<report>/': '/analysis/<report>/', '/explorer/': '/analysis/explore/' };

// Routes that exist only as a placeholder for a pending lane.
const PLACEHOLDERS = new Set();

const APP = resolve(ROOT, 'web', 'app');
const segs = (path) => path.split('/').filter(Boolean);

// Every route the app builds, as segment lists: (group) folders drop out, [param] matches any one segment.
function appRoutes(dir = APP, at = []) {
  const out = [];
  const names = readdirSync(dir);
  if (names.some((n) => /^(page|route)\.(tsx|ts|jsx|js)$/.test(n))) out.push(at);
  for (const n of names) {
    const full = resolve(dir, n);
    if (!statSync(full).isDirectory() || n === 'node_modules') continue;
    out.push(...appRoutes(full, /^\(.*\)$/.test(n) ? at : [...at, n]));
  }
  return out;
}
const ROUTES = appRoutes();
const isParam = (s) => /^\[.+\]$/.test(s) || /^<.+>$/.test(s);
const segMatch = (want, have) => want === have || isParam(want) || isParam(have);
const matches = (pattern, path) => { const a = segs(pattern); const b = segs(path); return a.length === b.length && a.every((s, i) => segMatch(s, b[i])); };
const routed = (path) => ROUTES.some((r) => matches(`/${r.join('/')}`, path));
const pending = (path) => PENDING.some((p) => matches(p, path));
const redirected = (path) => Object.hasOwn(REDIRECTS, path);

// The current path column of the plan's inventory table, with "<name>" for one segment of a detail page.
function planPaths() {
  const text = readFileSync(resolve(ROOT, 'docs', 'site-port-plan.md'), 'utf8');
  const section = text.slice(text.indexOf('## inventory'), text.indexOf('## lanes'));
  const out = [];
  for (const line of section.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| page') && !l.startsWith('|---'))) {
    let dir = '/';
    for (const part of line.split('|')[2].split(',').map((s) => s.trim()).filter(Boolean)) {
      const path = part.startsWith('/') ? part : `${dir}${part}`;
      dir = path.slice(0, path.lastIndexOf('/') + 1);
      out.push(path);
    }
  }
  return out;
}

// Every page and data file of the static build, when one is present.
function distPaths() {
  const dist = resolve(ROOT, 'dist');
  if (!existsSync(dist)) return [];
  const out = [];
  const walk = (dir) => {
    for (const n of readdirSync(dir)) {
      const full = resolve(dir, n);
      const rel = relative(dist, full).split('\\').join('/');
      if (statSync(full).isDirectory()) { if (rel !== 'assets') walk(full); continue; }
      if (n === 'index.html') out.push(`/${rel.slice(0, -'index.html'.length)}`);
      else if (rel.startsWith('data/')) out.push(`/${rel}`);
    }
  };
  walk(dist);
  return out;
}

test('the plan lists the addresses of every section of the static site', () => {
  const paths = planPaths();
  assert.ok(paths.length >= 25, `${paths.length} addresses in the plan`);
  for (const p of ['/', '/beers/2026/', '/beers/2026/<beer>/', '/breweries/<brewery>/', '/categories/<category>/', '/hops/<variety>/', '/hop-farms/<farm>/', '/reports/<report>/', '/about/', '/explorer/', '/data/results.json']) assert.ok(paths.includes(p), p);
});

test('every current address has a route, a redirect, or a pending lane', () => {
  const missing = [...new Set([...planPaths(), ...distPaths()])].filter((p) => !routed(p) && !redirected(p) && !pending(p));
  assert.deepEqual(missing, [], 'addresses with no route in web/app and no pending lane');
});

test('a ported address leaves the pending list', () => {
  const stale = PENDING.filter((p) => routed(p) && !PLACEHOLDERS.has(p));
  assert.deepEqual(stale, [], 'routed in web/app: remove these from PENDING');
});

// The Method and Saved views pages are in no inventory row: the static site never built them.
test('the method and saved views pages are routed', () => {
  for (const p of ['/method/', '/saved/']) assert.ok(routed(p), p);
});

test('the reference port is routed', () => {
  for (const p of ['/beers/2026/', '/beers/2026/<beer>/', '/data/results.json', '/data/meta.json', '/design-system/']) assert.ok(routed(p), p);
});

test('a moved address is routed to a redirect page and its new address is routed', () => {
  for (const [from, to] of Object.entries(REDIRECTS)) {
    assert.ok(routed(from), `${from} keeps a page that forwards to ${to}`);
    assert.ok(routed(to), `${to} is routed`);
  }
  const moved = readFileSync(resolve(APP, '(site)', 'analysis', 'parts', 'moved.tsx'), 'utf8');
  assert.match(moved, /httpEquiv="refresh"/, 'a meta refresh to the new address');
  assert.match(moved, /alternates: \{ canonical: canonical\(to\) \}/, 'a canonical link to the new address');
  assert.match(moved, /robots: \{ index: false/, 'marked noindex');
  assert.match(moved, /<TextLink href=\{href\(to\)\}>/, 'a plain link for readers whose browsers do not follow the refresh');
});
