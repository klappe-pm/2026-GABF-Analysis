'use client';

import type { CSSProperties } from 'react';
import { useSettings } from '@/design/runtime';
import { color, labelFace, onColor, shape } from '@/design/helpers';
import { href as siteHref, paths } from '@/lib/href';
import { TextLink } from './TextLink';

// One input an estimate used: its label, its value as drawn, and where it came from when a source is known.
// The page passes every word; a source href is a full address, or a site path already passed through href().
export type EstimateInput = { label: string; value: string; source?: { href: string; text: string } };

// href is the address of the note's link; it defaults to the estimates section of the Method page,
// carried under the base path, so every (E) on the site leads to the same explanation. inputs, when given,
// list what the estimate used, under the explanation.
type Props = { id: string; marker: string; label: string; explanation: string; inputs?: EstimateInput[]; linkText: string; href?: string };

// The (E) beside an estimated figure: a button that opens a note explaining the estimate, drawn like
// Material's rich tooltip. It uses the native popover: light dismiss, Escape to close, focus returns to the mark.
export function EstimateTooltip({ id, marker, label, explanation, inputs, linkText, href = siteHref(paths.methodEstimates) }: Props) {
  const s = useSettings('estimate-tooltip');
  const anchor = `--estimate-${id}`;
  const surface = s.Surface ?? 'surface container';
  const listed = s['Show inputs'] === 'no' ? [] : inputs ?? [];
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
        {listed.length ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1" data-part="estimate-inputs">
            {listed.map((input, i) => (
              <div key={`${input.label}-${i}`} className="contents">
                <dt className="type-label-medium" style={labelFace(input.label)}>{input.label}</dt>
                <dd className="type-body-small min-w-0 break-words">
                  {input.value}
                  {input.source ? <>{' '}<TextLink href={input.source.href}>{input.source.text}</TextLink></> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        <p className="mt-2"><TextLink href={href}>{linkText}</TextLink></p>
      </div>
    </>
  );
}
