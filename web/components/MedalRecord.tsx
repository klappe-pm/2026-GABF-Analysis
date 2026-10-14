'use client';

import { useSettings } from '@/design/runtime';
import { MedalMark, type MedalName } from './MedalMark';

export type MedalCounts = { gold: number; silver: number; bronze: number };

const ORDER: [keyof MedalCounts, MedalName][] = [['gold', 'Gold'], ['silver', 'Silver'], ['bronze', 'Bronze']];

// The gold, silver, bronze record as one value, written in the order gold / silver / bronze.
// "split" shows one mark per medal type with its count; "tally" shows one mark per medal won, up to the
// spec's tally limit; "value" is the record as text.
export function MedalRecord({ counts, variant = 'split', names }: { counts: MedalCounts; variant?: 'split' | 'tally' | 'value'; names: Record<MedalName, string> }) {
  const s = useSettings('medal-record');
  const limit = Number(s['Tally limit'] ?? 12);
  const spoken = ORDER.map(([k, m]) => `${counts[k]} ${names[m].toLowerCase()}`).join(', ');
  const value = `${counts.gold} / ${counts.silver} / ${counts.bronze}`;
  if (variant === 'value') {
    return <span className="type-body-large font-plain tabular-nums" aria-label={spoken}>{value}</span>;
  }
  if (variant === 'tally') {
    return (
      <span className="inline-flex flex-col gap-1" role="img" aria-label={spoken}>
        {ORDER.map(([k, m]) => (
          <span key={k} className="inline-flex flex-wrap items-center gap-1" aria-hidden="true">
            {Array.from({ length: Math.min(counts[k], limit) }, (_, i) => <MedalMark key={i} medal={m} size="sm" label={false} />)}
            {counts[k] > limit ? <span className="type-label-small font-plain tabular-nums text-on-surface-variant">+{counts[k] - limit}</span> : null}
            {counts[k] === 0 ? <span className="type-label-small font-plain text-on-surface-variant">0</span> : null}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-3 tabular-nums" role="img" aria-label={spoken}>
      {ORDER.map(([k, m]) => (
        <span key={k} className="inline-flex items-center gap-1" aria-hidden="true">
          <MedalMark medal={m} size="sm" />
          <span className="type-title-small font-plain">{counts[k]}</span>
        </span>
      ))}
    </span>
  );
}
