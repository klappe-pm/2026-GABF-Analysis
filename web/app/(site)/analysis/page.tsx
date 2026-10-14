// The analysis index at /analysis/ (the old /reports/ address redirects here): the ready made reports, one line
// each, and the coverage of every loaded year.
import type { Metadata } from 'next';
import { StatusChip } from '@/components/StatusChip';
import { TextLink } from '@/components/TextLink';
import { fill, t } from '@/lib/content';
import { href } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { analysis, labelGroup, MAIN, raw } from './parts/copy';
import { analysisPaths } from './parts/paths';

const page = (key: string) => `pages.analysis-index.${key}`;

export function generateMetadata(): Metadata {
  return pageMetadata({ title: t('global.navigation.page_titles.analysis_index'), description: t('global.navigation.page_descriptions.analysis_index'), path: analysisPaths.index });
}

export default async function AnalysisIndex() {
  const model = await analysis();
  const meta = model.reportMeta();
  const coverage = labelGroup('coverage');
  const meaning = labelGroup('coverage_meaning');
  return (
    <main id="main" tabIndex={-1} className={MAIN}>
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{t(page('header.title'))}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{t(page('header.lede'))}</p>
      </header>
      <section className="flex flex-col gap-3" aria-labelledby="reports">
        <h2 id="reports" className="type-headline-small text-primary">{t(page('reports.title'))}</h2>
        <ul className="flex flex-col gap-3">
          {model.REPORTS.map((r) => (
            <li key={r.slug} className="type-body-large">
              <TextLink href={href(analysisPaths.report(r.slug))}>{t(page(`reports.${r.key}.title`))}</TextLink>
              <span className="text-on-surface-variant"> {t(page(`reports.${r.key}.description`))}</span>
            </li>
          ))}
        </ul>
      </section>
      <ul className="flex flex-wrap gap-2">
        {meta.years.map((y) => (
          <li key={y}><StatusChip label={fill(raw(page('coverage.pill')), { year: y, coverage: coverage[meta.coverage[y]] ?? meta.coverage[y] })} meaning={meaning[meta.coverage[y]]} /></li>
        ))}
      </ul>
    </main>
  );
}
