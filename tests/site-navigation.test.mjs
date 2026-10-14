import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { activeItem, moreDestinations, primaryDestinations } from '../web/app/(site)/shell/destinations.mjs';

// The site's destinations and the one each page highlights. The paths come from web/lib/href.ts, which
// Node 22 reads with its own type stripping.
const { paths } = await import('../web/lib/href.ts');
const nav = primaryDestinations(paths, 2026);
const all = [...nav, ...moreDestinations(paths)];

test('the destinations follow layout.md "Site navigation" and each has a label in the copy', () => {
  const layout = readFileSync(resolve(ROOT, '.design', 'design-system', 'layout.md'), 'utf8');
  const listed = layout.slice(layout.indexOf('Site navigation:'), layout.indexOf('Components:')).split('\n').filter((l) => l.startsWith('  - ')).map((l) => l.slice(4));
  assert.deepEqual(nav.map((d) => d.id), listed);
  const copy = readFileSync(resolve(ROOT, '.docs', 'content-management-system', 'global', 'navigation.md'), 'utf8');
  for (const d of all) assert.match(copy, new RegExp(`^- \`${d.copy}\`: \\S`, 'm'), d.copy);
});

test('home, overview, analysis, method, and saved views have their addresses', () => {
  assert.equal(paths.home, '/');
  assert.equal(paths.overview, '/overview/');
  assert.equal(paths.analysis, '/analysis/');
  assert.equal(paths.analysisReport('trends'), '/analysis/trends/');
  assert.equal(paths.method, '/method/');
  assert.equal(paths.saved, '/saved/');
  const byId = Object.fromEntries(all.map((d) => [d.id, d.path]));
  assert.equal(byId.home, '/');
  assert.equal(byId.results, '/overview/');
  assert.equal(byId.analysis, '/analysis/');
  assert.equal(byId['saved-views'], '/saved/');
});

test('each section highlights its own destination', () => {
  const cases = {
    '/': 'home',
    '/overview/': 'results',
    '/dashboards/': 'results',
    '/dashboards/geography/': 'results',
    '/categories/': 'results',
    '/breweries/': 'breweries',
    '/breweries/some-brewery/': 'breweries',
    '/first-time-medalists/2026/': 'breweries',
    '/beers/2026/': 'beers',
    '/beers/2026/some-beer/': 'beers',
    '/hops/': 'hops',
    '/hops/citra/': 'hops',
    '/hop-farms/': 'hop-farms',
    '/hop-farms/some-farm/': 'hop-farms',
    '/analysis/': 'analysis',
    '/analysis/explore/': 'analysis',
    '/reports/': 'analysis',
    '/explorer/': 'analysis',
  };
  for (const [path, id] of Object.entries(cases)) assert.equal(activeItem(nav, path), id, path);
  // The drawer adds Saved views; a page in no section highlights nothing.
  assert.equal(activeItem(all, '/saved/'), 'saved-views');
  assert.equal(activeItem(nav, '/saved/'), undefined);
  assert.equal(activeItem(nav, '/design-system/'), undefined);
});

test('the footer links Method and Saved views through href()', () => {
  const src = readFileSync(resolve(ROOT, 'web', 'app', 'layout.tsx'), 'utf8');
  assert.match(src, /href=\{href\(paths\.method\)\}[^\n]*global\.navigation\.footer\.method/);
  assert.match(src, /href=\{href\(paths\.saved\)\}[^\n]*global\.navigation\.footer\.saved_views/);
});

test('the compact tabs scroll sideways inside their own row and keep each label on one line', () => {
  const src = readFileSync(resolve(ROOT, 'web', 'app', '(site)', 'shell', 'SiteShell.tsx'), 'utf8');
  assert.match(src, /<ul ref=\{row\} className="flex overflow-x-auto/);
  assert.match(src, /<li key=\{item\.id\} className="shrink-0">/);
  assert.match(src, /whitespace-nowrap/);
});
