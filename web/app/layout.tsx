import type { Metadata, Viewport } from 'next';
import { Archivo_Narrow, Public_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
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

export default function RootLayout({ children }: { children: ReactNode }) {
  const baked = bakedState();
  return (
    <html lang="en" className={`${sans.variable} ${narrow.variable}`}>
      <head>
        {/* The settings as built: the page is fully styled before the settings files load. */}
        <style id="design-settings-baked" dangerouslySetInnerHTML={{ __html: rootCss(baked.global) }} />
      </head>
      <body className="min-h-screen bg-surface-container-lowest font-plain text-on-surface">
        <DesignSettings initial={baked}>{children}</DesignSettings>
      </body>
    </html>
  );
}
