'use client';

import { useSettings } from '@/design/runtime';
import { color } from '@/design/helpers';

// A medal as a round mark: the metal fill from the settings, a ring, and the medal's initial.
// The ring and the letter carry the meaning; the metal color is supplementary.

export type MedalName = 'Gold' | 'Silver' | 'Bronze';

const FILL: Record<MedalName, string> = { Gold: 'var(--app-color-gold)', Silver: 'var(--app-color-silver)', Bronze: 'var(--app-color-bronze)' };

export function MedalMark({ medal, size = 'md', label = true, title }: { medal: MedalName; size?: 'sm' | 'md'; label?: boolean; title?: string }) {
  const s = useSettings('medal-mark');
  const full = Number(s.Size ?? 24);
  const px = size === 'sm' ? Math.round(full * 0.75) : full;
  const ring = color(s['Ring color'] ?? 'on surface');
  const initial = label && s['Show initial'] !== 'no';
  return (
    <svg viewBox="0 0 24 24" width={px} height={px} className="inline-block shrink-0 align-middle" role="img" aria-label={title ?? medal} focusable="false">
      <circle cx="12" cy="12" r="11" style={{ fill: FILL[medal], stroke: ring }} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
      {initial ? (
        <text x="12" y="12" textAnchor="middle" dominantBaseline="central" style={{ fill: ring, fontFamily: 'var(--app-typeface-label)', fontWeight: 700 }} fontSize={13} aria-hidden="true">
          {medal[0]}
        </text>
      ) : null}
    </svg>
  );
}
