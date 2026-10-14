// Search and link preview metadata for a page: its title and description from the copy, its canonical
// gabf.beer address, and the Open Graph and card tags with the site's social card.
import type { Metadata } from 'next';
import { t } from './content';
import { canonical } from './href';

export const SOCIAL_CARD = { path: '/social-preview.png', width: 1280, height: 640 };

export function pageMetadata({ title, description, path, absoluteTitle = false }: { title: string; description: string; path: string; absoluteTitle?: boolean }): Metadata {
  const site = t('global.site.identity.name');
  const fullTitle = absoluteTitle ? title : `${title}${t('global.navigation.page_titles.suffix')}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: canonical(path) },
    openGraph: {
      type: 'website',
      siteName: site,
      title: fullTitle,
      description,
      url: canonical(path),
      images: [{ url: canonical(SOCIAL_CARD.path), width: SOCIAL_CARD.width, height: SOCIAL_CARD.height, alt: t('global.site.identity.tagline') }],
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [canonical(SOCIAL_CARD.path)] },
  };
}
