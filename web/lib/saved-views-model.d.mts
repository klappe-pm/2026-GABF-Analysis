// Types for saved-views-model.mjs.
export type SavedView = { id: string; name: string; path: string; hash: string; title: string; saved: string };
export type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
export type Change = { ok: boolean; views: SavedView[]; view?: SavedView };

export const STORAGE_KEY: string;
export const MAX_NAME: number;
export const MAX_VIEWS: number;
export function browserStorage(): StorageLike | null;
export function canStore(storage: StorageLike | null): boolean;
export function isSitePath(path: unknown): boolean;
export function filterCount(hash: string): number;
export function cleanName(name: unknown): string;
export function cleanView(v: unknown): SavedView | null;
export function readViews(storage: StorageLike | null): { blocked: boolean; views: SavedView[] };
export function addView(storage: StorageLike | null, view: { name: string; path: string; hash: string; title: string }, now?: Date): Change;
export function renameView(storage: StorageLike | null, id: string, name: string): Change;
export function deleteView(storage: StorageLike | null, id: string): Change;
export function viewLink(view: Pick<SavedView, 'path' | 'hash'>, origin: string, base?: string): string;
