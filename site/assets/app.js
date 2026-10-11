// Explorer: client-side filtering of every medal row with linked charts and a table.
import { barsH, columnsStacked, esc, figure, legendHtml, MEDAL_SERIES, statTile, tableHtml } from './charts.mjs';

const state = { rows: [], meta: null, filters: {} };
const FILTERS = [
  { id: 'year', label: 'Year', key: 'year' },
  { id: 'medal', label: 'Medal', key: 'medal' },
  { id: 'style_family', label: 'Style family', key: 'style_family' },
  { id: 'category_name', label: 'Category', key: 'category_name' },
  { id: 'region', label: 'Region', key: 'region' },
  { id: 'state', label: 'State', key: 'state' },
  { id: 'brewery_type', label: 'Brewery type', key: 'brewery_type' },
  { id: 'ownership_type', label: 'Ownership', key: 'ownership_type' },
  { id: 'abv_band', label: 'ABV band', key: 'abv_band' },
];

function qs(id) { return document.getElementById(id); }

function readHash() {
  const out = {};
  const h = location.hash.replace(/^#/, '');
  if (!h) return out;
  for (const part of h.split('&')) {
    const [k, v] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return out;
}

function hashFor(filters) {
  const parts = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

function writeHash() {
  const h = hashFor(state.filters);
  history.replaceState(null, '', h || location.pathname);
}

function applyFilters(rows) {
  const f = state.filters;
  const q = (f.q ?? '').trim().toLowerCase();
  return rows.filter((r) => {
    for (const def of FILTERS) {
      const v = f[def.id];
      if (!v) continue;
      if (def.id === 'year' && String(r.year) !== v) return false;
      if (def.id !== 'year' && String(r[def.key] ?? '') !== v) return false;
    }
    if (q) {
      const hay = `${r.beer_name} ${r.brewery_name} ${r.brewery_location} ${r.city} ${r.state_name} ${r.category_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function options(rows, key, labelFor = (v) => v) {
  const counts = new Map();
  for (const r of rows) {
    const v = String(r[key] ?? '');
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => (key === 'year' ? Number(b[0]) - Number(a[0]) : String(labelFor(a[0])).localeCompare(String(labelFor(b[0])))));
}

function buildFilterRow() {
  const wrap = qs('filters');
  const stateName = (code) => state.meta.states.find((s) => s.state === code)?.name ?? code;
  const bandLabel = (id) => state.meta.abv_bands.find((b) => b.id === id)?.label ?? id;
  let html = '';
  for (const def of FILTERS) {
    const labelFor = def.id === 'state' ? stateName : def.id === 'abv_band' ? bandLabel : (v) => v;
    const opts = options(state.rows, def.key, labelFor);
    html += `<label>${esc(def.label)}<select id="f-${def.id}"><option value="">All</option>${opts.map(([v, n]) => `<option value="${esc(v)}"${state.filters[def.id] === v ? ' selected' : ''}>${esc(labelFor(v))} (${n})</option>`).join('')}</select></label>`;
  }
  html += `<label>Search<input id="f-q" type="search" placeholder="beer, brewery, city" value="${esc(state.filters.q ?? '')}"></label>`;
  html += '<div class="actions"><button class="btn" id="reset">Reset</button><button class="btn" id="download">Download CSV</button></div>';
  wrap.innerHTML = html;
  for (const def of FILTERS) {
    qs(`f-${def.id}`).addEventListener('change', (e) => { state.filters[def.id] = e.target.value; render(); });
  }
  qs('f-q').addEventListener('input', (e) => { state.filters.q = e.target.value; render(); });
  qs('reset').addEventListener('click', () => { state.filters = {}; buildFilterRow(); render(); });
  qs('download').addEventListener('click', downloadCsv);
}

function refreshDependentOptions(filtered) {
  // Keep the category list scoped to the chosen style family so it stays short.
  const sel = qs('f-category_name');
  if (!sel) return;
  const fam = state.filters.style_family;
  const pool = fam ? state.rows.filter((r) => r.style_family === fam) : state.rows;
  const opts = options(pool, 'category_name');
  const current = state.filters.category_name ?? '';
  sel.innerHTML = `<option value="">All</option>${opts.map(([v, n]) => `<option value="${esc(v)}"${current === v ? ' selected' : ''}>${esc(v)} (${n})</option>`).join('')}`;
}

function count(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const v = r[key] || '(unknown)';
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function medalRowsByYear(rows) {
  const years = state.meta.years;
  return years.map((y) => {
    const yr = rows.filter((r) => r.year === y);
    const cov = state.meta.coverage[y];
    return { x: String(y), values: { gold: yr.filter((r) => r.medal === 'Gold').length, silver: yr.filter((r) => r.medal === 'Silver').length, bronze: yr.filter((r) => r.medal === 'Bronze').length }, status: yr.length ? (cov === 'partial' ? 'no-data' : 'medaled') : (cov === 'pending' ? 'not-yet-reported' : 'no-results'), statusShort: yr.length ? (cov === 'partial' ? 'partial' : '') : (cov === 'pending' ? 'pending' : '') };
  });
}

function render() {
  const filtered = applyFilters(state.rows);
  refreshDependentOptions(filtered);
  writeHash();
  const breweries = new Set(filtered.map((r) => r.brewery_key)).size;
  const states = new Set(filtered.map((r) => r.state)).size;
  const cats = new Set(filtered.map((r) => r.category_name)).size;
  const partialYears = [...new Set(filtered.filter((r) => r.partial).map((r) => r.year))].sort();
  qs('stats').innerHTML = [
    statTile({ label: 'Medals in view', value: filtered.length.toLocaleString() }),
    statTile({ label: 'Breweries', value: breweries.toLocaleString() }),
    statTile({ label: 'States', value: states.toLocaleString() }),
    statTile({ label: 'Categories', value: cats.toLocaleString() }),
    statTile({ label: 'Gold / Silver / Bronze', value: `${filtered.filter((r) => r.medal === 'Gold').length} / ${filtered.filter((r) => r.medal === 'Silver').length} / ${filtered.filter((r) => r.medal === 'Bronze').length}` }),
  ].join('');
  qs('partial-notice').innerHTML = partialYears.length ? `<div class="notice">Years ${partialYears.join(', ')} are only partially loaded (seed rows). Run the ingest to load the complete official lists; see the runbook in the repository.</div>` : '';

  const byState = count(filtered, 'state_name').slice(0, 15).map(([label, value]) => ({ label, value, href: hashFor({ ...state.filters, state: state.meta.states.find((s) => s.name === label)?.state ?? '' }) || '#' }));
  const byFamily = count(filtered, 'style_family').map(([label, value]) => ({ label, value }));
  const topBreweries = (() => {
    const m = new Map();
    for (const r of filtered) {
      const cur = m.get(r.brewery_key) ?? { label: r.brewery_name, value: 0, pts: 0, slug: r.brewery_slug };
      cur.value += 1;
      cur.pts += r.points;
      m.set(r.brewery_key, cur);
    }
    return [...m.values()].sort((a, b) => b.pts - a.pts || b.value - a.value).slice(0, 15).map((b) => ({ label: b.label, value: b.value, href: `breweries/${b.slug}/`, tip: `${b.label}: ${b.value} medals, ${b.pts} points` }));
  })();
  const yearRows = medalRowsByYear(filtered);
  qs('charts').innerHTML = [
    figure({ id: 'by-year', title: 'Medals by year', subtitle: 'stacked by medal', svg: columnsStacked({ rows: yearRows, title: 'Medals by year' }), legend: legendHtml(MEDAL_SERIES), table: tableHtml([{ key: 'x', label: 'Year' }, { key: 'gold', label: 'Gold', numeric: true, render: (r) => r.values.gold }, { key: 'silver', label: 'Silver', numeric: true, render: (r) => r.values.silver }, { key: 'bronze', label: 'Bronze', numeric: true, render: (r) => r.values.bronze }, { key: 'status', label: 'Status', render: (r) => esc(state.meta.coverage[r.x] ?? '') }], yearRows, { className: 'data-table' }) }),
    figure({ id: 'by-state', title: 'Medals by state', subtitle: 'top 15 in view', svg: barsH({ items: byState, title: 'Medals by state' }), table: tableHtml([{ key: 'label', label: 'State' }, { key: 'value', label: 'Medals', numeric: true }], count(filtered, 'state_name').map(([label, value]) => ({ label, value })), { className: 'data-table' }) }),
    figure({ id: 'by-family', title: 'Medals by style family', svg: barsH({ items: byFamily, title: 'Medals by style family', color: 'var(--series-3)' }), table: tableHtml([{ key: 'label', label: 'Style family' }, { key: 'value', label: 'Medals', numeric: true }], byFamily, { className: 'data-table' }) }),
    figure({ id: 'top-breweries', title: 'Top breweries', subtitle: 'medals in view, ranked by points (gold 3, silver 2, bronze 1)', svg: barsH({ items: topBreweries, title: 'Top breweries', color: 'var(--series-2)' }), table: tableHtml([{ key: 'label', label: 'Brewery' }, { key: 'value', label: 'Medals', numeric: true }], topBreweries, { className: 'data-table' }) }),
  ].join('');

  const limit = state.showAll ? filtered.length : 300;
  const rows = filtered.slice(0, limit);
  const medalDot = (m) => `<span class="badge-medal ${String(m).toLowerCase()}"></span>${esc(m)}`;
  qs('table').innerHTML = `<div class="table-wrap">${tableHtml([
    { key: 'year', label: 'Year', numeric: true },
    { key: 'medal', label: 'Medal', render: (r) => medalDot(r.medal) },
    { key: 'beer_name', label: 'Beer' },
    { key: 'brewery_name', label: 'Brewery', render: (r) => `<a href="breweries/${esc(r.brewery_slug)}/">${esc(r.brewery_name)}</a>${r.brewery_location ? ` <span class="muted small">(${esc(r.brewery_location)})</span>` : ''}` },
    { key: 'city', label: 'City', render: (r) => `${esc(r.city)}, ${esc(r.state)}` },
    { key: 'category_name', label: 'Category', render: (r) => `<a href="categories/${esc(r.category_slug)}/">${esc(r.category_name)}</a>` },
    { key: 'style_family', label: 'Style family' },
    { key: 'abv', label: 'ABV', render: (r) => (r.abv ? `${r.abv}%` : (r.abv_min ? `${r.abv_min} to ${r.abv_max}% (style)` : '')) },
    { key: 'entries', label: 'Entries', numeric: true, render: (r) => (r.entries ?? '') },
  ], rows)}</div>${filtered.length > limit ? `<p class="small muted">Showing ${limit} of ${filtered.length} rows. <a href="#" id="show-all">Show all</a> or narrow the filters.</p>` : ''}`;
  const showAll = qs('show-all');
  if (showAll) showAll.addEventListener('click', (e) => { e.preventDefault(); state.showAll = true; render(); });
  wireSortable();
}

function wireSortable() {
  document.querySelectorAll('#table table.sortable').forEach((table) => {
    Array.from(table.tHead.rows[0].cells).forEach((th, idx) => {
      th.addEventListener('click', () => {
        const numeric = th.classList.contains('num');
        const dir = th.getAttribute('aria-sort') === 'descending' ? 'asc' : 'desc';
        Array.from(th.parentNode.cells).forEach((c) => c.removeAttribute('aria-sort'));
        th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
        const tbody = table.tBodies[0];
        const rows = Array.from(tbody.rows);
        rows.sort((a, b) => {
          const va = a.cells[idx].textContent.trim(); const vb = b.cells[idx].textContent.trim();
          if (numeric) { const na = parseFloat(va) || 0; const nb = parseFloat(vb) || 0; return dir === 'asc' ? na - nb : nb - na; }
          return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
        rows.forEach((r) => tbody.appendChild(r));
      });
    });
  });
}

function downloadCsv() {
  const rows = applyFilters(state.rows);
  const cols = ['year', 'competition', 'category_number', 'category_name', 'entries', 'medal', 'beer_name', 'brewery_name', 'brewery_location', 'city', 'state', 'region', 'style_family', 'abv_min', 'abv_max', 'abv', 'brewery_type', 'ownership_type', 'parent'];
  const escCsv = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const text = [cols.join(','), ...rows.map((r) => cols.map((c) => escCsv(r[c])).join(','))].join('\n');
  const blob = new Blob([text], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gabf-results-filtered.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function init() {
  const [results, meta] = await Promise.all([fetch('data/results.json').then((r) => r.json()), fetch('data/meta.json').then((r) => r.json())]);
  state.meta = meta;
  state.rows = results.map((r) => ({ ...r, brewery_type: meta.brewery_types[r.brewery_key] ?? '', ownership_type: meta.ownership[r.brewery_key]?.ownership_type ?? 'unlisted', parent: meta.ownership[r.brewery_key]?.parent ?? '' }));
  state.filters = readHash();
  buildFilterRow();
  render();
  window.addEventListener('hashchange', () => { state.filters = readHash(); buildFilterRow(); render(); });
}

init().catch((err) => { qs('stats').innerHTML = `<div class="notice">Could not load data: ${esc(err.message)}</div>`; });
