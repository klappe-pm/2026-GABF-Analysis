// Types for hops.mjs, the hops lane's build time data.
import type { BeerRecord, Medal, WinnerRow } from '../site-model.mjs';

export type Source = { label: string; url: string | null };
export type VarietyLink = { name: string; slug: string };
export type FarmLink = { name: string; slug: string; state: string };

// A reference table cell: text, or the sources it names. Null when the table holds nothing there.
export type Cell = { text: string } | { sources: Source[] } | null;
export type Table = { columns: { key: string; label: string }[]; rows: Record<string, Cell>[] };

// What a hop profile card draws.
export type HopCard = {
  slug: string;
  name: string;
  origin: string | null;
  breeder: string | null;
  alpha: { min: number; max: number } | null;
  oil: { min: number; max: number } | null;
  aroma: { descriptors: string[]; source: Source | null } | null;
  acreage: { acres: number; year: number; states: number } | null;
  beers: number;
  farms: FarmLink[];
};

// A beer in a list: its names and links, the fields the global filter reads, and the record its profile card draws.
export type BeerRef = { stem: string; year: number; beer: string; medal: Medal; brewery: string; brewerySlug: string; category: string; categorySlug: string; filter: WinnerRow; card: Omit<BeerRecord, 'notesHtml'> };

export type HopsIndex = {
  year: number;
  varieties: { slug: string; name: string; origin: string | null; beers: number; medals: number; gold: number; silver: number; bronze: number; farms: number; card: HopCard }[];
  used: number;
  farmCount: number;
};

export type Hop = HopCard & {
  aliases: string[];
  // A minimum and maximum of one measure arrive as one row with `max` set.
  data: { key: string; label: string; value: string; max?: string }[];
  sourceRows: { label: string; sources: Source[] }[];
  aromaRows: { descriptor: string; source: Source[] }[];
  acreageByState: {
    rows: { state: string | null; year: number | null; acres: number | null; production: number | null; source: Source[] }[];
    trend: { years: number[]; series: { state: string; values: (number | null)[] }[] };
  };
  counts: { beers: number; medals: number; gold: number; silver: number; bronze: number; farms: number };
  beerRows: (BeerRef & { forms: string[]; uses: string[]; farms: FarmLink[]; otherFarms: string[] })[];
  breweries: { brewery: string; brewerySlug: string; count: number }[];
  farmRows: (FarmLink & { published: string[]; years: string[]; sources: Source[] })[];
  notesHtml: string | null;
};

export type HopFarmsIndex = {
  year: number;
  farmCount: number;
  states: { code: string; name: string | null; farms: { slug: string; name: string; varieties: number; grown: number; named: number }[] }[];
  merchants: Table | null;
  gaps: Table | null;
};

export type HopFarm = {
  slug: string;
  name: string;
  state: string | null;
  aliases: string[];
  data: { key: string; label: string; value: NonNullable<Cell> }[];
  sourceRows: { label: string; sources: Source[] }[];
  counts: { varieties: number; named: number; grown: number };
  varieties: { slug: string; name: string; published: string[]; years: string[]; medals: number; sources: Source[]; verified: string[]; notes: string[] }[];
  varietyCards: HopCard[];
  named: (BeerRef & { hops: VarietyLink[]; published: string[]; sources: Source[] })[];
  grown: (BeerRef & { hops: VarietyLink[] })[];
  // Named breweries first, then those linked through a variety the farm grows.
  breweries: { brewery: string; brewerySlug: string; count: number; kind: 'named' | 'grown' }[];
  merchants: Table | null;
  notesHtml: string | null;
};

export type BeerHopProfile = {
  usage: { hop: VarietyLink; published: string; form: string | null; use: string | null; farm: FarmLink | null; lotOrFarm: string | null; source: Source[] }[];
  grown: { hop: VarietyLink; farms: FarmLink[] }[];
  cards: HopCard[];
  details: { key: string; value: string; source: Source[] }[];
};

export type HopWinnerRow = WinnerRow & { beerPage: boolean };

export function hopsIndex(): HopsIndex;
export function hop(slug: string): Hop | null;
export function hopFarmsIndex(): HopFarmsIndex;
export function hopFarm(slug: string): HopFarm | null;
export function beerHopProfile(stem: string): BeerHopProfile | null;
export function winnerRows(year?: number): HopWinnerRow[];
