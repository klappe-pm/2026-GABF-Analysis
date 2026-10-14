// Builds the site and scans the visible text of a sample of pages for kebab-case slugs. A public
// page shows words, not data keys: a known slug (a value label key, a trend status, a frontmatter
// key, a markdown heading slug) fails anywhere in visible text, and any other hyphenated lowercase
// token fails unless it is authored English found in the research prose or in official names
// (category, beer, brewery, and style names). File paths and URLs are not text and are skipped.
// This is the only test file that runs the full build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
      if (/^[a-z]/.test(o.label) && def.id !== 'year' && def.id !== 'brewery_key') bad.push(`${def.label}: ${o.label} (not capitalized)`);
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

// A beer's own published figures reach the shared medal tables; a missing figure reads "Not defined"
// and is never replaced by the style range.
function rowFor(html, href) {
  const at = html.indexOf(`href="../../${href}"`);
  assert.ok(at > -1, `no link to ${href}`);
  const start = html.lastIndexOf('<tr>', at);
  return html.slice(start, html.indexOf('</tr>', at));
}
const cell = (row, label) => row.match(new RegExp(`data-label="${label}"[^>]*>([\\s\\S]*?)</td>`))?.[1] ?? '';

test('a researched beer shows its own ABV and IBU on its brewery and category pages', async () => {
  ensureBuilt();
  const { loadWinnerProfiles } = await import('../scripts/lib/winner-profiles.mjs');
  const rows = JSON.parse(readFileSync(resolve(DIST, 'data/results.json'), 'utf8'));
  const withAbv = rows.find((r) => r.year === 2026 && r.beer_profile && r.abv && r.ibu && r.category_slug !== 'mixed-culture-brett-beer');
  assert.ok(withAbv, 'a 2026 row with ABV and IBU');
  const profile = loadWinnerProfiles(2026).find((p) => `beers/2026/${p.stem}/` === withAbv.beer_profile);
  assert.equal(withAbv.abv, profile.fm.abv, 'row ABV is the profile ABV');
  assert.ok(withAbv.abv_source, 'the ABV carries its source link');
  const abvText = `${Number(profile.fm.abv).toFixed(1).replace(/\.0$/, '')}%`;
  for (const page of [`breweries/${withAbv.brewery_slug}`, `categories/${withAbv.category_slug}`]) {
    const row = rowFor(readFileSync(resolve(DIST, page, 'index.html'), 'utf8'), withAbv.beer_profile);
    assert.equal(cell(row, 'ABV').trim(), abvText, `${page} ABV`);
    assert.equal(cell(row, 'IBU').trim(), String(profile.fm.ibu), `${page} IBU`);
    assert.match(cell(row, 'Beer profile'), /Full profile/);
  }
});

test('a beer without a published ABV shows Not defined and never a style range', () => {
  ensureBuilt();
  const rows = JSON.parse(readFileSync(resolve(DIST, 'data/results.json'), 'utf8'));
  const none = rows.find((r) => r.year === 2026 && r.beer_profile && r.abv === null && r.abv_min && r.category_slug !== 'mixed-culture-brett-beer' && r.category_slug !== 'no-low-tannin-cider');
  assert.ok(none, 'a 2026 row with no ABV in a category that has a style range');
  const range = `${none.abv_min} to ${none.abv_max}`;
  for (const page of [`breweries/${none.brewery_slug}`, `categories/${none.category_slug}`, 'first-time-medalists/2026']) {
    const html = readFileSync(resolve(DIST, page, 'index.html'), 'utf8');
    if (!html.includes(`href="../../${none.beer_profile}"`)) continue;
    const row = rowFor(html, none.beer_profile);
    assert.match(cell(row, 'ABV'), /Not defined/, `${page} ABV`);
    assert.ok(!row.includes(range) && !/\(style\)/.test(row), `${page} shows no style range`);
  }
  const dashboards = readFileSync(resolve(ROOT, 'site/assets/dashboards.js'), 'utf8');
  assert.ok(!/\(style\)/.test(dashboards), 'the dashboards table no longer labels a style range as the ABV');
});

test('the first time medalists page shows ABV and IBU', () => {
  ensureBuilt();
  const html = readFileSync(resolve(DIST, 'first-time-medalists/2026/index.html'), 'utf8');
  assert.ok((html.match(/data-label="ABV"[^>]*>\d/g) ?? []).length > 20, 'ABV values appear');
  assert.match(html, /<th scope="col" class="num">IBU<\/th>/);
});

// ---------- hops ----------
async function hopModel() {
  const { loadDataset } = await import('../scripts/lib/data-model.mjs');
  return loadDataset().hops;
}

test('the hop pages exist in the build: both indexes, every variety, every farm, and the nav entries', async () => {
  ensureBuilt();
  const hops = await hopModel();
  assert.ok(hops.varieties.length > 0, 'at least one hop variety');
  for (const p of ['hops/index.html', 'hop-farms/index.html']) assert.ok(existsSync(resolve(DIST, p)), p);
  for (const v of hops.varieties) assert.ok(existsSync(resolve(DIST, 'hops', v.slug, 'index.html')), `hops/${v.slug}/`);
  for (const f of hops.farms) assert.ok(existsSync(resolve(DIST, 'hop-farms', f.slug, 'index.html')), `hop-farms/${f.slug}/`);
  const home = readFileSync(resolve(DIST, 'index.html'), 'utf8');
  assert.match(home, /href="\.\/hops\/"/);
  assert.match(home, /href="\.\/hop-farms\/"/);
});

test('every variety page lists every 2026 beer that uses it, and every beer page links its varieties', async () => {
  ensureBuilt();
  const hops = await hopModel();
  for (const v of hops.varieties) {
    const html = readFileSync(resolve(DIST, 'hops', v.slug, 'index.html'), 'utf8');
    for (const [stem] of v.usages) assert.ok(html.includes(`href="../../beers/2026/${stem}/"`), `${v.name} lists ${stem}`);
  }
  for (const b of hops.beers.values()) {
    const html = readFileSync(resolve(DIST, 'beers', '2026', b.stem, 'index.html'), 'utf8');
    for (const u of b.usage) assert.ok(html.includes(`href="../../../hops/${u.slug}/"`), `${b.stem} links ${u.slug}`);
  }
});

test('the hops index, winners page, category pages, and brewery pages link hops', async () => {
  ensureBuilt();
  const hops = await hopModel();
  const index = readFileSync(resolve(DIST, 'hops/index.html'), 'utf8');
  for (const v of hops.varieties) assert.ok(index.includes(`href="../hops/${v.slug}/"`), `index links ${v.slug}`);
  assert.match(index, /<table class="data-table sortable">/);
  const winners = readFileSync(resolve(DIST, 'beers/2026/index.html'), 'utf8');
  assert.match(winners, /href="\.\.\/\.\.\/hops\/[a-z0-9-]+\/"/);
  const rows = JSON.parse(readFileSync(resolve(DIST, 'data/results.json'), 'utf8'));
  const row = rows.find((r) => r.year === 2026 && r.hop_varieties?.length);
  assert.ok(row, 'a 2026 row with hops');
  const cat = readFileSync(resolve(DIST, 'categories', row.category_slug, 'index.html'), 'utf8');
  assert.match(cat, /href="\.\.\/\.\.\/hops\/[a-z0-9-]+\/"/);
  const brewery = readFileSync(resolve(DIST, 'breweries', row.brewery_slug, 'index.html'), 'utf8');
  assert.match(brewery, /href="\.\.\/\.\.\/hops\/[a-z0-9-]+\/"/);
});
