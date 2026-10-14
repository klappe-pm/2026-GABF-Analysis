import Link from 'next/link';
import { t } from '@/lib/content';

// The rebuild starts with its design system; the site's pages arrive here at the cutover.
export default function Home() {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-4 px-4 py-7">
      <h1 className="text-h1">{t('global.site.identity.name')}</h1>
      <p className="max-w-measure text-lead text-ink-muted">{t('global.site.identity.tagline')}</p>
      <p>
        <Link href="/design-system/" className="text-ink underline decoration-rule-strong">{t('pages.design-system.page.title')}</Link>
      </p>
    </main>
  );
}
