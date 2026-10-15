// Types for filter-model.mjs (site/assets/filter-bar.mjs).

export type FilterState = Record<string, string>;
export type FilterDef = { id: string; field?: string; fields?: string[]; multi?: boolean; label: string; hidden?: boolean; group: 'When' | 'What' | 'Where' | 'Who' };
export type FilterRow = Record<string, unknown>;
export type Option = { value: string; count: number; label: string };

export const FILTERS: FilterDef[];
export const STATE_KEYS: string[];
export function activeChips(s: FilterState, meta?: unknown): { id: string; text: string }[];
export function applyFilters<T extends FilterRow>(rows: T[], s?: FilterState): T[];
export function hashFor(obj: Record<string, string>): string;
export function includesPartial(s: FilterState): boolean;
export function isDefaultState(s: FilterState): boolean;
// The option that stands for rows holding no value for a dimension.
export const NOT_DEFINED: string;
// The filter model's own label for a value: a city as "Denver, CO", a slug as words.
export function valueLabel(id: string, value: string, meta?: unknown): string;
export function optionList(scope: FilterRow[], id: string, s?: FilterState, meta?: unknown): Option[];
export function parseHash(hash: string): Record<string, string>;
export function pickState(obj: Record<string, unknown> | null | undefined): FilterState;
export function pruneState(scope: FilterRow[], s: FilterState, keep?: string | null): FilterState;
export function readStored(storage: Storage | null): FilterState | null;
export function resolveState(hashObj: Record<string, string>, stored: FilterState | null): FilterState;
export function scopeRows<T extends FilterRow>(rows: T[], scope?: Record<string, string>): T[];
export function writeStored(storage: Storage | null, state: FilterState): void;
