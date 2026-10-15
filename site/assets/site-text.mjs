// The words of the old site and the standalone dashboard that have an entry in the copy documents
// (.docs/content-management-system/). tx(key, words in the code, values) returns the copy entry the
// build shipped; the words in the code stand in only when no copy was shipped (a unit test, an old
// payload). The build ships every key named in a literal tx call under site/assets, plus the
// label groups in TEXT_GROUPS, in three places: setSiteText() during the build itself, the #site-text
// script on every page, and meta.copy.text in the data payload (which the standalone dashboard reads).
// An edit to one of those entries therefore reaches this site, the dashboard file, and the Material app.

// Label groups read by key at run time (a filter value, a status), shipped whole.
export const TEXT_GROUPS = [
  'global.labels.ownership_type', 'global.labels.distribution_channel', 'global.labels.brewery_type', 'global.labels.category_type',
  'global.labels.section', 'global.labels.characteristic', 'global.labels.first_time', 'global.labels.abv_band',
  'global.labels.trend_status', 'global.labels.trend_status_short', 'global.labels.trend_status_glyph',
  'global.labels.indicator',
];

let shipped = null;
let fromPage;

export function setSiteText(map) {
  if (map && typeof map === 'object') shipped = { ...shipped, ...map };
}

function pageText() {
  if (fromPage !== undefined) return fromPage;
  try { fromPage = typeof document === 'undefined' ? null : JSON.parse(document.getElementById('site-text')?.textContent || 'null'); } catch (e) { fromPage = null; }
  return fromPage;
}

export function hasText(key) {
  return Boolean((shipped && Object.hasOwn(shipped, key)) || (pageText() && Object.hasOwn(pageText(), key)));
}

export function tx(key, fallback, values = null) {
  let text = shipped && Object.hasOwn(shipped, key) ? shipped[key] : pageText() && Object.hasOwn(pageText(), key) ? pageText()[key] : fallback;
  if (text === undefined || text === null) text = '';
  return values ? String(text).replace(/\{\{([^}]+)\}\}/g, (m, k) => (Object.hasOwn(values, k.trim()) ? String(values[k.trim()]) : m)) : String(text);
}
