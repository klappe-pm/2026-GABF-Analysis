'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, ScatterChart, TreemapChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { medalVar, readTheme, seriesVar } from '@/design/echarts-theme';
import {
  buildChartOption, type ChartLook, type ChartPreset, type ChartSeries, CATEGORY_ROW_PRESETS, legendNames, medalOf, type SortOrder, tableFor,
} from '@/design/chart-presets';
import { SETTINGS_EVENT, useDesign, useReducedMotion, useSettings } from '@/design/runtime';
import { cardSurface, labelFace } from '@/design/helpers';
import { type Column, DataTable, type Row } from './DataTable';

echarts.use([LineChart, BarChart, ScatterChart, TreemapChart, AriaComponent, GridComponent, LegendComponent, TooltipComponent, SVGRenderer]);

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

const SHAPES: Record<string, string> = {
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
function Swatch({ index, slot, name, form, patterns }: { index: number; slot: number; name: string; form: 'mark' | 'fill'; patterns: boolean }) {
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
      <path d={SHAPES[shape]} style={{ fill: hollow ? 'none' : paint, stroke: paint }} strokeWidth={hollow ? 1.5 : 0} />
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
  const s = useSettings('chart-card');
  const { global } = useDesign();
  const reduceMotion = useReducedMotion();
  const card = cardSurface(s['Card style']);
  const look: ChartLook = useMemo(() => ({
    lineWidth: Number(s['Line width'] ?? 2),
    pointSize: Number(s['Point size'] ?? 8),
    barWidth: Number(s['Bar width'] ?? 24),
    patterns: s['Series patterns'] !== 'no',
    reduceMotion,
  }), [s, reduceMotion]);
  const ref = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: 'svg' });
    const draw = () => chart.setOption(buildChartOption(input, readTheme(el), look) as EChartsOption, true);
    draw();
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    window.addEventListener(SETTINGS_EVENT, draw);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener(SETTINGS_EVENT, draw);
      chart.dispose();
    };
  }, [input, look, global]);

  return (
    <figure className={`flex flex-col overflow-hidden ${card.className}`} style={card.style} aria-labelledby={`${id}-title`} data-component="chart-card" data-preset={preset ?? 'option'}>
      {card.elevated ? <md-elevation /> : null}
      <figcaption className="flex flex-col gap-2 px-4 pt-4 pb-2">
        <span id={`${id}-title`} className="type-title-medium text-on-surface">{title}</span>
        {note ? <span className="type-body-medium text-on-surface-variant">{note}</span> : null}
        {showLegend ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
            {names.map((name, i) => (
              <li key={name} className="type-label-large inline-flex items-center gap-2 text-on-surface" style={labelFace(name)}>
                <Swatch index={i} slot={names.filter((n) => !medalOf({ name: n })).indexOf(name)} name={name} form={form} patterns={look.patterns} />
                {name}
              </li>
            ))}
          </ul>
        ) : null}
      </figcaption>
      {description ? <p id={`${id}-description`} className="sr-only">{description}</p> : null}
      <div
        ref={ref}
        role="img"
        aria-label={ariaLabel}
        aria-describedby={description ? `${id}-description` : undefined}
        className="w-full px-2"
        style={{ height: plotHeight }}
      />
      <details className="border-t border-outline-variant">
        <summary className="type-label-large cursor-pointer px-4 py-3 text-primary state-hover:bg-surface-container-low">{tableSummary}</summary>
        <div className="px-4 pb-4">
          <DataTable caption={title} columns={table.columns} rows={table.rows} />
        </div>
      </details>
    </figure>
  );
}
