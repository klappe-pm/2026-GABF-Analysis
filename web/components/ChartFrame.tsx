'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { baseOption, SERIES_SYMBOLS } from '@/design/echarts-theme';
import { RuledTable } from './RuledTable';

echarts.use([LineChart, GridComponent, TooltipComponent, SVGRenderer]);

type Series = { name: string; values: number[] };

type Props = {
  id: string;
  title: string;
  note?: string;
  categories: (string | number)[];
  series: Series[];
  tableSummary: string;
  nameColumn: string;
  ariaLabel: string;
};

const SHAPES = ['M1 1h8v8H1z', 'M5 1 9 9H1z', 'M5 0 10 5 5 10 0 5z', 'M1.5 1.5h7v7h-7z', 'M5 1.5 8.5 8.5h-7z'];

function Swatch({ index }: { index: number }) {
  const hollow = index >= 3;
  return (
    <svg viewBox="0 0 10 10" className="size-3 shrink-0" aria-hidden="true">
      <path d={SHAPES[index]} style={{ fill: hollow ? 'none' : `var(--gabf-color-series-${index + 1})`, stroke: `var(--gabf-color-series-${index + 1})` }} strokeWidth={hollow ? 1.5 : 0} />
    </svg>
  );
}

// A chart in a ruled frame: title, legend of drawn marks, the plot, and a table view of the same numbers.
export function ChartFrame({ id, title, note, categories, series, tableSummary, nameColumn, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: 'svg' });
    const draw = () => {
      const { option, tokens } = baseOption(el);
      chart.setOption({
        ...option,
        xAxis: { ...option.xAxis, data: categories.map(String), boundaryGap: false },
        series: series.map((s, i) => ({
          type: 'line',
          name: s.name,
          data: s.values,
          symbol: SERIES_SYMBOLS[i % SERIES_SYMBOLS.length],
          symbolSize: 8,
          lineStyle: { width: 1.5, color: tokens.series[i] },
          itemStyle: { color: tokens.series[i], borderColor: tokens.series[i], borderRadius: 0 },
          emphasis: { focus: 'series' },
        })),
      }, true);
    };
    draw();
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [categories, series]);

  return (
    <figure className="flex flex-col border border-rule" aria-labelledby={`${id}-title`}>
      <figcaption className="flex flex-col gap-2 border-b border-rule bg-ground-tone px-4 py-3">
        <span id={`${id}-title`} className="text-h3 text-ink">{title}</span>
        {note ? <span className="text-data text-ink-muted">{note}</span> : null}
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
          {series.map((s, i) => (
            <li key={s.name} className="inline-flex items-center gap-2 font-narrow text-label text-ink">
              <Swatch index={i} />
              {s.name}
            </li>
          ))}
        </ul>
      </figcaption>
      <div ref={ref} role="img" aria-label={ariaLabel} className="h-(--gabf-size-chart) w-full px-2" />
      <details className="border-t border-rule">
        <summary className="cursor-pointer px-4 py-2 font-narrow text-label uppercase text-ink state-hover:bg-ground-tone">{tableSummary}</summary>
        <div className="px-4 pb-4">
          <RuledTable
            caption={title}
            scroll={false}
            columns={[{ key: 'name', label: nameColumn }, ...categories.map((c) => ({ key: String(c), label: String(c), numeric: true }))]}
            rows={series.map((s) => ({ key: s.name, cells: { name: s.name, ...Object.fromEntries(categories.map((c, i) => [String(c), s.values[i]])) } }))}
          />
        </div>
      </details>
    </figure>
  );
}
