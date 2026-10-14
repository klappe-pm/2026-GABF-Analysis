import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { GALLERY_PATH, renderGallery } from '../scripts/build-chart-gallery.mjs';
import { galleryData } from '../scripts/chart-gallery/data.mjs';
import { checkContrast } from '../scripts/chart-gallery/palette.mjs';
import { GALLERY_SOURCES, checkGallerySource } from '../scripts/check-prose.mjs';
import { loadDataset } from '../scripts/lib/data-model.mjs';
import { ROOT } from '../scripts/lib/paths.mjs';
import { resolve } from 'node:path';

test('every figure in the gallery adds back to the medal rows on file', () => {
  const ds = loadDataset();
  const d = galleryData(ds);
  const rows = ds.results.filter((r) => ['Gold', 'Silver', 'Bronze'].includes(r.medal));
  assert.equal(d.totals.medals, rows.length);
  assert.equal(d.years.reduce((s, y) => s + y.total, 0), rows.length);
  assert.equal(d.states.reduce((s, x) => s + x.medals, 0), rows.length);
  assert.equal(d.families.reduce((s, f) => s + f.medals, 0), rows.length);
  assert.ok(d.totals.partialYears.length > 0, 'partial years are reported');
});

test('the gallery palette meets WCAG AA', () => {
  assert.deepEqual(checkContrast(), []);
});

test('the committed gallery is current and self contained', () => {
  assert.ok(existsSync(GALLERY_PATH), 'run npm run gallery:build');
  const html = renderGallery();
  assert.equal(readFileSync(GALLERY_PATH, 'utf8'), html, 'docs/design/chart-gallery/index.html is stale; run npm run gallery:build');
  assert.ok(!/<script[^>]+\ssrc=/i.test(html));
});

test('gallery sources follow the dash rule', () => {
  for (const rel of GALLERY_SOURCES) assert.deepEqual(checkGallerySource(readFileSync(resolve(ROOT, rel), 'utf8')), [], rel);
});
