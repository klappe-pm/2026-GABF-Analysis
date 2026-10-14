'use client';

// The first time medalists of a year as a view that follows the global filter: the summary tiles, four
// breakdowns, and the two medal tables. The page sends every medal of the year; this narrows them.
import { useMemo } from 'react';
import { type Column, DataTable, type Row } from '@/components/DataTable';
import { MedalMark, type MedalName } from '@/components/MedalMark';
import { MedalRecord } from '@/components/MedalRecord';
import { SectionHeader } from '@/components/SectionHeader';
import { Field, FieldGrid } from '@/components/StatCard';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { useFilteredRows, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import type { FirstTimeRow } from '@/lib/models/breweries.mjs';

type Copy = Record<string, Record<string, string>>;

const RANK: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };
const MEDALS: MedalName[] = ['Gold', 'Silver', 'Bronze'];
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in values ? String(values[k]) : m));
const tally = (items: string[]) => {
  const m = new Map<string, number>();
  for (const i of items) if (i) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
};
const share = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '0%');
const abvText = (x: number) => `${Number.isInteger(x) ? x : x.toFixed(1).replace(/\.0$/, '')}%`;

export function FirstTimeView({ year, rows, copy: c, partialYears, completeRange }: { year: number; rows: FirstTimeRow[]; copy: Copy; partialYears: string; completeRange: string }) {
  usePageScope({ year: String(year) }, [fill(c.fixed.year, { year })]);
  const shown = useFilteredRows(rows) as FirstTimeRow[];
  const none = <span className="text-on-surface-variant">{c.gaps.not_defined}</span>;
  const notPublished = <span className="text-on-surface-variant">{c.gaps.not_published}</span>;
  const medalNames = c.medal as Record<MedalName, string>;

  const fresh = useMemo(() => shown.filter((r) => r.first_time === 'new'), [shown]);
  const complete = useMemo(() => shown.filter((r) => r.first_time === 'new-complete'), [shown]);
  const counts = { gold: fresh.filter((r) => r.medal === 'Gold').length, silver: fresh.filter((r) => r.medal === 'Silver').length, bronze: fresh.filter((r) => r.medal === 'Bronze').length };
  const breweries = new Set(fresh.map((r) => r.brewery_key)).size;
  const completeBreweries = new Set(complete.map((r) => r.brewery_key)).size;

  const breakdown = (id: string, title: string, lead: string | undefined, label: string, list: [string, number][]) => (
    <section key={id} aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-3">
      <SectionHeader id={`${id}-title`} title={title} lead={lead} level={3} />
      <DataTable
        caption={title}
        scroll={false}
        columns={[{ key: 'name', label, sortable: true }, { key: 'medals', label: c.units.medals, sortable: true }]}
        rows={list.map(([name, n]) => ({ key: name, sort: { name, medals: n }, cells: { name, medals: n } }))}
        initialSort={{ key: 'medals', dir: 'descending' }}
      />
    </section>
  );

  const columns: Column[] = [
    { key: 'brewery', label: c.table.brewery, sortable: true },
    { key: 'medal', label: c.table.medal, sortable: true },
    { key: 'beer', label: c.table.beer, sortable: true },
    { key: 'abv', label: c.table.abv, sortable: true },
    { key: 'ibu', label: c.table.ibu, sortable: true },
    { key: 'profile', label: c.table.beer_profile },
    { key: 'category', label: c.table.category, sortable: true },
    { key: 'beaten', label: c.table.entries_beaten, sortable: true },
  ];
  const tableRows = (list: FirstTimeRow[]): Row[] => {
    const perBrewery = new Map<string, number>();
    for (const r of list) perBrewery.set(r.brewery_key, (perBrewery.get(r.brewery_key) ?? 0) + 1);
    return [...list]
      .sort((x, y) => (perBrewery.get(y.brewery_key) ?? 0) - (perBrewery.get(x.brewery_key) ?? 0) || x.brewery_name.localeCompare(y.brewery_name) || (RANK[x.medal] ?? 9) - (RANK[y.medal] ?? 9))
      .map((r, i) => {
        const stem = r.beer_profile ? r.beer_profile.split('/').filter(Boolean).at(-1) : null;
        return {
          key: `${r.brewery_key}-${r.category_slug}-${r.medal}-${i}`,
          sort: { brewery: r.brewery_name, medal: RANK[r.medal] ?? 9, beer: r.beer_name, abv: r.abv, ibu: r.ibu, category: r.category_name, beaten: r.entries ? Math.max(0, r.entries - 1) : null },
          cells: {
            brewery: <span><TextLink href={href(paths.brewery(r.brewery_slug))}>{r.brewery_name}</TextLink> <span className="text-on-surface-variant">{r.city}, {r.state}</span></span>,
            medal: <span className="inline-flex items-center gap-2"><MedalMark medal={r.medal as MedalName} size="sm" title={medalNames[r.medal as MedalName]} />{medalNames[r.medal as MedalName] ?? r.medal}</span>,
            beer: stem ? <TextLink href={href(paths.beer(year, stem))}>{r.beer_name}</TextLink> : r.beer_name,
            abv: r.abv === null || r.abv === undefined ? none : abvText(Number(r.abv)),
            ibu: r.ibu === null || r.ibu === undefined ? none : String(r.ibu),
            profile: stem ? <TextLink href={href(paths.beer(year, stem))}>{c.table.open_profile}</TextLink> : none,
            category: <TextLink href={href(paths.category(r.category_slug))}>{r.category_name}</TextLink>,
            beaten: r.entries ? (Math.max(0, r.entries - 1)).toLocaleString('en-US') : notPublished,
          },
        };
      });
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-label={c.stats.title}>
        <FieldGrid label={c.stats.title}>
          <Field label={c.stats.breweries} note={fill(c.stats.breweries_note, { year })}>{breweries}</Field>
          <Field label={fill(c.stats.share, { year })} note={fill(c.stats.share_note, { count: fresh.length, total: shown.length })}>{share(fresh.length, shown.length)}</Field>
          <Field label={c.stats.golds} note={fill(c.stats.golds_note, { share: share(counts.gold, fresh.length) })}>{counts.gold}</Field>
          <Field label={c.stats.split}><MedalRecord counts={counts} variant="split" names={medalNames} /></Field>
          <Field label={c.stats.complete} note={c.stats.complete_note}>{completeBreweries}</Field>
        </FieldGrid>
      </section>

      {fresh.length ? (
        <div className="grid grid-cols-1 gap-6 expanded:grid-cols-2">
          {breakdown('by-state', c.charts.by_state_title, c.charts.by_state_subtitle, c.place.state, tally(fresh.map((r) => r.state_name)).slice(0, 20))}
          {breakdown('by-district', c.charts.by_district_title, c.charts.by_district_subtitle, c.place.district, tally(fresh.map((r) => r.fed_district_name)))}
          {breakdown('by-family', c.charts.by_family_title, undefined, c.medalCols.style_family, tally(fresh.map((r) => c.style_family[r.style_family] ?? r.style_family)))}
          {breakdown('by-medal', c.charts.by_medal_title, undefined, c.medalCols.medal, MEDALS.map((m) => [medalNames[m], fresh.filter((r) => r.medal === m).length] as [string, number]))}
        </div>
      ) : null}

      <section aria-labelledby="first-title" className="flex flex-col gap-3">
        <SectionHeader id="first-title" title={c.table.title} />
        {fresh.length ? (
          <DataTable caption={fill(c.table.caption, { year })} sortHint={c.table.sort_hint} columns={columns} rows={tableRows(fresh)} scroll={false} />
        ) : (
          <StateCard kind="empty" title={c.table.empty} />
        )}
      </section>

      <section aria-labelledby="complete-title" className="flex flex-col gap-3">
        <SectionHeader id="complete-title" title={c.complete_record.title} lead={fill(c.complete_record.note, { year, partial_years: partialYears, complete_range: completeRange })} />
        {complete.length ? (
          <DataTable caption={fill(c.complete_record.caption, { year })} sortHint={c.table.sort_hint} columns={columns} rows={tableRows(complete)} scroll={false} />
        ) : (
          <p className="type-body-medium text-on-surface-variant">{c.complete_record.empty}</p>
        )}
      </section>
    </div>
  );
}
