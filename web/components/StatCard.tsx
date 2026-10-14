'use client';

import type { ReactNode } from 'react';
import { useSettings } from '@/design/runtime';
import { cardSurface, labelFace, typeOf } from '@/design/helpers';

// A recorded figure on a Material card: its label, then the figure. Fields sit in a FieldGrid, which is
// a description list, so each card is a term and its description.

export function FieldGrid({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <dl aria-label={label} className="grid grid-cols-1 gap-3 medium:grid-cols-2 expanded:grid-cols-4">
      {children}
    </dl>
  );
}

export function Field({ label, children, note, size = 'figure' }: { label: string; children: ReactNode; note?: ReactNode; size?: 'figure' | 'text' }) {
  const s = useSettings('stat-card');
  const card = cardSurface(s['Card style']);
  return (
    <div className={`flex flex-col gap-1 px-4 py-3 ${card.className}`} style={card.style}>
      {card.elevated ? <md-elevation /> : null}
      <dt className={`text-on-surface-variant ${typeOf(s['Label style'] ?? 'label medium')}`} style={labelFace(label)}>{label}</dt>
      <dd className={size === 'figure' ? `tabular-nums text-on-surface ${typeOf(s['Figure style'] ?? 'headline small')}` : 'type-title-medium text-on-surface'}>{children}</dd>
      {note ? <dd className="type-body-small text-on-surface-variant">{note}</dd> : null}
    </div>
  );
}
