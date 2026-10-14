'use client';

// The frame of every site page: the top app bar with the site name and the Filters button, the
// navigation for the window size class (tabs on compact windows, a rail on medium and expanded ones,
// and on large windows the drawer or the rail as "Navigation on wide screens" says), the active filter
// chips, then the page. Destinations and their order come from layout.md "Site navigation".
import { type ReactNode, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { activeItem } from './destinations.mjs';
import { NavigationDrawer } from '@/components/NavigationDrawer';
import { NavigationRail, type NavItem } from '@/components/NavigationRail';
import { PageHeader } from '@/components/PageHeader';
import { labelFace } from '@/design/helpers';
import { useDesign } from '@/design/runtime';
import { GlobalFilterProvider } from '@/lib/global-filter';
import { href } from '@/lib/href';
import { SiteFilterChips, SiteFilters, type SiteFiltersConfig } from './SiteFilters';

export type ShellItem = NavItem & { path: string; match: string[] };

export type ShellConfig = {
  brand: string;
  navLabel: string;
  menuLabel: string;
  skipLabel: string;
  nav: ShellItem[];
  more: ShellItem[];
  filters: SiteFiltersConfig;
};

export { activeItem };

// Material scrollable primary tabs: each tab hugs its one line label and the row scrolls sideways inside its
// own container, never the page. The current tab is scrolled into view.
function SiteTabs({ label, items, active }: { label: string; items: ShellItem[]; active?: string }) {
  const row = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const ul = row.current;
    const cur = ul?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (ul && cur) ul.scrollLeft = Math.max(0, cur.offsetLeft - (ul.clientWidth - cur.offsetWidth) / 2);
  }, [active]);
  return (
    <nav aria-label={label} data-nav="tabs" className="sticky top-0 z-10 border-b border-outline-variant bg-surface medium:hidden">
      <ul ref={row} className="flex overflow-x-auto overscroll-x-contain">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id} className="shrink-0">
              <a
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`type-title-small flex min-h-12 items-center justify-center whitespace-nowrap border-b-2 px-4 state-hover:bg-surface-container-low ${current ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}
                style={labelFace(item.text)}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SiteShell({ config, children }: { config: ShellConfig; children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const { layout, global } = useDesign();
  const order = layout['Site navigation'] ?? [];
  const nav = [...config.nav].sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
  const all = [...nav, ...config.more];
  const active = activeItem(all, pathname);
  const primaryActive = activeItem(nav, pathname);
  const drawer = global['Navigation on wide screens'] !== 'rail';
  return (
    <GlobalFilterProvider>
      <PageHeader
        brand={{ text: config.brand, href: href('/') }}
        nav={[]}
        navLabel={config.navLabel}
        menuLabel={config.menuLabel}
        skipLabel={config.skipLabel}
        skipTarget="#main"
        actions={<SiteFilters config={config.filters} />}
      />
      <div className="flex">
        <NavigationRail label={config.navLabel} items={nav} active={primaryActive} className={drawer ? 'hidden medium:flex large:hidden' : 'hidden medium:flex'} />
        {drawer ? <NavigationDrawer label={config.navLabel} items={all} active={active} className="hidden large:flex" /> : null}
        <div className="min-w-0 flex-1">
          <SiteTabs label={config.navLabel} items={nav} active={primaryActive} />
          <SiteFilterChips config={config.filters} />
          {children}
        </div>
      </div>
    </GlobalFilterProvider>
  );
}
