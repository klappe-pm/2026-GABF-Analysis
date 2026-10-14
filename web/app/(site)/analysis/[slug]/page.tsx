// The eight analysis reports at /analysis/<report>/ (the old /reports/<report>/ addresses redirect here). One route serves
// them all: the page reads the copy and build time data of its report, draws the parts that do not depend on
// the filter, and hands the rest to a client view that follows the global filter.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { ChartCard } from '@/components/ChartCard';
import { type Column, DataTable, type Row } from '@/components/DataTable';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusChip } from '@/components/StatusChip';
import { TextLink } from '@/components/TextLink';
import { fill, lookup, t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import type { ReportSlug } from '@/lib/models/analysis.mjs';
import { analysis, firstComplete, labelGroup, MAIN, raw, viewCopy } from '@/app/(site)/analysis/parts/copy';
import { analysisPaths } from '@/app/(site)/analysis/parts/paths';
import { num } from '@/app/(site)/analysis/parts/format';
import { EconomicsView, TopBreweriesView } from './BreweryViews';
import { TopCategoriesView } from './CategoryViews';
import { OwnershipView, TrendsView } from './OwnershipTrendsViews';
import { ByRegionView, ByStateView } from './PlaceViews';

type Params = { slug: string };

export const dynamicParams = false;
export async function generateStaticParams(): Promise<Params[]> {
  return (await analysis()).reportParams();
}

async function keyOf(params: Promise<Params>) {
  const slug = (await params).slug;
  const key = (await analysis()).reportKey(slug);
  if (!key) notFound();
  return { slug: slug as ReportSlug, key };
}

const index = (key: string) => `pages.analysis-index.reports.${key}`;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, key } = await keyOf(params);
  return pageMetadata({
    title: fill(raw('global.navigation.page_titles.analysis_report'), { report_title: t(index(`${key}.title`)) }),
    description: t(index(`${key}.description`)),
    path: analysisPaths.report(slug),
  });
}

const split = (g: number, s: number, b: number) => `${g} / ${s} / ${b}`;
const statusText = (v: string | null) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '');

export default async function ReportPage({ params }: { params: Promise<Params> }) {
  const { slug, key } = await keyOf(params);
  const model = await analysis();
  const R = (k: string) => `pages.analysis-report.${key}.${k}`;
  const tableSummary = t('global.charts.table_view.summary');
  const sortHint = t('global.tables.sorting.hint');
  const view = viewCopy();
  const first = await firstComplete();
  const meta = model.reportMeta();
  const medalsUnit = t('global.charts.units.medals');
  const col = (group: string, k: string) => t(`global.tables.${group}.${k}`);
  const regionNames = labelGroup('region');
  const divisionNames = labelGroup('division');
  const ownershipNames = labelGroup('ownership_type');
  const familyNames = labelGroup('style_family');
  const coverage = labelGroup('coverage');
  const coverageMeaning = labelGroup('coverage_meaning');
  const states = meta.states;

  let body;
  if (slug === 'top-breweries') {
    body = (
      <TopBreweriesView
        rows={model.reportRows(['brewery_slug', 'points'])}
        info={model.info()}
        streaks={model.streaks()}
        meta={{ years: meta.years, coverage: meta.coverage, latestComplete: meta.latestComplete }}
        firstCompleteYear={first}
        copy={{
          view,
          chart: { title: t(R('chart_title')), subtitle: t(R('chart_subtitle')), valueName: t('global.charts.units.points'), labelHeader: col('brewery_columns', 'brewery'), tableSummary },
          streaks: { title: t(R('streaks_title')), note: raw(R('streaks_note')), item: raw(R('streak_item')), empty: t(R('streaks_empty')), firstTime: fill(raw(R('first_time_line')), { year: meta.latestComplete }), firstTimeLink: t(R('first_time_link')) },
          table: { title: t(R('table_title')), caption: t(R('table_title')), sortHint, year: raw(R('year_heading')) },
          columns: { rank: col('brewery_columns', 'rank'), brewery: col('brewery_columns', 'brewery'), hq: col('brewery_columns', 'hq'), points: col('brewery_columns', 'points'), medals: col('brewery_columns', 'medals'), split: col('brewery_columns', 'medal_split'), first: col('brewery_columns', 'first_in_view'), ownership: col('brewery_columns', 'ownership') },
          yearColumns: { brewery: col('brewery_columns', 'brewery'), points: col('brewery_columns', 'points'), medals: col('brewery_columns', 'medals'), split: col('brewery_columns', 'medal_split') },
          ownership: ownershipNames,
          coverage,
          coverageMeaning,
        }}
      />
    );
  } else if (slug === 'top-categories') {
    const types = labelGroup('category_type');
    body = (
      <TopCategoriesView
        rows={model.reportRows(['category_slug', 'category_number', 'entries', 'category_medals', 'special', 'abv_min', 'abv_max'])}
        firstCompleteYear={first}
        copy={{
          view,
          mostEntered: { title: t(R('most_entered_title')), subtitle: t(R('most_entered_subtitle')), empty: t(R('most_entered_empty')), special: t(R('special_suffix')), valueName: t('global.charts.units.entrants'), labelHeader: col('category_columns', 'category') },
          families: { title: t(R('families_title')), valueName: medalsUnit, labelHeader: col('category_columns', 'style_family') },
          odds: {
            title: t(R('odds_title')), subtitle: t(R('odds_subtitle')), note: t(R('odds_note')), missingOne: t(R('odds_missing_one')), missingMany: raw(R('odds_missing_many')), valueName: t('global.charts.units.entries_per_medal'),
            columns: { category: t(R('odds_columns.category')), entriesPerMedal: t(R('odds_columns.entries_per_medal')), entries: t(R('odds_columns.entries')), medalsAwarded: t(R('odds_columns.medals_awarded')), years: t(R('odds_columns.years')) },
          },
          table: { title: t(R('table_title')), sortHint, abvValue: raw('global.tables.category_columns.abv_value'), columns: { category: col('category_columns', 'category'), type: col('category_columns', 'type'), family: col('category_columns', 'style_family'), latest: col('category_columns', 'latest_entrants'), year: col('category_columns', 'year'), medals: col('category_columns', 'medals_in_view'), abv: col('category_columns', 'abv') } },
          tableSummary,
          types: { classic: types.classic, special: types.special },
          familyNames,
        }}
      />
    );
  } else if (slug === 'by-state') {
    body = (
      <ByStateView
        rows={model.reportRows([])}
        states={states}
        indicators={meta.indicators}
        latest={meta.latestComplete}
        firstCompleteYear={first}
        copy={{
          view,
          map: { title: t(R('map_title')), subtitle: t(R('map_subtitle')), tooltip: raw(R('map_tooltip')), valueName: medalsUnit, nameColumn: col('place_columns', 'state') },
          bars: { title: t(R('bars_title')), subtitle: t(R('bars_subtitle')), labelHeader: col('place_columns', 'state'), valueName: medalsUnit },
          perCapita: { title: t(R('per_capita_title')), subtitle: t(R('per_capita_subtitle')), valueName: t('global.charts.units.per_million') },
          table: { title: t(R('table_title')), sortHint },
          columns: {
            state: col('place_columns', 'state'), region: col('place_columns', 'region'), division: col('place_columns', 'division'), medals: col('place_columns', 'medals'), split: col('brewery_columns', 'medal_split'), latest: fill(raw('global.tables.place_columns.latest_year'), { year: meta.latestComplete }),
            breweries: col('place_columns', 'breweries'), population: fill(raw('global.tables.place_columns.population'), { year: meta.latestComplete }), perMillion: col('place_columns', 'per_million'), per100b: col('place_columns', 'per_100b_gdp'),
          },
          tableSummary,
          regions: regionNames,
          divisions: divisionNames,
        }}
      />
    );
  } else if (slug === 'by-region') {
    body = (
      <ByRegionView
        rows={model.reportRows([])}
        states={states}
        indicators={meta.indicators}
        firstCompleteYear={first}
        copy={{
          view,
          regions: { title: t(R('regions_title')) },
          divisions: { title: t(R('divisions_title')) },
          unknown: t('global.labels.not_found'),
          valueName: medalsUnit,
          columns: { name: col('place_columns', 'name'), medals: col('place_columns', 'medals'), split: col('brewery_columns', 'medal_split'), breweries: col('place_columns', 'breweries'), states: col('place_columns', 'states'), perMillion: col('place_columns', 'per_million') },
          tableSummary,
          regionNames,
          divisionNames,
        }}
      />
    );
  } else if (slug === 'ownership') {
    const verified = labelGroup('verified');
    const yesNo = labelGroup('yes_no');
    const columns: Column[] = [
      { key: 'brewery', label: t(R('columns.brewery')), sortable: true },
      { key: 'hq', label: t(R('columns.hq')), sortable: true },
      { key: 'type', label: t(R('columns.type')), sortable: true },
      { key: 'parent', label: t(R('columns.parent')), sortable: true },
      { key: 'investors', label: t(R('columns.investors')) },
      { key: 'stake', label: t(R('columns.stake')) },
      { key: 'year', label: t(R('columns.year')), numeric: true, sortable: true },
      { key: 'ba', label: t(R('columns.ba_independent')), sortable: true },
      { key: 'status', label: t(R('columns.status')), sortable: true },
      { key: 'verified', label: t(R('columns.verified')), sortable: true },
    ];
    const rows: Row[] = model.ownershipTable().map((o, i) => ({
      key: `${o.name}-${i}`,
      sort: { brewery: o.name, hq: o.hq, type: ownershipNames[o.type] ?? o.type, parent: o.parent, year: o.year, ba: o.baIndependent, status: o.status, verified: o.verified },
      cells: {
        brewery: o.slug ? <TextLink href={href(paths.brewery(o.slug))}>{o.name}</TextLink> : o.name,
        hq: o.hq,
        type: ownershipNames[o.type] ?? o.type,
        parent: o.parent ?? '',
        investors: o.investor ?? '',
        stake: o.stake ?? '',
        year: o.year ?? '',
        ba: o.baIndependent ? yesNo[o.baIndependent] ?? o.baIndependent : '',
        status: statusText(o.status),
        verified: verified[o.verified] ?? o.verified,
      },
    }));
    body = (
      <>
        <OwnershipView
          rows={model.reportRows(['parent'])}
          ownershipKeys={meta.ownershipKeys}
          firstCompleteYear={first}
          copy={{
            view,
            stats: { independent: t(R('stat_independent')), independentNote: raw(R('stat_independent_note')), listed: t(R('stat_listed')), owned: t(R('stat_owned')) },
            byType: { title: t(R('by_type_title')), valueName: medalsUnit, labelHeader: col('medal_columns', 'ownership') },
            parents: { title: t(R('parents_title')), subtitle: t(R('parents_subtitle')), empty: t(R('parents_empty')), labelHeader: t(R('columns.parent')) },
            tableSummary,
            types: ownershipNames,
          }}
        />
        <section className="flex flex-col gap-3" aria-labelledby="ownership-table">
          <SectionHeader id="ownership-table" title={t(R('table_title'))} lead={t(R('table_note'))} />
          <DataTable caption={t(R('table_title'))} sortHint={sortHint} columns={columns} rows={rows} initialSort={{ key: 'brewery', dir: 'ascending' }} scroll={false} />
        </section>
      </>
    );
  } else if (slug === 'economics') {
    const channels = labelGroup('distribution_channel');
    body = (
      <EconomicsView
        rows={model.reportRows([])}
        info={model.info()}
        firstCompleteYear={first}
        copy={{
          view,
          chart: { title: t(R('chart_title')), subtitle: t(R('chart_subtitle')), valueName: t('global.charts.units.arr'), labelHeader: col('brewery_columns', 'brewery'), tableSummary },
          table: { title: t(R('table_title')), sortHint },
          columns: { brewery: t(R('columns.brewery')), type: t(R('columns.type')), locations: t(R('columns.locations')), barrels: t(R('columns.barrels')), basis: t(R('columns.basis')), cases: t(R('columns.cases')), arr: t(R('columns.arr')), grossMargin: t(R('columns.gross_margin')), ebitda: t(R('columns.ebitda')), ebitdaRange: t(R('columns.ebitda_range')), distribution: t(R('columns.distribution')), ownership: t(R('columns.ownership')) },
          types: labelGroup('brewery_type'),
          basis: labelGroup('estimate_basis'),
          channels,
          ownership: ownershipNames,
          range: t('global.tables.category_columns.abv_value', { min: '{{min}}', max: '{{max}}' }),
        }}
      />
    );
  } else if (slug === 'trends') {
    const scale = model.scaleTable();
    const labels = scale.map((s) => s.year);
    const columns: Column[] = [
      { key: 'year', label: t(R('scale_columns.year')), numeric: true },
      { key: 'date', label: t(R('scale_columns.date')) },
      { key: 'venue', label: t(R('scale_columns.venue')) },
      { key: 'entries', label: t(R('scale_columns.entries')), numeric: true },
      { key: 'entering', label: t(R('scale_columns.breweries_entering')), numeric: true },
      { key: 'medals', label: t(R('scale_columns.medals')), numeric: true },
      { key: 'winning', label: t(R('scale_columns.winning_breweries')), numeric: true },
      { key: 'categories', label: t(R('scale_columns.categories')), numeric: true },
      { key: 'loaded', label: t(R('scale_columns.loaded')) },
      { key: 'notes', label: t(R('scale_columns.notes')) },
    ];
    const rows: Row[] = scale.map((s) => ({
      key: String(s.year),
      cells: { year: s.year, date: s.date ?? '', venue: s.venue ?? '', entries: num(s.entries), entering: num(s.breweriesEntering), medals: num(s.medals), winning: num(s.winningBreweries), categories: s.categories ?? '', loaded: s.coverage === 'complete' ? coverage.complete : <StatusChip label={coverage[s.coverage] ?? s.coverage} meaning={coverageMeaning[s.coverage]} />, notes: s.notes ?? '' },
    }));
    const values = (pick: (s: (typeof scale)[number]) => number | null) => scale.map((s) => pick(s) as number);
    body = (
      <>
        <p className="type-body-medium max-w-measure text-on-surface-variant">{t(R('fixed_note'))}</p>
        <div className="grid gap-4 expanded:grid-cols-2">
          <ChartCard id="entries-trend" title={t(R('entries_title'))} categories={labels} series={[{ name: t('global.charts.units.entries'), values: values((s) => s.entries) }]} tableSummary={tableSummary} nameColumn={t('global.charts.table_columns.name')} ariaLabel={t(R('entries_title'))} />
          <ChartCard id="medals-breweries-trend" title={t(R('medals_title'))} categories={labels} series={[{ name: medalsUnit, values: values((s) => s.medals) }, { name: t('global.charts.legend.breweries_entering'), values: values((s) => s.breweriesEntering) }]} tableSummary={tableSummary} nameColumn={t('global.charts.table_columns.name')} ariaLabel={t(R('medals_title'))} />
        </div>
        <section className="flex flex-col gap-3" aria-labelledby="scale">
          <SectionHeader id="scale" title={t(R('scale_title'))} />
          <DataTable caption={t(R('scale_title'))} columns={columns} rows={rows} scroll={false} />
        </section>
        <SectionHeader id="families" title={t(R('families_section'))} />
        <TrendsView
          rows={model.reportRows(['brewery_slug'])}
          meta={{ years: meta.years, coverage: meta.coverage }}
          firstCompleteYear={first}
          copy={{
            view,
            families: { title: t(R('families_title')), subtitle: t(R('families_subtitle')), other: t('global.charts.legend.other'), nameColumn: t('global.tables.medal_columns.style_family') },
            movers: { title: raw(R('movers_title')), gained: t(R('gained')), lost: t(R('lost')), empty: t(R('movers_empty')) },
            tableSummary,
            familyNames,
            coverage,
          }}
        />
      </>
    );
  } else {
    const awards = model.awardsTable();
    const columns: Column[] = [
      { key: 'year', label: t(R('columns.year')), numeric: true, sortable: true },
      { key: 'award', label: t(R('columns.award')), sortable: true },
      { key: 'bracket', label: t(R('columns.bracket')) },
      { key: 'brewery', label: t(R('columns.brewery')), sortable: true },
      { key: 'city', label: t(R('columns.city')), sortable: true },
      { key: 'source', label: t(R('columns.source')) },
    ];
    const rows: Row[] = awards.rows.map((a, i) => ({
      key: `${a.year}-${a.award}-${i}`,
      sort: { year: a.year, award: a.award, brewery: a.brewery, city: a.city },
      cells: { year: a.year, award: a.award, bracket: a.bracket, brewery: a.slug ? <TextLink href={href(paths.brewery(a.slug))}>{a.brewery}</TextLink> : a.brewery, city: a.city, source: <span className="text-on-surface-variant">{a.source}</span> },
    }));
    body = (
      <>
        <p className="type-body-medium max-w-measure text-on-surface-variant">{t(R('note'))}{awards.short ? ` ${t(R('partial'))}` : ''}</p>
        <DataTable caption={t(index(`${key}.title`))} sortHint={sortHint} columns={columns} rows={rows} initialSort={{ key: 'year', dir: 'descending' }} scroll={false} />
      </>
    );
  }

  return (
    <main id="main" tabIndex={-1} className={MAIN}>
      <header className="flex flex-col gap-3">
        <Breadcrumb label={t('global.navigation.breadcrumbs.all_analysis')} items={[{ href: href(analysisPaths.index), text: t('pages.analysis-report.common.back') }, { text: t(index(`${key}.title`)) }]} />
        <h1 className="type-display-small text-on-surface">{t(index(`${key}.title`))}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{fill(raw(R('lede')), slug === 'by-state' ? { latest_year: meta.latestYear, data_year: meta.dataYear ?? meta.latestYear } : {})}</p>
      </header>
      {body}
    </main>
  );
}
