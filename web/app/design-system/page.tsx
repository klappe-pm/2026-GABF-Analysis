import type { Metadata } from 'next';
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
import { ThemeToggle } from '@/components/ThemeToggle';
import { breweryRecords, categoryIndex, fmt, matchesNothing, oddsFinding, resultYears, results, stateSeries, yearCoverage, yearSummary } from '@/lib/data';
import { sampleBeers, type SampleBeer } from '@/lib/samples';
import { fill, finding, group, lookup, t } from '@/lib/content';
import { contrastRows, token, tokens } from '@/lib/system';
import { SOURCE_URL } from '@/lib/repo';
import { Chip, Specimen, State } from './parts';

export function generateMetadata(): Metadata {
  return {
    title: t('pages.design-system.page.title'),
    description: t('pages.design-system.page.lede'),
  };
}

const raw = (key: string) => lookup(key) as string;
const YEAR = 2026;
const MEDALS: MedalName[] = ['Gold', 'Silver', 'Bronze'];
const ICONS: IconName[] = ['close', 'chevron-down', 'search', 'check', 'menu', 'sort', 'sort-ascending', 'sort-descending'];
const ICON_LABELS: Record<IconName, string> = {
  close: 'Close', 'chevron-down': 'Chevron', search: 'Search', check: 'Check', menu: 'Menu', sort: 'Sort', 'sort-ascending': 'Sort ascending', 'sort-descending': 'Sort descending',
};

const role = (id: string) => t(`pages.design-system.color_roles.${id.replace('semantic.color.', '')}`);

function ColorTable({ ids, caption }: { ids: string[]; caption: string }) {
  const rows = ids.map((id) => {
    const tk = token(id);
    const values = tk.values!;
    return {
      key: id,
      cells: {
        role: role(id),
        light: <span className="inline-flex items-center gap-2"><Chip cssVar={tk.cssVar} theme="light" /><span className="font-sans text-micro">{values.light}</span></span>,
        dark: <span className="inline-flex items-center gap-2"><Chip cssVar={tk.cssVar} theme="dark" /><span className="font-sans text-micro">{values.dark}</span></span>,
      },
    };
  });
  return (
    <RuledTable
      caption={caption}
      scroll={false}
      columns={[
        { key: 'role', label: t('pages.design-system.columns.role') },
        { key: 'light', label: t('pages.design-system.columns.light') },
        { key: 'dark', label: t('pages.design-system.columns.dark') },
      ]}
      rows={rows}
    />
  );
}

const rangeText = (key: 'inside' | 'below' | 'above', min: number, max: number, format: (n: number) => string) => fill(raw(`global.scales.range.${key}`), { min: format(min), max: format(max) });
const verdict = (v: number, min: number, max: number) => (v < min ? 'below' : v > max ? 'above' : 'inside');

// One winning beer with its ABV and IBU placed inside its style's range, as on a scoresheet.
function BeerScales({ idPrefix, sample, medalNames }: { idPrefix: string; sample: SampleBeer; medalNames: Record<MedalName, string> }) {
  const { beer: b, range } = sample;
  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-data text-ink-muted">{fill(raw('pages.design-system.samples.beer'), { beer_name: b.beer, brewery_name: b.brewery, medal: medalNames[b.medal].toLowerCase(), category_name: b.category, year: YEAR })}</p>
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

export default function DesignSystemPage() {
  const sections = ['color', 'type', 'space', 'rules', 'breakpoints', 'components', 'themes'] as const;
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
  const grp = (key: string) => raw(`pages.design-system.groups.${key}`);

  const index = categoryIndex(YEAR);
  const topRecords = breweryRecords().slice(0, 3);
  const lead = topRecords[0];
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

  const navItems = [{ href: '/design-system/', text: title, current: true }];
  const fixedYear = fill(raw('global.filters.chips.fixed_year'), { year: YEAR });
  const mediumChip = fill(raw('global.filters.chips.chip'), { dimension: dimension('medal'), value: medalNames.Gold });
  const searchQuery = 'zzzz';
  const emptyTitle = t('global.states.no_results.title');

  const colorIds = (prefix: string[]) => prefix.map((p) => `semantic.color.${p}`);
  const typeIds = ['h1', 'h2', 'h3', 'figure', 'lead', 'body', 'data', 'label', 'micro'];
  const spaceIds = tokens().filter((x) => x.id.startsWith('space.'));
  const bpIds = tokens().filter((x) => x.id.startsWith('breakpoint.'));
  const fonts = tokens().filter((x) => x.id.startsWith('font.family.'));

  return (
    <>
      <FormHeader
        brand={{ text: t('global.site.identity.name'), href: '/' }}
        nav={navItems}
        navLabel={t('global.site.header.nav_label')}
        menuLabel={t('global.site.header.menu_button')}
        skipLabel={t('global.site.header.skip_link')}
        skipTarget="#main"
        actions={<ThemeToggle darkLabel={t('global.site.header.theme_dark')} lightLabel={t('global.site.header.theme_light')} />}
      />
      <main id="main" className="mx-auto flex max-w-page flex-col gap-7 px-4 py-6">
        <div className="flex flex-col gap-3">
          <Breadcrumb label={t('global.site.header.nav_label')} items={[{ href: '/', text: t('global.site.identity.name') }, { text: title }]} />
          <h1 className="text-h1">{title}</h1>
          <p className="max-w-measure text-lead text-ink-muted">{t('pages.design-system.page.lede')}</p>
          <p className="text-data">
            <TextLink href={`${SOURCE_URL}/.design/design-system`}>{t('pages.design-system.page.source_link')}</TextLink>
          </p>
          <nav aria-label={t('pages.design-system.page.nav_label')} className="border-y border-rule">
            <ul className="flex flex-wrap">
              {sections.map((s) => (
                <li key={s} className="border-r border-rule">
                  <a href={`#${s}`} className="flex px-3 py-2 font-narrow text-label uppercase text-ink state-hover:bg-ground-tone">{t(`pages.design-system.sections.${s}`)}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <section aria-labelledby="color-title" id="color" className="flex flex-col gap-5">
          <SectionHeader id="color-title" title={t('pages.design-system.sections.color')} lead={t('pages.design-system.section_notes.color')} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="text-h3 text-green">{grp('text')}</h3>
              <ColorTable caption={grp('text')} ids={colorIds(['ground', 'ground-tone', 'ink', 'ink-muted', 'ink-faint', 'on-ink'])} />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-h3 text-green">{grp('rules')}</h3>
              <ColorTable caption={grp('rules')} ids={colorIds(['rule', 'rule-strong', 'focus', 'selection'])} />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-h3 text-green">{grp('accents')}</h3>
              <ColorTable caption={grp('accents')} ids={colorIds(['green', 'green-tint', 'red', 'red-tint', 'stamp'])} />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-h3 text-green">{grp('medals')}</h3>
              <p className="max-w-measure text-data text-ink-muted">{t('pages.design-system.section_notes.medals')}</p>
              <ColorTable caption={grp('medals')} ids={colorIds(['gold', 'silver', 'bronze', 'medal-stroke', 'medal-letter'])} />
              <p className="flex items-center gap-3">{MEDALS.map((m) => <MedalMark key={m} medal={m} title={medalNames[m]} />)}</p>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-2">
              <h3 className="text-h3 text-green">{grp('series')}</h3>
              <p className="max-w-measure text-data text-ink-muted">{t('pages.design-system.section_notes.series')}</p>
              <ColorTable caption={grp('series')} ids={colorIds(['series-1', 'series-2', 'series-3', 'series-4', 'series-5'])} />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-h3 text-green">{grp('contrast')}</h3>
            <RuledTable
              caption={grp('contrast')}
              columns={[
                { key: 'theme', label: t('pages.design-system.sections.themes') },
                { key: 'role', label: col('role') },
                { key: 'on', label: col('on') },
                { key: 'ratio', label: col('ratio'), numeric: true },
                { key: 'needs', label: col('needs'), numeric: true },
                { key: 'result', label: col('result') },
              ]}
              rows={contrastRows().map((r) => ({
                key: `${r.theme}-${r.token}-${r.against}`,
                cells: {
                  theme: r.theme === 'light' ? col('light') : col('dark'),
                  role: role(r.token),
                  on: role(r.against),
                  ratio: `${r.ratio}:1`,
                  needs: `${r.min}:1`,
                  result: r.pass ? col('pass') : col('fail'),
                },
              }))}
            />
          </div>
        </section>

        <section aria-labelledby="type-title" id="type" className="flex flex-col gap-5">
          <SectionHeader id="type-title" title={t('pages.design-system.sections.type')} lead={t('pages.design-system.section_notes.type')} />
          <RuledTable
            caption={t('pages.design-system.sections.type')}
            scroll={false}
            columns={[
              { key: 'use', label: col('use') },
              { key: 'sample', label: col('sample') },
              { key: 'size', label: col('size'), numeric: true },
            ]}
            rows={typeIds.map((id) => {
              const tk = token(`type.${id}`);
              const v = tk.value as { fontSize: string };
              return {
                key: id,
                cells: {
                  use: t(`pages.design-system.type_roles.${id}`),
                  sample: <span className={`text-${id} ${id === 'label' || id === 'micro' ? 'uppercase' : ''}`}>{sampleBeer ? sampleBeer.beer : t('global.site.identity.name')}</span>,
                  size: v.fontSize,
                },
              };
            })}
          />
          <RuledTable
            caption={col('family')}
            scroll={false}
            columns={[{ key: 'family', label: col('family') }, { key: 'sample', label: col('sample') }]}
            rows={fonts.map((f) => {
              const stack = f.value as string[];
              return {
                key: f.id,
                cells: {
                  family: stack[0],
                  sample: <span className={f.id.endsWith('narrow') ? 'font-narrow uppercase' : 'font-sans'}>{t('global.site.identity.tagline')}</span>,
                },
              };
            })}
          />
        </section>

        <section aria-labelledby="space-title" id="space" className="flex flex-col gap-5">
          <SectionHeader id="space-title" title={t('pages.design-system.sections.space')} lead={t('pages.design-system.section_notes.space')} />
          <RuledTable
            caption={t('pages.design-system.sections.space')}
            scroll={false}
            columns={[
              { key: 'step', label: col('token') },
              { key: 'value', label: col('value'), numeric: true },
              { key: 'sample', label: col('sample') },
            ]}
            rows={spaceIds.map((s) => ({
              key: s.id,
              cells: {
                step: fill(grp('step'), { number: s.id.split('.')[1] }),
                value: String(s.value),
                sample: <span className="block h-3 border border-green bg-green-tint" style={{ width: `var(${s.cssVar})` }} />,
              },
            }))}
          />
        </section>

        <section aria-labelledby="rules-title" id="rules" className="flex flex-col gap-5">
          <SectionHeader id="rules-title" title={t('pages.design-system.sections.rules')} lead={t('pages.design-system.section_notes.rules')} />
          <RuledTable
            caption={t('pages.design-system.sections.rules')}
            scroll={false}
            columns={[
              { key: 'name', label: col('token') },
              { key: 'value', label: col('value') },
              { key: 'sample', label: col('sample') },
            ]}
            rows={[
              { key: 'hairline', cells: { name: t('pages.design-system.rule_names.hairline'), value: String(token('rule.hairline').value), sample: <span className="block w-full border-t border-rule-strong" /> } },
              { key: 'heavy', cells: { name: t('pages.design-system.rule_names.heavy'), value: String(token('rule.heavy').value), sample: <span className="block w-full border-t-2 border-ink" /> } },
              { key: 'radius', cells: { name: t('pages.design-system.rule_names.radius'), value: t('pages.design-system.rule_names.radius_value'), sample: <span className="block h-4 w-6 border border-ink" /> } },
              { key: 'elevation', cells: { name: t('pages.design-system.rule_names.elevation'), value: t('pages.design-system.rule_names.elevation_value'), sample: <span className="block h-4 w-6 border border-rule bg-ground-tone" /> } },
            ]}
          />
        </section>

        <section aria-labelledby="breakpoints-title" id="breakpoints" className="flex flex-col gap-5">
          <SectionHeader id="breakpoints-title" title={t('pages.design-system.sections.breakpoints')} lead={t('pages.design-system.section_notes.breakpoints')} />
          <RuledTable
            caption={t('pages.design-system.sections.breakpoints')}
            scroll={false}
            columns={[
              { key: 'step', label: col('token') },
              { key: 'width', label: col('width'), numeric: true },
              { key: 'note', label: col('use') },
            ]}
            rows={bpIds.map((b, i) => ({
              key: b.id,
              cells: { step: fill(grp('step'), { number: i + 1 }), width: String(b.value), note: grp('breakpoint_note') },
            }))}
          />
        </section>

        <section aria-labelledby="components-title" id="components" className="flex flex-col gap-3">
          <SectionHeader id="components-title" title={t('pages.design-system.sections.components')} />

          <Specimen name="form-header" title={compName('form_header')} specLink={t('pages.design-system.page.spec_link')} columns="grid-cols-1">
            <State label={states('default')} wide>
              <div className="w-full">
                <FormHeader
                  menuId="specimen-menu"
                  brand={{ text: t('global.site.identity.name'), href: '#component-form-header' }}
                  nav={[
                    { href: '#component-form-header', text: t('global.navigation.header.results'), current: true },
                    { href: '#component-form-header', text: t('global.navigation.header.breweries') },
                    { href: '#component-form-header', text: t('global.navigation.header.beers') },
                    { href: '#component-form-header', text: t('global.navigation.header.analysis') },
                  ]}
                  navLabel={t('global.site.header.nav_label')}
                  menuLabel={t('global.site.header.menu_button')}
                  skipLabel={t('global.site.header.skip_link')}
                  skipTarget="#component-form-header"
                />
              </div>
            </State>
          </Specimen>

          <Specimen name="breadcrumb" title={compName('breadcrumb')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')}>
              <Breadcrumb label={t('global.site.header.nav_label')} items={[{ href: '#component-breadcrumb', text: t('global.navigation.breadcrumbs.all_results') }, { text: fill(raw('global.navigation.breadcrumbs.category_number'), { number: index[0].number }) }]} />
            </State>
          </Specimen>

          <Specimen name="section-header" title={compName('section_header')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')}>
              <div className="w-full"><SectionHeader id="specimen-section" level={3} title={fill(raw('pages.home.category_index.title'), { year: YEAR })} lead={t('pages.home.category_index.note')} /></div>
            </State>
          </Specimen>

          <Specimen name="form-field" title={compName('form_field')} specLink={t('pages.design-system.page.spec_link')} columns="grid-cols-1">
            <State label={states('value')} wide>
              <div className="w-full">
                <FieldGrid label={compName('form_field')}>
                  <Field number="01" label={t('pages.home.scoresheet.competition_year')} size="text">{fill(raw('pages.home.scoresheet.competition_value'), { year: YEAR })}</Field>
                  <Field number="02" label={t('pages.home.scoresheet.entries_judged')}>{summary?.entries ? fmt.number(summary.entries) : t('pages.home.scoresheet.not_published')}</Field>
                  <Field number="03" label={t('pages.home.scoresheet.categories')}>{summary?.categories ? fmt.number(summary.categories) : t('pages.home.scoresheet.not_published')}</Field>
                  <Field number="04" label={t('pages.home.scoresheet.medals_awarded')}>{summary?.medals ? fmt.number(summary.medals) : t('pages.home.scoresheet.not_published')}</Field>
                </FieldGrid>
              </div>
            </State>
          </Specimen>

          <Specimen name="ruled-table" title={compName('ruled_table')} specLink={t('pages.design-system.page.spec_link')} columns="grid-cols-1">
            <State label={states('default')} wide>
              <div className="w-full">
                <p className="pb-2 text-data text-ink-muted">{fill(raw('pages.design-system.samples.category_index'), { year: YEAR })}</p>
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

          <Specimen name="medal-mark" title={compName('medal_mark')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')}>
              {MEDALS.map((m) => <MedalMark key={m} medal={m} title={medalNames[m]} />)}
            </State>
            <State label={states('tally')}>
              {MEDALS.map((m) => <MedalMark key={m} medal={m} size="sm" label={false} title={medalNames[m]} />)}
            </State>
          </Specimen>

          <Specimen name="medal-record" title={compName('medal_record')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')} wide>
              <p className="text-data text-ink-muted">{fill(raw('pages.design-system.samples.medal_record'), { brewery_name: lead.brewery, city: lead.city, state: lead.state, year_range: `${completeYears[0]} to ${completeYears[completeYears.length - 1]}` })}</p>
            </State>
            <State label={states('split')}>
              <MedalRecord counts={lead.record} names={medalNames} />
            </State>
            <State label={states('tally')}>
              <MedalRecord counts={lead.record} names={medalNames} variant="tally" />
            </State>
            <State label={states('value')}>
              <MedalRecord counts={lead.record} names={medalNames} variant="value" />
            </State>
          </Specimen>

          <Specimen name="range-scale" title={compName('range_scale')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('inside')}>
              <BeerScales idPrefix="inside" sample={samples.inside} medalNames={medalNames} />
            </State>
            {samples.outside ? (
              <State label={states('outside')}>
                <BeerScales idPrefix="outside" sample={samples.outside} medalNames={medalNames} />
              </State>
            ) : null}
          </Specimen>

          <Specimen name="red-pen-note" title={compName('red_pen_note')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')} wide>
              <RedPenNote label={t('pages.home.finding.label')} link={{ href: '#component-red-pen-note', text: t('pages.home.finding.link') }}>{headline}</RedPenNote>
            </State>
          </Specimen>

          <Specimen name="status-stamp" title={compName('status_stamp')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={t('global.labels.coverage.partial')}>
              <StatusStamp label={t('global.labels.coverage.partial')} meaning={t('global.labels.coverage_meaning.partial')} />
            </State>
            <State label={t('global.labels.coverage.pending')}>
              <StatusStamp label={t('global.labels.coverage.pending')} meaning={t('global.labels.coverage_meaning.pending')} />
            </State>
            <State label={t('global.states.estimates.short')}>
              <StatusStamp label={t('global.states.estimates.short')} />
            </State>
          </Specimen>

          <Specimen name="filters-sheet" title={compName('filters_sheet')} specLink={t('pages.design-system.page.spec_link')} columns="grid-cols-1">
            <State label={states('default')}>
              <FiltersSheet copy={filtersCopy} groups={filterGroups} />
            </State>
            <State label={states('open')} wide>
              <div className="w-full max-w-sheet"><FiltersForm idPrefix="specimen-filters" copy={filtersCopy} groups={filterGroups} /></div>
            </State>
          </Specimen>

          <Specimen name="active-filters" title={compName('active_filters')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')} wide>
              <ActiveFilters
                label={t('global.filters.chips.bar_label')}
                clearLabel={t('global.filters.chips.clear_all')}
                entries={[
                  { text: fixedYear, fixedNote: t('global.filters.chips.fixed_tooltip') },
                  { text: mediumChip, removeLabel: fill(raw('global.filters.chips.remove_label'), { chip: mediumChip }) },
                ]}
              />
            </State>
          </Specimen>

          <Specimen name="button" title={compName('button')} specLink={t('pages.design-system.page.spec_link')}>
            {(['primary', 'secondary', 'quiet'] as const).map((v) => (
              <State key={v} label={`${v === 'primary' ? t('global.filters.panel.apply') : v === 'secondary' ? t('global.filters.panel.reset') : t('global.filters.panel.close')}`}>
                <Button variant={v}>{v === 'primary' ? t('global.filters.panel.apply') : v === 'secondary' ? t('global.filters.panel.reset') : t('global.filters.panel.close')}</Button>
                <Button variant={v} state="hover">{states('hover')}</Button>
                <Button variant={v} state="focus">{states('focus')}</Button>
                <Button variant={v} disabled>{states('disabled')}</Button>
              </State>
            ))}
            <State label={states('busy')}>
              <Button variant="primary" busy busyLabel={t('global.filters.panel.loading')}>{t('global.filters.panel.apply')}</Button>
            </State>
          </Specimen>

          <Specimen name="text-link" title={compName('text_link')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')}><TextLink href="#component-text-link">{t('global.navigation.footer.method')}</TextLink></State>
            <State label={states('hover')}><TextLink href="#component-text-link" state="hover">{t('global.navigation.footer.method')}</TextLink></State>
            <State label={states('focus')}><TextLink href="#component-text-link" state="focus">{t('global.navigation.footer.method')}</TextLink></State>
          </Specimen>

          <Specimen name="select" title={compName('select')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')}>
              <div className="w-full max-w-sheet"><Select id="specimen-year" number="01" label={dimension('year')} options={[all, ...resultYears().reverse().map((y) => ({ value: String(y), label: String(y) }))]} /></div>
            </State>
            <State label={states('focus')}>
              <div className="w-full max-w-sheet"><Select id="specimen-year-focus" number="02" label={dimension('year')} state="focus" options={[all, { value: String(YEAR), label: String(YEAR) }]} /></div>
            </State>
            <State label={states('disabled')}>
              <div className="w-full max-w-sheet"><Select id="specimen-year-disabled" number="03" label={dimension('year')} disabled options={[all]} /></div>
            </State>
          </Specimen>

          <Specimen name="checkbox" title={compName('checkbox')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')}><Checkbox id="specimen-partial" label={filtersCopy.partialLabel} hint={filtersCopy.partialNote} /></State>
            <State label={states('checked')}><Checkbox id="specimen-partial-checked" label={filtersCopy.partialLabel} defaultChecked /></State>
            <State label={states('disabled')}><Checkbox id="specimen-partial-disabled" label={filtersCopy.partialLabel} disabled /></State>
          </Specimen>

          <Specimen name="search-field" title={compName('search_field')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')}>
              <div className="w-full max-w-sheet"><SearchField id="specimen-search" number="01" label={t('pages.home.search.label')} placeholder={t('pages.home.search.placeholder')} /></div>
            </State>
            <State label={states('error')}>
              <div className="w-full max-w-sheet">
                <SearchField
                  id="specimen-search-error"
                  number="02"
                  label={t('pages.home.search.label')}
                  placeholder={t('pages.home.search.placeholder')}
                  defaultValue={searchQuery}
                  error={matchesNothing(searchQuery) ? fill(raw('pages.home.search.no_match'), { query: searchQuery }) : undefined}
                />
              </div>
            </State>
            <State label={states('disabled')}>
              <div className="w-full max-w-sheet"><SearchField id="specimen-search-disabled" number="03" label={t('pages.home.search.label')} placeholder={t('pages.home.search.placeholder')} disabled /></div>
            </State>
          </Specimen>

          <Specimen name="estimate-popover" title={compName('estimate_popover')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')} wide>
              <div className="text-body">
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

          <Specimen name="chart-frame" title={compName('chart_frame')} specLink={t('pages.design-system.page.spec_link')} columns="grid-cols-1">
            <State label={states('default')} wide>
              <div className="w-full">
                <ChartFrame
                  id="specimen-chart"
                  title={fill(raw('pages.design-system.samples.chart_title'), { year_range: `${series.years[0]} to ${series.years[series.years.length - 1]}` })}
                  note={t('pages.design-system.samples.chart_note')}
                  categories={series.years}
                  series={series.series.map((s) => ({ name: s.state, values: s.values }))}
                  tableSummary={t('global.charts.table_view.summary')}
                  nameColumn={t('global.charts.table_columns.name')}
                  ariaLabel={fill(raw('pages.design-system.samples.chart_label'), { states: fmt.years(series.series.map((s) => s.state)), year_range: `${series.years[0]} to ${series.years[series.years.length - 1]}` })}
                />
              </div>
            </State>
          </Specimen>

          <Specimen name="form-note" title={compName('form_note')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('missing')}>
              <div className="w-full">
                <FormNote kind="empty" title={emptyTitle}>{t('global.states.no_results.remove_hint')}</FormNote>
              </div>
            </State>
            <State label={t('global.states.loading.data')}>
              <div className="w-full"><FormNote kind="loading" title={t('global.states.loading.data')} /></div>
            </State>
            <State label={states('error')}>
              <div className="w-full"><FormNote kind="error" title={t('global.states.errors.data_load')} /></div>
            </State>
          </Specimen>

          <Specimen name="theme-toggle" title={compName('theme_toggle')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')}>
              <ThemeToggle darkLabel={t('global.site.header.theme_dark')} lightLabel={t('global.site.header.theme_light')} />
            </State>
          </Specimen>

          <Specimen name="icon" title={compName('icon')} specLink={t('pages.design-system.page.spec_link')}>
            <State label={states('default')} wide>
              <ul className="flex flex-wrap gap-4">
                {ICONS.map((name) => (
                  <li key={name} className="flex flex-col items-center gap-1 border border-rule px-3 py-2">
                    <Icon name={name} className="size-5" label={ICON_LABELS[name]} />
                    <span className="font-narrow text-micro text-ink-muted">{ICON_LABELS[name]}</span>
                  </li>
                ))}
              </ul>
            </State>
          </Specimen>
        </section>

        <section aria-labelledby="themes-title" id="themes" className="flex flex-col gap-5">
          <SectionHeader id="themes-title" title={t('pages.design-system.sections.themes')} lead={t('pages.design-system.section_notes.themes')} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {(['light', 'dark'] as const).map((theme) => (
              <div key={theme} data-theme={theme} className="flex flex-col gap-4 border border-rule-strong bg-ground p-4 text-ink">
                <p className="font-narrow text-label uppercase text-ink-muted">{theme === 'light' ? col('light') : col('dark')}</p>
                <RedPenNote label={t('pages.home.finding.label')}>{headline}</RedPenNote>
                <FieldGrid label={compName('form_field')} columns="sm:grid-cols-2">
                  <Field number="01" label={t('pages.home.scoresheet.entries_judged')}>{summary?.entries ? fmt.number(summary.entries) : t('pages.home.scoresheet.not_published')}</Field>
                  <Field number="02" label={t('pages.home.scoresheet.medals_awarded')}>{summary?.medals ? fmt.number(summary.medals) : t('pages.home.scoresheet.not_published')}</Field>
                </FieldGrid>
                <div className="flex flex-wrap items-center gap-3">
                  {topRecords[0] ? <MedalRecord counts={topRecords[0].record} names={medalNames} /> : null}
                  <StatusStamp label={t('global.labels.coverage.partial')} />
                  <Button variant="primary">{t('global.filters.panel.apply')}</Button>
                  <Button variant="secondary">{t('global.filters.panel.reset')}</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
