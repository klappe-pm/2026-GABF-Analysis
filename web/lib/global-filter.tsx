'use client';

// The one global filter, for every page of the site. It keeps the current site's behavior: the selection
// lives in the URL hash (so a shared link carries it, and old links such as /#year=2024 still filter),
// then in browser storage, then the default (complete years only). Partial years stay out unless a year
// is picked or they are included. The rules come from lib/filter-model.mjs, shared with the current site.
//
// Pages use it in three ways:
//   useFilteredRows(rows)       the page's rows narrowed by the selection (rows carry the filter fields)
//   usePageScope(scope, fixed)  the page's own scope (one year, one brewery) for option counts and its fixed chips
//   useGlobalFilter()           the selection itself, to set or clear it
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyFilters, type FilterRow, type FilterState, hashFor, parseHash, pickState, readStored, resolveState, STATE_KEYS, writeStored } from './filter-model.mjs';
import { href } from './href';

export type FilterData = { rows: FilterRow[]; meta: { states?: { state: string; name: string }[]; coverage?: Record<string, string> } & Record<string, unknown> };
type Status = 'idle' | 'loading' | 'ready' | 'error';
type Scope = { scope: Record<string, string>; fixed: string[] };

type Value = {
  state: FilterState;
  setState: (next: FilterState) => void;
  remove: (key: string) => void;
  clear: () => void;
  scope: Scope;
  setScope: (scope: Scope | null) => void;
  data: FilterData | null;
  status: Status;
  load: () => void;
};

const Ctx = createContext<Value | null>(null);
const EMPTY_SCOPE: Scope = { scope: {}, fixed: [] };

// A link made before the word Style left the category names (#category_name=American-Style Pilsener) still finds its
// category: the name is mapped through the table the data carries, and before the data loads by dropping the word.
const dropStyle = (n: string) => n.replace(/[-\s]+Style\b/gi, '').replace(/\s+/g, ' ').trim();
function currentNames(state: FilterState, names?: Record<string, string>): FilterState {
  const n = state.category_name;
  if (!n) return state;
  const next = names?.[n] ?? dropStyle(n);
  return next === n ? state : { ...state, category_name: next };
}

const storage = () => {
  try { return window.localStorage; } catch { return null; }
};

// The hash keeps any page keys (a dashboard tab, a picked brewery) beside the filter keys.
function writeHash(state: FilterState) {
  const page = Object.fromEntries(Object.entries(parseHash(window.location.hash)).filter(([k]) => !STATE_KEYS.includes(k)));
  const next = hashFor({ ...page, ...state });
  if (next !== window.location.hash && !(next === '' && window.location.hash === '')) {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${next}`);
  }
}

export function GlobalFilterProvider({ children }: { children: ReactNode }) {
  const [state, setRaw] = useState<FilterState>({});
  const [scope, setScopeRaw] = useState<Scope>(EMPTY_SCOPE);
  const [data, setData] = useState<FilterData | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const loading = useRef(false);

  // On load the hash wins, then storage. The result is written back to both, as the current site does: to storage so
  // the next page (navigation links carry no hash) opens with it, and to the hash so a link copied from any page
  // carries the active filter. A later hash change is a link or the back button naming its own selection, so the
  // hash alone decides it.
  useEffect(() => {
    const first = resolveState(parseHash(window.location.hash), readStored(storage()));
    setRaw(first);
    writeHash(first);
    writeStored(storage(), first);
    const onHash = () => {
      const next = pickState(parseHash(window.location.hash));
      setRaw(next);
      writeStored(storage(), next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setState = useCallback((next: FilterState) => {
    const clean = pickState(next);
    setRaw(clean);
    writeHash(clean);
    writeStored(storage(), clean);
  }, []);

  const setScope = useCallback((s: Scope | null) => setScopeRaw(s ?? EMPTY_SCOPE), []);

  const load = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    setStatus('loading');
    Promise.all(['/data/results.json', '/data/meta.json'].map((p) => fetch(href(p)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))))
      .then(([rows, meta]) => { setData({ rows, meta }); setStatus('ready'); })
      .catch(() => { loading.current = false; setStatus('error'); });
  }, []);

  const legacy = (data?.meta as { legacy_category_names?: Record<string, string> } | undefined)?.legacy_category_names;
  const current = useMemo(() => currentNames(state, legacy), [state, legacy]);

  const value = useMemo<Value>(() => ({
    state: current,
    setState,
    remove: (key) => {
      const next = { ...current };
      delete next[key];
      setState(next);
    },
    clear: () => setState({}),
    scope,
    setScope,
    data,
    status,
    load,
  }), [current, setState, scope, setScope, data, status, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGlobalFilter(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGlobalFilter needs the site layout (GlobalFilterProvider)');
  return v;
}

// The page's rows under the current selection. Before the selection is read from the URL (the first
// render, which is also the built HTML), the default applies: complete years only.
export function useFilteredRows<T extends FilterRow>(rows: T[]): T[] {
  const { state } = useGlobalFilter();
  return useMemo(() => applyFilters(rows, state), [rows, state]);
}

// A page's own scope: { year: '2026' } on the winners list, { brewery_key } on a brewery page. Option
// counts in the Filters dialog use it, and each fixed text shows as a chip that cannot be removed.
export function usePageScope(scope: Record<string, string>, fixed: string[]) {
  const { setScope } = useGlobalFilter();
  const key = JSON.stringify([scope, fixed]);
  useEffect(() => {
    const [s, f] = JSON.parse(key) as [Record<string, string>, string[]];
    setScope({ scope: s, fixed: f });
    return () => setScope(null);
  }, [key, setScope]);
}
