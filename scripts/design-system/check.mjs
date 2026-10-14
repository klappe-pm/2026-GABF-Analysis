#!/usr/bin/env node
// Check the design system and the code that implements it. Fails on:
//   a global setting, layout list, or component setting that is unknown, missing, or not an allowed value;
//   a spec missing its identity keys or a valid status (draft, review, approved), or pointing at missing code;
//   a spec body that no longer matches its frontmatter, or a missing component image;
//   a component file with no spec;
//   a text or control color pair in the generated light scheme that fails WCAG 2.2 AA;
//   a font outside Public Sans and Archivo Narrow, or figures asked of Archivo Narrow;
//   a raw color literal in page or component code;
//   any dark theme rule or switch;
//   anything that credits an assistant, model, or tool.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../lib/paths.mjs';
import { staleSpecs } from './build.mjs';
import {
  COMPONENTS_DIR, DS, LAYOUT, SETTINGS, WEB, attributionProblems, darkThemeProblems, design, fontProblems, listFiles,
  loadSpecs, narrowFigureProblems, rawColorProblems, readDoc, rel, statusProblem,
} from './lib.mjs';

export async function runChecks() {
  const d = await design();
  const problems = [];
  const fail = (where, msg) => problems.push(`${where}: ${msg}`);

  // Global settings.
  const settings = existsSync(SETTINGS) ? readDoc(SETTINGS).data : null;
  if (!settings) fail(rel(SETTINGS), 'missing');
  else {
    for (const key of Object.keys(d.GLOBAL)) if (!Object.hasOwn(settings, key)) fail(rel(SETTINGS), `missing setting "${key}"`);
    for (const [key, value] of Object.entries(settings)) {
      const kind = d.globalKind(key);
      if (!kind) { fail(rel(SETTINGS), `unknown setting "${key}"`); continue; }
      const p = d.valueProblem(kind, value);
      if (p) fail(rel(SETTINGS), `${key} ${p}`);
    }
  }

  // Layout.
  const layout = existsSync(LAYOUT) ? readDoc(LAYOUT).data : null;
  if (!layout) fail(rel(LAYOUT), 'missing');
  else {
    for (const key of Object.keys(layout)) if (!d.LAYOUT_KEYS.includes(key)) fail(rel(LAYOUT), `unknown list "${key}"`);
    for (const key of d.LAYOUT_KEYS) {
      const list = layout[key];
      const known = d.layoutIds(key);
      if (!Array.isArray(list)) { fail(rel(LAYOUT), `"${key}" must be a list`); continue; }
      for (const id of list) if (!known.includes(id)) fail(rel(LAYOUT), `"${key}" names ${id}, which does not exist; use: ${known.join(', ')}`);
      for (const id of known) if (!list.includes(id)) fail(rel(LAYOUT), `"${key}" is missing ${id}`);
      if (new Set(list).size !== list.length) fail(rel(LAYOUT), `"${key}" lists an item twice`);
    }
  }

  // Component specs.
  const specs = loadSpecs();
  const codeToSpec = {};
  for (const name of Object.keys(d.COMPONENTS)) if (!specs.some((s) => s.dir === name)) fail(rel(resolve(COMPONENTS_DIR, name)), 'component has no spec.md');
  for (const s of specs) {
    if (!s.exists) { fail(rel(resolve(COMPONENTS_DIR, s.dir)), 'component folder has no spec.md'); continue; }
    const schema = d.COMPONENTS[s.dir];
    if (!schema) { fail(s.spec, `${s.dir} has no settings schema in web/design/schema.ts`); continue; }
    for (const key of d.SPEC_KEYS) if (!Object.hasOwn(s.data, key)) fail(s.spec, `frontmatter is missing ${key}`);
    const statusIssue = statusProblem([...d.STATUSES], s.data);
    if (statusIssue) fail(s.spec, statusIssue);
    if (s.data.name && s.data.name !== s.dir) fail(s.spec, `name ${s.data.name} does not match its folder`);
    for (const [key, kind] of Object.entries(schema)) {
      if (!Object.hasOwn(s.data, key)) { fail(s.spec, `missing setting "${key}"`); continue; }
      const p = d.valueProblem(kind, s.data[key]);
      if (p) fail(s.spec, `${key} ${p}`);
    }
    for (const key of Object.keys(s.data)) if (!d.SPEC_KEYS.includes(key) && !Object.hasOwn(schema, key)) fail(s.spec, `unknown setting "${key}"`);
    if (!existsSync(resolve(COMPONENTS_DIR, s.dir, `${s.dir}.png`))) fail(s.spec, `image ${s.dir}.png is missing: run npm run design-system:images`);
    if (s.data.code) {
      if (!existsSync(resolve(ROOT, s.data.code))) fail(s.spec, `code ${s.data.code} does not exist`);
      else codeToSpec[s.data.code] = s;
    }
  }
  for (const s of await staleSpecs()) fail(s.spec, 'the body does not match the frontmatter: run npm run design-system:build');

  // Contrast in the generated light scheme, including the chart series on the chart card.
  if (settings && !Object.keys(d.GLOBAL).some((k) => d.valueProblem(d.GLOBAL[k], settings[k]))) {
    const g = d.mergeGlobal({}, settings);
    const chart = specs.find((s) => s.dir === 'chart-frame');
    const series = chart ? d.componentSettings('chart-frame', chart.data)['Series colors'] ?? [] : [];
    for (const r of d.contrastReport(d.schemeFor(g), series.map((role) => [role, 'surface']))) {
      if (!r.pass) fail(`contrast ${rel(SETTINGS)}`, `${r.fg} ${r.fgHex} on ${r.bg} ${r.bgHex} is ${r.ratio}:1, needs ${r.min}:1`);
    }
  }

  // Code.
  for (const file of listFiles(resolve(WEB, 'components'), ['.tsx', '.ts'])) {
    if (!codeToSpec[rel(file)]) fail(rel(file), 'component code has no spec in .design/design-system/components');
  }
  const code = [...listFiles(resolve(WEB, 'app'), ['.tsx', '.ts', '.css']), ...listFiles(resolve(WEB, 'components'), ['.tsx', '.ts']), ...listFiles(resolve(WEB, 'lib'), ['.ts']), ...listFiles(resolve(WEB, 'design'), ['.ts', '.tsx', '.css'])];
  for (const file of code) {
    const src = readFileSync(file, 'utf8');
    const path = rel(file);
    const issues = [...fontProblems(src), ...narrowFigureProblems(src), ...darkThemeProblems(src), ...attributionProblems(src)];
    if (!path.startsWith('web/design/')) issues.push(...rawColorProblems(src));
    for (const p of issues) fail(path, p);
  }
  const layoutSrc = readFileSync(resolve(WEB, 'app/layout.tsx'), 'utf8');
  const loaded = [...layoutSrc.matchAll(/import\s*\{([^}]*)\}\s*from\s*'next\/font\/google'/g)].flatMap((m) => m[1].split(',').map((x) => x.trim()).filter(Boolean)).sort();
  if (loaded.join(',') !== 'Archivo_Narrow,Public_Sans') fail('web/app/layout.tsx', `loads ${loaded.join(', ') || 'no fonts'}; the system uses Public Sans and Archivo Narrow`);
  for (const file of listFiles(DS, ['.md'])) for (const p of [...attributionProblems(readFileSync(file, 'utf8')), ...darkThemeProblems(readFileSync(file, 'utf8'))]) fail(rel(file), p);

  return problems;
}

async function main() {
  const problems = await runChecks();
  for (const p of problems) console.log(p);
  console.log(`design system check: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
  process.exit(problems.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
