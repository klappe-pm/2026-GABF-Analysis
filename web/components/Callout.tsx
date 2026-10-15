'use client';

import type { ReactNode } from 'react';
import { useSettings } from '@/design/runtime';
import { cardSurface, color, labelFace, onColor } from '@/design/helpers';
import { TextLink } from './TextLink';

// The container role Material pairs with an accent role; a role with no container of its own is used as it is.
const containerOf = (role: string) => (/^(primary|secondary|tertiary|error)$/.test(role) ? `${role} container` : role);

// A written finding on a card filled with the container tone of the spec's accent color, so the whole card is
// marked rather than one edge. A page carries one or two at most.
export function Callout({ label, children, link }: { label: string; children: ReactNode; link?: { href: string; text: string } }) {
  const s = useSettings('callout');
  const card = cardSurface(s['Card style']);
  const tone = containerOf(String(s['Accent color'] ?? 'tertiary'));
  const ink = onColor(tone);
  return (
    <aside aria-label={label} data-component="callout" className={`flex max-w-measure flex-col gap-2 p-4 ${card.className}`} style={{ ...card.style, background: color(tone), color: ink }}>
      {card.elevated ? <md-elevation /> : null}
      <p className="type-label-large" style={{ color: ink, ...labelFace(label) }}>{label}</p>
      <p className="type-title-medium">{children}</p>
      {link ? <p className="type-body-medium"><TextLink href={link.href}>{link.text}</TextLink></p> : null}
    </aside>
  );
}
