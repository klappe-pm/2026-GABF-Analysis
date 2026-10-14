'use client';

// One category as a view that follows the global filter: the entrants chart, then the medalists of each year.
import { ChartCard } from '@/components/ChartCard';
import { type Column, DataTable, type Row } from '@/components/DataTable';
import { MedalMark } from '@/components/MedalMark';
import { SectionHeader } from '@/components/SectionHeader';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { useFilteredRows, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import { categoryYears, newestFirst } from '@/lib/models/analysis-calc.mjs';
import type { CategoryMedalRow } from '@/lib/models/analysis.mjs';
import { Cell, fill, num, ViewFrame, type ViewCopy } from '@/app/(site)/analysis/parts/kit';

export type CategoryCopy = {
  view: ViewCopy;
  fixedCategory: string;
  entrants: { title: string; subtitle: string; series: string; oneYear: string; none: string; tableSummary: string; sectionId: string };
  medalists: { title: string; sectionId: string; yearHeading: string; yearNumber: string; yearEntrants: string; sortHint: string };
  columns: Record<'medal' | 'beer' | 'abv' | 'ibu' | 'hops' | 'brewery' | 'city', string>;
};

const MEDAL_RANK: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };
const abv = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, '')}%`;

export function CategoryView({ name, rows, copy, firstCompleteYear }: { name: string; rows: CategoryMedalRow[]; copy: CategoryCopy; firstCompleteYear: number | null }) {
  usePageScope({ category_name: name }, [copy.fixedCategory]);
  const shown = useFilteredRows(rows);
  const list = categoryYears(shown);
  const withEntries = list.filter((y) => y.entries);
  const none = Cell.none(copy.view.notDefined);

  const entrants = withEntries.length > 1 ? (
    <ChartCard
      id="entries-by-year"
      title={copy.entrants.title}
      note={copy.entrants.subtitle}
      categories={withEntries.map((y) => y.year)}
      series={[{ name: copy.entrants.series, values: withEntries.map((y) => y.entries as number) }]}
      tableSummary={copy.entrants.tableSummary}
      nameColumn={copy.entrants.series}
      ariaLabel={copy.entrants.title}
    />
  ) : (
    <StateCard kind="notice" title={copy.entrants.title}>
      {withEntries.length === 1 ? fill(copy.entrants.oneYear, { count: num(withEntries[0].entries), year: withEntries[0].year }) : copy.entrants.none}
    </StateCard>
  );

  const columns: Column[] = [
    { key: 'medal', label: copy.columns.medal, sortable: true },
    { key: 'beer', label: copy.columns.beer, sortable: true },
    { key: 'abv', label: copy.columns.abv, numeric: true, sortable: true },
    { key: 'ibu', label: copy.columns.ibu, numeric: true, sortable: true },
    { key: 'hops', label: copy.columns.hops },
    { key: 'brewery', label: copy.columns.brewery, sortable: true },
    { key: 'city', label: copy.columns.city, sortable: true },
  ];
  const tableFor = (medals: CategoryMedalRow[]): Row[] => [...medals].sort(newestFirst).map((r, i) => ({
    key: `${r.medal}-${r.brewery_key}-${r.beer_name}-${i}`,
    sort: { medal: MEDAL_RANK[r.medal] ?? 9, beer: r.beer_name, abv: r.abv, ibu: r.ibu, brewery: r.brewery_name, city: `${r.city}, ${r.state}` },
    cells: {
      medal: (
        <span className="inline-flex items-center gap-2">
          <MedalMark medal={r.medal} size="sm" title={copy.view.medals[r.medal] ?? r.medal} />
          {copy.view.medals[r.medal] ?? r.medal}
        </span>
      ),
      beer: r.stem ? Cell.link(href(paths.beer(r.year, r.stem)), r.beer_name) : r.beer_name,
      abv: r.abv === null ? none : abv(r.abv),
      ibu: r.ibu === null ? none : String(r.ibu),
      hops: r.hops.length ? r.hops.map((h, j) => <span key={h.slug}>{j ? ', ' : ''}{Cell.link(href(paths.hop(h.slug)), h.name)}</span>) : none,
      brewery: (
        <>
          {Cell.link(href(paths.brewery(r.brewery_slug)), r.brewery_name)}
          {r.brewery_location ? <span className="text-on-surface-variant"> ({r.brewery_location})</span> : null}
        </>
      ),
      city: `${r.city}, ${r.state}`,
    },
  }));

  const heading = (y: { year: number; number: string; entries: number | null }) =>
    y.number && y.entries ? fill(copy.medalists.yearEntrants, { year: y.year, number: y.number, count: num(y.entries) })
      : y.number ? fill(copy.medalists.yearNumber, { year: y.year, number: y.number })
        : fill(copy.medalists.yearHeading, { year: y.year });

  return (
    <ViewFrame rows={shown} scopeCount={rows.length} copy={copy.view} firstCompleteYear={firstCompleteYear}>
      {entrants}
      <section className="flex flex-col gap-4" aria-labelledby={copy.medalists.sectionId}>
        <SectionHeader id={copy.medalists.sectionId} title={copy.medalists.title} />
        {[...list].reverse().map((y) => (
          <div key={y.year} className="flex flex-col gap-2">
            <SectionHeader id={`year-${y.year}`} title={heading(y)} level={3} />
            <DataTable caption={heading(y)} sortHint={copy.medalists.sortHint} columns={columns} rows={tableFor(y.medals)} scroll={false} />
          </div>
        ))}
      </section>
    </ViewFrame>
  );
}
