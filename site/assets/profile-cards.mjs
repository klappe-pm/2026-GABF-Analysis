// The beer profile card, shared by the build and the browser views. One card per researched
// medal beer: name, brewery, medal, category, ABV, IBU, style, hop chips that link to the variety
// pages, a tasting note excerpt with its source, and a link to the beer's full profile.

import { NOT_FOUND } from './not-found.mjs';
import { esc } from './charts.mjs';
import { hopSlug } from './hop-links.mjs';

// Words on the card. The build replaces these with pages/profile-cards.md (group beer), shipped on
// meta.copy.cards; the defaults only serve a caller that has no meta.
export const BEER_CARD_DEFAULTS = {
  section: 'Beer profile cards',
  abv: 'ABV',
  ibu: 'IBU',
  style: 'Style',
  hops: 'Hops',
  tasting: 'Tasting note',
  source: 'Source',
  deep_dive: 'Open the beer profile',
  none: NOT_FOUND,
};
export const beerCardCopy = (meta) => ({ ...BEER_CARD_DEFAULTS, ...(meta?.copy?.cards ?? {}) });

const RANK = { Gold: 1, Silver: 2, Bronze: 3 };
const has = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

// x is a medal row (or a hop model beer row) carrying the fields in RESULT_FIELDS.
export function beerCardHtml(x, { r, meta = null } = {}) {
  const c = beerCardCopy(meta);
  const none = `<span class="muted">${esc(c.none)}</span>`;
  const medal = String(x.medal ?? '');
  const hops = (x.hop_varieties ?? []).length
    ? `<span class="chips">${x.hop_varieties.map((n) => `<a class="chip" href="${r}hops/${esc(hopSlug(n))}/">${esc(n)}</a>`).join('')}</span>`
    : none;
  const note = x.tasting_note
    ? `<p class="small">${esc(x.tasting_note)}${x.tasting_source ? ` <span class="muted">${esc(c.source)}: <a href="${esc(x.tasting_source)}" rel="noopener">${esc(hostOf(x.tasting_source))}</a></span>` : ''}</p>`
    : `<p class="small">${none}</p>`;
  return `<article class="card profile-card beer-profile-card">
<h3><a href="${r}${esc(x.beer_profile)}">${esc(x.beer_name)}</a></h3>
<p class="small"><span class="pill medal-pill ${esc(medal.toLowerCase())}"><span class="badge-medal ${esc(medal.toLowerCase())}" aria-hidden="true"></span>${esc(medal)}</span> <a href="${r}breweries/${esc(x.brewery_slug)}/">${esc(x.brewery_name)}</a> · <a href="${r}categories/${esc(x.category_slug)}/">${esc(x.category_name)}</a></p>
<dl class="kv">
<dt>${esc(c.abv)}</dt><dd>${has(x.abv) ? `${esc(Number(x.abv).toFixed(1).replace(/\.0$/, ''))}%` : none}</dd>
<dt>${esc(c.ibu)}</dt><dd>${has(x.ibu) ? esc(String(Number(x.ibu))) : none}</dd>
<dt>${esc(c.style)}</dt><dd>${x.beer_style ? esc(x.beer_style) : none}</dd>
<dt>${esc(c.hops)}</dt><dd>${hops}</dd>
</dl>
<div class="small muted">${esc(c.tasting)}</div>
${note}
<p class="small"><a href="${r}${esc(x.beer_profile)}">${esc(c.deep_dive)}</a></p>
</article>`;
}

// A section of cards for every row that has a beer profile, gold first. Empty when none do.
export function beerCardsHtml(rows, { r, meta = null, tag = 'h2' } = {}) {
  const list = rows.filter((x) => x.beer_profile).sort((a, b) => (RANK[a.medal] ?? 9) - (RANK[b.medal] ?? 9) || String(a.beer_name).localeCompare(String(b.beer_name)));
  if (!list.length) return '';
  return `<${tag}>${esc(beerCardCopy(meta).section)}</${tag}><div class="profile-grid">${list.map((x) => beerCardHtml(x, { r, meta })).join('')}</div>`;
}
