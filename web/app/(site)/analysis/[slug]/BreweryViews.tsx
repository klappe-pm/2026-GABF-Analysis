'use client';

// The two reports about breweries that follow the global filter: the top breweries by points, and the
// estimated economics of every medalist in view.
import { type Column, DataTable, type Row as TableRow } from '@/components/DataTable';
import { SectionHeader } from '@/components/SectionHeader';
import { StateCard } from '@/components/StateCard';
import { StatusChip } from '@/components/StatusChip';
import { TextLink } from '@/components/TextLink';
import { useFilteredRows, useGlobalFilter, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import { aggregateBreweries, CHART_BREWERIES, TOP_BREWERIES, yearsInView } from '@/lib/models/analysis-calc.mjs';
import type { Row } from '@/lib/models/analysis-calc.mjs';
import type { BreweryInfo } from '@/lib/models/analysis.mjs';
import { BarCard } from '@/app/(site)/analysis/parts/charts';
import { fill, num, percent, usd, ViewFrame, type ViewCopy } from '@/app/(site)/analysis/parts/kit';

type Meta = { years: number[]; coverage: Record<string, string>; latestComplete: number };
const split = (g: number, s: number, b: number) => `${g} / ${s} / ${b}`;

export type TopBreweriesCopy = {
  view: ViewCopy;
  chart: { title: string; subtitle: string; valueName: string; labelHeader: string; tableSummary: string };
  streaks: { title: string; note: string; item: string; empty: string; firstTime: string; firstTimeLink: string };
  table: { title: string; caption: string; sortHint: string; year: string };
  columns: Record<'rank' | 'brewery' | 'hq' | 'points' | 'medals' | 'split' | 'first' | 'ownership', string>;
  yearColumns: Record<'brewery' | 'points' | 'medals' | 'split', string>;
  ownership: Record<string, string>;
  coverage: Record<string, string>;
  coverageMeaning: Record<string, string>;
};

export function TopBreweriesView({ rows, info, streaks, meta, copy, firstCompleteYear }: { rows: Row[]; info: Record<string, BreweryInfo>; streaks: { name: string; slug: string; streak: number }[]; meta: Meta; copy: TopBreweriesCopy; firstCompleteYear: number | null }) {
  usePageScope({}, []);
  const { state } = useGlobalFilter();
  const shown = useFilteredRows(rows);
  const all = aggregateBreweries(shown).slice(0, TOP_BREWERIES);
  const bars = all.slice(0, CHART_BREWERIES).map((b) => ({ label: b.name, value: b.points, href: href(paths.brewery(b.slug)) }));
  const perYear = yearsInView(meta, state).filter((y) => shown.some((x) => x.year === y)).reverse()
    .map((y) => ({ year: y, coverage: meta.coverage[y], list: aggregateBreweries(shown.filter((x) => x.year === y)).slice(0, 25) }));
  const columns: Column[] = [
    { key: 'rank', label: copy.columns.rank, numeric: true },
    { key: 'brewery', label: copy.columns.brewery, sortable: true },
    { key: 'hq', label: copy.columns.hq, sortable: true },
    { key: 'points', label: copy.columns.points, numeric: true, sortable: true },
    { key: 'medals', label: copy.columns.medals, numeric: true, sortable: true },
    { key: 'split', label: copy.columns.split },
    { key: 'first', label: copy.columns.first, numeric: true, sortable: true },
    { key: 'ownership', label: copy.columns.ownership, sortable: true },
  ];
  const table: TableRow[] = all.map((b, i) => {
    const o = info[b.key];
    const owner = copy.ownership[o?.ownership_type || 'unlisted'] ?? '';
    return {
      key: b.key,
      sort: { brewery: o?.name ?? b.name, hq: o?.hq ?? '', points: b.points, medals: b.medals, first: b.first, ownership: owner },
      cells: { rank: i + 1, brewery: <TextLink href={href(paths.brewery(o?.slug ?? b.slug))}>{o?.name ?? b.name}</TextLink>, hq: o?.hq ?? '', points: num(b.points), medals: num(b.medals), split: split(b.g, b.s, b.b), first: b.first, ownership: owner },
    };
  });
  const yearColumns: Column[] = [
    { key: 'brewery', label: copy.yearColumns.brewery },
    { key: 'points', label: copy.yearColumns.points, numeric: true },
    { key: 'medals', label: copy.yearColumns.medals, numeric: true },
    { key: 'split', label: copy.yearColumns.split },
  ];
  const [before, after] = copy.streaks.firstTime.split(copy.streaks.firstTimeLink);
  const [streakBefore, streakAfter] = copy.streaks.item.split('{{brewery_name}}');
  return (
    <ViewFrame rows={shown} scopeCount={rows.length} copy={copy.view} firstCompleteYear={firstCompleteYear}>
      <div className="grid gap-4 expanded:grid-cols-2">
        <BarCard id="top-breweries-points" title={copy.chart.title} subtitle={copy.chart.subtitle} items={bars} valueName={copy.chart.valueName} labelHeader={copy.chart.labelHeader} tableSummary={copy.chart.tableSummary} ariaLabel={copy.chart.title} roleIndex={1} labelWidth={220} />
        <StateCard kind="notice" title={copy.streaks.title}>
          <p>{fill(copy.streaks.note, { year: meta.latestComplete })}</p>
          {streaks.length ? (
            <ol className="mt-2 list-decimal pl-6">
              {streaks.map((b) => <li key={b.slug}>{streakBefore}<TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>{fill(streakAfter, { count: b.streak })}</li>)}
            </ol>
          ) : <p className="mt-2">{copy.streaks.empty}</p>}
          <p className="mt-2">{before}<TextLink href={href(paths.firstTime(meta.latestComplete))}>{copy.streaks.firstTimeLink}</TextLink>{after}</p>
        </StateCard>
      </div>
      <section className="flex flex-col gap-3" aria-labelledby="top-50">
        <SectionHeader id="top-50" title={copy.table.title} />
        <DataTable caption={copy.table.title} sortHint={copy.table.sortHint} columns={columns} rows={table} scroll={false} />
      </section>
      {perYear.map((p) => (
        <section key={p.year} className="flex flex-col gap-3" aria-labelledby={`year-${p.year}`}>
          <SectionHeader id={`year-${p.year}`} title={fill(copy.table.year, { year: p.year })} aside={p.coverage !== 'complete' ? <StatusChip label={copy.coverage[p.coverage] ?? p.coverage} meaning={copy.coverageMeaning[p.coverage]} /> : undefined} />
          <DataTable
            caption={fill(copy.table.year, { year: p.year })}
            columns={yearColumns}
            rows={p.list.map((b) => ({ key: b.key, cells: { brewery: <TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>, points: num(b.points), medals: num(b.medals), split: split(b.g, b.s, b.b) } }))}
            scroll={false}
          />
        </section>
      ))}
    </ViewFrame>
  );
}

export type EconomicsCopy = {
  view: ViewCopy;
  chart: { title: string; subtitle: string; valueName: string; labelHeader: string; tableSummary: string };
  table: { title: string; sortHint: string };
  columns: Record<'brewery' | 'type' | 'locations' | 'barrels' | 'basis' | 'cases' | 'arr' | 'grossMargin' | 'ebitda' | 'ebitdaRange' | 'distribution' | 'ownership', string>;
  types: Record<string, string>;
  basis: Record<string, string>;
  channels: Record<string, string>;
  ownership: Record<string, string>;
  range: string;
};

export function EconomicsView({ rows, info, copy, firstCompleteYear }: { rows: Row[]; info: Record<string, BreweryInfo>; copy: EconomicsCopy; firstCompleteYear: number | null }) {
  usePageScope({}, []);
  const shown = useFilteredRows(rows);
  const keys = new Set(shown.map((x) => x.brewery_key as string));
  const list = [...keys].map((k) => info[k]).filter(Boolean).sort((a, b) => (b.arr ?? 0) - (a.arr ?? 0));
  const bars = list.slice(0, CHART_BREWERIES).map((b) => ({ label: b.name, value: b.arr ?? 0, href: href(paths.brewery(b.slug)) }));
  const columns: Column[] = [
    { key: 'brewery', label: copy.columns.brewery, sortable: true },
    { key: 'type', label: copy.columns.type, sortable: true },
    { key: 'locations', label: copy.columns.locations, numeric: true, sortable: true },
    { key: 'barrels', label: copy.columns.barrels, numeric: true, sortable: true },
    { key: 'basis', label: copy.columns.basis, sortable: true },
    { key: 'cases', label: copy.columns.cases, numeric: true, sortable: true },
    { key: 'arr', label: copy.columns.arr, numeric: true, sortable: true },
    { key: 'grossMargin', label: copy.columns.grossMargin, numeric: true, sortable: true },
    { key: 'ebitda', label: copy.columns.ebitda, numeric: true, sortable: true },
    { key: 'ebitdaRange', label: copy.columns.ebitdaRange },
    { key: 'distribution', label: copy.columns.distribution, sortable: true },
    { key: 'ownership', label: copy.columns.ownership, sortable: true },
  ];
  const table: TableRow[] = list.map((b) => ({
    key: b.key,
    sort: { brewery: b.name, type: copy.types[b.brewery_type] ?? '', locations: b.locations_count, barrels: b.barrels, basis: copy.basis[b.basis] ?? b.basis, cases: b.cases, arr: b.arr, grossMargin: b.gross_margin, ebitda: b.ebitda, distribution: copy.channels[b.distribution_channel || 'unknown'] ?? '', ownership: copy.ownership[b.ownership_type || 'unlisted'] ?? '' },
    cells: {
      brewery: <TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>,
      type: copy.types[b.brewery_type] ?? '',
      locations: b.locations_count,
      barrels: num(b.barrels),
      basis: copy.basis[b.basis] ?? b.basis,
      cases: num(b.cases),
      arr: usd(b.arr),
      grossMargin: percent(b.gross_margin),
      ebitda: usd(b.ebitda),
      ebitdaRange: fill(copy.range, { min: percent(b.ebitda_margin_low), max: percent(b.ebitda_margin_high) }),
      distribution: copy.channels[b.distribution_channel || 'unknown'] ?? '',
      ownership: copy.ownership[b.ownership_type || 'unlisted'] ?? '',
    },
  }));
  return (
    <ViewFrame rows={shown} scopeCount={rows.length} copy={copy.view} firstCompleteYear={firstCompleteYear}>
      <BarCard id="arr-by-brewery" title={copy.chart.title} subtitle={copy.chart.subtitle} items={bars} valueName={copy.chart.valueName} labelHeader={copy.chart.labelHeader} tableSummary={copy.chart.tableSummary} ariaLabel={copy.chart.title} roleIndex={4} labelWidth={220} />
      <section className="flex flex-col gap-3" aria-labelledby="all-medalists">
        <SectionHeader id="all-medalists" title={copy.table.title} />
        <DataTable caption={copy.table.title} sortHint={copy.table.sortHint} columns={columns} rows={table} initialSort={{ key: 'arr', dir: 'descending' }} scroll={false} />
      </section>
    </ViewFrame>
  );
}
