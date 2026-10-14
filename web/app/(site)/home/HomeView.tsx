'use client';

// The home page's interactive part: the scoresheet, the search, the headline finding, and the category
// index. It starts as the page was built (the latest year) and follows the address: a link such as
// /#year=2024 or /#region=West redraws the scoresheet and the index for that selection, as it did on the
// current site.
import { Fragment, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataTable, type Column, type Row } from '@/components/DataTable';
import { Field, FieldGrid } from '@/components/StatCard';
import { SearchField } from '@/components/SearchField';
import { TextLink } from '@/components/TextLink';
import { fmtN } from '../dashboards/kit/charts';
import { makeCopy, type CopyTree } from '../dashboards/kit/copy';
import { applyFilters, isDefaultState } from '@/lib/filter-model.mjs';
import { useGlobalFilter, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import { categoryLines, scoresheet, searchIndexMatches, type CategoryLine, type SearchEntry, type Winner } from '@/lib/models/home.mjs';

type Initial = { year: number; firstYear: number; lastYear: number; scoresheet: { medals: number; categories: number; entries: number | null }; categories: CategoryLine[] };

export function HomeView({ copy: tree, initial, search, finding }: { copy: CopyTree; initial: Initial; search: SearchEntry[]; finding: ReactNode }) {
  const copy = useMemo(() => makeCopy(tree), [tree]);
  const { state, data, load } = useGlobalFilter();
  usePageScope({}, []);
  // The built page shows the latest year. Any selection in the address needs the medals, so load them then.
  const custom = !isDefaultState(state);
  useEffect(() => { if (custom) load(); }, [custom, load]);

  const view = useMemo(() => {
    if (!custom || !data) return initial;
    const year = state.year ? Number(state.year) : initial.year;
    const rows = applyFilters(data.rows as Record<string, unknown>[], state).filter((r) => r.year === year);
    const summary = (data.meta.summary as { competition: string; year: string; entries: string }[] | undefined)?.find((s) => s.competition === 'GABF' && Number(s.year) === year);
    const whole = Object.keys(state).every((k) => k === 'year');
    return { year, firstYear: initial.firstYear, lastYear: initial.lastYear, scoresheet: scoresheet(rows, whole && summary?.entries ? Number(summary.entries) : null), categories: categoryLines(rows) };
  }, [custom, data, state, initial]);

  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const hits = useMemo(() => searchIndexMatches(search, deferred), [search, deferred]);
  const kinds: Record<string, string> = { brewery: copy.t('page.search.kind_brewery'), category: copy.t('page.search.kind_category'), beer: copy.t('page.search.kind_beer') };

  const med = copy.group('labels.medal');
  const winners = (list: Winner[]) => list.map((w, i) => <Fragment key={w.slug}>{i ? '; ' : ''}<TextLink href={href(paths.brewery(w.slug))}>{w.name}</TextLink></Fragment>);
  const c = (key: string) => copy.t(`page.category_index.columns.${key}`);
  const columns: Column[] = [
    { key: 'category', label: c('category'), sortable: true },
    { key: 'entries', label: c('entries'), numeric: true, sortable: true },
    { key: 'odds', label: c('odds'), numeric: true, sortable: true },
    { key: 'gold', label: med.Gold ?? c('gold') },
    { key: 'silver', label: med.Silver ?? c('silver') },
    { key: 'bronze', label: med.Bronze ?? c('bronze') },
  ];
  const rows: Row[] = view.categories.map((l) => ({
    key: l.slug,
    sort: { category: l.number, entries: l.entries, odds: l.odds },
    cells: {
      category: <TextLink href={href(paths.category(l.slug))}>{l.name}</TextLink>,
      entries: l.entries ? fmtN(l.entries) : copy.t('page.scoresheet.not_published'),
      odds: l.odds === null ? copy.t('page.scoresheet.not_published') : String(l.odds),
      gold: winners(l.gold),
      silver: winners(l.silver),
      bronze: winners(l.bronze),
    },
  }));
  const hasEntries = view.categories.some((l) => l.entries);
  const sheet = view.scoresheet;
  const noMatch = deferred.trim() && !hits.length;

  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{copy.t('page.hero.title', { year: view.year })}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{copy.t('page.hero.lede', { first_year: view.firstYear, last_year: view.lastYear })}</p>
      </header>
      <section className="grid grid-cols-1 gap-4 expanded:grid-cols-[2fr_1fr]" aria-label={copy.t('page.scoresheet.competition_year')}>
        <FieldGrid>
          <Field size="text" label={copy.t('page.scoresheet.competition_year')}>{copy.t('page.scoresheet.competition_value', { year: view.year })}</Field>
          <Field label={copy.t('page.scoresheet.entries_judged')}>{sheet.entries ? fmtN(sheet.entries) : copy.t('page.scoresheet.not_published')}</Field>
          <Field label={copy.t('page.scoresheet.categories')}>{fmtN(sheet.categories)}</Field>
          <Field label={copy.t('page.scoresheet.medals_awarded')}>{fmtN(sheet.medals)}</Field>
        </FieldGrid>
        {finding}
      </section>
      <section className="flex max-w-xl flex-col gap-2">
        <SearchField id="home-search" label={copy.t('page.search.label')} placeholder={copy.t('page.search.placeholder')} value={query} onValueChange={setQuery} error={noMatch ? copy.t('page.search.no_match', { query: deferred.trim() }) : undefined} />
        {hits.length ? (
          <ul aria-label={copy.t('page.search.results_label')} className="type-body-large flex flex-col gap-1">
            {hits.map((h) => (
              <li key={h.path}>
                <TextLink href={href(h.path)}>{h.label}</TextLink>
                <span className="text-on-surface-variant"> {kinds[h.kind]}{h.meta ? `, ${h.meta}` : ''}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="category-index-title">
        <h2 id="category-index-title" className="type-title-large text-on-surface">{copy.t('page.category_index.title', { year: view.year })}</h2>
        {hasEntries ? <p className="type-body-medium max-w-measure text-on-surface-variant">{copy.t('page.category_index.note')}</p> : <p className="type-body-medium text-on-surface-variant">{copy.t('page.category_index.empty', { year: view.year })}</p>}
        {rows.length ? <DataTable caption={copy.t('page.category_index.title', { year: view.year })} columns={columns} rows={rows} scroll={false} initialSort={{ key: 'category', dir: 'ascending' }} /> : null}
      </section>
    </>
  );
}
