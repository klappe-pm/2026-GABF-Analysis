'use client';

// A chart card of the recommended chart types (the chart gallery, option A): stacked bars by medal, lollipops, a
// treemap, and a square tile grid. It draws a builder from the dashboards kit on the same card as the dashboards, with
// a table view of the same numbers, and takes every word as copy.
import { type ReactNode } from 'react';
import { type Column, type Row } from '@/components/DataTable';
import { OptionChart, type Built, type LegendItem } from '@/app/(site)/dashboards/kit/OptionChart';
import type { Bin, Kit } from '@/app/(site)/dashboards/kit/theme';
import type { ViewCopy } from './kit';
import { fill } from './kit';

export type Chrome = ViewCopy['chrome'];

export function Plot({ id, title, subtitle, note, chrome, tableSummary, ariaLabel, build, legend, table, onSelect }: {
  id: string;
  title: string;
  subtitle?: string;
  note?: ReactNode;
  chrome: Chrome;
  tableSummary: string;
  ariaLabel?: string;
  build: (kit: Kit, width: number) => Built;
  legend?: (kit: Kit) => LegendItem[];
  table: { columns: Column[]; rows: Row[]; initialSort?: { key: string; dir: 'ascending' | 'descending' } };
  onSelect?: (name: string, index: number, series: string) => void;
}) {
  return <OptionChart spec={{ id, title, subtitle, note, ariaLabel: ariaLabel ?? title, tableSummary, saveLabel: chrome.savePng, legend, build, onSelect, table: { caption: title, ...table } }} />;
}

// The legend of a binned scale: one swatch per bin, labeled with its range.
export function binLegend(chrome: Chrome, set: Bin[], format: (n: number) => string = (n) => n.toLocaleString('en-US')): LegendItem[] {
  return set.map((b, i) => {
    const next = set[i + 1];
    const label = !next
      ? fill(chrome.binOpen, { min: format(b.min) })
      : next.min - b.min <= 1 || (b.min === 0 && next.min === 1)
        ? fill(chrome.binSingle, { min: format(b.min) })
        : fill(chrome.binRange, { min: format(b.min), max: format(Number.isInteger(next.min) ? next.min - 1 : next.min) });
    return { label, color: b.fill };
  });
}
