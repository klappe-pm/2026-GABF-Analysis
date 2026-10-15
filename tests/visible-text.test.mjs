// Scans the visible text of every page of the web/ static export (web/out) for kebab-case slugs. A public
// page shows words, not data keys: a known slug (a value label key, a trend status, a frontmatter key, a
// markdown heading slug) fails anywhere in visible text, and any other hyphenated lowercase token fails
// unless it is authored English found in the research prose or in official names (category, beer, brewery,
// and style names). File paths and URLs are not text and are skipped. Fails when web/out is older than its
// sources or not built (scripts/lib/web-out-fresh.mjs; in continuous integration a missing export skips).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROSE_SLUGS } from '../scripts/lib/site-payload.mjs';
import { ROOT } from '../scripts/lib/paths.mjs';
import { webOutGate } from '../scripts/lib/web-out-fresh.mjs';
import { STATUS_LABELS } from '../site/assets/charts.mjs';
import { DATA_SLUGS } from '../site/assets/filter-bar.mjs';
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs';

const OUT = resolve(ROOT, 'web/out');
// A stale or missing export fails every test below with its reason (a missing one skips in continuous integration).
let stale = null;
let gateSkip = false;
try { gateSkip = webOutGate(); } catch (e) { stale = e; }
const SKIP = stale ? false : gateSkip;
const ensureFresh = () => { if (stale) throw stale; };

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

// The text values of a parsed frontmatter value, without its keys, URLs, or paths.
function leaves(node, out = []) {
  if (typeof node === 'string') out.push(node.replace(/\S*\/\S*/g, ' '));
  else if (Array.isArray(node)) node.forEach((v) => leaves(v, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((v) => leaves(v, out));
  return out.join(' ');
}

function corpus() {
  const allowed = new Set(EXTRA_ALLOWED);
  const add = (text) => { for (const t of String(text).toLowerCase().match(TOKEN) ?? []) allowed.add(t); };
  const md = [...(existsSync(resolve(ROOT, 'breweries')) ? readdirSync(resolve(ROOT, 'breweries')) : []).filter((f) => f.endsWith('.md')).map((f) => resolve(ROOT, 'breweries', f)), ...readdirSync(resolve(ROOT, 'docs/2026/winner')).filter((f) => /^\d{3}-/.test(f)).map((f) => resolve(ROOT, 'docs/2026/winner', f))];
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
  add(readFileSync(resolve(ROOT, 'data/reference/current-beers.csv'), 'utf8').replace(/\S*\/\S*/g, ' '));
  // Hop reference tables and hop research documents are authored English: variety, farm and descriptor names.
  for (const f of readdirSync(resolve(ROOT, 'data/reference')).filter((x) => /^hop-.*\.csv$/.test(x))) add(readFileSync(resolve(ROOT, 'data/reference', f), 'utf8').replace(/\S*\/\S*/g, ' '));
  for (const sub of ['varieties', 'farms']) {
    const dir = resolve(ROOT, 'docs/hops', sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const { data, body } = parseFrontmatter(readFileSync(resolve(dir, f), 'utf8'));
      add(body.split('\n').filter((l) => !/^#/.test(l)).join('\n').replace(/\S*\/\S*/g, ' '));
      add(leaves(data));
    }
  }
  for (const f of readdirSync(resolve(ROOT, 'docs/2026/winner')).filter((x) => /^\d{3}-/.test(x))) {
    const { data } = parseFrontmatter(readFileSync(resolve(ROOT, 'docs/2026/winner', f), 'utf8'));
    for (const k of ['hop-profile', 'description', 'tasting-notes', 'srm', 'og', 'fg', 'water', 'process']) if (data[k]) add(leaves(data[k]));
  }
  return allowed;
}

// The pages of the export, without the style guide, its settings, the build files and the data files: those show
// tokens and keys by design.
const NOT_PAGES = new Set(['_next', 'data', 'design-system', 'design-settings', 'explorer']);
function allPages(dir = OUT, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) { if (!NOT_PAGES.has(e.name)) allPages(p, out); } else if (e.name.endsWith('.html')) out.push(p);
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

const readData = (name) => JSON.parse(readFileSync(resolve(OUT, 'data', name), 'utf8'));

test('no developer instructions or file paths show on any page', { skip: SKIP }, () => {
  ensureFresh();
  const hits = [];
  for (const f of allPages()) {
    const text = readerText(readFileSync(f, 'utf8'));
    // "seed crops" in a farm's published notes is farming, not a seed row.
    const scanned = f.includes('/hop-farms/') ? text.replace(/seed crops/gi, ' ') : text;
    for (const re of DEVELOPER_COPY) {
      const m = scanned.match(new RegExp(`.{0,40}${re.source}.{0,40}`, re.flags));
      if (m) hits.push(`${f.slice(OUT.length + 1)}: ${m[0].replace(/\s+/g, ' ').trim()}`);
    }
  }
  assert.deepEqual(hits.slice(0, 40), [], `developer copy in visible text (${hits.length}):\n${hits.slice(0, 40).join('\n')}`);
});

test('every filter option label reads as words', { skip: SKIP }, async () => {
  ensureFresh();
  const { FILTERS, optionList } = await import('../site/assets/filter-bar.mjs');
  const rows = readData('results.json');
  const meta = readData('meta.json');
  const allowed = corpus();
  const bad = [];
  for (const def of FILTERS) {
    for (const o of optionList(rows, def.id, { years: 'all' }, meta)) {
      for (const t of o.label.match(TOKEN) ?? []) if (!allowed.has(t)) bad.push(`${def.label}: ${o.label}`);
      if (/^[a-z]/.test(o.label) && def.id !== 'year' && def.id !== 'brewery_key') bad.push(`${def.label}: ${o.label} (not capitalized)`);
    }
  }
  assert.deepEqual(bad, []);
});

test('no kebab-case slug shows in the visible text of any page', { skip: SKIP }, () => {
  ensureFresh();
  const known = new Set([...DATA_SLUGS, ...Object.keys(STATUS_LABELS).filter((k) => k.includes('-')), ...PROSE_SLUGS]);
  const allowed = corpus();
  const hits = [];
  for (const f of allPages()) {
    const p = f.slice(OUT.length + 1);
    const html = readFileSync(f, 'utf8');
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    // A sourced note in data/reference/distributors.csv uses "self-distribution" as an English word, and the web
    // brewery page shows the note as written; it is quoted research, not a data key.
    const text = `${title} ${visibleText(html)}`.replace(/usually mean self-distribution under/g, ' ');
    for (const t of new Set(text.match(TOKEN) ?? [])) {
      if (known.has(t) || !allowed.has(t)) hits.push(`${p}: ${t}`);
    }
  }
  assert.deepEqual(hits, [], `kebab-case tokens in visible text:\n${hits.join('\n')}`);
});

// A beer's own published figures reach the medal rows the pages draw from; a missing figure is null and is never
// replaced by the style range.
test('a researched beer carries its own ABV and IBU in the published medal rows', { skip: SKIP }, async () => {
  ensureFresh();
  const { loadWinnerProfiles } = await import('../scripts/lib/winner-profiles.mjs');
  const rows = readData('results.json');
  const withAbv = rows.find((r) => r.year === 2026 && r.beer_profile && r.abv && r.ibu && r.category_slug !== 'mixed-culture-brett-beer');
  assert.ok(withAbv, 'a 2026 row with ABV and IBU');
  const profile = loadWinnerProfiles(2026).find((p) => `beers/2026/${p.stem}/` === withAbv.beer_profile);
  assert.equal(withAbv.abv, profile.fm.abv, 'row ABV is the profile ABV');
  assert.ok(withAbv.abv_source, 'the ABV carries its source link');
  const none = rows.find((r) => r.year === 2026 && r.beer_profile && r.abv === null && r.abv_min);
  assert.ok(none, 'a 2026 row with no ABV in a category that has a style range');
  const dashboards = readFileSync(resolve(ROOT, 'site/assets/dashboards.js'), 'utf8');
  assert.ok(!/\(style\)/.test(dashboards), 'the single file dashboard table never labels a style range as the ABV');
});

// ---------- hops ----------
async function hopModel() {
  const { loadDataset } = await import('../scripts/lib/data-model.mjs');
  return loadDataset().hops;
}

test('the hop pages exist in the export: both indexes, every variety, and every farm', { skip: SKIP }, async () => {
  ensureFresh();
  const hops = await hopModel();
  assert.ok(hops.varieties.length > 0, 'at least one hop variety');
  for (const p of ['hops/index.html', 'hop-farms/index.html']) assert.ok(existsSync(resolve(OUT, p)), p);
  for (const v of hops.varieties) assert.ok(existsSync(resolve(OUT, 'hops', v.slug, 'index.html')), `hops/${v.slug}/`);
  for (const f of hops.farms) assert.ok(existsSync(resolve(OUT, 'hop-farms', f.slug, 'index.html')), `hop-farms/${f.slug}/`);
});

test('every page and the single file dashboard carry the Catalog.beer attribution', { skip: SKIP }, () => {
  ensureFresh();
  const parts = ['Some beer details are from', 'href="https://catalog.beer"', 'href="https://creativecommons.org/licenses/by/4.0/"'];
  const missing = allPages().filter((f) => { const html = readFileSync(f, 'utf8'); return !parts.every((x) => html.includes(x)); }).map((f) => f.slice(OUT.length + 1));
  assert.deepEqual(missing, []);
  const line = /Some beer details are from <a href="https:\/\/catalog\.beer">Catalog\.beer<\/a>, licensed <a href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/">CC BY 4\.0<\/a> and adapted\./;
  assert.match(readFileSync(resolve(ROOT, 'site/standalone/template.html'), 'utf8'), line);
});
