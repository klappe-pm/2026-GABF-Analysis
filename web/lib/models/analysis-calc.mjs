// The aggregations behind the category and analysis pages. They take medal rows already narrowed by the global
// filter and return plain records, so a client view and tests/site-analysis.test.mjs run the same code. No
// visible words live here: labels and sentences come from the copy documents in the pages.

import { medalRates } from '../../../site/assets/rates.mjs';
import { compareLabels } from '../../../site/assets/sort-order.mjs';
import { includesPartial } from '../filter-model.mjs';

export { medalRates };

export const TREND_FAMILIES = 7;
export const TOP_BREWERIES = 50;
export const CHART_BREWERIES = 15;
export const STATE_BARS = 20;
export const ODDS_BARS = 20;
export const MOST_ENTERED_BARS = 20;
const RANK = { Gold: 0, Silver: 1, Bronze: 2 };
const INDEPENDENT = ['independent', 'employee-owned', 'unlisted'];

export const medalSplit = (rows) => ['Gold', 'Silver', 'Bronze'].map((m) => rows.filter((x) => x.medal === m).length);

// [label, count] pairs, most first, ties by label.
export function countBy(rows, field) {
  const m = new Map();
  for (const x of rows) m.set(x[field], (m.get(x[field]) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || compareLabels(a[0], b[0]));
}

// Years a chart shows: the picked year, or every loaded year minus partial years unless they are in view.
export function yearsInView(meta, state = {}) {
  if (state.year) return [Number(state.year)];
  return (meta?.years ?? []).filter((y) => includesPartial(state) || meta.coverage?.[y] !== 'partial');
}

export const newestFirst = (a, b) => b.year - a.year || (RANK[a.medal] ?? 9) - (RANK[b.medal] ?? 9);

// ---------- categories ----------

// One entry per category with medals in view: what the categories table and the family chart read.
export function categoryRollup(rows) {
  const agg = new Map();
  for (const x of rows) {
    const cur = agg.get(x.category_name) ?? { name: x.category_name, slug: x.category_slug, special: x.special, style_family: x.style_family, abv_min: x.abv_min, abv_max: x.abv_max, medals: 0, years: new Set(), latest: null, latestYear: null };
    cur.medals += 1;
    cur.years.add(x.year);
    if (x.entries && (!cur.latestYear || x.year > cur.latestYear)) { cur.latest = x.entries; cur.latestYear = x.year; }
    agg.set(x.category_name, cur);
  }
  return [...agg.values()].map((c) => ({ ...c, years: [...c.years].sort((a, b) => a - b) })).sort((a, b) => compareLabels(a.name, b.name));
}

// A category's years in view, oldest first: the category number, the entry count, and the medals.
export function categoryYears(rows) {
  const perYear = new Map();
  for (const x of rows) if (!perYear.has(x.year)) perYear.set(x.year, { year: x.year, entries: x.entries, number: x.category_number, medals: [] });
  for (const x of rows) perYear.get(x.year).medals.push(x);
  return [...perYear.values()].sort((a, b) => a.year - b.year);
}

// Categories with an entry count, latest year in view first by count, plus medals per category.
export function mostEntered(rows) {
  const latest = new Map();
  const medalsBy = new Map();
  for (const x of rows) {
    medalsBy.set(x.category_name, (medalsBy.get(x.category_name) ?? 0) + 1);
    if (!x.entries) continue;
    const cur = latest.get(x.category_name);
    if (!cur || x.year > cur.year) latest.set(x.category_name, { name: x.category_name, slug: x.category_slug, special: x.special, style_family: x.style_family, entries: x.entries, year: x.year, abv_min: x.abv_min, abv_max: x.abv_max });
  }
  return { list: [...latest.values()].sort((a, b) => b.entries - a.entries), medalsBy };
}

// Entries per medal by category, pooled over the years in view. Rows with no official entry count are left out
// and counted in `missing`.
export function oddsItems(rows) {
  const m = new Map();
  let missing = 0;
  for (const x of rows) {
    if (!x.entries || !x.category_medals) { missing += 1; continue; }
    const cur = m.get(x.category_name) ?? { label: x.category_name, slug: x.category_slug, entries: 0, medals: 0, seen: new Set() };
    if (!cur.seen.has(x.year)) { cur.seen.add(x.year); cur.entries += x.entries; cur.medals += x.category_medals; }
    m.set(x.category_name, cur);
  }
  const list = [...m.values()].map((c) => ({ label: c.label, slug: c.slug, value: Number((c.entries / c.medals).toFixed(1)), entries: c.entries, medals: c.medals, years: [...c.seen].sort((a, b) => a - b).join(', ') })).sort((a, b) => b.value - a.value);
  return { list, missing };
}

// ---------- breweries ----------

export function aggregateBreweries(rows) {
  const m = new Map();
  for (const x of rows) {
    const cur = m.get(x.brewery_key) ?? { key: x.brewery_key, name: x.brewery_name, slug: x.brewery_slug, medals: 0, points: 0, g: 0, s: 0, b: 0, first: x.year };
    cur.medals += 1;
    cur.points += x.points;
    if (x.medal === 'Gold') cur.g += 1;
    if (x.medal === 'Silver') cur.s += 1;
    if (x.medal === 'Bronze') cur.b += 1;
    cur.first = Math.min(cur.first, x.year);
    m.set(x.brewery_key, cur);
  }
  return [...m.values()].sort((a, b) => b.points - a.points || b.medals - a.medals || a.name.localeCompare(b.name));
}

// ---------- places ----------

// Population and real GDP summed over the states in each Census region or division.
export function groupIndicators(states, indicators, key) {
  const out = {};
  for (const s of states) {
    const g = s[key];
    const series = indicators?.[s.state] ?? {};
    for (const ind of ['population', 'gdp_real']) {
      for (const [y, v] of Object.entries(series[ind] ?? {})) {
        const target = ((out[g] ??= {})[ind] ??= {});
        target[y] = (target[y] ?? 0) + v;
      }
    }
  }
  return out;
}

export function stateRollup(rows, states, indicators, latest) {
  const rates = medalRates(rows, (x) => x.state, indicators);
  return states.map((s) => {
    const ms = rows.filter((x) => x.state === s.state);
    const rate = rates.get(s.state);
    return { ...s, medals: ms.length, split: medalSplit(ms), breweries: new Set(ms.map((m) => m.brewery_key)).size, latest: ms.filter((m) => m.year === latest).length, per_million: rate?.per_million ?? 0, per_100b: rate?.per_100b_gdp ?? 0, pop_latest: indicators?.[s.state]?.population?.[latest] ?? null };
  }).filter((s) => s.medals > 0).sort((a, b) => b.medals - a.medals);
}

export function groupRollup(rows, key, states, indicators, unknown) {
  const rates = medalRates(rows, (x) => x[key], groupIndicators(states, indicators, key));
  const m = new Map();
  for (const x of rows) {
    const k = x[key] || unknown;
    const cur = m.get(k) ?? { name: k, medals: 0, split: [0, 0, 0], breweries: new Set(), states: new Set() };
    cur.medals += 1;
    const i = RANK[x.medal];
    if (i !== undefined) cur.split[i] += 1;
    cur.breweries.add(x.brewery_key);
    cur.states.add(x.state);
    m.set(k, cur);
  }
  return [...m.values()].map((c) => ({ ...c, breweries: c.breweries.size, states: c.states.size, per_million: rates.get(c.name)?.per_million ?? 0 })).sort((a, b) => b.medals - a.medals);
}

// ---------- ownership ----------

export function ownershipRollup(rows, ownershipKeys) {
  const independent = rows.filter((x) => INDEPENDENT.includes(x.ownership_type)).length;
  const owned = new Set(rows.filter((x) => !INDEPENDENT.includes(x.ownership_type)).map((x) => x.brewery_key));
  const listed = new Set(rows.filter((x) => ownershipKeys.includes(x.brewery_key)).map((x) => x.brewery_key)).size;
  return { independent, ownedBreweries: owned.size, listed, owned };
}

// ---------- trends ----------

// Medals per year for the top families in view plus Other, one series each.
export function familySeries(rows, years, count = TREND_FAMILIES) {
  const top = countBy(rows, 'style_family').slice(0, count).map(([k]) => k);
  return [...top, null].map((family) => ({
    family,
    data: years.map((y) => rows.filter((x) => x.year === y && (family === null ? !top.includes(x.style_family) : x.style_family === family)).length),
  }));
}

// Breweries that gained or lost the most medals between the last two complete years in view.
export function movers(rows, years, coverage) {
  const complete = years.filter((y) => coverage[y] === 'complete' && rows.some((x) => x.year === y));
  if (complete.length < 2) return null;
  const [previous, year] = complete.slice(-2);
  const names = new Map(rows.map((x) => [x.brewery_key, { name: x.brewery_name, slug: x.brewery_slug }]));
  const diffs = [...names.keys()].map((k) => ({ ...names.get(k), d: rows.filter((x) => x.brewery_key === k && x.year === year).length - rows.filter((x) => x.brewery_key === k && x.year === previous).length })).filter((x) => x.d !== 0).sort((a, b) => b.d - a.d);
  return { previous, year, gained: diffs.slice(0, 10).filter((x) => x.d > 0), lost: diffs.slice(-10).reverse().filter((x) => x.d < 0) };
}
