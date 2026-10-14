// One brewery at /breweries/<brewery>/, the same address as the current site: its medals under the global
// filter, then its profile, ownership, distribution, estimated scale, other competitions, and deep dive.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { TextLink } from '@/components/TextLink';
import { fill, group, lookup, t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import type { BreweryRecord } from '@/lib/models/breweries.mjs';
import { pageMetadata } from '@/lib/seo';
import { laneModel, staticParams, WINNER_YEAR } from '@/lib/site-data';
import { estimateCopy } from '../copy';
import { BreweryMedals } from './BreweryMedals';
import { Profile } from './Profile';

type Params = { slug: string };
type Model = { breweryRecord: (slug: string) => BreweryRecord | null };

export const dynamicParams = false;
export const generateStaticParams = staticParams.breweries;

const raw = (key: string) => lookup(key) as string;
const copy = (key: string) => t(`pages.brewery-detail.${key}`);

async function record(params: Promise<Params>): Promise<BreweryRecord> {
  const b = (await laneModel<Model>('breweries')).breweryRecord((await params).slug);
  if (!b) notFound();
  return b;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const b = await record(params);
  return pageMetadata({
    title: fill(raw('global.navigation.page_titles.brewery_detail'), { brewery_name: b.name }),
    description: fill(raw('global.navigation.page_descriptions.brewery_detail'), { brewery_name: b.name }),
    path: paths.brewery(b.slug),
  });
}

// Every group of the copy a brewery page reads, by the name the views use.
function pageCopy() {
  const g = (key: string) => group(key);
  const P = 'pages.brewery-detail';
  return {
    stats: g(`${P}.stats`), charts: g(`${P}.charts`), chart: g(`${P}.chart`), history: g(`${P}.history`), trend: g(`${P}.trend`), tables: g(`${P}.tables`),
    hops: g(`${P}.hops`), farms: g(`${P}.farms`), beers: g(`${P}.beers`), profile: g(`${P}.profile`), profile_extra: g(`${P}.profile_extra`),
    ownership: g(`${P}.ownership`), distribution: g(`${P}.distribution`), scale: g(`${P}.scale`), other_competitions: g(`${P}.other_competitions`), deep_dive: g(`${P}.deep_dive`),
    hops_shared: g('pages.hop-detail.shared_views'), card: g('pages.beer-detail.card'), specs: g('pages.beer-detail.specs'), lede: g('pages.beer-detail.lede'), beer_cards: g('pages.profile-cards.beer'),
    medal: g('global.labels.medal'), trend_status: g('global.labels.trend_status'), style_family: g('global.labels.style_family'), brewery_type: g('global.labels.brewery_type'),
    ownership_type: g('global.labels.ownership_type'), distribution_channel: g('global.labels.distribution_channel'), estimate_basis: g('global.labels.estimate_basis'),
    confidence: g('global.labels.confidence'), competition: g('global.labels.competition'), yes_no: g('global.labels.yes_no'),
    medalCols: g('global.tables.medal_columns'), sorting: g('global.tables.sorting'), table_view: g('global.charts.table_view'), table_columns: g('global.charts.table_columns'),
    gaps: g('global.states.gaps'), no_results: g('global.states.no_results'), partial_brewery: g('global.states.partial_brewery'), est_state: g('global.states.estimates'),
    fixed: { brewery: raw('global.filters.chips.fixed_brewery') },
  };
}

export default async function BreweryPage({ params }: { params: Promise<Params> }) {
  const b = await record(params);
  const c = pageCopy();
  const labels = (key: string) => group(`global.labels.${key}`);
  const facts = [
    b.type ? labels('brewery_type')[b.type] : c.gaps.not_defined,
    [b.hq.city, b.hq.state].filter(Boolean).join(', ') || c.gaps.not_defined,
    b.founded ? fill(raw(`pages.brewery-detail.pills.founded`), { year: b.founded }) : null,
    b.ownership ? (b.ownership.parent ? fill(raw('pages.brewery-detail.pills.owner_with_parent'), { ownership: labels('ownership_type')[b.ownership.type] ?? c.gaps.not_defined, parent: b.ownership.parent }) : labels('ownership_type')[b.ownership.type] ?? c.gaps.not_defined) : null,
    b.channel ? labels('distribution_channel')[b.channel] : null,
    b.streak > 1 ? fill(raw('pages.brewery-detail.pills.streak'), { count: b.streak }) : null,
  ].filter((x): x is string => Boolean(x));
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-8 px-(--app-margin) py-8">
      <header className="flex flex-col gap-3">
        <Breadcrumb
          label={t('global.site.header.nav_label')}
          items={[{ href: href(paths.breweries), text: copy('links.back') }, { text: b.name }]}
        />
        <h1 className="type-display-small text-on-surface">{b.name}</h1>
        <ul className="type-body-large flex flex-wrap gap-x-6 gap-y-1 text-on-surface-variant">
          {facts.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <p className="type-body-large flex flex-wrap gap-x-6 gap-y-2">
          {b.website ? <TextLink href={b.website} rel="noopener">{copy('links.website')}</TextLink> : null}
          <TextLink href={`${href(paths.dashboards)}breweries/#brewery=${encodeURIComponent(b.key)}`}>{copy('links.dashboard')}</TextLink>
        </p>
      </header>
      <BreweryMedals b={{ key: b.key, slug: b.slug, name: b.name, trend: b.trend, rows: b.rows, estimate: b.estimate, hopLinks: b.hopLinks, hopFarms: b.hopFarms, namedFarms: b.namedFarms, farmSlugs: b.farmSlugs, varietySlugs: b.varietySlugs }} year={WINNER_YEAR} copy={c} estimate={estimateCopy()} />
      <Profile b={b} copy={c} estimate={estimateCopy()} />
    </main>
  );
}
