import { TextLink } from '@/components/TextLink';
import { t } from '@/lib/content';

// The rebuild starts with its design system; the site's pages arrive here at the cutover.
export default function Home() {
  return (
    <main className="mx-auto flex max-w-(--app-page-max) flex-col gap-4 px-(--app-margin) py-12">
      <h1 className="type-display-small text-on-surface">{t('global.site.identity.name')}</h1>
      <p className="type-body-large max-w-measure text-on-surface-variant">{t('global.site.identity.tagline')}</p>
      <p className="type-body-large">
        <TextLink href="design-system/">{t('pages.design-system.page.title')}</TextLink>
      </p>
    </main>
  );
}
