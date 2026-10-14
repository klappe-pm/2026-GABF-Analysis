import Link from 'next/link';
import { t } from '@/lib/content';

// Shown for any address with no page.
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-4 px-4 py-12">
      <h1 className="type-display-small text-on-surface">{t('pages.not-found.page.title')}</h1>
      <p className="type-body-large max-w-measure text-on-surface-variant">{t('pages.not-found.page.body')}</p>
      <p className="type-body-large">
        <Link href="/design-system/" className="text-primary underline">{t('pages.design-system.page.title')}</Link>
      </p>
    </main>
  );
}
