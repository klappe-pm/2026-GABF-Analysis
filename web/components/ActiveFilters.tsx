'use client';

import { useSettings } from '@/design/runtime';
import { hasFigure, shape, typeOf, vars } from '@/design/helpers';
import { Button } from './Button';

type Entry = { text: string; removeLabel?: string; fixedNote?: string };

// The active filters as Material chips: an input chip with a remove button for each filter the reader
// set, an assist chip for one the page fixes. Chips that hold a figure set it in Public Sans.
// The page owns the filter state: removing a chip calls onRemove, and the chip stays until the page drops it.
export function ActiveFilters({ label, entries, clearLabel, onRemove }: { label: string; entries: Entry[]; clearLabel: string; onRemove?: (text: string) => void }) {
  const s = useSettings('active-filters');
  const corner = shape(s.Shape ?? 'small');
  const plain = 'var(--md-ref-typeface-plain)';
  return (
    <section aria-label={label} className="flex flex-wrap items-center gap-2">
      <h2 className={`text-on-surface-variant ${typeOf('label large')}`}>{label}</h2>
      <md-chip-set>
        {entries.map((e) => (e.removeLabel ? (
          <md-input-chip
            key={e.text}
            label={e.text}
            aria-label-remove={e.removeLabel}
            onremove={(ev: Event) => { ev.preventDefault(); onRemove?.(e.text); }}
            style={vars({ '--md-input-chip-container-shape': corner, '--md-input-chip-label-text-font': hasFigure(e.text) ? plain : undefined })}
          />
        ) : (
          <md-assist-chip
            key={e.text}
            label={e.text}
            title={e.fixedNote}
            elevated={s['Chip style'] === 'elevated' || undefined}
            style={vars({ '--md-assist-chip-container-shape': corner, '--md-assist-chip-label-text-font': hasFigure(e.text) ? plain : undefined })}
          />
        )))}
      </md-chip-set>
      <Button variant="quiet">{clearLabel}</Button>
    </section>
  );
}
