// Types for home.mjs.

export type Winner = { name: string; slug: string };
export type CategoryLine = { slug: string; name: string; number: number; entries: number | null; medals: number; odds: number | null; gold: Winner[]; silver: Winner[]; bronze: Winner[] };
export function categoryLines(rows: Record<string, any>[]): CategoryLine[];
export function scoresheet(rows: Record<string, any>[], summaryEntries?: number | null): { medals: number; categories: number; entries: number | null };
export const RANK_OF: Record<string, number>;
export type SearchEntry = { kind: 'brewery' | 'category' | 'beer'; label: string; meta: string; path: string; text: string };
export function searchIndexMatches(index: SearchEntry[], query: string, limit?: number): SearchEntry[];
