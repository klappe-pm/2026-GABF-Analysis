// A medal drawn as a flat round mark: metal fill, a ring in ink, and the medal's initial.
// Medals are round objects, so this is the one circle in the system. The ring and the letter carry
// the meaning; the metal color is supplementary.

export type MedalName = 'Gold' | 'Silver' | 'Bronze';

const FILL: Record<MedalName, string> = { Gold: 'fill-gold', Silver: 'fill-silver', Bronze: 'fill-bronze' };

export function MedalMark({ medal, size = 'md', label = true, title }: { medal: MedalName; size?: 'sm' | 'md'; label?: boolean; title?: string }) {
  const box = size === 'sm' ? 'size-4' : 'size-5';
  return (
    <svg viewBox="0 0 24 24" className={`inline-block shrink-0 align-middle ${box}`} role="img" aria-label={title ?? medal} focusable="false">
      <circle cx="12" cy="12" r="11" className={`${FILL[medal]} stroke-medal-stroke`} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
      {label ? (
        <text x="12" y="12" textAnchor="middle" dominantBaseline="central" className="fill-medal-letter font-narrow font-bold" fontSize={13} aria-hidden="true">
          {medal[0]}
        </text>
      ) : null}
    </svg>
  );
}
