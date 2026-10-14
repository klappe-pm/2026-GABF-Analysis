'use client';

import { type ReactNode, useState } from 'react';
import { useDesign, useSettings } from '@/design/runtime';
import { color, onColor, typeOf } from '@/design/helpers';
import { Icon } from './Icon';

type NavItem = { id: string; href: string; text: string; current?: boolean };

type Props = {
  brand: { text: string; href: string };
  nav: NavItem[];
  navLabel: string;
  menuLabel: string;
  skipLabel: string;
  skipTarget: string;
  actions?: ReactNode;
  menuId?: string;
};

// The site header as a Material top app bar: the site name, then the navigation in the order the layout
// file gives. On phones the navigation folds behind a menu button.
export function PageHeader({ brand, nav, navLabel, menuLabel, skipLabel, skipTarget, actions, menuId = 'site-header-menu' }: Props) {
  const s = useSettings('page-header');
  const order = useDesign().layout['Site navigation'];
  const items = [...nav].sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
  const [open, setOpen] = useState(false);
  const current = color(s['Current page color'] ?? 'secondary container');
  const link = (item: NavItem) => (
    <a
      href={item.href}
      aria-current={item.current ? 'page' : undefined}
      className="type-label-large flex min-h-10 items-center rounded-(--md-sys-shape-corner-full) px-(--app-margin) text-on-surface-variant state-hover:bg-surface-container-highest"
      style={item.current ? { background: current, color: onColor(s['Current page color'] ?? 'secondary container') } : undefined}
    >
      {item.text}
    </a>
  );
  return (
    <header data-component="page-header" style={{ background: color(s['Container color'] ?? 'surface container') }}>
      <a href={skipTarget} className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-surface focus:p-2">{skipLabel}</a>
      <div className="mx-auto flex min-h-16 max-w-(--app-page-max) items-center gap-4 px-4">
        <a href={brand.href} className={`text-on-surface ${typeOf(s['Title style'] ?? 'title large')}`}>{brand.text}</a>
        <nav aria-label={navLabel} className="hidden medium:block">
          <ul className="flex gap-1">
            {items.map((item) => <li key={item.id}>{link(item)}</li>)}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          {items.length > 1 ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => setOpen((o) => !o)}
              className="type-label-large inline-flex min-h-10 items-center gap-2 rounded-(--md-sys-shape-corner-full) px-3 text-on-surface-variant state-hover:bg-surface-container-highest medium:hidden"
            >
              <Icon name={open ? 'close' : 'menu'} />
              {menuLabel}
            </button>
          ) : null}
        </div>
      </div>
      {items.length > 1 ? (
        <nav id={menuId} aria-label={navLabel} className={`px-2 pb-2 medium:hidden ${open ? 'block' : 'hidden'}`}>
          <ul className="flex flex-col gap-1">
            {items.map((item) => <li key={item.id}>{link(item)}</li>)}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
