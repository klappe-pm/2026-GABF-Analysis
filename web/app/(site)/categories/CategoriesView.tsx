'use client';

// The categories index as a view that follows the global filter: a chart of medals by style family, then every
// category with medals in view.
import { type Column, DataTable, type Row } from '@/components/DataTable';
import { SectionHeader } from '@/components/SectionHeader';
import { TextLink } from '@/components/TextLink';
import { useFilteredRows, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import { categoryRollup, countBy } from '@/lib/models/analysis-calc.mjs';
import type { CategoryRow } from '@/lib/models/analysis.mjs';
import { BarCard } from '@/app/(site)/analysis/parts/charts';
import { Count, fill, num, ViewFrame, type ViewCopy } from '@/app/(site)/analysis/parts/kit';

export type CategoriesCopy = {
  view: ViewCopy;
  chart: { title: string; subtitle: string; valueName: string; labelHeader: string; tableSummary: string };
  table: { title: string; count: string; caption: string; sortHint: string; columns: Record<'category' | 'type' | 'family' | 'abv' | 'latest' | 'medals' | 'years', string>; abvValue: string; sectionId: string };
  types: { classic: string; special: string };
  families: Record<string, string>;
};

export function CategoriesView({ rows, copy, firstCompleteYear }: { rows: CategoryRow[]; copy: CategoriesCopy; firstCompleteYear: number | null }) {
  usePageScope({}, []);
  const shown = useFilteredRows(rows);
  const list = categoryRollup(shown);
  const families = countBy(shown, 'style_family').map(([label, value]) => ({ label: copy.families[label] ?? label, value }));
  const columns: Column[] = [
    { key: 'category', label: copy.table.columns.category, sortable: true },
    { key: 'type', label: copy.table.columns.type, sortable: true },
    { key: 'family', label: copy.table.columns.family, sortable: true },
    { key: 'abv', label: copy.table.columns.abv, sortable: true },
    { key: 'latest', label: copy.table.columns.latest, numeric: true, sortable: true },
    { key: 'medals', label: copy.table.columns.medals, numeric: true, sortable: true },
    { key: 'years', label: copy.table.columns.years },
  ];
  const table: Row[] = list.map((c) => ({
    key: c.slug,
    sort: { category: c.name, type: c.special ? 1 : 0, family: copy.families[c.style_family] ?? c.style_family, abv: Number(c.abv_min) || null, latest: c.latest, medals: c.medals },
    cells: {
      category: <TextLink href={href(paths.category(c.slug))}>{c.name}</TextLink>,
      type: c.special ? copy.types.special : copy.types.classic,
      family: copy.families[c.style_family] ?? c.style_family,
      abv: c.abv_min && c.abv_max ? fill(copy.table.abvValue, { min: String(c.abv_min), max: String(c.abv_max) }) : '',
      latest: num(c.latest),
      medals: num(c.medals),
      years: c.years.join(', '),
    },
  }));
  return (
    <ViewFrame rows={shown} scopeCount={rows.length} copy={copy.view} firstCompleteYear={firstCompleteYear}>
      <BarCard id="medals-by-family" title={copy.chart.title} subtitle={copy.chart.subtitle} items={families} valueName={copy.chart.valueName} labelHeader={copy.chart.labelHeader} tableSummary={copy.chart.tableSummary} ariaLabel={copy.chart.title} roleIndex={2} labelWidth={170} />
      <section className="flex flex-col gap-3" aria-labelledby={copy.table.sectionId}>
        <SectionHeader id={copy.table.sectionId} title={copy.table.title} />
        <Count text={fill(copy.table.count, { count: list.length.toLocaleString('en-US') })} />
        <DataTable caption={copy.table.caption} sortHint={copy.table.sortHint} columns={columns} rows={table} initialSort={{ key: 'category', dir: 'ascending' }} scroll={false} />
      </section>
    </ViewFrame>
  );
}
