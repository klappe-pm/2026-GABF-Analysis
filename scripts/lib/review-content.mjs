// Content tagging for the review tools: find the copy entry behind a picked piece of text, show
// every place that holds the same words, and change one value without touching a byte of the
// rest of its Markdown file. The copy lives in .docs/content-management-system/ (one `key`: text
// line per string); scripts/lib/content-md.mjs defines the key mapping and is used here as is.
//
// Nothing here writes unless applyContentEdit is called, and applyContentEdit checks everything it
// is about to change before it writes anything, so a refused edit leaves every file as it was.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { docKeyOf, replaceContentValue, scanContent } from './content-md.mjs';
import { copyProblems } from './copy-rules.mjs';
import { readCsvRecords } from './csv.mjs';
import { parseFrontmatter } from './frontmatter.mjs';

export const CMS_DIR = '.docs/content-management-system';
export const cmsDirOf = (root, env = process.env) => resolve(env.GABF_CMS_DIR || resolve(root, CMS_DIR));

const COPY_FOLDERS = ['pages', 'global'];

const walk = (dir, keep, out = []) => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) walk(full, keep, out);
    else if (keep(full)) out.push(full);
  }
  return out;
};

// Every string of every copy document, with the file and line it sits on. The absence of the copy
// folder is not an error: CI has no .docs/, and the reader then simply finds nothing.
export function loadCopy(cmsDir) {
  const entries = [];
  for (const folder of COPY_FOLDERS) {
    for (const file of walk(resolve(cmsDir, folder), (f) => f.endsWith('.md')).sort()) {
      const rel = relative(cmsDir, file);
      const prefix = docKeyOf(rel);
      for (const e of scanContent(readFileSync(file, 'utf8'))) entries.push({ key: `${prefix}.${e.key}`, name: e.name, file: rel.split('\\').join('/'), line: e.line, value: e.value });
    }
  }
  return entries;
}

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A value may carry {{token}} placeholders that data fills in; as a pattern each stands for any text.
function valuePattern(value) {
  const parts = norm(value).split(/\{\{[^}]+\}\}/).map(escapeRe);
  return new RegExp(`^${parts.join('.+?')}$`, 'i');
}

// The copy entries behind a piece of visible text: entries whose value is exactly that text first,
// then entries whose value sits inside a larger piece of text (a picked section, not a line). The
// inventory maps the old built text to its key, which finds an entry whose value has since changed.
export function matchContent(text, copy, inventory = []) {
  const t = norm(text);
  if (!t) return [];
  // A value that is only placeholders ({{year}}) would match any text; it needs words of its own.
  const literal = (e) => norm(e.value.replace(/\{\{[^}]+\}\}/g, ''));
  // With placeholders the words of the entry must make up most of the text, or "Great American
  // Beer Festival {{year}}" would claim any heading that starts the same way.
  const fits = (e) => !/\{\{/.test(e.value) || literal(e).length / t.length >= 0.7;
  const exact = copy.filter((e) => e.value && literal(e).length >= 3 && fits(e) && valuePattern(e.value).test(t)).map((e) => ({ ...e, match: 'exact' }));
  const seen = new Set(exact.map((e) => e.key));
  for (const row of inventory) {
    if (norm(row.current_text) !== t || !row.new_key || seen.has(row.new_key)) continue;
    const hit = copy.find((e) => e.key === row.new_key);
    if (hit) { exact.push({ ...hit, match: 'inventory' }); seen.add(hit.key); }
  }
  if (exact.length) return exact;
  return copy
    .filter((e) => norm(e.value).length >= 12 && !/\{\{/.test(e.value) && t.includes(norm(e.value)))
    .sort((a, b) => b.value.length - a.value.length)
    .slice(0, 4)
    .map((e) => ({ ...e, match: 'inside' }));
}

export function loadInventory(cmsDir) {
  const file = resolve(cmsDir, 'inventory.csv');
  return existsSync(file) ? readCsvRecords(readFileSync(file, 'utf8')) : [];
}

// ---------- where else the same words live ----------

const SOURCE_ROOTS = ['site', 'scripts', 'web'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'out', 'dist', 'dist-review', 'dist-hosted', 'review']);
const SOURCE_FILE = /\.(mjs|js|ts|tsx|css|html)$/;
// Generated, or the review tools themselves: never a place the site's copy is written by hand.
const SKIP_FILES = /(^|\/)(scripts\/(review-|lib\/review-|lib\/copy-rules|lib\/content-md)|site\/standalone\/)/;

export function sourceFiles(root) {
  const files = [];
  for (const top of SOURCE_ROOTS) {
    const base = resolve(root, top);
    const stack = [base];
    while (stack.length) {
      const dir = stack.pop();
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir)) {
        const full = resolve(dir, name);
        if (statSync(full).isDirectory()) { if (!SKIP_DIRS.has(name)) stack.push(full); continue; }
        const rel = relative(root, full).split('\\').join('/');
        if (SOURCE_FILE.test(name) && !SKIP_FILES.test(rel)) files.push(rel);
      }
    }
  }
  return files.sort();
}

const LEFT = new Set(["'", '"', '`', '>']);
const RIGHT = new Set(["'", '"', '`', '<']);

// Occurrences of the text standing alone in a string literal or between tags: bounded on both
// sides, so "Menu" inside "Menu button" or a longer sentence is not an instance.
export function findLiterals(source, text) {
  const hits = [];
  if (!text) return hits;
  let from = 0;
  for (;;) {
    const at = source.indexOf(text, from);
    if (at === -1) break;
    from = at + text.length;
    const left = source[at - 1];
    const right = source[at + text.length];
    if (!LEFT.has(left) || !RIGHT.has(right)) continue;
    if ((left === '>') !== (right === '<')) continue;
    const line = source.slice(0, at).split('\n').length;
    hits.push({ index: at, line, delimiter: left });
  }
  return hits;
}

// The new text, written the way the old text's quote needs it.
export function escapeFor(delimiter, text) {
  if (delimiter === '>') return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (delimiter === '`') return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return text.replace(/\\/g, '\\\\').replace(new RegExp(delimiter, 'g'), `\\${delimiter}`);
}

// Other copy keys and hard coded strings that hold the identical text. Each carries an id the
// panel uses as its checkbox value.
export function findInstances(root, cmsDir, primary, old, { copy = loadCopy(cmsDir), files = sourceFiles(root) } = {}) {
  const out = [];
  if (norm(old).length < 3) return out;
  for (const e of copy) if (e.key !== primary.key && e.value === old) out.push({ id: `cms:${e.key}`, kind: 'copy', key: e.key, file: `${CMS_DIR}/${e.file}`, line: e.line + 1, excerpt: e.value });
  for (const rel of files) {
    const source = readFileSync(resolve(root, rel), 'utf8');
    const lines = source.split('\n');
    for (const h of findLiterals(source, old)) out.push({ id: `src:${rel}:${h.index}`, kind: 'source', file: rel, line: h.line, excerpt: lines[h.line - 1].trim().slice(0, 120) });
  }
  return out;
}

// Everything that renders a key: the design system components that list it, the screens whose
// manifest copy carries its text, the page its file belongs to, and the files that read it by key.
export function usedBy(root, cmsDir, primary, old, manifest = null, { files = sourceFiles(root) } = {}) {
  const components = [];
  const specRoot = resolve(root, '.design/design-system/components');
  if (existsSync(specRoot)) {
    for (const name of readdirSync(specRoot).sort()) {
      const spec = resolve(specRoot, name, 'spec.md');
      if (!existsSync(spec)) continue;
      const { data } = parseFrontmatter(readFileSync(spec, 'utf8'));
      if ((data.content ?? []).includes(primary.key)) components.push(name);
    }
  }
  const screens = [];
  if (manifest) {
    const copyNodes = Object.entries(manifest.nodes).filter(([id, n]) => id.startsWith('copy:') && norm(n.content) === norm(old)).map(([id]) => id);
    for (const [id, n] of Object.entries(manifest.nodes)) if (id.startsWith('screen:') && n.consumes.some((c) => copyNodes.includes(c))) screens.push(id.slice('screen:'.length));
  }
  const group = primary.key.split('.')[0];
  const pages = group === 'pages' ? [primary.key.split('.')[1]] : ['every page'];
  const readers = [];
  for (const rel of files) if (readFileSync(resolve(root, rel), 'utf8').includes(`'${primary.key}'`) || readFileSync(resolve(root, rel), 'utf8').includes(`"${primary.key}"`)) readers.push(rel);
  return { components, screens, pages, readers };
}

// ---------- the edit ----------

export function checkEdit({ copy, key, newValue }) {
  const primary = copy.find((e) => e.key === key);
  if (!primary) return { problems: [`No copy entry ${key}.`], primary: null };
  return { problems: copyProblems(newValue, { previous: primary.value }), primary };
}

// Validate, then write: the new value into the key's file, the same value into each checked copy
// key, and into each checked hard coded string, all in source files and never in generated output.
// `sanitize` is the engine's secret scan; a value it would change is refused, not redacted.
export function applyContentEdit(root, { cmsDir = cmsDirOf(root), key, newValue, take = [], sanitize }) {
  const copy = loadCopy(cmsDir);
  const { problems, primary } = checkEdit({ copy, key, newValue });
  const clean = sanitize ? sanitize(String(newValue)) : { text: String(newValue), redacted: [] };
  if (clean.redacted.length) problems.push('The copy contains a value shaped like a secret. It is not written.');
  if (problems.length) {
    const error = new Error(problems[0]);
    error.problems = problems;
    throw error;
  }
  const old = primary.value;
  if (old === newValue) { const error = new Error('The new copy is the same as the current copy.'); error.problems = [error.message]; throw error; }
  const instances = findInstances(root, cmsDir, primary, old, { copy }).filter((i) => take.includes(i.id));

  // Plan every write in memory first.
  const files = new Map();
  const text = (abs) => { if (!files.has(abs)) files.set(abs, readFileSync(abs, 'utf8')); return files.get(abs); };
  const plan = [];
  const cmsEdits = [{ entry: primary }, ...instances.filter((i) => i.kind === 'copy').map((i) => ({ entry: copy.find((e) => e.key === i.key) }))];
  for (const { entry } of cmsEdits) {
    const abs = resolve(cmsDir, entry.file);
    files.set(abs, replaceContentValue(text(abs), entry.line, entry.name, old, newValue));
    plan.push({ kind: 'copy', key: entry.key, file: `${CMS_DIR}/${entry.file}`, line: entry.line + 1 });
  }
  const spans = new Map();
  for (const i of instances.filter((x) => x.kind === 'source')) {
    const abs = resolve(root, i.file);
    const index = Number(i.id.slice(i.id.lastIndexOf(':') + 1));
    const source = text(abs);
    if (source.slice(index, index + old.length) !== old) throw new Error(`${i.file} changed since it was read; the string at line ${i.line} is no longer the old copy`);
    if (!spans.has(abs)) spans.set(abs, []);
    spans.get(abs).push({ index, delimiter: source[index - 1], file: i.file, line: i.line });
  }
  for (const [abs, list] of spans) {
    let source = text(abs);
    for (const s of list.sort((a, b) => b.index - a.index)) {
      source = source.slice(0, s.index) + escapeFor(s.delimiter, newValue) + source.slice(s.index + old.length);
      plan.push({ kind: 'source', file: s.file, line: s.line });
    }
    files.set(abs, source);
  }
  for (const [abs, body] of files) writeFileSync(abs, body);
  return { key, file: `${CMS_DIR}/${primary.file}`, old, new: newValue, instances: plan.filter((p) => p.key !== key) };
}
