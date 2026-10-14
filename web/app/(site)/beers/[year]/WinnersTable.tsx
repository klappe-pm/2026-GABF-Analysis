'use client';

// The winners list as a view that follows the global filter: the page sends every medal of the year,
// this narrows them by the selection and draws the table. Every filtered view on the site works this way.
import { Fragment } from 'react';
import { type Column, DataTable, type Row } from '@/components/DataTable';
import { MedalMark } from '@/components/MedalMark';
import { Field, FieldGrid } from '@/components/StatCard';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { useFilteredRows, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import type { HopWinnerRow } from '../../hops/data';

export type WinnersCopy = {
  caption: string;
  sortHint: string;
  columns: { category: string; medal: string; beer: string; brewery: string; abv: string; ibu: string; hops: string };
  categoryCell: string;
  medals: Record<string, string>;
  notPublished: string;
  countOne: string;
  countMany: string;
  fixedYear: string;
  emptyTitle: string;
  emptyHint: string;
  stats: { label: string; medals: string; medalsNote: string; abv: string; ibu: string; hops: string; beerPage: string; share: string };
};

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in values ? String(values[k]) : m));
const MEDAL_RANK: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };
const abv = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, '')}%`;

export function WinnersTable({ year, rows, copy }: { year: number; rows: HopWinnerRow[]; copy: WinnersCopy }) {
  usePageScope({ year: String(year) }, [copy.fixedYear]);
  const shown = useFilteredRows(rows);
  const none = <span className="text-on-surface-variant">{copy.notPublished}</span>;
  const columns: Column[] = [
    { key: 'category', label: copy.columns.category, sortable: true },
    { key: 'medal', label: copy.columns.medal, sortable: true },
    { key: 'beer', label: copy.columns.beer, sortable: true },
    { key: 'brewery', label: copy.columns.brewery, sortable: true },
    { key: 'abv', label: copy.columns.abv, numeric: true, sortable: true },
    { key: 'ibu', label: copy.columns.ibu, numeric: true, sortable: true },
    { key: 'hops', label: copy.columns.hops },
  ];
  const table: Row[] = shown.map((r, i) => ({
    key: `${r.category_number}-${r.medal}-${r.brewery_key}-${r.beer_name}-${i}`,
    sort: {
      category: Number(r.category_number) * 10 + (MEDAL_RANK[r.medal] ?? 9),
      medal: MEDAL_RANK[r.medal] ?? 9,
      beer: r.beer_name,
      brewery: r.brewery_name,
      abv: r.abv,
      ibu: r.ibu,
    },
    cells: {
      category: fill(copy.categoryCell, { number: r.category_number, category_name: r.category_name }),
      medal: (
        <span className="inline-flex items-center gap-2">
          <MedalMark medal={r.medal} size="sm" title={copy.medals[r.medal] ?? r.medal} />
          {copy.medals[r.medal] ?? r.medal}
        </span>
      ),
      beer: r.stem ? <TextLink href={href(paths.beer(year, r.stem))}>{r.beer_name}</TextLink> : r.beer_name,
      brewery: <TextLink href={href(paths.brewery(r.brewery_slug))}>{r.brewery_name}</TextLink>,
      abv: r.abv === null ? none : abv(r.abv),
      ibu: r.ibu === null ? none : String(r.ibu),
      hops: r.hops.length ? r.hops.map((h, j) => <Fragment key={h.slug}>{j ? ', ' : ''}<TextLink href={href(paths.hop(h.slug))}>{h.name}</TextLink></Fragment>) : none,
    },
  }));
  const total = shown.length;
  const n = (count: number) => count.toLocaleString('en-US');
  const share = (count: number) => fill(copy.stats.share, { count: n(count), total: n(total) });
  const abvCount = shown.filter((r) => r.abv !== null).length;
  const ibuCount = shown.filter((r) => r.ibu !== null).length;
  const hopCount = shown.filter((r) => r.hops.length).length;
  const pageCount = shown.filter((r) => r.beerPage).length;
  const categories = new Set(shown.map((r) => r.category_number)).size;
  return (
    <section className="flex flex-col gap-3">
      <FieldGrid label={copy.stats.label}>
        <Field label={copy.stats.medals} note={fill(copy.stats.medalsNote, { count: n(categories) })}>{n(total)}</Field>
        <Field label={copy.stats.abv} note={share(abvCount)}>{n(abvCount)}</Field>
        <Field label={copy.stats.ibu} note={share(ibuCount)}>{n(ibuCount)}</Field>
        <Field label={copy.stats.hops} note={share(hopCount)}>{n(hopCount)}</Field>
        <Field label={copy.stats.beerPage} note={share(pageCount)}>{n(pageCount)}</Field>
      </FieldGrid>
      <p role="status" className="type-title-small tabular-nums text-on-surface">{shown.length === 1 ? copy.countOne : fill(copy.countMany, { count: shown.length.toLocaleString('en-US') })}</p>
      {shown.length ? (
        <DataTable caption={copy.caption} sortHint={copy.sortHint} columns={columns} rows={table} initialSort={{ key: 'category', dir: 'ascending' }} scroll={false} />
      ) : (
        <StateCard kind="empty" title={copy.emptyTitle}>{copy.emptyHint}</StateCard>
      )}
    </section>
  );
}
