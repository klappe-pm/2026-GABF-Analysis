// A category at /categories/<category>/, the same address as the current site: its style definition and ranges,
// the entrants by year, and every medalist. The definition is build time data; the rest follows the global filter.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { RangeScale } from '@/components/RangeScale';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { fill, t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { staticParams } from '@/lib/site-data';
import type { CategoryRecord, Range } from '@/lib/models/analysis.mjs';
import { analysis, firstComplete, labelGroup, MAIN, raw, viewCopy } from '@/app/(site)/analysis/parts/copy';
import { Moved, movedMetadata } from '@/app/(site)/analysis/parts/moved';
import { CategoryView, type CategoryCopy } from './CategoryView';

type Params = { slug: string };

export const dynamicParams = false;
export async function generateStaticParams(): Promise<Params[]> {
  const old = (await analysis()).legacyCategoryParams();
  return [...(await staticParams.categories()), ...old];
}

// A category whose address changed when the word Style left the names: the page holds a redirect to the new one.
const moved = async (slug: string) => (await analysis()).legacyCategory(slug);

const page = (key: string) => `pages.category-detail.${key}`;

async function record(params: Promise<Params>): Promise<CategoryRecord> {
  const c = (await analysis()).category((await params).slug);
  if (!c) notFound();
  return c;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const old = await moved((await params).slug);
  if (old) return movedMetadata(paths.category(old.slug), old.name);
  const c = await record(params);
  return pageMetadata({
    title: fill(raw('global.navigation.page_titles.category_detail'), { category_name: c.name }),
    description: fill(raw('global.navigation.page_descriptions.category_detail'), { category_name: c.name }),
    path: paths.category(c.slug),
  });
}

function scale(id: string, label: string, range: Range | null, summary: string, unit = '') {
  if (!range) return null;
  const min = Number(range.min);
  const max = Number(range.max);
  return (
    <RangeScale key={id} id={id} label={label} value={null} valueText={`${range.min} to ${range.max}${unit}`} range={{ min, max, minText: `${range.min}${unit}`, maxText: `${range.max}${unit}` }} summary={summary} />
  );
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const old = await moved((await params).slug);
  if (old) return <Moved to={paths.category(old.slug)} pageTitle={old.name} />;
  const c = await record(params);
  const types = labelGroup('category_type');
  const families = labelGroup('style_family');
  const view = viewCopy();
  const copy: CategoryCopy = {
    view: { ...view, emptyScope: t(page('empty.page')) },
    fixedCategory: fill(raw('global.filters.chips.fixed_category'), { category_name: c.name }),
    entrants: { title: t(page('entrants.title')), subtitle: t(page('entrants.subtitle')), series: t(page('entrants.series')), oneYear: raw(page('entrants.one_year')), none: t(page('entrants.none')), tableSummary: t('global.charts.table_view.summary'), sectionId: 'entrants' },
    medalists: { title: t(page('medalists.title')), sectionId: 'medalists-by-year', yearHeading: raw(page('medalists.year_heading')), yearNumber: raw(page('medalists.year_heading_number')), yearEntrants: raw(page('medalists.year_heading_entrants')), sortHint: t('global.tables.sorting.hint') },
    columns: {
      medal: t('global.tables.medal_columns.medal'),
      beer: t('global.tables.medal_columns.beer'),
      abv: t('global.tables.medal_columns.abv'),
      ibu: t('pages.beers-index.table.ibu'),
      hops: t('pages.beers-index.table.hops'),
      brewery: t('global.tables.medal_columns.brewery'),
      city: t('global.tables.medal_columns.city'),
    },
  };
  const source = c.source
    ? fill(raw(c.confidence ? page('definition.source_with_confidence') : page('definition.source')), { source: c.source, confidence: c.confidence ?? '' })
    : null;
  const facts = [
    c.special ? types.special : types.classic,
    families[c.styleFamily] ?? c.styleFamily,
    c.latestEntries && c.latestEntriesYear ? fill(raw(page('pills.entrants')), { count: c.latestEntries.toLocaleString('en-US'), year: c.latestEntriesYear }) : null,
  ].filter(Boolean);
  const scales = [
    scale('scale-abv', t(page('ranges.abv')), c.abv, c.abv ? fill(raw(page('pills.abv')), c.abv) : '', '%'),
    scale('scale-ibu', t(page('ranges.ibu')), c.ibu, c.ibu ? fill(raw(page('pills.ibu')), c.ibu) : ''),
    scale('scale-srm', t(page('ranges.srm')), c.srm, c.srm ? fill(raw(page('pills.srm')), c.srm) : ''),
  ].filter(Boolean);
  return (
    <main id="main" tabIndex={-1} className={MAIN}>
      <header className="flex flex-col gap-3">
        <Breadcrumb label={t('global.navigation.breadcrumbs.all_categories')} items={[{ href: href(paths.categories), text: t(page('links.back')) }, { text: c.name }]} />
        <h1 className="type-display-small text-on-surface">{c.name}</h1>
        <p className="type-body-large text-on-surface-variant">{facts.join(' · ')}</p>
        <p className="type-body-large"><TextLink href={`${href(paths.dashboards)}categories/#category_name=${encodeURIComponent(c.name)}`}>{t(page('links.chart_this'))}</TextLink></p>
      </header>
      <StateCard kind="notice" title={t(page('definition.title'))}>
        <div className="flex flex-col gap-4">
          <p>{c.description ?? t('global.labels.not_found')}</p>
          {scales.length ? <div className="grid gap-6 pt-2 medium:grid-cols-3">{scales}</div> : null}
          <p className="type-body-small">
            {c.special ? t(page('definition.special_note')) : t(page('definition.classic_note'))}
            {source ? ` ${source}` : ''}
            {c.variant ? ` ${fill(raw(page('definition.variant')), { variant_name: c.variant })}` : ''}
          </p>
        </div>
      </StateCard>
      <CategoryView name={c.name} rows={c.rows} copy={copy} firstCompleteYear={await firstComplete()} />
    </main>
  );
}
