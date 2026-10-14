// Shared helpers for the generated Markdown reference files (hop varieties, hop farms, breweries):
// canonical frontmatter, prose that passes the dash rule, relative links, and date handling that
// keeps date-created fixed and moves date-revised only when the content changes.
//
// Dash characters are built from code points so no source line carries one as punctuation.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { ROOT } from './paths.mjs';

const EN = String.fromCharCode(8211);
const EM = String.fromCharCode(8212);
const HY = String.fromCharCode(45);
const DASH_RUN = new RegExp(`[${EN}${EM}]`, 'g');
const SPACED_HYPHEN = new RegExp(`\\s+${HY}+\\s+`, 'g');
const DOUBLE_HYPHEN = new RegExp(`${HY}{2,}`, 'g');

export const TODAY = process.env.GABF_DOC_DATE ?? new Date().toISOString().slice(0, 10);

// The keys every file opens with, in this order. File-specific keys follow, sorted A to Z.
export const CANONICAL_KEYS = ['domain', 'category', 'sub-category', 'topics', 'types', 'date-created', 'date-revised', 'status', 'aliases', 'tags'];

// Text as prose: no em dash, en dash, spaced hyphen or double hyphen, one line.
export function prose(value) {
  return String(value ?? '')
    .replace(DASH_RUN, ', ')
    .replace(SPACED_HYPHEN, ', ')
    .replace(DOUBLE_HYPHEN, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Text inside a Markdown table cell or link label.
export const cell = (value) => prose(value).replace(/\|/g, '&#124;');
export const label = (value) => prose(value).replace(/\[/g, '(').replace(/\]/g, ')');

const lower = (x) => String(x).toLowerCase();
export const sortText = (list) => [...new Set(list)].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : a < b ? -1 : a > b ? 1 : 0));

// Single word values of these keys are written plain, as the existing files do.
const PLAIN_KEYS = ['domain', 'category', 'sub-category', 'status'];

function scalar(v) {
  if (v === null || v === undefined || v === '') return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(String(v));
}

// Frontmatter text for a metadata object. Arrays are deduped and sorted; an empty array is `key: []`.
export function frontmatter(meta) {
  const keys = Object.keys(meta);
  const rest = keys.filter((k) => !CANONICAL_KEYS.includes(k)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const lines = ['---'];
  for (const key of [...CANONICAL_KEYS, ...rest]) {
    if (!(key in meta)) throw new Error(`missing canonical key ${key}`);
    const v = meta[key];
    if (Array.isArray(v)) {
      const items = sortText(v.filter((x) => x !== null && x !== undefined && x !== ''));
      lines.push(items.length ? `${key}:` : `${key}: []`);
      for (const item of items) lines.push(`  - ${scalar(item)}`);
    } else lines.push(`${key}: ${key.startsWith('date-') || (PLAIN_KEYS.includes(key) && /^[A-Za-z][A-Za-z0-9-]*$/.test(String(v))) ? v : scalar(v)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

// The canonical keys shared by every generated file; `extra` adds the file-specific ones.
export function metaFor({ category, subCategory, topics, types, status, aliases = [], tags = [], dates, extra = {} }) {
  return {
    domain: 'beer',
    category,
    'sub-category': subCategory,
    topics,
    types,
    'date-created': dates.created,
    'date-revised': dates.revised,
    status,
    aliases,
    tags,
    ...extra,
  };
}

// ---------- links ----------
// Relative path from one repository file to another, with forward slashes.
export function relPath(fromFile, toFile) {
  const from = dirname(fromFile);
  return relative(from, toFile).split('\\').join('/');
}

export const mdLink = (text, fromFile, toFile) => `[${label(text)}](${relPath(fromFile, toFile)})`;

// ---------- reading and writing ----------
const DATE_LINE = /^(date-created|date-revised): (\S+)$/gm;

export function existingDates(text) {
  const out = {};
  if (!text) return out;
  const head = text.split('\n---')[0];
  for (const m of head.matchAll(DATE_LINE)) out[m[1] === 'date-created' ? 'created' : 'revised'] = m[2];
  return out;
}

// Resolve one file: `render(dates)` returns the full text. date-created is kept from the file on
// disk; date-revised is kept unless the content changed, then it moves to today.
export function settle(relFile, render, { root = ROOT } = {}) {
  const full = resolve(root, relFile);
  const old = existsSync(full) ? readFileSync(full, 'utf8') : null;
  const prior = existingDates(old);
  const created = prior.created ?? TODAY;
  const keep = render({ created, revised: prior.revised ?? TODAY });
  if (old !== null && keep === old) return { text: old, changed: false };
  const moved = render({ created, revised: TODAY });
  return { text: moved, changed: old === null || moved !== old };
}

// Write every settled file (or, with check, only report the stale ones). Returns the stale paths.
export function applyFiles(files, { check = false, root = ROOT } = {}) {
  const stale = [];
  for (const [relFile, render] of files) {
    const { text, changed } = settle(relFile, render, { root });
    if (!changed) continue;
    stale.push(relFile);
    if (!check) {
      const full = resolve(root, relFile);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, text);
    }
  }
  return stale;
}
