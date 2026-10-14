'use client';

import { useSettings } from '@/design/runtime';
import { hasFigure, shape, vars } from '@/design/helpers';

export type LinkChip = { text: string; href: string; title?: string };

// A row of Material assist chips that are links: each says one fact (a year and its status) and leads to
// the page that explains it. A chip that holds a figure sets it in Public Sans.
export function LinkChips({ label, chips }: { label: string; chips: LinkChip[] }) {
  const s = useSettings('chips');
  const corner = shape(s.Shape ?? 'small');
  const plain = 'var(--md-ref-typeface-plain)';
  return (
    <section aria-label={label} data-component="chips" className="flex flex-wrap items-center gap-2">
      <md-chip-set>
        {chips.map((c) => (
          <md-assist-chip
            key={c.text}
            label={c.text}
            href={c.href}
            title={c.title}
            style={vars({ '--md-assist-chip-container-shape': corner, '--md-assist-chip-label-text-font': hasFigure(c.text) ? plain : undefined })}
          />
        ))}
      </md-chip-set>
    </section>
  );
}
