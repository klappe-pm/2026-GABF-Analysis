// The Catalog.beer attribution line, drawn from the copy entry global.site.footer.beer_details,
// with "Catalog.beer" and "CC BY 4.0" linked. Pages that render their own footer (the explorer
// and the chart gallery) use this so the wording lives in one place.

import { loadSiteCopy } from './site-copy.mjs';

export const CATALOG_URL = 'https://catalog.beer';
export const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const BEER_DETAILS_KEY = 'global.site.footer.beer_details';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function beerDetailsHtml(copy = loadSiteCopy()) {
  return escapeHtml(copy(BEER_DETAILS_KEY))
    .replace('Catalog.beer', `<a href="${CATALOG_URL}" rel="noopener">Catalog.beer</a>`)
    .replace('CC BY 4.0', `<a href="${LICENSE_URL}" rel="noopener">CC BY 4.0</a>`);
}
