// Method: where the data comes from, what each year covers, and how estimates and rates are made, at
// /method/. Every word comes from pages/method.md and the shared copy; every {{token}} in that copy is
// filled from the dataset and data/reference/estimation-parameters.json (web/lib/models/method.mjs).
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { type Column, DataTable, type Row } from '@/components/DataTable';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusChip } from '@/components/StatusChip';
import { fill, group, lookup, t } from '@/lib/content';
import { paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { laneModel } from '@/lib/site-data';

const raw = (key: string) => lookup(key) as string;
const page = (key: string) => `pages.method.${key}`;
const model = async () => (await laneModel<typeof import('@/lib/models/method.mjs')>('method')).methodModel();

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: t('global.navigation.page_titles.method'),
    description: t('global.navigation.page_descriptions.method'),
    path: paths.method,
  });
}

// A paragraph of the copy with its tokens filled. A lead in before the first colon (a source's name) is set in bold.
function Paragraph({ text, lead = false }: { text: string; lead?: boolean }) {
  const cut = lead ? text.indexOf(': ') : -1;
  return cut > 0 ? <><strong className="font-semibold">{text.slice(0, cut)}</strong>{text.slice(cut)}</> : <>{text}</>;
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <SectionHeader id={id} title={title} lead={lead} />
      {children}
    </section>
  );
}

const SOURCES = ['results', 'breweries', 'styles', 'ownership', 'population', 'demographics', 'fed_districts', 'totals', 'winning_beers'];
const ESTIMATES = ['intro', 'volume', 'conversions', 'revenue', 'margins'];

export default async function MethodPage() {
  const { coverage, values } = await model();
  const notDefined = t('global.labels.not_found');
  const v: Record<string, string | number> = { ...values, data_year: values.data_year ?? notDefined };
  const text = (key: string) => fill(raw(page(key)), v);
  const status = group('global.labels.coverage');
  const meaning = group('global.labels.coverage_meaning');
  const columns: Column[] = [
    { key: 'year', label: t(page('coverage.columns.year')) },
    { key: 'status', label: t(page('coverage.columns.status')) },
    { key: 'rows', label: t(page('coverage.columns.rows')) },
    { key: 'sources', label: t(page('coverage.columns.sources')) },
  ];
  const rows: Row[] = coverage.map((c) => ({
    key: String(c.year),
    cells: {
      year: String(c.year),
      status: <StatusChip label={status[c.status] ?? notDefined} />,
      rows: c.medals.toLocaleString('en-US'),
      sources: c.sources.length ? c.sources.join('; ') : notDefined,
    },
  }));
  const shownStatuses = [...new Set(coverage.map((c) => c.status))];

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-10 px-(--app-margin) py-8">
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{t(page('header.title'))}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{t(page('header.lede'))}</p>
      </header>

      <Section id="coverage" title={t(page('coverage.title'))} lead={text('coverage.lede')}>
        <DataTable caption={t(page('coverage.title'))} columns={columns} rows={rows} scroll={false} />
        <dl className="type-body-medium flex max-w-measure flex-col gap-2 text-on-surface-variant">
          {shownStatuses.map((s) => (
            <div key={s} className="flex flex-col">
              <dt className="font-semibold text-on-surface">{status[s]}</dt>
              <dd>{meaning[s]}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="sources" title={t(page('sources.title'))}>
        <ul className="type-body-medium flex max-w-measure flex-col gap-3 text-on-surface">
          {SOURCES.map((k) => (
            <li key={k}><Paragraph text={text(`sources.${k}`)} lead /></li>
          ))}
        </ul>
      </Section>

      <Section id="rates" title={t(page('rates.title'))}>
        <p className="type-body-medium max-w-measure text-on-surface">{text('rates.body')}</p>
      </Section>

      <Section id="fed-districts" title={t(page('fed_districts.title'))}>
        <p className="type-body-medium max-w-measure text-on-surface">{text('fed_districts.body')}</p>
      </Section>

      <Section id="estimates" title={t(page('estimates.title'))}>
        {ESTIMATES.map((k) => (
          <p key={k} className="type-body-medium max-w-measure text-on-surface">{text(`estimates.${k}`)}</p>
        ))}
      </Section>

      <Section id="year-status" title={t(page('year_status.title'))}>
        <p className="type-body-medium max-w-measure text-on-surface">{text('year_status.body')}</p>
      </Section>

      <Section id="first-time" title={t(page('first_time.title'))}>
        <p className="type-body-medium max-w-measure text-on-surface">{text('first_time.body')}</p>
      </Section>

      <Section id="keyboard" title={t(page('keyboard.title'))}>
        <ul className="type-body-medium flex max-w-measure flex-col gap-2 text-on-surface">
          {['open', 'close', 'sort'].map((k) => (
            <li key={k}>{t(`global.filters.keyboard.${k}`)}</li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
