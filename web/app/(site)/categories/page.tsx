// The categories index at /categories/, the same address as the current site: every category in the record,
// the style family chart, and a table of categories with medals in view. The view follows the global filter.
import type { Metadata } from 'next';
import { StateCard } from '@/components/StateCard';
import { fill, t } from '@/lib/content';
import { paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { analysis, firstComplete, labelGroup, MAIN, raw, viewCopy } from '@/app/(site)/analysis/parts/copy';
import { CategoriesView, type CategoriesCopy } from './CategoriesView';

const page = (key: string) => `pages.results-by-category.${key}`;

export function generateMetadata(): Metadata {
  return pageMetadata({ title: t('global.navigation.page_titles.results_by_category'), description: t('global.navigation.page_descriptions.results_by_category'), path: paths.categories });
}

export default async function CategoriesPage() {
  const model = await analysis();
  const count = model.categoryCount();
  const types = labelGroup('category_type');
  const copy: CategoriesCopy = {
    view: viewCopy(),
    chart: { title: t(page('chart.title')), subtitle: t(page('chart.subtitle')), valueName: t('global.charts.units.medals'), labelHeader: t('global.tables.category_columns.style_family'), tableSummary: t('global.charts.table_view.summary') },
    table: {
      title: t(page('table.title')),
      count: raw(page('table.count')),
      caption: t(page('table.title')),
      sortHint: t('global.tables.sorting.hint'),
      sectionId: 'all-categories',
      abvValue: raw('global.tables.category_columns.abv_value'),
      columns: {
        category: t('global.tables.category_columns.category'),
        type: t('global.tables.category_columns.type'),
        family: t('global.tables.category_columns.style_family'),
        abv: t('global.tables.category_columns.abv'),
        latest: t('global.tables.category_columns.latest_entrants'),
        medals: t('global.tables.category_columns.medals_in_view'),
        years: t('global.tables.category_columns.years'),
      },
    },
    types: { classic: types.classic, special: types.special },
    families: labelGroup('style_family'),
  };
  return (
    <main id="main" tabIndex={-1} className={MAIN}>
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{t(page('header.title'))}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{fill(raw(page('header.lede')), { count: count.total, special_count: count.special, classic_count: count.classic })}</p>
      </header>
      <StateCard kind="notice" title={t(page('classic_and_special.title'))}>
        <p>{t(page('classic_and_special.special'))}</p>
        <p className="mt-2">{t(page('classic_and_special.families'))}</p>
      </StateCard>
      <CategoriesView rows={model.categoryRows()} copy={copy} firstCompleteYear={await firstComplete()} />
    </main>
  );
}
