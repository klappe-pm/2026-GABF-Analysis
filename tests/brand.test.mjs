// The brand has one source: .design/design-system/settings.md. These tests fail when a generated brand
// file has drifted from the settings, when a built page carries an old copy of the brand, or when a
// surface sets a color of its own instead of reading brand.css.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BRAND_CSS, brandModel, staleOutputs } from '../scripts/brand/build.mjs';
import { rawColorProblems } from '../scripts/design-system/lib.mjs';
import { ROOT } from '../scripts/lib/paths.mjs';

const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

test('brand.css, brand.json, and the README banners match settings.md', async () => {
  assert.deepEqual(await staleOutputs(), [], 'run npm run brand and commit the outputs');
});

test('the primary is the owner\'s exact accent and every page is white', async () => {
  const m = await brandModel();
  assert.equal(m.scheme.primary, '#2d6a4f');
  assert.equal(m.scheme.background, '#ffffff');
  assert.equal(m.scheme.surface, '#ffffff');
  assert.equal(m.series.length, 5);
  assert.equal(m.series[0], m.scheme.primary, 'the first chart series is the primary');
});

// These pages are build outputs (npm run generate, which npm test runs first), not files in git.
test('every generated single file page carries the current brand.css', () => {
  const brand = readFileSync(BRAND_CSS, 'utf8');
  for (const page of ['gabf-dashboard.html', 'gabf-explorer.html', 'docs/design/chart-gallery/index.html']) {
    assert.ok(read(page).includes(brand), `${page} has an old copy of brand.css; rebuild it`);
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
  'site/explorer/gabf-explorer-prototype.html',
  'scripts/build-site.mjs',
  'scripts/build-standalone.mjs',
  'scripts/build-explorer.mjs',
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
