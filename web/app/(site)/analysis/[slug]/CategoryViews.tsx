'use client';

// The top categories report as a view that follows the global filter: the most entered categories, the
// categories that win the most medals by style family, the odds of a medal, and every category in view.
import { type Column, DataTable, type Row as TableRow } from '@/components/DataTable';
import { SectionHeader } from '@/components/SectionHeader';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { useFilteredRows, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import { countBy, mostEntered, MOST_ENTERED_BARS, oddsItems, ODDS_BARS } from '@/lib/models/analysis-calc.mjs';
import type { Row } from '@/lib/models/analysis-calc.mjs';
import { Plot } from '@/app/(site)/analysis/parts/Plot';
import { esc, fmtN, lollipop, treemap } from '@/app/(site)/dashboards/kit/charts';
import { fill, num, ViewFrame, type ViewCopy } from '@/app/(site)/analysis/parts/kit';

export type TopCategoriesCopy = {
  view: ViewCopy;
  mostEntered: { title: string; subtitle: string; empty: string; special: string; valueName: string; labelHeader: string };
  families: { title: string; valueName: string; labelHeader: string };
  odds: { title: string; subtitle: string; note: string; missingOne: string; missingMany: string; valueName: string; columns: Record<'category' | 'entriesPerMedal' | 'entries' | 'medalsAwarded' | 'years', string> };
  table: { title: string; sortHint: string; abvValue: string; columns: Record<'category' | 'type' | 'family' | 'latest' | 'year' | 'medals' | 'abv', string> };
  tableSummary: string;
  types: { classic: string; special: string };
  familyNames: Record<string, string>;
};

export function TopCategoriesView({ rows, copy, firstCompleteYear }: { rows: Row[]; copy: TopCategoriesCopy; firstCompleteYear: number | null }) {
  usePageScope({}, []);
  const shown = useFilteredRows(rows);
  const { list: entered, medalsBy } = mostEntered(shown);
  const bars = entered.slice(0, MOST_ENTERED_BARS).map((c) => ({ name: c.slug, label: c.special ? `${c.name} ${copy.mostEntered.special}` : c.name, value: c.entries, slug: c.slug }));
  const families = countBy(shown, 'style_family').map(([name, value]) => ({ name, label: copy.familyNames[name] ?? name, value }));
  const odds = oddsItems(shown);
  const oddsBars = odds.list.slice(0, ODDS_BARS).map((o) => ({ name: o.slug, label: o.label, value: o.value, slug: o.slug, tip: `<b>${esc(o.label)}</b><br>${o.value.toFixed(1)} ${esc(copy.odds.valueName.toLowerCase())}` }));
  const barRows = (items: { name: string; label: string; value: number; slug?: string }[], format: (n: number) => string): TableRow[] => items.map((i) => ({
    key: i.name,
    sort: { name: i.label, value: i.value },
    cells: { name: i.slug ? <TextLink href={href(paths.category(i.slug))}>{i.label}</TextLink> : i.label, value: format(i.value) },
  }));
  const barColumns = (nameLabel: string, valueLabel: string): Column[] => [{ key: 'name', label: nameLabel, sortable: true }, { key: 'value', label: valueLabel, numeric: true, sortable: true }];
  const oddsNote = `${copy.odds.note}${odds.missing ? ` ${odds.missing === 1 ? copy.odds.missingOne : fill(copy.odds.missingMany, { count: odds.missing })}` : ''}`;
  const oddsColumns: Column[] = [
    { key: 'category', label: copy.odds.columns.category, sortable: true },
    { key: 'perMedal', label: copy.odds.columns.entriesPerMedal, numeric: true, sortable: true },
    { key: 'entries', label: copy.odds.columns.entries, numeric: true, sortable: true },
    { key: 'medals', label: copy.odds.columns.medalsAwarded, numeric: true, sortable: true },
    { key: 'years', label: copy.odds.columns.years },
  ];
  const oddsRows: TableRow[] = odds.list.map((o) => ({
    key: o.slug,
    sort: { category: o.label, perMedal: o.value, entries: o.entries, medals: o.medals },
    cells: { category: <TextLink href={href(paths.category(o.slug))}>{o.label}</TextLink>, perMedal: o.value.toFixed(1), entries: num(o.entries), medals: num(o.medals), years: o.years },
  }));
  const columns: Column[] = [
    { key: 'category', label: copy.table.columns.category, sortable: true },
    { key: 'type', label: copy.table.columns.type, sortable: true },
    { key: 'family', label: copy.table.columns.family, sortable: true },
    { key: 'latest', label: copy.table.columns.latest, numeric: true, sortable: true },
    { key: 'year', label: copy.table.columns.year, numeric: true, sortable: true },
    { key: 'medals', label: copy.table.columns.medals, numeric: true, sortable: true },
    { key: 'abv', label: copy.table.columns.abv, sortable: true },
  ];
  const table: TableRow[] = entered.map((c) => ({
    key: c.slug,
    sort: { category: c.name, type: c.special ? 1 : 0, family: copy.familyNames[c.style_family] ?? c.style_family, latest: c.entries, year: c.year, medals: medalsBy.get(c.name) ?? 0, abv: Number(c.abv_min) || null },
    cells: {
      category: <TextLink href={href(paths.category(c.slug))}>{c.name}</TextLink>,
      type: c.special ? copy.types.special : copy.types.classic,
      family: copy.familyNames[c.style_family] ?? c.style_family,
      latest: num(c.entries),
      year: c.year,
      medals: num(medalsBy.get(c.name) ?? 0),
      abv: c.abv_min && c.abv_max ? fill(copy.table.abvValue, { min: String(c.abv_min), max: String(c.abv_max) }) : '',
    },
  }));
  return (
    <ViewFrame rows={shown} scopeCount={rows.length} copy={copy.view} firstCompleteYear={firstCompleteYear}>
      <div className="grid gap-4">
        {entered.length ? (
          <Plot
            id="most-entered"
            title={copy.mostEntered.title}
            subtitle={copy.mostEntered.subtitle}
            chrome={copy.view.chrome}
            tableSummary={copy.tableSummary}
            build={lollipop({ items: bars, format: fmtN })}
            table={{ columns: barColumns(copy.mostEntered.labelHeader, copy.mostEntered.valueName), rows: barRows(bars, fmtN), initialSort: { key: 'value', dir: 'descending' } }}
          />
        ) : <StateCard kind="notice" title={copy.mostEntered.title}>{copy.mostEntered.empty}</StateCard>}
        <Plot
          id="family-medals"
          title={copy.families.title}
          chrome={copy.view.chrome}
          tableSummary={copy.tableSummary}
          build={treemap({
            items: families.map((f, i) => ({ name: f.name, value: f.value, color: (k) => k.series[i % 4], detail: '' })),
            label: (i) => `${copy.familyNames[i.name] ?? i.name}\n${fmtN(i.value)}`,
            tip: (i) => `<b>${esc(copy.familyNames[i.name] ?? i.name)}</b><br>${fmtN(i.value)} ${esc(copy.families.valueName.toLowerCase())}`,
          })}
          table={{ columns: barColumns(copy.families.labelHeader, copy.families.valueName), rows: barRows(families, fmtN), initialSort: { key: 'value', dir: 'descending' } }}
        />
      </div>
      {oddsBars.length ? (
        <Plot
          id="entry-odds"
          title={copy.odds.title}
          subtitle={copy.odds.subtitle}
          note={oddsNote}
          chrome={copy.view.chrome}
          tableSummary={copy.tableSummary}
          build={lollipop({ items: oddsBars, format: (n) => n.toFixed(1) })}
          table={{ columns: oddsColumns, rows: oddsRows, initialSort: { key: 'perMedal', dir: 'descending' } }}
        />
      ) : null}
      <section className="flex flex-col gap-3" aria-labelledby="all-categories">
        <SectionHeader id="all-categories" title={copy.table.title} />
        <DataTable caption={copy.table.title} sortHint={copy.table.sortHint} columns={columns} rows={table} initialSort={{ key: 'latest', dir: 'descending' }} scroll={false} />
      </section>
    </ViewFrame>
  );
}
