'use client';

import type { CSSProperties } from 'react';
import { useSettings } from '@/design/runtime';
import { color, onColor, shape } from '@/design/helpers';
import { href as siteHref, paths } from '@/lib/href';
import { TextLink } from './TextLink';

// href is the address of the note's link; it defaults to the estimates section of the Method page,
// carried under the base path, so every (E) on the site leads to the same explanation.
type Props = { id: string; marker: string; label: string; explanation: string; linkText: string; href?: string };

// The (E) beside an estimated figure: a button that opens a note explaining the estimate, drawn like
// Material's rich tooltip. It uses the native popover: light dismiss, Escape to close, focus returns to the mark.
export function EstimateTooltip({ id, marker, label, explanation, linkText, href = siteHref(paths.methodEstimates) }: Props) {
  const s = useSettings('estimate-tooltip');
  const anchor = `--estimate-${id}`;
  const surface = s.Surface ?? 'surface container';
  return (
    <>
      <button
        type="button"
        data-component="estimate-tooltip"
        popoverTarget={id}
        aria-label={label}
        className="type-label-large cursor-help rounded-(--md-sys-shape-corner-extra-small) px-1 text-primary underline decoration-dotted state-hover:bg-primary-container"
        style={{ anchorName: anchor } as CSSProperties}
      >
        {marker}
      </button>
      <div
        id={id}
        popover="auto"
        role="note"
        className="anchored-note type-body-medium max-w-measure p-4"
        style={{ positionAnchor: anchor, background: color(surface), color: onColor(surface), borderRadius: shape(s.Shape ?? 'medium'), ['--md-elevation-level' as string]: Number(s.Elevation ?? 2) } as CSSProperties}
      >
        <md-elevation />
        <p>{explanation}</p>
        <p className="mt-2"><TextLink href={href}>{linkText}</TextLink></p>
      </div>
    </>
  );
}
