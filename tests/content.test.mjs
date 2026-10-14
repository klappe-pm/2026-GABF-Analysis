import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ROOT } from '../scripts/lib/paths.mjs';
import { parseContent } from '../scripts/lib/content-md.mjs';

// The site copy in .docs/content-management-system/ is the single source of visible text. These checks keep it machine
// readable and keep developer text and dash punctuation out of it.
const CONTENT = resolve(ROOT, '.docs', 'content-management-system');
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
};
const files = walk(CONTENT);
// Copy documents are the Markdown files under pages/ and global/; analysis/ holds prose pages.
const docs = Object.fromEntries(files.filter((f) => /\/(pages|global)\/[^/]+\.md$/.test(f)).map((f) => [relative(CONTENT, f).replace(/\.md$/, '').split('/').join('.'), parseContent(readFileSync(f, 'utf8'))]));

function strings(node, path, out) {
  if (typeof node === 'string') out.push([path, node]);
  else if (Array.isArray(node)) node.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) strings(v, `${path}.${k}`, out);
  return out;
}

// Resolve a key such as pages.brewery-detail.ownership.missing; label keys may contain dots or spaces.
function lookup(key) {
  const docKey = Object.keys(docs).find((k) => key.startsWith(`${k}.`));
  if (!docKey) return undefined;
  let node = docs[docKey];
  let parts = key.slice(docKey.length + 1).split('.');
  while (parts.length) {
    const n = [...Array(parts.length).keys()].map((i) => parts.length - i).find((len) => node && typeof node === 'object' && Object.hasOwn(node, parts.slice(0, len).join('.')));
    if (!n) return undefined;
    node = node[parts.slice(0, n).join('.')];
    parts = parts.slice(n);
  }
  return node;
}

test('every content copy file parses to a non empty object', () => {
  assert.ok(Object.keys(docs).length >= 20);
  for (const [name, doc] of Object.entries(docs)) assert.ok(doc && Object.keys(doc).length > 0, name);
});

test('the Markdown copy format round trips keys, blanks, and lists', () => {
  const md = '# T\n\nNote.\n\n## `a`\n\nWhere: x.\n\n- `k`: Text: with colon\n- `(blank)`: Not defined\n\n### `b`\n\n- `n`:\n\n## `list`\n\n- one\n- two\n';
  assert.deepEqual(parseContent(md), { a: { k: 'Text: with colon', '': 'Not defined', b: { n: '' } }, list: ['one', 'two'] });
});

test('visible copy has no dash punctuation, paths, or commands', () => {
  const dashes = new RegExp('[\\u2013\\u2014]|\\s-\\s|-{2}');
  for (const [name, doc] of Object.entries(docs)) {
    for (const [path, value] of strings(doc, name, [])) {
      assert.ok(!dashes.test(value), `${path}: dash used as punctuation`);
      assert.ok(!/\.(csv|mjs|json|html)\b|\bnpm\b|scripts\/|data\/reference/.test(value), `${path}: path or command`);
    }
  }
});

// Kebab case values (raw data slugs) must never show as copy. Real compound words are allowed.
const COMPOUNDS = new Set(['gluten-free', 'barrel-aged', 'us-atlas']);
function kebabTokens(text) {
  const plain = String(text).replace(/\{\{[^}]+\}\}/g, '');
  return [...plain.matchAll(/(^|[^\w{\-/])([a-z]+(?:-[a-z0-9]+)+)(?![\w}\-])/g)].map((m) => m[2]).filter((t) => !COMPOUNDS.has(t.toLowerCase()));
}

test('the kebab detector flags data slugs and allows real compound words', () => {
  assert.deepEqual(kebabTokens('Channel: self-distribution'), ['self-distribution']);
  assert.deepEqual(kebabTokens('Strong and barrel-aged, gluten-free, Pro-Am'), []);
});

test('visible copy has no kebab case values (label keys may stay raw)', () => {
  for (const [name, doc] of Object.entries(docs)) {
    for (const [path, value] of strings(doc, name, [])) assert.deepEqual(kebabTokens(value), [], path);
  }
});

test('every inventory row points at a key that exists', () => {
  const lines = readFileSync(resolve(CONTENT, 'inventory.csv'), 'utf8').trim().split('\n');
  assert.equal(lines[0], 'page,location,current_text,new_key');
  for (const line of lines.slice(1)) {
    const cells = [...line.matchAll(/("(?:[^"]|"")*"|[^,]*)(,|$)/g)].map((m) => m[1].replace(/^"|"$/g, '').replace(/""/g, '"'));
    const key = cells[3];
    if (key === '(removed)') continue;
    if (key.startsWith('analysis.')) { assert.ok(existsSync(resolve(CONTENT, 'analysis', `${key.slice(9)}.md`)), key); continue; }
    assert.equal(typeof lookup(key), 'string', key);
  }
});
