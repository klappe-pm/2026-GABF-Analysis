import type { Metadata, Viewport } from 'next';
import { Archivo_Narrow, Public_Sans } from 'next/font/google';
import { Fragment, type ReactNode } from 'react';
import { DesignSettings } from '@/design/runtime';
import { rootCss } from '@/design/theme';
import { t } from '@/lib/content';
import { bakedState } from '@/lib/design-source';
import { href, paths, SITE_ORIGIN } from '@/lib/href';

const REPO_URL = 'https://github.com/klappe-pm/GABF-Analysis';
import './globals.css';

// Public Sans sets body text, headings, and every figure. Archivo Narrow sets short labels only.
// Both are always loaded, so the font settings can switch between them without a rebuild.
const sans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans', display: 'swap', weight: 'variable' });
const narrow = Archivo_Narrow({ subsets: ['latin'], variable: '--font-archivo-narrow', display: 'swap', weight: 'variable' });

// Canonical and Open Graph addresses resolve against the public address; pages set their own with pageMetadata().
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: t('global.navigation.page_titles.home'), template: `%s${t('global.navigation.page_titles.suffix')}` },
  description: t('global.navigation.page_descriptions.home'),
  applicationName: t('global.site.identity.name'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// The footer every page carries: where the data comes from, the estimate mark, the independence notice,
// the About and source links, and the Catalog.beer attribution its license asks for.
function SiteFooter() {
  // One line of copy (global.site.footer.beer_details); its two names become links.
  const LINKS: Record<string, string> = { 'Catalog.beer': 'https://catalog.beer', 'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/' };
  const parts = t('global.site.footer.beer_details').split(/(Catalog\.beer|CC BY 4\.0)/);
  return (
    <footer className="mt-12 bg-surface-container">
      <md-divider />
      <div className="type-body-small mx-auto flex max-w-(--app-page-max) flex-col gap-2 px-(--app-margin) py-6 text-on-surface-variant">
        <nav aria-label={t('global.navigation.footer.source')}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><a href={href(paths.about)} className="text-primary underline">{t('global.navigation.footer.about')}</a></li>
            <li><a href={href(paths.method)} className="text-primary underline">{t('global.navigation.footer.method')}</a></li>
            <li><a href={href(paths.saved)} className="text-primary underline">{t('global.navigation.footer.saved_views')}</a></li>
            <li><a href={REPO_URL} className="text-primary underline">{t('global.navigation.footer.source')}</a></li>
          </ul>
        </nav>
        <p className="max-w-measure">{t('global.site.footer.sources')} {t('global.site.footer.estimates')}</p>
        <p className="max-w-measure">{t('global.site.footer.independence')}</p>
        <p className="max-w-measure" data-attribution="catalog-beer">
          {parts.map((p, i) => (LINKS[p] ? <a key={i} href={LINKS[p]} className="text-primary underline">{p}</a> : <Fragment key={i}>{p}</Fragment>))}
        </p>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const baked = bakedState();
  return (
    <html lang="en" className={`${sans.variable} ${narrow.variable}`}>
      <head>
        {/* The settings as built: the page is fully styled before the settings files load. */}
        <style id="design-settings-baked" dangerouslySetInnerHTML={{ __html: rootCss(baked.global) }} />
      </head>
      <body className="min-h-screen bg-background font-plain text-on-background">
        <DesignSettings initial={baked}>
          {children}
          <SiteFooter />
        </DesignSettings>
      </body>
    </html>
  );
}
