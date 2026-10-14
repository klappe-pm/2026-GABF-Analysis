// YAML frontmatter, parsed with the yaml library so a block reformatted by Obsidian's property editor
// still reads the same. Used at build time and in the browser.
import { parse } from 'yaml';

export function splitFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  const m = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = parse(m[1]) as unknown;
  return { data: data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}, body: m[2] };
}
