'use client';

// The two reports about breweries that follow the global filter: the top breweries by points, and the
// estimated economics of every medalist in view.
import type { ReactNode } from 'react';
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
import { Plot } from '@/app/(site)/analysis/parts/Plot';
import { dotPlot, fmtN, stackedBars } from '@/app/(site)/dashboards/kit/charts';
import { LazyEstimate } from '@/app/(site)/analysis/parts/LazyEstimate';
import { compact, fill, num, percent, usd, ViewFrame, type ViewCopy } from '@/app/(site)/analysis/parts/kit';

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
  const leaders = all.slice(0, CHART_BREWERIES);
  const med = copy.view.medals;
  const leaderRows: TableRow[] = leaders.map((b) => ({
    key: b.slug,
    sort: { brewery: b.name, split: b.points, points: b.points },
    cells: { brewery: <TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>, split: `${b.g} / ${b.s} / ${b.b}`, points: fmtN(b.points) },
  }));
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
      <div className="grid gap-4">
        <Plot
          id="top-breweries-points"
          title={copy.chart.title}
          subtitle={copy.chart.subtitle}
          chrome={copy.view.chrome}
          tableSummary={copy.chart.tableSummary}
          build={stackedBars({
            labels: leaders.map((b) => b.name),
            series: (['Gold', 'Silver', 'Bronze'] as const).map((m, i) => ({ name: med[m] ?? m, data: leaders.map((b) => [b.g, b.s, b.b][i]), color: (k) => k.medal[m] })),
            totals: { values: leaders.map((b) => b.points), format: (n) => `${fmtN(n)} ${copy.chart.valueName.toLowerCase()}` },
            labelWidth: (w) => (w < 480 ? 108 : 168),
            minLabel: 1,
            tip: (i) => `<b>${leaders[i].name}</b><br>${med.Gold ?? 'Gold'} ${leaders[i].g}, ${med.Silver ?? 'Silver'} ${leaders[i].s}, ${med.Bronze ?? 'Bronze'} ${leaders[i].b}<br>${fmtN(leaders[i].points)} ${copy.chart.valueName.toLowerCase()}`,
          })}
          legend={(k) => (['Gold', 'Silver', 'Bronze'] as const).map((m) => ({ label: med[m] ?? m, color: k.medal[m] }))}
          table={{ columns: [{ key: 'brewery', label: copy.chart.labelHeader, sortable: true }, { key: 'split', label: copy.columns.split }, { key: 'points', label: copy.columns.points, numeric: true, sortable: true }], rows: leaderRows, initialSort: { key: 'points', dir: 'descending' } }}
        />
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
  estimate: { marker: string; linkText: string; loading: string; failed: string; labels: Record<'barrels' | 'cases' | 'arr' | 'gross_margin' | 'ebitda' | 'ebitda_range', string> };
};

export function EconomicsView({ rows, info, copy, firstCompleteYear }: { rows: Row[]; info: Record<string, BreweryInfo>; copy: EconomicsCopy; firstCompleteYear: number | null }) {
  usePageScope({}, []);
  const shown = useFilteredRows(rows);
  const keys = new Set(shown.map((x) => x.brewery_key as string));
  const list = [...keys].map((k) => info[k]).filter(Boolean).sort((a, b) => (b.arr ?? 0) - (a.arr ?? 0));
  const dots = list.slice(0, CHART_BREWERIES);
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
  // Every estimated figure carries an (E) that loads how it was made when opened. Barrels and cases are estimates
  // unless the brewery reported its production.
  const mark = (b: BreweryInfo, metric: string, label: keyof EconomicsCopy['estimate']['labels'], figure: ReactNode, always = true) => (
    <span className="inline-flex items-center gap-1">
      {figure}
      {always || b.basis !== 'reported' ? <LazyEstimate slug={b.slug} metric={metric} id={`est-${b.slug}-${label}`} copy={{ marker: copy.estimate.marker, label: copy.estimate.labels[label], linkText: copy.estimate.linkText, loading: copy.estimate.loading, failed: copy.estimate.failed }} /> : null}
    </span>
  );
  const table: TableRow[] = list.map((b) => ({
    key: b.key,
    sort: { brewery: b.name, type: copy.types[b.brewery_type] ?? '', locations: b.locations_count, barrels: b.barrels, basis: copy.basis[b.basis] ?? b.basis, cases: b.cases, arr: b.arr, grossMargin: b.gross_margin, ebitda: b.ebitda, distribution: copy.channels[b.distribution_channel || 'unknown'] ?? '', ownership: copy.ownership[b.ownership_type || 'unlisted'] ?? '' },
    cells: {
      brewery: <TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>,
      type: copy.types[b.brewery_type] ?? '',
      locations: b.locations_count,
      barrels: mark(b, 'barrels', 'barrels', num(b.barrels), false),
      basis: copy.basis[b.basis] ?? b.basis,
      cases: mark(b, 'barrels', 'cases', num(b.cases), false),
      arr: mark(b, 'arr', 'arr', usd(b.arr)),
      grossMargin: mark(b, 'gross_margin', 'gross_margin', percent(b.gross_margin)),
      ebitda: mark(b, 'ebitda', 'ebitda', usd(b.ebitda)),
      ebitdaRange: mark(b, 'ebitda', 'ebitda_range', fill(copy.range, { min: percent(b.ebitda_margin_low), max: percent(b.ebitda_margin_high) })),
      distribution: copy.channels[b.distribution_channel || 'unknown'] ?? '',
      ownership: copy.ownership[b.ownership_type || 'unlisted'] ?? '',
    },
  }));
  return (
    <ViewFrame rows={shown} scopeCount={rows.length} copy={copy.view} firstCompleteYear={firstCompleteYear}>
      <Plot
        id="arr-by-brewery"
        title={copy.chart.title}
        subtitle={copy.chart.subtitle}
        chrome={copy.view.chrome}
        tableSummary={copy.chart.tableSummary}
        build={dotPlot({ items: dots.map((b) => ({ name: b.slug, label: b.name, value: b.arr ?? 0 })), format: (n) => `$${compact(n)}`, labelWidth: (w) => (w < 480 ? 112 : 220) })}
        table={{ columns: [{ key: 'brewery', label: copy.chart.labelHeader, sortable: true }, { key: 'arr', label: copy.columns.arr, numeric: true, sortable: true }], rows: dots.map((b) => ({ key: b.key, sort: { brewery: b.name, arr: b.arr ?? 0 }, cells: { brewery: <TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>, arr: usd(b.arr) } })), initialSort: { key: 'arr', dir: 'descending' } }}
      />
      <section className="flex flex-col gap-3" aria-labelledby="all-medalists">
        <SectionHeader id="all-medalists" title={copy.table.title} />
        <DataTable caption={copy.table.title} sortHint={copy.table.sortHint} columns={columns} rows={table} initialSort={{ key: 'arr', dir: 'descending' }} scroll={false} />
      </section>
    </ViewFrame>
  );
}
