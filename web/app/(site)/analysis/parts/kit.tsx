'use client';

// Small parts the category and analysis views share: number formats, the count line, and the states a filtered
// view falls back to (no medals in scope, no medals match, partial years included). Every word arrives as copy.
import type { ReactNode } from 'react';
import { StateCard } from '@/components/StateCard';
import { TextLink } from '@/components/TextLink';

import { fill, years } from './format';

export { compact, fill, num, percent, share, usd, years } from './format';

export type ViewCopy = {
  noResultsTitle: string;
  removeHint: string;
  emptyScope: string;
  partialOne: string;
  partialMany: string;
  notDefined: string;
  medals: Record<string, string>;
  // Chart chrome: the save control and the labels of a binned legend.
  chrome: { savePng: string; binRange: string; binSingle: string; binOpen: string };
};

// The page's own scope holds no medals: say so. The filter leaves none: say so and how to widen it. Otherwise the
// view, under the partial years notice when the rows in view include a partial year.
export function ViewFrame({ rows, scopeCount, copy, firstCompleteYear, children }: { rows: Record<string, any>[]; scopeCount: number; copy: ViewCopy; firstCompleteYear: number | null; children: ReactNode }) {
  if (!scopeCount) return <StateCard kind="empty" title={copy.emptyScope} />;
  if (!rows.length) return <StateCard kind="empty" title={copy.noResultsTitle}>{copy.removeHint}</StateCard>;
  const partial = [...new Set(rows.filter((r) => r.partial).map((r) => r.year as number))].sort((a, b) => a - b);
  return (
    <>
      {partial.length ? (
        <StateCard kind="notice" title={fill(partial.length === 1 ? copy.partialOne : copy.partialMany, { years: years(partial), first_complete_year: firstCompleteYear ?? '' })} />
      ) : null}
      {children}
    </>
  );
}

export function Count({ text }: { text: string }) {
  return <p role="status" className="type-title-small tabular-nums text-on-surface">{text}</p>;
}

export const Cell = {
  none: (text: string) => <span className="text-on-surface-variant">{text}</span>,
  link: (href: string, text: string) => <TextLink href={href}>{text}</TextLink>,
};
