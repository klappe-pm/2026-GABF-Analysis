// The design system area reads every visible word from the copy: a missing value reads Not Found (the
// global.labels.not_found key), never the old gap wording, and components carry no hard coded visible text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { webOutGate } from '../scripts/lib/web-out-fresh.mjs';

const ROOT = resolve(import.meta.dirname, '..');
// Built by concatenation so this file does not hold the phrase it bans.
const OLD = ['Not', 'defined'].join(' ');
const AREA = ['.design', 'web/components', 'web/app/design-system'];

const files = (dir, pattern) => {
  const out = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const f = resolve(d, n); if (statSync(f).isDirectory()) walk(f); else if (pattern.test(n)) out.push(f); } };
  walk(resolve(ROOT, dir));
  return out;
};

test('the design system area never shows the old gap wording', () => {
  for (const dir of AREA) {
    for (const f of files(dir, /\.(md|tsx?|mjs|json)$/)) assert.ok(!readFileSync(f, 'utf8').includes(OLD), f);
  }
  const page = readFileSync(resolve(ROOT, 'web/app/design-system/page.tsx'), 'utf8');
  assert.doesNotMatch(page, /global\.states\.gaps\.not_defined/);
  assert.match(page, /global\.labels\.not_found/);
});

test('the built design system page shows no old gap wording', (t) => {
  const html = resolve(ROOT, 'web/out/design-system/index.html');
  // A stale or missing export fails with the rebuild command (a missing one skips in continuous integration).
  const skip = webOutGate();
  if (skip) { t.skip(skip); return; }
  assert.ok(!readFileSync(html, 'utf8').includes(OLD));
});

// A heuristic for hard coded visible text: JSX text nodes with a letter, string literals placed directly
// as JSX children, and literal aria-label, title, label, placeholder, alt, or heading attributes.
// Symbols and punctuation alone (":", "/", "+") are allowed.
export function hardCoded(source) {
  const code = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const hits = [];
  for (const m of code.matchAll(/(?<![=\-])>([^<>{}]*)<\/?[A-Za-z]/g)) {
    const text = m[1].trim();
    if (/[A-Za-z]/.test(text) && !/[;=()?&|]/.test(text)) hits.push(text);
  }
  for (const m of code.matchAll(/>\s*\{[^{}]*?(['"])([A-Za-z][^'"]*\s[^'"]*)\1[^{}]*\}\s*</g)) hits.push(m[2]);
  for (const m of code.matchAll(/\s(aria-label|title|label|placeholder|alt|heading)="([^"]*[A-Za-z][^"]*)"/g)) hits.push(`${m[1]}="${m[2]}"`);
  return hits;
}

test('the hard coded text check catches a planted literal and passes plain code', () => {
  assert.deepEqual(hardCoded('<p className="x">Page settings</p>'), ['Page settings']);
  assert.deepEqual(hardCoded('<b aria-label="Close" />'), ['aria-label="Close"']);
  assert.deepEqual(hardCoded("<span>{open ? 'Close page settings' : x}</span>"), ['Close page settings']);
  assert.deepEqual(hardCoded('const r = useRef<HTMLElement>(null); <p>{copy.title}</p> <i>: </i>'), []);
});

test('components and the style guide hold no hard coded visible text', () => {
  for (const dir of ['web/components', 'web/app/design-system']) {
    for (const f of files(dir, /\.tsx$/)) assert.deepEqual(hardCoded(readFileSync(f, 'utf8')), [], f);
  }
});
