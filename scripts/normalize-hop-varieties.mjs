// Normalize the hop variety names of the winner profiles through the hop alias map
// (data/reference/hop-aliases.csv via scripts/lib/hop-aliases.mjs).
//
// For every hop-profile entry, `variety` becomes the canonical variety the alias map resolves for the
// entry's `published` name (falling back to its current variety); `published` is never changed. The
// `hops` list becomes the sorted set of those varieties plus any hops list name no entry covers, each
// resolved the same way. A name the map does not resolve keeps its current value and is reported, so
// the alias map can add it.
// Usage: node scripts/normalize-hop-varieties.mjs [year]   (then rerun scripts/winner-deep-dive.mjs)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadHopLookup, resolveHop } from './lib/hop-aliases.mjs';
import { orderKeys, serialize, splitDoc } from './winner-deep-dive.mjs';
import { ROOT } from './lib/paths.mjs';

const sortList = (l) => [...new Map(l.map((v) => [String(v).toLowerCase(), v])).values()].sort((a, b) => String(a).toLowerCase().localeCompare(String(b).toLowerCase()));

export function normalizeHops(text, lookup) {
  const { data, blocks, body } = splitDoc(text);
  const unresolved = [];
  const canonical = (name) => {
    const r = resolveHop(name, lookup);
    return r.status === 'mapped' ? r.canonical : null;
  };
  const profile = Array.isArray(data['hop-profile']) ? data['hop-profile'] : [];
  const entries = profile.map((e) => {
    const r = resolveHop(e.published, lookup);
    const c = (r.status === 'mapped' ? r.canonical : null) ?? canonical(e.variety);
    if (!c) unresolved.push(e.published);
    // A product form printed in the published name (Cryo, T90, LUPOMAX) fills an empty form.
    const form = e.form ?? (r.status === 'mapped' && r.form ? r.form : null);
    return { ...e, variety: c ?? e.variety, form };
  });
  const covered = new Set(profile.flatMap((e) => [e.published, e.variety].map((x) => String(x).toLowerCase())));
  const extra = (data.hops ?? []).filter((h) => !covered.has(String(h).toLowerCase())).map((h) => {
    const c = canonical(h);
    if (!c) unresolved.push(h);
    return c ?? h;
  });
  const hops = sortList([...entries.map((e) => e.variety), ...extra]);
  const changed = JSON.stringify(entries) !== JSON.stringify(profile) || JSON.stringify(hops) !== JSON.stringify(data.hops ?? []);
  if (!changed) return { text, changed: false, unresolved };
  if (profile.length) blocks.set('hop-profile', serialize('hop-profile', entries));
  blocks.set('hops', serialize('hops', hops));
  return { text: `---\n${orderKeys([...blocks.keys()]).map((k) => blocks.get(k)).join('')}---\n\n${body.trimEnd()}\n`, changed: true, unresolved };
}

function main() {
  const year = process.argv[2] ?? '2026';
  const dir = resolve(ROOT, 'docs', year, 'winner');
  const lookup = loadHopLookup();
  let n = 0;
  const report = [];
  for (const f of readdirSync(dir).filter((x) => /^\d{3}-.+\.md$/.test(x)).sort()) {
    const path = resolve(dir, f);
    const r = normalizeHops(readFileSync(path, 'utf8'), lookup);
    if (r.changed) { writeFileSync(path, r.text); n += 1; }
    for (const u of r.unresolved) report.push(`${f}: ${u}`);
  }
  console.log(`${n} profiles normalized`);
  for (const line of report) console.log(`not resolved: ${line}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
