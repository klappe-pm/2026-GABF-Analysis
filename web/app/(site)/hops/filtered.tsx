'use client';

// The medal beer views of the hop and hop farm pages, as views that follow the global filter. Every hop
// beer is a medal of one year, so a page fixes that year as its scope (the Filters dialog then counts that
// year's medals) and each view narrows its own beers by the rest of the selection.
import { type ReactNode } from 'react';
import { BeerProfileCard, type BeerCardData } from '@/components/BeerProfileCard';
import { type Column, DataTable, type Row } from '@/components/DataTable';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { useFilteredRows, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import type { FilterFields } from '@/lib/site-data';

export type FilteredCopy = {
  countOne: string;
  countMany: string;
  emptyTitle: string;
  emptyHint: string;
  fixedYear: string;
  cardsTitle: string;
};

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in values ? String(values[k]) : m));
const n = (count: number) => count.toLocaleString('en-US');

// Fixes the page's year for the Filters dialog and shows it as a chip that stays. One per page.
export function PageYear({ year, fixedYear }: { year: number; fixedYear: string }) {
  usePageScope({ year: String(year) }, [fixedYear]);
  return null;
}

function Count({ count, copy }: { count: number; copy: FilteredCopy }) {
  return <p role="status" className="type-title-small tabular-nums text-on-surface">{count === 1 ? copy.countOne : fill(copy.countMany, { count: n(count) })}</p>;
}

function Empty({ copy }: { copy: FilteredCopy }) {
  return <StateCard kind="empty" title={copy.emptyTitle}>{copy.emptyHint}</StateCard>;
}

type BeerRow = FilterFields & { key: string; sort: Row['sort']; cells: Record<string, ReactNode>; card: BeerCardData };

// A table of medal beers and, under it, a profile card for each beer in view.
export function FilteredBeers({ rows, columns, initialSort, caption, sortHint, copy }: { rows: BeerRow[]; columns: Column[]; initialSort?: { key: string; dir: 'ascending' | 'descending' }; caption: string; sortHint: string; copy: FilteredCopy }) {
  const shown = useFilteredRows(rows);
  if (!rows.length) return null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Count count={shown.length} copy={copy} />
      {shown.length ? (
        <>
          <DataTable caption={caption} sortHint={sortHint} columns={columns} rows={shown.map((r) => ({ key: r.key, sort: r.sort, cells: r.cells }))} initialSort={initialSort} scroll={false} />
          <h3 className="type-title-large text-on-surface">{copy.cardsTitle}</h3>
          <div className="grid grid-cols-1 gap-4 medium:grid-cols-2 expanded:grid-cols-3">
            {shown.map((r) => <BeerProfileCard key={r.key} data={r.card} headingLevel={4} />)}
          </div>
        </>
      ) : <Empty copy={copy} />}
    </div>
  );
}

type BreweryRow = FilterFields & { brewery: string; brewerySlug: string; kind?: string };

// The breweries behind the beers in view, with how many beers each has. A row names the way a farm links
// the brewery (`kind`) when the page keeps the two kinds apart.
export function FilteredBreweries({ rows, columns, kindLabels, caption, sortHint, copy }: { rows: BreweryRow[]; columns: { brewery: string; kind: string; beers: string }; kindLabels: Record<string, string>; caption: string; sortHint: string; copy: FilteredCopy }) {
  const shown = useFilteredRows(rows);
  const grouped = new Map<string, { brewery: string; brewerySlug: string; kind?: string; count: number }>();
  for (const r of shown) {
    const key = `${r.kind ?? ''}|${r.brewerySlug}`;
    const slot = grouped.get(key) ?? { brewery: r.brewery, brewerySlug: r.brewerySlug, kind: r.kind, count: 0 };
    slot.count += 1;
    grouped.set(key, slot);
  }
  const list = [...grouped.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'named' ? -1 : 1) || b.count - a.count || a.brewery.localeCompare(b.brewery));
  const hasKind = rows.some((r) => r.kind);
  const cols: Column[] = [
    { key: 'brewery', label: columns.brewery, sortable: true },
    ...(hasKind ? [{ key: 'kind', label: columns.kind, sortable: true }] : []),
    { key: 'count', label: columns.beers, numeric: true, sortable: true },
  ];
  if (!rows.length) return null;
  if (!list.length) return <Empty copy={copy} />;
  return (
    <DataTable
      caption={caption}
      sortHint={sortHint}
      columns={cols}
      rows={list.map((b) => ({
        key: `${b.kind ?? ''}-${b.brewerySlug}`,
        sort: { brewery: b.brewery, kind: b.kind ?? null, count: b.count },
        cells: { brewery: <TextLink href={href(paths.brewery(b.brewerySlug))}>{b.brewery}</TextLink>, kind: b.kind ? kindLabels[b.kind] : null, count: n(b.count) },
      }))}
      scroll={false}
    />
  );
}
