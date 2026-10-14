// The chart card's presets and its brand merge, kept free of React and the page so the tests can bundle
// and run them in Node. Every color comes from the theme the card reads off Material's custom properties
// when it draws (readTheme in echarts-theme.ts): the five series colors from settings.md, the three medal
// colors, and the scheme's surface, text, and outline roles. Nothing here holds a color of its own.
//
// The pipeline is one merge: brand defaults, under the preset's option, under the caller's option. A value
// the caller set is never replaced; the brand only fills what is missing.

import type { ChartTheme } from './echarts-theme';

export const PRESETS = ['line', 'bar', 'stackedBar', 'horizontalBar', 'stackedHorizontalBar', 'lollipop', 'treemap'] as const;
export type ChartPreset = (typeof PRESETS)[number];

// Presets that plot counts: their value axes never show a fractional tick.
export const COUNT_PRESETS: readonly ChartPreset[] = ['bar', 'stackedBar', 'horizontalBar', 'stackedHorizontalBar', 'lollipop'];
// Presets whose categories run down the side, so the table view lists one row per category.
export const CATEGORY_ROW_PRESETS: readonly ChartPreset[] = ['horizontalBar', 'stackedHorizontalBar', 'lollipop', 'treemap'];

export type MedalKey = 'gold' | 'silver' | 'bronze';
export type ChartSeries = { name: string; values: (number | null)[]; medal?: 'Gold' | 'Silver' | 'Bronze' };
export type SortOrder = 'ascending' | 'descending';

// The card's settings (chart-card spec) and the reader's motion preference.
export type ChartLook = { lineWidth: number; pointSize: number; barWidth: number; patterns: boolean; reduceMotion: boolean };
export const DEFAULT_LOOK: ChartLook = { lineWidth: 2, pointSize: 8, barWidth: 24, patterns: true, reduceMotion: false };

// ECharts options are plain data here: the card is a client component and its option arrives from a
// server page, so a formatter function cannot cross. Use ECharts template strings ("{b}: {c}") instead.
type Opt = Record<string, any>;

// A distinct mark per series, so color is never the only code. Circles are kept for medals.
export const SERIES_SYMBOLS = ['rect', 'triangle', 'diamond', 'emptyRect', 'emptyTriangle'] as const;

const isPlain = (v: unknown): v is Opt => v !== null && typeof v === 'object' && !Array.isArray(v);

// Fill what `value` leaves out from `defaults`. Objects merge key by key; anything else the caller set,
// arrays included, is kept as written.
export function withDefaults<T>(defaults: unknown, value: T): T {
  if (value === undefined) return defaults as T;
  if (isPlain(defaults) && isPlain(value)) {
    const out: Opt = { ...defaults };
    for (const k of Object.keys(value)) out[k] = withDefaults(defaults[k], (value as Opt)[k]);
    return out as T;
  }
  return value;
}

// A series is a medal when it says so, or when its name is exactly Gold, Silver, or Bronze.
export function medalOf(s: { name?: unknown; medal?: unknown }): MedalKey | null {
  const v = String(s.medal ?? s.name ?? '').trim().toLowerCase();
  return v === 'gold' || v === 'silver' || v === 'bronze' ? v : null;
}

// Sort categories by their total across every series, carrying each series' values along.
export function sortData(categories: (string | number)[], series: ChartSeries[], sort?: SortOrder) {
  if (!sort) return { categories, series };
  const total = (i: number) => series.reduce((n, s) => n + (Number(s.values[i]) || 0), 0);
  const order = categories.map((_, i) => i).sort((a, b) => (sort === 'ascending' ? total(a) - total(b) : total(b) - total(a)) || a - b);
  return { categories: order.map((i) => categories[i]), series: series.map((s) => ({ ...s, values: order.map((i) => s.values[i] ?? null) })) };
}

// Fill patterns for bars, by series order: solid, rising lines, falling lines, dots, level lines. The
// pattern is drawn in the surface color over the series color, and the card's legend draws the same five.
export function decalFor(index: number, t: ChartTheme): Opt | 'none' {
  const lines = { symbol: 'rect', symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [2, 5], color: t.surface };
  switch (index % 5) {
    case 1: return { ...lines, rotation: Math.PI / 4 };
    case 2: return { ...lines, rotation: -Math.PI / 4 };
    case 3: return { symbol: 'circle', symbolSize: 0.6, dashArrayX: [4, 2], dashArrayY: [4, 2], color: t.surface };
    case 4: return { ...lines, rotation: 0 };
    default: return 'none';
  }
}

// The option a preset draws, before the brand: series types, data, axes, and stacking. No colors.
export function presetOption(preset: ChartPreset, categories: (string | number)[], series: ChartSeries[], look: ChartLook = DEFAULT_LOOK): Opt {
  const cats = categories.map(String);
  const shadow = { tooltip: { axisPointer: { type: 'shadow' } } };
  const valueAxis = { type: 'value' };
  const sideAxis = { type: 'category', data: cats, inverse: true };
  const bars = (stack?: string, labelAt?: string) => series.map((s) => ({
    type: 'bar',
    name: s.name,
    data: s.values,
    ...(stack ? { stack } : {}),
    ...(labelAt && series.length === 1 ? { label: { show: true, position: labelAt } } : {}),
  }));
  switch (preset) {
    case 'line':
      return { xAxis: { type: 'category', data: cats, boundaryGap: false }, yAxis: valueAxis, series: series.map((s) => ({ type: 'line', name: s.name, data: s.values })) };
    case 'bar':
      return { ...shadow, xAxis: { type: 'category', data: cats }, yAxis: valueAxis, series: bars() };
    case 'stackedBar':
      return { ...shadow, xAxis: { type: 'category', data: cats }, yAxis: valueAxis, series: bars('total') };
    case 'horizontalBar':
      return { ...shadow, xAxis: valueAxis, yAxis: sideAxis, series: bars(undefined, 'right') };
    case 'stackedHorizontalBar':
      return { ...shadow, xAxis: valueAxis, yAxis: sideAxis, series: bars('total') };
    case 'lollipop': {
      // One series: a thin stem (a bar as wide as a line) and a dot with its value at the end.
      const s = series[0] ?? { name: '', values: [] };
      return {
        ...shadow,
        xAxis: valueAxis,
        yAxis: sideAxis,
        series: [
          { type: 'bar', name: s.name, data: s.values, barWidth: look.lineWidth, tooltip: { show: false }, itemStyle: { borderWidth: 0, borderRadius: 0, decal: 'none' } },
          { type: 'scatter', name: s.name, data: s.values.map((v, i) => [v, i]), symbol: 'circle', symbolSize: look.pointSize + 2, label: { show: true, position: 'right', formatter: '{@[0]}' } },
        ],
      };
    }
    case 'treemap': {
      const leaves = (s: ChartSeries) => cats.map((name, i) => ({ name, value: s.values[i] ?? 0 })).filter((d) => d.value > 0);
      const data = series.length === 1 ? leaves(series[0]) : series.map((s) => ({ name: s.name, children: leaves(s) }));
      return { tooltip: { trigger: 'item', formatter: '{b}: {c}' }, series: [{ type: 'treemap', name: series.length === 1 ? series[0].name : '', data }] };
    }
  }
}

// The brand's top level defaults: type, grid, tooltip, and the series palette.
export function brandBase(t: ChartTheme): Opt {
  const label = { color: t.onContainer, fontFamily: t.family, fontSize: t.medium };
  return {
    color: t.series,
    backgroundColor: 'transparent',
    animation: false,
    textStyle: { fontFamily: t.family, color: t.onSurface, fontSize: t.small },
    grid: { left: 8, right: 24, top: 16, bottom: 8, containLabel: true },
    legend: { show: false, textStyle: { color: t.onSurfaceVariant, fontFamily: t.family } },
    tooltip: {
      trigger: 'axis',
      backgroundColor: t.container,
      borderWidth: 0,
      borderRadius: t.radius,
      padding: 8,
      textStyle: label,
      axisPointer: { type: 'line', lineStyle: { color: t.outline, width: 1 }, shadowStyle: { color: t.outlineVariant, opacity: 0.4 } },
    },
    // Patterns are set per series below; ECharts writes no label of its own over the card's aria-label.
    aria: { enabled: true, label: { enabled: false }, decal: { show: false } },
  };
}

function axisDefaults(axis: Opt, t: ChartTheme, counts: boolean, fallbackType: 'category' | 'value'): Opt {
  const type = axis.type ?? fallbackType;
  const axisLabel = { color: t.onSurfaceVariant, fontFamily: t.family, fontSize: t.small };
  const d: Opt = type === 'category'
    ? { axisLine: { lineStyle: { color: t.outline } }, axisTick: { show: false }, axisLabel, splitLine: { show: false } }
    : { axisLine: { show: false }, axisTick: { show: false }, axisLabel, splitLine: { lineStyle: { color: t.outlineVariant, width: 1 } }, nameTextStyle: { color: t.onSurfaceVariant } };
  if (type === 'value' && counts) d.minInterval = 1;
  return withDefaults(d, axis);
}

function axesWithDefaults(axes: unknown, t: ChartTheme, counts: boolean, fallbackType: 'category' | 'value') {
  if (Array.isArray(axes)) return axes.map((a) => axisDefaults(isPlain(a) ? a : {}, t, counts, fallbackType));
  return isPlain(axes) ? axisDefaults(axes, t, counts, fallbackType) : axes;
}

const firstAxis = (a: unknown): Opt => (Array.isArray(a) ? a[0] ?? {} : isPlain(a) ? a : {});

// Brand the option a preset or a caller wrote. `counts` puts integer steps on every value axis.
export function applyBrand(option: Opt, t: ChartTheme, look: ChartLook = DEFAULT_LOOK, counts = false): Opt {
  const callerPalette = Object.hasOwn(option, 'color');
  const out: Opt = withDefaults(brandBase(t), option);
  if (option.xAxis !== undefined) out.xAxis = axesWithDefaults(option.xAxis, t, counts, 'category');
  if (option.yAxis !== undefined) out.yAxis = axesWithDefaults(option.yAxis, t, counts, 'value');
  const horizontal = firstAxis(option.yAxis).type === 'category';

  // Color follows the series, by name: each distinct name that is not a medal takes the next series
  // color, so a lollipop's stem and dot share one. A medal takes its medal color.
  const list: Opt[] = Array.isArray(option.series) ? option.series : isPlain(option.series) ? [option.series] : [];
  const names = [...new Set(list.map((s) => String(s.name ?? '')))];
  const plainNames = names.filter((n) => !medalOf({ name: n }));
  const colorFor = (name: string, medal?: unknown): string => {
    const m = medalOf({ name, medal });
    if (m) return t[m];
    const i = plainNames.indexOf(name);
    return t.series[(i < 0 ? 0 : i) % t.series.length];
  };
  const patternFor = (name: string) => (look.patterns ? decalFor(Math.max(0, names.indexOf(name)), t) : 'none');

  const series = list.map((s, i) => {
    const name = String(s.name ?? '');
    const paint = callerPalette ? undefined : colorFor(name, s.medal);
    const color = paint ? { color: paint } : {};
    const label = { color: t.onSurface, fontFamily: t.family, fontSize: t.small };
    switch (s.type) {
      case 'line': {
        const symbol = medalOf({ name, medal: s.medal }) ? 'circle' : SERIES_SYMBOLS[i % SERIES_SYMBOLS.length];
        return withDefaults({ symbol, symbolSize: look.pointSize, lineStyle: { width: look.lineWidth, ...color }, itemStyle: { ...color, ...(paint ? { borderColor: paint } : {}) }, label, emphasis: { focus: 'series' } }, s);
      }
      case 'bar': {
        const radius = s.stack ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
        return withDefaults({ barMaxWidth: look.barWidth, itemStyle: { ...color, borderColor: t.surface, borderWidth: 1, borderRadius: radius, decal: patternFor(name) }, label, emphasis: { focus: 'series' } }, s);
      }
      case 'scatter':
        return withDefaults({ symbolSize: look.pointSize, itemStyle: { ...color, borderColor: t.surface, borderWidth: 1 }, label, emphasis: { focus: 'series' } }, s);
      case 'treemap': {
        // The name sits on a surface chip so it reads on any tile color. The chip is a rich text fragment:
        // a background on the label itself would fill the whole tile, because a treemap sizes its label to the tile.
        const chip = { color: t.onSurface, backgroundColor: t.surface, padding: [2, 4], borderRadius: t.radius, fontFamily: t.family, fontSize: t.small };
        const box = { color: t.onSurface, fontFamily: t.family, fontSize: t.small, formatter: '{n|{b}}', rich: { n: chip } };
        const nested = Array.isArray(s.data) && s.data.some((d: Opt) => Array.isArray(d?.children));
        // Nested: each series' group takes its color. Flat: every tile takes the series color, set on the
        // tile because a treemap's own color list does not reach a leaf drawn without a parent.
        const data = callerPalette || !Array.isArray(s.data)
          ? s.data
          : nested
            ? s.data.map((d: Opt) => withDefaults({ itemStyle: { color: colorFor(String(d.name ?? ''), d.medal) } }, d))
            : s.data.map((d: Opt) => withDefaults({ itemStyle: { color: colorFor(name, s.medal) } }, d));
        return withDefaults({
          left: 8, right: 8, top: 8, bottom: 8,
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          itemStyle: { borderColor: t.surface, borderWidth: 0, gapWidth: 2 },
          label: { ...box, position: 'insideTopLeft' },
          upperLabel: { show: nested, height: 24, ...box },
          emphasis: { label: box, upperLabel: box },
          data,
        }, { ...s, data });
      }
      default:
        return withDefaults({ itemStyle: color, label }, s);
    }
  });
  if (list.length) out.series = series;
  // A treemap answers per tile, not per axis position.
  if (list.length && list.every((s) => s.type === 'treemap') && option.tooltip?.trigger === undefined) out.tooltip = { ...out.tooltip, trigger: 'item' };
  // The reader's motion preference wins over anything the option asked for.
  if (look.reduceMotion) out.animation = false;
  return out;
}

export type ChartInput = {
  preset?: ChartPreset;
  categories?: (string | number)[];
  series?: ChartSeries[];
  sort?: SortOrder;
  counts?: boolean;
  option?: Opt;
};

// The finished option: a preset's option (when there are series), with the caller's option over it, branded.
export function buildChartOption(input: ChartInput, t: ChartTheme, look: ChartLook = DEFAULT_LOOK): Opt {
  const preset = input.preset ?? 'line';
  const counts = input.counts ?? COUNT_PRESETS.includes(preset);
  const sorted = sortData(input.categories ?? [], input.series ?? [], input.sort);
  const base = input.series ? presetOption(preset, sorted.categories, sorted.series, look) : {};
  return applyBrand(withDefaults(base, input.option ?? {}), t, look, counts);
}

// The table view of a preset's numbers: one row per series for charts across categories (years), one
// row per category for charts down the side (rankings, treemaps). Values are plain figures.
export type TableColumn = { key: string; label: string; numeric?: boolean; sortable?: boolean };
export type TableRow = { key: string; cells: Record<string, string>; sort?: Record<string, number | string | null> };
// A missing value reads as the site's not-found label, which the caller passes in from its copy.
const figure = (v: number | null | undefined, notFound: string) => (v === null || v === undefined ? notFound : v.toLocaleString('en-US', { maximumFractionDigits: 2 }));

export function tableFor(preset: ChartPreset, categories: (string | number)[], series: ChartSeries[], nameColumn: string, sort?: SortOrder, notFound = ''): { columns: TableColumn[]; rows: TableRow[] } {
  const d = sortData(categories, series, sort);
  if (CATEGORY_ROW_PRESETS.includes(preset)) {
    const shown = preset === 'lollipop' ? d.series.slice(0, 1) : d.series;
    return {
      columns: [{ key: 'name', label: nameColumn }, ...shown.map((s, i) => ({ key: `s${i}`, label: s.name, numeric: true }))],
      rows: d.categories.map((c, ci) => ({ key: String(c), cells: { name: String(c), ...Object.fromEntries(shown.map((s, i) => [`s${i}`, figure(s.values[ci], notFound)])) } })),
    };
  }
  return {
    columns: [{ key: 'name', label: nameColumn }, ...d.categories.map((c) => ({ key: String(c), label: String(c), numeric: true }))],
    rows: d.series.map((s) => ({ key: s.name, cells: { name: s.name, ...Object.fromEntries(d.categories.map((c, i) => [String(c), figure(s.values[i], notFound)])) } })),
  };
}

// Series names an option draws, in order, for the card's legend (a treemap draws none of its own).
export function legendNames(option: Opt): string[] {
  const list: Opt[] = Array.isArray(option?.series) ? option.series : [];
  return [...new Set(list.filter((s) => s.type !== 'treemap' && s.name).map((s) => String(s.name)))];
}
