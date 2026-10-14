// Authored icons drawn on a 16 unit grid with one stroke weight, square caps, and mitred joins,
// like marks made with a ruling pen. They inherit the text color.

export type IconName = 'close' | 'chevron-down' | 'search' | 'check' | 'menu' | 'sort' | 'sort-ascending' | 'sort-descending';

const PATHS: Record<IconName, string> = {
  close: 'M3.5 3.5 12.5 12.5 M12.5 3.5 3.5 12.5',
  'chevron-down': 'M3.5 6 8 10.5 12.5 6',
  search: 'M7 2.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9 M10.25 10.25 13.5 13.5',
  check: 'M3 8.5 6.5 12 13 4.5',
  menu: 'M2.5 4.5h11 M2.5 8h11 M2.5 11.5h11',
  sort: 'M5 6.5 8 3.5 11 6.5 M5 9.5 8 12.5 11 9.5',
  'sort-ascending': 'M5 7 8 4 11 7 M8 4v8.5',
  'sort-descending': 'M5 9 8 12 11 9 M8 12V3.5',
};

export function Icon({ name, className = 'size-4', label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`shrink-0 fill-none stroke-current ${className}`}
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
