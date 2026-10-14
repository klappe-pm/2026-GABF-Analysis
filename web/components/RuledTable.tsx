'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export type Column = { key: string; label: string; numeric?: boolean; sortable?: boolean; narrow?: boolean };
export type Row = { key: string; cells: Record<string, ReactNode>; sort?: Record<string, number | string | null>; highlight?: boolean };

type Props = {
  caption: string;
  sortHint?: string;
  columns: Column[];
  rows: Row[];
  initialSort?: { key: string; dir: 'ascending' | 'descending' };
  scroll?: boolean;
};

// A ruled table: column rules, a heavy rule under a sticky header, tabular figures, sortable headers.
export function RuledTable({ caption, sortHint, columns, rows, initialSort, scroll = true }: Props) {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = a.sort?.[sort.key];
      const y = b.sort?.[sort.key];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [rows, sort]);

  const toggle = (key: string) => setSort((s) => ({ key, dir: s?.key === key && s.dir === 'descending' ? 'ascending' : 'descending' }));

  return (
    <div className={`border border-rule ${scroll ? 'max-h-(--gabf-size-table) overflow-auto' : 'overflow-x-auto'}`} tabIndex={scroll ? 0 : undefined} role={scroll ? 'region' : undefined} aria-label={scroll ? caption : undefined}>
      <table className="w-full border-separate border-spacing-0 text-data tabular-nums">
        <caption className="sr-only">
          {caption}
          {sortHint ? `. ${sortHint}` : ''}
        </caption>
        <thead>
          <tr>
            {columns.map((c, i) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? sort.dir : undefined}
                  className={`sticky top-0 z-(--gabf-layer-sticky) border-b-2 border-ink bg-ground-tone px-3 py-2 align-bottom font-narrow text-label uppercase text-ink-muted ${i < columns.length - 1 ? 'border-r border-r-rule' : ''} ${c.numeric ? 'text-right' : 'text-left'}`}
                >
                  {c.sortable ? (
                    <button type="button" onClick={() => toggle(c.key)} className={`inline-flex items-center gap-1 uppercase state-hover:text-ink ${active ? 'text-ink' : ''} ${c.numeric ? 'flex-row-reverse' : ''}`}>
                      <span>{c.label}</span>
                      <Icon name={active ? (sort.dir === 'ascending' ? 'sort-ascending' : 'sort-descending') : 'sort'} className="size-4 text-ink-faint" />
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key} className={r.highlight ? 'bg-green-tint' : 'state-hover:bg-ground-tone'}>
              {columns.map((c, i) => {
                const Cell = i === 0 ? 'th' : 'td';
                return (
                  <Cell
                    key={c.key}
                    scope={i === 0 ? 'row' : undefined}
                    className={`border-b border-rule px-3 py-2 align-top font-regular ${i < columns.length - 1 ? 'border-r' : ''} ${c.numeric ? 'text-right' : 'text-left'} ${c.narrow ? 'font-narrow' : ''}`}
                  >
                    {r.cells[c.key]}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
