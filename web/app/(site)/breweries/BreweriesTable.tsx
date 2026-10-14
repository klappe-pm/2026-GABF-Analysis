'use client';

// The breweries index as a view that follows the global filter. The page sends the ranking under the default
// selection (so the built page is complete) and the attributes of every brewery; under any other selection
// the medal rows load once and the ranking is drawn again from them, the way the Filters dialog counts.
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { type Column, DataTable, type Row } from '@/components/DataTable';
import { EstimateTooltip } from '@/components/EstimateTooltip';
import { MedalRecord } from '@/components/MedalRecord';
import { SearchField } from '@/components/SearchField';
import { StateCard } from '@/components/StateCard';
import { StatusChip } from '@/components/StatusChip';
import { TextLink } from '@/components/TextLink';
import { applyFilters, isDefaultState } from '@/lib/filter-model.mjs';
import { useGlobalFilter, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import type { IndexInfo } from '@/lib/models/breweries.mjs';
import { type Agg, aggregate, type MedalLine } from './aggregate';
import { type EstimateCopy, explain, markLabel } from './estimate-text';
import { fillText, usd } from './format';

const PAGE_SIZE = 100;

export type IndexCopy = {
  showing: string;
  showMore: string;
  showAll: string;
  caption: string;
  sortHint: string;
  columns: Record<'brewery' | 'hq' | 'type' | 'medals' | 'split' | 'points' | 'first' | 'latest' | 'ownership' | 'arr', string>;
  deepDive: string;
  count: string;
  countOne: string;
  searchLabel: string;
  searchPlaceholder: string;
  notDefined: string;
  methodLink: string;
  mark: string;
  medalNames: { Gold: string; Silver: string; Bronze: string };
  types: Record<string, string>;
  ownership: Record<string, string>;
  loading: string;
  emptyTitle: string;
  emptyHint: string;
  estimate: EstimateCopy;
};

export function BreweriesTable({ info, initial, copy }: { info: Record<string, IndexInfo>; initial: Agg[]; copy: IndexCopy }) {
  usePageScope({}, []);
  // The page draws the first rows only; search and filter still read every brewery.
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { state, setState, data, status, load } = useGlobalFilter();
  const isDefault = isDefaultState(state);
  useEffect(() => { if (!isDefault) load(); }, [isDefault, load]);
  const list = useMemo(() => {
    const aggs = isDefault ? initial : data ? aggregate(applyFilters(data.rows as MedalLine[], state)) : null;
    return aggs && aggs.filter((a) => info[a.key]).sort((a, b) => b.points - a.points || b.medals - a.medals || info[a.key].name.localeCompare(info[b.key].name));
  }, [isDefault, initial, data, state, info]);

  const columns: Column[] = [
    { key: 'brewery', label: copy.columns.brewery, sortable: true },
    { key: 'hq', label: copy.columns.hq, sortable: true },
    { key: 'type', label: copy.columns.type, sortable: true },
    { key: 'medals', label: copy.columns.medals, numeric: true, sortable: true },
    { key: 'split', label: copy.columns.split },
    { key: 'points', label: copy.columns.points, numeric: true, sortable: true },
    { key: 'first', label: copy.columns.first, numeric: true, sortable: true },
    { key: 'latest', label: copy.columns.latest, numeric: true, sortable: true },
    { key: 'ownership', label: copy.columns.ownership, sortable: true },
    { key: 'arr', label: copy.columns.arr, numeric: true, sortable: true },
  ];
  const none = <span className="text-on-surface-variant">{copy.notDefined}</span>;
  const rows: Row[] = (list ?? []).slice(0, limit).map((a) => {
    const b = info[a.key];
    const typeText = b.type ? copy.types[b.type] ?? copy.notDefined : copy.notDefined;
    const ownerText = copy.ownership[b.ownership] ?? copy.notDefined;
    return {
      key: a.key,
      sort: { brewery: b.name, hq: b.hq, type: typeText, medals: a.medals, points: a.points, first: a.first, latest: a.last, ownership: ownerText, arr: b.est.fin.arr },
      cells: {
        brewery: (
          <span className="inline-flex items-center gap-2">
            <TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>
            {b.deepDive ? <StatusChip label={copy.deepDive} /> : null}
          </span>
        ),
        hq: b.hq || none,
        type: b.type ? typeText : none,
        medals: a.medals,
        split: <MedalRecord counts={{ gold: a.g, silver: a.s, bronze: a.b }} variant="value" names={copy.medalNames} />,
        points: a.points,
        first: a.first,
        latest: a.last,
        ownership: b.ownership === 'unlisted' ? none : ownerText,
        arr: (
          <span className="inline-flex items-center gap-1">
            {usd(b.est.fin.arr)}
            <EstimateTooltip
              id={`est-${b.slug}-arr`}
              marker={copy.mark}
              label={markLabel('arr', copy.estimate)}
              explanation={explain('arr', b.est, copy.estimate)}
              linkText={copy.methodLink}
            />
          </span>
        ),
      },
    };
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="max-w-measure">
        <SearchField
          id="breweries-search"
          label={copy.searchLabel}
          placeholder={copy.searchPlaceholder}
          value={state.q ?? ''}
          onValueChange={(q) => {
            const next = { ...state };
            if (q) next.q = q; else delete next.q;
            setState(next);
          }}
        />
      </div>
      {list === null ? (
        <StateCard kind={status === 'error' ? 'error' : 'loading'} title={copy.loading} />
      ) : (
        <>
          <p role="status" className="type-title-small tabular-nums text-on-surface">{list.length === 1 ? copy.countOne : fillText(copy.count, { count: list.length.toLocaleString('en-US') })}</p>
          {list.length ? (
            <>
              <DataTable caption={copy.caption} sortHint={copy.sortHint} columns={columns} rows={rows} initialSort={{ key: 'points', dir: 'descending' }} scroll={false} />
              {list.length > limit ? (
                <div className="flex flex-wrap items-center gap-4">
                  <p className="type-body-medium tabular-nums text-on-surface-variant">{fillText(copy.showing, { shown: limit.toLocaleString('en-US'), total: list.length.toLocaleString('en-US') })}</p>
                  <Button variant="secondary" onClick={() => setLimit(limit + PAGE_SIZE)}>{fillText(copy.showMore, { count: Math.min(PAGE_SIZE, list.length - limit) })}</Button>
                  <Button variant="quiet" onClick={() => setLimit(list.length)}>{fillText(copy.showAll, { total: list.length.toLocaleString('en-US') })}</Button>
                </div>
              ) : null}
            </>
          ) : (
            <StateCard kind="empty" title={copy.emptyTitle}>{copy.emptyHint}</StateCard>
          )}
        </>
      )}
    </section>
  );
}
