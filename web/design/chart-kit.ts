// The colors and type every chart draws with, read from the theme's custom properties each time a chart draws
// (so a chart redrawn after the settings load picks up the scheme). The chart card (web/components/ChartShell.tsx)
// reads it and hands it to the chart's builder. The base is readTheme in web/design/echarts-theme.ts, kept whole as
// theme for the preset charts; this adds what the other chart types need: the medal metals, a sequential scale built
// from the primary container, and the text color that reads on each fill.
import { type ChartTheme, readTheme } from './echarts-theme';

export const REGIONS = ['Midwest', 'Northeast', 'South', 'West'] as const;
export const MEDALS = ['Gold', 'Silver', 'Bronze'] as const;

export type Kit = {
  /** The theme as read, for the preset charts (web/design/chart-presets.ts). */
  theme: ChartTheme;
  series: string[];
  region: Record<string, string>;
  medal: Record<string, string>;
  seq: string[];
  page: string;
  ink: string;
  inkSecondary: string;
  outline: string;
  grid: string;
  noData: string;
  onDark: string;
  family: string;
  small: number;
  medium: number;
  tooltip: { backgroundColor: string; color: string; radius: number };
  textOn: (fill: string) => string;
  /** The text for a chart: a label never holds a figure in the narrow face, so the body face sets all of it. */
  text: (extra?: Record<string, unknown>) => Record<string, unknown>;
};

const parse = (hex: string): [number, number, number] | null => {
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const luminance = (rgb: [number, number, number]) => {
  const [r, g, b] = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return 1;
  const [hi, lo] = [Math.max(luminance(x), luminance(y)), Math.min(luminance(x), luminance(y))];
  return (hi + 0.05) / (lo + 0.05);
};

// Seven steps from the lightest tint of the primary container to the deepest tone of the primary, so a
// count reads as more by getting darker. Falls back to the container itself if a value is not a hex color.
export function sequential(from: string, to: string, steps = 7): string[] {
  const a = parse(from);
  const b = parse(to);
  if (!a || !b) return Array.from({ length: steps }, () => from);
  const lift = (c: [number, number, number]) => c.map((v) => v + (255 - v) * 0.45);
  const start = lift(a);
  return Array.from({ length: steps }, (_, i) => toHex(start.map((v, k) => v + (b[k] - v) * (i / (steps - 1)))));
}

export function readKit(el: Element): Kit {
  const t = readTheme(el);
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const series = t.series;
  const page = v('--md-sys-color-surface');
  const ink = t.onSurface;
  const onDark = v('--md-sys-color-on-primary');
  const textOn = (fill: string) => (contrast(fill, ink) >= contrast(fill, onDark) ? ink : onDark);
  return {
    theme: t,
    series,
    region: { Midwest: series[0], Northeast: series[1], South: series[2], West: series[3] },
    medal: { Gold: v('--app-color-gold'), Silver: v('--app-color-silver'), Bronze: v('--app-color-bronze') },
    seq: sequential(v('--md-sys-color-primary-container'), v('--md-sys-color-on-primary-container')),
    page,
    ink,
    inkSecondary: t.onSurfaceVariant,
    outline: t.outline,
    grid: t.outlineVariant,
    noData: v('--md-sys-color-surface-container'),
    onDark,
    family: t.family,
    small: t.small,
    medium: t.medium,
    tooltip: { backgroundColor: t.container, color: t.onContainer, radius: t.radius },
    textOn,
    text: (extra = {}) => ({ color: ink, fontFamily: t.family, fontSize: t.small, ...extra }),
  };
}

// Color bins for a count: an exact edge starts each bin, the first being zero.
export type Bin = { min: number; max: number; fill: string; text: string };

export function bins(kit: Kit, edges: number[], fills = kit.seq): Bin[] {
  const picks = edges.length === fills.length ? fills : edges.map((_, i) => fills[Math.round((i / Math.max(1, edges.length - 1)) * (fills.length - 1))]);
  return edges.map((min, i) => ({ min, max: i + 1 < edges.length ? edges[i + 1] - 1 : Infinity, fill: picks[i], text: kit.textOn(picks[i]) }));
}

export const binOf = (set: Bin[], value: number): Bin => [...set].reverse().find((b) => value >= b.min) ?? set[0];

// Bin edges for a rate: zero, then evenly populated steps rounded to two figures.
export function rateEdges(values: number[], steps = 5): number[] {
  const sorted = values.filter((x) => x > 0).sort((a, b) => a - b);
  if (!sorted.length) return [0];
  const edges = [0];
  for (let i = 0; i < steps; i += 1) {
    const q = sorted[Math.min(sorted.length - 1, Math.floor((i / steps) * sorted.length))];
    const r = Number(q.toPrecision(2));
    if (r > edges[edges.length - 1]) edges.push(r);
  }
  return edges;
}
