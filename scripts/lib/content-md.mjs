// Site copy lives in content/ as Markdown so it can be read and edited in Obsidian or any
// Markdown editor. Each file is one copy document:
//   # Title                      (ignored by the parser)
//   Prose paragraphs             (notes for the reader; ignored by the parser)
//   ## `group`                   (a group of strings; deeper groups use ### and ####)
//   Where: top of the page.      (where the group appears; ignored by the parser)
//   - `key`: The visible text.   (one string; edit the text after the colon, never the key)
// parseContent turns a file back into the nested object the site reads.

import { parseDocument } from 'yaml';

const KEY_LINE = /^- `([^`]+)`:(?: (.*))?$/;
// A label for an empty raw value (data with no value at all) is written as this key.
const BLANK = '(blank)';
const HEADING = /^(#{2,6}) `([^`]+)`\s*$/;

function cleanComment(text) {
  return String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
}

function humanize(name) {
  const s = name.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Convert one YAML copy document to Markdown. Used once to migrate content/ from YAML.
export function yamlToMarkdown(yamlText, name) {
  const doc = parseDocument(yamlText);
  if (doc.errors.length) throw new Error(`${name}: ${doc.errors[0].message}`);
  const lines = [`# ${humanize(name)}`, ''];
  const header = cleanComment(doc.commentBefore);
  if (header) lines.push(header, '');
  const emit = (map, level) => {
    const items = map.items ?? [];
    const scalars = items.filter((p) => !p.value?.items);
    const groups = items.filter((p) => p.value?.items);
    for (const pair of scalars) {
      const key = String(pair.key.value) || BLANK;
      const value = pair.value?.value ?? '';
      if (typeof value !== 'string') throw new Error(`${name}: ${key} is not text`);
      if (value.includes('\n')) throw new Error(`${name}: ${key} spans lines`);
      lines.push(value === '' ? `- \`${key}\`:` : `- \`${key}\`: ${value}`);
    }
    if (scalars.length) lines.push('');
    for (const pair of groups) {
      const key = String(pair.key.value);
      lines.push(`${'#'.repeat(level)} \`${key}\``, '');
      const first = items[0] === pair ? map.commentBefore : undefined;
      const where = cleanComment(pair.key.commentBefore ?? pair.commentBefore ?? first).replace(/^where:\s*/i, '');
      if (where) lines.push(`Where: ${where}`, '');
      const isList = pair.value.items.every((p) => p.key === undefined);
      if (isList) {
        for (const item of pair.value.items) lines.push(`- ${item.value}`);
        lines.push('');
      } else emit(pair.value, level + 1);
    }
  };
  // Top level groups carry their "where" comment on the key.
  emit(doc.contents, 2);
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

// Parse a Markdown copy document into the nested object of strings.
export function parseContent(markdown) {
  const root = {};
  const stack = [{ level: 1, node: root }];
  for (const line of markdown.split(/\r?\n/)) {
    const h = line.match(HEADING);
    if (h) {
      const level = h[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const parent = stack[stack.length - 1].node;
      if (Object.hasOwn(parent, h[2])) throw new Error(`duplicate group ${h[2]}`);
      parent[h[2]] = {};
      stack.push({ level, node: parent[h[2]] });
      continue;
    }
    const k = line.match(KEY_LINE);
    if (k) {
      const node = stack[stack.length - 1].node;
      const key = k[1] === BLANK ? '' : k[1];
      if (Object.hasOwn(node, key)) throw new Error(`duplicate key ${k[1]}`);
      node[key] = k[2] ?? '';
      continue;
    }
    // A plain "- item" line under a group makes that group a list (used for format examples).
    const item = line.match(/^- (.+)$/);
    if (item && stack.length > 1) {
      const top = stack[stack.length - 1];
      const parent = stack[stack.length - 2].node;
      const key = Object.keys(parent).find((name) => parent[name] === top.node);
      if (!Array.isArray(top.node)) {
        if (Object.keys(top.node).length) throw new Error(`group ${key} mixes keys and list items`);
        top.node = [];
        parent[key] = top.node;
      }
      top.node.push(item[1]);
    }
  }
  return root;
}
