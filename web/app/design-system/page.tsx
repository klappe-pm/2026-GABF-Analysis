import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ActiveFilters } from '@/components/ActiveFilters';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/Button';
import { ChartFrame } from '@/components/ChartFrame';
import { Checkbox } from '@/components/Checkbox';
import { EstimatePopover } from '@/components/EstimatePopover';
import { Field, FieldGrid } from '@/components/FormField';
import { FiltersForm, FiltersSheet, type FilterGroup, type FiltersCopy } from '@/components/FiltersSheet';
import { FormHeader } from '@/components/FormHeader';
import { FormNote } from '@/components/FormNote';
import { Icon, type IconName } from '@/components/Icon';
import { MedalMark, type MedalName } from '@/components/MedalMark';
import { MedalRecord } from '@/components/MedalRecord';
import { RangeScale } from '@/components/RangeScale';
import { RedPenNote } from '@/components/RedPenNote';
import { RuledTable } from '@/components/RuledTable';
import { SearchField } from '@/components/SearchField';
import { SectionHeader } from '@/components/SectionHeader';
import { Select } from '@/components/Select';
import { StatusStamp } from '@/components/StatusStamp';
import { TextLink } from '@/components/TextLink';
import { breweryRecords, categoryIndex, fmt, matchesNothing, oddsFinding, resultYears, results, stateSeries, yearCoverage, yearSummary } from '@/lib/data';
import { sampleBeers, type SampleBeer } from '@/lib/samples';
import { fill, finding, group, lookup, t } from '@/lib/content';
import { SOURCE_URL } from '@/lib/repo';
import { ContrastTable, ElevationRow, MedalTable, Ordered, SchemeTable, SectionTabs, SettingsTable, ShapeTable, TypeTable } from './live';
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
const ICONS: IconName[] = ['close', 'chevron-down', 'search', 'check', 'menu', 'filter', 'sort', 'sort-ascending', 'sort-descending'];
const ICON_LABELS: Record<IconName, string> = {
  close: 'Close', 'chevron-down': 'Chevron', search: 'Search', check: 'Check', menu: 'Menu', filter: 'Filter', sort: 'Sort', 'sort-ascending': 'Sort ascending', 'sort-descending': 'Sort descending',
};

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
          label="IBU"
          value={b.ibu}
          valueText={String(b.ibu)}
          range={{ min: range.ibuMin, max: range.ibuMax, minText: String(range.ibuMin), maxText: String(range.ibuMax) }}
          summary={rangeText(verdict(b.ibu, range.ibuMin, range.ibuMax), range.ibuMin, range.ibuMax, String)}
        />
      ) : null}
    </div>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="flex scroll-mt-16 flex-col gap-5">
      <SectionHeader id={`${id}-title`} title={title} lead={lead} />
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
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
  const yearRange = `${series.years[0]} to ${series.years[series.years.length - 1]}`;
  const SECTION_IDS = ['settings', 'color', 'type', 'shape', 'elevation', 'components'];

  const components: { id: string; node: ReactNode }[] = [
    {
      id: 'form-header',
      node: (
        <Specimen name="form-header" title={compName('form_header')} columns="grid-cols-1">
          <State label={states('default')} wide>
            <div className="w-full">
              <FormHeader
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
      id: 'form-field',
      node: (
        <Specimen name="form-field" title={compName('form_field')} columns="grid-cols-1">
          <State label={states('value')} wide>
            <div className="w-full">
              <FieldGrid label={compName('form_field')}>
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
      id: 'ruled-table',
      node: (
        <Specimen name="ruled-table" title={compName('ruled_table')} columns="grid-cols-1">
          <State label={states('default')} wide>
            <div className="w-full">
              <p className="type-body-medium pb-2 text-on-surface-variant">{fill(raw('pages.design-system.samples.category_index'), { year: YEAR })}</p>
              <RuledTable
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
            <p className="type-body-medium text-on-surface-variant">{fill(raw('pages.design-system.samples.medal_record'), { brewery_name: lead.brewery, city: lead.city, state: lead.state, year_range: `${completeYears[0]} to ${completeYears[completeYears.length - 1]}` })}</p>
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
      id: 'red-pen-note',
      node: (
        <Specimen name="red-pen-note" title={compName('red_pen_note')}>
          <State label={states('default')} wide>
            <RedPenNote label={t('pages.home.finding.label')} link={{ href: '#component-red-pen-note', text: t('pages.home.finding.link') }}>{headline}</RedPenNote>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'status-stamp',
      node: (
        <Specimen name="status-stamp" title={compName('status_stamp')}>
          <State label={t('global.labels.coverage.partial')}><StatusStamp label={t('global.labels.coverage.partial')} meaning={t('global.labels.coverage_meaning.partial')} /></State>
          <State label={t('global.labels.coverage.pending')}><StatusStamp label={t('global.labels.coverage.pending')} meaning={t('global.labels.coverage_meaning.pending')} /></State>
          <State label={t('global.states.estimates.short')}><StatusStamp label={t('global.states.estimates.short')} /></State>
        </Specimen>
      ),
    },
    {
      id: 'filters-sheet',
      node: (
        <Specimen name="filters-sheet" title={compName('filters_sheet')} columns="grid-cols-1">
          <State label={states('default')}><FiltersSheet copy={filtersCopy} groups={filterGroups} /></State>
          <State label={states('open')} wide><div className="w-full"><FiltersForm idPrefix="specimen-filters" copy={filtersCopy} groups={filterGroups} /></div></State>
        </Specimen>
      ),
    },
    {
      id: 'active-filters',
      node: (
        <Specimen name="active-filters" title={compName('active_filters')}>
          <State label={states('default')} wide>
            <ActiveFilters
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
      id: 'estimate-popover',
      node: (
        <Specimen name="estimate-popover" title={compName('estimate_popover')}>
          <State label={states('default')} wide>
            <div className="type-body-large">
              {t('global.states.estimates.short')}
              {' '}
              <EstimatePopover
                id="specimen-estimate"
                marker={t('global.states.estimates.marker')}
                label={t('global.states.estimates.short')}
                explanation={t('global.states.estimates.explanation')}
                link={{ href: '#component-estimate-popover', text: t('global.navigation.footer.method') }}
              />
            </div>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'chart-frame',
      node: (
        <Specimen name="chart-frame" title={compName('chart_frame')} columns="grid-cols-1">
          <State label={states('default')} wide>
            <div className="w-full">
              <ChartFrame
                id="specimen-chart"
                title={fill(raw('pages.design-system.samples.chart_title'), { year_range: yearRange })}
                note={t('pages.design-system.samples.chart_note')}
                categories={series.years}
                series={series.series.map((s) => ({ name: s.state, values: s.values }))}
                tableSummary={t('global.charts.table_view.summary')}
                nameColumn={t('global.charts.table_columns.name')}
                ariaLabel={fill(raw('pages.design-system.samples.chart_label'), { states: fmt.years(series.series.map((s) => s.state)), year_range: yearRange })}
              />
            </div>
          </State>
        </Specimen>
      ),
    },
    {
      id: 'form-note',
      node: (
        <Specimen name="form-note" title={compName('form_note')}>
          <State label={states('missing')}>
            <div className="w-full"><FormNote kind="empty" title={t('global.states.no_results.title')}>{t('global.states.no_results.remove_hint')}</FormNote></div>
          </State>
          <State label={t('global.states.loading.data')}>
            <div className="w-full"><FormNote kind="loading" title={t('global.states.loading.data')} /></div>
          </State>
          <State label={states('error')}>
            <div className="w-full"><FormNote kind="error" title={t('global.states.errors.data_load')} /></div>
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
                  <Icon name={name} label={ICON_LABELS[name]} />
                  <span className="type-label-small text-on-surface-variant">{ICON_LABELS[name]}</span>
                </li>
              ))}
            </ul>
          </State>
        </Specimen>
      ),
    },
  ];

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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
          <div className="flex min-w-0 flex-col gap-3">
            <Ordered list="Components" items={components} />
          </div>
        </Section>
      ),
    },
  ];

  return (
    <>
      <FormHeader
        brand={{ text: t('global.site.identity.name'), href: '/' }}
        nav={[]}
        navLabel={t('global.site.header.nav_label')}
        menuLabel={t('global.site.header.menu_button')}
        skipLabel={t('global.site.header.skip_link')}
        skipTarget="#main"
      />
      <div className="mx-auto flex max-w-page flex-col gap-4 px-4 pt-6 pb-4">
        <Breadcrumb label={t('global.site.header.nav_label')} items={[{ href: '/', text: t('global.site.identity.name') }, { text: title }]} />
        <h1 className="type-display-small text-on-surface">{title}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{t('pages.design-system.page.lede')}</p>
        <p>
          <md-outlined-button href={`${SOURCE_URL}/.design/design-system`}>{t('pages.design-system.page.source_link')}</md-outlined-button>
        </p>
      </div>
      <SectionTabs label={t('pages.design-system.page.nav_label')} items={SECTION_IDS.map((id) => ({ id, text: sectionTitle(id) }))} />
      <main id="main" className="mx-auto flex max-w-page flex-col gap-12 px-4 py-8">
        <Ordered list="Sections" items={sections} />
      </main>
    </>
  );
}
