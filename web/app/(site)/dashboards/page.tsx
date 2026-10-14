import type { Metadata } from 'next';
import { TextLink } from '@/components/TextLink';
import { t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { DASHBOARD_KINDS, DASHBOARD_PATHS } from './kit/routes';

export function generateMetadata(): Metadata {
  return pageMetadata({ title: t('global.navigation.page_titles.dashboards'), description: t('global.navigation.page_descriptions.dashboards'), path: paths.dashboards });
}

// The list of dashboards, each with what it shows.
export default function DashboardsIndex() {
  const page = (key: string) => t(`pages.dashboards.index.${key}`);
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-6 px-(--app-margin) py-8">
      <h1 className="type-display-small text-on-surface">{page('title')}</h1>
      <ul className="flex flex-col gap-4">
        {DASHBOARD_KINDS.map((k) => (
          <li key={k} className="flex flex-col gap-1">
            <TextLink href={href(DASHBOARD_PATHS[k])} className="type-title-large">{page(k)}</TextLink>
            <span className="type-body-large max-w-measure text-on-surface-variant">{page(`${k}_description`)}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
