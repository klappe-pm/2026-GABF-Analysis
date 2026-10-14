import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSync } from 'esbuild';
import { rawColorProblems, WEB } from '../scripts/design-system/lib.mjs';

// The chart card's presets and brand merge (web/design/chart-presets.ts), bundled for Node.
const out = buildSync({ entryPoints: [resolve(WEB, 'design/chart-presets.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const p = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

// A sentinel theme: every color is a token name, so any color the option carries can be traced to it.
const T = {
  series: ['S1', 'S2', 'S3', 'S4', 'S5'], gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE', surface: 'SURFACE', onSurface: 'ON_SURFACE',
  onSurfaceVariant: 'ON_SURFACE_VARIANT', outline: 'OUTLINE', outlineVariant: 'OUTLINE_VARIANT', container: 'CONTAINER', onContainer: 'ON_CONTAINER',
  family: 'Public Sans', small: 12, medium: 14, radius: 4,
};
const TOKENS = new Set([...T.series, 'GOLD', 'SILVER', 'BRONZE', 'SURFACE', 'ON_SURFACE', 'ON_SURFACE_VARIANT', 'OUTLINE', 'OUTLINE_VARIANT', 'CONTAINER', 'ON_CONTAINER', 'transparent']);
const series = [{ name: 'Gold', values: [3, 1, 2] }, { name: 'Silver', values: [1, 2, 0] }, { name: 'Colorado', values: [5, 4, 6] }];

function colors(node, path = '', found = []) {
  if (Array.isArray(node)) node.forEach((v, i) => colors(v, `${path}[${i}]`, found));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) {
    if (/color/i.test(k) && (typeof v === 'string' || Array.isArray(v))) [v].flat().forEach((c) => found.push([`${path}.${k}`, c]));
    colors(v, `${path}.${k}`, found);
  }
  return found;
}

test('every preset draws only theme colors: series, medals, and scheme roles', () => {
  for (const preset of p.PRESETS) {
    const opt = p.buildChartOption({ preset, categories: [2023, 2024, 2025], series }, T);
    for (const [where, c] of colors(opt)) assert.ok(TOKENS.has(c), `${preset} ${where} is ${c}`);
  }
});

test('medal series take the medal colors and other series take series colors in order', () => {
  const opt = p.buildChartOption({ preset: 'bar', categories: [1, 2, 3], series }, T);
  assert.deepEqual(opt.series.map((s) => s.itemStyle.color), ['GOLD', 'SILVER', 'S1']);
});

test('the passthrough merge keeps every value the caller set', () => {
  const option = {
    color: ['CALLER'],
    grid: { left: 99 },
    xAxis: { type: 'category', data: ['a', 'b'], axisLabel: { color: 'CALLER_AXIS' } },
    yAxis: { type: 'value', minInterval: 5 },
    series: [{ type: 'bar', name: 'Colorado', data: [1, 2], itemStyle: { borderRadius: 0 } }],
    animation: true,
  };
  const opt = p.buildChartOption({ option, counts: true }, T);
  assert.deepEqual(opt.color, ['CALLER']);
  assert.equal(opt.grid.left, 99);
  assert.equal(opt.grid.containLabel, true, 'the brand fills what the caller left out');
  assert.equal(opt.xAxis.axisLabel.color, 'CALLER_AXIS');
  assert.equal(opt.xAxis.axisLabel.fontFamily, 'Public Sans');
  assert.equal(opt.yAxis.minInterval, 5);
  assert.equal(opt.series[0].itemStyle.borderRadius, 0);
  assert.equal(opt.series[0].itemStyle.color, undefined, 'a caller palette is not overridden per series');
  assert.equal(opt.animation, true);
  assert.equal(p.buildChartOption({ option }, T, { ...p.DEFAULT_LOOK, reduceMotion: true }).animation, false, 'reduced motion wins');
});

test('count presets put integer steps on their value axes; line keeps fractional values', () => {
  for (const preset of p.COUNT_PRESETS) {
    const opt = p.buildChartOption({ preset, categories: [1, 2], series: series.slice(0, 1) }, T);
    const axes = [opt.xAxis, opt.yAxis].flat().filter((a) => a.type === 'value');
    assert.ok(axes.length, preset);
    for (const a of axes) assert.equal(a.minInterval, 1, preset);
  }
  const line = p.buildChartOption({ preset: 'line', categories: [1, 2], series: [{ name: 'Acres', values: [0.5, 1.5] }] }, T);
  assert.equal(line.yAxis.minInterval, undefined);
  assert.equal(line.xAxis.boundaryGap, false);
  assert.equal(p.buildChartOption({ preset: 'line', counts: true, categories: [1, 2], series }, T).yAxis.minInterval, 1);
});

test('sorting reorders categories, values, and the table view together', () => {
  const opt = p.buildChartOption({ preset: 'horizontalBar', categories: ['a', 'b', 'c'], series: [{ name: 'M', values: [1, 3, 2] }], sort: 'descending' }, T);
  assert.deepEqual(opt.yAxis.data, ['b', 'c', 'a']);
  assert.equal(opt.yAxis.inverse, true);
  assert.deepEqual(opt.series[0].data, [3, 2, 1]);
  const t = p.tableFor('horizontalBar', ['a', 'b', 'c'], [{ name: 'M', values: [1, 3, 2] }], 'State', 'descending');
  assert.deepEqual(t.rows.map((r) => [r.cells.name, r.cells.s0]), [['b', '3'], ['c', '2'], ['a', '1']]);
  assert.deepEqual(t.columns.map((c) => c.label), ['State', 'M']);
});

test('a missing value in the table view reads as the not-found label the caller passes', () => {
  const rows = (preset, label) => p.tableFor(preset, ['a', 'b'], [{ name: 'M', values: [1, null] }], 'State', undefined, label).rows;
  assert.equal(rows('horizontalBar', 'Not Found')[1].cells.s0, 'Not Found');
  assert.equal(rows('bar', 'Not Found')[0].cells.b, 'Not Found');
  assert.equal(rows('bar', 'Not Found')[0].cells.a, '1');
});

test('the chart card builds its table view from rows and columns the caller supplies', () => {
  const src = readFileSync(resolve(WEB, 'components/ChartCard.tsx'), 'utf8');
  assert.match(src, /if \(props\.rows && props\.columns\) return \{ rows: props\.rows, columns: props\.columns \}/);
  assert.match(src, /<DataTable caption=\{title\} columns=\{table\.columns\} rows=\{table\.rows\} \/>/);
  assert.match(src, /<details/);
});

test('the chart card and its presets hold no color literal', () => {
  for (const f of ['components/ChartCard.tsx', 'design/chart-presets.ts', 'design/echarts-theme.ts']) {
    assert.deepEqual(rawColorProblems(readFileSync(resolve(WEB, f), 'utf8')), [], f);
  }
});
