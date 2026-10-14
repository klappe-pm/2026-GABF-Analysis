// ECharts option builders for the dashboards, one per chart type. Each takes what to draw and returns a
// builder (kit, width) => { option, height }, so the card can draw it again at any width. The chart types
// are the ones the chart gallery (issue 66) recommends: stacked horizontal bars, a tile grid beside ranked
// bars colored by region, a treemap, lollipops and a heatmap, plus the scatter and lines for the rest.
// Colors come from the kit (the theme), never from this file.
import type { Bin, Kit } from './theme';
import { binOf } from './theme';
import type { Built } from './OptionChart';

export const NARROW = 480;
export const fmtN = (n: number) => n.toLocaleString('en-US');
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));

const tooltip = (kit: Kit, extra: Record<string, unknown> = {}) => ({
  confine: true,
  backgroundColor: kit.tooltip.backgroundColor,
  borderWidth: 0,
  borderRadius: kit.tooltip.radius,
  padding: 8,
  textStyle: { color: kit.tooltip.color, fontFamily: kit.family, fontSize: kit.medium },
  ...extra,
});
const axisText = (kit: Kit, extra: Record<string, unknown> = {}) => ({ color: kit.ink, fontSize: kit.small, fontFamily: kit.family, ...extra });
const valueAxis = (kit: Kit, extra: Record<string, unknown> = {}) => ({ type: 'value' as const, axisLabel: axisText(kit), splitLine: { lineStyle: { color: kit.grid, width: 1 } }, axisLine: { show: false }, axisTick: { show: false }, ...extra });
const categoryAxis = (kit: Kit, data: unknown[], extra: Record<string, unknown> = {}) => ({
  type: 'category' as const,
  inverse: true,
  data,
  axisLabel: axisText(kit, { interval: 0 }),
  axisLine: { lineStyle: { color: kit.outline } },
  axisTick: { show: false },
  ...extra,
});

const ROW = 30;
const rowsHeight = (n: number, pad = 28) => Math.max(120, pad + n * ROW);

// Stacked horizontal bars, one bar per row. With a total, the end of each bar carries it; as a percent
// every bar spans the full width and each segment is its share of the row.
export type StackSeries = { name: string; data: number[]; color: (kit: Kit) => string };
export function stackedBars(o: {
  labels: string[];
  series: StackSeries[];
  /** What the end of each bar says, such as "1,907" or "32 points". Omit for none. */
  totals?: { values: number[]; format: (n: number) => string };
  percent?: boolean;
  tip: (index: number) => string;
  labelWidth?: (w: number) => number;
  minLabel?: number;
}) {
  return (kit: Kit, w: number): Built => {
    const narrow = w < NARROW;
    const left = (o.labelWidth ?? ((x: number) => (x < NARROW ? 92 : 112)))(w);
    const rowTotals = o.labels.map((_, i) => o.series.reduce((s, x) => s + (x.data[i] || 0), 0));
    const share = (v: number, i: number) => (rowTotals[i] ? Math.round((v / rowTotals[i]) * 1000) / 10 : 0);
    const series: Record<string, unknown>[] = o.series.map((x) => {
      const fill = x.color(kit);
      return {
        name: x.name,
        type: 'bar',
        stack: 'rows',
        barMaxWidth: 22,
        data: x.data.map((v, i) => (o.percent ? share(v, i) : v)),
        itemStyle: { color: fill, borderColor: kit.page, borderWidth: 1 },
        label: { show: true, color: kit.textOn(fill), fontSize: kit.small, fontFamily: kit.family, formatter: (p: { value: number }) => (p.value && (o.percent ? p.value >= 6 : p.value >= (o.minLabel ?? 6)) ? (o.percent ? `${p.value}%` : fmtN(p.value)) : '') },
      };
    });
    let max: number | undefined;
    if (o.totals && !o.percent) {
      const peak = Math.max(1, ...o.totals.values);
      max = Math.ceil((peak * (narrow ? 1.5 : 1.25)) / 5) * 5;
      series.push({
        name: ' ',
        type: 'bar',
        stack: 'rows',
        silent: true,
        data: o.totals.values,
        itemStyle: { color: 'transparent' },
        tooltip: { show: false },
        label: { show: true, position: 'insideLeft', color: kit.ink, fontSize: kit.small, fontFamily: kit.family, fontWeight: 600, formatter: (p: { value: number }) => o.totals!.format(p.value) },
      });
    }
    return {
      height: rowsHeight(o.labels.length),
      option: {
        grid: { left, right: 16, top: 6, bottom: 22 },
        xAxis: o.percent ? valueAxis(kit, { min: 0, max: 100, axisLabel: axisText(kit, { formatter: '{value}%' }) }) : valueAxis(kit, { minInterval: 1, max }),
        yAxis: categoryAxis(kit, o.labels, { axisLabel: axisText(kit, { interval: 0, width: left - 8, overflow: 'break', lineHeight: kit.small + 4 }) }),
        tooltip: tooltip(kit, { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: { dataIndex: number }[]) => o.tip(ps[0].dataIndex) }),
        series,
      },
    };
  };
}

// Horizontal bars ranked longest first, each in its own color (a region, a family), the value at the end.
export type RankItem = { name: string; label?: string; value: number; color: (kit: Kit) => string; tip?: string };
export function rankedBars(o: { items: RankItem[]; format?: (n: number) => string; labelWidth?: (w: number) => number }) {
  return (kit: Kit, w: number): Built => {
    const left = (o.labelWidth ?? ((x: number) => (x < NARROW ? 100 : 168)))(w);
    const format = o.format ?? fmtN;
    return {
      height: rowsHeight(o.items.length, 22),
      option: {
        grid: { left, right: 52, top: 4, bottom: 8 },
        xAxis: valueAxis(kit, { show: false }),
        yAxis: categoryAxis(kit, o.items.map((i) => i.label ?? i.name), { axisLabel: axisText(kit, { interval: 0, width: left - 8, overflow: 'truncate' }) }),
        tooltip: tooltip(kit, { trigger: 'item', formatter: (p: { dataIndex: number }) => o.items[p.dataIndex].tip ?? `${esc(o.items[p.dataIndex].label ?? o.items[p.dataIndex].name)}<br>${format(o.items[p.dataIndex].value)}` }),
        series: [{
          type: 'bar',
          barMaxWidth: 20,
          data: o.items.map((i) => ({ name: i.name, value: i.value, itemStyle: { color: i.color(kit) } })),
          label: { show: true, position: 'right', color: kit.ink, fontSize: kit.small, fontFamily: kit.family, formatter: (p: { value: number }) => format(p.value) },
        }],
      },
    };
  };
}

// A thin stem and a dot at the end: the pooled value of each row, ranked.
export function lollipop(o: { items: { name: string; label?: string; value: number; tip?: string }[]; format?: (n: number) => string; color?: (kit: Kit) => string; labelWidth?: (w: number) => number }) {
  return (kit: Kit, w: number): Built => {
    const left = (o.labelWidth ?? ((x: number) => (x < NARROW ? 112 : 230)))(w);
    const format = o.format ?? fmtN;
    const dot = (o.color ?? ((k: Kit) => k.series[0]))(kit);
    const max = Math.max(1, ...o.items.map((i) => i.value));
    return {
      height: rowsHeight(o.items.length, 28),
      option: {
        grid: { left, right: 56, top: 4, bottom: 22 },
        xAxis: valueAxis(kit, { min: 0, max: Math.ceil((max * 1.05) / 10) * 10 || 10 }),
        yAxis: categoryAxis(kit, o.items.map((i) => i.label ?? i.name), { axisLabel: axisText(kit, { interval: 0, width: left - 8, overflow: 'break', lineHeight: kit.small + 4 }) }),
        tooltip: tooltip(kit, { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: { dataIndex: number }[]) => o.items[ps[0].dataIndex].tip ?? `${esc(o.items[ps[0].dataIndex].label ?? o.items[ps[0].dataIndex].name)}<br>${format(o.items[ps[0].dataIndex].value)}` }),
        series: [
          { type: 'bar', barWidth: 3, silent: true, data: o.items.map((i) => ({ name: i.name, value: i.value })), itemStyle: { color: kit.outline } },
          { type: 'scatter', symbolSize: 14, data: o.items.map((i) => ({ name: i.name, value: i.value })), itemStyle: { color: dot, borderColor: kit.page, borderWidth: 1 }, label: { show: true, position: 'right', color: kit.ink, fontSize: kit.small, fontFamily: kit.family, formatter: (p: { value: number }) => format(p.value) } },
        ],
      },
    };
  };
}

// The states as equal square tiles in roughly their place on the map. Color is the bin the value falls in;
// the tile says the state and the value.
export function tileGrid(o: { tiles: Record<string, [number, number]>; value: (code: string) => number; format?: (n: number) => string; bins: (kit: Kit) => Bin[]; tip: (code: string) => string }) {
  const COLS = 11;
  const ROWS = 8;
  return (kit: Kit, w: number): Built => {
    const narrow = w < NARROW;
    const set = o.bins(kit);
    const format = o.format ?? fmtN;
    const cell = (code: string) => {
      const v = o.value(code);
      const b = binOf(set, v);
      const [c, r] = o.tiles[code];
      return {
        name: code,
        value: [c, r, v],
        itemStyle: { color: b.fill, borderColor: kit.page, borderWidth: 2, borderRadius: 4 },
        label: { show: true, color: b.text, formatter: `{c|${code}}\n{n|${format(v)}}`, rich: { c: { fontSize: narrow ? 11 : kit.small + 1, fontWeight: 700, color: b.text, fontFamily: kit.family, lineHeight: narrow ? 13 : 16 }, n: { fontSize: narrow ? 10 : kit.small, color: b.text, fontFamily: kit.family, lineHeight: narrow ? 12 : 15 } } },
      };
    };
    return {
      height: Math.round((w * ROWS) / COLS),
      option: {
        grid: { left: 0, right: 0, top: 0, bottom: 0 },
        xAxis: { type: 'category', data: [...Array(COLS).keys()], show: false },
        yAxis: { type: 'category', data: [...Array(ROWS).keys()], inverse: true, show: false },
        tooltip: tooltip(kit, { formatter: (p: { name: string }) => o.tip(p.name) }),
        series: [{ type: 'heatmap', data: Object.keys(o.tiles).map(cell), emphasis: { itemStyle: { borderColor: kit.ink, borderWidth: 2 } } }],
      },
    };
  };
}

// Area is the count: the biggest families are the biggest blocks.
export type TreeItem = { name: string; value: number; color: (kit: Kit) => string; detail: string };
export function treemap(o: { items: TreeItem[]; tip: (item: TreeItem) => string; label: (item: TreeItem) => string }) {
  return (kit: Kit, w: number): Built => ({
    height: w < NARROW ? 420 : Math.round(w * 0.55),
    option: {
      tooltip: tooltip(kit, { formatter: (p: { dataIndex: number }) => o.tip(o.items[p.dataIndex]) }),
      series: [{
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        squareRatio: 1,
        data: o.items.map((i) => {
          const fill = i.color(kit);
          return { name: i.name, value: i.value, itemStyle: { color: fill, borderColor: kit.page, borderWidth: 2 }, label: { show: true, color: kit.textOn(fill) } };
        }),
        label: { show: true, fontSize: w < NARROW ? kit.small : kit.small + 2, fontWeight: 700, fontFamily: kit.family, lineHeight: 18, overflow: 'break', formatter: (p: { dataIndex: number }) => o.label(o.items[p.dataIndex]) },
        itemStyle: { gapWidth: 2, borderColor: kit.page, borderWidth: 2 },
      }],
    },
  });
}

// A grid of values: rows by columns, each cell colored by its bin. A null cell is left empty.
export function heatmap(o: { rows: string[]; cols: string[]; cells: (number | null)[][]; bins: (kit: Kit) => Bin[]; tip: (row: number, col: number, value: number) => string; format?: (n: number) => string; labelWidth?: (w: number) => number }) {
  return (kit: Kit, w: number): Built => {
    const narrow = w < NARROW;
    const left = (o.labelWidth ?? ((x: number) => (x < NARROW ? 112 : 230)))(w);
    const set = o.bins(kit);
    const format = o.format ?? ((n: number) => String(Math.round(n)));
    const data: unknown[] = [];
    o.cells.forEach((row, r) => row.forEach((v, c) => {
      if (v === null) return;
      const b = binOf(set, v);
      data.push({ value: [c, r, v], itemStyle: { color: b.fill, borderColor: kit.page, borderWidth: 2 }, label: { show: true, color: b.text, fontSize: narrow ? 11 : kit.small, fontFamily: kit.family, formatter: format(v) } });
    }));
    return {
      height: Math.max(120, 28 + o.rows.length * (narrow ? 34 : 26)),
      option: {
        grid: { left, right: 8, top: 4, bottom: 24 },
        xAxis: { type: 'category', data: o.cols, position: 'bottom', axisLabel: axisText(kit, { interval: 0 }), axisLine: { show: false }, axisTick: { show: false } },
        yAxis: categoryAxis(kit, o.rows, { axisLine: { show: false }, axisLabel: axisText(kit, { interval: 0, width: left - 8, overflow: 'break', lineHeight: kit.small + 4 }) }),
        tooltip: tooltip(kit, { formatter: (p: { value: number[] }) => o.tip(p.value[1], p.value[0], p.value[2]) }),
        series: [{ type: 'heatmap', data }],
      },
    };
  };
}

// Two measures per category as points; the points that stand apart carry their name.
export function scatter(o: { points: { name: string; x: number; y: number }[]; xName: string; yName: string; named: Set<string>; tip: (name: string, x: number, y: number) => string }) {
  return (kit: Kit, w: number): Built => ({
    height: w < NARROW ? 300 : 360,
    option: {
      grid: { left: 8, right: 24, top: 30, bottom: 36, containLabel: true },
      xAxis: valueAxis(kit, { name: o.xName, nameLocation: 'middle', nameGap: 28, nameTextStyle: axisText(kit), minInterval: 1 }),
      yAxis: valueAxis(kit, { name: o.yName, nameLocation: 'end', nameGap: 12, nameTextStyle: axisText(kit, { align: 'left' }), minInterval: 1 }),
      tooltip: tooltip(kit, { trigger: 'item', formatter: (p: { name: string; value: number[] }) => o.tip(p.name, p.value[0], p.value[1]) }),
      series: [{
        type: 'scatter',
        symbolSize: 11,
        data: o.points.map((p) => ({ name: p.name, value: [p.x, p.y], label: { show: o.named.has(p.name) && w >= NARROW, position: 'right', color: kit.ink, fontSize: kit.small, fontFamily: kit.family, formatter: p.name } })),
        itemStyle: { color: kit.series[0], borderColor: kit.page, borderWidth: 1, opacity: 0.9 },
      }],
    },
  });
}
