import type { CSSProperties } from 'react';
import { TextLink } from './TextLink';

type Props = { id: string; marker: string; label: string; explanation: string; link: { href: string; text: string }; state?: string };

// The (E) beside an estimated figure. It is a button that opens a note explaining the estimate,
// using the native popover: light dismiss, Escape to close, focus returns to the mark.
export function EstimatePopover({ id, marker, label, explanation, link, state }: Props) {
  const anchor = `--estimate-${id}`;
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={label}
        data-state={state}
        className="cursor-help border-b border-dotted border-red px-1 font-narrow text-label text-red state-hover:bg-red-tint"
        style={{ anchorName: anchor } as CSSProperties}
      >
        {marker}
      </button>
      <div
        id={id}
        popover="auto"
        role="note"
        className="anchored-note max-w-measure border border-red bg-ground p-3 text-data text-ink"
        style={{ positionAnchor: anchor } as CSSProperties}
      >
        <p>{explanation}</p>
        <p className="mt-2"><TextLink href={link.href} tone="red">{link.text}</TextLink></p>
      </div>
    </>
  );
}
