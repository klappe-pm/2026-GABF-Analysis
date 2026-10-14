// The hop farms index at /hop-farms/: US hop farms grouped by state with the varieties each publishes,
// then the hop merchants and what the research could not find.
import type { Metadata } from 'next';
import { type Column, DataTable } from '@/components/DataTable';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';
import { t } from '@/lib/content';
import { fmt } from '@/lib/data';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { hopFarmsIndex } from '../hops/data';
import { ReferenceTable } from '../hops/parts';

const page = (key: string) => `pages.hop-farms.${key}`;

export function generateMetadata(): Metadata {
  return pageMetadata({ title: t(page('page.title')), description: t(page('page.description')), path: paths.hopFarms });
}

export default async function HopFarmsPage() {
  const index = await hopFarmsIndex();
  const sortHint = t(page('table.sort_hint'));
  const columns: Column[] = [
    { key: 'name', label: t(page('table.farm')), sortable: true },
    { key: 'varieties', label: t(page('table.varieties')), numeric: true, sortable: true },
    { key: 'grown', label: t(page('table.grown')), numeric: true, sortable: true },
    { key: 'named', label: t(page('table.named')), numeric: true, sortable: true },
  ];
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-8 px-(--app-margin) py-8">
      <header className="flex flex-col gap-3">
        <h1 className="type-display-small text-on-surface">{t(page('page.title'))}</h1>
        <p className="type-body-large max-w-measure text-on-surface-variant">{t(page('page.lede'))}</p>
        <p className="type-body-large"><TextLink href={href(paths.hops)}>{t(page('links.hops'))}</TextLink></p>
      </header>
      {index.states.length ? index.states.map((s) => {
        const title = s.name ?? t(page('table.no_state'));
        return (
          <section key={s.code || 'none'} aria-labelledby={`state-${s.code || 'none'}-title`} className="flex min-w-0 flex-col gap-3">
            <h2 id={`state-${s.code || 'none'}-title`} className="type-headline-small text-on-surface">{title}</h2>
            <DataTable
              caption={title}
              sortHint={sortHint}
              columns={columns}
              rows={s.farms.map((f) => ({
                key: f.slug,
                sort: { name: f.name, varieties: f.varieties, grown: f.grown, named: f.named },
                cells: {
                  name: <TextLink href={href(paths.hopFarm(f.slug))}>{f.name}</TextLink>,
                  varieties: fmt.number(f.varieties),
                  grown: fmt.number(f.grown),
                  named: fmt.number(f.named),
                },
              }))}
              initialSort={{ key: 'name', dir: 'ascending' }}
              scroll={false}
            />
          </section>
        );
      }) : <StateCard kind="empty" title={t(page('states.empty'))} />}
      {index.merchants ? (
        <section aria-labelledby="merchants-title" className="flex min-w-0 flex-col gap-3">
          <h2 id="merchants-title" className="type-headline-small text-on-surface">{t(page('merchants.title'))}</h2>
          <ReferenceTable table={index.merchants} caption={t(page('merchants.title'))} sortHint={sortHint} />
        </section>
      ) : null}
      {index.gaps ? (
        <section aria-labelledby="gaps-title" className="flex min-w-0 flex-col gap-3">
          <h2 id="gaps-title" className="type-headline-small text-on-surface">{t(page('gaps.title'))}</h2>
          <p className="type-body-medium max-w-measure text-on-surface-variant">{t(page('gaps.note'))}</p>
          <ReferenceTable table={index.gaps} caption={t(page('gaps.title'))} sortHint={sortHint} />
        </section>
      ) : null}
    </main>
  );
}
