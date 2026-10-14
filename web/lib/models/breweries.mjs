// The breweries lane's build time data: the breweries index, one brewery's page, and the first time
// medalists of the latest year. It returns plain records and raw values, never English; the pages put every
// word in from the copy documents.
//
// A brewery type, a kitchen, or a founding year the data does not hold stays null here, and the page writes
// "Not Found". A null type also marks the estimates as using an assumed generic type.

import { filterRow, medalRows, notesHtml, site, WINNER_YEAR } from '../site-model.mjs';
import { buildGraph, reachOf } from '../../../scripts/lib/doc-graph.mjs';

const KEY = Symbol.for('gabf-analysis.breweries-lane');
const FIRST_TIME_YEAR = WINNER_YEAR;
export const TREND_YEARS = 10;

function lane() {
  const g = globalThis;
  if (!g[KEY]) {
    const { ds } = site();
    const bySlug = new Map(ds.breweries.map((b) => [b.slug, b]));
    const graph = buildGraph(ds);
    const varietySlugs = new Map(ds.hops.varieties.map((v) => [v.name, v.slug]));
    const farmSlugs = new Map(ds.hops.farms.map((f) => [f.name, f.slug]));
    g[KEY] = { bySlug, graph, varietySlugs, farmSlugs };
  }
  return g[KEY];
}

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Everything the explanation of an estimate needs, as raw values: the basis of the barrels, the
// parameters they came from, and the figures each later estimate multiplies.
export function estimateOf(b, params) {
  const est = b.estimate;
  const rev = est.revenue;
  const f = b.financials;
  const type = b.brewery_type ?? null;
  const channelKey = params.ebitda_margin_range_by_channel[b.distribution_channel]
    ? b.distribution_channel
    : (type === 'brewpub' || type === 'taproom' ? 'taproom' : 'self-distribution');
  return {
    basis: est.basis,
    barrels: est.barrels,
    year: est.year ? Number(est.year) : null,
    confidence: est.confidence ?? null,
    range: est.range ?? null,
    perType: params.barrels_by_brewery_type[type] ?? params.barrels_by_brewery_type.default,
    perExtraLocation: params.barrels_per_additional_location,
    locations: b.locations_count,
    type,
    assumed: type === null,
    kitchen: b.has_kitchen === undefined ? null : b.has_kitchen,
    channel: b.distribution_channel || null,
    channelKey,
    employees: b.employees ?? null,
    revenue: {
      basis: rev.basis,
      total: rev.total_revenue_usd,
      low: rev.low_usd,
      high: rev.high_usd,
      perBarrel: rev.revenue_per_barrel_usd ?? null,
      food: rev.food_revenue_usd ?? 0,
      foodPerLocation: params.food_revenue_per_kitchen_location,
      lowMultiplier: params.revenue_range_low_multiplier,
      highMultiplier: params.revenue_range_high_multiplier,
    },
    fin: {
      arr: f.arr_usd,
      grossMargin: f.gross_margin,
      grossProfit: f.gross_profit_usd,
      ebitdaMargin: f.ebitda_margin,
      ebitdaLowMargin: f.ebitda_margin_low,
      ebitdaHighMargin: f.ebitda_margin_high,
      ebitda: f.ebitda_usd,
      ebitdaLow: f.ebitda_low_usd,
      ebitdaHigh: f.ebitda_high_usd,
      perBarrel: f.revenue_per_barrel_usd ?? null,
      cogsPerBarrel: f.cogs_per_barrel_usd,
      perLocation: f.revenue_per_location_usd ?? null,
      perEmployee: f.revenue_per_employee_usd ?? null,
    },
    volume: {
      gallons: est.volume.gallons,
      cases: est.volume.cases_24x12_equivalent,
      cans: est.volume.cans_16oz_equivalent,
      pints: est.volume.pints_equivalent_draft,
      packagedShare: est.volume.packaged_share,
    },
  };
}

// ---------- the index ----------

const slimForArr = (e) => ({
  basis: e.basis, barrels: e.barrels, year: e.year, confidence: e.confidence, range: e.range, perType: e.perType, perExtraLocation: e.perExtraLocation,
  locations: e.locations, type: e.type, assumed: e.assumed, kitchen: e.kitchen, channel: e.channel, channelKey: e.channelKey, employees: e.employees,
  revenue: e.revenue, fin: { arr: e.fin.arr },
});

// The medal rows, and the attributes of every brewery that has medals. The page ranks them under the filter.
export function breweriesIndex() {
  const { ds } = site();
  const { params } = ds;
  const info = {};
  for (const b of ds.breweries) {
    if (!b.medals.length) continue;
    info[b.key] = {
      key: b.key,
      slug: b.slug,
      name: b.name,
      hq: [b.hq.city, b.hq.state].filter(Boolean).join(', '),
      type: b.brewery_type ?? null,
      ownership: b.ownership?.ownership_type ?? 'unlisted',
      deepDive: Boolean(b.profile),
      // The index explains only the ARR estimate, so the rest of the figures stay out of the page.
      est: slimForArr(estimateOf(b, params)),
    };
  }
  const rows = medalRows().map((r) => ({ ...filterRow(r, ['points', 'brewery_slug']) }));
  return { rows, info };
}

// ---------- one brewery ----------

export function breweryRecord(slug) {
  const { bySlug, graph, varietySlugs, farmSlugs } = lane();
  const { ds } = site();
  const b = bySlug.get(slug);
  if (!b) return null;
  const o = b.ownership;
  const links = b.links ?? {};
  const locations = b.location_list.length
    ? b.location_list.map((l) => ({ name: text(l.name), address: text(l.address), city: text(l.city), state: text(l.state), postal: text(l['postal-code']), opened: l.opened ? String(l.opened) : null, kitchen: Boolean(l.kitchen), lat: null, lon: null }))
    : (b.enriched?.locations ?? []).map((l) => ({ name: text(l.label || l.name), address: text(l.address_1 ?? l.street), city: text(l.city), state: text(l.state ?? l.state_province), postal: text(l.postal_code), opened: null, kitchen: false, lat: l.latitude ?? null, lon: l.longitude ?? null }));

  const reach = reachOf(graph, b.slug);
  const hopLinks = {};
  const hopFarms = {};
  for (const slot of reach.varieties.values()) {
    const v = slot.variety;
    hopLinks[v.name] = v.slug;
    hopFarms[v.name] = [...v.farms.values()].map((x) => ({ name: x.farm.name, slug: x.farm.slug }));
  }
  const named = {};
  for (const n of reach.named.values()) named[n.farm.name] = { slug: n.farm.slug, hops: [...n.varieties].map((s) => [...reach.varieties.values()].find((x) => x.variety.slug === s)?.variety.name).filter(Boolean) };
  const profiles = site().profiles;

  const rows = medalRows({ brewery_key: b.key }).map((r) => {
    const stem = r.beer_profile ? r.beer_profile.split('/').filter(Boolean).at(-1) : null;
    const fm = stem ? profiles.get(stem)?.fm : null;
    const list = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
    return {
      ...filterRow(r, ['category_slug', 'category_number', 'entries', 'category_medals', 'special', 'abv', 'ibu', 'beer_style', 'tasting_note', 'tasting_source', 'beer_url']),
      stem,
      malts: fm ? list(fm.malts) : [],
      yeast: fm ? list(fm.yeast) : [],
      adjuncts: fm ? list(fm.adjuncts) : [],
    };
  });

  const farmSlugOf = (name) => farmSlugs.get(name) ?? null;
  const trend = b.trend.slice(-TREND_YEARS).map((t) => ({ year: t.year, status: t.status, gold: t.gold, silver: t.silver, bronze: t.bronze, total: t.total }));

  const currentBeers = [];
  const groups = new Map();
  for (const c of b.current_beers ?? []) {
    const k = `${c.source}|${c.as_of}`;
    if (!groups.has(k)) groups.set(k, { source: c.source, asOf: c.as_of, beers: [] });
    groups.get(k).beers.push({ name: c.beer_name, style: text(c.style), abv: text(c.abv) });
  }
  currentBeers.push(...groups.values());

  const styleFamilies = new Map();
  for (const m of b.medals) styleFamilies.set(m.style_family, (styleFamilies.get(m.style_family) ?? 0) + 1);

  return {
    key: b.key,
    slug: b.slug,
    name: b.name,
    hq: { city: b.hq.city || null, state: b.hq.state || null },
    founded: b.founded,
    employees: b.employees,
    type: b.brewery_type ?? null,
    kitchen: b.has_kitchen === undefined ? null : b.has_kitchen,
    website: text(b.website),
    links: { instagram: text(links.instagram), untappd: text(links.untappd), beeradvocate: text(links.beeradvocate), checked: text(links.checked) },
    streak: b.streak,
    knownFor: b.known_for ?? [],
    topFamilies: [...styleFamilies].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k]) => k),
    locations,
    locationsCount: b.locations_count,
    channel: b.distribution_channel || null,
    ownership: o ? {
      type: o.ownership_type,
      parent: text(o.parent),
      parentType: text(o.parent_type),
      investor: text(o.investor),
      stake: text(o.stake),
      dealYear: text(o.deal_year),
      baIndependent: text(o.ba_independent),
      status: text(o.status),
      source: text(o.source),
      verified: o.verified === 'yes' ? 'yes' : 'no',
    } : null,
    distributors: b.distributors.map((d) => ({ channel: text(d.channel), distributor: text(d.distributor), territory: text(d.territory), since: text(d.since), verified: d.verified === 'yes' ? 'yes' : 'no', notes: text(d.notes), source: text(d.source) })),
    currentBeers,
    otherMedals: [...b.other_medals].sort((x, y) => y.year - x.year).map((m) => ({ year: m.year, competition: m.competition, medal: m.medal, beer: m.beer_name, city: m.city, state: m.state, category: m.category_name })),
    estimate: estimateOf(b, ds.params),
    trend,
    firstYear: b.first_year,
    lastYear: b.last_year,
    hopLinks,
    hopFarms,
    namedFarms: named,
    farmSlugs: Object.fromEntries([...new Set([...Object.values(hopFarms).flat().map((f) => f.name), ...Object.keys(named)])].map((n) => [n, farmSlugOf(n)])),
    deepDiveHtml: b.profile ? notesHtml(b.profile.body) : null,
    varietySlugs: Object.fromEntries(rows.flatMap((r) => (r.hop_varieties ?? []).map((n) => [n, varietySlugs.get(n) ?? null]))),
    rows,
  };
}

// ---------- first time medalists ----------

export function firstTimeRecord(year = FIRST_TIME_YEAR) {
  const { ds } = site();
  const { partialYears, ambiguous, status } = ds.firstTime;
  const complete = ds.years.filter((y) => ds.coverage[y] === 'complete');
  const pending = ds.years.filter((y) => ds.coverage[y] === 'pending');
  const values = [...status.values()];
  const rows = medalRows({ year: String(year) }).map((r) => filterRow(r, ['first_time', 'brewery_slug', 'category_slug', 'category_number', 'entries', 'abv', 'ibu', 'beer_profile', 'fed_district_name']));
  return {
    year,
    firstYear: ds.years[0],
    lastYear: ds.years[ds.years.length - 1],
    partialYears,
    pendingYears: pending,
    completeRange: complete.length ? { from: complete[0], to: complete[complete.length - 1] } : null,
    newCount: values.filter((s) => s === 'new').length,
    completeCount: values.filter((s) => s === 'new-complete').length,
    ambiguous: ambiguous.map((a) => ({ key: a.key, name: a.name, city: a.city, state: a.state, candidates: a.candidates.map((c) => ({ name: c.name, city: c.city, state: c.state, years: c.years })) })),
    rows,
  };
}
