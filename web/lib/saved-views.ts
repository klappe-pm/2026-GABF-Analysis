'use client';

// The saved views of this browser as React state. The first render (also the built HTML) is 'pending'
// because the server knows nothing about this browser; the effect then reads storage once, and again
// when another tab or another control on this page changes it.
import { useCallback, useEffect, useState } from 'react';
import { addView, browserStorage, canStore, deleteView, readViews, renameView, type SavedView } from './saved-views-model.mjs';

export type SavedViewsState = { status: 'pending' | 'ready'; blocked: boolean; views: SavedView[] };

const CHANGED = 'gabf-saved-views-changed';
const announce = () => {
  try { window.dispatchEvent(new Event(CHANGED)); } catch { /* nothing listens */ }
};

export function useSavedViews() {
  const [state, setState] = useState<SavedViewsState>({ status: 'pending', blocked: false, views: [] });

  const refresh = useCallback(() => {
    const storage = browserStorage();
    const { blocked, views } = readViews(storage);
    setState({ status: 'ready', blocked: blocked || !canStore(storage), views });
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener(CHANGED, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(CHANGED, refresh);
    };
  }, [refresh]);

  const apply = useCallback((change: { ok: boolean }) => {
    if (change.ok) announce();
    else refresh();
    return change.ok;
  }, [refresh]);

  return {
    ...state,
    add: (view: { name: string; path: string; hash: string; title: string }) => apply(addView(browserStorage(), view)),
    rename: (id: string, name: string) => apply(renameView(browserStorage(), id, name)),
    remove: (id: string) => apply(deleteView(browserStorage(), id)),
  };
}
