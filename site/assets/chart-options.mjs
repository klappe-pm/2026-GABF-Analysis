import { compact } from './charts.mjs';

// Apache ECharts option builders shared by the build (Node) and the dashboards (browser).
// Colors are CSS custom property references ("var(--series-1)") that echarts-init.js
// resolves against the active theme before the option reaches ECharts, so one option
// serves light and dark modes. Mark rules follow the dataviz method: bars capped at
// 24px with a 4px rounded data end, stacks separated by a surface-colored hairline,
// solid hairline grids, legends for two or more series, tooltips on every mark, and a
// toolbox that saves a PNG or opens the data view.

export const MEDAL_COLORS = { Gold: 'var(--medal-gold)', Silver: 'var(--medal-silver)', Bronze: 'var(--medal-bronze)' };
export const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];
export const SEQUENTIAL_BLUE = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

const TEXT = { primary: 'var(--text-primary)', secondary: 'var(--text-secondary)', muted: 'var(--text-muted)' };

// Formatters travel as named references, never as source text: echarts-init.js holds the
// registry and builds the real function, so no page needs eval or Function (a strict CSP
// refuses both). Use fmt('name', ...args) wherever ECharts wants a formatter function.
export const fmt = (name, ...args) => ({ $fmt: name, args });

export const COMPACT_AXIS = fmt('compactAxis');

export function toolbox(name) {
  return { right: 4, top: 0, itemSize: 13, iconStyle: { borderColor: 'var(--text-muted)' }, feature: { saveAsImage: { name, pixelRatio: 2, title: 'Save PNG' }, dataView: { readOnly: true, title: 'Data', lang: ['Data', 'Close', 'Refresh'] }, restore: { title: 'Reset' } } };
}

function baseGrid(extra = {}) {
  return { left: 8, right: 48, top: 36, bottom: 8, containLabel: true, ...extra };
}

function valueAxis(name = '') {
  return { type: 'value', name, nameTextStyle: { color: TEXT.muted }, minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: 'var(--grid)', width: 1 } }, axisLabel: { color: TEXT.muted, formatter: COMPACT_AXIS } };
}

function categoryAxis(data, extra = {}) {
  return { type: 'category', data, axisLine: { lineStyle: { color: 'var(--axis)' } }, axisTick: { show: false }, axisLabel: { color: TEXT.secondary, ...extra.axisLabel }, ...extra };
}

export function textStyle() {
  return { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: TEXT.primary };
}

// Horizontal bars for ranking. items: [{ label, value, href?, tip? }]
export function barsHOption({ items, color = 'var(--series-1)', valueName = 'Medals', labelWidth = 190, saveName = 'chart' }) {
  const rows = items.slice();
  return {
    textStyle: textStyle(),
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    toolbox: toolbox(saveName),
    grid: baseGrid({ top: 28, right: 64 }),
    xAxis: valueAxis(),
    yAxis: categoryAxis(rows.map((r) => r.label), { inverse: true, axisLabel: { width: labelWidth, overflow: 'truncate' } }),
    series: [{ name: valueName, type: 'bar', data: rows.map((r) => ({ value: r.value, name: r.label, label: { formatter: compact(r.value) } })), barMaxWidth: 24, barCategoryGap: '35%', itemStyle: { color, borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: TEXT.primary, fontWeight: 600 }, emphasis: { itemStyle: { color } } }],
    __links: Object.fromEntries(rows.filter((r) => r.href).map((r) => [r.label, r.href])),
  };
}

// Stacked columns across x (years). series: [{ name, data: number[], color }], labels: x labels, notes: second-line status per x.
export function stackedColumnsOption({ labels, notes = [], series, saveName = 'chart', showLegend = true, selectiveLabels = true }) {
  const totals = labels.map((_, i) => series.reduce((s, ser) => s + (Number(ser.data[i]) || 0), 0));
  const maxIdx = totals.indexOf(Math.max(...totals));
  let lastIdx = -1;
  for (let i = totals.length - 1; i >= 0; i -= 1) if (totals[i] > 0) { lastIdx = i; break; }
  const labelIdx = new Set([maxIdx, lastIdx].filter((i) => i >= 0));
  const xLabels = labels.map((l) => String(l));
  // Status notes under the year, built by the registered "yearNotes" formatter. On a phone the
  // words shrink to a glyph and the year to two digits.
  const NOTE_FORMATTER = fmt('yearNotes', notes.map((n) => n || ''));
  return {
    textStyle: textStyle(),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { show: showLegend && series.length > 1, top: 0, left: 0, textStyle: { color: TEXT.secondary }, icon: 'rect', itemWidth: 12, itemHeight: 12 },
    toolbox: toolbox(saveName),
    grid: baseGrid({ top: series.length > 1 ? 36 : 28, bottom: 4 }),
    xAxis: categoryAxis(xLabels, { axisLabel: { color: TEXT.secondary, interval: 0, formatter: NOTE_FORMATTER, rich: { note: { color: TEXT.muted, fontSize: 10, lineHeight: 14 } } } }),
    yAxis: valueAxis(),
    series: series.map((ser, idx) => ({
      name: ser.name,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 24,
      itemStyle: { color: ser.color ?? SERIES_COLORS[idx % 8], borderColor: 'var(--surface-1)', borderWidth: 1 },
      // The top series carries the column total as a per-item literal label (no closures,
      // so the option survives JSON serialization). Selective: the maximum and the latest.
      data: idx === series.length - 1 && selectiveLabels
        ? ser.data.map((v, i) => ({ value: v, label: { show: labelIdx.has(i) && totals[i] > 0, position: 'top', color: TEXT.primary, fontWeight: 600, formatter: String(totals[i]) } }))
        : ser.data,
      label: { show: false },
    })),
    __totals: totals,
  };
}

// Lines over x. series: [{ name, data: (number|null)[], color }]
export function lineOption({ labels, series, saveName = 'chart', valueName = '' }) {
  return {
    textStyle: textStyle(),
    tooltip: { trigger: 'axis' },
    legend: { show: series.length > 1, top: 0, left: 0, textStyle: { color: TEXT.secondary } },
    toolbox: toolbox(saveName),
    grid: baseGrid({ top: series.length > 1 ? 36 : 28, right: 24 }),
    xAxis: categoryAxis(labels.map(String), { boundaryGap: false }),
    yAxis: valueAxis(valueName),
    series: series.map((ser, idx) => ({ name: ser.name, type: 'line', data: ser.data, connectNulls: false, symbol: 'circle', symbolSize: 8, lineStyle: { width: 2, color: ser.color ?? SERIES_COLORS[idx % 8] }, itemStyle: { color: ser.color ?? SERIES_COLORS[idx % 8], borderColor: 'var(--surface-1)', borderWidth: 2 } })),
  };
}

// US states choropleth. data: [{ name: 'California', value }], expects a registered map named 'usa'.
export function mapOption({ data, valueName = 'Medals', saveName = 'map', max }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return {
    textStyle: textStyle(),
    tooltip: { trigger: 'item', formatter: `{b}: {c} ${valueName.toLowerCase()}` },
    toolbox: toolbox(saveName),
    visualMap: { min: 0, max: top, left: 0, bottom: 0, orient: 'horizontal', calculable: true, textStyle: { color: TEXT.muted }, inRange: { color: SEQUENTIAL_BLUE } },
    series: [{ name: valueName, type: 'map', map: 'usa', roam: false, nameProperty: 'name', data, itemStyle: { borderColor: 'var(--surface-1)', borderWidth: 1, areaColor: 'var(--grid)' }, emphasis: { label: { show: true, color: TEXT.primary }, itemStyle: { areaColor: 'var(--series-2)' } }, select: { disabled: true }, label: { show: false } }],
    __map: 'usa',
  };
}

// Scatter of categories: entries (x) versus something (y), bubble size optional.
export function scatterOption({ points, xName, yName, saveName = 'scatter', color = 'var(--series-1)' }) {
  return {
    textStyle: textStyle(),
    tooltip: { trigger: 'item', formatter: `{b}: {c} (${xName}, ${yName})` },
    toolbox: toolbox(saveName),
    // Axis names are placed where they cannot be clipped on a narrow card: the x name sits centered
    // under its axis (the grid reserves a strip for it), and the y name sits above its axis, left
    // aligned, because a side label would move with the width of the tick labels.
    grid: baseGrid({ top: 32, right: 24, bottom: 34 }),
    xAxis: { ...valueAxis(xName), minInterval: undefined, nameLocation: 'middle', nameGap: 30 },
    yAxis: { ...valueAxis(yName), nameLocation: 'end', nameGap: 12, nameTextStyle: { color: TEXT.muted, align: 'left' } },
    series: [{ type: 'scatter', data: points.map((p) => ({ name: p.name, value: [p.x, p.y], symbolSize: Math.max(8, Math.min(28, p.size ?? 10)) })), itemStyle: { color, borderColor: 'var(--surface-1)', borderWidth: 2 }, emphasis: { label: { show: true, formatter: '{b}', position: 'top', color: TEXT.primary } } }],
  };
}
