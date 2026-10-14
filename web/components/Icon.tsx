'use client';

import { useSettings } from '@/design/runtime';

// Outline icons on a 16 unit grid with round caps and joins, in the weight of Material's outlined symbols.
// They inherit the text color. Size and stroke width come from the icon spec.

export type IconName = 'close' | 'chevron-down' | 'search' | 'check' | 'menu' | 'sort' | 'sort-ascending' | 'sort-descending' | 'filter';

const PATHS: Record<IconName, string> = {
  close: 'M4 4 12 12 M12 4 4 12',
  'chevron-down': 'M4 6 8 10 12 6',
  search: 'M7 2.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9 M10.25 10.25 13.5 13.5',
  check: 'M3 8.5 6.5 12 13 4.5',
  menu: 'M2.5 4.5h11 M2.5 8h11 M2.5 11.5h11',
  sort: 'M5 6.5 8 3.5 11 6.5 M5 9.5 8 12.5 11 9.5',
  'sort-ascending': 'M5 7 8 4 11 7 M8 4v8.5',
  'sort-descending': 'M5 9 8 12 11 9 M8 12V3.5',
  filter: 'M2.5 4h11 M4.5 8h7 M6.5 12h3',
};

export function Icon({ name, label, size, slot }: { name: IconName; label?: string; size?: number; slot?: string }) {
  const s = useSettings('icon');
  const px = size ?? Number(s.Size ?? 20);
  return (
    <svg
      viewBox="0 0 16 16"
      slot={slot}
      width={px}
      height={px}
      className="shrink-0 fill-none stroke-current"
      strokeWidth={Number(s['Stroke width'] ?? 1.5)}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
