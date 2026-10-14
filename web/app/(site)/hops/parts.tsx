// Pieces the hop, hop farm, and beer pages share: source links, reference table cells, beer and hop links,
// the hop profile card's data, and a reference table. Every word comes from the copy documents.
import { Fragment, type ReactNode } from 'react';
import { type Column, DataTable } from '@/components/DataTable';
import type { HopCardData } from '@/components/HopProfileCard';
import { MedalMark, type MedalName } from '@/components/MedalMark';
import { TextLink } from '@/components/TextLink';
import { fill, group, lookup, t } from '@/lib/content';
import { fmt } from '@/lib/data';
import { href, paths } from '@/lib/href';
import { WINNER_YEAR } from '@/lib/site-data';
import { beerCardData } from '../beers/cards';
import type { BeerRef, Cell, FarmLink, HopCard, Source, Table } from './data';
import type { FilteredCopy } from './filtered';

export const raw = (key: string) => lookup(key) as string;
export const notDefined = () => t('global.labels.not_found');

// Sources as links, one under another. Plain text sources stay text.
export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return <>{notDefined()}</>;
  return (
    <>
      {sources.map((s, i) => (
        <Fragment key={`${s.label}-${s.url}-${i}`}>
          {i ? <br /> : null}
          {s.url ? <TextLink href={s.url} rel="noopener">{s.label}</TextLink> : s.label}
        </Fragment>
      ))}
    </>
  );
}

const VERIFIED = () => group('global.labels.verified');

// A reference table cell, or "not defined" when the table holds nothing. A verified flag reads as its label.
export function CellView({ cell, field }: { cell: Cell; field?: string }) {
  if (!cell) return <>{notDefined()}</>;
  if ('sources' in cell) return <Sources sources={cell.sources} />;
  if (field === 'verified') return <>{VERIFIED()[cell.text] ?? cell.text}</>;
  return <>{cell.text}</>;
}

export const joined = (list: string[]): ReactNode => (list.length ? list.join(', ') : notDefined());

export function Links({ items }: { items: { href: string; text: string }[] }) {
  return (
    <>
      {items.map((x, i) => (
        <Fragment key={x.href}>{i ? ', ' : ''}<TextLink href={x.href}>{x.text}</TextLink></Fragment>
      ))}
    </>
  );
}

export const hopLinks = (list: { name: string; slug: string }[]): ReactNode => (list.length ? <Links items={list.map((h) => ({ href: href(paths.hop(h.slug)), text: h.name }))} /> : notDefined());
export const farmLinks = (list: FarmLink[]): ReactNode => (list.length ? <Links items={list.map((f) => ({ href: href(paths.hopFarm(f.slug)), text: f.name }))} /> : notDefined());

export type BeerLinkData = { stem: string; year: number; beer: string; medal: string; brewery: string; brewerySlug: string; category: string; categorySlug: string };

// The four columns every medal beer table opens with: medal, beer, brewery, category.
export const BEER_COLUMNS = (key: (k: string) => string): Column[] => [
  { key: 'medal', label: key('medal'), sortable: true },
  { key: 'beer', label: key('beer'), sortable: true },
  { key: 'brewery', label: key('brewery'), sortable: true },
  { key: 'category', label: key('category'), sortable: true },
];
const MEDAL_RANK: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };
export function beerCells(b: BeerLinkData) {
  const medals = group('global.labels.medal');
  return {
    sort: { medal: MEDAL_RANK[b.medal] ?? 9, beer: b.beer, brewery: b.brewery, category: b.category },
    cells: {
      medal: <span className="inline-flex items-center gap-2"><MedalMark medal={b.medal as MedalName} size="sm" title={medals[b.medal] ?? b.medal} />{medals[b.medal] ?? b.medal}</span>,
      beer: <TextLink href={href(paths.beer(b.year, b.stem))}>{b.beer}</TextLink>,
      brewery: <TextLink href={href(paths.brewery(b.brewerySlug))}>{b.brewery}</TextLink>,
      category: <TextLink href={href(paths.category(b.categorySlug))}>{b.category}</TextLink>,
    },
  };
}

// A merchants or gaps table: columns and cells exactly as the reference table holds them.
export function ReferenceTable({ table, caption, sortHint }: { table: Table; caption: string; sortHint: string }) {
  const columns: Column[] = table.columns.map((c) => ({ key: c.key, label: c.label, sortable: true }));
  const rows = table.rows.map((r, i) => ({
    key: String(i),
    sort: Object.fromEntries(table.columns.map((c) => [c.key, r[c.key] ? ('text' in r[c.key]! ? (r[c.key] as { text: string }).text : (r[c.key] as { sources: Source[] }).sources.map((s) => s.label).join(' ')) : null])),
    cells: Object.fromEntries(table.columns.map((c) => [c.key, <CellView key={c.key} cell={r[c.key]} field={c.key} />])),
  }));
  return <DataTable caption={caption} sortHint={sortHint} columns={columns} rows={rows} scroll={false} />;
}

// The data a hop profile card draws. `link` adds the line to the hop's own page.
export function hopCardData(h: HopCard, { link = true }: { link?: boolean } = {}): HopCardData {
  const none = notDefined();
  const hc = (k: string) => t(`pages.hop-detail.card.${k}`, k === 'beers' ? { year: WINNER_YEAR } : {});
  const detail = (k: string) => t(`pages.hop-detail.data.${k}`);
  const card = (k: string, v: Record<string, string | number>) => fill(raw(`pages.hop-detail.card.${k}`), v);
  return {
    name: h.name,
    facts: [
      { label: detail('origin'), value: h.origin ?? none },
      { label: detail('breeder'), value: h.breeder ?? none, wide: true },
      { label: hc('alpha'), value: h.alpha ? card('range_percent', { min: fmt.one(h.alpha.min), max: fmt.one(h.alpha.max) }) : none },
      { label: hc('oil'), value: h.oil ? card('oil_range', { min: fmt.one(h.oil.min), max: fmt.one(h.oil.max) }) : none },
      { label: hc('acreage'), value: h.acreage ? fill(raw('pages.profile-cards.hop.acreage_value'), { acres: fmt.number(h.acreage.acres), year: h.acreage.year, states: h.acreage.states }) : none },
      { label: hc('beers'), value: fmt.number(h.beers) },
    ],
    aroma: {
      label: hc('aroma'),
      text: h.aroma ? h.aroma.descriptors.join(', ') : null,
      source: h.aroma?.source?.url ? { href: h.aroma.source.url, text: fill(raw('pages.beer-detail.card.source'), { site: h.aroma.source.label }) } : undefined,
    },
    farms: {
      label: hc('farms'),
      items: h.farms.map((f) => ({ name: f.state ? card('farm_line', { farm_name: f.name, state: f.state }) : f.name, href: href(paths.hopFarm(f.slug)) })),
      more: raw('pages.profile-cards.hop.more'),
    },
    notDefined: none,
    link: link ? { href: href(paths.hop(h.slug)), text: hc('open') } : undefined,
  };
}

// The words the filtered beer views of a page need, all from the copy documents.
export function filteredCopy(): FilteredCopy {
  return {
    countOne: t('global.filters.live_region.one'),
    countMany: raw('global.filters.live_region.many'),
    emptyTitle: t('global.states.no_results.title'),
    emptyHint: t('global.states.no_results.remove_hint'),
    fixedYear: fill(raw('global.filters.chips.fixed_year'), { year: WINNER_YEAR }),
    cardsTitle: t('pages.hop-detail.beers.cards_title'),
  };
}

// A beer as a row of a filtered view: the fields the filter reads, its table cells, and its profile card.
export function beerRow(b: BeerRef, extra: Record<string, ReactNode>) {
  const c = beerCells(b);
  return { ...b.filter, key: b.stem, sort: c.sort, cells: { ...c.cells, ...extra }, card: beerCardData(b.card, { inList: true }) };
}
