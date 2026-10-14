'use client';

// The ownership and trends reports' filtered parts. The ownership tables, the competition totals, and the
// scale table do not depend on the filter and are drawn by the page.
import { SectionHeader } from '@/components/SectionHeader';
import { Field, FieldGrid } from '@/components/StatCard';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { useFilteredRows, useGlobalFilter, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import { countBy, familySeries, movers, ownershipRollup, TREND_FAMILIES, yearsInView } from '@/lib/models/analysis-calc.mjs';
import type { Row } from '@/lib/models/analysis-calc.mjs';
import { BarCard, StackedCard } from '@/app/(site)/analysis/parts/charts';
import { Plot } from '@/app/(site)/analysis/parts/Plot';
import { esc, fmtN, stackedBars } from '@/app/(site)/dashboards/kit/charts';
import { fill, num, share, ViewFrame, type ViewCopy } from '@/app/(site)/analysis/parts/kit';

export type OwnershipCopy = {
  view: ViewCopy;
  stats: { independent: string; independentNote: string; listed: string; owned: string };
  byType: { title: string; valueName: string; labelHeader: string };
  parents: { title: string; subtitle: string; empty: string; labelHeader: string };
  tableSummary: string;
  types: Record<string, string>;
};

export function OwnershipView({ rows, ownershipKeys, copy, firstCompleteYear }: { rows: Row[]; ownershipKeys: string[]; copy: OwnershipCopy; firstCompleteYear: number | null }) {
  usePageScope({}, []);
  const shown = useFilteredRows(rows);
  const o = ownershipRollup(shown, ownershipKeys);
  const byType = countBy(shown, 'ownership_type').map(([v, value]) => ({ label: copy.types[v] ?? v, value }));
  const parents = countBy(shown.filter((x) => o.owned.has(x.brewery_key)).map((x) => ({ p: x.parent || copy.types[x.ownership_type] || x.ownership_type })), 'p').map(([label, value]) => ({ label, value }));
  return (
    <ViewFrame rows={shown} scopeCount={rows.length} copy={copy.view} firstCompleteYear={firstCompleteYear}>
      <FieldGrid>
        <Field label={copy.stats.independent} note={fill(copy.stats.independentNote, { count: num(o.independent), total: num(shown.length) })}>{share(o.independent, shown.length)}</Field>
        <Field label={copy.stats.listed}>{num(o.listed)}</Field>
        <Field label={copy.stats.owned}>{num(o.ownedBreweries)}</Field>
      </FieldGrid>
      <div className="grid gap-4 expanded:grid-cols-2">
        <Plot
          id="ownership-type"
          title={copy.byType.title}
          chrome={copy.view.chrome}
          tableSummary={copy.tableSummary}
          build={stackedBars({
            labels: [''],
            series: byType.map((t, i) => ({ name: t.label, data: [t.value], color: (k) => k.series[i % k.series.length] })),
            percent: true,
            labelWidth: () => 8,
            minLabel: 8,
            tip: () => byType.map((t) => `${esc(t.label)}: ${fmtN(t.value)}`).join('<br>'),
          })}
          legend={(k) => byType.map((t, i) => ({ label: t.label, color: k.series[i % k.series.length] }))}
          table={{ columns: [{ key: 'name', label: copy.byType.labelHeader }, { key: 'value', label: copy.byType.valueName, numeric: true }], rows: byType.map((t) => ({ key: t.label, cells: { name: t.label, value: fmtN(t.value) } })) }}
        />
        {parents.length ? (
          <BarCard id="parents" title={copy.parents.title} subtitle={copy.parents.subtitle} items={parents} valueName={copy.byType.valueName} labelHeader={copy.parents.labelHeader} tableSummary={copy.tableSummary} ariaLabel={copy.parents.title} roleIndex={1} labelWidth={230} />
        ) : <StateCard kind="notice" title={copy.parents.title}>{copy.parents.empty}</StateCard>}
      </div>
    </ViewFrame>
  );
}

export type TrendsCopy = {
  view: ViewCopy;
  families: { title: string; subtitle: string; other: string; nameColumn: string };
  movers: { title: string; gained: string; lost: string; empty: string };
  tableSummary: string;
  familyNames: Record<string, string>;
  coverage: Record<string, string>;
};

export function TrendsView({ rows, meta, copy, firstCompleteYear }: { rows: Row[]; meta: { years: number[]; coverage: Record<string, string> }; copy: TrendsCopy; firstCompleteYear: number | null }) {
  usePageScope({}, []);
  const { state } = useGlobalFilter();
  const shown = useFilteredRows(rows);
  const years = yearsInView(meta, state);
  const series = familySeries(shown, years, TREND_FAMILIES).map((s) => ({ name: s.family === null ? copy.families.other : copy.familyNames[s.family] ?? s.family, values: s.data }));
  const m = movers(shown, years, meta.coverage);
  const list = (items: { name: string; slug: string; d: number }[]) => (
    <ol className="list-decimal pl-6">
      {items.map((x) => <li key={x.slug}><TextLink href={href(paths.brewery(x.slug))}>{x.name}</TextLink> {x.d > 0 ? `+${x.d}` : x.d}</li>)}
    </ol>
  );
  return (
    <ViewFrame rows={shown} scopeCount={rows.length} copy={copy.view} firstCompleteYear={firstCompleteYear}>
      <StackedCard
        id="family-share"
        title={copy.families.title}
        subtitle={copy.families.subtitle}
        labels={years}
        notes={years.map((y) => (meta.coverage[y] === 'complete' ? '' : copy.coverage[meta.coverage[y]] ?? ''))}
        series={series}
        nameColumn={copy.families.nameColumn}
        tableSummary={copy.tableSummary}
        ariaLabel={copy.families.title}
      />
      {m ? (
        <section className="flex flex-col gap-3" aria-labelledby="movers">
          <SectionHeader id="movers" title={fill(copy.movers.title, { previous_year: m.previous, year: m.year })} />
          <div className="grid gap-4 expanded:grid-cols-2">
            <StateCard kind="notice" title={copy.movers.gained}>{list(m.gained)}</StateCard>
            <StateCard kind="notice" title={copy.movers.lost}>{list(m.lost)}</StateCard>
          </div>
        </section>
      ) : <StateCard kind="notice" title={copy.movers.empty} />}
    </ViewFrame>
  );
}
