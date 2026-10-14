'use client';

// The two reports about places that follow the global filter: medals by state, and medals by Census region
// and division. Rates use each medal's own year of Census population and real GDP.
import { type Column, DataTable, type Row as TableRow } from '@/components/DataTable';
import { SectionHeader } from '@/components/SectionHeader';
import { useFilteredRows, usePageScope } from '@/lib/global-filter';
import { groupRollup, STATE_BARS, stateRollup } from '@/lib/models/analysis-calc.mjs';
import type { Row } from '@/lib/models/analysis-calc.mjs';
import type { StateIndicators } from '@/lib/models/analysis.mjs';
import { BarCard, MapCard } from '@/app/(site)/analysis/parts/charts';
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

export function ByStateView({ rows, states, indicators, latest, copy, firstCompleteYear }: { rows: Row[]; states: StateMeta[]; indicators: StateIndicators; latest: number; copy: ByStateCopy; firstCompleteYear: number | null }) {
  usePageScope({}, []);
  const shown = useFilteredRows(rows);
  const list = stateRollup(shown, states, indicators, latest);
  const mapData = states.map((s) => ({ name: s.name, value: list.find((x) => x.state === s.state)?.medals ?? 0 }));
  const perCapita = [...list].sort((a, b) => b.per_million - a.per_million).slice(0, STATE_BARS).map((s) => ({ label: s.name, value: Number(s.per_million.toFixed(2)) }));
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
      <MapCard id="state-map" title={copy.map.title} subtitle={copy.map.subtitle} data={mapData} valueName={copy.map.valueName} nameColumn={copy.map.nameColumn} tooltip={(d) => fill(copy.map.tooltip, { state: d.name, count: d.value })} tableSummary={copy.tableSummary} ariaLabel={copy.map.title} />
      <div className="grid gap-4 expanded:grid-cols-2">
        <BarCard id="state-medals" title={copy.bars.title} subtitle={copy.bars.subtitle} items={list.slice(0, STATE_BARS).map((s) => ({ label: s.name, value: s.medals }))} valueName={copy.bars.valueName} labelHeader={copy.bars.labelHeader} tableSummary={copy.tableSummary} ariaLabel={copy.bars.title} />
        <BarCard id="state-per-capita" title={copy.perCapita.title} subtitle={copy.perCapita.subtitle} items={perCapita} valueName={copy.perCapita.valueName} labelHeader={copy.bars.labelHeader} tableSummary={copy.tableSummary} ariaLabel={copy.perCapita.title} roleIndex={2} />
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
      <div className="grid gap-4 expanded:grid-cols-2">
        <BarCard id="region-medals" title={copy.regions.title} items={regions.map((x) => ({ label: copy.regionNames[x.name] ?? x.name, value: x.medals }))} valueName={copy.valueName} labelHeader={copy.columns.name} tableSummary={copy.tableSummary} ariaLabel={copy.regions.title} detail={{ columns, rows: detail(regions, copy.regionNames) }} />
        <BarCard id="division-medals" title={copy.divisions.title} items={divisions.map((x) => ({ label: copy.divisionNames[x.name] ?? x.name, value: x.medals }))} valueName={copy.valueName} labelHeader={copy.columns.name} tableSummary={copy.tableSummary} ariaLabel={copy.divisions.title} roleIndex={2} detail={{ columns, rows: detail(divisions, copy.divisionNames) }} />
      </div>
    </ViewFrame>
  );
}
