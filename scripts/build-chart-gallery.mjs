#!/usr/bin/env node
// Build the chart gallery: a standalone page at docs/design/chart-gallery/index.html where the
// owner compares alternatives for each dashboard chart. Apache ECharts and every figure are
// inlined, so the page opens from disk. Figures are computed from the loaded dataset; the page
// is deterministic and is not part of the public site build (dist/ is made from site/ only).
//
//   node scripts/build-chart-gallery.mjs, with an optional out flag and path

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { ROOT, SITE, parseArgs } from './lib/paths.mjs';
import { inlineBrandCss } from './brand/build.mjs';
import { galleryData } from './chart-gallery/data.mjs';
import { beerDetailsHtml } from './lib/catalog-attribution.mjs';
import { checkContrast, paletteForPage } from './chart-gallery/palette.mjs';

const require = createRequire(import.meta.url);
const HERE = resolve(ROOT, 'scripts/chart-gallery');
export const GALLERY_PATH = resolve(ROOT, 'docs/design/chart-gallery/index.html');

// Keep document tag names and a closing script tag out of inline script text.
const safeScript = (text) => text.replace(/<\/script/gi, '<\\/script').replace(/<(\/?)(body|head|html)\b/gi, (m, slash, tag) => `<${slash}\\u00${tag.charCodeAt(0).toString(16)}${tag.slice(1)}`);
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');

export function renderGallery() {
  const problems = checkContrast();
  if (problems.length) throw new Error(`Gallery palette fails contrast:\n${problems.join('\n')}`);
  const data = { ...galleryData(), beerDetailsHtml: beerDetailsHtml(), palette: paletteForPage(), geo: JSON.parse(readFileSync(resolve(SITE, 'assets/us-states.geo.json'), 'utf8')) };
  const template = readFileSync(resolve(HERE, 'template.html'), 'utf8');
  const parts = {
    // brand.css (generated from the design settings) defines every color and face the gallery uses.
    '/*__STYLE__*/': `${inlineBrandCss()}\n${readFileSync(resolve(HERE, 'styles.css'), 'utf8')}`,
    '/*__ECHARTS__*/': safeScript(readFileSync(require.resolve('echarts/dist/echarts.min.js'), 'utf8')),
    '/*__DATA__*/': `window.GALLERY = ${safeJson(data)};`,
    '/*__CLIENT__*/': safeScript(readFileSync(resolve(HERE, 'client.js'), 'utf8')),
  };
  let html = template;
  for (const [marker, text] of Object.entries(parts)) html = html.replace(marker, () => text);
  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const out = args.out ? resolve(args.out) : GALLERY_PATH;
  mkdirSync(dirname(out), { recursive: true });
  const html = renderGallery();
  writeFileSync(out, html);
  console.log(`wrote ${out.replace(`${ROOT}/`, '')} (${(html.length / 1024).toFixed(0)} KB)`);
}
