'use client';

// The chart cards of the category and analysis pages that ChartCard (lines only) does not draw: horizontal bars,
// stacked columns, and the state map. Each sits on a card with its title, a table view of the same numbers, and
// a description for screen readers, and reads the Material scheme every time it draws, like ChartCard.
import { type ReactNode, useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, MapChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { type Column, DataTable, type Row } from '@/components/DataTable';
import { TextLink } from '@/components/TextLink';
import { baseOption, SERIES_COUNT, seriesVar } from '@/design/echarts-theme';
import { cardSurface, labelFace } from '@/design/helpers';
import { SETTINGS_EVENT, useDesign, useSettings } from '@/design/runtime';
import { NARROW } from '@/app/(site)/dashboards/kit/charts';

echarts.use([BarChart, MapChart, GridComponent, TooltipComponent, VisualMapComponent, SVGRenderer]);

// The five series colors of settings.md, then Material containers for a chart with more series.
const EXTRA = ['primary-container', 'tertiary-container', 'secondary-container'];
const seriesCss = (i: number) => (i < SERIES_COUNT ? `var(${seriesVar(i)})` : `var(--md-sys-color-${EXTRA[(i - SERIES_COUNT) % EXTRA.length]})`);
const paint = (el: Element, theme: { series: string[] }, i: number) => (i < SERIES_COUNT ? theme.series[i] : getComputedStyle(el).getPropertyValue(`--md-sys-color-${EXTRA[(i - SERIES_COUNT) % EXTRA.length]}`).trim());

type Base = { id: string; title: string; subtitle?: string; note?: string; tableSummary: string; ariaLabel: string };

function Frame({ id, title, subtitle, note, tableSummary, legend, children, table }: Omit<Base, 'ariaLabel'> & { legend?: ReactNode; children: ReactNode; table: ReactNode }) {
  const s = useSettings('chart-card');
  const card = cardSurface(s['Card style']);
  return (
    <figure className={`flex min-w-0 flex-col overflow-hidden ${card.className}`} style={card.style} aria-labelledby={`${id}-title`}>
      {card.elevated ? <md-elevation /> : null}
      <figcaption className="flex flex-col gap-2 px-4 pt-4 pb-2">
        <span id={`${id}-title`} className="type-title-medium text-on-surface">{title}</span>
        {subtitle ? <span className="type-body-medium text-on-surface-variant">{subtitle}</span> : null}
        {note ? <span className="type-body-small text-on-surface-variant">{note}</span> : null}
        {legend}
      </figcaption>
      {children}
      <details className="border-t border-outline-variant">
        <summary className="type-label-large cursor-pointer px-4 py-3 text-primary state-hover:bg-surface-container-low">{tableSummary}</summary>
        <div className="px-4 pb-4">{table}</div>
      </details>
    </figure>
  );
}

// Draws an ECharts option on a div and again whenever the scheme settings change or the div changes width
// (a ResizeObserver, so a panel opening or a column narrowing is caught, not only a window resize). The option is
// built again on a width change because some options (bar label widths) depend on it.
function usePlot(build: (el: HTMLElement) => echarts.EChartsCoreOption | Promise<echarts.EChartsCoreOption>, deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const { global } = useDesign();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: 'svg' });
    let live = true;
    const draw = () => { Promise.resolve(build(el)).then((o) => { if (live) chart.setOption(o, true); }); };
    draw();
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      chart.resize();
      if (el.clientWidth !== width) { width = el.clientWidth; draw(); }
    });
    observer.observe(el);
    window.addEventListener(SETTINGS_EVENT, draw);
    return () => {
      live = false;
      observer.disconnect();
      window.removeEventListener(SETTINGS_EVENT, draw);
      chart.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, global]);
  return ref;
}

export type BarItem = { label: string; value: number; href?: string };

// Horizontal bars, largest first, one bar per item. labelWidth is the category label column on a wide card; on a card
// narrower than the dashboards' NARROW width the labels take at most 38% of it, so the bars keep room on a phone.
export function BarCard({ items, valueName, labelHeader, roleIndex = 0, labelWidth = 200, detail, ...base }: Base & { items: BarItem[]; valueName: string; labelHeader: string; roleIndex?: number; labelWidth?: number; detail?: { columns: Column[]; rows: Row[] } }) {
  const key = JSON.stringify(items.map((i) => [i.label, i.value]));
  const ref = usePlot((el) => {
    const { option, theme } = baseOption(el);
    const w = el.clientWidth;
    const labels = w && w < NARROW ? Math.min(labelWidth, Math.round(w * 0.38)) : labelWidth;
    return {
      ...option,
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      tooltip: { ...option.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { ...option.yAxis, type: 'value', splitLine: { lineStyle: { color: theme.outlineVariant, width: 1 } } },
      yAxis: { ...option.xAxis, type: 'category', inverse: true, data: items.map((i) => i.label), axisLabel: { ...option.xAxis.axisLabel, width: labels, overflow: 'truncate' } },
      series: [{ type: 'bar', name: valueName, data: items.map((i) => i.value), barMaxWidth: 22, itemStyle: { color: theme.series[roleIndex % theme.series.length] }, label: { show: true, position: 'right', color: theme.onSurfaceVariant, fontFamily: theme.family, fontSize: theme.small } }],
    };
  }, [key, roleIndex, labelWidth]);
  return (
    <Frame {...base} table={detail ? (
      <DataTable caption={base.title} scroll={false} columns={detail.columns} rows={detail.rows} />
    ) : (
      <DataTable
        caption={base.title}
        scroll={false}
        columns={[{ key: 'label', label: labelHeader }, { key: 'value', label: valueName, numeric: true }]}
        rows={items.map((i, n) => ({ key: `${i.label}-${n}`, cells: { label: i.href ? <TextLink href={i.href}>{i.label}</TextLink> : i.label, value: i.value.toLocaleString('en-US') } }))}
      />
    )}>
      <div ref={ref} role="img" aria-label={base.ariaLabel} className="w-full px-2" style={{ height: Math.max(200, 34 * items.length + 60) }} />
    </Frame>
  );
}

export type StackSeries = { name: string; values: number[] };

// Stacked columns, one column per label (a year), one segment per series.
export function StackedCard({ labels, series, nameColumn, notes, ...base }: Base & { labels: (string | number)[]; series: StackSeries[]; nameColumn: string; notes?: string[] }) {
  const key = JSON.stringify([labels, series]);
  const ref = usePlot((el) => {
    const { option, theme } = baseOption(el);
    return {
      ...option,
      tooltip: { ...option.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { ...option.xAxis, data: labels.map((l, i) => (notes?.[i] ? `${l}\n${notes[i]}` : String(l))) },
      series: series.map((x, i) => ({ type: 'bar', stack: 'total', name: x.name, data: x.values, barMaxWidth: 36, itemStyle: { color: paint(el, theme, i), borderColor: theme.container, borderWidth: 0.5 } })),
    };
  }, [key]);
  return (
    <Frame
      {...base}
      legend={(
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
          {series.map((x, i) => (
            <li key={x.name} className="type-label-large inline-flex items-center gap-2 text-on-surface" style={labelFace(x.name)}>
              <svg viewBox="0 0 10 10" width={12} height={12} className="shrink-0"><rect width="10" height="10" style={{ fill: seriesCss(i) }} /></svg>
              {x.name}
            </li>
          ))}
        </ul>
      )}
      table={(
        <DataTable
          caption={base.title}
          scroll={false}
          columns={[{ key: 'name', label: nameColumn }, ...labels.map((l) => ({ key: String(l), label: String(l), numeric: true }))]}
          rows={series.map((x) => ({ key: x.name, cells: { name: x.name, ...Object.fromEntries(labels.map((l, i) => [String(l), x.values[i]])) } }))}
        />
      )}
    >
      <div ref={ref} role="img" aria-label={base.ariaLabel} className="h-80 w-full px-2" />
    </Frame>
  );
}

export type MapDatum = { name: string; value: number };

// The United States by state, shaded by value.
export function MapCard({ data, valueName, nameColumn, tooltip, ...base }: Base & { data: MapDatum[]; valueName: string; nameColumn: string; tooltip: (d: MapDatum) => string }) {
  const key = JSON.stringify(data);
  const ref = usePlot(async (el) => {
    const { default: geo } = await import('../../../../../site/assets/us-states.geo.json');
    if (!echarts.getMap('usa')) echarts.registerMap('usa', geo as never);
    const { option, theme } = baseOption(el);
    const top = Math.max(1, ...data.map((d) => d.value));
    const container = getComputedStyle(el).getPropertyValue('--md-sys-color-primary-container').trim();
    const strong = theme.series[0];
    return {
      backgroundColor: option.backgroundColor,
      animation: false,
      textStyle: option.textStyle,
      tooltip: { ...option.tooltip, trigger: 'item', formatter: (p: { name: string; value: number }) => tooltip({ name: p.name, value: Number.isFinite(p.value) ? p.value : 0 }) },
      visualMap: { min: 0, max: top, left: 8, bottom: 8, orient: 'horizontal', calculable: false, text: [String(top), '0'], textStyle: { color: theme.onSurfaceVariant, fontFamily: theme.family }, inRange: { color: [container, strong] } },
      series: [{ type: 'map', map: 'usa', nameProperty: 'name', roam: false, name: valueName, data, label: { show: false }, itemStyle: { borderColor: theme.outlineVariant, borderWidth: 1, areaColor: container }, emphasis: { label: { show: false }, itemStyle: { borderColor: theme.onSurface, borderWidth: 2 } }, select: { disabled: true } }],
    };
  }, [key]);
  const shown = data.filter((d) => d.value).sort((a, b) => b.value - a.value);
  return (
    <Frame {...base} table={(
      <DataTable caption={base.title} scroll={false} columns={[{ key: 'name', label: nameColumn }, { key: 'value', label: valueName, numeric: true }]} rows={shown.map((d) => ({ key: d.name, cells: { name: d.name, value: d.value.toLocaleString('en-US') } }))} />
    )}>
      <div ref={ref} role="img" aria-label={base.ariaLabel} className="h-[28rem] w-full px-2" />
    </Frame>
  );
}
