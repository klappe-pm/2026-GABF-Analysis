// The hops index at /hops/: every hop variety on record with its medal beers, medals, and growing farms,
// then a profile card for each.
import type { Metadata } from 'next';
import { type Column, DataTable } from '@/components/DataTable';
import { HopProfileCard } from '@/components/HopProfileCard';
import { Field, FieldGrid } from '@/components/StatCard';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { fill, group, t } from '@/lib/content';
import { fmt } from '@/lib/data';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { hopsIndex } from './data';
import { hopCardData, notDefined, raw } from './parts';

const page = (key: string) => `pages.hops.${key}`;

export async function generateMetadata(): Promise<Metadata> {
  const { year } = await hopsIndex();
  return pageMetadata({ title: t(page('page.title')), description: fill(raw(page('page.description')), { year }), path: paths.hops });
}

export default async function HopsPage() {
  const index = await hopsIndex();
  const { year } = index;
  const medals = group('global.labels.medal');
  const columns: Column[] = [
    { key: 'name', label: t(page('table.variety')), sortable: true },
    { key: 'origin', label: t(page('table.origin')), sortable: true },
    { key: 'beers', label: t(page('table.beers')), numeric: true, sortable: true },
    { key: 'medals', label: t(page('table.medals')), numeric: true, sortable: true },
    { key: 'gold', label: medals.Gold, numeric: true, sortable: true },
    { key: 'silver', label: medals.Silver, numeric: true, sortable: true },
    { key: 'bronze', label: medals.Bronze, numeric: true, sortable: true },
    { key: 'farms', label: t(page('table.farms')), numeric: true, sortable: true },
  ];
  const rows = index.varieties.map((v) => ({
    key: v.slug,
    sort: { name: v.name, origin: v.origin, beers: v.beers, medals: v.medals, gold: v.gold, silver: v.silver, bronze: v.bronze, farms: v.farms },
    cells: {
      name: <TextLink href={href(paths.hop(v.slug))}>{v.name}</TextLink>,
      origin: v.origin ?? notDefined(),
      beers: fmt.number(v.beers),
      medals: fmt.number(v.medals),
      gold: fmt.number(v.gold),
      silver: fmt.number(v.silver),
      bronze: fmt.number(v.bronze),
      farms: fmt.number(v.farms),
    },
  }));
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-6 px-(--app-margin) py-8">
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{t(page('page.title'))}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{fill(raw(page('page.lede')), { year })}</p>
        <p className="type-body-large flex flex-wrap gap-x-6 gap-y-2">
          <TextLink href={href(paths.hopFarms)}>{t(page('links.farms'))}</TextLink>
          <TextLink href={href(paths.winners(year))}>{fill(raw(page('links.winners')), { year })}</TextLink>
        </p>
      </header>
      <FieldGrid label={t(page('page.title'))}>
        <Field label={t(page('stats.varieties'))}>{fmt.number(index.varieties.length)}</Field>
        <Field label={t(page('stats.used'))} note={fill(raw(page('stats.used_note')), { year })}>{fmt.number(index.used)}</Field>
        <Field label={t(page('stats.farms'))}>{fmt.number(index.farmCount)}</Field>
      </FieldGrid>
      {rows.length ? (
        <>
          <DataTable caption={t(page('table.caption'))} sortHint={t(page('table.sort_hint'))} columns={columns} rows={rows} initialSort={{ key: 'medals', dir: 'descending' }} scroll={false} />
          <p className="type-body-medium max-w-measure text-on-surface-variant">{fill(raw(page('page.note')), { year })}</p>
        </>
      ) : (
        <StateCard kind="empty" title={t(page('states.empty'))} />
      )}
      {rows.length ? (
        <section aria-labelledby="hop-cards-title" className="flex flex-col gap-4">
          <h2 id="hop-cards-title" className="type-headline-small text-on-surface">{t('pages.profile-cards.hop.section')}</h2>
          <div className="grid grid-cols-1 gap-4 medium:grid-cols-2 expanded:grid-cols-3">
            {index.varieties.map((v) => <HopProfileCard key={v.slug} data={hopCardData(v.card)} headingLevel={3} />)}
          </div>
        </section>
      ) : null}
    </main>
  );
}
