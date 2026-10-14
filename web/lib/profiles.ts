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
  aroma: { descriptors: string[]; source: string | null } | null;
  acreage: { acres: number; year: string } | null;
  medalBeers: number;
  farms: Farm[];
};

const reference = (file: string) => (existsInRepo('data', 'reference', file) ? parseCsv(readRepo('data', 'reference', file)) : []);
const pick = (row: Record<string, string>, ...keys: string[]) => keys.map((k) => row[k]?.trim()).find((v) => v) ?? null;
const numPick = (row: Record<string, string>, ...keys: string[]) => {
  const v = pick(row, ...keys);
  return v !== null && Number.isFinite(Number(v)) ? Number(v) : null;
};
const range = (min: number | null, max: number | null) => (min !== null && max !== null ? { min, max } : null);

// One hop variety: its reference row (data/reference/hop-varieties.csv and hop-acreage.csv, when present),
// the 2026 medal beers that use it, and the farms that grow it (hop-farm-varieties.csv, named in hop-farms.csv).
export function hopProfile(variety: string): HopProfile {
  const key = foldName(variety);
  const row = reference('hop-varieties.csv').find((r) => foldName(pick(r, 'canonical_variety', 'variety', 'name')) === key) ?? null;
  const descriptors = row ? (pick(row, 'aroma_descriptors', 'aroma', 'descriptors') ?? '').split(/[;|,]/).map((s) => s.trim()).filter(Boolean) : [];
  const acres = reference('hop-acreage.csv')
    .filter((r) => foldName(pick(r, 'variety', 'canonical_variety', 'name')) === key && numPick(r, 'acres', 'acreage') !== null)
    .sort((a, b) => String(pick(b, 'year')).localeCompare(String(pick(a, 'year'))));
  const latest = acres.length ? String(pick(acres[0], 'year') ?? '') : null;

  const farmRows = reference('hop-farms.csv');
  const slugs = [...new Set(reference('hop-farm-varieties.csv').filter((r) => foldName(pick(r, 'variety_as_published', 'variety')) === key).map((r) => pick(r, 'farm') ?? '').filter(Boolean))];
  const farms = slugs.map((slug) => {
    const f = farmRows.find((r) => r.slug === slug);
    return { slug, name: f?.name || slug, state: f?.state ?? '', doc: existsInRepo('docs', 'hops', 'farms', `${slug}.md`) ? `docs/hops/farms/${slug}.md` : null };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    variety: clean(row ? pick(row, 'canonical_variety', 'variety', 'name') : variety),
    origin: row ? pick(row, 'origin_country', 'origin', 'country') : null,
    breeder: row ? pick(row, 'breeder') : null,
    alpha: row ? range(numPick(row, 'alpha_acid_min', 'alpha_min'), numPick(row, 'alpha_acid_max', 'alpha_max')) : null,
    oil: row ? range(numPick(row, 'total_oil_min', 'oil_min'), numPick(row, 'total_oil_max', 'oil_max')) : null,
    aroma: descriptors.length ? { descriptors, source: row ? pick(row, 'aroma_source', 'aroma_source_url') : null } : null,
    acreage: latest !== null ? { acres: acres.filter((r) => String(pick(r, 'year') ?? '') === latest).reduce((s, r) => s + (numPick(r, 'acres', 'acreage') ?? 0), 0), year: latest } : null,
    medalBeers: winnerFiles().filter((f) => hopsOf(winnerData(f)).some((h) => foldName(h) === key)).length,
    farms,
  };
}
