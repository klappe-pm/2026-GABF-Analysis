// The data a beer profile card draws, from a beer's record. The beer's own page and every list of beers
// (the hop and hop farm pages) build their cards here, so a card reads the same wherever it appears.
import type { BeerCardData } from '@/components/BeerProfileCard';
import type { MedalName } from '@/components/MedalMark';
import { fill, group, lookup, t } from '@/lib/content';
import { fmt } from '@/lib/data';
import { href, paths } from '@/lib/href';
import type { BeerRecord } from '@/lib/site-data';

const raw = (key: string) => lookup(key) as string;
const copy = (key: string) => t(`pages.beer-detail.${key}`);
const site = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

export type BeerCardRecord = Omit<BeerRecord, 'notesHtml'>;

// `inList` adds the link to the beer's own page, which a card on the beer's own page leaves out for the
// link to the beer's page at the brewery.
export function beerCardData(b: BeerCardRecord, { inList = false }: { inList?: boolean } = {}): BeerCardData {
  const none = t('global.labels.not_found');
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
    link: inList
      ? { href: href(paths.beer(b.year, b.stem)), text: copy('card.open') }
      : b.beerUrl ? { href: b.beerUrl, text: copy('card.beer_page') } : undefined,
  };
}
