// The breweries index at /breweries/, the same address as the current site: every brewery with medals,
// ranked by points, searchable and narrowed by the global filter.
import type { Metadata } from 'next';
import { group, lookup, t } from '@/lib/content';
import { applyFilters } from '@/lib/filter-model.mjs';
import { paths } from '@/lib/href';
import type { MedalLine } from './aggregate';
import { aggregate } from './aggregate';
import { BreweriesTable, type IndexCopy } from './BreweriesTable';
import { estimateCopy } from './copy';
import { laneModel } from '@/lib/site-data';
import { pageMetadata } from '@/lib/seo';
import type { breweriesIndex as IndexLoader } from '@/lib/models/breweries.mjs';

type Model = { breweriesIndex: typeof IndexLoader };
const raw = (key: string) => lookup(key) as string;
const page = (key: string) => `pages.breweries-index.${key}`;

export const metadata: Metadata = pageMetadata({
  title: t('global.navigation.page_titles.breweries_index'),
  description: t('global.navigation.page_descriptions.breweries_index'),
  path: paths.breweries,
});

export default async function BreweriesPage() {
  const { rows, info } = (await laneModel<Model>('breweries')).breweriesIndex();
  // The ranking under the default selection (complete years), so the built page is whole.
  const initial = aggregate(applyFilters(rows as unknown as Record<string, unknown>[], {}) as unknown as MedalLine[]);
  const columns = group('global.tables.brewery_columns');
  const copy: IndexCopy = {
    caption: t(page('table.caption')),
    sortHint: t('global.tables.sorting.hint'),
    columns: { brewery: columns.brewery, hq: columns.hq, type: columns.type, medals: columns.medals, split: columns.medal_split, points: columns.points, first: columns.first, latest: columns.latest, ownership: columns.ownership, arr: columns.arr },
    deepDive: t(page('table.deep_dive_pill')),
    count: raw(page('table.count')),
    countOne: t(page('table.count_one')),
    searchLabel: t(page('table.search_label')),
    searchPlaceholder: t(page('table.search_placeholder')),
    notDefined: t('global.states.gaps.not_defined'),
    methodLink: t(page('table.method_link')),
    mark: t('global.states.estimates.marker'),
    medalNames: group('global.labels.medal') as IndexCopy['medalNames'],
    types: group('global.labels.brewery_type'),
    ownership: group('global.labels.ownership_type'),
    loading: t('global.states.loading.data'),
    emptyTitle: t('global.states.no_results.title'),
    emptyHint: t('global.states.no_results.remove_hint'),
    estimate: estimateCopy(),
  };
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-6 px-(--app-margin) py-8">
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{t(page('header.title'))}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{t(page('header.lede'))}</p>
      </header>
      <BreweriesTable info={info} initial={initial} copy={copy} />
    </main>
  );
}
