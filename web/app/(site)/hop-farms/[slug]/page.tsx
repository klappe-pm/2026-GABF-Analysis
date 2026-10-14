// One hop farm at /hop-farms/<farm>/: its data, the varieties it grows, and the medal beers linked to it in
// two separate tables, named by the brewery and grown through a variety. The two are never combined.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { type Column, DataTable } from '@/components/DataTable';
import { HopProfileCard } from '@/components/HopProfileCard';
import { SpecCard, type SpecRow } from '@/components/SpecCard';
import { TextLink } from '@/components/TextLink';
import { group, t } from '@/lib/content';
import { fmt } from '@/lib/data';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { staticParams, WINNER_YEAR } from '@/lib/site-data';
import { type HopFarm, hopFarm as loadFarm } from '../../hops/data';
import { FilteredBeers, FilteredBreweries, PageYear } from '../../hops/filtered';
import { BEER_COLUMNS, beerRow, CellView, filteredCopy, hopCardData, hopLinks, notDefined, ReferenceTable, Sources } from '../../hops/parts';

type Params = { slug: string };

export const dynamicParams = false;
export const generateStaticParams = staticParams.hopFarms;

const year = WINNER_YEAR;
const copy = (key: string, values: Record<string, string | number> = {}) => t(`pages.hop-farm-detail.${key}`, values);

async function record(params: Promise<Params>): Promise<HopFarm> {
  const f = await loadFarm((await params).slug);
  if (!f) notFound();
  return f;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const f = await record(params);
  return pageMetadata({ title: f.name, description: copy('meta.description', { name: f.name }), path: paths.hopFarm(f.slug) });
}

function Section({ id, title, note, whole = false, children }: { id: string; title: string; note?: React.ReactNode; whole?: boolean; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-3">
      <h2 id={`${id}-title`} className="type-headline-small text-on-surface">{title}</h2>
      {note ? <p className="type-body-medium max-w-measure text-on-surface-variant">{note}</p> : null}
      {whole ? <p className="type-label-large text-on-surface-variant">{copy('unfiltered.note')}</p> : null}
      {children}
    </section>
  );
}

export default async function HopFarmPage({ params }: { params: Promise<Params> }) {
  const f = await record(params);
  const none = notDefined();
  const filtered = filteredCopy();
  const sortHint = copy('table.sort_hint');
  const missing = (key: string) => <p className="type-body-medium text-on-surface-variant">{copy(key, { year })}</p>;

  const dataRows: SpecRow[] = [
    { label: copy('data.state'), value: f.state ?? none },
    ...(f.aliases.length ? [{ label: copy('data.aliases'), value: f.aliases.join(', ') }] : []),
    ...f.data.map((d) => ({ label: d.label, value: <CellView cell={d.value} field={d.key} /> })),
    ...f.sourceRows.map((s) => ({ label: s.label, value: <Sources sources={s.sources} /> })),
  ];

  const varietyColumns: Column[] = [
    { key: 'variety', label: copy('varieties.variety'), sortable: true },
    { key: 'published', label: copy('varieties.published') },
    { key: 'years', label: copy('varieties.years') },
    { key: 'medals', label: copy('varieties.medal_beers', { year }), numeric: true, sortable: true },
    { key: 'source', label: copy('varieties.source') },
    { key: 'verified', label: copy('varieties.verified') },
    { key: 'notes', label: copy('varieties.notes') },
  ];
  const namedColumns: Column[] = [
    ...BEER_COLUMNS((k) => t(`pages.hop-detail.beers.${k}`)),
    { key: 'hop', label: copy('named.hop') },
    { key: 'published', label: copy('named.published') },
    { key: 'source', label: copy('named.source') },
  ];
  const grownColumns: Column[] = [...BEER_COLUMNS((k) => t(`pages.hop-detail.beers.${k}`)), { key: 'hops', label: copy('grown.hops') }];
  const labels = group('global.labels.verified');
  const verified = (list: string[]) => (list.length ? list.map((v) => labels[v] ?? v).join(', ') : none);

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-8 px-(--app-margin) py-8">
      <Breadcrumb
        label={t('global.site.header.nav_label')}
        items={[
          { href: href(paths.hopFarms), text: copy('links.back') },
          { text: f.name },
        ]}
      />
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{f.name}</h1>
        <p className="type-body-large flex flex-wrap gap-x-6 gap-y-1 text-on-surface-variant">
          {f.state ? <span>{f.state}</span> : null}
          <span>{copy('pills.varieties', { count: f.counts.varieties })}</span>
        </p>
        <p className="type-body-large"><TextLink href={href(paths.hops)}>{copy('links.hops')}</TextLink></p>
      </header>

      <SpecCard id="farm-data" title={copy('data.title')} rows={dataRows} />

      <Section id="varieties" whole title={copy('varieties.title')}>
        {f.varieties.length ? (
          <>
            <DataTable
              caption={copy('varieties.title')}
              sortHint={sortHint}
              columns={varietyColumns}
              rows={f.varieties.map((v) => ({
                key: v.slug,
                sort: { variety: v.name, medals: v.medals },
                cells: {
                  variety: <TextLink href={href(paths.hop(v.slug))}>{v.name}</TextLink>,
                  published: v.published.join(', '),
                  years: v.years.length ? v.years.join(', ') : none,
                  medals: fmt.number(v.medals),
                  source: <Sources sources={v.sources} />,
                  verified: verified(v.verified),
                  notes: v.notes.length ? v.notes.join(' ') : none,
                },
              }))}
              initialSort={{ key: 'variety', dir: 'ascending' }}
              scroll={false}
            />
            <div className="grid grid-cols-1 gap-4 medium:grid-cols-2 expanded:grid-cols-3">
              {f.varietyCards.map((c) => <HopProfileCard key={c.slug} data={hopCardData(c)} headingLevel={3} />)}
            </div>
          </>
        ) : missing('varieties.missing')}
      </Section>

      <PageYear year={year} fixedYear={filtered.fixedYear} />
      <Section id="named" title={copy('named.title', { year })} note={<><strong>{copy('named.label')}</strong> {copy('named.note')}</>}>
        {f.named.length ? (
          <FilteredBeers
            rows={f.named.map((b) => beerRow(b, { hop: hopLinks(b.hops), published: b.published.join(', '), source: <Sources sources={b.sources} /> }))}
            columns={namedColumns}
            initialSort={{ key: 'medal', dir: 'ascending' }}
            caption={copy('named.title', { year })}
            sortHint={sortHint}
            copy={filtered}
          />
        ) : missing('named.missing')}
      </Section>

      <Section id="grown" title={copy('grown.title', { year })} note={<><strong>{copy('grown.label')}</strong> {copy('grown.note')}</>}>
        {f.grown.length ? (
          <FilteredBeers
            rows={f.grown.map((b) => beerRow(b, { hops: hopLinks(b.hops) }))}
            columns={grownColumns}
            initialSort={{ key: 'medal', dir: 'ascending' }}
            caption={copy('grown.title', { year })}
            sortHint={sortHint}
            copy={filtered}
          />
        ) : missing('grown.missing')}
      </Section>

      <Section id="breweries" title={copy('breweries.title', { year })} note={copy('breweries.note')}>
        {f.named.length || f.grown.length ? (
          <FilteredBreweries
            rows={[
              ...f.named.map((b) => ({ ...b.filter, brewery: b.brewery, brewerySlug: b.brewerySlug, kind: 'named' })),
              ...f.grown.map((b) => ({ ...b.filter, brewery: b.brewery, brewerySlug: b.brewerySlug, kind: 'grown' })),
            ]}
            columns={{ brewery: copy('breweries.brewery'), kind: copy('breweries.link'), beers: copy('breweries.beers') }}
            kindLabels={{ named: copy('breweries.named'), grown: copy('breweries.grown') }}
            caption={copy('breweries.title', { year })}
            sortHint={sortHint}
            copy={filtered}
          />
        ) : missing('breweries.missing')}
      </Section>

      {f.merchants ? (
        <Section id="merchants" whole title={copy('merchants.title')}>
          <ReferenceTable table={f.merchants} caption={copy('merchants.title')} sortHint={sortHint} />
        </Section>
      ) : null}

      {f.notesHtml ? (
        <section aria-labelledby="notes-title" className="flex min-w-0 flex-col gap-4">
          <h2 id="notes-title" className="type-headline-small text-on-surface">{copy('doc.title')}</h2>
          <div className="prose min-w-0" dangerouslySetInnerHTML={{ __html: f.notesHtml }} />
        </section>
      ) : null}
    </main>
  );
}
