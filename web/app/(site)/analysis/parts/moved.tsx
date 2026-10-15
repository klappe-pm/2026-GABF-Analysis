// The page left at an address that moved. Static export cannot answer with a server redirect, so the page holds a
// meta refresh to the new address, a canonical link to it (in the page's metadata), and a plain link for readers
// whose browsers do not follow the refresh. A script ahead of the refresh carries the URL hash (the filter) along. It is
// marked noindex so search engines keep the new address.
import type { Metadata } from 'next';
import { TextLink } from '@/components/TextLink';
import { t } from '@/lib/content';
import { canonical, href } from '@/lib/href';

export function movedMetadata(to: string, pageTitle: string): Metadata {
  return {
    title: t('pages.analysis-index.moved.title'),
    description: t('pages.analysis-index.moved.link', { page_title: pageTitle }),
    alternates: { canonical: canonical(to) },
    robots: { index: false, follow: true },
  };
}

export function Moved({ to, pageTitle }: { to: string; pageTitle: string }) {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-4 px-(--app-margin) py-8">
      {/* The script goes first and keeps the hash, so a filtered link (#year=2024) arrives filtered; the refresh is the
          path for a browser with scripts off. */}
      <script dangerouslySetInnerHTML={{ __html: `location.replace(${JSON.stringify(href(to))}+location.hash)` }} />
      <meta httpEquiv="refresh" content={`0; url=${href(to)}`} />
      <h1 className="type-display-small text-on-surface">{t('pages.analysis-index.moved.title')}</h1>
      <p className="type-body-large max-w-measure text-on-surface-variant">{t('pages.analysis-index.moved.body')}</p>
      <p className="type-body-large"><TextLink href={href(to)}>{t('pages.analysis-index.moved.link', { page_title: pageTitle })}</TextLink></p>
    </main>
  );
}
