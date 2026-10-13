import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { barsHOption, COMPACT_AXIS, lineOption, mapOption, scatterOption, stackedColumnsOption } from '../site/assets/chart-options.mjs';
import { serializeOption } from '../site/assets/charts.mjs';

const ASSETS = new URL('../site/assets/', import.meta.url);

// Run echarts-init.js in a minimal browser stand-in so its formatter registry can be exercised.
function loadInit(innerWidth = 1200) {
  const ctx = { innerWidth, GABF_BASE: './', console };
  ctx.window = ctx;
  ctx.document = { documentElement: {}, readyState: 'complete', querySelectorAll: () => [], addEventListener() {} };
  ctx.getComputedStyle = () => ({ getPropertyValue: () => '#123456' });
  ctx.MutationObserver = class { observe() {} };
  ctx.addEventListener = () => {};
  ctx.matchMedia = () => ({ addEventListener() {} });
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('echarts-init.js', ASSETS), 'utf8'), ctx);
  return ctx.GABFCharts;
}

function allOptions() {
  return [
    barsHOption({ items: [{ label: 'A', value: 3 }, { label: 'B', value: 12000 }] }),
    stackedColumnsOption({ labels: [2024, 2025, 2026], notes: ['', 'partial', 'pending'], series: [{ name: 'Gold', data: [1, 2, 3] }, { name: 'Silver', data: [1, 0, 2] }] }),
    lineOption({ labels: [2024, 2025], series: [{ name: 'Entries', data: [100, 200] }] }),
    mapOption({ data: [{ name: 'California', value: 4 }] }),
    scatterOption({ points: [{ name: 'IPA', x: 311, y: 90, size: 14 }], xName: 'Entries', yName: 'Breweries' }),
  ];
}

function collectFormatters(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => collectFormatters(v, found));
  else if (value && typeof value === 'object') {
    if (typeof value.$fmt === 'string') found.add(value.$fmt);
    Object.values(value).forEach((v) => collectFormatters(v, found));
  }
  return found;
}

test('options are plain JSON and every formatter reference is registered', () => {
  const charts = loadInit();
  const names = new Set();
  for (const option of allOptions()) {
    const json = serializeOption(option);
    assert.ok(!json.includes('fn:'), 'no source text formatters');
    collectFormatters(JSON.parse(json), names);
  }
  assert.ok(names.has('compactAxis') && names.has('yearNotes'), 'both formatters are in use');
  for (const name of names) {
    const probe = charts.reviveFormatters({ $fmt: name, args: name === 'yearNotes' ? [[]] : [] });
    assert.equal(typeof probe, 'function', `formatter "${name}" is registered`);
  }
});

test('serializeOption refuses a function instead of shipping source text', () => {
  assert.throws(() => serializeOption({ label: { formatter: (v) => String(v) } }), /use fmt\(\)/);
});

test('an unknown formatter name fails loudly', () => {
  assert.throws(() => loadInit().reviveFormatters({ $fmt: 'nope', args: [] }), /Unknown chart formatter/);
});

test('compact axis formatter abbreviates large numbers', () => {
  const f = loadInit().reviveFormatters(COMPACT_AXIS);
  assert.equal(f(7), '7');
  assert.equal(f(1500), '1.5K');
  assert.equal(f(12000), '12K');
  assert.equal(f(2500000), '2.5M');
  assert.equal(f('x'), '');
});

test('year notes formatter adds a status line and shrinks on a phone', () => {
  const spec = { $fmt: 'yearNotes', args: [['', 'pending']] };
  const wide = loadInit(1200).reviveFormatters(spec);
  assert.equal(wide(2025, 0), '2025');
  assert.equal(wide(2026, 1), '2026\n{note|pending}');
  const narrow = loadInit(390).reviveFormatters(spec);
  assert.equal(narrow(2026, 1), "'26\n{note|…}");
});

test('no chart or dashboard source evaluates text as code', () => {
  for (const file of readdirSync(ASSETS).filter((f) => /\.(m?js)$/.test(f))) {
    const text = readFileSync(new URL(file, ASSETS), 'utf8');
    assert.ok(!/\bnew Function\b|(?<![.\w])eval\s*\(|setTimeout\s*\(\s*['"`]/.test(text), `${file} must not use eval or Function`);
  }
});

test('scatter axis names are placed where a narrow card cannot clip them', () => {
  const option = scatterOption({ points: [{ name: 'IPA', x: 311, y: 90 }], xName: 'Entries', yName: 'Breweries' });
  assert.equal(option.xAxis.nameLocation, 'middle', 'x name sits under its axis');
  assert.ok(option.grid.bottom >= 30, 'the grid leaves a strip for the x name');
  assert.equal(option.yAxis.nameLocation, 'end', 'y name sits above its axis');
  assert.equal(option.yAxis.nameTextStyle.align, 'left', 'left aligned so it grows into the card, not off its edge');
});
