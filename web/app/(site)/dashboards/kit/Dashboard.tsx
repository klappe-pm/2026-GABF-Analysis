'use client';

// One dashboard: the summary tiles, the panels, and the tables, all following the global filter. The page
// (a server component) sends the copy and the build time lookups; this loads the medals in the browser,
// narrows them by the selection, and draws. Selecting a mark in a chart sets that value in the global filter.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Field, FieldGrid } from '@/components/StatCard';
import { MedalMark } from '@/components/MedalMark';
import { Select } from '@/components/Select';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { useFilteredRows, useGlobalFilter, usePageScope } from '@/lib/global-filter';
import { includesPartial, hashFor, parseHash } from '@/lib/filter-model.mjs';
import { href, paths } from '@/lib/href';
import { sortByLabel } from '@/lib/models/rates.mjs';
import { fmtN } from './charts';
import { makeCopy, type CopyTree } from './copy';
import { OptionChart, type ChartSpec } from './OptionChart';
import * as P from './panels';
import { ControlsTable, FinancialTable, ResultsTable } from './tables';

export type DashboardKind = 'overview' | 'geography' | 'categories' | 'breweries' | 'economics';

type Props = {
  kind: DashboardKind;
  copy: CopyTree;
  tiles: Record<string, [number, number]>;
  rateYears: { latest: number; data: number };
  defaultBrewery: string;
  aboutLabel: string;
};

type Built = ChartSpec | { empty: string } | null;
type Slot = { build: (ctx: P.Ctx) => Built; wide?: boolean };

// The panels of each dashboard, in order. A wide panel spans both columns.
const PANELS: Record<DashboardKind, Slot[]> = {
  overview: [{ build: P.medalsByYear }, { build: P.medalsByState }, { build: P.topStates }, { build: P.styleFamilies }, { build: P.topBreweries, wide: true }],
  geography: [{ build: P.medalsByState, wide: true }, { build: P.topStates }, { build: P.byRegion }, { build: P.byDivision }, { build: P.byFedDistrict }, { build: P.districtRates }, { build: P.perCapita, wide: true }, { build: P.perGdp, wide: true }],
  categories: [{ build: P.entrants, wide: true }, { build: P.entryOdds, wide: true }, { build: P.entryOddsHeat, wide: true }, { build: P.specialShare }, { build: P.entriesVsBreweries }],
  breweries: [{ build: P.breweryTrend, wide: true }, { build: P.breweryCategories }, { build: P.breweryLocations }],
  economics: [{ build: P.ownershipShare }, { build: P.parents }, { build: P.revenueByBrewery, wide: true }],
};

function useJson<T>(path: string, wanted: boolean): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    fetch(href(path)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then((v) => { if (live) setValue(v as T); }).catch(() => undefined);
    return () => { live = false; };
  }, [path, wanted]);
  return value;
}

function Stats({ rows, copy }: { rows: P.MedalRow[]; copy: ReturnType<typeof makeCopy> }) {
  const med = copy.group('labels.medal');
  const count = (key: string) => new Set(rows.map((r) => r[key])).size;
  const special = rows.filter((r) => r.special).length;
  const entries = [...new Map(rows.filter((r) => r.entries).map((r) => [`${r.year}|${r.category_name}`, r.entries as number])).values()].reduce((s, n) => s + n, 0);
  const split = ['Gold', 'Silver', 'Bronze'].map((m) => ({ m, n: rows.filter((r) => r.medal === m).length }));
  return (
    <FieldGrid>
      <Field label={copy.t('page.stats.medals')}>{fmtN(rows.length)}</Field>
      <Field label={copy.t('page.stats.breweries')}>{fmtN(count('brewery_key'))}</Field>
      <Field label={copy.t('page.stats.states')}>{fmtN(count('state'))}</Field>
      <Field label={copy.t('page.stats.categories')} note={copy.t('page.stats.categories_note', { count: fmtN(special) })}>{fmtN(count('category_name'))}</Field>
      <Field label={copy.t('page.stats.medal_split')}>
        <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
          {split.map(({ m, n }) => (
            <span key={m} className="inline-flex items-center gap-1">
              <MedalMark medal={m as 'Gold' | 'Silver' | 'Bronze'} size="sm" title={med[m]} label={false} />
              {fmtN(n)}
            </span>
          ))}
        </span>
      </Field>
      <Field label={copy.t('page.stats.entrants')} note={copy.t('page.stats.entrants_note')}>{entries ? fmtN(entries) : copy.t('page.stats.entrants_missing')}</Field>
    </FieldGrid>
  );
}

function csvOf(rows: P.MedalRow[]) {
  const cols = ['year', 'competition', 'category_number', 'category_name', 'category_type', 'entries', 'medal', 'beer_name', 'brewery_name', 'brewery_location', 'city', 'state', 'region', 'fed_district', 'fed_district_name', 'fed_district_method', 'style_family', 'abv_min', 'abv_max', 'abv', 'brewery_type', 'ownership_type', 'parent', 'distribution_channel'];
  const quote = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => quote(r[c])).join(','))].join('\n');
}

export function Dashboard({ kind, copy: tree, tiles, rateYears, defaultBrewery, aboutLabel }: Props) {
  const copy = useMemo(() => makeCopy(tree), [tree]);
  const { data, status, load, state, setState } = useGlobalFilter();
  usePageScope({}, []);
  useEffect(load, [load]);

  const needBreweries = kind === 'breweries' || kind === 'economics';
  const breweries = useJson<P.Brewery[]>('/data/breweries.json', needBreweries);
  const estimates = useJson<Record<string, { text?: Record<string, string> }>>('/data/estimates.json', kind === 'economics');

  // The brewery picked on the breweries dashboard lives in the address beside the filter keys.
  const [picked, setPicked] = useState('');
  useEffect(() => {
    const read = () => setPicked(parseHash(window.location.hash).brewery ?? '');
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const pick = (key: string) => {
    setPicked(key);
    const h = parseHash(window.location.hash);
    h.brewery = key;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${hashFor(h)}`);
  };

  const all = useMemo(() => (data?.rows ?? []) as P.MedalRow[], [data]);
  const meta = (data?.meta ?? {}) as P.Meta;
  const inFilter = useFilteredRows(all);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    if (kind === 'breweries') for (const r of inFilter) m.set(r.brewery_key as string, (m.get(r.brewery_key as string) ?? 0) + 1);
    return m;
  }, [inFilter, kind]);
  const choices = useMemo(() => sortByLabel((breweries ?? []).filter((b) => counts.has(b.key)), (b) => b.name as string), [breweries, counts]);
  const pickedKey = choices.some((b) => b.key === picked) ? picked : choices.some((b) => b.key === defaultBrewery) && !picked ? defaultBrewery : choices[0]?.key ?? '';
  const brewery = kind === 'breweries' ? choices.find((b) => b.key === pickedKey) ?? null : null;

  const rows = useMemo(() => (kind === 'breweries' ? inFilter.filter((r) => r.brewery_key === pickedKey) : inFilter), [inFilter, kind, pickedKey]);
  const years = useMemo(() => (state.year ? [Number(state.year)] : ((meta.years ?? []) as number[]).filter((y) => includesPartial(state) || meta.coverage?.[y] !== 'partial')), [meta, state]);

  const toggle = useCallback((id: string, value: string) => setState({ ...state, [id]: state[id] === value ? '' : value }), [state, setState]);
  const go = useCallback((path: string) => window.location.assign(href(path)), []);

  const ctx: P.Ctx = useMemo(() => ({ rows, all, meta, breweries: breweries ?? [], years, brewery, filter: state, toggle, go, copy, tiles, rateYears }), [rows, all, meta, breweries, years, brewery, state, toggle, go, copy, tiles, rateYears]);

  const ready = status === 'ready' && (!needBreweries || breweries);
  const built = useMemo(() => (ready && rows.length ? PANELS[kind].map((slot) => ({ wide: slot.wide, out: slot.build(ctx) })) : []), [ready, rows.length, kind, ctx]);

  if (status === 'error') return <StateCard kind="error" title={copy.t('states.errors.dashboard_load')} />;
  if (!ready) return <StateCard kind="loading" title={copy.t('states.loading.data')} />;

  const partialYears = [...new Set(rows.filter((r) => r.partial).map((r) => r.year as number))].sort();
  const firstComplete = (meta.years as number[] | undefined)?.find((y) => meta.coverage?.[y] === 'complete');
  const download = () => {
    const url = URL.createObjectURL(new Blob([csvOf(rows)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gabf-results-filtered.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      {partialYears.length ? (
        <StateCard kind="notice" title={copy.t(partialYears.length > 1 ? 'states.partial_notice.many' : 'states.partial_notice.one', { years: partialYears.join(' and '), first_complete_year: firstComplete ?? '' })} />
      ) : null}
      {kind === 'breweries' ? (
        <div className="flex max-w-xl flex-col gap-2">
          <Select
            id="brewery-picker"
            label={copy.t('page.breweries.picker_label')}
            disabled={!choices.length}
            options={choices.map((b) => ({ value: b.key as string, label: copy.t('page.breweries.picker_option', { brewery_name: b.name, count: fmtN(counts.get(b.key) ?? 0) }) }))}
            value={pickedKey}
            onValueChange={pick}
          />
          {brewery ? (
            <p className="type-body-medium text-on-surface-variant">
              {[`${brewery.hq.city}, ${brewery.hq.state}`, P.labelOf(copy, 'brewery_type', brewery.brewery_type), brewery.founded ? copy.t('page.breweries.picker_meta_founded', { year: brewery.founded }) : '', brewery.ownership ? P.labelOf(copy, 'ownership_type', brewery.ownership.type) : ''].filter(Boolean).join(' · ')}
              {' · '}
              <TextLink href={href(paths.brewery(brewery.slug))}>{copy.t('page.breweries.picker_profile_link')}</TextLink>
            </p>
          ) : <p className="type-body-medium text-on-surface-variant">{copy.t('page.breweries.pick_prompt')}</p>}
        </div>
      ) : null}
      {!rows.length ? (
        <StateCard kind="empty" title={copy.t('states.no_results.title')}>{copy.t('states.no_results.remove_hint')}</StateCard>
      ) : (
        <>
          <Stats rows={rows} copy={copy} />
          <div>
            <Button onClick={download}>{copy.t('tables.download.button')}</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 expanded:grid-cols-2">
            {built.map(({ wide, out }, i) => {
              if (!out) return null;
              const span = wide ? 'expanded:col-span-2' : '';
              if ('empty' in out) {
                return <div key={`empty-${i}`} className={span}><StateCard kind="empty" title={out.empty} /></div>;
              }
              return <div key={out.id} className={`min-w-0 ${span}`}><OptionChart spec={out} /></div>;
            })}
          </div>
          {kind === 'economics' ? (
            <section className="flex flex-col gap-3" aria-labelledby="financials-title">
              <h2 id="financials-title" className="type-title-large text-on-surface">{copy.t('page.economics.table_title')}</h2>
              <FinancialTable breweries={(breweries ?? []).filter((b) => new Set(rows.map((r) => r.brewery_key)).has(b.key))} copy={copy} estimates={estimates} aboutLabel={aboutLabel} caption={copy.t('page.economics.table_title')} />
            </section>
          ) : null}
          {kind === 'geography' ? (
            <section className="flex flex-col gap-3" aria-labelledby="controls-title">
              <h2 id="controls-title" className="type-title-large text-on-surface">{copy.t('page.geography.controls_title')}</h2>
              <ControlsTable rows={rows} meta={meta} copy={copy} rateYears={rateYears} />
            </section>
          ) : null}
          {kind === 'overview' || kind === 'categories' || kind === 'breweries' ? (
            <section className="flex flex-col gap-3" aria-labelledby="results-title">
              <h2 id="results-title" className="type-title-large text-on-surface">{copy.t(`page.${kind}.results_title`)}</h2>
              <ResultsTable rows={rows} copy={copy} caption={copy.t(`page.${kind}.results_title`)} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
