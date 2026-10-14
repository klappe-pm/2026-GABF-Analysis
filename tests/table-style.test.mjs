import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The site stylesheet is copied to dist/assets/styles.css unchanged, so this reads the source.
const css = readFileSync(new URL('../site/assets/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
const cellSelector = /(^|[\s,>+~])(th|td)\b/;

function ruleFor(selector) {
  const found = rules.filter((r) => r.selector.split(',').map((s) => s.trim()).includes(selector));
  assert.ok(found.length > 0, `no rule for ${selector}`);
  return found.map((r) => r.body).join(';');
}

test('every th and td keeps its text on one line', () => {
  assert.match(ruleFor('th'), /white-space:\s*nowrap/);
  assert.match(ruleFor('td'), /white-space:\s*nowrap/);
});

test('every th and td is left aligned', () => {
  assert.match(ruleFor('th'), /text-align:\s*left/);
  assert.match(ruleFor('td'), /text-align:\s*left/);
});

test('the header row is bold', () => {
  assert.match(ruleFor('thead th'), /font-weight:\s*700/);
});

test('no table cell rule sets right or center alignment', () => {
  const offenders = rules.filter((r) => r.selector.split(',').some((s) => cellSelector.test(s) || /\.num\b/.test(s)) && /text-align:\s*(right|center)/.test(r.body));
  assert.deepEqual(offenders.map((r) => r.selector), []);
});

test('no table cell rule turns wrapping back on', () => {
  const offenders = rules.filter((r) => r.selector.split(',').some((s) => cellSelector.test(s)) && /white-space:\s*(normal|pre-wrap|pre-line|break-spaces)/.test(r.body));
  assert.deepEqual(offenders.map((r) => r.selector), []);
});

test('a wide table scrolls inside its own container with a visible focus ring', () => {
  assert.match(ruleFor('.table-wrap'), /overflow-x:\s*auto/);
  assert.ok(rules.some((r) => r.selector === '.table-wrap:focus-visible') || /:focus-visible/.test(css));
});
