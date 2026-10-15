'use client';

// The one chart card: the figure (title, subtitle, legend), the plot, an optional note under it, and the table view
// of the same numbers. It draws an ECharts option that a builder makes from the theme (web/design/chart-kit.ts) and
// the plot's width, and draws it again when the plot's own width changes (one ResizeObserver) or the settings load or
// change. Every chart on the site renders through it: the preset charts of the design system (ChartCard), the
// dashboards (OptionChart), and the analysis reports (analysis/parts/charts.tsx). The card style comes from the
// chart-card spec.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, CustomChart, HeatmapChart, LineChart, MapChart, ScatterChart, TreemapChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';
import { readKit, type Kit } from '@/design/chart-kit';
import { cardSurface, labelFace } from '@/design/helpers';
import { SETTINGS_EVENT, useSettings } from '@/design/runtime';
import { Button } from './Button';
import { type Column, DataTable, type Row } from './DataTable';

echarts.use([
  BarChart, CustomChart, HeatmapChart, LineChart, MapChart, ScatterChart, TreemapChart,
  AriaComponent, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, SVGRenderer, CanvasRenderer,
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
      setItems(shown);
    });
    return () => { live = false; };
  }, [build, legendItems, width, tick]);

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
