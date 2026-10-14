// First time medalists at /first-time-medalists/2026/, the same address as the current site: breweries whose
// first medal in the record came in the latest year, how first time is defined, and the names to check.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { DataTable } from '@/components/DataTable';
import { SectionHeader } from '@/components/SectionHeader';
import { TextLink } from '@/components/TextLink';
import { fill, group, lookup, t } from '@/lib/content';
import { href, paths } from '@/lib/href';
import type { FirstTimeRecord } from '@/lib/models/breweries.mjs';
import { pageMetadata } from '@/lib/seo';
import { laneModel, WINNER_YEAR } from '@/lib/site-data';
import { FirstTimeView } from './FirstTimeView';

type Params = { year: string };
type Model = { firstTimeRecord: (year: number) => FirstTimeRecord };

export const dynamicParams = false;
export function generateStaticParams(): Params[] {
  return [{ year: String(WINNER_YEAR) }];
}

const raw = (key: string) => lookup(key) as string;
const page = (key: string) => `pages.first-time-medalists.${key}`;
const list = (years: number[]) => (years.length <= 2 ? years.join(' and ') : `${years.slice(0, -1).join(', ')}, and ${years[years.length - 1]}`);

async function record(params: Promise<Params>) {
  const year = Number((await params).year);
  if (year !== WINNER_YEAR) notFound();
  return (await laneModel<Model>('breweries')).firstTimeRecord(year);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const year = Number((await params).year);
  return pageMetadata({
    title: fill(raw('global.navigation.page_titles.first_time_medalists'), { year }),
    description: fill(raw('global.navigation.page_descriptions.first_time_medalists'), { year }),
    path: paths.firstTime(year),
  });
}

export default async function FirstTimePage({ params }: { params: Promise<Params> }) {
  const r = await record(params);
  const year = r.year;
  const g = (key: string) => group(key);
  const copy = {
    stats: g(page('stats')), charts: g(page('charts')), table: g(page('table')), complete_record: g(page('complete_record')),
    medal: g('global.labels.medal'), style_family: g('global.labels.style_family'), medalCols: g('global.tables.medal_columns'), place: g('global.tables.place_columns'),
    units: g('global.charts.units'), gaps: { not_found: t('global.labels.not_found') },
    fixed: { year: raw('global.filters.chips.fixed_year') },
  };
  const rangeText = r.completeRange ? `${r.completeRange.from} to ${r.completeRange.to}` : '';
  const partial = list(r.partialYears);
  const d = (key: string, values: Record<string, string | number> = {}) => fill(raw(page(`definition.${key}`)), values);
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-8 px-(--app-margin) py-8">
      <header className="flex flex-col gap-3">
        <Breadcrumb label={t('global.site.header.nav_label')} items={[{ href: href(paths.winners(year)), text: fill(raw('global.navigation.breadcrumbs.all_beers'), { year }) }, { text: fill(raw(page('header.title')), { year }) }]} />
        <h1 className="type-display-small text-on-surface">{fill(raw(page('header.title')), { year })}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{fill(raw(page('header.lede')), { count: r.newCount, year })}</p>
      </header>

      <section aria-labelledby="definition-title" className="flex max-w-measure flex-col gap-3 rounded-(--md-sys-shape-corner-medium) border border-outline-variant p-4">
        <h2 id="definition-title" className="type-title-large text-on-surface">{t(page('definition.title'))}</h2>
        <p className="type-body-large">{d('range', { first_year: r.firstYear, last_year: r.lastYear })} {r.partialYears.length ? d('partial', { partial_years: partial }) : ''} {r.pendingYears.length ? d('missing', { missing_years: list(r.pendingYears) }) : ''}</p>
        <p className="type-body-large">{d('rule', { year })}</p>
        <p className="type-body-large">{d('matching')}</p>
        {r.completeCount || r.partialYears.length ? <p className="type-body-large">{d('complete_record', { complete_range: rangeText })}</p> : null}
        <p className="type-body-medium text-on-surface-variant">{d('totals', { new_count: r.newCount, complete_count: r.completeCount })}</p>
      </section>

      <FirstTimeView year={year} rows={r.rows} copy={copy} partialYears={partial} completeRange={rangeText} />

      <section aria-labelledby="names-title" className="flex flex-col gap-3">
        <SectionHeader id="names-title" title={t(page('names_to_check.title'))} lead={r.ambiguous.length ? t(page('names_to_check.note')) : undefined} />
        {r.ambiguous.length ? (
          <DataTable
            caption={t(page('names_to_check.caption'))}
            scroll={false}
            columns={[{ key: 'first', label: t(page('names_to_check.first_time')) }, { key: 'earlier', label: t(page('names_to_check.earlier')) }]}
            rows={r.ambiguous.map((a) => ({
              key: a.key,
              cells: {
                first: <span>{a.name} <span className="text-on-surface-variant">{a.city}, {a.state}</span></span>,
                earlier: (
                  <ul>
                    {a.candidates.map((cand) => <li key={cand.name}>{fill(raw(page('names_to_check.earlier_value')), { name: cand.name, city: cand.city, state: cand.state, years: cand.years.join(', ') })}</li>)}
                  </ul>
                ),
              },
            }))}
          />
        ) : <p className="type-body-medium text-on-surface-variant">{t(page('names_to_check.empty'))}</p>}
        <p className="type-body-medium"><TextLink href={href(paths.winners(year))}>{fill(raw('global.navigation.breadcrumbs.all_beers'), { year })}</TextLink></p>
      </section>
    </main>
  );
}
