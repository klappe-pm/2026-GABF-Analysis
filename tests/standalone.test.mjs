import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStandalone } from '../scripts/build-standalone.mjs';

async function buildTemp() {
  const out = join(mkdtempSync(join(tmpdir(), 'gabf-standalone-')), 'dashboard.html');
  const result = await buildStandalone({ out });
  return { out, result, html: readFileSync(out, 'utf8') };
}

test('standalone build is one self-contained file with the data embedded', async () => {
  const { result, html } = await buildTemp();
  assert.ok(result.bytes > 1_000_000, 'ECharts is inlined');
  assert.ok(!/<script[^>]+\ssrc=/i.test(html), 'no external script tags');
  assert.ok(!/<link[^>]+rel=["']stylesheet/i.test(html), 'no external stylesheets');
  assert.ok(!/\b(?:src|href)=["']https?:\/\/[^"']*\.(?:js|css|json)["']/i.test(html), 'no remote assets');
  const match = html.match(/window\.GABF_DATA = (.*);\r?\n/);
  assert.ok(match, 'embedded data assignment found');
  const data = JSON.parse(match[1]);
  assert.ok(data.results.length >= 20);
  assert.ok(data.meta.years.includes(2026));
  assert.ok(data.breweries.some((b) => b.key === 'green cheek'));
  assert.match(data.brewery_html['green cheek'], /Doom Sludge/);
  assert.match(data.brewery_html['green cheek'], /deep-dive/);
  assert.ok(Object.keys(data.brewery_html).length === data.breweries.length, 'every brewery has a detail view');
  assert.match(html, /window\.GABF_GEO = \{"type":"FeatureCollection"/);
});

test('every panel placed in the template is defined by the dashboards script', async () => {
  const template = readFileSync(new URL('../site/standalone/template.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../site/assets/dashboards.js', import.meta.url), 'utf8');
  const ids = [...template.matchAll(/data-panel="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 15);
  for (const id of ids) {
    assert.ok(new RegExp(`^  '?${id}'?: \\{`, 'm').test(script), `panel "${id}" has no definition`);
  }
  const tabs = [...template.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
  for (const tab of tabs) assert.ok(template.includes(`data-tab-link="${tab}"`), `tab "${tab}" has a nav link`);
});

test('standalone build is deterministic', async () => {
  const a = await buildTemp();
  const b = await buildTemp();
  assert.equal(a.html, b.html);
});
