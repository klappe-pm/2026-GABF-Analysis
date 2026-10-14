import type { Metadata } from 'next';
import { TextLink } from '@/components/TextLink';
import { t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import { SiteFrame } from './(site)/shell/frame';

export const metadata: Metadata = {
  title: t('global.navigation.page_titles.not_found'),
  description: t('global.navigation.page_descriptions.not_found'),
  robots: { index: false },
};

// Shown for any address with no page, inside the site frame so the navigation still leads somewhere.
export default function NotFound() {
  return (
    <SiteFrame>
      <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-4 px-(--app-margin) py-8">
        <h1 className="type-display-small text-on-surface">{t('pages.not-found.page.title')}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{t('pages.not-found.page.body')}</p>
        <p className="type-body-large">
          <TextLink href={href(paths.home)}>{t('pages.not-found.page.home_link')}</TextLink>
        </p>
      </main>
    </SiteFrame>
  );
}
