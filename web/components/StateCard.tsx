'use client';

import type { ReactNode } from 'react';
import { useReducedMotion, useSettings } from '@/design/runtime';
import { cardSurface } from '@/design/helpers';

type Props = {
  kind: 'empty' | 'loading' | 'error' | 'notice';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  stamp?: ReactNode;
};

// Empty, loading, error, and notice states, on a card in place of the view they replace.
// Loading shows a Material progress indicator (none under reduced motion); an error sits on the error container.
export function StateCard({ kind, title, children, action, stamp }: Props) {
  const s = useSettings('state-card');
  const card = cardSurface(s['Card style']);
  const reduce = useReducedMotion();
  if (kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className={`flex flex-col gap-3 p-4 ${card.className}`} style={card.style}>
        {card.elevated ? <md-elevation /> : null}
        <p className="type-title-small text-on-surface">{title}</p>
        {reduce ? null : s['Loading indicator'] === 'circular' ? <md-circular-progress indeterminate aria-label={title} /> : <md-linear-progress indeterminate aria-label={title} className="w-full" />}
      </div>
    );
  }
  const error = kind === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`flex flex-col gap-2 p-4 ${card.className}`}
      style={error ? { ...card.style, background: 'var(--md-sys-color-error-container)', border: 'none' } : card.style}
    >
      {card.elevated ? <md-elevation /> : null}
      <div className="flex flex-wrap items-center gap-3">
        {stamp}
        <p className={`type-title-medium ${error ? 'text-on-error-container' : 'text-on-surface'}`}>{title}</p>
      </div>
      {children ? <div className={`type-body-medium max-w-measure ${error ? 'text-on-error-container' : 'text-on-surface-variant'}`}>{children}</div> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
