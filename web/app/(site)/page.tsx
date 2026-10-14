import type { Metadata } from 'next';
import { Callout } from '@/components/Callout';
import { TextLink } from '@/components/TextLink';
import { fill, finding, lookup, t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { laneModel } from '@/lib/site-data';
import { homeCopy } from './dashboards/kit/copy-server';
import { DASHBOARD_PATHS } from './dashboards/kit/routes';
import { HomeView } from './home/HomeView';

export function generateMetadata(): Metadata {
  return pageMetadata({ title: t('global.navigation.page_titles.home'), description: t('global.navigation.page_descriptions.home'), path: paths.home, absoluteTitle: true });
}

const model = () => laneModel<typeof import('@/lib/models/dashboards.mjs')>('dashboards');
const raw = (key: string) => lookup(key) as string;

// The landing page: the scoresheet of the latest year, a search field, the headline finding, and the
// category index. The page is built for the latest year; the view redraws for a year or filters in the
// address (/#year=2024), which the global filter reads.
export default async function Home() {
  const m = await model();
  const data = m.homeData();
  const featured = m.featuredBreweries();
  const lead = finding('concentration-of-medals').lead;
  const headline = fill(lead, data.finding);
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-6 px-(--app-margin) py-8">
      <HomeView
        copy={homeCopy()}
        initial={{ year: data.year, firstYear: data.firstYear, lastYear: data.lastYear, scoresheet: data.scoresheet, categories: data.categories }}
        search={m.searchIndex()}
        finding={
          <Callout label={t('pages.home.finding.label')} link={{ href: href(paths.reports), text: t('pages.home.finding.link') }}>
            {fill(raw('pages.home.finding.text'), { headline_finding: headline })}
          </Callout>
        }
      />
      <nav aria-label={t('pages.home.next_steps.overview')}>
        <ul className="type-body-large flex flex-wrap gap-x-6 gap-y-2">
          <li><TextLink href={href(paths.breweries)}>{t('pages.home.next_steps.breweries')}</TextLink></li>
          <li><TextLink href={href(paths.winners(data.year))}>{fill(raw('pages.home.next_steps.beers'), { year: data.year })}</TextLink></li>
          <li><TextLink href={href(paths.firstTime(data.year))}>{fill(raw('pages.home.next_steps.first_time'), { year: data.year })}</TextLink></li>
          <li><TextLink href={href(paths.reports)}>{t('pages.home.next_steps.analysis')}</TextLink></li>
          <li><TextLink href={href(DASHBOARD_PATHS.overview)}>{t('pages.home.next_steps.overview')}</TextLink></li>
        </ul>
      </nav>
      {featured.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="deep-dives-title">
          <h2 id="deep-dives-title" className="type-title-large text-on-surface">{t('pages.home.deep_dives.title')}</h2>
          <ul className="type-body-large flex flex-col gap-2">
            {featured.map((b) => (
              <li key={b.slug}>
                <TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>
                <span className="text-on-surface-variant"> {fill(raw('pages.home.deep_dives.item_meta'), { city: b.city, state: b.state, count: b.medals })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
