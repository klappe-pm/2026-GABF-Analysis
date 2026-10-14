import { DashboardPage } from './dashboards/kit/DashboardPage';
import { pageMetadata } from '@/lib/seo';
import { t } from '@/lib/content';
import { paths } from '@/lib/href';
import type { Metadata } from 'next';

export function generateMetadata(): Metadata {
  return pageMetadata({ title: t('global.navigation.page_titles.home'), description: t('global.navigation.page_descriptions.home'), path: paths.home, absoluteTitle: true });
}

// The home page is the overview dashboard until the owner picks another (docs/site-port-plan.md, open decisions).
export default function Home() {
  return <DashboardPage kind="overview" />;
}
