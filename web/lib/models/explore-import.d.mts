// Types for explore-import.mjs, the client side CSV reader of the Explore page.
export const MAX_ROWS: number;
export const MAX_BYTES: number;
export const REQUIRED: string[];

export type ImportError = { code: 'unclosed_quote' | 'no_rows' | 'duplicate_columns' | 'missing_column' | 'blank_required' | 'bad_medal' | 'bad_year' | 'field_count' | 'too_many_rows' | 'too_large'; row?: number; column?: string; count?: number; expected?: number };
export type ImportedAward = { year: number; medal: 'Gold' | 'Silver' | 'Bronze'; beer: string; brewery: string; city: string; state: string; category: string };

export function parseCsv(text: string): { rows: string[][]; error?: undefined } | { error: ImportError; rows?: undefined };
export function readAwards(text: string, size?: number): { awards: ImportedAward[]; skipped: number; error?: undefined } | { error: ImportError; awards?: undefined; skipped?: undefined };
