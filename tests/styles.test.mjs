import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../site/assets/styles.css', import.meta.url), 'utf8');

test('no rule lets the browser split words in the middle to fit a table', () => {
  // overflow-wrap: anywhere and word-break: break-all shrink a cell's minimum width, so table
  // columns collapse and words such as "Brewery" wrap one letter at a time.
  assert.ok(!/overflow-wrap:\s*anywhere/.test(css), 'overflow-wrap: anywhere splits words in table cells');
  assert.ok(!/word-break:\s*break-all/.test(css), 'word-break: break-all splits words in table cells');
});

test('table cells keep whole words and the table scrolls sideways instead', () => {
  assert.match(css, /table\.data-table th, table\.data-table td \{[^}]*overflow-wrap: normal/);
  assert.match(css, /\.table-wrap \{[^}]*overflow-x: auto/);
});

test('chart cards can shrink below the width their canvas was drawn at', () => {
  assert.match(css, /\.dash-grid > \* \{ min-width: 0; \}/);
  assert.match(css, /max-width: 480px\) \{ \.dash-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

test('wide tables in a deep dive scroll sideways instead of widening the page', () => {
  assert.match(css, /\.prose table \{[^}]*max-width: 100%[^}]*overflow-x: auto/);
});

test('light and dark tokens exist for the host theme switch', () => {
  assert.match(css, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /body \{[^}]*background: var\(--page\)/);
});
