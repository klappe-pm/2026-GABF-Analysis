// About at /about/, the same address as the current site: what the site is, who it is for, how it stays
// independent, and its attributions. Where the data comes from and how estimates are made lives on Method.
import type { Metadata } from 'next';
import { SectionHeader } from '@/components/SectionHeader';
import { TextLink } from '@/components/TextLink';
import { fill, t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { WINNER_YEAR } from '@/lib/site-data';
import { analysis, MAIN, raw } from '../analysis/parts/copy';
import { analysisPaths } from '../analysis/parts/paths';

const REPO_URL = 'https://github.com/klappe-pm/GABF-Analysis';
const page = (key: string) => `pages.about.${key}`;

export function generateMetadata(): Metadata {
  return pageMetadata({ title: t('global.navigation.page_titles.about'), description: t('global.navigation.page_descriptions.about'), path: paths.about });
}

export default async function AboutPage() {
  const about = (await analysis()).about();
  const attribution = ['trademark', 'styles', 'breweries', 'charts', 'maps'];
  return (
    <main id="main" tabIndex={-1} className={MAIN}>
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{t(page('header.title'))}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{t(page('header.lede'))}</p>
      </header>
      <section aria-labelledby="audience" className="flex max-w-measure flex-col gap-2">
        <SectionHeader id="audience" title={t(page('audience.title'))} />
        <p className="type-body-large">{t(page('audience.body'))}</p>
      </section>
      <section aria-labelledby="offer" className="flex max-w-measure flex-col gap-2">
        <SectionHeader id="offer" title={t(page('offer.title'))} />
        <ul className="type-body-large list-disc pl-6">
          <li>{fill(raw(page('offer.medals')), { first_year: about.firstYear, last_year: about.lastYear })}</li>
          <li>{fill(raw(page('offer.beers')), { profile_year: WINNER_YEAR })}</li>
          <li>{t(page('offer.findings'))}</li>
        </ul>
      </section>
      <section aria-labelledby="independence" className="flex max-w-measure flex-col gap-2">
        <SectionHeader id="independence" title={t(page('independence.title'))} />
        <p className="type-body-large">{t(page('independence.body'))}</p>
      </section>
      <section aria-labelledby="attribution" className="flex max-w-measure flex-col gap-2">
        <SectionHeader id="attribution" title={t(page('attribution.title'))} />
        <ul className="type-body-large list-disc pl-6">
          {attribution.map((k) => <li key={k}>{t(page(`attribution.${k}`))}</li>)}
        </ul>
      </section>
      <p className="type-body-large flex flex-wrap gap-x-6 gap-y-2">
        <TextLink href={href(analysisPaths.method)}>{t(page('links.method'))}</TextLink>
        <TextLink href={REPO_URL} rel="noopener">{t(page('links.source'))}</TextLink>
      </p>
    </main>
  );
}
