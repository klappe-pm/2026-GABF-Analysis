// Build time data for the categories, the analysis reports, and About. Loaded by pages through laneModel('analysis')
// (lib/site-data.ts). Each loader slices the shared dataset (site() in ../site-model.mjs) into the plain records
// one page needs; the filter-dependent aggregation lives in analysis-calc.mjs, which the client views run.

import { breweryInfo, foldCategory } from '../../../scripts/build-site.mjs';
import { slugify } from '../../../scripts/lib/slug.mjs';
import { estimateOf } from './breweries.mjs';
import { filterRow, legacyCategoryNames, site, WINNER_YEAR } from '../site-model.mjs';

export const REPORTS = [
  { slug: 'top-breweries', key: 'top_breweries' },
  { slug: 'top-categories', key: 'top_categories' },
  { slug: 'by-state', key: 'by_state' },
  { slug: 'by-region', key: 'by_region' },
  { slug: 'ownership', key: 'ownership' },
  { slug: 'economics', key: 'economics' },
  { slug: 'trends', key: 'trends' },
  { slug: 'brewery-of-the-year', key: 'brewery_of_the_year' },
];

export const reportParams = () => REPORTS.map((r) => ({ slug: r.slug }));
export const reportKey = (slug) => REPORTS.find((r) => r.slug === slug)?.key ?? null;

const stemOf = (row) => (row.beer_profile ? row.beer_profile.split('/').filter(Boolean).at(-1) : null);
const hopsOf = (stem) => {
  const seen = new Set();
  return (stem ? site().ds.hops.beers.get(stem)?.usage ?? [] : []).filter((u) => !seen.has(u.slug) && seen.add(u.slug)).map((u) => ({ name: u.canonical, slug: u.slug }));
};

// ---------- categories ----------

// Every medal row with what the categories index reads: the filter fields plus the category and its style ranges.
export function categoryRows() {
  return site().payload.results.map((r) => filterRow(r, ['category_slug', 'special', 'entries', 'abv_min', 'abv_max']));
}

export function categoryCount() {
  const cats = site().cats;
  const special = cats.filter((c) => c.special).length;
  return { total: cats.length, special, classic: cats.length - special };
}

// The style description of a category. Names drift between years, so a category without its own description
// borrows the one filed under the same folded name.
function styleRef(c) {
  const { ds } = site();
  if (c.ref?.description) return c.ref;
  const want = foldCategory(c.name);
  const hit = ds.categories.find((row) => row.description && foldCategory(row.category_name) === want);
  return hit ? { ...(c.ref ?? {}), description: hit.description, guideline_source: hit.guideline_source, confidence: hit.confidence, variant_of: hit.category_name } : c.ref;
}

// A style range is shown only when both ends are numbers.
const present = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

// The categories whose address or name changed when the word Style left the names. Each old address (the slug of
// the name as the winners list printed it) points at the category that replaced it, and each old name maps to the
// current one, so a link such as #category_name=American-Style Pilsener still finds its category.
export function legacyCategories() {
  const printed = new Map(Object.entries(legacyCategoryNames()));
  const current = new Set(site().cats.map((c) => c.slug));
  const redirects = new Map();
  for (const [old, name] of printed) {
    const oldSlug = slugify(old);
    const hit = site().cats.find((c) => c.name === name);
    if (hit && !current.has(oldSlug)) redirects.set(oldSlug, { oldSlug, slug: hit.slug, name: hit.name });
  }
  return { redirects: [...redirects.values()], names: Object.fromEntries(printed) };
}

export const legacyCategoryParams = () => legacyCategories().redirects.map((r) => ({ slug: r.oldSlug }));
export const legacyCategory = (slug) => legacyCategories().redirects.find((r) => r.oldSlug === slug) ?? null;

const MEDAL_ORDER = ['Gold', 'Silver', 'Bronze'];

export function category(slug) {
  const c = site().cats.find((x) => x.slug === slug);
  if (!c) return null;
  const ref = styleRef(c);
  const range = (min, max) => (present(min) && present(max) ? { min: String(min), max: String(max) } : null);
  const rows = site().payload.results.filter((r) => r.category_name === c.name).map((r) => {
    const stem = stemOf(r);
    return { ...filterRow(r, ['category_number', 'category_slug', 'entries', 'special', 'brewery_slug', 'city', 'abv', 'ibu']), stem, hops: hopsOf(stem) };
  });
  return {
    name: c.name,
    slug: c.slug,
    special: Boolean(c.special),
    styleFamily: c.style_family,
    latestEntries: c.latest_entries,
    latestEntriesYear: c.latest_entries_year,
    abv: range(ref?.abv_min, ref?.abv_max),
    ibu: range(ref?.ibu_min, ref?.ibu_max),
    srm: range(ref?.srm_min, ref?.srm_max),
    // The beers of the latest winners list that have a profile, in medal order, for the profile cards.
    cardStems: rows.filter((r) => r.year === WINNER_YEAR && r.stem).sort((a, b) => MEDAL_ORDER.indexOf(a.medal) - MEDAL_ORDER.indexOf(b.medal)).map((r) => r.stem),
    description: ref?.description ? String(ref.description) : null,
    source: ref?.guideline_source ? String(ref.guideline_source) : null,
    confidence: ref?.confidence ? String(ref.confidence) : null,
    variant: ref?.variant_of && ref.variant_of !== c.name ? String(ref.variant_of) : null,
    rows,
  };
}

// ---------- reports ----------

// Medal rows for a report with the fields it reads beyond the filter fields.
export function reportRows(extra) {
  return site().payload.results.map((r) => filterRow(r, extra));
}

export function reportMeta() {
  const { ds, payload } = site();
  const { meta } = payload;
  const byState = meta.indicators.state;
  const indicators = Object.fromEntries(meta.states.map((s) => [s.state, { population: byState[s.state]?.population ?? {}, gdp_real: byState[s.state]?.gdp_real ?? {} }]));
  // The latest published year: a year the reference tables fill by repeating the one before it (the tables carry
  // 2025 figures for 2026) is not a published year, so walk back while every state repeats its earlier value.
  const gdp = Object.values(indicators).map((i) => i.gdp_real);
  const yearsWithFigures = [...new Set(gdp.flatMap((g) => Object.keys(g).map(Number)))].sort((a, b) => a - b);
  let dataYear = yearsWithFigures.at(-1) ?? null;
  while (dataYear !== null && yearsWithFigures.includes(dataYear - 1) && gdp.every((g) => g[dataYear] === g[dataYear - 1])) dataYear -= 1;
  return {
    years: meta.years,
    coverage: meta.coverage,
    latestComplete: meta.latest_complete,
    latestYear: Math.max(...meta.years),
    dataYear,
    states: meta.states.map((s) => ({ state: s.state, name: s.name, region: s.region, division: s.division })),
    indicators,
    ownershipKeys: ds.breweries.filter((b) => b.ownership).map((b) => b.key),
  };
}

export const info = () => breweryInfo(site().ds);

// The longest active medal streaks, from the full record (the filter does not change them).
export function streaks() {
  return Object.values(info()).filter((b) => b.streak > 1).sort((a, b) => b.streak - a.streak).slice(0, 10).map((b) => ({ name: b.name, slug: b.slug, streak: b.streak }));
}

export function ownershipTable() {
  const { ds } = site();
  return ds.ownership.map((o) => {
    const b = ds.breweries.find((x) => x.ownership === o);
    return {
      name: o.brewery_name, slug: b?.slug ?? null, hq: [o.hq_city, o.hq_state].filter(Boolean).join(', '), type: o.ownership_type,
      parent: o.parent || null, investor: o.investor || null, stake: o.stake || null, year: o.deal_year ? Number(o.deal_year) : null,
      baIndependent: o.ba_independent || null, status: o.status || null, verified: o.verified === 'yes' ? 'yes' : 'no',
    };
  });
}

export function awardsTable() {
  const { ds } = site();
  const rows = [...ds.awards].sort((a, b) => Number(b.year) - Number(a.year) || a.award.localeCompare(b.award)).map((a) => {
    const b = ds.breweries.find((x) => x.names?.includes?.(a.brewery_name) || x.name === a.brewery_name);
    return { year: Number(a.year), award: a.award, bracket: a.bracket, brewery: a.brewery_printed, slug: b?.slug ?? null, city: [a.city, a.state].filter(Boolean).join(', '), source: a.source };
  });
  return { rows, short: rows.length < 12 };
}

export function scaleTable() {
  const { ds } = site();
  return ds.summary.filter((s) => s.competition === 'GABF').sort((a, b) => Number(a.year) - Number(b.year)).map((s) => {
    const n = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    return { year: Number(s.year), date: s.ceremony_date || null, venue: s.venue || null, entries: n(s.entries), breweriesEntering: n(s.entering_breweries), medals: n(s.medals), winningBreweries: n(s.winning_breweries), categories: n(s.categories), coverage: ds.coverage[s.year] ?? 'pending', notes: s.notes || null };
  });
}

// ---------- about ----------

export function about() {
  const { ds } = site();
  const complete = ds.years.filter((y) => ds.coverage[y] === 'complete');
  const p = ds.params;
  const range = (x) => `${Math.round(x[0] * 100)} to ${Math.round(x[1] * 100)} percent`;
  const channel = p.ebitda_margin_range_by_channel;
  const money = (n) => `${Number(n).toLocaleString('en-US')} USD`;
  return {
    years: ds.years,
    firstYear: ds.years[0],
    lastYear: ds.years.at(-1),
    completeRange: complete.length ? `${complete[0]} to ${complete.at(-1)}` : '',
    coverage: ds.years.map((y) => ({ year: y, status: ds.coverage[y] ?? 'pending', rows: ds.results.filter((x) => x.year === y).length })),
    estimates: {
      direct: money(p.revenue_per_barrel_by_brewery_type.brewpub),
      distributed: money(p.revenue_per_barrel_by_brewery_type.regional),
      taproom: range(channel.taproom),
      self: range(channel['self-distribution']),
      distributor: range(channel.distributor),
    },
  };
}

// ---------- explore ----------

// The category characteristics the Explore page filters on, each found by words in the category name.
export const TRAITS = {
  sour: /\b(sour|wild|gose|lambic|brett|berliner)/i,
  fruit: /\b(fruit|berry|berries|cherry|peach|apple|citrus|pumpkin)/i,
  spice: /\b(herb|spice|chile|chili|ginger|pepper)/i,
  coffee: /\bcoffee\b/i,
  chocolate: /\b(chocolate|cocoa)\b/i,
  barrel_aged: /\b(wood|barrel|oak)/i,
  non_alcoholic: /\bnon[- ]?alcohol/i,
  gluten_free: /\bgluten/i,
};
export const traitsOf = (categoryName) => Object.entries(TRAITS).filter(([, re]) => re.test(categoryName)).map(([k]) => k);

// Every medal row with the fields the Explore page shows and filters on beyond the global filter: the
// competition section (results), the investors (ownership research), and the category characteristics.
export function exploreRows() {
  const { ds, payload } = site();
  const investor = new Map(ds.breweries.filter((b) => b.ownership?.investor).map((b) => [b.key, String(b.ownership.investor)]));
  return payload.results.map((r) => ({
    ...filterRow(r, ['category_slug', 'category_number', 'brewery_slug', 'city', 'section', 'parent']),
    stem: stemOf(r),
    investor: investor.get(r.brewery_key) ?? null,
    traits: traitsOf(r.category_name),
  }));
}

// ---------- estimates ----------

// The facts behind one brewery's estimated figures, for the file its economics row loads when an (E) is opened.
export const estimateSlugs = () => site().ds.breweries.filter((b) => b.medals.length).map((b) => b.slug);
export function estimateFacts(slug) {
  const { ds } = site();
  const b = ds.breweries.find((x) => x.slug === slug && x.medals.length);
  return b ? { slug: b.slug, name: b.name, facts: estimateOf(b, ds.params) } : null;
}
