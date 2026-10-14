'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type NavItem = { href: string; text: string; current?: boolean };

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

// The site header as the head of a form: the name in the first box, navigation as ruled boxes,
// a heavy rule underneath. On phones the navigation folds behind a Menu button.
export function FormHeader({ brand, nav, navLabel, menuLabel, skipLabel, skipTarget, actions, menuId = 'form-header-menu' }: Props) {
  const [open, setOpen] = useState(false);
  const link = (item: NavItem, stacked: boolean) => (
    <a
      href={item.href}
      aria-current={item.current ? 'page' : undefined}
      className={`flex items-center font-narrow text-label uppercase ${stacked ? 'px-4 py-3' : 'h-full px-4 py-3'} ${item.current ? 'bg-green-tint text-green' : 'text-ink state-hover:bg-ground-tone'}`}
    >
      {item.text}
    </a>
  );
  return (
    <header className="border-b-2 border-ink bg-ground">
      <a href={skipTarget} className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-ground focus:p-2">{skipLabel}</a>
      <div className="mx-auto flex max-w-page items-stretch">
        <a href={brand.href} className="flex items-center border-r border-rule px-4 py-3 text-h3 text-ink">{brand.text}</a>
        <nav aria-label={navLabel} className="hidden md:flex">
          <ul className="flex">
            {nav.map((item) => <li key={item.href} className="border-r border-rule">{link(item, false)}</li>)}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2 px-3">
          {actions}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex min-h-6 items-center gap-2 border border-rule-strong px-3 py-1 font-narrow text-label uppercase text-ink state-hover:bg-ground-tone md:hidden"
          >
            <Icon name={open ? 'close' : 'menu'} />
            {menuLabel}
          </button>
        </div>
      </div>
      <nav id={menuId} aria-label={navLabel} className={`border-t border-rule md:hidden ${open ? 'block' : 'hidden'}`}>
        <ul>
          {nav.map((item) => <li key={item.href} className="border-b border-rule last:border-b-0">{link(item, true)}</li>)}
        </ul>
      </nav>
    </header>
  );
}
