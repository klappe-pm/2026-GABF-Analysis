// Types for rates.mjs.

export type Indicators = Record<string, Record<string, Record<string, number | null>>>;
export type Rate = { key: string; medals: number; per_million: number; per_100b_gdp: number; missing_population: number; missing_gdp: number };
export const CONTROL_FIELDS: { key: string; label: string; digits: number }[];
export function latestValue(series: Record<string, number | null> | undefined): number | null;
export function medalRates(rows: Record<string, unknown>[], keyOf: (row: any) => unknown, indicators: Indicators | undefined): Map<string, Rate>;
export function sortByLabel<T>(list: T[], label?: (x: T) => string): T[];
