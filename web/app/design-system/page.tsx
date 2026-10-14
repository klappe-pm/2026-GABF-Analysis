import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { FilterChips } from '@/components/FilterChips';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/Button';
import { ChartCard } from '@/components/ChartCard';
import { Checkbox } from '@/components/Checkbox';
import { EstimateTooltip, type EstimateInput } from '@/components/EstimateTooltip';
import type { breweriesIndex as BreweriesIndex } from '@/lib/models/breweries.mjs';
import { laneModel } from '@/lib/site-data';
import { Field, FieldGrid } from '@/components/StatCard';
import { FiltersForm, FiltersDialog, type FilterGroup, type FiltersCopy } from '@/components/FiltersDialog';
import { PageHeader } from '@/components/PageHeader';
import { StateCard } from '@/components/StateCard';
import { Icon, type IconName } from '@/components/Icon';
import { MedalMark, type MedalName } from '@/components/MedalMark';
import { MedalRecord } from '@/components/MedalRecord';
import { RangeScale } from '@/components/RangeScale';
import { Callout } from '@/components/Callout';
import { DataTable } from '@/components/DataTable';
import { SearchField } from '@/components/SearchField';
import { SectionHeader } from '@/components/SectionHeader';
import { Select } from '@/components/Select';
import { StatusChip } from '@/components/StatusChip';
import { TextLink } from '@/components/TextLink';
import { BeerProfileCard, type BeerCardData } from '@/components/BeerProfileCard';
import { SpecCard } from '@/components/SpecCard';
import { HopProfileCard, type HopCardData } from '@/components/HopProfileCard';
import { fullBeerProfile, hopProfile, hopSlug } from '@/lib/profiles';
import { breweryRecords, categoryIndex, fmt, matchesNothing, oddsFinding, resultYears, results, stateSeries, yearCoverage, yearSummary } from '@/lib/data';
import { sampleBeers, type SampleBeer } from '@/lib/samples';
import { fill, finding, group, lookup, t } from '@/lib/content';
import { existsInRepo, SOURCE_URL } from '@/lib/repo';
import { AdaptiveNavigation, ContrastTable, ElevationRow, MedalTable, Ordered, SchemeTable, SectionTabs, SettingsTable, ShapeTable, TypeTable } from './live';
import { NavigationDrawer } from '@/components/NavigationDrawer';
import { NavigationRail } from '@/components/NavigationRail';
import { ReviewSettingsPanel } from '@/components/review/ReviewSettingsPanel';
import { Specimen, State } from './parts';

export function generateMetadata(): Metadata {
  return {
    title: t('pages.design-system.page.title'),
    description: t('pages.design-system.page.lede'),
  };
}

const raw = (key: string) => lookup(key) as string;
const YEAR = 2026;
const MEDALS: MedalName[] = ['Gold', 'Silver', 'Bronze'];
const ICONS: IconName[] = ['close', 'chevron-down', 'search', 'check', 'menu', 'filter', 'sort', 'sort-ascending', 'sort-descending', 'tune', 'palette', 'type', 'shape', 'layers', 'widgets', 'medal', 'brewery', 'beer', 'chart', 'list', 'hop', 'farm'];
const iconLabel = (name: IconName) => t(`pages.design-system.icon_labels.${name}`);
const yearSpan = (first: string | number, last: string | number) => fill(raw('pages.design-system.ranges.year_range'), { first_year: first, last_year: last });

const rangeText = (key: 'inside' | 'below' | 'above', min: number, max: number, format: (n: number) => string) => fill(raw(`global.scales.range.${key}`), { min: format(min), max: format(max) });
const verdict = (v: number, min: number, max: number) => (v < min ? 'below' : v > max ? 'above' : 'inside');

// One winning beer with its ABV and IBU placed inside its style's range.
function BeerScales({ idPrefix, sample, medalNames }: { idPrefix: string; sample: SampleBeer; medalNames: Record<MedalName, string> }) {
  const { beer: b, range } = sample;
  return (
    <div className="flex w-full flex-col gap-4">
      <p className="type-body-medium text-on-surface-variant">{fill(raw('pages.design-system.samples.beer'), { beer_name: b.beer, brewery_name: b.brewery, medal: medalNames[b.medal].toLowerCase(), category_name: b.category, year: YEAR })}</p>
      {b.abv !== null ? (
        <RangeScale
          id={`${idPrefix}-abv`}
          label={t('global.tables.medal_columns.abv')}
          value={b.abv}
          valueText={fmt.abv(b.abv)}
          range={{ min: range.abvMin, max: range.abvMax, minText: fmt.abv(range.abvMin), maxText: fmt.abv(range.abvMax) }}
          summary={rangeText(verdict(b.abv, range.abvMin, range.abvMax), range.abvMin, range.abvMax, fmt.abv)}
          source={fill(raw('global.scales.range.source'), { source: range.source })}
        />
      ) : null}
      {b.ibu !== null ? (
        <RangeScale
          id={`${idPrefix}-ibu`}
          label={card('ibu')}
          value={b.ibu}
          valueText={String(b.ibu)}
          range={{ min: range.ibuMin, max: range.ibuMax, minText: String(range.ibuMin), maxText: String(range.ibuMax) }}
          summary={rangeText(verdict(b.ibu, range.ibuMin, range.ibuMax), range.ibuMin, range.ibuMax, String)}
        />
      ) : null}
    </div>
  );
}

// The specimen hop and the first 2026 winner that uses it with every card field published.
const CARD_HOP = 'Cascade';
const site = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
const card = (key: string) => t(`pages.design-system.profile_cards.${key}`);
const cardFill = (key: string, values: Record<string, string | number>) => fill(raw(`pages.design-system.profile_cards.${key}`), values);

function beerCardData(medalNames: Record<MedalName, string>): { data: BeerCardData; beer: string } | null {
  const b = fullBeerProfile(CARD_HOP);
  if (!b) return null;
  const none = t('global.labels.not_found');
  const note = b.tastingNote ?? b.description;
  return {
    beer: b.beer,
    data: {
      name: b.beer,
      breweryLine: cardFill('brewery_line', { brewery_name: b.brewery, city: b.city, state: b.state }),
      medal: b.medal,
      medalLabel: medalNames[b.medal],
      facts: [
        { label: card('category'), value: b.category },
        { label: card('abv'), value: b.abv === null ? none : fmt.abv(b.abv) },
        { label: card('ibu'), value: b.ibu === null ? none : String(b.ibu) },
        { label: card('style'), value: b.style ?? none },
      ],
      hops: b.hops.map((h) => ({ name: h, href: `/hops/${hopSlug(h)}/` })),
      hopsLabel: card('hops'),
      noHops: none,
      note: note ? { label: card('note'), text: note.text, source: note.source ? { href: note.source, text: cardFill('source', { site: site(note.source) }) } : undefined } : null,
      noNote: none,
      link: { href: `${SOURCE_URL}/${b.file}`, text: card('deep_dive') },
    },
  };
}

function hopCardData(): HopCardData {
  const h = hopProfile(CARD_HOP);
  const none = t('global.labels.not_found');
  const pct = (r: { min: number; max: number } | null) => (r ? cardFill('range_percent', { min: fmt.one(r.min), max: fmt.one(r.max) }) : none);
  return {
    name: h.variety,
    facts: [
      { label: card('origin'), value: h.origin ?? none },
      { label: card('breeder'), value: h.breeder ?? none },
      { label: card('alpha'), value: pct(h.alpha) },
      { label: card('oil'), value: h.oil ? cardFill('oil_range', { min: fmt.one(h.oil.min), max: fmt.one(h.oil.max) }) : none },
      {
        label: card('acreage'),
        value: h.acreage
          ? [
            h.acreage.share !== null
              ? cardFill('acreage_value', { acres: fmt.number(h.acreage.acres), year: h.acreage.year, share: `${fmt.one(h.acreage.share)}%` })
              : cardFill('acreage_value_no_share', { acres: fmt.number(h.acreage.acres), year: h.acreage.year }),
            h.acreage.withheld.length ? cardFill('acreage_withheld', { states: fmt.years(h.acreage.withheld) }) : '',
          ].filter(Boolean).join('. ')
          : none,
      },
      { label: card('medal_beers'), value: fmt.number(h.medalBeers) },
    ],
    aroma: {
      label: card('aroma'),
      text: h.aroma ? h.aroma.descriptors.join(', ') : null,
      source: h.aroma?.source ? { href: h.aroma.source, text: cardFill('source', { site: h.aroma.attribution ?? site(h.aroma.source) }) } : undefined,
    },
    farms: {
      label: card('farms'),
      items: h.farms.map((f) => ({ name: f.state ? cardFill('farm_line', { farm_name: f.name, state: f.state }) : f.name, href: f.doc ? `${SOURCE_URL}/${f.doc}` : undefined })),
      more: raw('pages.design-system.profile_cards.farms_more'),
    },
    notDefined: none,
  };
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="flex scroll-mt-16 flex-col gap-5">
      <SectionHeader id={`${id}-title`} title={title} lead={lead} />
      {children}
    </section>
  );
}

export default async function DesignSystemPage() {
  const title = t('pages.design-system.page.title');
  const summary = yearSummary(YEAR);
  const coverage = yearCoverage();
  const partialYears = coverage.filter((y) => y.status === 'partial').map((y) => y.year);
  const completeYears = coverage.filter((y) => y.status === 'complete').map((y) => y.year);
  const medalNames = Object.fromEntries(MEDALS.map((m) => [m, t(`global.labels.medal.${m}`)])) as Record<MedalName, string>;
  const col = (key: string) => t(`pages.design-system.columns.${key}`);
  const dimension = (key: string) => t(`global.filters.dimensions.${key}`);
  const states = (key: string) => t(`pages.design-system.states.${key}`);
  const compName = (key: string) => t(`pages.design-system.components.${key}`);
  const sectionTitle = (key: string) => t(`pages.design-system.sections.${key}`);
  const note = (key: string) => t(`pages.design-system.section_notes.${key}`);
  const schemeGroup = (key: string) => t(`pages.design-system.scheme_groups.${key}`);
  const roleNames = group('pages.design-system.scheme_roles');

  const index = categoryIndex(YEAR);
  const lead = breweryRecords()[0];
  const odds = oddsFinding(YEAR);
  const oddsFill = finding('medal-odds-by-category');
  const headline = fill(oddsFill.lead, {
    odds_min: fmt.one(odds.min.perMedal ?? 0),
    odds_min_category: odds.min.name,
    odds_max: fmt.one(odds.max.perMedal ?? 0),
    odds_max_category: odds.max.name,
    odds_median: fmt.one(odds.median),
    year_range: String(YEAR),
  });
  const samples = sampleBeers();
  const sampleBeer = samples.inside.beer;
  const series = stateSeries(5);
  // The inputs of a real brewery's revenue estimate, labelled with the brewery page's own words.
  const { info: breweryInfo } = (await laneModel<{ breweriesIndex: typeof BreweriesIndex }>('breweries')).breweriesIndex();
  const estimateSample = Object.values(breweryInfo).find((i) => !i.est.assumed && i.est.type);
  const inputLabel = (key: string) => t(`pages.brewery-detail.estimates.input_${key}`);
  const estimateInputs: EstimateInput[] = estimateSample ? [
    { label: inputLabel('type'), value: group('global.labels.brewery_type')[estimateSample.est.type ?? ''] ?? estimateSample.est.type ?? '' },
    { label: inputLabel('locations'), value: fmt.number(estimateSample.est.locations) },
    { label: inputLabel('barrels'), value: fmt.number(Math.round(estimateSample.est.barrels)) },
  ] : [];

  const filtersCopy: FiltersCopy = {
    trigger: t('global.filters.trigger.label'),
    title: t('global.filters.panel.title'),
    close: t('global.filters.panel.close'),
    reset: t('global.filters.panel.reset'),
    apply: t('global.filters.panel.apply'),
    matchCount: fill(raw('global.filters.panel.match_count_many'), { count: fmt.number(completeYears.reduce((n, y) => n + results(y).length, 0)) }),
    searchLabel: t('global.filters.search.label'),
    searchPlaceholder: t('global.filters.search.placeholder'),
    partialLabel: fill(raw('global.filters.partial_years.include'), { years: fmt.years(partialYears) }),
    partialNote: t('global.filters.partial_years.default_note'),
  };
  const all = { value: 'all', label: t('global.filters.options.all') };
  const stateList = [...new Set(completeYears.flatMap((y) => results(y).map((r) => r.state)))].filter(Boolean).sort();
  const filterGroups: FilterGroup[] = [
    { key: 'when', title: t('global.filters.groups.when'), fields: [{ id: 'year', label: dimension('year'), options: [all, ...resultYears().reverse().map((y) => ({ value: String(y), label: String(y) }))] }] },
    { key: 'what', title: t('global.filters.groups.what'), fields: [{ id: 'medal', label: dimension('medal'), options: [all, ...MEDALS.map((m) => ({ value: m, label: medalNames[m] }))] }] },
    { key: 'where', title: t('global.filters.groups.where'), fields: [{ id: 'state', label: dimension('state'), options: [all, ...stateList.map((s) => ({ value: s, label: s }))] }] },
    { key: 'who', title: t('global.filters.groups.who'), fields: [{ id: 'ownership', label: dimension('ownership_type'), options: [all, ...Object.entries(group('global.labels.ownership_type')).map(([value, label]) => ({ value, label }))] }] },
  ];

  const fixedYear = fill(raw('global.filters.chips.fixed_year'), { year: YEAR });
  const medalChip = fill(raw('global.filters.chips.chip'), { dimension: dimension('medal'), value: medalNames.Gold });
  const searchQuery = 'zzzz';
  const yearRange = yearSpan(series.years[0], series.years[series.years.length - 1]);
  // The chart card specimens: one per preset, every figure counted from the official winners lists.
  const sample = (key: string, values: Record<string, string | number> = {}) => fill(raw(`pages.design-system.samples.${key}`), values);
  const notFound = t('global.labels.not_found');
  const medalSeries = (counts: Record<MedalName, number[]>) => MEDALS.map((m) => ({ name: medalNames[m], values: counts[m], medal: m }));
  const byYear = Object.fromEntries(MEDALS.map((m) => [m, completeYears.map((y) => results(y).filter((r) => r.medal === m).length)])) as Record<MedalName, number[]>;
  const yearTotals = completeYears.map((_, i) => MEDALS.reduce((n, m) => n + byYear[m][i], 0));
  const stateTotals = new Map<string, number>();
  for (const y of completeYears) for (const r of results(y)) if (r.state) stateTotals.set(r.state, (stateTotals.get(r.state) ?? 0) + 1);
  const rankedStates = [...stateTotals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const topStates = rankedStates.slice(0, 10);
  const shareStates = rankedStates.slice(0, 14);
  const topBreweries = breweryRecords().slice(0, 8);
  const biggestFields = index.filter((c) => c.entries !== null).sort((a, b) => (b.entries ?? 0) - (a.entries ?? 0)).slice(0, 10);
  const unit = (key: string) => t(`global.charts.units.${key}`);
  const passthroughColumns = [{ key: 'year', label: dimension('year') }, { key: 'medals', label: unit('medals'), numeric: true }];
  const passthroughRows = completeYears.map((y, i) => ({ key: String(y), cells: { year: String(y), medals: fmt.number(yearTotals[i]) } }));
  const SECTION_ICONS: Record<string, IconName> = { settings: 'tune', color: 'palette', type: 'type', shape: 'shape', elevation: 'layers', components: 'widgets' };
  const navItems = Object.entries(SECTION_ICONS).map(([id, icon]) => ({ id, text: sectionTitle(id), icon }));

  const components: { id: string; node: ReactNode }[] = [
    {
      id: 'page-header',
      node: (
        <Specimen name="page-header" title={compName('page_header')} columns="grid-cols-1">
          <State label={states('default')} wide>
            <div className="w-full">
              <PageHeader
                menuId="specimen-menu"
                brand={{ text: t('global.site.identity.name'), href: '#component-form-header' }}
                nav={[
                  { id: 'results', href: '#component-form-header', text: t('global.navigation.header.results'), current: true },
                  { id: 'breweries', href: '#component-form-header', text: t('global.navigation.header.breweries') },
                  { id: 'beers', href: '#component-form-header', text: t('global.navigation.header.beers') },
                  { id: 'analysis', href: '#component-form-header', text: t('global.navigation.header.analysis') },
                ]}
                navLabel={t('global.site.header.nav_label')}
                menuLabel={t('global.site.header.menu_button')}
                skipLabel={t('global.site.header.skip_link')}
                skipTarget="#component-form-header"
              />
            </div>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'breadcrumb',
      node: (
        <Specimen name="breadcrumb" title={compName('breadcrumb')}>
          <State label={states('default')}>
            <Breadcrumb label={t('global.site.header.nav_label')} items={[{ href: '#component-breadcrumb', text: t('global.navigation.breadcrumbs.all_results') }, { text: fill(raw('global.navigation.breadcrumbs.category_number'), { number: index[0].number }) }]} />
          </State>
        </Specimen>
      ),
    },
    {
      id: 'section-header',
      node: (
        <Specimen name="section-header" title={compName('section_header')}>
          <State label={states('default')} wide>
            <div className="w-full"><SectionHeader id="specimen-section" title={fill(raw('pages.home.category_index.title'), { year: YEAR })} lead={t('pages.home.category_index.note')} /></div>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'stat-card',
      node: (
        <Specimen name="stat-card" title={compName('stat_card')} columns="grid-cols-1">
          <State label={states('value')} wide>
            <div className="w-full">
              <FieldGrid label={compName('stat_card')}>
                <Field label={t('pages.home.scoresheet.competition_year')} size="text">{fill(raw('pages.home.scoresheet.competition_value'), { year: YEAR })}</Field>
                <Field label={t('pages.home.scoresheet.entries_judged')}>{summary?.entries ? fmt.number(summary.entries) : t('pages.home.scoresheet.not_published')}</Field>
                <Field label={t('pages.home.scoresheet.categories')}>{summary?.categories ? fmt.number(summary.categories) : t('pages.home.scoresheet.not_published')}</Field>
                <Field label={t('pages.home.scoresheet.medals_awarded')}>{summary?.medals ? fmt.number(summary.medals) : t('pages.home.scoresheet.not_published')}</Field>
              </FieldGrid>
            </div>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'data-table',
      node: (
        <Specimen name="data-table" title={compName('data_table')} columns="grid-cols-1">
          <State label={states('default')} wide>
            <div className="w-full">
              <p className="type-body-medium pb-2 text-on-surface-variant">{fill(raw('pages.design-system.samples.category_index'), { year: YEAR })}</p>
              <DataTable
                caption={fill(raw('pages.home.category_index.title'), { year: YEAR })}
                sortHint={t('global.tables.sorting.hint')}
                initialSort={{ key: 'number', dir: 'ascending' }}
                columns={[
                  { key: 'category', label: t('pages.home.category_index.columns.category'), sortable: true },
                  { key: 'entries', label: t('pages.home.category_index.columns.entries'), numeric: true, sortable: true },
                  { key: 'odds', label: t('pages.home.category_index.columns.odds'), numeric: true, sortable: true },
                  { key: 'gold', label: t('pages.home.category_index.columns.gold') },
                  { key: 'silver', label: t('pages.home.category_index.columns.silver') },
                  { key: 'bronze', label: t('pages.home.category_index.columns.bronze') },
                ]}
                rows={index.slice(0, 12).map((l) => ({
                  key: String(l.number),
                  sort: { category: l.name, entries: l.entries, odds: l.perMedal, number: l.number },
                  cells: {
                    category: l.name,
                    entries: l.entries === null ? t('global.states.gaps.not_published') : fmt.number(l.entries),
                    odds: l.perMedal === null ? t('global.states.gaps.not_published') : fmt.one(l.perMedal),
                    gold: l.gold,
                    silver: l.silver,
                    bronze: l.bronze,
                  },
                }))}
              />
            </div>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'medal-mark',
      node: (
        <Specimen name="medal-mark" title={compName('medal_mark')}>
          <State label={states('default')}>{MEDALS.map((m) => <MedalMark key={m} medal={m} title={medalNames[m]} />)}</State>
          <State label={states('tally')}>{MEDALS.map((m) => <MedalMark key={m} medal={m} size="sm" label={false} title={medalNames[m]} />)}</State>
        </Specimen>
      ),
    },
    {
      id: 'medal-record',
      node: (
        <Specimen name="medal-record" title={compName('medal_record')}>
          <State label={states('default')} wide>
            <p className="type-body-medium text-on-surface-variant">{fill(raw('pages.design-system.samples.medal_record'), { brewery_name: lead.brewery, city: lead.city, state: lead.state, year_range: yearSpan(completeYears[0], completeYears[completeYears.length - 1]) })}</p>
          </State>
          <State label={states('split')}><MedalRecord counts={lead.record} names={medalNames} /></State>
          <State label={states('tally')}><MedalRecord counts={lead.record} names={medalNames} variant="tally" /></State>
          <State label={states('value')}><MedalRecord counts={lead.record} names={medalNames} variant="value" /></State>
        </Specimen>
      ),
    },
    {
      id: 'range-scale',
      node: (
        <Specimen name="range-scale" title={compName('range_scale')}>
          <State label={states('inside')}><BeerScales idPrefix="inside" sample={samples.inside} medalNames={medalNames} /></State>
          {samples.outside ? <State label={states('outside')}><BeerScales idPrefix="outside" sample={samples.outside} medalNames={medalNames} /></State> : null}
        </Specimen>
      ),
    },
    {
      id: 'callout',
      node: (
        <Specimen name="callout" title={compName('callout')}>
          <State label={states('default')} wide>
            <Callout label={t('pages.home.finding.label')} link={{ href: '#component-red-pen-note', text: t('pages.home.finding.link') }}>{headline}</Callout>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'status-chip',
      node: (
        <Specimen name="status-chip" title={compName('status_chip')}>
          <State label={t('global.labels.coverage.partial')}><StatusChip label={t('global.labels.coverage.partial')} meaning={t('global.labels.coverage_meaning.partial')} /></State>
          <State label={t('global.labels.coverage.pending')}><StatusChip label={t('global.labels.coverage.pending')} meaning={t('global.labels.coverage_meaning.pending')} /></State>
          <State label={t('global.states.estimates.short')}><StatusChip label={t('global.states.estimates.short')} /></State>
        </Specimen>
      ),
    },
    {
      id: 'filters-dialog',
      node: (
        <Specimen name="filters-dialog" title={compName('filters_dialog')} columns="grid-cols-1">
          <State label={states('default')}><FiltersDialog copy={filtersCopy} groups={filterGroups} /></State>
          <State label={states('open')} wide><div className="w-full"><FiltersForm idPrefix="specimen-filters" copy={filtersCopy} groups={filterGroups} /></div></State>
        </Specimen>
      ),
    },
    {
      id: 'filter-chips',
      node: (
        <Specimen name="filter-chips" title={compName('filter_chips')}>
          <State label={states('default')} wide>
            <FilterChips
              label={t('global.filters.chips.bar_label')}
              clearLabel={t('global.filters.chips.clear_all')}
              entries={[
                { text: fixedYear, fixedNote: t('global.filters.chips.fixed_tooltip') },
                { text: medalChip, removeLabel: fill(raw('global.filters.chips.remove_label'), { chip: medalChip }) },
              ]}
            />
          </State>
        </Specimen>
      ),
    },
    {
      id: 'button',
      node: (
        <Specimen name="button" title={compName('button')}>
          {(['primary', 'secondary', 'quiet'] as const).map((v) => {
            const text = v === 'primary' ? t('global.filters.panel.apply') : v === 'secondary' ? t('global.filters.panel.reset') : t('global.filters.panel.close');
            return (
              <State key={v} label={text}>
                <Button variant={v}>{text}</Button>
                <Button variant={v} disabled>{states('disabled')}</Button>
              </State>
            );
          })}
          <State label={states('busy')}>
            <Button variant="primary" busy busyLabel={t('global.filters.panel.loading')}>{t('global.filters.panel.apply')}</Button>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'text-link',
      node: (
        <Specimen name="text-link" title={compName('text_link')}>
          <State label={states('default')}><TextLink href="#component-text-link">{t('global.navigation.footer.method')}</TextLink></State>
          <State label={states('focus')}><TextLink href="#component-text-link" state="focus">{t('global.navigation.footer.method')}</TextLink></State>
        </Specimen>
      ),
    },
    {
      id: 'select',
      node: (
        <Specimen name="select" title={compName('select')}>
          <State label={states('default')}>
            <div className="w-full max-w-sheet"><Select id="specimen-year" label={dimension('year')} options={[all, ...resultYears().reverse().map((y) => ({ value: String(y), label: String(y) }))]} /></div>
          </State>
          <State label={states('disabled')}>
            <div className="w-full max-w-sheet"><Select id="specimen-year-disabled" label={dimension('year')} disabled options={[all]} /></div>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'checkbox',
      node: (
        <Specimen name="checkbox" title={compName('checkbox')}>
          <State label={states('default')}><Checkbox id="specimen-partial" label={filtersCopy.partialLabel} hint={filtersCopy.partialNote} /></State>
          <State label={states('checked')}><Checkbox id="specimen-partial-checked" label={filtersCopy.partialLabel} defaultChecked /></State>
          <State label={states('disabled')}><Checkbox id="specimen-partial-disabled" label={filtersCopy.partialLabel} disabled /></State>
        </Specimen>
      ),
    },
    {
      id: 'search-field',
      node: (
        <Specimen name="search-field" title={compName('search_field')}>
          <State label={states('default')}>
            <div className="w-full max-w-sheet"><SearchField id="specimen-search" label={t('pages.home.search.label')} placeholder={t('pages.home.search.placeholder')} /></div>
          </State>
          <State label={states('error')}>
            <div className="w-full max-w-sheet">
              <SearchField
                id="specimen-search-error"
                label={t('pages.home.search.label')}
                placeholder={t('pages.home.search.placeholder')}
                defaultValue={searchQuery}
                error={matchesNothing(searchQuery) ? fill(raw('pages.home.search.no_match'), { query: searchQuery }) : undefined}
              />
            </div>
          </State>
          <State label={states('disabled')}>
            <div className="w-full max-w-sheet"><SearchField id="specimen-search-disabled" label={t('pages.home.search.label')} placeholder={t('pages.home.search.placeholder')} disabled /></div>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'estimate-tooltip',
      node: (
        <Specimen name="estimate-tooltip" title={compName('estimate_tooltip')}>
          <State label={states('default')} wide>
            <div className="type-body-large">
              {t('global.states.estimates.short')}
              {' '}
              <EstimateTooltip
                id="specimen-estimate"
                marker={t('global.states.estimates.marker')}
                label={t('global.states.estimates.short')}
                explanation={t('global.states.estimates.explanation')}
                inputs={estimateInputs}
                linkText={t('global.navigation.footer.method')}
              />
            </div>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'chart-card',
      node: (
        <Specimen name="chart-card" title={compName('chart_card')} columns="grid-cols-1">
          <State label={sample('preset_line')} wide>
            <div className="w-full">
              <ChartCard
                id="specimen-chart"
                title={sample('chart_title', { year_range: yearRange })}
                note={sample('chart_note')}
                ariaLabel={sample('chart_label', { states: fmt.years(series.series.map((s) => s.state)), year_range: yearRange })}
                tableSummary={t('global.charts.table_view.summary')} notFound={notFound}
                nameColumn={t('global.charts.table_columns.name')}
                categories={series.years}
                series={series.series.map((s) => ({ name: s.state, values: s.values }))}
              />
            </div>
          </State>
          <State label={sample('preset_bar')} wide>
            <div className="w-full">
              <ChartCard
                id="specimen-bar"
                preset="bar"
                title={sample('chart_bar_title', { year_range: yearRange })}
                note={sample('chart_bar_note')}
                ariaLabel={sample('chart_bar_label', { year_range: yearRange })}
                tableSummary={t('global.charts.table_view.summary')} notFound={notFound}
                nameColumn={dimension('medal')}
                categories={completeYears}
                series={medalSeries(byYear)}
              />
            </div>
          </State>
          <State label={sample('preset_stacked_bar')} wide>
            <div className="w-full">
              <ChartCard
                id="specimen-stacked-bar"
                preset="stackedBar"
                title={sample('chart_stacked_title', { year_range: yearRange })}
                note={sample('chart_stacked_note')}
                ariaLabel={sample('chart_stacked_label', { states: fmt.years(series.series.map((s) => s.state)), year_range: yearRange })}
                tableSummary={t('global.charts.table_view.summary')} notFound={notFound}
                nameColumn={dimension('state')}
                categories={series.years}
                series={series.series.map((s) => ({ name: s.state, values: s.values }))}
              />
            </div>
          </State>
          <State label={sample('preset_horizontal_bar')} wide>
            <div className="w-full">
              <ChartCard
                id="specimen-horizontal-bar"
                preset="horizontalBar"
                title={sample('chart_horizontal_title', { year_range: yearRange })}
                note={sample('chart_horizontal_note', { year_range: yearRange })}
                ariaLabel={sample('chart_horizontal_label', { year_range: yearRange })}
                tableSummary={t('global.charts.table_view.summary')} notFound={notFound}
                nameColumn={dimension('state')}
                categories={topStates.map(([state]) => state)}
                series={[{ name: unit('medals'), values: topStates.map(([, n]) => n) }]}
                sort="descending"
                description={sample('chart_horizontal_description', { state: topStates[0][0], count: fmt.number(topStates[0][1]) })}
              />
            </div>
          </State>
          <State label={sample('preset_stacked_horizontal_bar')} wide>
            <div className="w-full">
              <ChartCard
                id="specimen-stacked-horizontal-bar"
                preset="stackedHorizontalBar"
                title={sample('chart_stacked_horizontal_title', { year_range: yearRange })}
                note={sample('chart_stacked_horizontal_note')}
                ariaLabel={sample('chart_stacked_horizontal_label', { year_range: yearRange })}
                tableSummary={t('global.charts.table_view.summary')} notFound={notFound}
                nameColumn={dimension('brewery_key')}
                categories={topBreweries.map((b) => b.brewery)}
                series={medalSeries({ Gold: topBreweries.map((b) => b.record.gold), Silver: topBreweries.map((b) => b.record.silver), Bronze: topBreweries.map((b) => b.record.bronze) })}
                sort="descending"
              />
            </div>
          </State>
          <State label={sample('preset_lollipop')} wide>
            <div className="w-full">
              <ChartCard
                id="specimen-lollipop"
                preset="lollipop"
                title={sample('chart_lollipop_title', { year: YEAR })}
                note={sample('chart_lollipop_note', { year: YEAR })}
                ariaLabel={sample('chart_lollipop_label', { year: YEAR })}
                tableSummary={t('global.charts.table_view.summary')} notFound={notFound}
                nameColumn={dimension('category_name')}
                categories={biggestFields.map((c) => c.name)}
                series={[{ name: unit('entries'), values: biggestFields.map((c) => c.entries) }]}
                sort="descending"
              />
            </div>
          </State>
          <State label={sample('preset_treemap')} wide>
            <div className="w-full">
              <ChartCard
                id="specimen-treemap"
                preset="treemap"
                title={sample('chart_treemap_title', { year_range: yearRange })}
                note={sample('chart_treemap_note')}
                ariaLabel={sample('chart_treemap_label', { year_range: yearRange })}
                tableSummary={t('global.charts.table_view.summary')} notFound={notFound}
                nameColumn={dimension('state')}
                categories={shareStates.map(([state]) => state)}
                series={[{ name: unit('medals'), values: shareStates.map(([, n]) => n) }]}
              />
            </div>
          </State>
          <State label={sample('preset_option')} wide>
            <div className="w-full">
              <ChartCard
                id="specimen-passthrough"
                title={sample('chart_passthrough_title')}
                note={sample('chart_passthrough_note')}
                ariaLabel={sample('chart_passthrough_label', { year_range: yearRange })}
                tableSummary={t('global.charts.table_view.summary')}
                counts
                option={{
                  tooltip: { axisPointer: { type: 'shadow' } },
                  xAxis: { type: 'category', data: completeYears.map(String) },
                  yAxis: { type: 'value' },
                  series: [{ type: 'bar', name: unit('medals'), data: yearTotals }],
                }}
                columns={passthroughColumns}
                rows={passthroughRows}
              />
            </div>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'state-card',
      node: (
        <Specimen name="state-card" title={compName('state_card')}>
          <State label={states('missing')}>
            <div className="w-full"><StateCard kind="empty" title={t('global.states.no_results.title')}>{t('global.states.no_results.remove_hint')}</StateCard></div>
          </State>
          <State label={t('global.states.loading.data')}>
            <div className="w-full"><StateCard kind="loading" title={t('global.states.loading.data')} /></div>
          </State>
          <State label={states('error')}>
            <div className="w-full"><StateCard kind="error" title={t('global.states.errors.data_load')} /></div>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'icon',
      node: (
        <Specimen name="icon" title={compName('icon')}>
          <State label={states('default')} wide>
            <ul className="flex flex-wrap gap-3">
              {ICONS.map((name) => (
                <li key={name} className="flex min-w-20 flex-col items-center gap-1 rounded-(--md-sys-shape-corner-small) bg-surface-container-low px-3 py-2 text-on-surface">
                  <Icon name={name} label={iconLabel(name)} />
                  <span className="type-label-small text-on-surface-variant">{iconLabel(name)}</span>
                </li>
              ))}
            </ul>
          </State>
        </Specimen>
      ),
    },
  ];

  components.push(
    {
      id: 'navigation-rail',
      node: (
        <Specimen name="navigation-rail" title={compName('navigation_rail')}>
          <State label={states('default')}>
            <NavigationRail inline className="flex" label={t('pages.design-system.page.nav_label')} items={navItems.map((i) => ({ ...i, href: `#${i.id}` }))} active={navItems[0].id} />
          </State>
        </Specimen>
      ),
    },
    {
      id: 'navigation-drawer',
      node: (
        <Specimen name="navigation-drawer" title={compName('navigation_drawer')}>
          <State label={states('default')} wide>
            <NavigationDrawer inline className="flex" label={t('pages.design-system.page.nav_label')} title={title} items={navItems.map((i) => ({ ...i, href: `#${i.id}` }))} active={navItems[0].id} />
          </State>
        </Specimen>
      ),
    },
  );

  const beerCard = beerCardData(medalNames);
  const hopCard = hopCardData();
  const varietyTable = existsInRepo('data', 'reference', 'hop-varieties.csv');
  components.push(
    {
      id: 'beer-profile-card',
      node: (
        <Specimen name="beer-profile-card" title={compName('beer_profile_card')} columns="grid-cols-1">
          <State label={states('default')} wide>
            {beerCard ? (
              <div className="flex w-full min-w-0 flex-col gap-3">
                <p className="type-body-medium text-on-surface-variant">{fill(raw('pages.design-system.samples.beer_card'), { beer_name: beerCard.beer })}</p>
                <BeerProfileCard data={beerCard.data} />
              </div>
            ) : <p className="type-body-medium text-on-surface-variant">{t('global.labels.not_found')}</p>}
          </State>
        </Specimen>
      ),
    },
    {
      id: 'spec-card',
      node: (
        <Specimen name="spec-card" title={compName('spec_card')} columns="grid-cols-1">
          <State label={states('default')} wide>
            <SpecCard id="spec-card-sample-card" title={hopCard.name} rows={hopCard.facts.map((f) => ({ label: f.label, value: f.value }))} />
          </State>
        </Specimen>
      ),
    },
    {
      id: 'hop-profile-card',
      node: (
        <Specimen name="hop-profile-card" title={compName('hop_profile_card')} columns="grid-cols-1">
          <State label={states('default')} wide>
            <div className="flex w-full min-w-0 flex-col gap-3">
              <p className="type-body-medium text-on-surface-variant">
                {fill(raw('pages.design-system.samples.hop_card'), { variety: hopCard.name })}
                {varietyTable ? null : ` ${t('pages.design-system.samples.hop_card_gap')}`}
              </p>
              <HopProfileCard data={hopCard} />
            </div>
          </State>
        </Specimen>
      ),
    },
  );

  const colorCols = { role: col('role'), value: col('value') };
  const sections: { id: string; node: ReactNode }[] = [
    {
      id: 'settings',
      node: (
        <Section id="settings" title={sectionTitle('settings')} lead={note('settings')}>
          <SettingsTable caption={sectionTitle('settings')} cols={{ setting: col('setting'), value: col('value') }} />
        </Section>
      ),
    },
    {
      id: 'color',
      node: (
        <Section id="color" title={sectionTitle('color')} lead={note('color')}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))] gap-6">
            {['primary', 'secondary', 'tertiary', 'error', 'surfaces', 'outlines'].map((g) => (
              <div key={g} className="flex min-w-0 flex-col gap-3">
                <h3 className="type-title-medium text-on-surface">{schemeGroup(g)}</h3>
                <SchemeTable group={g} caption={schemeGroup(g)} roleNames={roleNames} cols={colorCols} />
              </div>
            ))}
            <div className="flex min-w-0 flex-col gap-3">
              <h3 className="type-title-medium text-on-surface">{schemeGroup('medals')}</h3>
              <p className="type-body-medium max-w-measure text-on-surface-variant">{note('medals')}</p>
              <MedalTable caption={schemeGroup('medals')} names={roleNames} cols={colorCols} />
              <p className="flex items-center gap-3">{MEDALS.map((m) => <MedalMark key={m} medal={m} title={medalNames[m]} />)}</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <h3 className="type-title-medium text-on-surface">{schemeGroup('contrast')}</h3>
            <ContrastTable
              caption={schemeGroup('contrast')}
              roleNames={roleNames}
              cols={{ role: col('role'), on: col('on'), ratio: col('ratio'), needs: col('needs'), result: col('result'), pass: col('pass'), fail: col('fail') }}
            />
          </div>
        </Section>
      ),
    },
    {
      id: 'type',
      node: (
        <Section id="type" title={sectionTitle('type')} lead={note('type')}>
          <TypeTable
            caption={sectionTitle('type')}
            roleNames={group('pages.design-system.type_scale')}
            sample={sampleBeer ? sampleBeer.beer : t('global.site.identity.name')}
            cols={{ use: col('use'), sample: col('sample'), family: col('family'), size: col('size'), line_height: col('line_height'), weight: col('weight') }}
          />
        </Section>
      ),
    },
    {
      id: 'shape',
      node: (
        <Section id="shape" title={sectionTitle('shape')} lead={note('shape')}>
          <ShapeTable caption={sectionTitle('shape')} names={group('pages.design-system.shape_names')} cols={{ name: col('radius'), value: col('value'), sample: col('sample') }} />
        </Section>
      ),
    },
    {
      id: 'elevation',
      node: (
        <Section id="elevation" title={sectionTitle('elevation')} lead={note('elevation')}>
          <ElevationRow levelLabel={raw('pages.design-system.elevation_levels.level')} />
        </Section>
      ),
    },
    {
      id: 'components',
      node: (
        <Section id="components" title={sectionTitle('components')} lead={note('components')}>
          {/* A feed of component cards that adds columns as the window grows; wide components take a full row. */}
          <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,34rem),1fr))] gap-6">
            <Ordered list="Components" items={components} />
          </div>
        </Section>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        brand={{ text: t('global.site.identity.name'), href: '/' }}
        nav={[]}
        navLabel={t('global.site.header.nav_label')}
        menuLabel={t('global.site.header.menu_button')}
        skipLabel={t('global.site.header.skip_link')}
        skipTarget="#main"
      />
      <AdaptiveNavigation label={t('pages.design-system.page.nav_label')} title={title} items={navItems}>
        <div className="mx-auto flex max-w-(--app-page-max) flex-col gap-4 px-(--app-margin) pt-6 pb-4">
          <Breadcrumb label={t('global.site.header.nav_label')} items={[{ href: '/', text: t('global.site.identity.name') }, { text: title }]} />
          <h1 className="type-display-small text-on-surface">{title}</h1>
          <p className="type-body-large max-w-measure text-on-surface-variant">{t('pages.design-system.page.lede')}</p>
          <p>
            <md-outlined-button href={`${SOURCE_URL}/.design/design-system`}>{t('pages.design-system.page.source_link')}</md-outlined-button>
          </p>
        </div>
        <SectionTabs label={t('pages.design-system.page.nav_label')} items={navItems} />
        <main id="main" className="mx-auto flex max-w-(--app-page-max) flex-col gap-12 px-(--app-margin) py-8">
          <Ordered list="Sections" items={sections} />
        </main>
      </AdaptiveNavigation>
      <ReviewSettingsPanel page="design-system" copy={group('pages.design-system.review_panel')} />
    </>
  );
}
