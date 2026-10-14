'use client';

// An (E) beside an estimated figure whose explanation and inputs load when the note is opened, from the brewery's
// own file at /data/estimates/<slug>.json. Nothing is fetched until a reader opens the note, and a file is fetched
// once however many figures of the brewery are opened.
import { useEffect, useState } from 'react';
import { EstimateTooltip, type EstimateInput } from '@/components/EstimateTooltip';
import { href } from '@/lib/href';

type Loaded = { explanations: Record<string, string>; inputs: EstimateInput[] };
const files = new Map<string, Promise<Loaded>>();

function load(slug: string): Promise<Loaded> {
  if (!files.has(slug)) {
    const p = fetch(href(`/data/estimates/${slug}.json`)).then((r) => (r.ok ? (r.json() as Promise<Loaded>) : Promise.reject(new Error(String(r.status)))));
    p.catch(() => files.delete(slug));
    files.set(slug, p);
  }
  return files.get(slug) as Promise<Loaded>;
}

export type LazyEstimateCopy = { marker: string; label: string; linkText: string; loading: string; failed: string };

export function LazyEstimate({ slug, metric, id, copy }: { slug: string; metric: string; id: string; copy: LazyEstimateCopy }) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; data?: Loaded }>({ status: 'idle' });
  useEffect(() => {
    const note = document.getElementById(id);
    if (!note) return undefined;
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState !== 'open') return;
      setState((s) => (s.status === 'ready' || s.status === 'loading' ? s : { status: 'loading' }));
      load(slug).then((data) => setState({ status: 'ready', data }), () => setState({ status: 'error' }));
    };
    note.addEventListener('toggle', onToggle);
    return () => note.removeEventListener('toggle', onToggle);
  }, [id, slug]);
  const text = state.status === 'ready' ? state.data?.explanations[metric] ?? copy.failed : state.status === 'error' ? copy.failed : copy.loading;
  return <EstimateTooltip id={id} marker={copy.marker} label={copy.label} explanation={text} inputs={state.status === 'ready' ? state.data?.inputs : undefined} linkText={copy.linkText} />;
}
