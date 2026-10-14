'use client';

import type { ReactNode } from 'react';
import { cardSurface, labelFace } from '@/design/helpers';

// A card of published specs: a title, an optional line under it, and each spec as a label and its value in a
// description list. It carries a hop's variety data, a farm's data, and a beer's brewing details. A value
// may hold links, so the page passes it as drawn; a spec the data does not hold arrives as the page's
// "not defined" text.

export type SpecRow = { label: string; value: ReactNode };

export function SpecCard({ id, title, note, rows, headingLevel = 2 }: { id: string; title: string; note?: string; rows: SpecRow[]; headingLevel?: 2 | 3 }) {
  const card = cardSurface('outlined');
  const Heading = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <section aria-labelledby={`${id}-title`} className={`flex w-full min-w-0 max-w-measure flex-col gap-3 p-4 medium:p-5 ${card.className}`} style={card.style}>
      {card.elevated ? <md-elevation /> : null}
      <Heading id={`${id}-title`} className="type-title-large min-w-0 break-words text-on-surface">{title}</Heading>
      {note ? <p className="type-body-medium text-on-surface-variant">{note}</p> : null}
      <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-3 medium:grid-cols-[minmax(8rem,14rem)_1fr]">
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="contents">
            <dt className="type-label-large text-on-surface-variant" style={labelFace(r.label)}>{r.label}</dt>
            <dd className="type-body-medium min-w-0 break-words text-on-surface">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
