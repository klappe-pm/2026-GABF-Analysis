// A dashboard page as the server builds it: the header and tab row from the copy documents, then the
// client view that loads the medals and follows the global filter. Every dashboard page is this with its kind.
import type { Metadata } from 'next';
import { LinkChips } from '@/components/Chips';
import { TextLink } from '@/components/TextLink';
import { Tabs } from '@/components/Tabs';
import { fill, group, lookup, t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { counts, laneModel } from '@/lib/site-data';
import { Dashboard, type DashboardKind } from './Dashboard';
import { dashboardCopy } from './copy-server';
import { DASHBOARD_KINDS, DASHBOARD_PATHS } from './routes';

const model = () => laneModel<typeof import('@/lib/models/dashboards.mjs')>('dashboards');
const page = (key: string) => `pages.dashboards.${key}`;

export function dashboardMetadata(kind: DashboardKind): Metadata {
  return pageMetadata({
    title: t(page(`${kind}.title`)),
    description: t(page(`index.${kind}_description`)),
    path: DASHBOARD_PATHS[kind],
  });
}

export async function DashboardPage({ kind }: { kind: DashboardKind }) {
  const m = await model();
  const copy = dashboardCopy();
  const coverage = (await counts()).coverage as Record<string, string>;
  const status = group('global.labels.coverage');
  const meaning = group('global.labels.coverage_meaning');
  const featured = kind === 'overview' ? m.featuredBreweries() : [];
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-6 px-(--app-margin) py-8">
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{t(page(`${kind}.title`))}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{t(page(`${kind}.lede`))}</p>
      </header>
      <Tabs
        label={t(page('index.title'))}
        active={kind}
        items={DASHBOARD_KINDS.map((k) => ({ id: k, href: href(DASHBOARD_PATHS[k]), text: t(page(`index.${k}`)) }))}
      />
      <LinkChips
        label={t(page('coverage.label'))}
        chips={Object.entries(coverage).map(([year, c]) => ({ text: fill(lookup(page('coverage.chip')) as string, { year, status: status[c] ?? c }), href: href(paths.method), title: meaning[c] }))}
      />
      <Dashboard kind={kind} copy={copy} tiles={m.TILES} rateYears={m.rateYears()} defaultBrewery={m.defaultBrewery()} methodLabel={t('global.navigation.footer.method')} />
      {featured.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="deep-dives-title">
          <h2 id="deep-dives-title" className="type-title-large text-on-surface">{t(page('overview.deep_dives_title'))}</h2>
          <ul className="type-body-large flex flex-col gap-2">
            {featured.map((b) => (
              <li key={b.slug}>
                <TextLink href={href(paths.brewery(b.slug))}>{b.name}</TextLink>
                <span className="text-on-surface-variant"> {fill(lookup(page('overview.deep_dive_meta')) as string, { city: b.city, state: b.state, count: b.medals })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
