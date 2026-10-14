// Builds the site and scans the visible text of a sample of pages for kebab-case slugs. A public
// page shows words, not data keys: a known slug (a value label key, a trend status, a frontmatter
// key, a markdown heading slug) fails anywhere in visible text, and any other hyphenated lowercase
// token fails unless it is authored English found in the research prose or in official names
// (category, beer, brewery, and style names). File paths and URLs are not text and are skipped.
// This is the only test file that runs the full build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, PROSE_SLUGS } from '../scripts/build-site.mjs';
import { DIST, ROOT } from '../scripts/lib/paths.mjs';
import { STATUS_LABELS } from '../site/assets/charts.mjs';
import { DATA_SLUGS } from '../site/assets/filter-bar.mjs';
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs';

const TOKEN = /(?<![A-Za-z0-9-])[a-z][a-z0-9]*(?:-[a-z0-9]+)+(?![A-Za-z0-9-])/g;
// Names that are hyphenated by their owners rather than slugs.
const EXTRA_ALLOWED = new Set(['us-atlas']);

export function visibleText(html) {
  return html
    .replace(/<head>[\s\S]*?<\/head>/i, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    // file paths, URLs, and file names are not prose
    .replace(/\S*[\/\\]\S*/g, ' ')
    .replace(/\S+\.(?:mjs|js|md|csv|json|txt|pdf|html|sqlite)\b/g, ' ');
}

function corpus() {
  const allowed = new Set(EXTRA_ALLOWED);
  const add = (text) => { for (const t of String(text).toLowerCase().match(TOKEN) ?? []) allowed.add(t); };
  const md = [...readdirSync(resolve(ROOT, 'breweries')).filter((f) => f.endsWith('.md')).map((f) => resolve(ROOT, 'breweries', f)), ...readdirSync(resolve(ROOT, 'docs/2026/winner')).filter((f) => /^\d{3}-/.test(f)).map((f) => resolve(ROOT, 'docs/2026/winner', f))];
  for (const f of md) {
    const { data, body } = parseFrontmatter(readFileSync(f, 'utf8'));
    add(body.split('\n').filter((l) => !/^#/.test(l)).join('\n').replace(/\S*\/\S*/g, ' '));
    for (const k of ['beer', 'brewery', 'style', 'category-name']) if (data[k]) add(data[k]);
    for (const k of ['hops', 'malts', 'yeast', 'adjuncts']) for (const v of data[k] ?? []) add(v);
  }
  for (const f of readdirSync(resolve(ROOT, 'data/results')).filter((x) => x.endsWith('.csv'))) add(readFileSync(resolve(ROOT, 'data/results', f), 'utf8').replace(/\S*\/\S*/g, ' '));
  add(readFileSync(resolve(ROOT, 'data/reference/categories.csv'), 'utf8').replace(/\S*\/\S*/g, ' '));
  add(readFileSync(resolve(ROOT, 'data/reference/ownership.csv'), 'utf8').replace(/\S*\/\S*/g, ' '));
  add(readFileSync(resolve(ROOT, 'data/reference/distributors.csv'), 'utf8').replace(/\S*\/\S*/g, ' '));
  return allowed;
}

test('no kebab-case slug shows in the visible text of sampled pages', () => {
  build();
  const known = new Set([...DATA_SLUGS, ...Object.keys(STATUS_LABELS).filter((k) => k.includes('-')), ...PROSE_SLUGS]);
  const allowed = corpus();
  const winner = readdirSync(resolve(DIST, 'beers/2026')).filter((d) => /^\d{3}-/.test(d));
  const pages = [
    'index.html', 'dashboards/geography/index.html', 'dashboards/categories/index.html', 'dashboards/breweries/index.html', 'dashboards/economics/index.html',
    'breweries/index.html', 'breweries/green-cheek-beer-co/index.html', 'categories/index.html', 'categories/american-amber-lager/index.html',
    'reports/index.html', ...readdirSync(resolve(DIST, 'reports')).filter((d) => !d.endsWith('.html')).map((d) => `reports/${d}/index.html`),
    'beers/2026/index.html', `beers/2026/${winner[0]}/index.html`, `beers/2026/${winner[winner.length - 1]}/index.html`, 'beers/2026/006-chili-beer-2-hop-dogma-brewing-co-pyros-prost/index.html',
    'first-time-medalists/2026/index.html', 'about/index.html',
  ];
  const hits = [];
  for (const p of pages) {
    const html = readFileSync(resolve(DIST, p), 'utf8');
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const text = `${title} ${visibleText(html)}`;
    for (const t of new Set(text.match(TOKEN) ?? [])) {
      if (known.has(t) || !allowed.has(t)) hits.push(`${p}: ${t}`);
    }
  }
  assert.deepEqual(hits, [], `kebab-case tokens in visible text:\n${hits.join('\n')}`);
});
