import type { Metadata, Viewport } from 'next';
import { Archivo_Narrow, Public_Sans } from 'next/font/google';
import { Fragment, type ReactNode } from 'react';
import { DesignSettings } from '@/design/runtime';
import { rootCss } from '@/design/theme';
import { t } from '@/lib/content';
import { bakedState } from '@/lib/design-source';
import './globals.css';

// Public Sans sets body text, headings, and every figure. Archivo Narrow sets short labels only.
// Both are always loaded, so the font settings can switch between them without a rebuild.
const sans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans', display: 'swap', weight: 'variable' });
const narrow = Archivo_Narrow({ subsets: ['latin'], variable: '--font-archivo-narrow', display: 'swap', weight: 'variable' });

export const metadata: Metadata = {
  title: { default: t('global.navigation.page_titles.home'), template: `%s${t('global.navigation.page_titles.suffix')}` },
  description: t('global.navigation.page_descriptions.home'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// The footer every page carries, with the Catalog.beer attribution its license asks for.
function SiteFooter() {
  // One line of copy (global.site.footer.beer_details); its two names become links.
  const LINKS: Record<string, string> = { 'Catalog.beer': 'https://catalog.beer', 'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/' };
  const parts = t('global.site.footer.beer_details').split(/(Catalog\.beer|CC BY 4\.0)/);
  return (
    <footer className="mt-12 bg-surface-container">
      <md-divider />
      <p className="type-body-small mx-auto max-w-page px-4 py-6 text-on-surface-variant" data-attribution="catalog-beer">
        {parts.map((p, i) => (LINKS[p] ? <a key={i} href={LINKS[p]} className="text-primary underline">{p}</a> : <Fragment key={i}>{p}</Fragment>))}
      </p>
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
