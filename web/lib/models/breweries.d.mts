// Types for breweries.mjs, the build time data of the breweries lane.
import type { FilterFields, MedalRow } from '../site-model.mjs';

export const TREND_YEARS: number;

export type TrendStatus = 'medaled' | 'no-medal' | 'did-not-exist' | 'closed' | 'not-yet-reported' | 'no-data' | 'no-results';

export type EstimateFacts = {
  basis: string;
  barrels: number;
  year: number | null;
  confidence: string | null;
  range: { min: number; max: number | null } | null;
  perType: number;
  perExtraLocation: number;
  locations: number;
  type: string | null;
  assumed: boolean;
  kitchen: boolean | null;
  channel: string | null;
  channelKey: string;
  employees: number | null;
  revenue: { basis: string; total: number; low: number; high: number; perBarrel: number | null; food: number; foodPerLocation: number; lowMultiplier: number; highMultiplier: number };
  fin: {
    arr: number; grossMargin: number; grossProfit: number; ebitdaMargin: number; ebitdaLowMargin: number; ebitdaHighMargin: number;
    ebitda: number; ebitdaLow: number; ebitdaHigh: number; perBarrel: number | null; cogsPerBarrel: number; perLocation: number | null; perEmployee: number | null;
  };
  volume: { gallons: number; cases: number; cans: number; pints: number; packagedShare: number };
};

export type IndexInfo = {
  key: string;
  slug: string;
  name: string;
  hq: string;
  type: string | null;
  ownership: string;
  deepDive: boolean;
  est: EstimateFacts;
};

export type IndexRow = FilterFields & Pick<MedalRow, 'points' | 'brewery_slug'>;

export type BreweryRow = FilterFields & Pick<MedalRow, 'category_slug' | 'category_number' | 'entries' | 'category_medals' | 'special' | 'abv' | 'ibu' | 'beer_style' | 'tasting_note' | 'tasting_source' | 'beer_url'> & {
  stem: string | null;
  malts: string[];
  yeast: string[];
  adjuncts: string[];
};

export type Location = { name: string | null; address: string | null; city: string | null; state: string | null; postal: string | null; opened: string | null; kitchen: boolean; lat: number | null; lon: number | null };

export type BreweryRecord = {
  key: string;
  slug: string;
  name: string;
  hq: { city: string | null; state: string | null };
  founded: number | null;
  employees: number | null;
  type: string | null;
  kitchen: boolean | null;
  website: string | null;
  links: { instagram: string | null; untappd: string | null; beeradvocate: string | null; checked: string | null };
  streak: number;
  knownFor: string[];
  topFamilies: string[];
  locations: Location[];
  locationsCount: number;
  channel: string | null;
  ownership: { type: string; parent: string | null; parentType: string | null; investor: string | null; stake: string | null; dealYear: string | null; baIndependent: string | null; status: string | null; source: string | null; verified: 'yes' | 'no' } | null;
  distributors: { channel: string | null; distributor: string | null; territory: string | null; since: string | null; verified: 'yes' | 'no'; notes: string | null; source: string | null }[];
  currentBeers: { source: string; asOf: string; beers: { name: string; style: string | null; abv: string | null }[] }[];
  otherMedals: { year: number; competition: string; medal: string; beer: string; city: string; state: string; category: string }[];
  estimate: EstimateFacts;
  trend: { year: number; status: TrendStatus; gold: number; silver: number; bronze: number; total: number }[];
  firstYear: number | null;
  lastYear: number | null;
  hopLinks: Record<string, string>;
  hopFarms: Record<string, { name: string; slug: string }[]>;
  namedFarms: Record<string, { slug: string; hops: string[] }>;
  farmSlugs: Record<string, string | null>;
  deepDiveHtml: string | null;
  varietySlugs: Record<string, string | null>;
  rows: BreweryRow[];
};

export type FirstTimeRow = FilterFields & Pick<MedalRow, 'first_time' | 'brewery_slug' | 'category_slug' | 'category_number' | 'entries' | 'abv' | 'ibu' | 'beer_profile' | 'fed_district_name'>;

export type FirstTimeRecord = {
  year: number;
  firstYear: number;
  lastYear: number;
  partialYears: number[];
  pendingYears: number[];
  completeRange: { from: number; to: number } | null;
  newCount: number;
  completeCount: number;
  ambiguous: { key: string; name: string; city: string; state: string; candidates: { name: string; city: string; state: string; years: number[] }[] }[];
  rows: FirstTimeRow[];
};

export function estimateOf(b: unknown, params: unknown): EstimateFacts;
export function breweriesIndex(): { rows: IndexRow[]; info: Record<string, IndexInfo> };
export function breweryRecord(slug: string): BreweryRecord | null;
export function firstTimeRecord(year?: number): FirstTimeRecord;
