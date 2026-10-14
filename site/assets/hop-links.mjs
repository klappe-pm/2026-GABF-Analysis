// Hop and hop farm links shared by the build (Node) and the browser views. A hop variety or farm
// is addressed by one slug everywhere: the page folder, the link, and the data attribute.

import { esc } from './charts.mjs';

// "Hallertau Mittelfrüh" becomes "hallertau-mittelfruh"; "BRU-1" becomes "bru-1".
export function hopSlug(name) {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Words the shared views draw. The build replaces these with the entries of the copy documents
// (pages/hop-detail.md, group shared_views) and ships them on meta.copy.hops, so the browser draws
// the same words; the defaults only serve a caller that has no meta.
export const HOP_COPY_DEFAULTS = {
  column: 'Hops',
  none: 'Not defined',
  brewery_title: 'Hops in these medal beers',
  brewery_note: 'Each variety links to its page, with the farms that grow it.',
  brewery_variety: 'Hop variety',
  brewery_beers: 'Medal beers',
  brewery_farm: 'Farm',
  brewery_farms_named_title: 'Farms these breweries named',
  brewery_farms_named_label: 'Brewery named this farm.',
  brewery_farms_named_note: 'The brewery published this farm for a hop in one of these beers.',
  brewery_farms_grown_title: 'Farms that grow these hops',
  brewery_farms_grown_label: 'Grown by.',
  brewery_farms_grown_note: 'These farms publish a variety used in these beers as grown. It does not mean the brewery bought from them.',
};

export const hopCopy = (meta) => ({ ...HOP_COPY_DEFAULTS, ...(meta?.copy?.hops ?? {}) });

// Links to the variety pages for a list of canonical variety names, comma separated. A beer with
// no hops on record reads as the shared "not defined" text.
export function hopLinksHtml(names, { r, none = HOP_COPY_DEFAULTS.none } = {}) {
  const list = Array.isArray(names) ? names.filter(Boolean) : [];
  if (!list.length) return `<span class="muted">${esc(none)}</span>`;
  return list.map((n) => `<a href="${r}hops/${esc(hopSlug(n))}/">${esc(n)}</a>`).join(', ');
}
