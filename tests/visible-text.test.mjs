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
    .replace(/\S+\.(?:mjs|js|md|csv|json|txt|pdf|html|sqlite)\b/g, ' ')
    // web addresses shown as link text
    .replace(/\S+\.(?:com|org|net|beer|co|us|io|biz|info|brewing|pub)\b\S*/gi, ' ');
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

function allPages(dir = DIST, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) { if (!['assets', 'data', 'explorer'].includes(e.name)) allPages(p, out); } else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// Text a reader sees, keeping paths so developer copy can be caught; URLs and code are not copy.
function readerText(html) {
  return html
    .replace(/<head>[\s\S]*?<\/head>/i, ' ')
    .replace(/<(script|style|code|pre)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
}
const DEVELOPER_COPY = [/\bdata\//, /\.csv\b/, /\.json\b/, /\.mjs\b/, /\bscripts\//, /\bnpm\s/, /\bingest/i, /\brunbook/i, /\bseed\b/i, /\bheuristic/i, /\badd a row\b/i];

let built = false;
const ensureBuilt = () => { if (!built) { build(); built = true; } };

test('no developer instructions or file paths show on any page', () => {
  ensureBuilt();
  const hits = [];
  for (const f of allPages()) {
    const text = readerText(readFileSync(f, 'utf8'));
    for (const re of DEVELOPER_COPY) {
      const m = text.match(new RegExp(`.{0,40}${re.source}.{0,40}`, re.flags));
      if (m) hits.push(`${f.slice(DIST.length + 1)}: ${m[0].replace(/\s+/g, ' ').trim()}`);
    }
  }
  assert.deepEqual(hits.slice(0, 40), [], `developer copy in visible text (${hits.length}):\n${hits.slice(0, 40).join('\n')}`);
});

test('every filter option label reads as words', async () => {
  ensureBuilt();
  const { FILTERS, optionList } = await import('../site/assets/filter-bar.mjs');
  const rows = JSON.parse(readFileSync(resolve(DIST, 'data/results.json'), 'utf8'));
  const meta = JSON.parse(readFileSync(resolve(DIST, 'data/meta.json'), 'utf8'));
  const allowed = corpus();
  const bad = [];
  for (const def of FILTERS) {
    for (const o of optionList(rows, def.id, { years: 'all' }, meta)) {
      for (const t of o.label.match(TOKEN) ?? []) if (!allowed.has(t)) bad.push(`${def.label}: ${o.label}`);
      if (/^[a-z]/.test(o.label) && def.id !== 'year') bad.push(`${def.label}: ${o.label} (not capitalized)`);
    }
  }
  assert.deepEqual(bad, []);
});

test('no kebab-case slug shows in the visible text of any page', () => {
  ensureBuilt();
  const known = new Set([...DATA_SLUGS, ...Object.keys(STATUS_LABELS).filter((k) => k.includes('-')), ...PROSE_SLUGS]);
  const allowed = corpus();
  const hits = [];
  for (const f of allPages()) {
    const p = f.slice(DIST.length + 1);
    const html = readFileSync(f, 'utf8');
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const text = `${title} ${visibleText(html)}`;
    for (const t of new Set(text.match(TOKEN) ?? [])) {
      if (known.has(t) || !allowed.has(t)) hits.push(`${p}: ${t}`);
    }
  }
  assert.deepEqual(hits, [], `kebab-case tokens in visible text:\n${hits.join('\n')}`);
});
