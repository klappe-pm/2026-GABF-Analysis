// The reference port of a detail page: one winning beer at /beers/2026/<stem>/, the same address as the
// current site. The beer profile card heads the page; the research notes follow.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { type BeerCardData, BeerProfileCard } from '@/components/BeerProfileCard';
import { Breadcrumb } from '@/components/Breadcrumb';
import type { MedalName } from '@/components/MedalMark';
import { fill, group, lookup, t } from '@/lib/content';
import { fmt } from '@/lib/data';
import { href, paths } from '@/lib/href';
import { pageMetadata } from '@/lib/seo';
import { HopProfile } from '../../../hops/profile';
import { type BeerRecord, beer as loadBeer, staticParams } from '@/lib/site-data';

type Params = { year: string; stem: string };

export const dynamicParams = false;
export const generateStaticParams = staticParams.beers;

const raw = (key: string) => lookup(key) as string;
const copy = (key: string) => t(`pages.beer-detail.${key}`);
const site = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

async function record(params: Promise<Params>): Promise<BeerRecord> {
  const b = await loadBeer((await params).stem);
  if (!b) notFound();
  return b;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const b = await record(params);
  const medals = group('global.labels.medal');
  return pageMetadata({
    title: fill(raw('global.navigation.page_titles.beer_detail'), { beer_name: b.beer, brewery_name: b.brewery }),
    description: fill(raw('global.navigation.page_descriptions.beer_detail'), { beer_name: b.beer, brewery_name: b.brewery, medal: medals[b.medal] ?? b.medal, category_name: b.category, year: b.year }),
    path: paths.beer(b.year, b.stem),
  });
}

function cardData(b: BeerRecord): BeerCardData {
  const none = copy('specs.not_published');
  const medals = group('global.labels.medal');
  const note = b.tastingNote ? { label: copy('card.tasting_note'), ...b.tastingNote } : b.description ? { label: copy('card.description'), ...b.description } : null;
  return {
    name: b.beer,
    breweryLine: fill(raw('pages.beer-detail.card.brewery_line'), { brewery_name: b.brewery, city: b.city, state: b.state }),
    medal: b.medal as MedalName,
    medalLabel: fill(raw('pages.beer-detail.lede.medal_line'), { medal: medals[b.medal] ?? b.medal, category_name: b.category }),
    facts: [
      { label: copy('card.category'), value: b.category },
      { label: copy('card.entries'), value: b.entries === null ? none : fmt.number(b.entries) },
      { label: copy('card.abv'), value: b.abv === null ? none : fmt.abv(b.abv) },
      { label: copy('card.ibu'), value: b.ibu === null ? none : String(b.ibu) },
      { label: copy('card.style'), value: b.style ?? none },
      { label: copy('specs.malts'), value: b.malts.length ? b.malts.join(', ') : none },
      { label: copy('specs.yeast'), value: b.yeast.length ? b.yeast.join(', ') : none },
      { label: copy('specs.adjuncts'), value: b.adjuncts.length ? b.adjuncts.join(', ') : none },
    ],
    hops: b.hops.map((h) => ({ name: h.name, href: href(paths.hop(h.slug)) })),
    hopsLabel: copy('card.hops'),
    noHops: none,
    note: note ? { label: note.label, text: note.text, source: note.source ? { href: note.source, text: fill(raw('pages.beer-detail.card.source'), { site: site(note.source) }) } : undefined } : null,
    noNote: none,
    link: b.beerUrl ? { href: b.beerUrl, text: copy('card.beer_page') } : undefined,
  };
}

export default async function BeerPage({ params }: { params: Promise<Params> }) {
  const b = await record(params);
  const links = [
    b.brewerySlug ? { href: href(paths.brewery(b.brewerySlug)), text: copy('buttons.brewery_history') } : null,
    b.categorySlug ? { href: href(paths.category(b.categorySlug)), text: copy('buttons.category_history') } : null,
    b.breweryUrl ? { href: b.breweryUrl, text: copy('buttons.brewery_website') } : null,
  ].filter((l): l is { href: string; text: string } => l !== null);
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-(--app-page-max) flex-col gap-6 px-(--app-margin) py-8">
      <Breadcrumb
        label={t('global.site.header.nav_label')}
        items={[
          { href: href(paths.winners(b.year)), text: fill(raw('pages.beer-detail.links.back'), { year: b.year }) },
          { text: fill(raw('pages.beer-detail.links.category_number'), { number: b.categoryNumber }) },
        ]}
      />
      <BeerProfileCard data={cardData(b)} headingLevel={1} />
      {links.length ? (
        <p className="flex flex-wrap gap-2">
          {links.map((l) => <md-outlined-button key={l.href} href={l.href}>{l.text}</md-outlined-button>)}
        </p>
      ) : null}
      <HopProfile stem={b.stem} />
      <section aria-labelledby="notes-title" className="flex min-w-0 flex-col gap-4">
        <h2 id="notes-title" className="type-headline-small text-on-surface">{copy('notes.title')}</h2>
        <div className="prose min-w-0" dangerouslySetInnerHTML={{ __html: b.notesHtml }} />
      </section>
    </main>
  );
}
