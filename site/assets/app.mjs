// Every page of the multi-page site: mounts the global filter (header control, panel, chips) and,
// on a data page, re-renders the page's view from the filtered medal rows. The build writes each
// view with the default selection, so a page with no active filter shows its HTML as written and
// fetches no data until the filter is used.
import { applyFilters, createGlobalFilter, decorateRows, isDefaultState, scopeRows } from './filter-bar.mjs';
import { renderView } from './page-views.mjs';
import { installEstimates } from './estimates.mjs';

const base = window.GABF_BASE || './';
let dataPromise = null;
function loadData() {
  dataPromise ??= Promise.all([
    fetch(`${base}data/results.json`).then((r) => { if (!r.ok) throw new Error(`results ${r.status}`); return r.json(); }),
    fetch(`${base}data/meta.json`).then((r) => { if (!r.ok) throw new Error(`meta ${r.status}`); return r.json(); }),
  ]).then(([rows, meta]) => ({ rows: decorateRows(rows, meta), meta }));
  return dataPromise;
}
let infoPromise = null;
const loadBreweryInfo = () => (infoPromise ??= fetch(`${base}data/brewery-info.json`).then((r) => { if (!r.ok) throw new Error(`brewery info ${r.status}`); return r.json(); }));

let storage = null;
try { storage = window.localStorage; } catch (e) { storage = null; }

const pageData = (() => { try { return JSON.parse(document.getElementById('page-data')?.textContent || '{}'); } catch (e) { return {}; } })();
const filter = createGlobalFilter({ trigger: document.querySelector('.filter-trigger'), chipsEl: document.getElementById('filter-chips'), storage, loadData });
filter.setScope(pageData.scope ?? {}, pageData.fixed ?? []);
window.GABF_FILTER = filter;
window.GABF_LOAD = loadData;

// (E) marks: this brewery's explanation ships in the page; others load once on first use.
let estimatesPromise = null;
installEstimates({
  aboutHref: `${base}about/#estimates`,
  lookup: async (key) => {
    const own = pageData.page?.brewery;
    if (own && own.key === key && own.explain) return own.explain;
    estimatesPromise ??= fetch(`${base}data/estimates.json`).then((r) => { if (!r.ok) throw new Error(`estimates ${r.status}`); return r.json(); });
    return (await estimatesPromise)[key] ?? null;
  },
});

const live = document.getElementById('filter-live');
const region = document.querySelector('[data-view]');

async function render() {
  if (!region) return;
  region.setAttribute('aria-busy', 'true');
  region.classList.add('is-loading');
  try {
    const d = await loadData();
    filter.setData(d);
    const page = { ...(pageData.page ?? {}) };
    if (pageData.breweryInfo) page.breweries = await loadBreweryInfo();
    const all = scopeRows(d.rows, pageData.scope ?? {});
    const rows = applyFilters(all, filter.state);
    region.querySelectorAll('[data-echart]').forEach((el) => window.GABFCharts?.dispose(el));
    region.innerHTML = renderView(region.dataset.view, rows, { r: base, meta: d.meta, state: filter.state, page, scopeAll: all });
    window.GABFCharts?.initAll(region);
    if (live) live.textContent = `${rows.length.toLocaleString('en-US')} medal${rows.length === 1 ? '' : 's'} in view`;
  } catch (err) {
    region.innerHTML = '<div class="notice" role="alert">The medal data could not be loaded, so this view cannot follow the filter. Check the connection and reload the page.</div>';
  } finally {
    region.removeAttribute('aria-busy');
    region.classList.remove('is-loading');
  }
}

if (region) {
  filter.subscribe(render);
  if (!isDefaultState(filter.state)) render();
} else if (!isDefaultState(filter.state) && !document.querySelector('[data-panel], #table')) {
  // Pages without a filtered view still name the active filters in their chips (state names, ABV bands).
  fetch(`${base}data/meta.json`).then((r) => r.json()).then((meta) => filter.setData({ meta })).catch(() => {});
}
