#!/usr/bin/env node
// Build the single-file dashboard: gabf-dashboard.html at the repository root.
//
// Everything the dashboards need is inlined (Apache ECharts, the US map, every medal row,
// per-brewery profile cards and deep dives, styles, and the bundled app), so the file opens
// from disk by double-click with no server and no network. The content is deterministic:
// rebuilding without a data change produces a byte-identical file.
//
//   node scripts/build-standalone.mjs [--out path/to/file.html]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { build as bundle, transform } from 'esbuild';
import { ROOT, SITE, parseArgs } from './lib/paths.mjs';
import { categoryIndex, loadDataset } from './lib/data-model.mjs';
import { buildGeo } from './build-geo.mjs';
import { aboutHtml, buildPayload, profileCard, renderMarkdownBody } from './build-site.mjs';
import { esc, humanizeHeadings, tableHtml } from '../site/assets/charts.mjs';
import { noteFor } from '../site/assets/page-views.mjs';

const require = createRequire(import.meta.url);
const fmt = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-US'));
const medalDot = (m) => `<span class="badge-medal ${String(m).toLowerCase()}"></span>${esc(m)}`;

// "</script" inside an inline script would end it early; the backslash keeps the text identical to the JS engine.
// Document tag names inside string literals (ECharts writes "<body" into a popup window) are spelled with a
// unicode escape so the page never contains a literal body, head, or html tag outside its real markup.
const hideTag = (m, slash, tag) => `<${slash}\\u00${tag.charCodeAt(0).toString(16)}${tag.slice(1)}`;
const safeScript = (text) => text.replace(/<\/script/gi, '<\\/script').replace(/<(\/?)(body|head|html)\b/gi, hideTag);
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');

function medalTable(rows, { showCompetition = false } = {}) {
  const cols = [{ key: 'year', label: 'Year', numeric: true }];
  if (showCompetition) cols.push({ key: 'competition', label: 'Competition' });
  cols.push(
    { key: 'medal', label: 'Medal', render: (x) => medalDot(x.medal) },
    { key: 'beer_name', label: 'Beer' },
    { key: 'brewery_location', label: 'Location credited', render: (x) => esc(x.brewery_location || x.city) },
    { key: 'city', label: 'City', render: (x) => `${esc(x.city)}, ${esc(x.state)}` },
    { key: 'category_name', label: 'Category', render: (x) => `${esc(x.category_name)}${x.special ? ' <span class="pill">special</span>' : ''}` },
    { key: 'entries', label: 'Entrants', numeric: true, render: (x) => (x.entries ? fmt(x.entries) : '') },
    { key: 'notes', label: 'Notes', render: (x) => `<span class="small muted">${esc(noteFor(x))}</span>` },
  );
  return `<div class="table-wrap">${tableHtml(cols, rows)}</div>`;
}

export function breweryDetailHtml(b) {
  const partial = b.medals.some((m) => m.partial);
  const history = b.medals.length
    ? medalTable([...b.medals].sort((x, y) => y.year - x.year || x.medal_rank - y.medal_rank))
    : '<p class="muted">No GABF medals in the loaded data.</p>';
  const other = b.other_medals.length ? `<h2>other-competitions</h2>${medalTable([...b.other_medals].sort((x, y) => y.year - x.year), { showCompetition: true })}` : '';
  const deep = b.profile
    ? `<section class="prose">${renderMarkdownBody(b.profile.body)}</section>`
    : '<div class="notice">No deep dive has been written for this brewery yet.</div>';
  const card = profileCard(b).replace(/\.\.\/\.\.\/about\/#estimates/g, '#tab=about');
  return humanizeHeadings(`${partial ? '<div class="notice">Some of this brewery\'s medals are in partial years, which hold only a sample of medals from secondary sources.</div>' : ''}<div class="hero"><div><h2>gabf-medal-history</h2>${history}${other}<h2>deep-dive</h2>${deep}</div>${card}</div>`);
}

function coveragePills(ds) {
  return `<div class="coverage">${ds.years.map((y) => `<a class="pill ${ds.coverage[y]}" href="#year=${y}" title="${esc(ds.coverage[y])}">${y} · ${ds.coverage[y]}</a>`).join('')}</div>`;
}

const LEDE = {
  file: 'Every medal on file with linked filters. The Filters button scopes every panel and table on every tab, charts respond to clicks (a year column, a state, a style family, a category), each chart saves as a PNG from its toolbox, and the filters live in the address bar so a view can be bookmarked. This is a single file: no server, no internet needed.',
  hosted: 'Every medal on file with linked filters. The Filters button scopes every panel and table on every tab, charts respond to clicks (a year column, a state, a style family, a category), and each chart saves as a PNG from its toolbox. All data is embedded in this page.',
};

const ABOUT_NOTICE = {
  file: 'This is the single file dashboard: all data is embedded in this file as of its last update, so it works offline and nothing leaves your machine.',
  hosted: 'This is a hosted copy of the single file dashboard: all data is embedded in this page as of its last update, and the page makes no network requests.',
};

// A hosted page is content only: the host supplies the document, head, and body, so the output
// starts with the title and the style block and carries no doctype, html, head, or body tags.
export function toHostedHtml(html) {
  const title = html.match(/<title>[^<]*<\/title>/)?.[0];
  const style = html.match(/<style>[\s\S]*?<\/style>/)?.[0];
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1];
  if (!title || !style || !body) throw new Error('template is missing its title, style block, or body');
  return `${title}\n${style}\n${body.trim()}\n`;
}

export async function buildStandalone({ out = resolve(ROOT, 'gabf-dashboard.html'), hostedOut = null } = {}) {
  const ds = loadDataset();
  const cats = categoryIndex(ds);
  const geoPath = resolve(SITE, 'assets', 'us-states.geo.json');
  if (!existsSync(geoPath)) buildGeo();

  const { results, meta, breweries } = buildPayload(ds, cats);
  const breweryHtml = Object.fromEntries(ds.breweries.map((b) => [b.key, breweryDetailHtml(b)]));
  const defaultBrewery = ds.breweries.find((b) => b.profile)?.key ?? ds.breweries[0]?.key ?? '';

  const app = await bundle({ entryPoints: [resolve(SITE, 'assets', 'dashboards.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none' });
  const init = (await transform(`${readFileSync(resolve(SITE, 'assets', 'echarts-init.js'), 'utf8')}\n${readFileSync(resolve(SITE, 'assets', 'page.js'), 'utf8')}`, { minify: true, target: 'es2020' })).code;
  const styles = readFileSync(resolve(SITE, 'assets', 'styles.css'), 'utf8');
  const echarts = readFileSync(require.resolve('echarts/dist/echarts.min.js'), 'utf8');
  const geo = readFileSync(geoPath, 'utf8').trim();

  const latest = ds.years.filter((y) => ds.coverage[y] !== 'pending').slice(-1)[0];
  const buildNote = `from ${results.length} medal rows across ${ds.years.length} years (latest loaded: ${latest}) and ${ds.breweries.length} breweries`;
  const template = readFileSync(resolve(SITE, 'standalone', 'template.html'), 'utf8');
  const fill = (flavor) => humanizeHeadings(template)
    .replace('/*__STYLES__*/', () => styles)
    .replace('__DEFAULT_BREWERY__', () => esc(defaultBrewery))
    .replace('__LEDE__', () => LEDE[flavor])
    .replace('__COVERAGE__', () => coveragePills(ds))
    .replace('__ABOUT__', () => humanizeHeadings(`<div class="notice">${ABOUT_NOTICE[flavor]}</div>${aboutHtml(ds)}`))
    .replace('__BUILD_NOTE__', () => esc(buildNote))
    .replace('/*__ECHARTS__*/', () => safeScript(echarts))
    .replace('__GEO__', () => safeJson(JSON.parse(geo)))
    .replace('__DATA__', () => safeJson({ results, meta, breweries, brewery_html: breweryHtml }))
    .replace('/*__INIT__*/', () => safeScript(init))
    .replace('/*__APP__*/', () => safeScript(app.outputFiles[0].text));

  const html = fill('file');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  const result = { out, bytes: Buffer.byteLength(html), rows: results.length, breweries: ds.breweries.length, years: ds.years };
  if (hostedOut) {
    const hosted = toHostedHtml(fill('hosted'));
    mkdirSync(dirname(hostedOut), { recursive: true });
    writeFileSync(hostedOut, hosted);
    result.hostedOut = hostedOut;
    result.hostedBytes = Buffer.byteLength(hosted);
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  buildStandalone({ out: args.out ? resolve(args.out) : undefined, hostedOut: args.hosted ? resolve(args.hosted) : null })
    .then((r) => {
      console.log(`wrote ${r.out} (${(r.bytes / 1024 / 1024).toFixed(2)} MB): ${r.rows} medal rows, ${r.breweries} breweries, years ${r.years.join(', ')}`);
      if (r.hostedOut) console.log(`wrote ${r.hostedOut} (${(r.hostedBytes / 1024 / 1024).toFixed(2)} MB): hosted copy`);
    })
    .catch((err) => { console.error(err); process.exit(1); });
}
