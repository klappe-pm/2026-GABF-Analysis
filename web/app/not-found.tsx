import Link from 'next/link';
import { t } from '@/lib/content';

// Shown for any address with no page.
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-4 px-4 py-7">
      <h1 className="text-h1">{t('pages.not-found.page.title')}</h1>
      <p className="max-w-measure text-lead text-ink-muted">{t('pages.not-found.page.body')}</p>
      <p>
        <Link href="/design-system/" className="text-ink underline decoration-rule-strong">{t('pages.design-system.page.title')}</Link>
      </p>
    </main>
  );
}
