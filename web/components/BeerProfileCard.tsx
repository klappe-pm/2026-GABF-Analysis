'use client';

import type { ReactNode } from 'react';
import { useSettings } from '@/design/runtime';
import { cardSurface, hasFigure, labelFace, typeOf, vars } from '@/design/helpers';
import { MedalMark, type MedalName } from './MedalMark';
import { TextLink } from './TextLink';

// One winning beer on a Material card: its name, brewery, and medal, then category, ABV, IBU, and style as a
// description list, its hops as assist chips that open each variety's page, an excerpt of its tasting note
// with the source, and a link to the beer's full profile. The page passes every visible word; a value the
// data does not hold arrives as the page's "not defined" text.

export type BeerCardData = {
  name: string;
  breweryLine: string;
  medal: MedalName;
  medalLabel: string;
  facts: { label: string; value: string }[];
  hops: { name: string; href: string }[];
  hopsLabel: string;
  noHops: string;
  note: { label: string; text: string; source?: { href: string; text: string } } | null;
  noNote: string;
  link: { href: string; text: string };
};

// Cut a note at the last word boundary within `limit` characters.
export function excerpt(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit + 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? cut.slice(0, space) : text.slice(0, limit)).replace(/[\s,;:.]+$/, '')}…`;
}

export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 medium:grid-cols-4">
      {items.map((f) => (
        <div key={f.label} className="flex min-w-0 flex-col">
          <dt className="type-label-medium text-on-surface-variant" style={labelFace(f.label)}>{f.label}</dt>
          <dd className="type-body-large min-w-0 break-words text-on-surface tabular-nums">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BeerProfileCard({ data, headingLevel = 3 }: { data: BeerCardData; headingLevel?: 2 | 3 | 4 }) {
  const s = useSettings('beer-profile-card');
  const card = cardSurface(s.Variant ?? 'outlined');
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const limit = Number(s['Tasting note length'] ?? 160);
  const plain = 'var(--md-ref-typeface-plain)';
  return (
    <article className={`flex w-full min-w-0 max-w-measure flex-col gap-4 p-4 medium:p-5 ${card.className}`} style={card.style} data-component="beer-profile-card">
      {card.elevated ? <md-elevation /> : null}
      <header className="flex min-w-0 flex-col gap-1">
        <p className="inline-flex items-center gap-2">
          <MedalMark medal={data.medal} title={data.medalLabel} />
          <span className="type-label-large text-on-surface-variant" style={labelFace(data.medalLabel)}>{data.medalLabel}</span>
        </p>
        <Heading className={`min-w-0 break-words text-on-surface ${typeOf(s['Name style'] ?? 'title large')}`}>{data.name}</Heading>
        <p className="type-body-medium text-on-surface-variant">{data.breweryLine}</p>
      </header>
      <Facts items={data.facts} />
      {s['Show hop chips'] === 'no' ? null : (
        <section className="flex min-w-0 flex-col gap-1" aria-label={data.hopsLabel}>
          <p className="type-label-medium text-on-surface-variant" style={labelFace(data.hopsLabel)}>{data.hopsLabel}</p>
          {data.hops.length ? (
            <md-chip-set>
              {data.hops.map((h) => (
                <md-assist-chip
                  key={h.name}
                  label={h.name}
                  href={h.href}
                  elevated={s['Hop chip style'] === 'elevated' || undefined}
                  style={vars({ '--md-assist-chip-label-text-font': hasFigure(h.name) ? plain : undefined })}
                />
              ))}
            </md-chip-set>
          ) : <p className="type-body-medium text-on-surface-variant">{data.noHops}</p>}
        </section>
      )}
      <md-divider />
      <section className="flex min-w-0 flex-col gap-1">
        {data.note ? (
          <>
            <p className="type-label-medium text-on-surface-variant" style={labelFace(data.note.label)}>{data.note.label}</p>
            <blockquote className="type-body-medium min-w-0 break-words text-on-surface">{excerpt(data.note.text, limit)}</blockquote>
            {data.note.source ? <p className="type-body-small min-w-0 break-words"><TextLink href={data.note.source.href}>{data.note.source.text}</TextLink></p> : null}
          </>
        ) : <p className="type-body-medium text-on-surface-variant">{data.noNote}</p>}
      </section>
      <p className="type-body-medium"><TextLink href={data.link.href}>{data.link.text}</TextLink></p>
    </article>
  );
}
