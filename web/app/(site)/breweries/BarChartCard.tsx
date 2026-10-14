'use client';

// A bar chart on a card for the breweries pages, drawn with ECharts from the theme in web/design/echarts-theme.ts:
// a stacked column per category for a split such as medals by year, or horizontal bars for a ranking such
// as medals by category. The value axis is whole numbers only. The table view under the chart holds the
// same numbers, one row per category and one column per series.
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { baseOption } from '@/design/echarts-theme';
import { cardSurface, labelFace } from '@/design/helpers';
import { SETTINGS_EVENT, useDesign, useSettings } from '@/design/runtime';
import { DataTable } from '@/components/DataTable';

echarts.use([BarChart, GridComponent, TooltipComponent, SVGRenderer]);

export type BarSeries = { name: string; values: number[]; medal?: 'Gold' | 'Silver' | 'Bronze' };

type Props = {
  id: string;
  title: string;
  note?: string;
  categories: string[];
  series: BarSeries[];
  orientation: 'columns' | 'bars';
  tableSummary: string;
  nameColumn: string;
  ariaLabel: string;
};

const MEDAL_VAR = { Gold: '--app-color-gold', Silver: '--app-color-silver', Bronze: '--app-color-bronze' } as const;

export function BarChartCard({ id, title, note, categories, series, orientation, tableSummary, nameColumn, ariaLabel }: Props) {
  const s = useSettings('chart-card');
  const { global } = useDesign();
  const card = cardSurface(s['Card style']);
  const ref = useRef<HTMLDivElement>(null);
  const stacked = series.length > 1;
  const height = orientation === 'bars' ? Math.max(200, 32 * categories.length + 56) : 320;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: 'svg' });
    const draw = () => {
      const { option, theme } = baseOption(el);
      const css = getComputedStyle(el);
      const fill = (x: BarSeries, i: number) => (x.medal ? css.getPropertyValue(MEDAL_VAR[x.medal]).trim() : theme.series[i % theme.series.length]);
      const valueAxis = { ...option.yAxis, minInterval: 1, min: 0 };
      const categoryAxis = { ...option.xAxis, data: categories, ...(orientation === 'bars' ? { inverse: true, axisLabel: { ...option.xAxis.axisLabel, width: 180, overflow: 'truncate' as const } } : {}) };
      chart.setOption({
        ...option,
        grid: { ...option.grid, left: 8, right: 24 },
        tooltip: { ...option.tooltip, axisPointer: { type: 'shadow' as const, shadowStyle: { color: theme.outlineVariant, opacity: 0.3 } } },
        xAxis: orientation === 'bars' ? valueAxis : categoryAxis,
        yAxis: orientation === 'bars' ? categoryAxis : valueAxis,
        series: series.map((x, i) => ({
          type: 'bar',
          name: x.name,
          data: x.values,
          stack: stacked ? 'total' : undefined,
          barMaxWidth: 28,
          itemStyle: { color: fill(x, i), borderColor: theme.onSurface, borderWidth: stacked ? 0.75 : 0 },
          emphasis: { focus: 'series' },
        })),
      }, true);
    };
    draw();
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    window.addEventListener(SETTINGS_EVENT, draw);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener(SETTINGS_EVENT, draw);
      chart.dispose();
    };
  }, [categories, series, orientation, stacked, global]);

  return (
    <figure className={`flex min-w-0 flex-col overflow-hidden ${card.className}`} style={card.style} aria-labelledby={`${id}-title`}>
      {card.elevated ? <md-elevation /> : null}
      <figcaption className="flex flex-col gap-2 px-4 pt-4 pb-2">
        <span id={`${id}-title`} className="type-title-medium text-on-surface">{title}</span>
        {note ? <span className="type-body-medium text-on-surface-variant">{note}</span> : null}
        {stacked ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
            {series.map((x, i) => (
              <li key={x.name} className="type-label-large inline-flex items-center gap-2 text-on-surface" style={labelFace(x.name)}>
                <span className="inline-block size-3 shrink-0 border border-on-surface" style={{ background: x.medal ? `var(${MEDAL_VAR[x.medal]})` : `var(--app-color-series-${(i % 5) + 1})` }} />
                {x.name}
              </li>
            ))}
          </ul>
        ) : null}
      </figcaption>
      <div ref={ref} role="img" aria-label={ariaLabel} className="w-full px-2" style={{ height }} />
      <details className="border-t border-outline-variant">
        <summary className="type-label-large cursor-pointer px-4 py-3 text-primary state-hover:bg-surface-container-low">{tableSummary}</summary>
        <div className="px-4 pb-4">
          <DataTable
            caption={title}
            scroll={false}
            columns={[{ key: 'name', label: nameColumn }, ...series.map((x) => ({ key: x.name, label: x.name }))]}
            rows={categories.map((c, i) => ({ key: c, cells: { name: c, ...Object.fromEntries(series.map((x) => [x.name, x.values[i] ?? 0])) } }))}
          />
        </div>
      </details>
    </figure>
  );
}
