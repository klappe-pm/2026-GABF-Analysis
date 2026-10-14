'use client';

import { useSettings } from '@/design/runtime';
import { cardSurface, labelFace, typeOf } from '@/design/helpers';
import { Facts } from './BeerProfileCard';
import { TextLink } from './TextLink';

// One hop variety on a Material card: its name, then origin, breeder, alpha and oil ranges, US acreage, and
// the count of 2026 medal beers that use it as a description list, its aroma descriptors with their source,
// and the farms that grow it, up to the spec's farm limit. The page passes every visible word; a value the
// data does not hold arrives as the page's "Not Found" text.

export type HopCardData = {
  name: string;
  facts: { label: string; value: string }[];
  aroma: { label: string; text: string | null; source?: { href: string; text: string } };
  // `more` holds {{count}}, filled with the number of farms past the limit.
  farms: { label: string; items: { name: string; href?: string }[]; more: string };
  notDefined: string;
  // The link to the hop's own page, on cards listed on other pages. The hop's own page leaves it out.
  link?: { href: string; text: string };
};

export function HopProfileCard({ data, headingLevel = 3 }: { data: HopCardData; headingLevel?: 2 | 3 | 4 }) {
  const s = useSettings('hop-profile-card');
  const card = cardSurface(s.Variant ?? 'outlined');
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const limit = Number(s['Farm limit'] ?? 5);
  const shown = data.farms.items.slice(0, limit);
  const rest = data.farms.items.length - shown.length;
  return (
    <article className={`flex w-full min-w-0 max-w-measure flex-col gap-4 p-4 medium:p-5 ${card.className}`} style={card.style} data-component="hop-profile-card">
      {card.elevated ? <md-elevation /> : null}
      <Heading className={`min-w-0 break-words text-on-surface ${typeOf(s['Name style'] ?? 'title large')}`}>{data.name}</Heading>
      <Facts items={data.facts} />
      {s['Show aroma'] === 'no' ? null : (
        <section className="flex min-w-0 flex-col gap-1">
          <p className="type-label-medium text-on-surface-variant" style={labelFace(data.aroma.label)}>{data.aroma.label}</p>
          <p className={`type-body-medium min-w-0 break-words ${data.aroma.text ? 'text-on-surface' : 'text-on-surface-variant'}`}>{data.aroma.text ?? data.notDefined}</p>
          {data.aroma.text && data.aroma.source ? <p className="type-body-small min-w-0 break-words"><TextLink href={data.aroma.source.href}>{data.aroma.source.text}</TextLink></p> : null}
        </section>
      )}
      {s['Show grower farms'] === 'no' ? null : (
        <>
          <md-divider />
          <section className="flex min-w-0 flex-col gap-1">
            <p className="type-label-medium text-on-surface-variant" style={labelFace(data.farms.label)}>{data.farms.label}</p>
            {shown.length ? (
              <ul className="flex min-w-0 flex-col gap-1">
                {shown.map((f) => (
                  <li key={f.name} className="type-body-medium min-w-0 break-words text-on-surface">
                    {f.href ? <TextLink href={f.href}>{f.name}</TextLink> : f.name}
                  </li>
                ))}
                {rest > 0 ? <li className="type-body-small text-on-surface-variant">{data.farms.more.replace('{{count}}', String(rest))}</li> : null}
              </ul>
            ) : <p className="type-body-medium text-on-surface-variant">{data.notDefined}</p>}
          </section>
        </>
      )}
      {data.link ? <p className="type-body-medium"><TextLink href={data.link.href}>{data.link.text}</TextLink></p> : null}
    </article>
  );
}
