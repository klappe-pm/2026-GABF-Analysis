// Types for explore-import.mjs, the client side CSV reader of the Explore page.
export const MAX_ROWS: number;
export const MAX_BYTES: number;
export const REQUIRED: string[];

export type ImportError = { code: 'unclosed_quote' | 'no_rows' | 'duplicate_columns' | 'missing_column' | 'blank_required' | 'bad_medal' | 'bad_year' | 'field_count' | 'too_many_rows' | 'too_large' | 'bad_kind' | 'blank_id' | 'duplicate_id' | 'no_evidence'; row?: number; column?: string; count?: number; expected?: number };
export type ImportedAward = { year: number; medal: 'Gold' | 'Silver' | 'Bronze'; beer: string; brewery: string; city: string; state: string; category: string };

export function parseCsv(text: string): { rows: string[][]; error?: undefined } | { error: ImportError; rows?: undefined };
export function readAwards(text: string, size?: number): { awards: ImportedAward[]; skipped: number; error?: undefined } | { error: ImportError; awards?: undefined; skipped?: undefined };

export const beerIdOf: (beer: string, brewery: string) => string;
export const breweryIdOf: (brewery: string, city: string, state: string) => string;
export const importedAwardId: (a: ImportedAward) => string;
export type EnrichKind = 'awards' | 'beers' | 'breweries';
export const ENRICH_KINDS: Record<EnrichKind, 'award_id' | 'beer_id' | 'brewery_id'>;
export const PATCHABLE: string[];
export type Patch = { id: string; fields: Record<string, string>; evidence: string };
export function readEnrichment(text: string, kind: EnrichKind, known: Set<string>, size?: number): { patches: Patch[]; skipped: number; error?: undefined } | { error: ImportError; patches?: undefined; skipped?: undefined };
