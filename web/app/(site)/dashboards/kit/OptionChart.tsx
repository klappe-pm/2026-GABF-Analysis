'use client';

// A dashboard chart: a spec whose builder (kit/charts.ts) makes an ECharts option for the card's width, drawn on the
// one chart card (web/components/ChartShell.tsx) with the dashboards' base (no animation, a transparent background,
// the kit's text) under the builder's option, a legend of the drawn marks, and a control that saves it as an image.
import { useCallback, type ReactNode } from 'react';
import { ChartShell, type Built, type ChartOption, type LegendItem } from '@/components/ChartShell';
import type { Column, Row } from '@/components/DataTable';
import type { Kit } from '@/design/chart-kit';

export type { Built, ChartOption, LegendItem };

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
  /** The label of the control that saves the chart as an image. */
  saveLabel: string;
  table: { caption: string; columns: Column[]; rows: Row[]; initialSort?: { key: string; dir: 'ascending' | 'descending' } };
  /** A mark was chosen: its name and the index of its datum in the series. */
  onSelect?: (name: string, index: number, series: string) => void;
};

export function OptionChart({ spec }: { spec: ChartSpec }) {
  const { build: make } = spec;
  const build = useCallback((kit: Kit, width: number): Built => {
    const b = make(kit, width);
    return { ...b, option: { animation: false, backgroundColor: 'transparent', textStyle: kit.text(), ...b.option } };
  }, [make]);
  return (
    <ChartShell
      id={spec.id}
      title={spec.title}
      subtitle={spec.subtitle}
      note={spec.note}
      ariaLabel={spec.ariaLabel}
      legendItems={spec.legend}
      build={build}
      tableSummary={spec.tableSummary}
      table={spec.table}
      saveLabel={spec.saveLabel}
      onSelect={spec.onSelect}
    />
  );
}
