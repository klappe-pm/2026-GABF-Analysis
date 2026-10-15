'use client';

// The two reports about places that follow the global filter: medals by state, and medals by Census region
// and division. Rates use each medal's own year of Census population and real GDP.
import { type Column, DataTable, type Row as TableRow } from '@/components/DataTable';
import { SectionHeader } from '@/components/SectionHeader';
import type { Kit } from '@/design/chart-kit';
import { useFilteredRows, usePageScope } from '@/lib/global-filter';
import { groupRollup, STATE_BARS, stateRollup } from '@/lib/models/analysis-calc.mjs';
import type { Row } from '@/lib/models/analysis-calc.mjs';
import type { StateIndicators } from '@/lib/models/analysis.mjs';
import { Plot, binLegend } from '@/app/(site)/analysis/parts/Plot';
import { esc, fmtN, labelColumn, rankedBars, tileGrid } from '@/app/(site)/dashboards/kit/charts';
import { bins, rateEdges } from '@/design/chart-kit';
import { fill, num, ViewFrame, type ViewCopy } from '@/app/(site)/analysis/parts/kit';

type StateMeta = { state: string; name: string; region: string; division: string };
const split = (s: number[]) => `${s[0]} / ${s[1]} / ${s[2]}`;
const rate = (n: number) => n.toFixed(2);

export type ByStateCopy = {
  view: ViewCopy;
  map: { title: string; subtitle: string; tooltip: string; valueName: string; nameColumn: string };
  bars: { title: string; subtitle: string; labelHeader: string; valueName: string };
  perCapita: { title: string; subtitle: string; valueName: string };
  table: { title: string; sortHint: string };
  columns: Record<'state' | 'region' | 'division' | 'medals' | 'split' | 'latest' | 'breweries' | 'population' | 'perMillion' | 'per100b', string>;
  tableSummary: string;
  regions: Record<string, string>;
  divisions: Record<string, string>;
};

export function ByStateView({ rows, states, indicators, latest, tiles, copy, firstCompleteYear }: { rows: Row[]; states: StateMeta[]; indicators: StateIndicators; latest: number; tiles: Record<string, [number, number]>; copy: ByStateCopy; firstCompleteYear: number | null }) {
  usePageScope({}, []);
  const shown = useFilteredRows(rows);
  const list = stateRollup(shown, states, indicators, latest);
  const byCode = new Map(list.map((s) => [s.state, s]));
  const nameOf = new Map(states.map((s) => [s.state, s.name]));
  const medalBins = (k: Kit) => bins(k, [0, 1, 10, 25, 50, 100, 250]);
  const rateSet = (k: Kit) => bins(k, rateEdges(list.map((s) => s.per_million)));
  const top = list.slice(0, STATE_BARS);
  const regionsShown = [...new Set(top.map((s) => s.region))];
  const stateColumns = (valueLabel: string, numericFormat: (s: (typeof list)[number]) => string): { columns: Column[]; rows: TableRow[] } => ({
    columns: [{ key: 'name', label: copy.bars.labelHeader, sortable: true }, { key: 'region', label: copy.columns.region, sortable: true }, { key: 'value', label: valueLabel, numeric: true, sortable: true }],
    rows: list.map((s) => ({ key: s.state, sort: { name: s.name, region: copy.regions[s.region] ?? s.region, value: s.medals }, cells: { name: s.name, region: copy.regions[s.region] ?? s.region, value: numericFormat(s) } })),
  });
  const columns: Column[] = [
    { key: 'state', label: copy.columns.state, sortable: true },
    { key: 'region', label: copy.columns.region, sortable: true },
    { key: 'division', label: copy.columns.division, sortable: true },
    { key: 'medals', label: copy.columns.medals, numeric: true, sortable: true },
    { key: 'split', label: copy.columns.split },
    { key: 'latest', label: copy.columns.latest, numeric: true, sortable: true },
    { key: 'breweries', label: copy.columns.breweries, numeric: true, sortable: true },
    { key: 'population', label: copy.columns.population, numeric: true, sortable: true },
    { key: 'perMillion', label: copy.columns.perMillion, numeric: true, sortable: true },
    { key: 'per100b', label: copy.columns.per100b, numeric: true, sortable: true },
  ];
  const table: TableRow[] = list.map((s) => ({
    key: s.state,
    sort: { state: s.name, region: copy.regions[s.region] ?? s.region, division: copy.divisions[s.division] ?? s.division, medals: s.medals, latest: s.latest, breweries: s.breweries, population: s.pop_latest, perMillion: s.per_million, per100b: s.per_100b },
    cells: { state: s.name, region: copy.regions[s.region] ?? s.region, division: copy.divisions[s.division] ?? s.division, medals: num(s.medals), split: split(s.split), latest: num(s.latest), breweries: num(s.breweries), population: num(s.pop_latest), perMillion: rate(s.per_million), per100b: rate(s.per_100b) },
  }));
  return (
    <ViewFrame rows={shown} scopeCount={rows.length} copy={copy.view} firstCompleteYear={firstCompleteYear}>
      <Plot
        id="state-map"
        title={copy.map.title}
        subtitle={copy.map.subtitle}
        chrome={copy.view.chrome}
        tableSummary={copy.tableSummary}
        build={tileGrid({
          tiles,
          value: (c) => byCode.get(c)?.medals ?? 0,
          bins: medalBins,
          tip: (c) => `<b>${esc(nameOf.get(c) ?? c)}</b><br>${esc(fill(copy.map.tooltip, { state: '', count: byCode.get(c)?.medals ?? 0 }).replace(/^: /, ''))}`,
        })}
        legend={(k) => binLegend(copy.view.chrome, medalBins(k))}
        table={{ ...stateColumns(copy.map.valueName, (s) => num(s.medals)), initialSort: { key: 'value', dir: 'descending' } }}
      />
      <div className="grid gap-4">
        <Plot
          id="state-medals"
          title={copy.bars.title}
          subtitle={copy.bars.subtitle}
          chrome={copy.view.chrome}
          tableSummary={copy.tableSummary}
          build={rankedBars({ items: top.map((s) => ({ name: s.state, label: s.name, value: s.medals, color: (k) => k.region[s.region] ?? k.series[4] })) })}
          legend={(k) => regionsShown.map((r) => ({ label: copy.regions[r] ?? r, color: k.region[r] ?? k.series[4] }))}
          table={{ ...stateColumns(copy.bars.valueName, (s) => num(s.medals)), initialSort: { key: 'value', dir: 'descending' } }}
        />
        <Plot
          id="state-per-capita"
          title={copy.perCapita.title}
          subtitle={copy.perCapita.subtitle}
          chrome={copy.view.chrome}
          tableSummary={copy.tableSummary}
          build={tileGrid({
            tiles,
            value: (c) => byCode.get(c)?.per_million ?? 0,
            format: (n) => (n >= 100 ? String(Math.round(n)) : n >= 10 ? n.toFixed(1) : n.toFixed(2)),
            bins: rateSet,
            tip: (c) => `<b>${esc(nameOf.get(c) ?? c)}</b><br>${rate(byCode.get(c)?.per_million ?? 0)} ${esc(copy.perCapita.valueName.toLowerCase())}`,
          })}
          legend={(k) => binLegend(copy.view.chrome, rateSet(k), (n) => String(n))}
          table={{ ...stateColumns(copy.perCapita.valueName, (s) => rate(s.per_million)), initialSort: { key: 'value', dir: 'descending' } }}
        />
      </div>
      <section className="flex flex-col gap-3" aria-labelledby="all-states">
        <SectionHeader id="all-states" title={copy.table.title} />
        <DataTable caption={copy.table.title} sortHint={copy.table.sortHint} columns={columns} rows={table} initialSort={{ key: 'medals', dir: 'descending' }} scroll={false} />
      </section>
    </ViewFrame>
  );
}

export type ByRegionCopy = {
  view: ViewCopy;
  regions: { title: string };
  divisions: { title: string };
  unknown: string;
  valueName: string;
  columns: Record<'name' | 'medals' | 'split' | 'breweries' | 'states' | 'perMillion', string>;
  tableSummary: string;
  regionNames: Record<string, string>;
  divisionNames: Record<string, string>;
};

export function ByRegionView({ rows, states, indicators, copy, firstCompleteYear }: { rows: Row[]; states: StateMeta[]; indicators: StateIndicators; copy: ByRegionCopy; firstCompleteYear: number | null }) {
  usePageScope({}, []);
  const shown = useFilteredRows(rows);
  const regions = groupRollup(shown, 'region', states, indicators, copy.unknown);
  const divisions = groupRollup(shown, 'division', states, indicators, copy.unknown);
  const columns: Column[] = [
    { key: 'name', label: copy.columns.name },
    { key: 'medals', label: copy.columns.medals, numeric: true },
    { key: 'split', label: copy.columns.split },
    { key: 'breweries', label: copy.columns.breweries, numeric: true },
    { key: 'states', label: copy.columns.states, numeric: true },
    { key: 'perMillion', label: copy.columns.perMillion, numeric: true },
  ];
  const detail = (list: typeof regions, names: Record<string, string>) => list.map((x): TableRow => ({
    key: x.name,
    cells: { name: names[x.name] ?? x.name, medals: num(x.medals), split: split(x.split), breweries: num(x.breweries), states: num(x.states), perMillion: rate(x.per_million) },
  }));
  return (
    <ViewFrame rows={shown} scopeCount={rows.length} copy={copy.view} firstCompleteYear={firstCompleteYear}>
      <div className="grid gap-4">
        <Plot
          id="region-medals"
          title={copy.regions.title}
          chrome={copy.view.chrome}
          tableSummary={copy.tableSummary}
          build={rankedBars({ items: regions.map((x) => ({ name: x.name, label: copy.regionNames[x.name] ?? x.name, value: x.medals, color: (k) => k.region[x.name] ?? k.series[4] })), labelWidth: labelColumn(100, 140) })}
          table={{ columns: [{ key: 'name', label: copy.columns.name }, { key: 'value', label: copy.valueName, numeric: true }], rows: regions.map((x) => ({ key: x.name, cells: { name: copy.regionNames[x.name] ?? x.name, value: fmtN(x.medals) } })) }}
        />
        <Plot
          id="division-medals"
          title={copy.divisions.title}
          chrome={copy.view.chrome}
          tableSummary={copy.tableSummary}
          build={rankedBars({ items: divisions.map((x, i) => ({ name: x.name, label: copy.divisionNames[x.name] ?? x.name, value: x.medals, color: (k) => k.series[i % 4] })), labelWidth: labelColumn(120, 190) })}
          table={{ columns: [{ key: 'name', label: copy.columns.name }, { key: 'value', label: copy.valueName, numeric: true }], rows: divisions.map((x) => ({ key: x.name, cells: { name: copy.divisionNames[x.name] ?? x.name, value: fmtN(x.medals) } })) }}
        />
      </div>
    </ViewFrame>
  );
}
