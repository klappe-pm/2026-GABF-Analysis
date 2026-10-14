// Every word of the review widget comes from the copy documents. The widget code names copy keys and
// carries no visible text of its own; each key it names exists; headings, labels, and buttons are in title
// case; and a missing value reads the Not Found label of the global label dictionary.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { parseContent } from '../scripts/lib/content-md.mjs';

const CMS = resolve(ROOT, '.docs/content-management-system');
const present = existsSync(resolve(CMS, 'pages/review-mode.md'));
const skip = !present && 'the copy folder is not in this checkout';

const copy = present ? parseContent(readFileSync(resolve(CMS, 'pages/review-mode.md'), 'utf8')) : {};
const labels = present ? parseContent(readFileSync(resolve(CMS, 'global/labels.md'), 'utf8')) : {};
const get = (key) => key.split('.').reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), copy);

const FILES = ['web/review/widget.tsx', 'web/review/inline-editor.tsx'].map((f) => [f, readFileSync(resolve(ROOT, f), 'utf8')]);

test('every copy key the widget names exists in pages/review-mode.md', { skip }, () => {
  let named = 0;
  for (const [file, source] of FILES) {
    for (const m of source.matchAll(/\bc\('([\w.]+)'/g)) {
      named += 1;
      assert.equal(typeof get(m[1]), 'string', `${file} names ${m[1]}, which the copy file does not hold`);
    }
  }
  assert.ok(named > 40, 'the widget reads its words through c()');
  for (const key of ['elements.h1', 'elements.a', 'elements.other']) assert.equal(typeof get(key), 'string');
});

test('the widget code carries no visible text of its own', () => {
  for (const [file, source] of FILES) {
    const code = source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const jsxText = [...code.matchAll(/>\s*([A-Za-z][^<>{}]*?)\s*</g)].map((m) => m[1]).filter((t) => !/^(=>|&&)/.test(t) && !/[=;()]/.test(t));
    assert.deepEqual(jsxText, [], `${file} has text in its markup`);
    const attrs = [...code.matchAll(/\b(?:aria-label|placeholder|title|alt|label)="([^"{}]+)"/g)].map((m) => m[1]);
    assert.deepEqual(attrs, [], `${file} has a fixed label attribute`);
  }
});

const SMALL = new Set(['a', 'an', 'the', 'of', 'on', 'in', 'for', 'to', 'and', 'or']);
const titleCase = (text) => text.split(/\s+/).every((w) => /^[A-Z]/.test(w));

test('headings, labels, and buttons are in title case', { skip }, () => {
  const keys = ['panel.entry', 'panel.title', 'panel.close', 'panel.note_label', 'panel.step_label', 'panel.step_choose', 'panel.step_none', 'panel.step_group_page', 'panel.step_group_all', 'panel.spots_heading', 'panel.spot_remove', 'panel.categories_heading', 'panel.components_heading', 'panel.component_add_placeholder', 'panel.component_add', 'panel.component_obsidian', 'panel.content_heading', 'panel.recorded_heading', 'panel.image_page', 'panel.image_spot', 'panel.send', 'editor.aria', 'editor.input_label', 'editor.save', 'editor.cancel', 'editor.related_copy', 'editor.related_code', ...Object.keys(copy.elements ?? {}).map((k) => `elements.${k}`)];
  for (const key of keys) {
    const text = get(key).replace(/\{\{\w+\}\}/g, 'X');
    assert.ok(titleCase(text), `${key} is not title case: ${get(key)}`);
  }
  assert.ok(SMALL.size > 0);
});

test('a missing value reads Not Found, from the global label dictionary', { skip }, () => {
  assert.equal(labels.not_found, 'Not Found');
  const source = readFileSync(resolve(ROOT, 'web/review/copy.ts'), 'utf8');
  assert.match(source, /global\.labels\.not_found/);
  assert.match(FILES[0][1], /copy\['not_found'\]/);
});
