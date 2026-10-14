// Real records for the beer and hop profile cards, read at build time from the 2026 winner profiles and the
// hop reference tables. A field the data does not hold stays null, and the card shows it as not defined.
import { existsInRepo, listRepo, parseCsv, readRepo, splitFrontmatter } from './repo';
import type { Medal } from './data';

export type SourcedText = { text: string; source: string | null };

export type BeerProfile = {
  file: string;
  beer: string;
  brewery: string;
  city: string;
  state: string;
  medal: Medal;
  category: string;
  categoryNumber: number;
  abv: number | null;
  ibu: number | null;
  style: string | null;
  hops: string[];
  tastingNote: SourcedText | null;
  description: SourcedText | null;
};

// "Citra®", "citra", and " Citra " are one variety; nothing beyond case, symbols, accents, and spacing is merged.
export const foldName = (name: unknown) => String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[®™©]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const clean = (name: unknown) => String(name ?? '').replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();

// The same slug the site uses for a hop variety page: "Hallertau Mittelfrüh" becomes hallertau-mittelfruh.
export const hopSlug = (name: string) => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function sourced(v: unknown): SourcedText | null {
  if (typeof v === 'string') return str(v) ? { text: v.trim(), source: null } : null;
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const text = str(o.text);
  return text ? { text, source: str(o.source) ?? str(o.url) } : null;
}

const winnerFiles = () => listRepo('docs', '2026', 'winner').filter((f) => /^\d{3}-.*\.md$/.test(f)).sort();
const winnerData = (file: string) => splitFrontmatter(readRepo('docs', '2026', 'winner', file)).data;

// The hop varieties a profile credits: the canonical variety of each hop profile entry, else the hops list.
function hopsOf(data: Record<string, unknown>): string[] {
  const profile = Array.isArray(data['hop-profile']) ? (data['hop-profile'] as Record<string, unknown>[]) : [];
  const fromProfile = profile.map((h) => clean(h?.variety ?? h?.published)).filter(Boolean);
  const list = fromProfile.length ? fromProfile : (Array.isArray(data.hops) ? data.hops.map(clean).filter(Boolean) : []);
  const seen = new Set<string>();
  return list.filter((h) => !seen.has(foldName(h)) && seen.add(foldName(h)));
}

export function beerProfile(file: string): BeerProfile {
  if (!existsInRepo('docs', '2026', 'winner', file)) throw new Error(`beer profile ${file} is missing`);
  const d = winnerData(file);
  return {
    file: `docs/2026/winner/${file}`,
    beer: String(d.beer),
    brewery: String(d.brewery),
    city: String(d['brewery-city'] ?? ''),
    state: String(d['brewery-state'] ?? ''),
    medal: d.medal as Medal,
    category: String(d['category-name']),
    categoryNumber: Number(d['category-number']),
    abv: num(d.abv),
    ibu: num(d.ibu),
    style: str(d.style),
    hops: hopsOf(d),
    tastingNote: sourced(d['tasting-notes']),
    description: sourced(d.description),
  };
}

// The first 2026 winner (in category order) with a published ABV, IBU, style, sourced description, and at
// least two hops, one of them `hop`: a profile that fills every part of the card.
export function fullBeerProfile(hop: string): BeerProfile | null {
  for (const file of winnerFiles()) {
    const b = beerProfile(file);
    if (b.abv !== null && b.ibu !== null && b.style && b.hops.length >= 2 && (b.tastingNote?.source || b.description?.source) && b.hops.some((h) => foldName(h) === foldName(hop))) return b;
  }
  return null;
}

export type Farm = { slug: string; name: string; state: string; doc: string | null };

export type HopProfile = {
  variety: string;
  origin: string | null;
  breeder: string | null;
  alpha: { min: number; max: number } | null;
  oil: { min: number; max: number } | null;
  aroma: { descriptors: string[]; source: string | null; attribution: string | null } | null;
  // US acreage for the latest NASS year: the acres the states disclosed, their share of all US hop acres,
  // and the states NASS withheld that year.
  acreage: { acres: number; year: string; share: number | null; withheld: string[] } | null;
  medalBeers: number;
  farms: Farm[];
};

// The same folding scripts/lib/hop-aliases.mjs uses (normalizeHopName): case, accents, trademark marks,
// apostrophes, and punctuation, so "Citra®", "Citra HBC 394", and "citra" meet in hop-aliases.csv.
export const normalizeHopName = (name: unknown) => String(name ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[®™℠©]/g, '').replace(/['’`]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

let aliasIndex: Map<string, string> | null = null;
let formIndex: Set<string> | null = null;
// The canonical variety slug for a hop name as a brewery or farm publishes it, through
// data/reference/hop-aliases.csv: an exact alias, or an alias followed by a product form ("Citra Cryo").
export function hopVarietySlug(name: unknown): string | null {
  if (!aliasIndex || !formIndex) {
    aliasIndex = new Map();
    formIndex = new Set();
    for (const r of reference('hop-aliases.csv')) {
      const key = r.normalized || normalizeHopName(r.alias);
      if (r.kind === 'form') formIndex.add(key);
      else aliasIndex.set(key, r.slug);
    }
  }
  const key = normalizeHopName(name);
  if (aliasIndex.has(key)) return aliasIndex.get(key) ?? null;
  const tokens = key.split(' ');
  while (tokens.length > 1) {
    const two = tokens.slice(-2).join(' ');
    const one = tokens[tokens.length - 1];
    if (tokens.length > 2 && formIndex.has(two)) tokens.length -= 2;
    else if (formIndex.has(one)) tokens.length -= 1;
    else break;
    const base = aliasIndex.get(tokens.join(' '));
    if (base) return base;
  }
  return null;
}

const reference = (file: string) => (existsInRepo('data', 'reference', file) ? parseCsv(readRepo('data', 'reference', file)) : []);
const pick = (row: Record<string, string>, ...keys: string[]) => keys.map((k) => row[k]?.trim()).find((v) => v) ?? null;
const numPick = (row: Record<string, string>, ...keys: string[]) => {
  const v = pick(row, ...keys);
  return v !== null && Number.isFinite(Number(v)) ? Number(v) : null;
};
const range = (min: number | null, max: number | null) => (min !== null && max !== null ? { min, max } : null);

// One hop variety, found by its canonical slug through the alias table:
//   identity, chemistry, and aroma from data/reference/hop-varieties.csv;
//   acreage from hop-acreage.csv (per state) and hop-acreage-totals.csv (all US hop acres that year);
//   the 2026 medal beers whose hops resolve to it; and the farms that list it (hop-farm-varieties.csv,
//   named in hop-farms.csv). A field the tables leave empty stays null.
export function hopProfile(variety: string): HopProfile {
  const slug = hopVarietySlug(variety);
  const row = slug ? reference('hop-varieties.csv').find((r) => r.slug === slug) ?? null : null;
  const descriptors = row ? (pick(row, 'aroma_descriptors') ?? '').split(/[;|,]/).map((s) => s.trim()).filter(Boolean) : [];

  const stateRows = slug ? reference('hop-acreage.csv').filter((r) => r.variety_slug === slug) : [];
  const years = [...new Set(stateRows.filter((r) => numPick(r, 'acres') !== null).map((r) => r.year))].sort();
  const latest = years.at(-1) ?? null;
  let acreage: HopProfile['acreage'] = null;
  if (latest) {
    const thisYear = stateRows.filter((r) => r.year === latest);
    const acres = thisYear.reduce((s, r) => s + (numPick(r, 'acres') ?? 0), 0);
    const total = reference('hop-acreage-totals.csv').find((r) => r.state === 'United States' && r.year === latest);
    const all = total ? numPick(total, 'acres') : null;
    acreage = {
      acres,
      year: latest,
      share: all ? Math.round((acres / all) * 1000) / 10 : null,
      withheld: thisYear.filter((r) => numPick(r, 'acres') === null).map((r) => r.state).sort(),
    };
  }

  const farmRows = reference('hop-farms.csv');
  const farmSlugs = slug ? [...new Set(reference('hop-farm-varieties.csv').filter((r) => hopVarietySlug(r.variety_as_published) === slug).map((r) => r.farm).filter(Boolean))] : [];
  const farms = farmSlugs.map((f) => {
    const farm = farmRows.find((r) => r.slug === f);
    return { slug: f, name: farm?.name || f, state: farm?.state ?? '', doc: existsInRepo('docs', 'hops', 'farms', `${f}.md`) ? `docs/hops/farms/${f}.md` : null };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const sources = row ? (pick(row, 'aroma_source_urls') ?? '').split('|').map((s) => s.trim()).filter(Boolean) : [];
  return {
    variety: clean(row ? pick(row, 'canonical_variety') : variety),
    origin: row ? pick(row, 'origin_country') : null,
    breeder: row ? pick(row, 'breeder') : null,
    alpha: row ? range(numPick(row, 'alpha_min'), numPick(row, 'alpha_max')) : null,
    oil: row ? range(numPick(row, 'total_oil_min'), numPick(row, 'total_oil_max')) : null,
    aroma: descriptors.length ? { descriptors, source: sources[0] ?? null, attribution: row ? pick(row, 'aroma_attribution') : null } : null,
    acreage,
    medalBeers: slug ? winnerFiles().filter((f) => hopsOf(winnerData(f)).some((h) => hopVarietySlug(h) === slug)).length : 0,
    farms,
  };
}
