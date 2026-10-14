'use client';

import { useSettings } from '@/design/runtime';
import { color, labelFace, onColor } from '@/design/helpers';
import { Icon, type IconName } from './Icon';

export type NavItem = { id: string; href: string; text: string; icon: IconName };

// Material's navigation rail for medium and expanded windows: a narrow column of destinations, each an
// icon in a pill shaped indicator with its label under it. It stays beside the page as it scrolls.
export function NavigationRail({ label, items, active, className = '', inline = false }: { label: string; items: NavItem[]; active?: string; className?: string; inline?: boolean }) {
  const s = useSettings('navigation-rail');
  const indicator = s['Indicator color'] ?? 'secondary container';
  return (
    <nav
      aria-label={label}
      data-nav={inline ? undefined : "rail"}
      className={`${inline ? "" : "sticky top-0 h-dvh"} w-20 shrink-0 flex-col items-center gap-3 overflow-y-auto py-4 ${className}`}
      style={{ background: color(s['Container color'] ?? 'surface container low') }}
    >
      {items.map((item) => {
        const current = item.id === active;
        return (
          <a key={item.id} href={item.href} aria-current={current ? 'location' : undefined} className="group flex w-full flex-col items-center gap-1 text-on-surface-variant">
            <span
              className="flex h-8 w-14 items-center justify-center rounded-(--md-sys-shape-corner-full) group-hover:bg-surface-container-highest"
              style={current ? { background: color(indicator), color: onColor(indicator) } : undefined}
            >
              <Icon name={item.icon} size={24} />
            </span>
            {s['Show labels'] === 'no' ? <span className="sr-only">{item.text}</span> : <span className="type-label-medium text-center" style={labelFace(item.text)}>{item.text}</span>}
          </a>
        );
      })}
    </nav>
  );
}
