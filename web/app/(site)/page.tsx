import type { Metadata } from 'next';
import { TextLink } from '@/components/TextLink';
import { fill, lookup, t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { WINNER_YEAR } from '@/lib/site-data';

export function generateMetadata(): Metadata {
  return pageMetadata({ title: t('global.navigation.page_titles.home'), description: t('global.navigation.page_descriptions.home'), path: paths.home, absoluteTitle: true });
}

// A holding page until the dashboards lane ports the overview dashboard here (docs/site-port-plan.md).
export default function Home() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-4 px-(--app-margin) py-8">
      <h1 className="type-display-small text-on-surface">{t('global.site.identity.name')}</h1>
      <p className="type-body-large max-w-measure text-on-surface-variant">{t('global.site.identity.tagline')}</p>
      <p className="type-body-large">
        <TextLink href={href(paths.winners(WINNER_YEAR))}>{fill(lookup('pages.home.next_steps.beers') as string, { year: WINNER_YEAR })}</TextLink>
      </p>
    </main>
  );
}
