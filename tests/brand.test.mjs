// The brand has one source: .design/design-system/settings.md. These tests fail when a generated brand
// file has drifted from the settings, when a built page carries an old copy of the brand, or when a
// surface sets a color of its own instead of reading brand.css.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brandModel, inlineBrandCss, staleOutputs } from '../scripts/brand/build.mjs';
import { rawColorProblems } from '../scripts/design-system/lib.mjs';
import { ROOT } from '../scripts/lib/paths.mjs';

const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

test('brand.css, brand.json, fonts.css, and the README banners match settings.md', async () => {
  assert.deepEqual(await staleOutputs(), [], 'run npm run brand and commit the outputs');
});

test('the primary is the owner\'s exact accent and every page is white', async () => {
  const m = await brandModel();
  assert.equal(m.scheme.primary, '#2d6a4f');
  assert.equal(m.scheme.background, '#ffffff');
  assert.equal(m.scheme.surface, '#ffffff');
  assert.equal(m.series.length, 5);
  assert.equal(m.series[0], m.scheme.primary, 'the first chart series is the brand green');
});

test('the chart series are distinct hues that pass contrast and color vision checks', async () => {
  const m = await brandModel();
  assert.equal(new Set(m.series).size, 5);
  for (const ratio of m.seriesContrast) assert.ok(ratio >= 3, `series contrast ${ratio} is under 3 to 1`);
  for (const c of m.series) assert.ok(!Object.values(m.medal).includes(c), `${c} repeats a medal color`);
  const visions = new Set(m.seriesSeparation.map((r) => r.vision));
  assert.deepEqual([...visions].sort(), ['deuteranopia', 'full color', 'protanopia']);
  for (const r of m.seriesSeparation) assert.ok(r.pass, `series ${r.a} and ${r.b} under ${r.vision}: ${r.delta}`);
});

test('the fonts are self hosted with their licenses, and every page loads them', () => {
  for (const f of ['public-sans-latin-wght-normal.woff2', 'public-sans-latin-ext-wght-normal.woff2', 'public-sans-latin-wght-italic.woff2', 'archivo-narrow-latin-wght-normal.woff2']) {
    assert.ok(readFileSync(resolve(ROOT, 'site/assets/fonts', f)).length > 1000, f);
  }
  for (const f of ['public-sans-ofl.txt', 'archivo-narrow-ofl.txt']) assert.match(read(`site/assets/fonts/${f}`), /SIL Open Font License, Version 1\.1/);
  assert.match(read('site/assets/fonts.css'), /font-display: swap/);
  assert.match(read('scripts/build-site.mjs'), /assets\/fonts\.css/);
  assert.match(read('site/assets/styles.css'), /font-family: var\(--brand-font-plain\)/);
});

// These pages are build outputs (npm run generate, which npm test runs first), not files in git.
test('every generated single file page carries the current brand.css and fonts', () => {
  const brand = inlineBrandCss();
  for (const page of ['gabf-dashboard.html', 'docs/design/chart-gallery/index.html']) {
    assert.ok(read(page).includes(brand), `${page} has an old copy of brand.css or the fonts; rebuild it`);
  }
});

// Surfaces that must take every color from brand.css or brand.json. The generator
// (scripts/brand/) and its outputs are the only places a brand hex value is written; the README
// banners are generator output and are covered by the first test.
const SURFACES = [
  ...readdirSync(resolve(ROOT, 'site/assets'))
    .filter((f) => /\.(css|mjs|js)$/.test(f) && f !== 'brand.css')
    .map((f) => `site/assets/${f}`),
  'site/standalone/template.html',
  'scripts/build-site.mjs',
  'scripts/build-standalone.mjs',
  'scripts/build-chart-gallery.mjs',
  ...readdirSync(resolve(ROOT, 'scripts/chart-gallery')).map((f) => `scripts/chart-gallery/${f}`),
  'scripts/brand/social-card.html',
];

// Text that is data, not styling, and may contain anything.
const stripData = (text) => text.replace(/<script type="application\/json" id="dataset">[\s\S]*?<\/script>/, '');
const namedColors = (text) => [...text.matchAll(/[:\s](white|black)\s*[;}!]/g)].map((m) => `named color ${m[1]}`);

test('no surface hard-codes a color', () => {
  const problems = [];
  for (const file of SURFACES) {
    const text = stripData(read(file));
    for (const p of [...rawColorProblems(text), ...namedColors(text)]) problems.push(`${file}: ${p}`);
  }
  assert.deepEqual(problems, []);
});
