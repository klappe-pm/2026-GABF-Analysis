// The reference port: the winners list of a year at /beers/2026/, the same address as the current site.
// Page agents copy this file's shape: static params from lib/site-data, metadata from lib/seo, every
// word from the copy documents, rows sliced on the server, and a client view that follows the filter.
import type { Metadata } from 'next';
import { TextLink } from '@/components/TextLink';
import { fill, group, lookup, t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { WINNER_YEAR, winners } from '@/lib/site-data';
import { winnerRows } from '../../hops/data';
import { WinnersTable, type WinnersCopy } from './WinnersTable';

type Params = { year: string };

export const dynamicParams = false;
export function generateStaticParams(): Params[] {
  return [{ year: String(WINNER_YEAR) }];
}

const raw = (key: string) => lookup(key) as string;
const page = (key: string) => `pages.beers-index.${key}`;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const year = Number((await params).year);
  const rows = await winners(year);
  return pageMetadata({
    title: fill(raw('global.navigation.page_titles.beers_index'), { year }),
    description: fill(raw('global.navigation.page_descriptions.beers_index'), { year, count: rows.length }),
    path: paths.winners(year),
  });
}

export default async function WinnersPage({ params }: { params: Promise<Params> }) {
  const year = Number((await params).year);
  const rows = await winnerRows(year);
  const copy: WinnersCopy = {
    caption: fill(raw(page('table.caption')), { year }),
    sortHint: t(page('table.sort_hint')),
    columns: {
      category: t(page('table.category')),
      medal: t(page('table.medal')),
      beer: t(page('table.beer')),
      brewery: t(page('table.brewery')),
      abv: t(page('table.abv')),
      ibu: t(page('table.ibu')),
      hops: t(page('table.hops')),
    },
    categoryCell: raw(page('table.group_row')),
    medals: group('global.labels.medal'),
    notPublished: t('global.labels.not_found'),
    countOne: t('global.filters.live_region.one'),
    countMany: raw('global.filters.live_region.many'),
    fixedYear: fill(raw('global.filters.chips.fixed_year'), { year }),
    emptyTitle: t('global.states.no_results.title'),
    emptyHint: t('global.states.no_results.remove_hint'),
    stats: {
      label: t(page('stats.label')),
      medals: t(page('stats.medals')),
      medalsNote: raw(page('stats.medals_note')),
      abv: t(page('stats.abv')),
      ibu: t(page('stats.ibu')),
      hops: t(page('stats.hops')),
      beerPage: t(page('stats.beer_page')),
      share: raw(page('stats.share_note')),
    },
  };
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-6 px-(--app-margin) py-8">
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{fill(raw(page('header.title')), { year })}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{fill(raw(page('header.lede')), { year })}</p>
        <p className="type-body-large flex flex-wrap gap-x-6 gap-y-2">
          <TextLink href={href(paths.firstTime(year))}>{fill(raw(page('links.first_time')), { year })}</TextLink>
          <TextLink href={href(paths.explorer)}>{t(page('links.explorer'))}</TextLink>
        </p>
      </header>
      <WinnersTable year={year} rows={rows} copy={copy} />
    </main>
  );
}
