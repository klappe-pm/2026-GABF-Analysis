import YAML from 'yaml';

// Split a markdown document into frontmatter (parsed) and body.
export function parseFrontmatter(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  if (!src.startsWith('---')) return { data: {}, body: src };
  const end = src.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: src };
  const raw = src.slice(3, end).replace(/^\r?\n/, '');
  const after = src.slice(end + 4).replace(/^\r?\n/, '');
  let data = {};
  try {
    data = YAML.parse(raw) ?? {};
  } catch (err) {
    throw new Error(`Invalid frontmatter: ${err.message}`);
  }
  return { data, body: after };
}

export function stringifyFrontmatter(data, body) {
  const yaml = YAML.stringify(data, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.replace(/^\n+/, '')}`;
}
