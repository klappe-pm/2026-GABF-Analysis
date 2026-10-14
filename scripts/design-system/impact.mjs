#!/usr/bin/env node
// Show what a change reaches. Pass a token path (semantic.color.red, color.green.700, type.label),
// a token group prefix (semantic.color), or a component name (status-stamp).
// Lists the tokens that alias it, the components that consume it, the pages that render those
// components, and the content keys those components show.

import { THEMES, buildManifest, loadSpecs, loadTokens, scopeFor } from './lib.mjs';

export function impact(target) {
  const tokens = loadTokens();
  const specs = loadSpecs();
  const manifest = buildManifest(tokens, specs);
  const component = manifest.components.find((c) => c.name === target);
  if (component) {
    const dependents = manifest.components.filter((c) => c.related.includes(component.name)).map((c) => c.name);
    return { target, kind: 'component', spec: component.spec, code: component.code, tokens: component.tokens, content: component.content, pages: component.pages, relatedComponents: dependents };
  }
  // Tokens: the target itself, anything under it as a group, and every alias chain that reaches it.
  const all = new Map();
  for (const theme of [null, ...THEMES]) for (const t of Object.values(theme ? tokens.themes[theme] : tokens.base)) all.set(t.path, t);
  const matches = [...all.keys()].filter((p) => p === target || p.startsWith(`${target}.`));
  if (!matches.length) return { target, kind: 'unknown', error: `no token or component named ${target}` };
  const reached = new Set(matches);
  let grew = true;
  while (grew) {
    grew = false;
    for (const theme of THEMES) {
      const scope = scopeFor(tokens, theme);
      for (const t of Object.values(scope)) {
        if (reached.has(t.path)) continue;
        const refs = JSON.stringify(t.value).match(/\{[^}]+\}/g) ?? [];
        if (refs.some((r) => reached.has(r.slice(1, -1)))) { reached.add(t.path); grew = true; }
      }
    }
  }
  const comps = manifest.components.filter((c) => c.tokens.some((t) => reached.has(t)));
  return {
    target,
    kind: 'token',
    tokens: [...reached].sort(),
    components: comps.map((c) => c.name),
    pages: [...new Set(comps.flatMap((c) => c.pages))].sort(),
    content: [...new Set(comps.flatMap((c) => c.content))].sort(),
  };
}

function main() {
  const target = process.argv[2];
  if (!target) {
    console.log('usage: npm run design-system:impact -- <token path, token group, or component name>');
    process.exit(2);
  }
  const r = impact(target);
  if (r.kind === 'unknown') { console.log(r.error); process.exit(1); }
  for (const [k, v] of Object.entries(r)) {
    if (Array.isArray(v)) {
      console.log(`${k} (${v.length})`);
      for (const item of v) console.log(`  ${item}`);
    } else console.log(`${k}: ${v}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
