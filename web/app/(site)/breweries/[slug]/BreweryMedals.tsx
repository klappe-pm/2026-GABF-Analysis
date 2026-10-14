'use client';

// Everything on a brewery page that follows the global filter: the summary tiles, the medals by year, the
// ten year trend, the medals by category and location, the hops and farms its beers reach, the medal
// history, and the cards of its latest beers. The page sends the brewery's own rows; this narrows them.
import { Fragment, useMemo } from 'react';
import { type BeerCardData, BeerProfileCard } from '@/components/BeerProfileCard';
import { type Column, DataTable, type Row } from '@/components/DataTable';
import { EstimateTooltip } from '@/components/EstimateTooltip';
import { MedalMark, type MedalName } from '@/components/MedalMark';
import { MedalRecord } from '@/components/MedalRecord';
import { SectionHeader } from '@/components/SectionHeader';
import { Field, FieldGrid } from '@/components/StatCard';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { useFilteredRows, usePageScope } from '@/lib/global-filter';
import { href, paths } from '@/lib/href';
import type { BreweryRecord, BreweryRow } from '@/lib/models/breweries.mjs';
import { type BarSeries, BarChartCard } from '../BarChartCard';
import { type EstimateCopy, explain, markLabel } from '../estimate-text';
import { abv, compact, fillText, usd, whole } from '../format';

type Copy = Record<string, Record<string, string>>;
export type MedalsBrewery = Pick<BreweryRecord, 'key' | 'slug' | 'name' | 'trend' | 'rows' | 'estimate' | 'hopLinks' | 'hopFarms' | 'namedFarms' | 'farmSlugs' | 'varietySlugs'>;
type Props = { b: MedalsBrewery; year: number; copy: Copy; estimate: EstimateCopy };

const RANK: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };
const MEDALS: MedalName[] = ['Gold', 'Silver', 'Bronze'];
const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
const tally = <T,>(items: T[], key: (x: T) => string) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
};
const links = (items: { text: string; href: string }[]) => items.map((l, i) => <Fragment key={l.href}>{i ? ', ' : ''}<TextLink href={l.href}>{l.text}</TextLink></Fragment>);

export function BreweryMedals({ b, year, copy, estimate }: Props) {
  const c = copy;
  usePageScope({ brewery_key: b.key }, [fillText(c.fixed.brewery, { brewery_name: b.name })]);
  const shown = useFilteredRows(b.rows) as BreweryRow[];
  const none = <span className="text-on-surface-variant">{c.gaps.not_found}</span>;
  const medalNames = c.medal as Record<MedalName, string>;
  const est = b.estimate;
  const mark = (id: string, metric: Parameters<typeof explain>[0]) => (
    <EstimateTooltip id={`est-${b.slug}-${id}`} marker={c.est_state.marker} label={markLabel(metric, estimate)} explanation={explain(metric, est, estimate)} linkText={c.scale.method_link} />
  );

  const counts = useMemo(() => ({ gold: shown.filter((r) => r.medal === 'Gold').length, silver: shown.filter((r) => r.medal === 'Silver').length, bronze: shown.filter((r) => r.medal === 'Bronze').length }), [shown]);
  const firstYear = shown.length ? Math.min(...shown.map((r) => r.year)) : null;
  const categories = useMemo(() => new Set(shown.map((r) => r.category_name)).size, [shown]);
  const special = shown.filter((r) => r.special).length;

  // Medals by year over the years of the trend.
  const years = useMemo(() => b.trend.map((t) => t.year), [b.trend]);
  const yearLabels = useMemo(() => years.map(String), [years]);
  const series = useMemo<BarSeries[]>(() => MEDALS.map((m) => ({ name: medalNames[m], medal: m, values: years.map((y) => shown.filter((r) => r.year === y && r.medal === m).length) })), [shown, years, medalNames]);
  // A ranking as one series of bars: the top entries drawn, every entry in the table view.
  const ranking = (list: [string, number][]) => ({ categories: list.map(([n]) => n), series: [{ name: c.tables.medals, values: list.map(([, n]) => n) }] as BarSeries[] });
  const byCategory = useMemo(() => ranking(tally(shown, (r) => r.category_name).slice(0, 15)), [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const byLocation = useMemo(() => ranking(tally(shown, (r) => r.brewery_location || r.city)), [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const byFamily = useMemo(() => ranking(tally(shown, (r) => c.style_family[r.style_family] ?? r.style_family)), [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  const trendColumns: Column[] = [
    { key: 'year', label: c.trend.year },
    { key: 'status', label: c.trend.status },
    { key: 'medals', label: c.trend.medals },
    { key: 'split', label: c.trend.split },
  ];
  const trendRows: Row[] = [...b.trend].reverse().map((t) => ({
    key: String(t.year),
    cells: {
      year: t.year,
      status: c.trend_status[t.status] ?? c.gaps.not_found,
      medals: t.total,
      split: <MedalRecord counts={{ gold: t.gold, silver: t.silver, bronze: t.bronze }} variant="value" names={medalNames} />,
    },
  }));

  // Hops and farms reached through the beers in view.
  const hopTally = tally(shown.flatMap((r) => r.hop_varieties ?? []), (n) => n);
  const hopNames = new Set(hopTally.map(([n]) => n));
  const hopSlug = (n: string) => b.hopLinks[n] ?? b.varietySlugs[n] ?? null;
  const hopCell = (names: string[]) => links(names.filter((n) => hopSlug(n)).map((n) => ({ text: n, href: href(paths.hop(hopSlug(n)!)) })));
  const namedNames = [...new Set(shown.flatMap((r) => r.hop_farms_named ?? []))].sort((x, y) => x.localeCompare(y));
  const grownNames = [...new Set(shown.flatMap((r) => r.hop_farms_grown ?? []))].sort((x, y) => x.localeCompare(y));
  const farmLink = (name: string) => (b.farmSlugs[name] ? <TextLink href={href(paths.hopFarm(b.farmSlugs[name]!))}>{name}</TextLink> : name);
  const farmColumns: Column[] = [{ key: 'farm', label: c.farms.farm, sortable: true }, { key: 'hops', label: c.farms.hops }];
  const namedRows: Row[] = namedNames.map((name) => ({ key: name, sort: { farm: name }, cells: { farm: farmLink(name), hops: hopCell((b.namedFarms[name]?.hops ?? []).filter((h) => hopNames.has(h)).sort()) } }));
  const grownRows: Row[] = grownNames.map((name) => ({
    key: name,
    sort: { farm: name },
    cells: { farm: farmLink(name), hops: hopCell([...hopNames].filter((h) => (b.hopFarms[h] ?? []).some((f) => f.name === name)).sort()) },
  }));

  // The medal history.
  const history = [...shown].sort((x, y) => y.year - x.year || (RANK[x.medal] ?? 9) - (RANK[y.medal] ?? 9));
  const historyColumns: Column[] = [
    { key: 'year', label: c.medalCols.year, sortable: true },
    { key: 'medal', label: c.medalCols.medal, sortable: true },
    { key: 'beer', label: c.medalCols.beer, sortable: true },
    { key: 'abv', label: c.medalCols.abv, sortable: true },
    { key: 'ibu', label: c.tables.ibu, sortable: true },
    { key: 'category', label: c.medalCols.category, sortable: true },
    { key: 'field', label: c.medalCols.field, sortable: true },
    { key: 'perMedal', label: c.medalCols.entries_per_medal, sortable: true },
    { key: 'location', label: c.medalCols.location_credited, sortable: true },
    { key: 'profile', label: c.tables.beer_profile },
  ];
  const historyRows: Row[] = history.map((r, i) => {
    const per = r.entries && r.category_medals ? r.entries / r.category_medals : null;
    return {
      key: `${r.year}-${r.category_slug}-${r.medal}-${i}`,
      sort: { year: r.year, medal: RANK[r.medal] ?? 9, beer: r.beer_name, abv: r.abv, ibu: r.ibu, category: r.category_name, field: r.entries, perMedal: per, location: r.brewery_location || r.city },
      cells: {
        year: r.year,
        medal: <span className="inline-flex items-center gap-2"><MedalMark medal={r.medal as MedalName} size="sm" title={medalNames[r.medal as MedalName]} />{medalNames[r.medal as MedalName] ?? r.medal}</span>,
        beer: r.stem ? <TextLink href={href(paths.beer(r.year, r.stem))}>{r.beer_name}</TextLink> : r.beer_name,
        abv: r.abv === null || r.abv === undefined ? none : abv(Number(r.abv)),
        ibu: r.ibu === null || r.ibu === undefined ? none : String(r.ibu),
        category: <TextLink href={href(paths.category(r.category_slug))}>{r.category_name}</TextLink>,
        field: r.entries ? whole(r.entries) : none,
        perMedal: per ? per.toFixed(1) : none,
        location: r.brewery_location || r.city || none,
        profile: r.stem ? <TextLink href={href(paths.beer(r.year, r.stem))}>{c.tables.open_profile}</TextLink> : none,
      },
    };
  });

  // The cards of the latest year's beers, gold first.
  const cards = shown.filter((r) => r.stem && r.year === year).sort((x, y) => (RANK[x.medal] ?? 9) - (RANK[y.medal] ?? 9) || x.beer_name.localeCompare(y.beer_name));
  const cardData = (r: BreweryRow): BeerCardData => {
    const nd = c.gaps.not_found;
    const list = (v: string[]) => (v.length ? v.join(', ') : nd);
    return {
      name: r.beer_name,
      breweryLine: fillText(c.card.brewery_line, { brewery_name: b.name, city: r.city, state: r.state }),
      medal: r.medal as MedalName,
      medalLabel: fillText(c.lede.medal_line, { medal: medalNames[r.medal as MedalName] ?? r.medal, category_name: r.category_name }),
      facts: [
        { label: c.card.category, value: r.category_name },
        { label: c.card.entries, value: r.entries ? whole(r.entries) : nd },
        { label: c.card.abv, value: r.abv === null || r.abv === undefined ? nd : abv(Number(r.abv)) },
        { label: c.card.ibu, value: r.ibu === null || r.ibu === undefined ? nd : String(r.ibu) },
        { label: c.card.style, value: r.beer_style ?? nd },
        { label: c.specs.malts, value: list(r.malts) },
        { label: c.specs.yeast, value: list(r.yeast) },
        { label: c.specs.adjuncts, value: list(r.adjuncts) },
      ],
      hops: (r.hop_varieties ?? []).filter((n) => hopSlug(n)).map((n) => ({ name: n, href: href(paths.hop(hopSlug(n)!)) })),
      hopsLabel: c.card.hops,
      noHops: nd,
      note: r.tasting_note ? { label: c.card.tasting_note, text: r.tasting_note, source: r.tasting_source ? { href: r.tasting_source, text: fillText(c.card.source, { site: hostOf(r.tasting_source) }) } : undefined } : null,
      noNote: nd,
      link: r.stem ? { href: href(paths.beer(r.year, r.stem)), text: c.beer_cards.deep_dive } : undefined,
    };
  };

  const partialInView = shown.some((r) => r.partial);

  return (
    <div className="flex flex-col gap-8">
      {partialInView ? <StateCard kind="notice" title={c.partial_brewery.notice} /> : null}
      <section aria-label={c.stats.title}>
        <FieldGrid label={c.stats.title}>
          <Field label={c.stats.medals}>{shown.length}</Field>
          <Field label={c.stats.medal_split}><MedalRecord counts={counts} variant="split" names={medalNames} /></Field>
          <Field label={c.stats.first_medal}>{firstYear ?? c.stats.first_medal_none}</Field>
          <Field label={c.stats.categories} note={fillText(c.stats.categories_note, { count: special })}>{categories}</Field>
          <Field label={est.basis === 'reported' ? c.scale.barrels : c.stats.barrels} note={est.basis === 'reported' ? c.stats.barrels_note_reported : c.stats.barrels_note_estimate}>
            <span className="inline-flex items-center gap-1">{compact(est.barrels)}{est.basis === 'reported' ? null : mark('barrels-tile', 'barrels')}</span>
          </Field>
          <Field label={c.stats.arr} note={fillText(c.stats.arr_note, { ebitda: usd(est.fin.ebitda), margin: `${Math.round(est.fin.ebitdaMargin * 100)}%` })}>
            <span className="inline-flex items-center gap-1">{usd(est.fin.arr)}{mark('arr-tile', 'arr')}</span>
          </Field>
        </FieldGrid>
      </section>

      {shown.length === 0 ? (
        <StateCard kind="empty" title={c.no_results.title}>{c.no_results.remove_hint}</StateCard>
      ) : null}

      <BarChartCard
        id="medals-by-year"
        orientation="columns"
        title={c.charts.by_year_title}
        note={fillText(c.charts.by_year_subtitle, { brewery_name: b.name, first_year: years[0], last_year: years[years.length - 1] })}
        categories={yearLabels}
        series={series}
        tableSummary={c.table_view.summary}
        nameColumn={c.table_columns.name}
        ariaLabel={fillText(c.chart.aria, { brewery_name: b.name })}
      />

      <section aria-labelledby="trend-title" className="flex flex-col gap-3">
        <SectionHeader id="trend-title" title={c.trend.title} lead={c.trend.note} />
        <DataTable caption={fillText(c.trend.caption, { brewery_name: b.name })} columns={trendColumns} rows={trendRows} scroll={false} />
      </section>

      {shown.length ? (
        <div className="grid grid-cols-1 gap-6 expanded:grid-cols-2">
          <BarChartCard id="medals-by-family" orientation="bars" title={c.charts.by_family_title} categories={byFamily.categories} series={byFamily.series} tableSummary={c.table_view.summary} nameColumn={c.medalCols.style_family} ariaLabel={fillText(c.tables.family_caption, { brewery_name: b.name })} />
          <BarChartCard id="medals-by-category" orientation="bars" title={c.charts.by_category_title} categories={byCategory.categories} series={byCategory.series} tableSummary={c.table_view.summary} nameColumn={c.medalCols.category} ariaLabel={fillText(c.tables.category_caption, { brewery_name: b.name })} />
          <BarChartCard id="medals-by-location" orientation="bars" title={c.charts.by_location_title} note={c.charts.by_location_subtitle} categories={byLocation.categories} series={byLocation.series} tableSummary={c.table_view.summary} nameColumn={c.medalCols.location_credited} ariaLabel={fillText(c.tables.location_caption, { brewery_name: b.name })} />
        </div>
      ) : null}

      {hopTally.length ? (
        <section aria-labelledby="hops-title" className="flex flex-col gap-3">
          <SectionHeader id="hops-title" title={c.hops_shared.brewery_title} lead={c.hops_shared.brewery_note} />
          <DataTable
            caption={fillText(c.hops.caption, { brewery_name: b.name })}
            columns={[{ key: 'name', label: c.hops_shared.brewery_variety, sortable: true }, { key: 'beers', label: c.hops_shared.brewery_beers, sortable: true }]}
            rows={hopTally.map(([name, n]) => ({ key: name, sort: { name, beers: n }, cells: { name: hopSlug(name) ? <TextLink href={href(paths.hop(hopSlug(name)!))}>{name}</TextLink> : name, beers: n } }))}
            scroll={false}
            initialSort={{ key: 'beers', dir: 'descending' }}
          />
          <h3 className="type-title-large text-on-surface">{c.farms.title}</h3>
          <p className="type-body-medium max-w-measure text-on-surface-variant">{c.farms.note}</p>
          <h4 className="type-title-medium text-on-surface">{c.farms.named_label}</h4>
          {namedRows.length ? <DataTable caption={fillText(c.farms.named_caption, { brewery_name: b.name })} columns={farmColumns} rows={namedRows} scroll={false} initialSort={{ key: 'farm', dir: 'ascending' }} /> : <p className="type-body-medium text-on-surface-variant">{c.farms.named_empty}</p>}
          <h4 className="type-title-medium text-on-surface">{c.farms.grown_label}</h4>
          {grownRows.length ? <DataTable caption={fillText(c.farms.grown_caption, { brewery_name: b.name })} columns={farmColumns} rows={grownRows} scroll={false} initialSort={{ key: 'farm', dir: 'ascending' }} /> : <p className="type-body-medium text-on-surface-variant">{c.farms.grown_empty}</p>}
        </section>
      ) : null}

      <section aria-labelledby="history-title" className="flex flex-col gap-3">
        <SectionHeader id="history-title" title={c.history.title} lead={c.history.note} />
        {history.length ? (
          <DataTable caption={fillText(c.tables.history_caption, { brewery_name: b.name })} sortHint={c.sorting.hint} columns={historyColumns} rows={historyRows} scroll={false} initialSort={{ key: 'year', dir: 'descending' }} />
        ) : (
          <p className="type-body-medium text-on-surface-variant">{c.history.empty}</p>
        )}
      </section>

      {cards.length ? (
        <section aria-labelledby="cards-title" className="flex flex-col gap-4">
          <SectionHeader id="cards-title" title={fillText(c.beers.title, { year })} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))] gap-4">
            {cards.map((r) => <BeerProfileCard key={`${r.stem}`} data={cardData(r)} headingLevel={3} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
