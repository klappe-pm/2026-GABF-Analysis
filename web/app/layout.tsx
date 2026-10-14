import type { Metadata, Viewport } from 'next';
import { Archivo_Narrow, Public_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { themeScript } from '@/design/theme-script';
import { t } from '@/lib/content';
import './globals.css';

// Public Sans: the United States Web Design System's grotesk, drawn from Libre Franklin for government forms.
const sans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans', display: 'swap', weight: 'variable' });
// Archivo Narrow: a narrow grotesque for field labels, table headers, and stamps.
const narrow = Archivo_Narrow({ subsets: ['latin'], variable: '--font-archivo-narrow', display: 'swap', weight: ['400', '600', '700'] });

export const metadata: Metadata = {
  title: { default: t('global.navigation.page_titles.home'), template: `%s${t('global.navigation.page_titles.suffix')}` },
  description: t('global.navigation.page_descriptions.home'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${narrow.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-ground font-sans text-ink">{children}</body>
    </html>
  );
}
