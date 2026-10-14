// Types for estimates.mjs, the facts behind a brewery's estimated figures.

export function estimateSlugs(): string[];
export function estimateFacts(slug: string): { slug: string; name: string; facts: import('./breweries.mjs').EstimateFacts } | null;
export function explorerIds(results: Record<string, any>[]): { award_id: string; beer_id: string; brewery_id: string }[];
