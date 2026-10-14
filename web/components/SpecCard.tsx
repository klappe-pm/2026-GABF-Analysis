'use client';

import type { ReactNode } from 'react';
import { useSettings } from '@/design/runtime';
import { cardSurface, labelFace, typeOf } from '@/design/helpers';

// A card of published specs: a title, an optional line under it, and each spec as a label and its value in a
// description list. It carries a hop's variety data, a farm's data, and a beer's brewing details. A value
// may hold links, so the page passes it as drawn; a spec the data does not hold arrives as the page's
// "Not Found" text. The settings (spec-card) set the card style, the title style, and the label column width.

export type SpecRow = { label: string; value: ReactNode };

export function SpecCard({ id, title, note, rows, headingLevel = 2 }: { id: string; title: string; note?: string; rows: SpecRow[]; headingLevel?: 2 | 3 }) {
  const s = useSettings('spec-card');
  const card = cardSurface(s.Variant ?? 'outlined');
  const labelWidth = Number(s['Label width'] ?? 14);
  const Heading = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <section data-component="spec-card" aria-labelledby={`${id}-title`} className={`flex w-full min-w-0 max-w-measure flex-col gap-3 p-4 medium:p-5 ${card.className}`} style={card.style}>
      {card.elevated ? <md-elevation /> : null}
      <Heading id={`${id}-title`} className={`min-w-0 break-words text-on-surface ${typeOf(s['Title style'] ?? 'title large')}`}>{title}</Heading>
      {note ? <p className="type-body-medium text-on-surface-variant">{note}</p> : null}
      <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-3 medium:grid-cols-[var(--spec-label-width)_1fr]" style={{ ['--spec-label-width' as string]: `minmax(8rem,${labelWidth}rem)` }}>
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
