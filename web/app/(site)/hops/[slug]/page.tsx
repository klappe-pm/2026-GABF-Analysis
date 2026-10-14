// One hop variety at /hops/<variety>/: its profile card, its data, aroma, US acreage by state and year,
// the medal beers and breweries that use it, the farms that grow it, and its research notes.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { ChartCard } from '@/components/ChartCard';
import { type Column, DataTable } from '@/components/DataTable';
import { HopProfileCard } from '@/components/HopProfileCard';
import { SpecCard, type SpecRow } from '@/components/SpecCard';
import { TextLink } from '@/components/TextLink';
import { fill, t } from '@/lib/content';
import { fmt } from '@/lib/data';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { staticParams, WINNER_YEAR } from '@/lib/site-data';
import { type Hop, hop as loadHop } from '../data';
import { BEER_COLUMNS, beerCells, farmLinks, hopCardData, joined, notDefined, raw, Sources } from '../parts';

type Params = { slug: string };

export const dynamicParams = false;
export const generateStaticParams = staticParams.hops;

const copy = (key: string, values: Record<string, string | number> = {}) => t(`pages.hop-detail.${key}`, values);

async function record(params: Promise<Params>): Promise<Hop> {
  const h = await loadHop((await params).slug);
  if (!h) notFound();
  return h;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const h = await record(params);
  return pageMetadata({ title: h.name, description: copy('meta.description', { name: h.name, year: WINNER_YEAR }), path: paths.hop(h.slug) });
}

const year = WINNER_YEAR;
const text = (v: string | null | undefined) => v || notDefined();

function Section({ id, title, note, children }: { id: string; title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-3">
      <h2 id={`${id}-title`} className="type-headline-small text-on-surface">{title}</h2>
      {note ? <p className="type-body-medium max-w-measure text-on-surface-variant">{note}</p> : null}
      {children}
    </section>
  );
}

export default async function HopPage({ params }: { params: Promise<Params> }) {
  const h = await record(params);
  const sortHint = copy('table.sort_hint');
  const none = notDefined();

  const dataRows = ([
    h.aliases.length ? { label: copy('data.aliases'), value: h.aliases.join(', ') } : null,
    ...h.data.map((d) => ({ label: d.label, value: d.max !== undefined ? fill(raw('pages.hop-detail.data.range'), { min: d.value, max: d.max }) : d.value })),
    ...h.sourceRows.map((s) => ({ label: s.label, value: <Sources sources={s.sources} /> })),
  ] as (SpecRow | null)[]).filter((r): r is SpecRow => r !== null);

  const aromaColumns: Column[] = [
    { key: 'descriptor', label: copy('aroma.descriptor'), sortable: true },
    { key: 'source', label: copy('aroma.source') },
  ];
  const acreageColumns: Column[] = [
    { key: 'state', label: copy('acreage.state'), sortable: true },
    { key: 'year', label: copy('acreage.year'), numeric: true, sortable: true },
    { key: 'acres', label: copy('acreage.acres'), numeric: true, sortable: true },
    { key: 'production', label: copy('acreage.production'), numeric: true, sortable: true },
    { key: 'source', label: copy('acreage.source') },
  ];
  const beerColumns: Column[] = [
    ...BEER_COLUMNS((k) => copy(`beers.${k}`)),
    { key: 'form', label: copy('beers.form') },
    { key: 'use', label: copy('beers.use') },
    { key: 'farm', label: copy('beers.farm') },
  ];
  const breweryColumns: Column[] = [
    { key: 'brewery', label: copy('breweries.brewery'), sortable: true },
    { key: 'count', label: copy('breweries.beers'), numeric: true, sortable: true },
  ];
  const farmColumns: Column[] = [
    { key: 'farm', label: copy('farms.farm'), sortable: true },
    { key: 'state', label: copy('farms.state'), sortable: true },
    { key: 'published', label: copy('farms.published') },
    { key: 'years', label: copy('farms.years') },
    { key: 'source', label: copy('farms.source') },
  ];
  const trend = h.acreageByState.trend;

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-8 px-(--app-margin) py-8">
      <Breadcrumb
        label={t('global.site.header.nav_label')}
        items={[
          { href: href(paths.hops), text: copy('links.back') },
          { text: h.name },
        ]}
      />
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{h.name}</h1>
        <p className="type-body-large"><TextLink href={href(paths.hopFarms)}>{copy('links.farms')}</TextLink></p>
      </header>

      <div className="flex flex-col gap-6">
        <HopProfileCard data={hopCardData(h, { link: false })} headingLevel={2} />
        {dataRows.length ? <SpecCard id="variety-data" title={copy('data.title')} rows={dataRows} /> : <p className="type-body-medium text-on-surface-variant">{copy('data.missing')}</p>}
      </div>

      <Section id="aroma" title={copy('aroma.title')} note={h.aromaRows.length ? copy('aroma.note') : undefined}>
        {h.aromaRows.length ? (
          <DataTable
            caption={copy('aroma.title')}
            sortHint={sortHint}
            columns={aromaColumns}
            rows={h.aromaRows.map((a, i) => ({ key: `${a.descriptor}-${i}`, sort: { descriptor: a.descriptor }, cells: { descriptor: a.descriptor, source: <Sources sources={a.source} /> } }))}
            scroll={false}
          />
        ) : <p className="type-body-medium text-on-surface-variant">{copy('aroma.missing')}</p>}
      </Section>

      <Section id="acreage" title={copy('acreage.title')}>
        {h.acreageByState.rows.length ? (
          <>
            {trend.years.length > 1 ? (
              <ChartCard
                id="acreage-trend"
                title={copy('acreage.chart_title')}
                note={copy('acreage.chart_note')}
                categories={trend.years}
                series={[{ name: copy('acreage.series'), values: trend.totals }]}
                tableSummary={copy('acreage.table_summary')}
                nameColumn={copy('acreage.name_column')}
                ariaLabel={copy('acreage.chart_label', { name: h.name })}
              />
            ) : null}
            <DataTable
              caption={copy('acreage.title')}
              sortHint={sortHint}
              columns={acreageColumns}
              rows={h.acreageByState.rows.map((a, i) => ({
                key: `${a.state}-${a.year}-${i}`,
                sort: { state: a.state, year: a.year, acres: a.acres, production: a.production },
                cells: {
                  state: text(a.state),
                  year: a.year === null ? none : String(a.year),
                  acres: a.acres === null ? none : fmt.number(a.acres),
                  production: a.production === null ? none : fmt.number(a.production),
                  source: <Sources sources={a.source} />,
                },
              }))}
              scroll={false}
            />
          </>
        ) : <p className="type-body-medium text-on-surface-variant">{copy('acreage.missing')}</p>}
      </Section>

      <Section id="beers" title={copy('beers.title', { year })} note={copy('beers.note')}>
        {h.beerRows.length ? (
          <DataTable
            caption={copy('beers.title', { year })}
            sortHint={sortHint}
            columns={beerColumns}
            rows={h.beerRows.map((b) => {
              const c = beerCells(b);
              const other = b.otherFarms.length ? b.otherFarms.join(', ') : null;
              return {
                key: b.stem,
                sort: c.sort,
                cells: { ...c.cells, form: joined(b.forms), use: joined(b.uses), farm: b.farms.length ? farmLinks(b.farms) : other ?? none },
              };
            })}
            initialSort={{ key: 'medal', dir: 'ascending' }}
            scroll={false}
          />
        ) : <p className="type-body-medium text-on-surface-variant">{copy('beers.missing', { year })}</p>}
      </Section>

      <Section id="breweries" title={copy('breweries.title', { year })} note={copy('breweries.note')}>
        {h.breweries.length ? (
          <DataTable
            caption={copy('breweries.title', { year })}
            sortHint={sortHint}
            columns={breweryColumns}
            rows={h.breweries.map((b) => ({
              key: b.brewerySlug,
              sort: { brewery: b.brewery, count: b.count },
              cells: { brewery: <TextLink href={href(paths.brewery(b.brewerySlug))}>{b.brewery}</TextLink>, count: fmt.number(b.count) },
            }))}
            initialSort={{ key: 'count', dir: 'descending' }}
            scroll={false}
          />
        ) : <p className="type-body-medium text-on-surface-variant">{copy('breweries.missing', { year })}</p>}
      </Section>

      <Section id="farms" title={copy('farms.title')} note={<><strong>{copy('farms.label')}</strong> {copy('farms.note')}</>}>
        {h.farmRows.length ? (
          <DataTable
            caption={copy('farms.title')}
            sortHint={sortHint}
            columns={farmColumns}
            rows={h.farmRows.map((f) => ({
              key: f.slug,
              sort: { farm: f.name, state: f.state },
              cells: {
                farm: <TextLink href={href(paths.hopFarm(f.slug))}>{f.name}</TextLink>,
                state: text(f.state),
                published: f.published.join(', '),
                years: f.years.length ? f.years.join(', ') : none,
                source: <Sources sources={f.sources} />,
              },
            }))}
            initialSort={{ key: 'farm', dir: 'ascending' }}
            scroll={false}
          />
        ) : <p className="type-body-medium text-on-surface-variant">{copy('farms.missing')}</p>}
      </Section>

      {h.notesHtml ? (
        <section aria-labelledby="notes-title" className="flex min-w-0 flex-col gap-4">
          <h2 id="notes-title" className="type-headline-small text-on-surface">{copy('doc.title')}</h2>
          <div className="prose min-w-0" dangerouslySetInnerHTML={{ __html: h.notesHtml }} />
        </section>
      ) : null}
    </main>
  );
}
