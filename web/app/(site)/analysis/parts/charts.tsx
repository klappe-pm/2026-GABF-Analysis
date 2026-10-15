'use client';

// The chart cards of the category and analysis pages that the preset charts do not draw: horizontal bars and stacked
// columns. Each draws a builder from the dashboards kit (kit/charts.ts) on the one chart card
// (web/components/ChartCard.tsx), with its title, a table view of the same numbers, and a description for screen
// readers.
import { useMemo } from 'react';
import { ChartShell } from '@/components/ChartCard';
import { type Column, type Row } from '@/components/DataTable';
import { TextLink } from '@/components/TextLink';
import { SERIES_COUNT, seriesVar } from '@/design/echarts-theme';
import { labelFace } from '@/design/helpers';
import { useDesign } from '@/design/runtime';
import { reportBars, reportBarsHeight, reportStacked } from '@/app/(site)/dashboards/kit/charts';

// The legend swatch of a stacked series: the five series colors of settings.md, then Material containers.
const EXTRA = ['primary-container', 'tertiary-container', 'secondary-container'];
const seriesCss = (i: number) => (i < SERIES_COUNT ? `var(${seriesVar(i)})` : `var(--md-sys-color-${EXTRA[(i - SERIES_COUNT) % EXTRA.length]})`);

type Base = { id: string; title: string; subtitle?: string; note?: string; tableSummary: string; ariaLabel: string };

export type BarItem = { label: string; value: number; href?: string };

// Horizontal bars, largest first, one bar per item. labelWidth is the category label column on a wide card; on a card
// narrower than the dashboards' NARROW width the labels take at most 38% of it, so the bars keep room on a phone.
export function BarCard({ items, valueName, labelHeader, roleIndex = 0, labelWidth = 200, detail, ...base }: Base & { items: BarItem[]; valueName: string; labelHeader: string; roleIndex?: number; labelWidth?: number; detail?: { columns: Column[]; rows: Row[] } }) {
  const key = JSON.stringify(items.map((i) => [i.label, i.value]));
  const { global } = useDesign();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const build = useMemo(() => reportBars({ labels: items.map((i) => i.label), values: items.map((i) => i.value), valueName, roleIndex, labelWidth }), [key, valueName, roleIndex, labelWidth, global]);
  const table = detail ?? {
    columns: [{ key: 'label', label: labelHeader }, { key: 'value', label: valueName, numeric: true }],
    rows: items.map((i, n) => ({ key: `${i.label}-${n}`, cells: { label: i.href ? <TextLink href={i.href}>{i.label}</TextLink> : i.label, value: i.value.toLocaleString('en-US') } })),
  };
  return (
    <ChartShell
      id={base.id}
      title={base.title}
      subtitle={base.subtitle}
      captionNote={base.note}
      ariaLabel={base.ariaLabel}
      build={build}
      height={reportBarsHeight(items.length)}
      tableSummary={base.tableSummary}
      table={{ caption: base.title, ...table }}
    />
  );
}

export type StackSeries = { name: string; values: number[] };

// Stacked columns, one column per label (a year), one segment per series.
export function StackedCard({ labels, series, nameColumn, notes, ...base }: Base & { labels: (string | number)[]; series: StackSeries[]; nameColumn: string; notes?: string[] }) {
  const key = JSON.stringify([labels, series, notes]);
  const { global } = useDesign();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const build = useMemo(() => reportStacked({ labels, series, notes }), [key, global]);
  return (
    <ChartShell
      id={base.id}
      title={base.title}
      subtitle={base.subtitle}
      captionNote={base.note}
      ariaLabel={base.ariaLabel}
      build={build}
      height={320}
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
      tableSummary={base.tableSummary}
      table={{
        caption: base.title,
        columns: [{ key: 'name', label: nameColumn }, ...labels.map((l) => ({ key: String(l), label: String(l), numeric: true }))],
        rows: series.map((x) => ({ key: x.name, cells: { name: x.name, ...Object.fromEntries(labels.map((l, i) => [String(l), x.values[i]])) } })),
      }}
    />
  );
}
