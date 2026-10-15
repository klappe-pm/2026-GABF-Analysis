'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSettings } from '@/design/runtime';
import { color, hasFigure, onColor } from '@/design/helpers';
import { Icon } from './Icon';

export type Column = { key: string; label: string; numeric?: boolean; sortable?: boolean };
export type Row = { key: string; cells: Record<string, ReactNode>; sort?: Record<string, number | string | null>; highlight?: boolean };

type Props = {
  caption: string;
  sortHint?: string;
  columns: Column[];
  rows: Row[];
  initialSort?: { key: string; dir: 'ascending' | 'descending' };
  scroll?: boolean;
};

// A data table in Material's manner: a tinted header row, row dividers, tabular figures, sortable headers.
// Header color and weight, row height, dividers, wrapping, and alignment come from the table spec.
// A table wider than its container scrolls inside the container, never the page.
// A table that does not scroll on its own keeps its header row in view while the page scrolls, until
// the reader scrolls past the table. CSS sticky cannot do that here, because the sideways scroll
// container is also the box sticky pins to, so the header cells are moved down by the distance scrolled.
function usePageStickyHeader(on: boolean) {
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLTableSectionElement>(null);
  useEffect(() => {
    const el = box.current;
    const thead = head.current;
    if (!on || !el || !thead) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      // the phone tab row is sticky at the top of the page, so the header stops below it
      const tabs = document.querySelector<HTMLElement>('[data-nav="tabs"]');
      const tabsBox = tabs && tabs.offsetParent ? tabs.getBoundingClientRect() : null;
      const top = tabsBox && tabsBox.top <= 0 ? Math.max(0, tabsBox.bottom) : 0;
      const r = el.getBoundingClientRect();
      const shift = Math.min(Math.max(0, top - r.top), Math.max(0, r.height - thead.offsetHeight));
      el.style.setProperty('--head-shift', `${shift}px`);
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    // filtering or sorting changes the table height without a scroll
    const resize = new ResizeObserver(queue);
    resize.observe(el);
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    return () => {
      resize.disconnect();
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [on]);
  return { box, head };
}

export function DataTable({ caption, sortHint, columns, rows, initialSort, scroll = true }: Props) {
  const s = useSettings('data-table');
  const { box, head: thead } = usePageStickyHeader(!scroll);
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

  const toggle = (key: string) => setSort((p) => ({ key, dir: p?.key === key && p.dir === 'descending' ? 'ascending' : 'descending' }));
  const head = s['Header color'] ?? 'surface container';
  const rowHeight = `${Number(s['Row height'] ?? 48)}px`;
  const divider = s['Row dividers'] === 'no' ? '' : 'border-b border-outline-variant';
  const wrap = s['Cell wrapping'] === 'allowed' ? '' : 'whitespace-nowrap';
  const align = (c: Column) => (s['Cell alignment'] === 'numbers right' && c.numeric ? 'text-right' : 'text-left');
  const weight = s['Header weight'] === 'regular' ? 400 : s['Header weight'] === 'medium' ? 500 : 700;

  return (
    <div
      ref={box}
      className={`max-w-full rounded-(--md-sys-shape-corner-medium) border border-outline-variant ${scroll ? 'max-h-[32rem] overflow-auto' : 'overflow-x-auto'}`}
      tabIndex={0}
      role="region"
      aria-label={caption}
      data-table-scroll=""
      data-component="data-table"
    >
      <table className="type-body-medium w-full border-separate border-spacing-0 tabular-nums">
        <caption className="sr-only">
          {caption}
          {sortHint ? `. ${sortHint}` : ''}
        </caption>
        <thead ref={thead}>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? sort.dir : undefined}
                  className={`type-label-large sticky top-0 z-[1] border-b border-outline-variant px-4 align-middle ${wrap} ${align(c)}`}
                  style={{ background: color(head), color: onColor(head), height: rowHeight, fontWeight: weight, ...(scroll ? {} : { transform: 'translateY(var(--head-shift, 0px))' }), ...(hasFigure(c.label) ? { fontFamily: 'var(--md-ref-typeface-plain)' } : {}) }}
                >
                  {c.sortable ? (
                    <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1">
                      <span>{c.label}</span>
                      <Icon name={active ? (sort.dir === 'ascending' ? 'sort-ascending' : 'sort-descending') : 'sort'} size={16} />
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
            <tr key={r.key} className={r.highlight ? 'bg-secondary-container' : 'state-hover:bg-surface-container-low'}>
              {columns.map((c, i) => {
                const Cell = i === 0 ? 'th' : 'td';
                return (
                  <Cell key={c.key} scope={i === 0 ? 'row' : undefined} className={`${divider} ${wrap} px-4 font-normal ${align(c)}`} style={{ height: rowHeight }}>
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
