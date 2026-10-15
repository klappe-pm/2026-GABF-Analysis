import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const css = readFileSync(new URL('../site/assets/styles.css', import.meta.url), 'utf8');

test('no rule lets the browser split words in the middle to fit a table', () => {
  // overflow-wrap: anywhere and word-break: break-all shrink a cell's minimum width, so table
  // columns collapse and words such as "Brewery" wrap one letter at a time.
  assert.ok(!/overflow-wrap:\s*anywhere/.test(css), 'overflow-wrap: anywhere splits words in table cells');
  assert.ok(!/word-break:\s*break-all/.test(css), 'word-break: break-all splits words in table cells');
});

test('table cells keep whole words and the table scrolls sideways instead', () => {
  assert.match(css, /\nth, td \{[^}]*overflow-wrap: normal/);
  assert.match(css, /\.table-wrap \{[^}]*overflow-x: auto/);
});

test('chart cards can shrink below the width their canvas was drawn at', () => {
  assert.match(css, /\.dash-grid > \* \{ min-width: 0; \}/);
  assert.match(css, /\.dash-grid \{ display: grid; gap: 16px; grid-template-columns: minmax\(0, 1fr\); \}/);
});

test('dashboard panels and page margins follow the Material window size classes', () => {
  assert.match(css, /min-width: 840px\) \{ \.dash-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /min-width: 1200px\) \{ \.dash-grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /min-width: 1600px\) \{ \.dash-grid \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /--page-margin: var\(--brand-margin-compact\);/);
  assert.match(css, /min-width: 600px\) \{ :root \{ --page-margin: var\(--brand-margin-wide\); \}/);
  assert.match(css, /^main \{ max-width: var\(--brand-page-max\);/m);
  assert.doesNotMatch(css, /max-width: 1140px/, 'no fixed page container');
});

test('wide tables in a deep dive scroll sideways instead of widening the page', () => {
  assert.match(css, /\.table-wrap \{[^}]*overflow-x: auto[^}]*max-width: 100%/);
});

test('the light theme tokens and page background exist', () => {
  assert.match(css, /:root \{\s*color-scheme: light;/);
  assert.match(css, /body \{[^}]*background: var\(--page\)/);
});

test('the site ships no dark theme toggle, dark rule, theme attribute or theme storage key', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files = [];
  const walk = (dir, filter) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, filter);
      else if (filter(full)) files.push(full);
    }
  };
  walk(join(root, 'site', 'assets'), () => true);
  walk(join(root, 'site', 'standalone'), () => true);
  for (const f of ['scripts/build-standalone.mjs', 'scripts/lib/site-payload.mjs', 'gabf-dashboard.html']) files.push(join(root, f));
  assert.ok(files.length > 5);
  for (const file of files.filter((f) => existsSync(f))) {
    const text = readFileSync(file, 'utf8');
    const rel = file.slice(root.length);
    assert.ok(!/prefers-color-scheme\s*:\s*dark/.test(text), `${rel} has a dark prefers-color-scheme rule`);
    assert.ok(!/theme-toggle|Dark mode|data-theme|gabf-theme/.test(text), `${rel} has dark theme toggle code`);
  }
});

test('the page background is pure white in the stylesheet and in the standalone dashboard', () => {
  // The stylesheet points the page at Material's background, which brand.css sets to pure white.
  assert.match(css, /:root \{[^}]*--page: var\(--md-sys-color-background\);/);
  assert.match(css, /:root \{[^}]*--surface-1: var\(--md-sys-color-surface\);/);
  const brand = readFileSync(new URL('../site/assets/brand.css', import.meta.url), 'utf8');
  assert.match(brand, /--md-sys-color-background: #ffffff;/);
  assert.match(brand, /--md-sys-color-surface: #ffffff;/);
  const template = readFileSync(new URL('../site/standalone/template.html', import.meta.url), 'utf8');
  assert.match(template, /\/\*__STYLES__\*\//, 'the standalone template takes its styles from site/assets/styles.css');
  assert.ok(!/--page:/.test(template), 'the standalone template must not override the page variable');
  const standalone = readFileSync(new URL('../gabf-dashboard.html', import.meta.url), 'utf8');
  assert.match(standalone, /--md-sys-color-background: #ffffff;/);
  assert.match(standalone, /--page: var\(--md-sys-color-background\);/);
  assert.ok(!/#f9f9f7|#fcfcfb/i.test(standalone), 'the standalone dashboard keeps no off white page color');
});
