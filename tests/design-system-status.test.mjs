import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYOUT, SETTINGS, WEB, darkThemeProblems, design, listFiles, loadSpecs, readDoc, statusProblem } from '../scripts/design-system/lib.mjs';

const d = await design();

test('a spec status is one of draft, review, or approved', () => {
  assert.deepEqual([...d.STATUSES], ['draft', 'review', 'approved']);
  for (const status of d.STATUSES) assert.equal(statusProblem([...d.STATUSES], { status }), null, status);
  assert.match(statusProblem([...d.STATUSES], {}), /missing status/);
  for (const bad of ['Approved', 'done', '', null, 3]) assert.match(statusProblem([...d.STATUSES], { status: bad }), /must be one of draft, review, approved/, String(bad));
});

test('every component has a spec with a valid status and valid settings', () => {
  const specs = loadSpecs();
  assert.deepEqual(specs.map((s) => s.dir), Object.keys(d.COMPONENTS).sort());
  for (const s of specs) {
    assert.equal(statusProblem([...d.STATUSES], s.data), null, s.spec);
    for (const [key, kind] of Object.entries(d.COMPONENTS[s.dir])) assert.equal(d.valueProblem(kind, s.data[key]), null, `${s.spec} ${key}`);
  }
});

test('every spec lists its options under ## <name>-options, and the page heading comes from copy', () => {
  for (const s of loadSpecs()) {
    assert.match(s.body, new RegExp(`^## ${s.dir}-options$`, 'm'), s.spec);
    assert.doesNotMatch(s.text, /what-you-can-change/i, s.spec);
  }
  const copy = readFileSync(resolve(WEB, '..', '.docs/content-management-system/pages/design-system.md'), 'utf8');
  assert.match(copy, /^- `options_heading`: \{\{name\}\} Options$/m);
  assert.match(copy, /^- `spec_link`: GitHub: \{\{name\}\} Spec$/m);
});

test('the chart card draws with Series 1 color to Series 5 color from settings.md, the same five as brand.css', () => {
  assert.equal(Object.hasOwn(d.COMPONENTS['chart-card'], 'Series colors'), false);
  const chart = loadSpecs().find((s) => s.dir === 'chart-card');
  assert.equal(Object.hasOwn(chart.data, 'Series colors'), false);
  const g = d.mergeGlobal({}, readDoc(SETTINGS).data);
  const vars = d.themeVars(g);
  const brand = readFileSync(resolve(WEB, '..', 'site/assets/brand.css'), 'utf8').toLowerCase();
  d.SERIES_KEYS.forEach((k, i) => {
    assert.equal(vars[`--app-color-series-${i + 1}`], g[k], k);
    assert.ok(brand.includes(String(g[k]).toLowerCase()), `${k} ${g[k]} is in site/assets/brand.css`);
  });
  for (const r of d.seriesReport(g, d.schemeFor(g))) assert.ok(r.pass, `${r.fg} ${r.fgHex}: ${r.ratio}`);
  const chartSrc = readFileSync(resolve(WEB, 'components/ChartCard.tsx'), 'utf8');
  assert.doesNotMatch(chartSrc, /Series colors/);
  assert.match(readFileSync(resolve(WEB, 'design/echarts-theme.ts'), 'utf8'), /--app-color-series-/);
});

test('the layout settings accept full or a rem width, Material margins, and drawer or rail', () => {
  for (const ok of ['full', 'fill', 'wide', 'standard', '90rem', '72.5rem']) assert.equal(d.valueProblem(d.GLOBAL['Page width'], ok), null, ok);
  for (const bad of ['80%', '1200px', '10rem', 'huge', 90]) assert.notEqual(d.valueProblem(d.GLOBAL['Page width'], bad), null, String(bad));
  const vars = d.themeVars(d.mergeGlobal({}, readDoc(SETTINGS).data));
  assert.equal(vars['--app-page-max'], 'none');
  assert.equal(vars['--app-margin-compact'], '16px');
  assert.equal(vars['--app-margin-wide'], '24px');
  for (const [v, max] of [['90rem', '90rem'], ['wide', '100rem'], ['standard', '80rem'], ['fill', 'none']]) assert.equal(d.themeVars(d.mergeGlobal({}, { ...readDoc(SETTINGS).data, 'Page width': v }))['--app-page-max'], max, v);
  assert.deepEqual([...d.GLOBAL['Navigation on wide screens'].values], ['drawer', 'rail']);
});

test('the global settings are valid, and the seed is a quoted hex color', () => {
  const { data } = readDoc(SETTINGS);
  for (const [key, kind] of Object.entries(d.GLOBAL)) assert.equal(d.valueProblem(kind, data[key]), null, key);
  assert.match(readFileSync(SETTINGS, 'utf8'), /^Seed color: "#[0-9A-Fa-f]{6}"$/m);
  // An unquoted hex color reads as a YAML comment, so it must be rejected rather than passed through.
  assert.notEqual(d.valueProblem(d.GLOBAL['Seed color'], null), null);
});

test('the layout file orders every section, navigation item, and component once', () => {
  const { data } = readDoc(LAYOUT);
  for (const key of d.LAYOUT_KEYS) assert.deepEqual([...data[key]].sort(), [...d.layoutIds(key)].sort(), key);
  assert.deepEqual(d.orderList('Sections', ['components', 'color', 'nope']).slice(0, 2), ['components', 'color']);
});

test('every data table reads the table rule from its spec: no wrapping, left aligned, bold header', () => {
  const table = loadSpecs().find((s) => s.dir === 'data-table');
  assert.equal(table.data['Cell wrapping'], 'never');
  assert.equal(table.data['Cell alignment'], 'left');
  assert.equal(table.data['Header weight'], 'bold');
  const src = readFileSync(resolve(WEB, 'components/DataTable.tsx'), 'utf8');
  for (const key of ['Cell wrapping', 'Cell alignment', 'Header weight']) assert.match(src, new RegExp(`s\\['${key}'\\]`), key);
  assert.match(src, /overflow-x-auto|overflow-auto/);
});

test('the generated light scheme meets WCAG AA, with neutral surfaces by default', () => {
  const g = d.mergeGlobal({}, readDoc(SETTINGS).data);
  const scheme = d.schemeFor(g);
  for (const r of d.contrastReport(scheme)) assert.ok(r.pass, `${r.fg} on ${r.bg}: ${r.ratio}`);
  if (g['Surface tint'] === 'none') {
    for (const role of ['surface', 'surface container', 'surface container highest', 'on surface', 'outline']) {
      const [r, gr, b] = [1, 3, 5].map((i) => parseInt(scheme[role].slice(i, i + 2), 16));
      assert.ok(Math.max(r, gr, b) - Math.min(r, gr, b) <= 2, `${role} ${scheme[role]} is not a neutral gray`);
    }
  }
  const tinted = d.schemeFor({ ...g, 'Surface tint': 'seed' });
  assert.notEqual(tinted['surface container'], scheme['surface container']);
  if (g['Page background'] === 'white') for (const role of ['background', 'surface', 'surface bright']) assert.equal(scheme[role], '#ffffff', role);
  assert.notEqual(d.schemeFor({ ...g, 'Page background': 'scheme' }).surface, '#ffffff');
});

test('the system has one light theme', () => {
  for (const file of [...listFiles(resolve(WEB, 'app'), ['.tsx', '.ts', '.css']), ...listFiles(resolve(WEB, 'design'), ['.ts', '.tsx']), ...listFiles(resolve(WEB, 'components'), ['.tsx'])]) {
    assert.deepEqual(darkThemeProblems(readFileSync(file, 'utf8')), [], file);
  }
  for (const s of loadSpecs()) assert.doesNotMatch(s.text, /dark (theme|mode)|theme toggle|prefers-color-scheme/i, s.spec);
  assert.doesNotMatch(readFileSync(SETTINGS, 'utf8'), /\bdark\b/i);
});
