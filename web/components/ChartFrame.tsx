'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { baseOption, SERIES_SYMBOLS } from '@/design/echarts-theme';
import { SETTINGS_EVENT, useDesign, useSettings } from '@/design/runtime';
import { cardSurface, color, labelFace } from '@/design/helpers';
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

function Swatch({ index, role }: { index: number; role: string }) {
  const hollow = index >= 3;
  return (
    <svg viewBox="0 0 10 10" width={12} height={12} className="shrink-0" aria-hidden="true">
      <path d={SHAPES[index % SHAPES.length]} style={{ fill: hollow ? 'none' : color(role), stroke: color(role) }} strokeWidth={hollow ? 1.5 : 0} />
    </svg>
  );
}

// A chart on a card: title, legend of drawn marks, the plot, and a table view of the same numbers.
// The plot reads the scheme when it draws, and draws again when the settings load or change.
export function ChartFrame({ id, title, note, categories, series, tableSummary, nameColumn, ariaLabel }: Props) {
  const s = useSettings('chart-frame');
  const { global } = useDesign();
  const roles = (Array.isArray(s['Series colors']) ? s['Series colors'] : ['primary', 'tertiary', 'secondary', 'on surface variant', 'outline']) as string[];
  const lineWidth = Number(s['Line width'] ?? 2);
  const pointSize = Number(s['Point size'] ?? 8);
  const card = cardSurface(s['Card style']);
  const ref = useRef<HTMLDivElement>(null);
  const rolesKey = roles.join('|');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: 'svg' });
    const draw = () => {
      const { option, theme } = baseOption(el, rolesKey.split('|'));
      chart.setOption({
        ...option,
        xAxis: { ...option.xAxis, data: categories.map(String), boundaryGap: false },
        series: series.map((x, i) => ({
          type: 'line',
          name: x.name,
          data: x.values,
          symbol: SERIES_SYMBOLS[i % SERIES_SYMBOLS.length],
          symbolSize: pointSize,
          lineStyle: { width: lineWidth, color: theme.series[i % theme.series.length] },
          itemStyle: { color: theme.series[i % theme.series.length], borderColor: theme.series[i % theme.series.length] },
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
  }, [categories, series, rolesKey, lineWidth, pointSize, global]);

  return (
    <figure className={`flex flex-col overflow-hidden ${card.className}`} style={card.style} aria-labelledby={`${id}-title`}>
      {card.elevated ? <md-elevation /> : null}
      <figcaption className="flex flex-col gap-2 px-4 pt-4 pb-2">
        <span id={`${id}-title`} className="type-title-medium text-on-surface">{title}</span>
        {note ? <span className="type-body-medium text-on-surface-variant">{note}</span> : null}
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
          {series.map((x, i) => (
            <li key={x.name} className="type-label-large inline-flex items-center gap-2 text-on-surface" style={labelFace(x.name)}>
              <Swatch index={i} role={roles[i % roles.length]} />
              {x.name}
            </li>
          ))}
        </ul>
      </figcaption>
      <div ref={ref} role="img" aria-label={ariaLabel} className="h-80 w-full px-2" />
      <details className="border-t border-outline-variant">
        <summary className="type-label-large cursor-pointer px-4 py-3 text-primary state-hover:bg-surface-container-low">{tableSummary}</summary>
        <div className="px-4 pb-4">
          <RuledTable
            caption={title}
            scroll={false}
            columns={[{ key: 'name', label: nameColumn }, ...categories.map((c) => ({ key: String(c), label: String(c), numeric: true }))]}
            rows={series.map((x) => ({ key: x.name, cells: { name: x.name, ...Object.fromEntries(categories.map((c, i) => [String(c), x.values[i]])) } }))}
          />
        </div>
      </details>
    </figure>
  );
}
