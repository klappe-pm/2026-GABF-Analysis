// HTML helpers shared by the build (Node) and the dashboards (browser): escaping,
// compact numbers, status labels, table views, stat tiles, and the figure wrapper that
// embeds an Apache ECharts option for echarts-init.js to render.

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const MEDAL_SERIES = [
  { key: 'gold', label: 'Gold', color: 'var(--medal-gold)' },
  { key: 'silver', label: 'Silver', color: 'var(--medal-silver)' },
  { key: 'bronze', label: 'Bronze', color: 'var(--medal-bronze)' },
];

export const STATUS_LABELS = {
  medaled: 'Medaled',
  'no-medal': 'Competed or eligible, no medal recorded',
  'did-not-exist': 'Brewery did not exist yet',
  closed: 'Brewery closed',
  'not-yet-reported': 'Results not yet published',
  'no-data': 'Year only partially loaded',
  'no-results': 'No results loaded for this year',
};

export const STATUS_SHORT = { 'did-not-exist': 'not yet founded', 'not-yet-reported': 'pending', 'no-data': 'partial', 'no-results': 'not loaded', closed: 'closed', medaled: '', 'no-medal': '' };

export function compact(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(0)}K`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function tableHtml(columns, rows, { className = 'data-table sortable', caption = '' } = {}) {
  const sortable = /\bsortable\b/.test(className) ? ' tabindex="0"' : '';
  const cls = (c) => [c.numeric ? 'num' : '', c.cellClass ?? ''].filter(Boolean).join(' ');
  const attr = (c) => (cls(c) ? ` class="${cls(c)}"` : '');
  const head = columns.map((c) => `<th scope="col"${attr(c)}${sortable}>${c.labelHtml ?? esc(c.label)}</th>`).join('');
  const body = rows.map((r) => `<tr>${columns.map((c) => {
    const v = typeof c.render === 'function' ? c.render(r) : esc(r[c.key] ?? '');
    return `<td${attr(c)} data-label="${esc(c.label)}"${typeof c.sortValue === 'function' ? ` data-sort="${esc(c.sortValue(r))}"` : ''}>${v}</td>`;
  }).join('')}</tr>`).join('');
  return `<table class="${className}">${caption ? `<caption>${esc(caption)}</caption>` : ''}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// Options are plain JSON. A function cannot travel (and evaluating source text would need eval,
// which a strict CSP refuses), so formatters are { $fmt, args } references built with fmt() in
// chart-options.mjs. "</" is escaped so the JSON can sit inside a script element.
export function serializeOption(option) {
  return JSON.stringify(option, (k, v) => {
    if (typeof v === 'function') throw new Error(`Option key "${k}" is a function; use fmt() from chart-options.mjs`);
    return v;
  }).replace(/<\//g, '<\\/');
}

export function figure({ id, title, subtitle = '', option, height = 300, table = '', note = '' }) {
  return `<figure class="viz" id="${esc(id)}" data-figure="${esc(id)}" data-echart><figcaption><strong>${esc(title)}</strong>${subtitle ? `<span class="subtitle">${esc(subtitle)}</span>` : ''}</figcaption><div class="echart" style="height:${Number(height)}px"></div><script type="application/json">${serializeOption(option)}</script>${note ? `<p class="note">${esc(note)}</p>` : ''}${table ? `<details class="table-view"><summary>Table view</summary><div tabindex="0" role="region" aria-label="Table view of the chart values" class="table-wrap">${table}</div></details>` : ''}</figure>`;
}

// Gold, silver, and bronze counts as one compact value, "4-4-2", never wrapped. Screen readers
// hear the counts with their medal names.
export const gsbText = (g, s, b) => `${Number(g) || 0}-${Number(s) || 0}-${Number(b) || 0}`;
export function gsbHtml(g, s, b) {
  return `<span class="gsb" aria-hidden="true">${gsbText(g, s, b)}</span><span class="visually-hidden">${Number(g) || 0} gold, ${Number(s) || 0} silver, ${Number(b) || 0} bronze</span>`;
}
// A table column for the split; get(row) returns [gold, silver, bronze]. Sorts by total medals, then gold.
export function gsbColumn(get, { key = 'gsb' } = {}) {
  return {
    key,
    label: 'G-S-B',
    labelHtml: '<span aria-hidden="true">G-S-B</span><span class="visually-hidden">Gold, silver, bronze</span>',
    numeric: true,
    cellClass: 'gsb-cell',
    render: (r) => gsbHtml(...get(r)),
    sortValue: (r) => { const [g, s, b] = get(r).map((n) => Number(n) || 0); return (g + s + b) * 10000 + g; },
  };
}

// A medal split tile shows gold, silver, and bronze counts as one compact value that never wraps.
// mark: trusted HTML placed after the value (the (E) estimate button).
export function statTile({ label, value, delta = '', note = '', medals = null, mark = '' }) {
  const shown = medals
    ? `<div class="stat-value stat-medals">${gsbHtml(...medals)}</div>`
    : `<div class="stat-value">${esc(value)}${mark ? ` ${mark}` : ''}</div>`;
  return `<div class="stat"><div class="stat-label">${esc(label)}</div>${shown}${delta ? `<div class="stat-delta">${esc(delta)}</div>` : ''}${note ? `<div class="stat-note">${esc(note)}</div>` : ''}</div>`;
}

// Display text for a kebab-case slug: "ownership-and-investors" becomes "Ownership and investors".
const ACRONYMS = { gabf: 'GABF', abv: 'ABV', ibu: 'IBU', srm: 'SRM', ipa: 'IPA', arr: 'ARR', ebitda: 'EBITDA', us: 'US', usa: 'USA', ba: 'BA', fed: 'Fed' };
const PHRASES = [[/\bworld beer cup\b/g, 'World Beer Cup'], [/\bgreat american beer festival\b/g, 'Great American Beer Festival'], [/\bbrewery of the year\b/g, 'Brewery of the Year']];
export function humanize(slug) {
  let s = String(slug ?? '').split('-').filter(Boolean).map((w) => ACRONYMS[w] ?? w).join(' ');
  for (const [re, to] of PHRASES) s = s.replace(re, to);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Rewrite h2 to h6 headings whose whole text is a kebab-case slug (the markdown source convention) into display text.
export function humanizeHeadings(html) {
  return String(html).replace(/<(h[2-6])(\s[^>]*)?>([a-z0-9]+(?:-[a-z0-9]+)*)<\/\1>/g, (m, tag, attrs = '', text) => (/[a-z]/.test(text) ? `<${tag}${attrs}>${humanize(text)}</${tag}>` : m));
}

export function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const v = r[key] || '(unknown)';
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}
