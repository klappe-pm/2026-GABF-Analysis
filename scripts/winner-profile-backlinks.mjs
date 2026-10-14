#!/usr/bin/env node
// List the links each 2026 beer profile (docs/2026/winner/*.md) should carry so a reader can move
// from the profile to its brewery, its hop varieties and the hop farms. The profiles are owned by
// another process and are never edited here; this writes a CSV the owner can apply.
//
//   node scripts/winner-profile-backlinks.mjs [output.csv]
//
// Columns: profile_path, link_target, link_kind, link_text, relative_link
//   brewery      the brewery file
//   variety      a hop variety the profile names
//   farm-named   a farm the brewery names for a hop in this profile
//   farm-grown   a farm recorded as growing a variety the profile names (the link runs through the variety)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { toCsv } from './lib/csv.mjs';
import { relPath } from './lib/doc-meta.mjs';
import { PATHS, buildGraph } from './lib/doc-graph.mjs';

export function backlinkRows(graph = buildGraph()) {
  const rows = [];
  for (const beer of [...graph.model.beers.values()].sort((a, b) => (a.stem < b.stem ? -1 : 1))) {
    const profile = PATHS.beer(beer.stem);
    const add = (target, kind, text) => rows.push({ profile_path: profile, link_target: target, link_kind: kind, link_text: text, relative_link: relPath(profile, target) });
    const brewery = graph.breweryBySlug.get(beer.brewery_slug);
    if (brewery) add(PATHS.brewery(brewery.slug), 'brewery', brewery.name);
    const seen = new Set();
    for (const u of beer.usage) {
      if (u.variety.listed && !seen.has(`v|${u.variety.slug}`)) { seen.add(`v|${u.variety.slug}`); add(PATHS.variety(u.variety.docSlug), 'variety', u.variety.name); }
      if (u.farm && !seen.has(`n|${u.farm.slug}`)) { seen.add(`n|${u.farm.slug}`); add(PATHS.farm(u.farm.slug), 'farm-named', u.farm.name); }
    }
    for (const u of beer.usage) {
      for (const { farm } of u.variety.farms.values()) {
        if (seen.has(`g|${farm.slug}`)) continue;
        seen.add(`g|${farm.slug}`);
        add(PATHS.farm(farm.slug), 'farm-grown', farm.name);
      }
    }
  }
  return rows;
}

function main() {
  const out = resolve(process.argv[2] ?? resolve(ROOT, '.docs/research/winner-profile-backlinks.csv'));
  const rows = backlinkRows();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, toCsv(rows, ['profile_path', 'link_target', 'link_kind', 'link_text', 'relative_link']));
  const kinds = rows.reduce((m, r) => ({ ...m, [r.link_kind]: (m[r.link_kind] ?? 0) + 1 }), {});
  console.log(`wrote ${rows.length} rows for ${new Set(rows.map((r) => r.profile_path)).size} profiles to ${out}`, kinds);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
