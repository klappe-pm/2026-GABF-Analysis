// Real figures for the chart gallery, computed from the loaded dataset (data/results and
// data/reference). Nothing here is typed in by hand except the tile positions, which are layout.

import { loadDataset } from '../lib/data-model.mjs';

const MEDALS = ['Gold', 'Silver', 'Bronze'];

// Column and row of each state on an eleven by eight tile grid (north at the top, west at the left).
export const TILES = {
  AK: [0, 0], ME: [10, 0],
  VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  HI: [0, 7], TX: [3, 7], FL: [8, 7],
};

const count = (rows, pick) => {
  const m = new Map();
  for (const r of rows) m.set(pick(r), (m.get(pick(r)) ?? 0) + 1);
  return m;
};

export function galleryData(ds = loadDataset()) {
  const rows = ds.results.filter((r) => MEDALS.includes(r.medal));
  const coverage = Object.fromEntries(Object.entries(ds.coverage).map(([y, c]) => [Number(y), c]));
  const rowYears = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const completeYears = rowYears.filter((y) => coverage[y] === 'complete');
  const partialYears = rowYears.filter((y) => coverage[y] !== 'complete');
  const tally = (list) => ({ gold: list.filter((r) => r.medal === 'Gold').length, silver: list.filter((r) => r.medal === 'Silver').length, bronze: list.filter((r) => r.medal === 'Bronze').length, total: list.length });

  const years = rowYears.map((y) => ({ year: y, coverage: coverage[y], ...tally(rows.filter((r) => r.year === y)) }));

  const regions = [...new Set(rows.map((r) => r.region))].filter(Boolean).sort();
  const regionCounts = regions.map((region) => ({ region, counts: completeYears.map((y) => rows.filter((r) => r.year === y && r.region === region).length) }));
  const regionRanks = completeYears.map((_, i) => {
    const sorted = regionCounts.map((r) => r.counts[i]).sort((a, b) => b - a);
    return regionCounts.map((r) => 1 + sorted.findIndex((v) => v === r.counts[i]));
  });

  const stateCounts = count(rows, (r) => r.state);
  const states = ds.states.map((s) => {
    const list = rows.filter((r) => r.state === s.state);
    return { code: s.state, name: s.name, region: s.region, ...tally(list), tile: TILES[s.state] ?? null };
  });

  const famMap = new Map();
  for (const r of rows) {
    const f = famMap.get(r.style_family) ?? { name: r.style_family, medals: 0, categories: new Map() };
    f.medals += 1;
    f.categories.set(r.category_name, (f.categories.get(r.category_name) ?? 0) + 1);
    famMap.set(r.style_family, f);
  }
  const families = [...famMap.values()].sort((a, b) => b.medals - a.medals || a.name.localeCompare(b.name)).map((f) => ({ name: f.name, medals: f.medals, categories: [...f.categories].map(([name, medals]) => ({ name, medals })).sort((a, b) => b.medals - a.medals || a.name.localeCompare(b.name)) }));

  const brewMap = new Map();
  for (const r of rows) {
    const b = brewMap.get(r.brewery_key) ?? { name: r.brewery_name, list: [] };
    b.list.push(r);
    brewMap.set(r.brewery_key, b);
  }
  const breweriesAll = [...brewMap.values()].map((b) => ({ name: b.name, ...tally(b.list), points: b.list.reduce((s, r) => s + r.points, 0), byYear: rowYears.map((y) => b.list.filter((r) => r.year === y).length), byFamily: Object.fromEntries([...count(b.list, (r) => r.style_family)]) })).sort((a, b) => b.points - a.points || b.total - a.total || a.name.localeCompare(b.name));
  const breweries = breweriesAll.slice(0, 15);

  const leaders = breweriesAll.filter((b) => Object.keys(b.byFamily).length >= 3).slice(0, 3);
  const leaderFamily = (f) => leaders.reduce((sum, b) => sum + (b.byFamily[f] ?? 0), 0);
  const topFamilies = families.map((f) => f.name).filter((f) => leaderFamily(f) > 0).sort((a, b) => leaderFamily(b) - leaderFamily(a) || a.localeCompare(b)).slice(0, 8);
  const profile = { families: topFamilies, breweries: leaders.map((b) => ({ name: b.name, total: b.total, counts: topFamilies.map((f) => b.byFamily[f] ?? 0), inTopFamilies: topFamilies.reduce((s, f) => s + (b.byFamily[f] ?? 0), 0) })) };

  // Category crowding: entries judged divided by medals awarded, pooled over complete years only.
  // A partial year carries entry counts for a sample of medals, which would distort the ratio.
  const catMap = new Map();
  for (const r of rows) {
    if (!completeYears.includes(r.year) || !Number(r.entries)) continue;
    const c = catMap.get(r.category_name) ?? { name: r.category_name, family: r.style_family, special: Boolean(r.special), perYear: new Map() };
    const cell = c.perYear.get(r.year) ?? { entries: Number(r.entries), medals: 0 };
    cell.medals += 1;
    c.perYear.set(r.year, cell);
    catMap.set(r.category_name, c);
  }
  const crowding = [...catMap.values()].map((c) => {
    const e = [...c.perYear.values()].reduce((s, v) => s + v.entries, 0);
    const m = [...c.perYear.values()].reduce((s, v) => s + v.medals, 0);
    return { name: c.name, family: c.family, special: c.special, entries: e, medals: m, years: c.perYear.size, perMedal: Math.round((e / m) * 10) / 10, byYear: completeYears.map((y) => (c.perYear.has(y) ? Math.round((c.perYear.get(y).entries / c.perYear.get(y).medals) * 10) / 10 : null)) };
  }).sort((a, b) => b.perMedal - a.perMedal || a.name.localeCompare(b.name));

  return {
    totals: { medals: rows.length, completeYears, partialYears, partialMedals: partialYears.map((y) => ({ year: y, medals: rows.filter((r) => r.year === y).length })) },
    years,
    regions: { names: regions, years: completeYears, series: regionCounts, ranks: regionRanks },
    states: states.filter((s) => s.tile).map((s) => ({ ...s, medals: s.total })),
    stateCountCheck: [...stateCounts.values()].reduce((a, b) => a + b, 0),
    families,
    breweries,
    breweryYears: rowYears,
    profile,
    crowding,
    heatmapYears: completeYears,
  };
}
