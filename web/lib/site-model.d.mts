// Types for site-model.mjs, the build time data of the site.

export type Medal = 'Gold' | 'Silver' | 'Bronze';

// One decorated medal row, as data/results.json carries it. Every global filter dimension is a field here.
export type MedalRow = {
  year: number;
  competition: string;
  section: string;
  category_number: string;
  category_name: string;
  category_slug: string;
  category_type: 'classic' | 'special';
  special: boolean;
  entries: number | null;
  category_medals: number | null;
  medal: Medal;
  beer_name: string;
  brewery_name: string;
  brewery_key: string;
  brewery_slug: string;
  brewery_location: string;
  city: string;
  state: string;
  state_name: string;
  region: string;
  division: string;
  fed_district: number | null;
  fed_district_name: string;
  style_family: string;
  abv: number | null;
  abv_band: string;
  points: number;
  partial: boolean;
  draft: boolean;
  brewery_type: string;
  ownership_type: string;
  distribution_channel: string;
  beer_profile: string | null;
  first_time: string | null;
  search_extra: string | null;
  hop_varieties: string[] | null;
  hop_farms_named: string[] | null;
  hop_farms_grown: string[] | null;
  section: string | null;
  traits: string[];
  investor: string | null;
  [field: string]: unknown;
};

export type HopLink = { name: string; slug: string };

// The fields the global filter reads; filterRow keeps these (plus any named extras) and drops the rest.
export type FilterFields = Pick<MedalRow, 'year' | 'medal' | 'category_type' | 'style_family' | 'category_name' | 'abv_band' | 'hop_varieties' | 'hop_farms_named' | 'hop_farms_grown' | 'section' | 'traits' | 'investor'
  | 'region' | 'state' | 'city' | 'fed_district_name' | 'brewery_key' | 'brewery_type' | 'ownership_type' | 'distribution_channel' | 'partial'
  | 'beer_name' | 'brewery_name' | 'brewery_location' | 'state_name' | 'search_extra'>;

export type WinnerRow = FilterFields & Pick<MedalRow, 'category_number' | 'category_slug' | 'brewery_slug' | 'entries'> & { stem: string | null; abv: number | null; ibu: number | null; hops: HopLink[] };

export type SourcedText = { text: string; source: string | null };

export type BeerRecord = {
  stem: string;
  year: number;
  beer: string;
  brewery: string;
  city: string;
  state: string;
  medal: Medal;
  category: string;
  categoryNumber: number;
  entries: number | null;
  abv: number | null;
  ibu: number | null;
  style: string | null;
  hops: HopLink[];
  malts: string[];
  yeast: string[];
  adjuncts: string[];
  tastingNote: SourcedText | null;
  description: SourcedText | null;
  beerUrl: string | null;
  breweryUrl: string | null;
  brewerySlug: string | null;
  categorySlug: string | null;
  notesHtml: string;
};

export type SiteCounts = {
  results: number;
  breweries: number;
  categories: number;
  beers: number;
  hops: number;
  hopFarms: number;
  years: number[];
  coverage: Record<string, 'complete' | 'partial' | 'draft' | 'pending'>;
};

export const REPO: string;
export const WINNER_YEAR: number;
export function site(): unknown;
export function beerParams(): { year: string; stem: string }[];
export function breweryParams(): { slug: string }[];
export function categoryParams(): { slug: string }[];
export function hopParams(): { slug: string }[];
export function hopFarmParams(): { slug: string }[];
export const FILTER_FIELDS: string[];
export function filterRow<K extends keyof MedalRow>(row: MedalRow, extra?: K[]): FilterFields & Pick<MedalRow, K>;
export function medalRows(scope?: Record<string, string>): MedalRow[];
export function filterData(): { results: MedalRow[]; meta: Record<string, unknown> };
export function legacyCategoryNames(): Record<string, string>;
export function counts(): SiteCounts;
export function winners(year?: number): WinnerRow[];
export function notesHtml(body: string): string;
export function beer(stem: string): BeerRecord | null;
