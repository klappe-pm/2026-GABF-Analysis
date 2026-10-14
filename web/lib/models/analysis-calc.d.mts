// Types for analysis-calc.mjs, the aggregations behind the category and analysis pages.
import type { StateIndicators } from './analysis.mjs';

export type Row = Record<string, any>;
export const TREND_FAMILIES: number;
export const TOP_BREWERIES: number;
export const CHART_BREWERIES: number;
export const STATE_BARS: number;
export const ODDS_BARS: number;
export const MOST_ENTERED_BARS: number;

export function medalRates(rows: Row[], keyOf: (r: Row) => string | null, indicators: Record<string, any>): Map<string, { key: string; medals: number; per_million: number; per_100b_gdp: number }>;
export function medalSplit(rows: Row[]): number[];
export function countBy(rows: Row[], field: string): [string, number][];
export function yearsInView(meta: { years: number[]; coverage: Record<string, string> }, state?: Record<string, string>): number[];
export function newestFirst(a: Row, b: Row): number;

export type CategorySummary = { name: string; slug: string; special: boolean; style_family: string; abv_min: unknown; abv_max: unknown; medals: number; years: number[]; latest: number | null; latestYear: number | null };
export function categoryRollup(rows: Row[]): CategorySummary[];
export type CategoryYear<T> = { year: number; entries: number | null; number: string; medals: T[] };
export function categoryYears<T extends Row>(rows: T[]): CategoryYear<T>[];
export type EnteredCategory = { name: string; slug: string; special: boolean; style_family: string; entries: number; year: number; abv_min: unknown; abv_max: unknown };
export function mostEntered(rows: Row[]): { list: EnteredCategory[]; medalsBy: Map<string, number> };
export type OddsItem = { label: string; slug: string; value: number; entries: number; medals: number; years: string };
export function oddsItems(rows: Row[]): { list: OddsItem[]; missing: number };

export type BreweryTotal = { key: string; name: string; slug: string; medals: number; points: number; g: number; s: number; b: number; first: number };
export function aggregateBreweries(rows: Row[]): BreweryTotal[];

export type StateMeta = { state: string; name: string; region: string; division: string };
export function groupIndicators(states: StateMeta[], indicators: StateIndicators, key: 'region' | 'division'): Record<string, { population?: Record<string, number>; gdp_real?: Record<string, number> }>;
export type StateTotal = StateMeta & { medals: number; split: number[]; breweries: number; latest: number; per_million: number; per_100b: number; pop_latest: number | null };
export function stateRollup(rows: Row[], states: StateMeta[], indicators: StateIndicators, latest: number): StateTotal[];
export type GroupTotal = { name: string; medals: number; split: number[]; breweries: number; states: number; per_million: number };
export function groupRollup(rows: Row[], key: 'region' | 'division', states: StateMeta[], indicators: StateIndicators, unknown: string): GroupTotal[];

export function ownershipRollup(rows: Row[], ownershipKeys: string[]): { independent: number; ownedBreweries: number; listed: number; owned: Set<string> };
export function familySeries(rows: Row[], years: number[], count?: number): { family: string | null; data: number[] }[];
export type Mover = { name: string; slug: string; d: number };
export function movers(rows: Row[], years: number[], coverage: Record<string, string>): { previous: number; year: number; gained: Mover[]; lost: Mover[] } | null;
