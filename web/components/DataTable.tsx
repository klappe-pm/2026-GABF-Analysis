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
// A table wider than its container scrolls inside the container, never the page: an edge fade shows on each side
// that has more columns, and the first column stays in place while the rest scroll.
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

  // Which sides have more columns to scroll to, read on scroll and whenever the container or table changes size.
  const [more, setMore] = useState({ start: false, end: false });
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const read = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setMore((m) => (m.start === start && m.end === end ? m : { start, end }));
    };
    read();
    el.addEventListener('scroll', read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { el.removeEventListener('scroll', read); ro.disconnect(); };
  }, []);

  const toggle = (key: string) => setSort((p) => ({ key, dir: p?.key === key && p.dir === 'descending' ? 'ascending' : 'descending' }));
  const head = s['Header color'] ?? 'surface container';
  const rowHeight = `${Number(s['Row height'] ?? 48)}px`;
  const divider = s['Row dividers'] === 'no' ? '' : 'border-b border-outline-variant';
  const wrap = s['Cell wrapping'] === 'allowed' ? '' : 'whitespace-nowrap';
  const align = (c: Column) => (s['Cell alignment'] === 'numbers right' && c.numeric ? 'text-right' : 'text-left');
  const weight = s['Header weight'] === 'regular' ? 400 : s['Header weight'] === 'medium' ? 500 : 700;

  // The end edge fades while more columns lie past it; once scrolled, the fixed first column casts a soft shadow.
  const fade = 'pointer-events-none absolute inset-y-px right-px w-6 rounded-r-(--md-sys-shape-corner-medium) bg-linear-to-l from-[color-mix(in_srgb,var(--md-sys-color-shadow)_14%,transparent)] to-transparent transition-opacity';
  const pinned = `sticky left-0 ${more.start ? 'shadow-[4px_0_6px_-4px_color-mix(in_srgb,var(--md-sys-color-shadow)_30%,transparent)]' : ''}`;
  return (
    <div className="relative max-w-full" data-component="data-table">
      <div
        ref={box}
        className={`max-w-full rounded-(--md-sys-shape-corner-medium) border border-outline-variant ${scroll ? 'max-h-[32rem] overflow-auto' : 'overflow-x-auto'}`}
        tabIndex={0}
        role="region"
        aria-label={caption}
        data-table-scroll=""
      >
        <table className="type-body-medium w-full border-separate border-spacing-0 tabular-nums">
          <caption className="sr-only">
            {caption}
            {sortHint ? `. ${sortHint}` : ''}
          </caption>
          <thead ref={thead}>
            <tr>
              {columns.map((c, i) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? sort.dir : undefined}
                    className={`type-label-large sticky top-0 border-b border-outline-variant px-4 align-middle ${i === 0 ? `${pinned} z-[2]` : 'z-[1]'} ${wrap} ${align(c)}`}
                    style={{ background: color(head), color: onColor(head), height: rowHeight, fontWeight: weight, ...(scroll ? {} : { transform: 'translateY(var(--head-shift, 0px))' }), ...(hasFigure(c.label) ? { fontFamily: 'var(--md-ref-typeface-plain)' } : {}) }}
                  >
                    {c.sortable ? (
                      <button type="button" onClick={() => toggle(c.key)} className="inline-flex min-h-11 items-center gap-1">
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
              <tr key={r.key} className={r.highlight ? 'bg-secondary-container' : 'bg-surface state-hover:bg-surface-container-low'}>
                {columns.map((c, i) => {
                  const Cell = i === 0 ? 'th' : 'td';
                  return (
                    <Cell key={c.key} scope={i === 0 ? 'row' : undefined} className={`${divider} ${wrap} px-4 font-normal ${i === 0 ? `${pinned} bg-inherit` : ''} ${align(c)}`} style={{ height: rowHeight }}>
                      {r.cells[c.key]}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div aria-hidden="true" className={`${fade} ${more.end ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}
