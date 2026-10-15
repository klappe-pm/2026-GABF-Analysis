'use client';

// The chart card, the one card every chart on the site renders through. ChartShell is the card itself: the figure
// (title, subtitle, legend), the plot, an optional note under it, and the table view of the same numbers. It draws an
// ECharts option that a builder makes from the theme (web/design/chart-kit.ts) and the plot's width, and draws it
// again when the plot's own width changes (one ResizeObserver) or the settings load or change. Three kinds of chart
// use it: ChartCard below (the design system presets, with plain data props a server page can pass), the dashboards
// (dashboards/kit/OptionChart.tsx), and the analysis reports (analysis/parts/charts.tsx). The card style and the look
// of the marks come from the chart-card spec.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';
import { BarChart, CustomChart, HeatmapChart, LineChart, ScatterChart, TreemapChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';
import { readKit, type Kit } from '@/design/chart-kit';
import {
  buildChartOption, type ChartLook, type ChartPreset, type ChartSeries, CATEGORY_ROW_PRESETS, legendNames, medalOf, type SortOrder, tableFor,
} from '@/design/chart-presets';
import { medalVar, seriesVar } from '@/design/echarts-theme';
import { cardSurface, labelFace } from '@/design/helpers';
import { SETTINGS_EVENT, useDesign, useReducedMotion, useSettings } from '@/design/runtime';
import { Button } from './Button';
import { type Column, DataTable, type Row } from './DataTable';

echarts.use([
  BarChart, CustomChart, HeatmapChart, LineChart, ScatterChart, TreemapChart,
  AriaComponent, GridComponent, LegendComponent, TooltipComponent, SVGRenderer, CanvasRenderer,
]);

export type ChartOption = Record<string, unknown>;
/** What a builder returns: the option, and the plot height when the builder sets it (otherwise the card's own). */
export type Built = { option: ChartOption; height?: number };
export type ChartBuild = (kit: Kit, width: number) => Built | Promise<Built>;

/** One mark in the legend: a swatch of the color the plot draws it in. */
export type LegendItem = { label: string; color: string; shape?: 'square' | 'circle' | 'diamond' | 'triangle' };

export type ChartTable = { caption: string; columns: Column[]; rows: Row[]; initialSort?: { key: string; dir: 'ascending' | 'descending' }; scroll?: boolean };

export type ChartShellProps = {
  id: string;
  title: string;
  subtitle?: ReactNode;
  /** A short note in the caption, under the subtitle. */
  captionNote?: ReactNode;
  /** A note under the plot. */
  note?: ReactNode;
  ariaLabel: string;
  /** The finding, read by screen readers after the plot's name. */
  description?: string;
  /** A legend drawn by the caller. */
  legend?: ReactNode;
  /** A legend of the colors the plot draws, read from the theme when it draws; also set on a saved image. */
  legendItems?: (kit: Kit) => LegendItem[];
  build: ChartBuild;
  /** The plot height before the first draw (it is in the built HTML, so the page does not shift). */
  height?: number;
  tableSummary: string;
  table: ChartTable;
  /** The label of the control that saves the chart as an image; no control without it. */
  saveLabel?: string;
  /** A mark was chosen: its name and the index of its datum in the series. */
  onSelect?: (name: string, index: number, series: string) => void;
  /** The preset a design system chart draws, for the style guide and the review tools. */
  preset?: string;
};

const SHAPES: Record<NonNullable<LegendItem['shape']>, string> = {
  square: 'M1 1h8v8H1z',
  circle: 'M5 1a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  diamond: 'M5 0 10 5 5 10 0 5z',
  triangle: 'M5 1 9 9H1z',
};

function Swatch({ color, shape = 'square' }: { color: string; shape?: LegendItem['shape'] }) {
  return (
    <svg viewBox="0 0 10 10" width={12} height={12} className="shrink-0" aria-hidden="true">
      <path d={SHAPES[shape ?? 'square']} fill={color} />
    </svg>
  );
}

// The marks a preset chart draws with, from the chart-card spec: line width, point size, bar width, fill patterns, and
// whether the reader asked for reduced motion.
export function useChartLook(): ChartLook {
  const s = useSettings('chart-card');
  const reduceMotion = useReducedMotion();
  return useMemo(() => ({
    lineWidth: Number(s['Line width'] ?? 2),
    pointSize: Number(s['Point size'] ?? 8),
    barWidth: Number(s['Bar width'] ?? 24),
    patterns: s['Series patterns'] !== 'no',
    reduceMotion,
  }), [s, reduceMotion]);
}

type Drawn = { option: ChartOption; height: number; kit: Kit; legend: LegendItem[] };

// Saves the chart as a PNG: the option is drawn once more with the canvas renderer off screen (text in the page's own
// fonts), then the title and the legend are set above it, since they sit outside the plot.
async function savePng(title: string, width: number, d: Drawn) {
  const scale = 2;
  const off = echarts.init(document.createElement('div'), undefined, { renderer: 'canvas', width, height: d.height, devicePixelRatio: scale });
  off.setOption({ ...d.option, animation: false, backgroundColor: d.kit.page });
  const plot = new Image();
  plot.src = off.getDataURL({ type: 'png', pixelRatio: scale, backgroundColor: d.kit.page });
  await plot.decode();
  off.dispose();
  const pad = 16;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `${d.kit.small}px ${d.kit.family}`;
  const rows: LegendItem[][] = [[]];
  let x = pad;
  for (const item of d.legend) {
    const need = measure.measureText(item.label).width + 12 + 8 + 16;
    if (x + need > width - pad && rows[rows.length - 1].length) { rows.push([]); x = pad; }
    rows[rows.length - 1].push(item);
    x += need;
  }
  const head = pad + 24 + (d.legend.length ? rows.length * 22 : 0) + 8;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = (head + d.height) * scale;
  const g = canvas.getContext('2d')!;
  g.scale(scale, scale);
  g.fillStyle = d.kit.page;
  g.fillRect(0, 0, width, head + d.height);
  g.textBaseline = 'middle';
  g.fillStyle = d.kit.ink;
  g.font = `700 ${d.kit.small + 4}px ${d.kit.family}`;
  g.fillText(title, pad, pad + 10);
  g.font = `${d.kit.small}px ${d.kit.family}`;
  rows.forEach((row, r) => {
    let lx = pad;
    for (const item of row) {
      g.fillStyle = item.color;
      g.fillRect(lx, pad + 24 + r * 22 + 4, 12, 12);
      g.fillStyle = d.kit.ink;
      g.fillText(item.label, lx + 20, pad + 24 + r * 22 + 10);
      lx += measure.measureText(item.label).width + 12 + 8 + 16;
    }
  });
  g.drawImage(plot, 0, head, width, d.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ChartShell(props: ChartShellProps) {
  const { id, title, subtitle, captionNote, note, ariaLabel, description, legend, legendItems, build, height, tableSummary, table, saveLabel, onSelect, preset } = props;
  const s = useSettings('chart-card');
  const card = cardSurface(s['Card style']);
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [width, setWidth] = useState(0);
  const [tick, setTick] = useState(0);
  const [items, setItems] = useState<LegendItem[]>([]);
  const drawn = useRef<Drawn | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    const instance = echarts.init(el, undefined, { renderer: 'svg' });
    chart.current = instance;
    instance.on('click', (p) => {
      const data = p.data as { name?: string } | undefined;
      select.current?.(String(data?.name ?? p.name), p.dataIndex, String(p.seriesName ?? ''));
    });
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const redraw = () => setTick((n) => n + 1);
    window.addEventListener(SETTINGS_EVENT, redraw);
    return () => {
      observer.disconnect();
      window.removeEventListener(SETTINGS_EVENT, redraw);
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const el = host.current;
    const instance = chart.current;
    if (!el || !instance || width < 100) return undefined;
    let live = true;
    const kit = readKit(el);
    Promise.resolve(build(kit, width)).then((b) => {
      if (!live) return;
      if (b.height) {
        el.style.height = `${b.height}px`;
        instance.resize({ width, height: b.height });
      } else {
        instance.resize();
      }
      instance.setOption(b.option, true);
      const shown = legendItems ? legendItems(kit) : [];
      drawn.current = { option: b.option, height: b.height ?? el.clientHeight, kit, legend: shown };
      setItems((prev) => (prev.length === 0 && shown.length === 0 ? prev : shown));
    }).catch((e) => { console.error(`chart ${id} did not draw`, e); });
    return () => { live = false; };
  }, [build, legendItems, width, tick, id]);

  const save = () => { if (drawn.current && width >= 100) void savePng(title, width, drawn.current); };
  const heading = <span id={`${id}-title`} className="type-title-medium text-on-surface" style={labelFace(title)}>{title}</span>;

  return (
    <figure className={`flex min-w-0 flex-col overflow-hidden ${card.className}`} style={card.style} aria-labelledby={`${id}-title`} data-component="chart-card" data-preset={preset}>
      {card.elevated ? <md-elevation /> : null}
      <figcaption className="flex flex-col gap-2 px-4 pt-4 pb-2">
        {saveLabel ? (
          <div className="flex flex-wrap items-start justify-between gap-2">
            {heading}
            <Button variant="quiet" onClick={save}>{saveLabel}</Button>
          </div>
        ) : heading}
        {subtitle ? <span className="type-body-medium text-on-surface-variant">{subtitle}</span> : null}
        {captionNote ? <span className="type-body-small text-on-surface-variant">{captionNote}</span> : null}
        {legend ?? (items.length ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
            {items.map((x) => (
              <li key={x.label} className="type-label-large inline-flex items-center gap-2 text-on-surface" style={labelFace(x.label)}>
                <Swatch color={x.color} shape={x.shape} />
                {x.label}
              </li>
            ))}
          </ul>
        ) : null)}
      </figcaption>
      {description ? <p id={`${id}-description`} className="sr-only">{description}</p> : null}
      <div className="px-2">
        <div
          ref={host}
          role="img"
          aria-label={ariaLabel}
          aria-describedby={description ? `${id}-description` : undefined}
          className="w-full"
          style={height ? { height } : { minHeight: 160 }}
        />
      </div>
      {note ? <p className="type-body-small px-4 pt-2 pb-3 text-on-surface-variant">{note}</p> : null}
      <details className="border-t border-outline-variant">
        <summary className="type-label-large cursor-pointer px-4 py-3 text-primary state-hover:bg-surface-container-low">{tableSummary}</summary>
        <div className="px-4 pb-4">
          <DataTable caption={table.caption} scroll={table.scroll ?? false} columns={table.columns} rows={table.rows} initialSort={table.initialSort} />
        </div>
      </details>
    </figure>
  );
}

// ---------- the design system presets ----------

export type { ChartPreset, ChartSeries, SortOrder };

type Common = {
  id: string;
  title: string;
  note?: string;
  // What the chart shows, read by screen readers as the plot's name; description adds the finding.
  ariaLabel: string;
  description?: string;
  // The label of the table view's disclosure.
  tableSummary: string;
  // Integer steps on every value axis. On by default for the count presets (all but line and treemap).
  counts?: boolean;
  // The plot's height in pixels. Defaults to 320, or one row per category for charts down the side.
  height?: number;
};

// A preset draws categories and series. An option, when given, sits over the preset's own; the table
// view is built from the series unless rows and columns are supplied.
type PresetProps = Common & {
  preset?: ChartPreset;
  categories: (string | number)[];
  series: ChartSeries[];
  sort?: SortOrder;
  nameColumn: string;
  // What the table view reads for a missing value: global.labels.not_found.
  notFound?: string;
  option?: EChartsOption;
  rows?: Row[];
  columns?: Column[];
};

// A full ECharts option, passed through: the card fills in the brand (series and medal colors, fonts,
// axes, grid) without replacing anything the option sets, and the caller supplies the table view. The
// option is plain data (it crosses from a server page), so formatters are template strings, not functions.
type OptionProps = Common & {
  option: EChartsOption;
  rows: Row[];
  columns: Column[];
  preset?: undefined;
  categories?: undefined;
  series?: undefined;
  sort?: undefined;
  nameColumn?: undefined;
  notFound?: undefined;
};

type Props = PresetProps | OptionProps;

const PRESET_SHAPES: Record<string, string> = {
  rect: 'M1 1h8v8H1z',
  triangle: 'M5 1 9 9H1z',
  diamond: 'M5 0 10 5 5 10 0 5z',
  emptyRect: 'M1.5 1.5h7v7h-7z',
  emptyTriangle: 'M5 1.5 8.5 8.5h-7z',
  circle: 'M5 1a4 4 0 1 1 0 8a4 4 0 1 1 0-8z',
};
const LINE_SHAPES = ['rect', 'triangle', 'diamond', 'emptyRect', 'emptyTriangle'];

// The fill patterns decalFor() draws on bars, in the same order, in the surface color.
const PATTERNS = ['', 'M-1 9 9-1M-1 14 14-1M4 14 14 4', 'M-1 1 9 11M-4 4 6 14M1-4 11 6', 'M2.5 2.5h.01M7.5 2.5h.01M2.5 7.5h.01M7.5 7.5h.01', 'M0 3h10M0 7h10'];

// A legend mark: the line preset's point shape, or a bar's square with its fill pattern.
// index is the series' place among all drawn series (its pattern and point shape); slot its place among
// the series that are not medals (its color), as applyBrand() assigns them.
function PresetSwatch({ index, slot, name, form, patterns }: { index: number; slot: number; name: string; form: 'mark' | 'fill'; patterns: boolean }) {
  const medal = medalOf({ name });
  const paint = `var(${medal ? medalVar(medal) : seriesVar(slot)})`;
  if (form === 'fill') {
    const pattern = patterns ? PATTERNS[index % PATTERNS.length] : '';
    return (
      <svg viewBox="0 0 10 10" width={12} height={12} className="shrink-0 overflow-hidden" aria-hidden="true">
        <rect x={0} y={0} width={10} height={10} rx={1.5} style={{ fill: paint }} />
        {pattern ? <path d={pattern} style={{ stroke: 'var(--md-sys-color-surface)', fill: 'none' }} strokeWidth={index % 5 === 3 ? 2.5 : 1.4} strokeLinecap="round" /> : null}
      </svg>
    );
  }
  const shape = medal ? 'circle' : LINE_SHAPES[index % LINE_SHAPES.length];
  const hollow = shape.startsWith('empty');
  return (
    <svg viewBox="0 0 10 10" width={12} height={12} className="shrink-0" aria-hidden="true">
      <path d={PRESET_SHAPES[shape]} style={{ fill: hollow ? 'none' : paint, stroke: paint }} strokeWidth={hollow ? 1.5 : 0} />
    </svg>
  );
}

// A chart on a card: title, note, a legend of the drawn marks, the plot, and a table view of the same
// numbers. Presets: line (the default), bar, stackedBar, horizontalBar, stackedHorizontalBar, lollipop,
// and treemap; or pass a full ECharts option with its own rows and columns. Colors are Series 1 color to
// Series 5 color and the medal colors in settings.md, read when the plot draws and again when the
// settings load or change.
//
// A tile grid (a row of headline figures) is not a chart: use FieldGrid with a Field per tile from
// StatCard.tsx, which is a CSS grid of stat cards.
export function ChartCard(props: Props) {
  const { id, title, note, ariaLabel, description, tableSummary, counts, height } = props;
  const { global } = useDesign();
  const look = useChartLook();

  const preset = props.series ? (props.preset ?? 'line') : undefined;
  const input = useMemo(
    () => ({ preset, categories: props.categories, series: props.series, sort: props.sort, counts, option: props.option as Record<string, unknown> | undefined }),
    [preset, props.categories, props.series, props.sort, counts, props.option],
  );

  // The legend: the series the card draws, in order. One series needs none, except on a line chart,
  // which has always shown it.
  const names = useMemo(() => (props.series ? (preset === 'treemap' && props.series.length === 1 ? [] : props.series.slice(0, preset === 'lollipop' ? 1 : undefined).map((x) => x.name)) : legendNames(props.option as Record<string, unknown>)), [preset, props.series, props.option]);
  const showLegend = names.length > 1 || (preset === 'line' && names.length === 1);
  const form = preset === 'line' || (!preset && Array.isArray((props.option as { series?: unknown })?.series) && ((props.option as { series: { type?: string }[] }).series.every((x) => x.type === 'line'))) ? 'mark' : 'fill';

  const table = useMemo(() => {
    if (props.rows && props.columns) return { rows: props.rows, columns: props.columns };
    return tableFor(preset ?? 'line', props.categories ?? [], props.series ?? [], props.nameColumn ?? '', props.sort, props.notFound);
  }, [props.rows, props.columns, preset, props.categories, props.series, props.nameColumn, props.sort, props.notFound]);

  const sideways = preset ? CATEGORY_ROW_PRESETS.includes(preset) && preset !== 'treemap' : false;
  const plotHeight = height ?? (sideways ? Math.max(240, (props.categories?.length ?? 0) * 32 + 48) : 320);

  // The preset option is built from the theme the card reads when it draws; the plot keeps the height above.
  const build = useCallback((kit: Kit) => ({ option: buildChartOption(input, kit.theme, look) as ChartOption }), [input, look, global]);

  return (
    <ChartShell
      id={id}
      title={title}
      subtitle={note}
      ariaLabel={ariaLabel}
      description={description}
      preset={preset ?? 'option'}
      height={plotHeight}
      build={build}
      legend={showLegend ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
          {names.map((name, i) => (
            <li key={name} className="type-label-large inline-flex items-center gap-2 text-on-surface" style={labelFace(name)}>
              <PresetSwatch index={i} slot={names.filter((n) => !medalOf({ name: n })).indexOf(name)} name={name} form={form} patterns={look.patterns} />
              {name}
            </li>
          ))}
        </ul>
      ) : undefined}
      tableSummary={tableSummary}
      table={{ caption: title, columns: table.columns, rows: table.rows, scroll: true }}
    />
  );
}
