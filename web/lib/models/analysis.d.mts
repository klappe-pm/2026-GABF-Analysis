// Types for analysis.mjs, the build time data of the category, report, and About pages.
import type { FilterFields, HopLink, MedalRow } from '../site-model.mjs';

export type ReportSlug = 'top-breweries' | 'top-categories' | 'by-state' | 'by-region' | 'ownership' | 'economics' | 'trends' | 'brewery-of-the-year';
export const REPORTS: { slug: ReportSlug; key: string }[];
export function reportParams(): { slug: ReportSlug }[];
export function reportKey(slug: string): string | null;

export type CategoryRow = FilterFields & Pick<MedalRow, 'category_slug' | 'special' | 'entries' | 'abv_min' | 'abv_max'>;
export function categoryRows(): CategoryRow[];
export function categoryCount(): { total: number; special: number; classic: number };

export type Range = { min: string; max: string };
export type CategoryMedalRow = FilterFields & Pick<MedalRow, 'category_number' | 'category_slug' | 'entries' | 'special' | 'brewery_slug' | 'city' | 'abv'> & { ibu: number | null; stem: string | null; hops: HopLink[] };
export type CategoryRecord = {
  name: string;
  slug: string;
  special: boolean;
  styleFamily: string;
  latestEntries: number | null;
  latestEntriesYear: number | null;
  abv: Range | null;
  ibu: Range | null;
  srm: Range | null;
  description: string | null;
  source: string | null;
  confidence: string | null;
  variant: string | null;
  cardStems: string[];
  rows: CategoryMedalRow[];
};
export function category(slug: string): CategoryRecord | null;
export type LegacyCategory = { oldSlug: string; slug: string; name: string };
export function legacyCategories(): { redirects: LegacyCategory[]; names: Record<string, string> };
export function legacyCategoryParams(): { slug: string }[];
export function legacyCategory(slug: string): LegacyCategory | null;

export function reportRows<K extends keyof MedalRow>(extra: K[]): (FilterFields & Pick<MedalRow, K>)[];

export type StateIndicators = Record<string, { population: Record<string, number>; gdp_real: Record<string, number> }>;
export type ReportMeta = {
  years: number[];
  coverage: Record<string, string>;
  latestComplete: number;
  latestYear: number;
  dataYear: number | null;
  states: { state: string; name: string; region: string; division: string }[];
  indicators: StateIndicators;
  ownershipKeys: string[];
};
export function reportMeta(): ReportMeta;

export type BreweryInfo = {
  key: string; name: string; slug: string; hq: string; brewery_type: string; ownership_type: string; streak: number; deep_dive: boolean;
  arr: number | null; barrels: number | null; basis: string; cases: number | null; gross_margin: number | null; ebitda: number | null;
  ebitda_margin_low: number | null; ebitda_margin_high: number | null; distribution_channel: string; locations_count: number;
};
export function info(): Record<string, BreweryInfo>;
export function streaks(): { name: string; slug: string; streak: number }[];

export type OwnershipRecord = { name: string; slug: string | null; hq: string; type: string; parent: string | null; investor: string | null; stake: string | null; year: number | null; baIndependent: string | null; status: string | null; verified: 'yes' | 'no' };
export function ownershipTable(): OwnershipRecord[];

export type AwardRecord = { year: number; award: string; bracket: string; brewery: string; slug: string | null; city: string; source: string };
export function awardsTable(): { rows: AwardRecord[]; short: boolean };

export type ScaleRecord = { year: number; date: string | null; venue: string | null; entries: number | null; breweriesEntering: number | null; medals: number | null; winningBreweries: number | null; categories: number | null; coverage: string; notes: string | null };
export function scaleTable(): ScaleRecord[];

export type AboutRecord = {
  years: number[];
  firstYear: number;
  lastYear: number;
  completeRange: string;
  coverage: { year: number; status: string; rows: number }[];
  estimates: { direct: string; distributed: string; taproom: string; self: string; distributor: string };
};
export function about(): AboutRecord;

export const TRAITS: Record<string, RegExp>;
export function traitsOf(categoryName: string): string[];
export type ExploreRow = FilterFields & Pick<MedalRow, 'category_slug' | 'category_number' | 'brewery_slug' | 'city' | 'section' | 'parent'> & { stem: string | null; investor: string | null; traits: string[]; award_id: string; beer_id: string; brewery_id: string };
export function exploreRows(): ExploreRow[];

export function estimateSlugs(): string[];
export function estimateFacts(slug: string): { slug: string; name: string; facts: import('./breweries.mjs').EstimateFacts } | null;
export function explorerIds(results: Record<string, any>[]): { award_id: string; beer_id: string; brewery_id: string }[];
export function stateTiles(): Record<string, [number, number]>;
