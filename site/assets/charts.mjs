// Isomorphic SVG chart module: runs in Node at build time and in the browser.
// Pure string output, no DOM. Colors are CSS custom properties so light and dark
// modes swap in styles.css. Follows the dataviz method: thin marks, 4px rounded
// data ends, 2px surface gaps, hairline solid grid, selective direct labels,
// a legend for two or more series, and a table view beside every chart.

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const MEDAL_SERIES = [
  { key: 'gold', label: 'Gold', color: 'var(--medal-gold)' },
  { key: 'silver', label: 'Silver', color: 'var(--medal-silver)' },
  { key: 'bronze', label: 'Bronze', color: 'var(--medal-bronze)' },
];

export const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];

export const STATUS_LABELS = {
  medaled: 'Medaled',
  'no-medal': 'Competed or eligible, no medal recorded',
  'did-not-exist': 'Brewery did not exist yet',
  closed: 'Brewery closed',
  'not-yet-reported': 'Results not yet published',
  'no-data': 'Year only partially loaded',
  'no-results': 'No results loaded for this year',
};

export function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10;
  return m * p;
}

export function ticks(max, count = 4) {
  const steps = Number.isInteger(max) && max < count ? max : count;
  const out = [];
  for (let i = 0; i <= steps; i += 1) out.push((max / steps) * i);
  return out;
}

export function compact(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(0)}K`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// A bar with a 4px rounded data end and a square baseline end.
function roundedBarPath(x, y, w, h, direction = 'right') {
  const r = Math.min(4, w / 2, h / 2);
  if (w <= 0) return '';
  if (direction === 'right') return `M${x},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} z`;
  // upward column: x,y is the top-left of the column, h is its height, rounded on top
  return `M${x},${y + r} a${r},${r} 0 0 1 ${r},${-r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} h${-w} z`;
}

export function barsH({ items, width = 640, barHeight = 20, gap = 10, labelWidth = 200, color = 'var(--series-1)', valueFormat = compact, title = '' }) {
  const rows = items.slice();
  const max = niceMax(Math.max(0, ...rows.map((r) => Number(r.value) || 0)));
  const plotW = width - labelWidth - 56;
  const top = 8;
  const height = top + rows.length * (barHeight + gap) + 28;
  const scale = (v) => (plotW * (Number(v) || 0)) / max;
  let out = `<svg class="chart chart-bars" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMinYMin meet">`;
  for (const t of ticks(max)) {
    const x = labelWidth + scale(t);
    out += `<line class="grid" x1="${x}" y1="${top}" x2="${x}" y2="${top + rows.length * (barHeight + gap)}"/>`;
    out += `<text class="tick" x="${x}" y="${height - 8}" text-anchor="middle">${esc(valueFormat(t))}</text>`;
  }
  out += `<line class="axis" x1="${labelWidth}" y1="${top}" x2="${labelWidth}" y2="${top + rows.length * (barHeight + gap)}"/>`;
  rows.forEach((r, i) => {
    const y = top + i * (barHeight + gap) + gap / 2;
    const w = scale(r.value);
    const tip = r.tip ?? `${r.label}: ${valueFormat(r.value)}`;
    const label = `<text class="label" x="${labelWidth - 8}" y="${y + barHeight / 2 + 4}" text-anchor="end">${esc(truncate(r.label, 30))}</text>`;
    out += r.href ? `<a href="${esc(r.href)}">${label}</a>` : label;
    out += `<g class="mark" tabindex="0" data-tip="${esc(tip)}"><rect class="hit" x="${labelWidth}" y="${y - gap / 2}" width="${Math.max(w, 24)}" height="${barHeight + gap}" fill="transparent"/>`;
    out += `<path d="${roundedBarPath(labelWidth, y, w, barHeight)}" fill="${r.color ?? color}"/>`;
    out += `<text class="value" x="${labelWidth + w + 6}" y="${y + barHeight / 2 + 4}">${esc(valueFormat(r.value))}</text></g>`;
  });
  out += '</svg>';
  return out;
}

function truncate(s, n) {
  const str = String(s ?? '');
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

// Stacked columns, one per x value, segments in series order from the baseline up.
// rows: [{ x, values: { key: n }, status }], a row with no values and a status draws a
// baseline marker whose tooltip explains the gap (did not exist, not yet reported).
export function columnsStacked({ rows, series = MEDAL_SERIES, width = 640, height = 260, title = '', valueFormat = compact, labelMode = 'selective' }) {
  const left = 36;
  const bottom = 44;
  const top = 18;
  const plotH = height - top - bottom;
  const slot = (width - left - 12) / Math.max(rows.length, 1);
  const colW = Math.min(24, slot * 0.6);
  const totals = rows.map((r) => series.reduce((s, k) => s + (Number(r.values?.[k.key]) || 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const scale = (v) => (plotH * v) / max;
  const labelIdx = new Set();
  if (labelMode === 'all') totals.forEach((t, i) => t > 0 && labelIdx.add(i));
  else {
    const maxIdx = totals.indexOf(Math.max(...totals));
    if (totals[maxIdx] > 0) labelIdx.add(maxIdx);
    for (let i = totals.length - 1; i >= 0; i -= 1) if (totals[i] > 0) { labelIdx.add(i); break; }
  }
  let out = `<svg class="chart chart-columns" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMinYMin meet">`;
  for (const t of ticks(max)) {
    const y = top + plotH - scale(t);
    out += `<line class="grid" x1="${left}" y1="${y}" x2="${width - 12}" y2="${y}"/>`;
    out += `<text class="tick" x="${left - 6}" y="${y + 4}" text-anchor="end">${esc(valueFormat(t))}</text>`;
  }
  out += `<line class="axis" x1="${left}" y1="${top + plotH}" x2="${width - 12}" y2="${top + plotH}"/>`;
  rows.forEach((r, i) => {
    const cx = left + slot * i + slot / 2;
    const x = cx - colW / 2;
    let yCursor = top + plotH;
    const parts = series.map((s) => `${s.label} ${valueFormat(Number(r.values?.[s.key]) || 0)}`).join(', ');
    const statusText = r.status && r.status !== 'medaled' ? ` (${STATUS_LABELS[r.status] ?? r.status})` : '';
    const tip = `${r.x}: ${totals[i] > 0 ? `${valueFormat(totals[i])} total. ${parts}` : (STATUS_LABELS[r.status] ?? 'none')}${totals[i] > 0 ? statusText : ''}`;
    out += `<g class="mark" tabindex="0" data-tip="${esc(tip)}"><rect class="hit" x="${cx - slot / 2}" y="${top}" width="${slot}" height="${plotH + 20}" fill="transparent"/>`;
    let first = true;
    series.forEach((s) => {
      const v = Number(r.values?.[s.key]) || 0;
      if (v <= 0) return;
      const h = scale(v);
      const gapAdj = first ? 0 : 2;
      const segTop = yCursor - h;
      const segH = Math.max(0, h - gapAdj);
      if (segH > 0) out += `<path d="${roundedBarPath(x, segTop, colW, segH, 'up')}" fill="${s.color}"/>`;
      yCursor = segTop;
      first = false;
    });
    if (totals[i] === 0 && r.status) {
      const glyph = r.status === 'did-not-exist' || r.status === 'closed' ? '×' : r.status === 'not-yet-reported' ? '…' : r.status === 'no-results' ? '○' : '·';
      out += `<text class="status-glyph" x="${cx}" y="${top + plotH - 6}" text-anchor="middle">${glyph}</text>`;
    }
    if (labelIdx.has(i)) out += `<text class="value" x="${cx}" y="${yCursor - 6}" text-anchor="middle">${esc(valueFormat(totals[i]))}</text>`;
    out += `<text class="tick" x="${cx}" y="${top + plotH + 16}" text-anchor="middle">${esc(r.x)}</text>`;
    if (r.status && totals[i] === 0 && r.statusShort) out += `<text class="status-label" x="${cx}" y="${top + plotH + 32}" text-anchor="middle">${esc(r.statusShort)}</text>`;
    out += '</g>';
  });
  out += '</svg>';
  return out;
}

// Multi-series line chart over categorical x values (years). points: [{x, y}]
export function lineChart({ series, width = 640, height = 260, title = '', valueFormat = compact }) {
  const left = 44;
  const right = 110;
  const top = 14;
  const bottom = 32;
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => String(p.x))))].sort();
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.points.map((p) => Number(p.y) || 0))));
  const xPos = (x) => left + (xs.length === 1 ? plotW / 2 : (plotW * xs.indexOf(String(x))) / (xs.length - 1));
  const yPos = (y) => top + plotH - (plotH * (Number(y) || 0)) / max;
  let out = `<svg class="chart chart-lines" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMinYMin meet">`;
  for (const t of ticks(max)) {
    out += `<line class="grid" x1="${left}" y1="${yPos(t)}" x2="${left + plotW}" y2="${yPos(t)}"/>`;
    out += `<text class="tick" x="${left - 6}" y="${yPos(t) + 4}" text-anchor="end">${esc(valueFormat(t))}</text>`;
  }
  out += `<line class="axis" x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}"/>`;
  xs.forEach((x) => { out += `<text class="tick" x="${xPos(x)}" y="${top + plotH + 18}" text-anchor="middle">${esc(x)}</text>`; });
  series.forEach((s, i) => {
    const color = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
    const pts = s.points.filter((p) => p.y !== null && p.y !== undefined && p.y !== '').map((p) => ({ x: xPos(p.x), y: yPos(p.y), raw: p }));
    if (pts.length === 0) return;
    const d = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    out += `<path class="line" d="${d}" stroke="${color}"/>`;
    pts.forEach((p) => {
      out += `<g class="mark" tabindex="0" data-tip="${esc(`${s.label}, ${p.raw.x}: ${valueFormat(p.raw.y)}`)}"><circle class="hit" cx="${p.x}" cy="${p.y}" r="12" fill="transparent"/><circle class="dot" cx="${p.x}" cy="${p.y}" r="4" fill="${color}"/></g>`;
    });
    const last = pts[pts.length - 1];
    out += `<text class="label" x="${last.x + 10}" y="${last.y + 4}">${esc(truncate(s.label, 16))}</text>`;
  });
  out += '</svg>';
  return out;
}

export function legendHtml(series, shape = 'rect') {
  if (!series || series.length < 2) return '';
  return `<ul class="legend">${series.map((s) => `<li><span class="swatch ${shape}" style="--swatch:${s.color}"></span>${esc(s.label)}</li>`).join('')}</ul>`;
}

export function tableHtml(columns, rows, { className = 'data-table sortable', caption = '' } = {}) {
  const head = columns.map((c) => `<th scope="col"${c.numeric ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('');
  const body = rows.map((r) => `<tr>${columns.map((c) => {
    const v = typeof c.render === 'function' ? c.render(r) : esc(r[c.key] ?? '');
    return `<td${c.numeric ? ' class="num"' : ''}>${v}</td>`;
  }).join('')}</tr>`).join('');
  return `<table class="${className}">${caption ? `<caption>${esc(caption)}</caption>` : ''}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function figure({ id, title, subtitle = '', svg, legend = '', table = '', note = '' }) {
  return `<figure class="viz" id="${esc(id)}" data-figure="${esc(id)}"><figcaption><strong>${esc(title)}</strong>${subtitle ? `<span class="subtitle">${esc(subtitle)}</span>` : ''}</figcaption>${legend}<div class="plot">${svg}</div>${note ? `<p class="note">${esc(note)}</p>` : ''}${table ? `<details class="table-view"><summary>Table view</summary>${table}</details>` : ''}</figure>`;
}

export function statTile({ label, value, delta = '', note = '' }) {
  return `<div class="stat"><div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}</div>${delta ? `<div class="stat-delta">${esc(delta)}</div>` : ''}${note ? `<div class="stat-note">${esc(note)}</div>` : ''}</div>`;
}
