import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';

// Every (E) on the site links to the estimates section of the Method page, through href() so a base path
// is carried. The component holds the default; a call site passes only the link text.

const WEB = resolve(ROOT, 'web');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');

function sources(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const full = resolve(dir, n);
    if (n === 'node_modules' || n.startsWith('.')) continue;
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.(tsx|ts)$/.test(n)) out.push(full);
  }
  return out;
}

// Each <EstimateTooltip ... /> element in the app and the components, as written.
function uses() {
  const out = [];
  for (const file of sources(WEB)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/<EstimateTooltip\b[\s\S]*?\/>/g)) out.push({ file: relative(ROOT, file), tag: m[0] });
  }
  return out;
}

test('the Method estimates address is a site path with the estimates anchor', () => {
  const src = read('web', 'lib', 'href.ts');
  assert.match(src, /\bmethod: '\/method\/'/);
  assert.match(src, /\bmethodEstimates: '\/method\/#estimates'/);
});

test('the estimate tooltip links to the Method estimates section by default, through href()', () => {
  const src = read('web', 'components', 'EstimateTooltip.tsx');
  assert.match(src, /href = siteHref\(paths\.methodEstimates\)/, 'the default href goes through href() from web/lib/href.ts');
  assert.match(src, /import \{ href as siteHref, paths \} from '@\/lib\/href'/);
  assert.match(src, /<TextLink href=\{href\}>\{linkText\}<\/TextLink>/);
});

test('every estimate tooltip on the site keeps the default link', () => {
  const all = uses();
  assert.ok(all.length >= 2, `${all.length} uses found`);
  for (const { file, tag } of all) {
    assert.ok(!/\bhref=/.test(tag), `${file} overrides the Method link`);
    assert.ok(!/\blink=/.test(tag), `${file} still passes the old link prop`);
    assert.match(tag, /\blinkText=/, `${file} passes no link text`);
  }
});

test('the Method page copy has the estimates section the link points at', () => {
  assert.match(read('.docs', 'content-management-system', 'pages', 'method.md'), /^## `estimates`$/m);
});
