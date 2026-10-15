// ECharts option builders for the dashboards, one per chart type. Each takes what to draw and returns a
// builder (kit, width) => { option, height }, so the card can draw it again at any width. The chart types
// are the ones the chart gallery (issue 66) recommends: stacked horizontal bars, a tile grid beside ranked
// bars colored by region, a treemap, lollipops and a heatmap, plus the scatter and lines for the rest.
// Colors come from the kit (the theme), never from this file.
import type { Bin, Kit } from '@/design/chart-kit';
import { binOf } from '@/design/chart-kit';
import type { Built } from './OptionChart';

export const NARROW = 480;
// The one rule for a category label column: the wide width on a card at least NARROW wide, and below it the narrow
// width (a number, or a share of the card), never more than the wide one.
export const labelColumn = (narrow: number | ((w: number) => number), wide: number) => (w: number) => (w < NARROW ? Math.min(wide, typeof narrow === 'function' ? narrow(w) : narrow) : wide);
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
    const left = (o.labelWidth ?? labelColumn(92, 112))(w);
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
      // The end label sits in an invisible bar of fixed room, so the axis follows the medals, not the totals.
      const peak = Math.max(1, ...rowTotals);
      const room = peak * (narrow ? 0.5 : 0.3);
      max = Math.ceil((peak + room) / 5) * 5;
      series.push({
        name: ' ',
        type: 'bar',
        stack: 'rows',
        silent: true,
        data: o.totals.values.map((total) => ({ value: room, total })),
        itemStyle: { color: 'transparent' },
        tooltip: { show: false },
        label: { show: true, position: 'insideLeft', color: kit.ink, fontSize: kit.small, fontFamily: kit.family, fontWeight: 600, formatter: (p: { data: { total: number } }) => o.totals!.format(p.data.total) },
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
    const left = (o.labelWidth ?? labelColumn(100, 168))(w);
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
    const left = (o.labelWidth ?? labelColumn(112, 230))(w);
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

// One hollow dot per row on a dotted guide line: the value of an estimate, drawn open so it reads as an estimate and
// not as a count. The dot sits on a value axis that starts at zero.
export function dotPlot(o: { items: { name: string; label?: string; value: number; tip?: string }[]; format?: (n: number) => string; color?: (kit: Kit) => string; labelWidth?: (w: number) => number }) {
  return (kit: Kit, w: number): Built => {
    const left = (o.labelWidth ?? labelColumn(112, 230))(w);
    const format = o.format ?? fmtN;
    const dot = (o.color ?? ((k: Kit) => k.series[2]))(kit);
    const max = Math.max(1, ...o.items.map((i) => i.value));
    return {
      height: rowsHeight(o.items.length, 28),
      option: {
        grid: { left, right: 64, top: 4, bottom: 22 },
        xAxis: valueAxis(kit, { min: 0, max: max * 1.08, axisLabel: axisText(kit, { formatter: (v: number) => format(v) }) }),
        yAxis: categoryAxis(kit, o.items.map((i) => i.label ?? i.name), {
          axisLabel: axisText(kit, { interval: 0, width: left - 8, overflow: 'break', lineHeight: kit.small + 4 }),
          splitLine: { show: true, lineStyle: { color: kit.grid, type: 'dotted', width: 1 } },
        }),
        tooltip: tooltip(kit, { trigger: 'item', formatter: (p: { dataIndex: number }) => o.items[p.dataIndex].tip ?? `${esc(o.items[p.dataIndex].label ?? o.items[p.dataIndex].name)}<br>${format(o.items[p.dataIndex].value)}` }),
        series: [{
          type: 'scatter',
          symbolSize: 13,
          data: o.items.map((i) => ({ name: i.name, value: [i.value, i.label ?? i.name] })),
          itemStyle: { color: kit.page, borderColor: dot, borderWidth: 2 },
          label: { show: true, position: 'right', color: kit.ink, fontSize: kit.small, fontFamily: kit.family, formatter: (p: { value: [number, string] }) => format(p.value[0]) },
        }],
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

// Area is the count: the biggest families are the biggest blocks. A block shows its name only when the
// name fits in it without breaking inside a word (its longest word fits the block's width, two lines fit
// its height); every block names itself in the tooltip.
export type TreeItem = { name: string; value: number; color: (kit: Kit) => string; detail: string };
export function treemap(o: { items: TreeItem[]; tip: (item: TreeItem) => string; label: (item: TreeItem) => string }) {
  const byName = (name: string) => o.items.find((i) => i.name === name) ?? o.items[0];
  return (kit: Kit, w: number): Built => {
    const height = w < NARROW ? 420 : Math.round(w * 0.55);
    const size = w < NARROW ? kit.small : kit.small + 2;
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) ctx.font = `700 ${size}px ${kit.family}`;
    const total = o.items.reduce((s, i) => s + i.value, 0) || 1;
    // The blocks are close to square, so a block's side is about the square root of its share of the area.
    const width = (text: string) => (ctx ? ctx.measureText(text).width : text.length * size * 0.65);
    const fits = (i: TreeItem) => {
      // Blocks are not all square, so allow a margin: a fifth off the side, and room for the padding.
      const side = Math.sqrt((i.value / total) * w * height) * 0.78 - 14;
      const text = o.label(i).split('\n');
      const longest = Math.max(...text[0].split(/\s+/).map(width), width(text[1] ?? ''));
      const lines = Math.ceil(width(text[0]) / Math.max(side, 1)) + 1;
      return side >= longest && lines * 18 <= side;
    };
    return {
      height,
      option: {
        tooltip: tooltip(kit, { formatter: (p: { name: string }) => o.tip(byName(p.name)) }),
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
            return { name: i.name, value: i.value, itemStyle: { color: fill, borderColor: kit.page, borderWidth: 2 }, label: { show: fits(i), color: kit.textOn(fill) } };
          }),
          label: { show: true, fontSize: size, fontWeight: 700, fontFamily: kit.family, lineHeight: 18, overflow: 'break', formatter: (p: { name: string }) => o.label(byName(p.name)) },
          itemStyle: { gapWidth: 2, borderColor: kit.page, borderWidth: 2 },
        }],
      },
    };
  };
}

// A grid of values: rows by columns, each cell colored by its bin. A null cell is left empty.
export function heatmap(o: { rows: string[]; cols: string[]; cells: (number | null)[][]; bins: (kit: Kit) => Bin[]; tip: (row: number, col: number, value: number) => string; format?: (n: number) => string; labelWidth?: (w: number) => number }) {
  return (kit: Kit, w: number): Built => {
    const narrow = w < NARROW;
    const left = (o.labelWidth ?? labelColumn(112, 230))(w);
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

// ---------- the analysis report charts ----------
// Horizontal bars and stacked columns of the category and analysis pages. They draw on the report base
// below, which keeps their own look: axis labels in the secondary text color and a tooltip in the inverse surface.

// The option every report chart starts from, read from the theme as drawn.
function reportBase(kit: Kit) {
  const t = kit.theme;
  const axisLabel = { color: t.onSurfaceVariant, fontFamily: t.family, fontSize: t.small };
  return {
    color: t.series,
    backgroundColor: 'transparent',
    animation: false,
    textStyle: { fontFamily: t.family, color: t.onSurface },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: 'category' as const, axisLine: { lineStyle: { color: t.outline } }, axisTick: { lineStyle: { color: t.outlineVariant } }, axisLabel, splitLine: { show: false } },
    yAxis: { type: 'value' as const, axisLine: { show: false }, axisTick: { show: false }, axisLabel, splitLine: { lineStyle: { color: t.outlineVariant, width: 1 } } },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: t.container,
      borderWidth: 0,
      borderRadius: t.radius,
      padding: 8,
      textStyle: { color: t.onContainer, fontFamily: t.family, fontSize: t.medium },
      axisPointer: { type: 'line' as const, lineStyle: { color: t.outline, width: 1 } },
    },
  };
}

// The five series colors, then Material containers for a chart with more series.
const EXTRA_ROLES = ['primary-container', 'tertiary-container', 'secondary-container'];
export const seriesFill = (kit: Kit, i: number) => (i < kit.series.length ? kit.series[i] : kit.role(EXTRA_ROLES[(i - kit.series.length) % EXTRA_ROLES.length]));

// Horizontal bars, largest first, one bar per item, the value at the end of each bar.
export const reportBarsHeight = (n: number) => Math.max(200, 34 * n + 60);
export function reportBars(o: { labels: string[]; values: number[]; valueName: string; roleIndex?: number; labelWidth?: number }) {
  return (kit: Kit, w: number): Built => {
    const base = reportBase(kit);
    const t = kit.theme;
    return {
      option: {
        ...base,
        grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
        tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: { ...base.yAxis, type: 'value', splitLine: { lineStyle: { color: t.outlineVariant, width: 1 } } },
        yAxis: { ...base.xAxis, type: 'category', inverse: true, data: o.labels, axisLabel: { ...base.xAxis.axisLabel, width: labelColumn((x) => Math.round(x * 0.38), o.labelWidth ?? 200)(w), overflow: 'truncate' } },
        series: [{ type: 'bar', name: o.valueName, data: o.values, barMaxWidth: 22, itemStyle: { color: t.series[(o.roleIndex ?? 0) % t.series.length] }, label: { show: true, position: 'right', color: t.onSurfaceVariant, fontFamily: t.family, fontSize: t.small } }],
      },
    };
  };
}

// Stacked columns, one column per label (a year), one segment per series; a note under a label sets a second line.
export function reportStacked(o: { labels: (string | number)[]; series: { name: string; values: number[] }[]; notes?: string[] }) {
  return (kit: Kit): Built => {
    const base = reportBase(kit);
    return {
      option: {
        ...base,
        tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: { ...base.xAxis, data: o.labels.map((l, i) => (o.notes?.[i] ? `${l}\n${o.notes[i]}` : String(l))) },
        series: o.series.map((x, i) => ({ type: 'bar', stack: 'total', name: x.name, data: x.values, barMaxWidth: 36, itemStyle: { color: seriesFill(kit, i), borderColor: kit.theme.container, borderWidth: 0.5 } })),
      },
    };
  };
}
