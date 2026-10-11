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
  const head = columns.map((c) => `<th scope="col"${c.numeric ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('');
  const body = rows.map((r) => `<tr>${columns.map((c) => {
    const v = typeof c.render === 'function' ? c.render(r) : esc(r[c.key] ?? '');
    return `<td${c.numeric ? ' class="num"' : ''}>${v}</td>`;
  }).join('')}</tr>`).join('');
  return `<table class="${className}">${caption ? `<caption>${esc(caption)}</caption>` : ''}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// Functions inside an option (formatters) are serialized as "fn:" strings and revived
// by echarts-init.js. "</" is escaped so the JSON can sit inside a script element.
export function serializeOption(option) {
  return JSON.stringify(option, (k, v) => (typeof v === 'function' ? `fn:${v.toString()}` : v)).replace(/<\//g, '<\\/');
}

export function figure({ id, title, subtitle = '', option, height = 300, table = '', note = '' }) {
  return `<figure class="viz" id="${esc(id)}" data-figure="${esc(id)}" data-echart><figcaption><strong>${esc(title)}</strong>${subtitle ? `<span class="subtitle">${esc(subtitle)}</span>` : ''}</figcaption><div class="echart" style="height:${Number(height)}px"></div><script type="application/json">${serializeOption(option)}</script>${note ? `<p class="note">${esc(note)}</p>` : ''}${table ? `<details class="table-view"><summary>Table view</summary>${table}</details>` : ''}</figure>`;
}

export function statTile({ label, value, delta = '', note = '' }) {
  return `<div class="stat"><div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}</div>${delta ? `<div class="stat-delta">${esc(delta)}</div>` : ''}${note ? `<div class="stat-note">${esc(note)}</div>` : ''}</div>`;
}

export function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const v = r[key] || '(unknown)';
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}
