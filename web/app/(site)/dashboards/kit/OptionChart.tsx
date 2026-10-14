'use client';

// A chart card that draws an ECharts option built for the card's width. The chart card in
// web/components draws line charts from categories and series; the dashboards also need stacked bars,
// a tile grid, a treemap, lollipops, heatmaps, and a scatter, so this card takes a builder that returns
// the option, and draws it with the same theme, the same figure markup (title, legend of drawn marks,
// the plot, a table view of the same numbers), and the same redraw when the settings load or change.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, CustomChart, HeatmapChart, ScatterChart, TreemapChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { DataTable, type Column, type Row } from '@/components/DataTable';
import { cardSurface, labelFace } from '@/design/helpers';
import { SETTINGS_EVENT, useSettings } from '@/design/runtime';
import { readKit, type Kit } from './theme';

echarts.use([BarChart, CustomChart, HeatmapChart, ScatterChart, TreemapChart, GridComponent, TooltipComponent, SVGRenderer]);

export type ChartOption = Record<string, unknown>;
export type Built = { option: ChartOption; height: number };

/** One mark in the legend: a swatch of the color the plot draws it in. */
export type LegendItem = { label: string; color: string; shape?: 'square' | 'circle' | 'diamond' | 'triangle' };

export type ChartSpec = {
  id: string;
  title: string;
  subtitle?: string;
  note?: ReactNode;
  ariaLabel: string;
  /** Legend items are colors, so they are read from the kit when the card draws. */
  legend?: (kit: Kit) => LegendItem[];
  build: (kit: Kit, width: number) => Built;
  tableSummary: string;
  table: { caption: string; columns: Column[]; rows: Row[]; initialSort?: { key: string; dir: 'ascending' | 'descending' } };
  /** A mark was chosen: its name and the index of its datum in the series. */
  onSelect?: (name: string, index: number, series: string) => void;
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

export function OptionChart({ spec }: { spec: ChartSpec }) {
  const s = useSettings('chart-card');
  const card = cardSurface(s['Card style']);
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const select = useRef(spec.onSelect);
  select.current = spec.onSelect;
  const [width, setWidth] = useState(0);
  const [tick, setTick] = useState(0);
  const [legend, setLegend] = useState<LegendItem[]>([]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
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

  const { build, legend: legendOf } = spec;
  useEffect(() => {
    const el = host.current;
    const instance = chart.current;
    if (!el || !instance || width < 100) return;
    const kit = readKit(el);
    const { option, height } = build(kit, width);
    el.style.height = `${height}px`;
    instance.resize({ width, height });
    instance.setOption({ animation: false, backgroundColor: 'transparent', textStyle: kit.text(), ...option }, true);
    setLegend(legendOf ? legendOf(kit) : []);
  }, [build, legendOf, width, tick]);

  const table = spec.table;
  return (
    <figure className={`flex flex-col overflow-hidden ${card.className}`} style={card.style} aria-labelledby={`${spec.id}-title`}>
      {card.elevated ? <md-elevation /> : null}
      <figcaption className="flex flex-col gap-2 px-4 pt-4 pb-2">
        <span id={`${spec.id}-title`} className="type-title-medium text-on-surface" style={labelFace(spec.title)}>{spec.title}</span>
        {spec.subtitle ? <span className="type-body-medium text-on-surface-variant">{spec.subtitle}</span> : null}
        {legend.length ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
            {legend.map((x) => (
              <li key={x.label} className="type-label-large inline-flex items-center gap-2 text-on-surface" style={labelFace(x.label)}>
                <Swatch color={x.color} shape={x.shape} />
                {x.label}
              </li>
            ))}
          </ul>
        ) : null}
      </figcaption>
      <div className="px-2"><div ref={host} role="img" aria-label={spec.ariaLabel} className="w-full" style={{ minHeight: 160 }} /></div>
      {spec.note ? <p className="type-body-small px-4 pt-2 pb-3 text-on-surface-variant">{spec.note}</p> : null}
      <details className="border-t border-outline-variant">
        <summary className="type-label-large cursor-pointer px-4 py-3 text-primary state-hover:bg-surface-container-low">{spec.tableSummary}</summary>
        <div className="px-4 pb-4">
          <DataTable caption={table.caption} scroll={false} columns={table.columns} rows={table.rows} initialSort={table.initialSort} />
        </div>
      </details>
    </figure>
  );
}
