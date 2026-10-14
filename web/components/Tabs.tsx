import { labelFace } from '@/design/helpers';

export type TabItem = { id: string; href: string; text: string };

// Material's primary tabs, as links between pages: a row of labels with a bar under the current one.
// Each tab is an ordinary link, so it works without scripts, opens in a new tab, and is in the page's
// keyboard order. The current tab carries aria-current.
export function Tabs({ label, items, active }: { label: string; items: TabItem[]; active: string }) {
  return (
    <nav aria-label={label} className="-mx-(--app-margin) overflow-x-auto border-b border-outline-variant px-(--app-margin)">
      <ul className="flex min-w-max gap-2">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`type-title-small relative flex h-12 items-center px-4 state-hover:bg-surface-container-low ${current ? 'text-primary' : 'text-on-surface-variant'}`}
                style={labelFace(item.text)}
              >
                {item.text}
                {current ? <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-primary" /> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
