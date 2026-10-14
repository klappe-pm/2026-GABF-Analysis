'use client';

import { useSettings } from '@/design/runtime';
import { color, labelFace, onColor } from '@/design/helpers';
import { Icon } from './Icon';
import type { NavItem } from './NavigationRail';

// Material's standard navigation drawer for large and extra large windows: it stays open beside the page,
// listing every destination with its icon and label, the current one on a full width indicator.
export function NavigationDrawer({ label, title, items, active, className = '', inline = false }: { label: string; title?: string; items: NavItem[]; active?: string; className?: string; inline?: boolean }) {
  const s = useSettings('navigation-drawer');
  const indicator = s['Indicator color'] ?? 'secondary container';
  return (
    <nav
      aria-label={label}
      data-nav={inline ? undefined : "drawer"}
      className={`${inline ? "" : "sticky top-0 h-dvh"} shrink-0 flex-col gap-1 overflow-y-auto px-3 py-4 ${className}`}
      style={{ width: `${Number(s.Width ?? 360)}px`, maxWidth: '100%', background: color(s['Container color'] ?? 'surface container low') }}
    >
      {title ? <p className="type-title-small px-4 py-4 text-on-surface-variant">{title}</p> : null}
      {items.map((item) => {
        const current = item.id === active;
        return (
          <a
            key={item.id}
            href={item.href}
            aria-current={current ? 'location' : undefined}
            className="type-label-large flex min-h-14 items-center gap-3 rounded-(--md-sys-shape-corner-full) px-4 text-on-surface-variant state-hover:bg-surface-container-highest"
            style={current ? { background: color(indicator), color: onColor(indicator), ...labelFace(item.text) } : labelFace(item.text)}
          >
            <Icon name={item.icon} size={24} />
            {item.text}
          </a>
        );
      })}
    </nav>
  );
}
