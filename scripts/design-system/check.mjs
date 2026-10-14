#!/usr/bin/env node
// Check the design system and the code that implements it. Fails on:
//   a token alias that does not resolve, or theme files that define different roles;
//   a declared contrast requirement that a theme does not meet;
//   a spec missing frontmatter or sections, naming an unknown token or content key, or pointing at missing code;
//   a component file with no spec;
//   a raw color, length, radius, shadow, gradient, arbitrary value, or unlisted font in component code;
//   a component using a token its spec does not declare;
//   any stylesheet with a nonzero radius, a shadow, a gradient, or blur;
//   build products that are stale (run npm run design-system:build);
//   a broken hash chain in the local change log.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../lib/paths.mjs';
import { products } from './build.mjs';
import {
  BANNED_FAMILIES, REQUIRED_FRONTMATTER, REQUIRED_SECTIONS, THEMES, WEB, contrastReport, cssProblems,
  listFiles, loadContent, loadFoundations, lookupContent, rawValueProblems, readLog, rel, resolveValue, scopeFor,
  narrowFigureProblems, statusProblem, tokenIndex, usedTokens, verifyChain,
} from './lib.mjs';

export function runChecks() {
  const problems = [];
  const fail = (where, msg) => problems.push(`${where}: ${msg}`);
  const { tokens, specs, files } = products();

  // Tokens resolve, and both themes define the same roles.
  for (const theme of THEMES) {
    const scope = scopeFor(tokens, theme);
    for (const t of Object.values(scope)) {
      try { resolveValue(t.value, scope); } catch (e) { fail(t.file, `${t.path}: ${e.message}`); }
    }
  }
  const [a, b] = THEMES.map((th) => Object.keys(tokens.themes[th] ?? {}).sort().join(','));
  if (a !== b) fail('tokens', 'light and dark theme files define different roles');
  for (const t of Object.values(tokens.base)) if (t.path.startsWith('radius.') && !/^0(px|rem)?$/.test(String(t.value))) fail(t.file, `${t.path} must be 0`);
  for (const t of Object.values(tokens.base)) if (t.type === 'fontFamily') for (const fam of [t.value].flat()) if (BANNED_FAMILIES.includes(fam)) fail(t.file, `${t.path}: ${fam} is not part of the system`);

  // Contrast.
  for (const r of contrastReport(tokens)) if (!r.pass) fail(`contrast ${r.theme}`, `${r.token} on ${r.against} is ${r.ratio}:1, needs ${r.min}:1`);

  // Specs.
  const index = tokenIndex(tokens);
  const allTokens = new Set([...Object.keys(tokens.base), ...Object.keys(tokens.themes.light)]);
  const content = loadContent();
  const codeToSpec = {};
  for (const s of specs) {
    if (!s.exists) { fail(rel(resolve(s.file, '..')), 'component folder has no spec.md'); continue; }
    for (const key of REQUIRED_FRONTMATTER) if (!Object.hasOwn(s.data, key)) fail(s.spec, `frontmatter is missing ${key}`);
    const statusIssue = statusProblem(s.data);
    if (statusIssue) fail(s.spec, statusIssue);
    if (s.data.name && s.data.name !== s.dir) fail(s.spec, `name ${s.data.name} does not match its folder`);
    for (const sec of REQUIRED_SECTIONS) if (!s.sections[sec]) fail(s.spec, `section "${sec}" is missing or empty`);
    for (const t of s.data.tokens ?? []) if (!allTokens.has(t)) fail(s.spec, `token ${t} does not exist`);
    for (const k of s.data.content ?? []) if (typeof lookupContent(content, k) !== 'string') fail(s.spec, `content key ${k} does not exist`);
    for (const r of s.data.related ?? []) if (!specs.some((x) => x.dir === r)) fail(s.spec, `related component ${r} has no spec`);
    if (s.data.code) {
      if (!existsSync(resolve(ROOT, s.data.code))) fail(s.spec, `code ${s.data.code} does not exist`);
      else codeToSpec[s.data.code] = s;
    }
  }
  for (const f of loadFoundations()) { const issue = statusProblem(f.data); if (issue) fail(f.spec, issue); }
  for (const f of loadFoundations()) for (const t of f.data.tokens ?? []) if (!allTokens.has(t.replace(/\.\*$/, '')) && !t.endsWith('.*')) fail(f.spec, `token ${t} does not exist`);

  // Component code: every file has a spec, carries no raw values, and uses only declared tokens.
  for (const file of listFiles(resolve(WEB, 'components'), ['.tsx', '.ts'])) {
    const path = rel(file);
    const spec = codeToSpec[path];
    if (!spec) fail(path, 'component code has no spec in .design/design-system/components');
    const src = readFileSync(file, 'utf8');
    for (const p of [...rawValueProblems(src), ...narrowFigureProblems(src)]) fail(path, p);
    const { used, errors } = usedTokens(file, index);
    for (const e of errors) fail(path, e);
    if (spec) {
      const declared = new Set(spec.data.tokens ?? []);
      for (const t of used) if (!declared.has(t)) fail(path, `uses ${t}, which ${spec.spec} does not declare`);
    }
  }
  // App code (routes and helpers) follows the same raw value and class rules.
  for (const file of [...listFiles(resolve(WEB, 'app'), ['.tsx', '.ts']), ...listFiles(resolve(WEB, 'lib'), ['.tsx', '.ts']), ...listFiles(resolve(WEB, 'design'), ['.ts'])]) {
    const path = rel(file);
    for (const p of [...rawValueProblems(readFileSync(file, 'utf8')), ...narrowFigureProblems(readFileSync(file, 'utf8'))]) fail(path, p);
    for (const e of usedTokens(file, index).errors) fail(path, e);
  }
  for (const file of listFiles(WEB, ['.css'])) {
    const css = readFileSync(file, 'utf8');
    for (const p of cssProblems(css)) fail(rel(file), p);
    if (!file.endsWith('tokens.css')) {
      for (const fam of BANNED_FAMILIES) if (new RegExp(`(^|[^\\w-])${fam}([^\\w-]|$)`).test(css)) fail(rel(file), `font family ${fam} is not part of the system`);
      if (/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))) fail(rel(file), 'raw hex color outside the token build');
    }
  }

  // Build products are current.
  for (const [file, text] of Object.entries(files)) {
    const now = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (now !== text) fail(rel(file), 'stale build product: run npm run design-system:build');
  }

  // Local change log integrity (the log is local and may be absent).
  const chain = verifyChain(readLog());
  if (chain) fail('.docs/design/design-system/changes.jsonl', chain);

  return problems;
}

function main() {
  const problems = runChecks();
  for (const p of problems) console.log(p);
  console.log(`design system check: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
  process.exit(problems.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
