'use client';

import type { ReactNode } from 'react';
import { useSettings } from '@/design/runtime';
import { cardSurface, color, labelFace } from '@/design/helpers';
import { TextLink } from './TextLink';

// A written finding on a card, marked with the spec's accent color. A page carries one or two at most.
export function RedPenNote({ label, children, link }: { label: string; children: ReactNode; link?: { href: string; text: string } }) {
  const s = useSettings('red-pen-note');
  const card = cardSurface(s['Card style']);
  const accent = color(s['Accent color'] ?? 'tertiary');
  return (
    <aside aria-label={label} className={`flex max-w-measure flex-col gap-2 p-4 ${card.className}`} style={{ ...card.style, borderLeft: `4px solid ${accent}` }}>
      {card.elevated ? <md-elevation /> : null}
      <p className="type-label-large" style={{ color: accent, ...labelFace(label) }}>{label}</p>
      <p className="type-title-medium text-on-surface">{children}</p>
      {link ? <p className="type-body-medium"><TextLink href={link.href}>{link.text}</TextLink></p> : null}
    </aside>
  );
}
