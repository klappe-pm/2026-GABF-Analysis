#!/usr/bin/env node
// Convert the us-atlas pre-projected (Albers USA composite) states TopoJSON into the
// GeoJSON that ECharts registers as the "usa" map. The y axis is flipped because the
// atlas uses screen coordinates (y down) and ECharts treats coordinates as y up.
// Output: site/assets/us-states.geo.json (committed, about 200 KB).

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { feature } from 'topojson-client';
import { ROOT, SITE } from './lib/paths.mjs';

const require = createRequire(import.meta.url);

export function buildGeo() {
  const topo = JSON.parse(readFileSync(require.resolve('us-atlas/states-albers-10m.json'), 'utf8'));
  const geo = feature(topo, topo.objects.states);
  const flip = (coords) => (typeof coords[0] === 'number' ? [Math.round(coords[0] * 100) / 100, Math.round(-coords[1] * 100) / 100] : coords.map(flip));
  for (const f of geo.features) {
    f.geometry.coordinates = flip(f.geometry.coordinates);
    f.properties = { name: f.properties.name };
  }
  const out = resolve(SITE, 'assets', 'us-states.geo.json');
  writeFileSync(out, JSON.stringify(geo));
  return { out, features: geo.features.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = buildGeo();
  console.log(`wrote ${r.features} state features to ${r.out.replace(`${ROOT}/`, '')}`);
}
