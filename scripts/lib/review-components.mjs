// Which design system components a picked spot belongs to. The source map names, for each region
// of a built page, the component it draws (a folder name under .design/design-system/components/)
// and the manifest node it stands for. A ticket links to a component by name; when the component
// has a spec folder the link also carries the path to it, and when it does not the name stands
// alone. A missing .design/ folder is never an error.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const COMPONENTS_DIR = '.design/design-system/components';

export function componentSpec(root, name) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return null;
  const spec = `${COMPONENTS_DIR}/${name}/spec.md`;
  if (existsSync(resolve(root, spec))) return spec;
  return existsSync(resolve(root, COMPONENTS_DIR, name)) ? `${COMPONENTS_DIR}/${name}` : null;
}

export const withSpec = (root, name, instance = null) => ({ name, spec: componentSpec(root, name), ...(instance ? { instance } : {}) });

export function sourceMapEntries(root) {
  const file = resolve(root, 'site/review/source-map.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).entries : [];
}

// The component names for one spot, from the selectors of the source map entries that matched the
// picked element or an ancestor (the widget reports them as `via`). Innermost first. Each carries
// the instance: a selector for the one element of that component that was picked, which a later
// tool can use to tell this figure from another of the same component.
export function componentsForSpot(root, spot, entries = sourceMapEntries(root)) {
  const found = new Map();
  for (const m of spot.matches ?? []) {
    const e = entries.find((x) => x.selector === m.via);
    const name = e?.component ?? (e?.node ? e.node.replace(/^component:/, '') : null);
    if (name && !found.has(name)) found.set(name, typeof m.instance === 'string' ? m.instance : null);
  }
  return [...found].map(([n, instance]) => withSpec(root, n, instance));
}

// A whole page ticket links to what the screen is made of: the manifest components the screen
// consumes, named as the design system names them where the source map knows the pairing.
export function componentsForScreen(root, manifest, screenId, entries = sourceMapEntries(root)) {
  const node = manifest.nodes[`screen:${screenId}`];
  if (!node) return [];
  const byNode = new Map(entries.filter((e) => e.node && e.component).map((e) => [e.node, e.component]));
  const names = [];
  for (const id of node.consumes) {
    if (!id.startsWith('component:')) continue;
    const name = byNode.get(id) ?? id.slice('component:'.length);
    if (!names.includes(name)) names.push(name);
  }
  return names.map((n) => withSpec(root, n));
}

// Every name a ticket could link to, for the panel's add control.
export function knownComponents(root, manifest, entries = sourceMapEntries(root)) {
  const names = new Set();
  const dir = resolve(root, COMPONENTS_DIR);
  if (existsSync(dir)) for (const n of readdirSync(dir)) if (!n.startsWith('.')) names.add(n);
  for (const e of entries) if (e.component) names.add(e.component);
  for (const id of Object.keys(manifest?.nodes ?? {})) if (id.startsWith('component:')) names.add(id.slice('component:'.length));
  return [...names].sort((a, b) => a.localeCompare(b));
}
