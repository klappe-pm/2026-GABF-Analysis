'use client';

import { useSettings } from '@/design/runtime';
import { labelFace, typeOf } from '@/design/helpers';

// The trail above a page title. The separator and text style come from the breadcrumb spec.
export function Breadcrumb({ label, items }: { label: string; items: { href?: string; text: string }[] }) {
  const s = useSettings('breadcrumb');
  return (
    <nav aria-label={label} data-component="breadcrumb">
      <ol className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-on-surface-variant ${typeOf(s['Text style'] ?? 'label large')}`}>
        {items.map((item, i) => (
          <li key={`${item.text}-${i}`} className="flex items-baseline gap-2" style={labelFace(item.text)}>
            {i > 0 ? <span aria-hidden="true" className="text-outline">{String(s.Separator ?? '/')}</span> : null}
            {item.href ? (
              <a href={item.href} className="text-primary underline state-hover:decoration-2">{item.text}</a>
            ) : (
              <span aria-current="page" className="text-on-surface">{item.text}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
