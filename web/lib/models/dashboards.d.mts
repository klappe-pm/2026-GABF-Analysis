// Types for dashboards.mjs.

export const TILES: Record<string, [number, number]>;
export const MEDAL_NAMES: string[];
export function breweriesFile(): Record<string, unknown>[];
export function breweryInfoFile(): Record<string, unknown>;
export function estimatesFile(): Record<string, unknown>;
export function categoriesFile(): Record<string, unknown>[];
export function csvNames(): string[];
export function csvFile(name: string): string | null;
export function featuredBreweries(): { slug: string; name: string; city: string; state: string; medals: number }[];
export function defaultBrewery(): string;
export function rateYears(): { latest: number; data: number };
export function tileCheck(): { missing: string[]; extra: string[] };
export function homeData(): {
  year: number;
  firstYear: number;
  lastYear: number;
  scoresheet: { medals: number; categories: number; entries: number | null };
  categories: import('./home.mjs').CategoryLine[];
  finding: Record<string, string>;
};
export function searchIndex(): import('./home.mjs').SearchEntry[];
