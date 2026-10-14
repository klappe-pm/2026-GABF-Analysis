// Saved views: a page plus its URL filter state, named by the visitor and kept only in this browser's
// localStorage. Nothing is sent or synced. Every read and write is wrapped, so a browser that blocks
// storage (private windows, blocked site data) gets a page that still renders and says what is wrong.
//
// The rules live here, apart from the React code, so the node test runner can exercise them directly.
// `storage` is a Storage-like object (getItem, setItem, removeItem) or null.
import { parseHash, STATE_KEYS } from './filter-model.mjs';

export const STORAGE_KEY = 'gabf-saved-views';
export const MAX_NAME = 80;
export const MAX_VIEWS = 100;

// The localStorage of this browser, or null when the browser refuses access to it.
export function browserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

// True when the browser keeps what is written. Some browsers hand out a storage object whose writes throw.
export function canStore(storage) {
  if (!storage) return false;
  try {
    const probe = `${STORAGE_KEY}-probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

// A page path is an address inside this site: one leading slash, no protocol, no second host.
export const isSitePath = (path) => typeof path === 'string' && /^\/(?!\/)[^\\\s]*$/.test(path) && !/^\/[a-z][a-z0-9+.-]*:/i.test(path);
const isHash = (hash) => typeof hash === 'string' && (hash === '' || (hash.startsWith('#') && !/\s/.test(hash)));

// The number of filters a hash carries: the keys the global filter reads. Page keys such as a dashboard tab are not filters.
export function filterCount(hash) {
  return Object.keys(parseHash(hash)).filter((k) => STATE_KEYS.includes(k)).length;
}

export const cleanName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

// A stored record as the page may trust it, or null. Stored text is only ever shown as text and linked by path.
export function cleanView(v) {
  if (!v || typeof v !== 'object') return null;
  const name = cleanName(v.name);
  if (!name || typeof v.id !== 'string' || !v.id || !isSitePath(v.path) || !isHash(v.hash ?? '')) return null;
  return { id: v.id, name, path: v.path, hash: v.hash ?? '', title: cleanName(v.title), saved: typeof v.saved === 'string' ? v.saved : '' };
}

// Every saved view, newest first. `blocked` is true when the browser holds no storage for the page.
export function readViews(storage) {
  if (!storage) return { blocked: true, views: [] };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const views = (Array.isArray(list) ? list : []).map(cleanView).filter(Boolean);
    return { blocked: false, views };
  } catch {
    return { blocked: !canStore(storage), views: [] };
  }
}

function write(storage, views) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(views));
    return true;
  } catch {
    return false;
  }
}

const newId = () => {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
};

// Each change returns { ok, views, view? }; ok is false when the name is empty or the browser refused the write.
export function addView(storage, { name, path, hash, title }, now = new Date()) {
  const { blocked, views } = readViews(storage);
  const view = cleanView({ id: newId(), name, path, hash, title, saved: now.toISOString() });
  if (blocked || !view) return { ok: false, views };
  const next = [view, ...views].slice(0, MAX_VIEWS);
  return write(storage, next) ? { ok: true, views: next, view } : { ok: false, views };
}

export function renameView(storage, id, name) {
  const { blocked, views } = readViews(storage);
  const clean = cleanName(name);
  if (blocked || !clean || !views.some((v) => v.id === id)) return { ok: false, views };
  const next = views.map((v) => (v.id === id ? { ...v, name: clean } : v));
  return write(storage, next) ? { ok: true, views: next } : { ok: false, views };
}

export function deleteView(storage, id) {
  const { blocked, views } = readViews(storage);
  if (blocked) return { ok: false, views };
  const next = views.filter((v) => v.id !== id);
  return write(storage, next) ? { ok: true, views: next } : { ok: false, views };
}

// The address that reopens a view: the site origin, the base path it is served under, the page, the filter state.
export const viewLink = (view, origin, base = '') => `${origin}${base}${view.path}${view.hash}`;
